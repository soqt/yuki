# 排程系统（模块 C，BullMQ）

把「每天早上7点播报北京天气」「明天9点提醒我开会」这类请求落到 Redis 里持久化，
按时触发，再把结果推给用户。实现的是模块 A（`src/agent/types.ts`）定义的
`SchedulerPort` 契约，取代旧的外部 cron（`client/` 目录手工调 API 的方式）。

## 是什么

```
Agent (create_reminder / list_reminders / cancel_reminder 工具)
        │  调用
        ▼
BullSchedulerPort (SchedulerPort 实现)
        │                              taskStore (Redis hash，按 openid 索引)
        ├─ 一次性任务 → queue.add(..., { delay })
        └─ 循环任务   → queue.upsertJobScheduler(id, { pattern: cron, tz })
        ▼
BullMQ Queue "yuki-tasks" (Redis)
        │  到点触发
        ▼
worker.ts（独立进程）
        │  job.data → 组装 UserProfile → createAgent().chat(...) 生成推送文案
        ▼
Notifier.push(openid, text)   ← 默认 ConsoleNotifier，正式环境换成模板/订阅消息
```

## 文件

| 文件 | 作用 |
|---|---|
| `queue.ts` | BullMQ `Queue`（`yuki-tasks`）+ 共享的 ioredis 连接（沿用 `src/redis/index.ts` 的 host 约定：生产 `yuki_redis`，其他 `127.0.0.1:6379`），并额外设置 BullMQ 要求的 `maxRetriesPerRequest: null` |
| `taskStore.ts` | `yuki:tasks:{openid}` 这个 Redis hash 的读写封装：`id -> JSON(ReminderRecord)`。BullMQ 本身没有「某用户的所有任务」这种查询，所以 `list` / `cancel` 靠这层索引 |
| `BullSchedulerPort.ts` | `SchedulerPort` 的 BullMQ 实现：`create` / `list` / `cancel` |
| `notifier.ts` | `Notifier` 接口 + `ConsoleNotifier`（默认，打日志）+ `TemplateMessageNotifier`（模板消息 stub，见下面的重要提示） |
| `worker.ts` | 独立进程入口：消费 `yuki-tasks` 队列，触发时调用 agent 生成文案并推送 |
| `index.ts` | `createScheduler()` 工厂 + 全部类型/类导出 |

## `create` 的语义（对应 `ReminderInput`）

- `recurring: true` → `when` 是 **cron 表达式**（如 `0 7 * * *`），通过 BullMQ v5 的
  **Job Scheduler API** 注册：`queue.upsertJobScheduler(id, { pattern, tz }, { name, data })`。
  时区目前固定为 `Asia/Shanghai`（`ReminderInput` 里没有时区字段，和 Agent 的默认值保持一致）。
- `recurring` 为空/`false` → `when` 是 **ISO-8601 时间**，算出 `delay` 后
  `queue.add(name, data, { delay, jobId: id })` 注册为一次性延迟任务。
  **`when` 早于当前时间会直接抛错**（拒绝而不是钳到 0 立即触发——时间在过去几乎总是
  意味着用户/模型说的时间被误解了，静默立刻触发反而更让人困惑）。这个 error 会被
  `Agent.ts` 的工具调用循环捕获，变成「工具执行失败：...」回传给模型，模型可以据此
  向用户确认时间。

每次 `create` 都会把结果落一份 `ReminderRecord`（`status: 'scheduled'`）到 `taskStore`。

`cancel` 会先从 `taskStore` 查出记录判断是否 `recurring`，据此调用
`queue.removeJobScheduler(id)` 或 `queue.remove(id)`，再删掉 `taskStore` 里的记录；
返回值表示「这个任务在 `taskStore` 里是否存在过」，不强依赖 BullMQ 那次调用是否真的
删掉了东西（比如任务已经触发完毕自动清理过）。

一次性任务触发后，`worker.ts` 会把 `taskStore` 里对应的记录删掉（避免 `list_reminders`
一直显示一条已经跑过的「已登记」任务）；循环任务的记录会保留，因为 Job Scheduler
会持续按同一个 id 产生新的任务实例。

## 运行 worker

需要一个可访问的 Redis（本地开发起 `docker-compose up redis` 或本机装的 Redis 都行，
监听 `127.0.0.1:6379`；生产环境走 docker-compose 网络里的 `yuki_redis`）。

```bash
npx tsc                 # 编译到 dist/
node dist/src/scheduler/worker.js
# 或
npm run worker           # package.json 里的 "worker" 脚本，等价于上面这行
```

worker 启动时会打印一行日志确认正在监听哪个队列；默认用 `ConsoleNotifier`，
所以不配置任何微信凭证也能跑起来、在终端里看到「本应推送的内容」。

## 接入 agent

```ts
import { createAgent, buildSchedulingTools } from '../agent';
import { createScheduler } from '../scheduler';

const agent = createAgent();
for (const t of buildSchedulingTools(createScheduler())) agent.registerTool(t);
```

这样 `create_reminder` / `list_reminders` / `cancel_reminder` 这几个工具就有了真正的
后端。`createScheduler()` 只是 `new BullSchedulerPort()` 的工厂封装，方便以后替换实现
或者在测试里 mock。

## 重要提示：正式推送必须走模板消息 / 订阅消息，不能用客服消息

`src/gm/service.ts` 里现有的 `WXMessager.send()` 调用方式属于**客服消息**语义——
只能在用户最近 48 小时内主动找公众号说过话的「客服消息窗口」内发送。而这里的定时任务
（比如「每天早上7点播报天气」）是**闹钟式**触发，不是对某条用户消息的即时响应，
触发的时候 48 小时窗口大概率已经关闭，用客服消息会静默发送失败。

所以：
- `worker.ts` 默认接的是 `ConsoleNotifier`（只打日志），保证这个模块不依赖任何微信配置
  就能跑、能测。
- `notifier.ts` 里的 `TemplateMessageNotifier` 只是一个**占位实现**，复用了
  `WXMessager.send()` 的调用形状，但还不能直接用于生产：
  - 需要在微信公众平台后台新建一个**能承载任意文本**的模板消息（或订阅消息）模板——
    `src/gm/service.ts` 里现成的 `WX_TEMPLATE_ID` 是为天气播报的固定 `keyword1..4`
    字段设计的，不能直接拿来发 agent 生成的自由文本。
  - 模板审核通过后把新模板 id 配置到环境变量（例如 `WX_SCHEDULER_TEMPLATE_ID`），
    并按模板的真实字段名调整 `TemplateMessageNotifier.push()` 里 `prepareMessage()`
    传的对象结构。
  - 这部分是产品 / 微信后台配置工作，不是纯代码改动，所以留成 TODO。

## 已知限制

- 时区固定 `Asia/Shanghai`；`ReminderInput` 目前没有时区字段可用。
- `queue.ts` 里对 BullMQ 的 `connection` 选项做了一次类型断言（`as unknown as
  ConnectionOptions`）：项目里 `ioredis` 被 pnpm 解析出两份（顶层一份、bullmq 自己
  依赖的子树一份），两份包结构相同但 TypeScript 按不同模块路径判为不同的名义类型。
  运行时是同一个 ioredis 客户端，这里只是绕开一个类型层面的重复依赖误报。
