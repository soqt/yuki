import { createAgent, buildSchedulingTools } from '../agent';
import type { WxInboundMessage } from './xml';
import { buildPassiveTextReply } from './xml';
import { sendCustomServiceText } from './customerService';
import { getOrCreate } from '../store/userProfiles';
import { getHistory, setHistory } from '../store/conversations';

// 进程内单例：微信云托管场景下通常是单实例部署，一个 agent 够用。
// 开启网页搜索，需要最新信息时助理会自己去搜。
const agent = createAgent({ webSearch: true });

// 模块 C（BullMQ 排程）接线：设 ENABLE_SCHEDULER=true 时，把「提醒 / 定时任务」工具
// 注册进 agent，用户就能说“每天早上7点播报北京天气”“明天9点提醒我开会”。
// 用惰性 require，只有真正启用时才加载 ../scheduler、打开 Redis 连接——不启用时 web
// 进程完全不依赖 Redis（与 app.ts 里默认注释掉 connectToRedis 的现状保持一致）。
if (process.env.ENABLE_SCHEDULER === 'true') {
  const { createScheduler } = require('../scheduler') as typeof import('../scheduler');
  for (const t of buildSchedulingTools(createScheduler())) agent.registerTool(t);
  console.log('[wechat] 排程工具已启用（create_reminder / list_reminders / cancel_reminder）');
}

const QUICK_REPLY = '收到，让我想想～';
const WELCOME_REPLY = '你好呀，我是 Yuki 的私人助理～ 有什么可以帮你的？';

/**
 * 处理一条已解析的微信入站消息，返回应当立即写回 HTTP 响应体的内容——
 * 要么是一段被动回复 XML，要么是纯文本 "success"（微信约定：空/success 表示不回复）。
 *
 * ⚠️ 关键约束：微信服务器等待被动回复最多约 5 秒，且一次请求只能返回一条被动消息。
 * Claude 的推理 + 工具调用普遍超过这个时间，所以这里绝不会在这条路径上等 agent.chat()
 * 返回。text / voice 消息会立刻给一个占位被动回复，真正的答案通过「客服消息」接口
 * 异步推送——这依赖用户刚刚发消息打开的 48 小时客服消息窗口，参见 customerService.ts。
 */
export async function handleInboundMessage(msg: WxInboundMessage): Promise<string> {
  switch (msg.msgType) {
    case 'text':
    case 'voice': {
      const userText = msg.msgType === 'voice' ? (msg.recognition ?? '') : (msg.content ?? '');
      dispatchAgentReplyAsync(msg.fromUserName, userText);
      return buildPassiveTextReply(msg, QUICK_REPLY);
    }
    case 'event': {
      if (msg.event === 'subscribe') {
        return buildPassiveTextReply(msg, WELCOME_REPLY);
      }
      // unsubscribe / CLICK / VIEW / ... 暂不特殊处理。
      return 'success';
    }
    default:
      // image / video / location / link / ... 暂不支持，静默 ack。
      return 'success';
  }
}

/** 触发异步 agent 回复，不阻塞（也不等待）调用方——调用方要在 5 秒内把 HTTP 响应发出去。 */
function dispatchAgentReplyAsync(openid: string, message: string): void {
  if (!message.trim()) return;
  runAgentAndReply(openid, message).catch((err) => {
    console.error('[wechat] agent 异步回复失败', err);
  });
}

async function runAgentAndReply(openid: string, message: string): Promise<void> {
  const user = await getOrCreate(openid);
  const history = await getHistory(openid);

  const { reply, history: nextHistory } = await agent.chat({
    message,
    history,
    ctx: { user },
  });

  await setHistory(openid, nextHistory);
  await sendCustomServiceText(openid, reply);
}
