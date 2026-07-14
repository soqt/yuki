# Agent 核心（模块 A）

把 Yuki 从「写死的早安推送」升级成「能听懂人话、能调用工具、能接任务」的私人助理的大脑。

## 是什么

一个 **Claude tool-use 循环**：接收一条用户消息 + 用户上下文 → 让 Claude 理解意图 →
按需调用工具 → 汇总成一句回复。现有的 `QWeather` / `Juhe` / `clothing` 已经被包装成工具。

```
用户消息 + UserProfile ──► Agent.chat() ──► Claude（+工具）──► reply + 更新后的 history
                                              │
                                   get_weather / get_horoscope / (可扩展)
```

## 文件

| 文件 | 作用 |
|---|---|
| `Agent.ts` | 核心类：tool-use 循环、system prompt、工具注册表 |
| `types.ts` | 领域类型：`UserProfile` / `AgentContext` / `AgentTool` / `SchedulerPort`（不依赖任何 SDK） |
| `tools/weather.ts` | `get_weather` —— 包装 QWeather + clothing |
| `tools/horoscope.ts` | `get_horoscope` —— 包装 Juhe |
| `tools/scheduling.ts` | `create_reminder` / `list_reminders` / `cancel_reminder` —— 面向 LLM 的排程工具，后端由模块 C 提供 |
| `index.ts` | `createAgent()` 工厂 + 全部导出 |
| `demo.ts` | 命令行快速测试 |

## 快速试用

```bash
# 需要 ANTHROPIC_API_KEY（以及 QWEATHER_KEY / JUHE_KEY）
pnpm build
node dist/src/agent/demo.js "帮我查下上海天气，适合穿什么"
```

## 在代码里用

```ts
import { createAgent } from './agent';

const agent = createAgent(); // 已加载 get_weather / get_horoscope

const { reply, history } = await agent.chat({
  message: '今天适合穿什么？',
  ctx: { user: { openid, nickname: 'Yuki', city: '北京', constellation: '天秤座' } },
});
// 多轮：把 history 存起来，下一轮传回去
```

## 给模块 B / C 的集成点

**B（微信入站）** —— 每收到一条用户消息调一次 `agent.chat()`，按 openid 持久化
`history` 以支持多轮。⚠️ 微信被动回复需在 5 秒内返回；Claude + 工具调用通常超过 5 秒，
所以 B 应当先同步回一个占位（如「收到，马上～」），再用**客服消息**异步把 `reply` 推给用户。

**C（BullMQ 排程）** —— 实现 `SchedulerPort`（`types.ts` 里的契约），然后：

```ts
import { createAgent, buildSchedulingTools } from './agent';

const agent = createAgent();
for (const t of buildSchedulingTools(mySchedulerPort)) agent.registerTool(t);
```

这样「每天早上7点播报北京天气」这类请求就能被 Claude 登记为任务；任务触发时，
worker 可以再调用 `agent.chat()` 生成推送内容，走微信模板/订阅消息发出。

## 扩展工具

实现 `AgentTool`（`name` / `description` / `inputSchema`(JSON Schema) / `run`），
用 `agent.registerTool(tool)` 注册即可，Claude 会自动决定何时调用。
