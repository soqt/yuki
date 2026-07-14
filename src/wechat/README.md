# 微信入站消息通道（模块 B）

把公众号收到的用户消息接进模块 A 的 agent，再把回复送回去。

## 文件

| 文件 | 作用 |
|---|---|
| `signature.ts` | 校验微信请求签名（`sha1([token, timestamp, nonce].sort().join(''))`） |
| `xml.ts` | 入站 XML 解析成 `WxInboundMessage`；构造被动回复 XML |
| `customerService.ts` | 调「客服消息」接口异步推送文本给用户 |
| `handler.ts` | 编排：收到消息 → 立即回被动占位 → 异步跑 `agent.chat()` → 客服消息推真实回复 |
| `../routes/wechat.ts` | Express 路由，挂在 `/wechat`：GET 验证 URL，POST 收消息 |
| `../store/userProfiles.ts` | `openid -> UserProfile` 内存表（默认北京/天秤座/Asia-Shanghai） |
| `../store/conversations.ts` | `openid -> Anthropic.MessageParam[]` 内存表，供多轮对话 |

## 配置

1. `.env` 里设置 `WX_TOKEN=`（公众号后台「设置与开发 → 基本配置 → 服务器配置」里自己定义的 Token，两边必须一致）。
2. 公众号后台「服务器配置」填：
   - URL：`https://<你的域名或云托管地址>/wechat`
   - Token：同上面的 `WX_TOKEN`
   - 消息加解密方式：明文模式（本实现没有做加解密，选安全模式会导致签名校验之外还需要解密 body，目前未支持）
3. 保存时微信会发一个 `GET /wechat?signature=&timestamp=&nonce=&echostr=`，签名校验通过后原样回传 `echostr` 即完成验证。

## 5 秒被动回复 + 客服消息异步推送

这是微信公众号消息机制里最容易踩坑的地方：

- 微信服务器等待 `POST /wechat` 的**被动回复**最多约 5 秒，超时会判定失败/重试；且**一次请求只能返回一条被动消息**。
- `agent.chat()` 要跑 Claude 推理 + 可能的工具调用，普遍会超过 5 秒。

所以 `handler.ts` 对 `text` / `voice` 消息的处理是：

1. 同步、立刻返回一条占位被动回复（如「收到，让我想想～」）——这条走 HTTP 响应体本身，免费、不占配额。
2. **不等待**地在后台触发 `agent.chat()`；等它跑完，用「客服消息」接口（`POST https://api.weixin.qq.com/cgi-bin/message/custom/send`）把真正的回复异步推给用户。

客服消息依赖 **48 小时窗口**：用户与公众号有过互动（比如刚发了这条消息）后的 48 小时内，公众号可以任意时间点用客服消息接口主动发消息给他。因为异步推送发生在“用户刚消息触发的这次请求”之后不久，窗口必然是打开的。

`event=subscribe`（关注）会走一条同步的被动欢迎语，不涉及 agent，不需要异步逻辑。其余消息/事件类型目前直接回 `success`（微信约定：空或 `success` 表示不回复）。

## 鉴权约定：微信云托管免 access_token

和 `src/WXMessager/WXMessager.ts` 的约定一致：本项目部署在微信云托管（CloudRun）上，从云托管环境调用 `api.weixin.qq.com` 是**免鉴权**的，不需要拼 `access_token`。`customerService.ts` 里保留了注释掉的 `access_token=` 路径，供以后脱离云托管部署时参考 `WXMessager.getAccessToken` 的做法恢复。

## 已知限制 / TODO

- `store/userProfiles.ts`、`store/conversations.ts` 都是**进程内存 Map**：重启即丢，多实例部署也不共享。两个文件里都标了 `// TODO: persist to Redis`，工程里已经有 `src/redis`，接入时把 Map 换成对应的读写即可。
- 尚未支持加解密模式（安全模式/兼容模式），只支持明文模式。
- 排程 / 提醒类工具还没接上——`handler.ts` 里 `createAgent()` 调用旁边留了注释，等模块 C（`src/scheduler`）就绪后按注释接入 `buildSchedulingTools`。
