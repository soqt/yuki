import { XMLParser } from 'fast-xml-parser';

/**
 * 一条解析后的微信入站消息。字段命名沿用微信官方文档的驼峰化版本，
 * 覆盖文本 / 语音 / 事件这几种模块 B 需要处理的类型（其余类型原样透出）。
 */
export interface WxInboundMessage {
  /** 公众号自己的 openid（原始 XML 里的 ToUserName）。 */
  toUserName: string;
  /** 发消息用户的 openid（原始 XML 里的 FromUserName）。 */
  fromUserName: string;
  createTime: number;
  /** text | voice | image | event | ... */
  msgType: string;
  msgId?: string;
  /** 文本消息内容。 */
  content?: string;
  /** 语音 / 图片等媒体消息的 MediaId。 */
  mediaId?: string;
  /** 语音消息在开启「语音识别」后微信给出的识别文本。 */
  recognition?: string;
  format?: string;
  /** 事件类型：subscribe / unsubscribe / CLICK / VIEW / ... */
  event?: string;
  eventKey?: string;
}

const parser = new XMLParser({
  // 全部当字符串处理，避免 MsgId 这类大整数被当成 number 解析丢精度，
  // 也避免 Content 里恰好是纯数字时被意外转换。
  parseTagValue: false,
  trimValues: true,
});

function str(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  return String(v);
}

/** 把微信推送过来的 XML body 解析成结构化对象。 */
export function parseInboundXml(xml: string): WxInboundMessage {
  const parsed = parser.parse(xml) as { xml?: Record<string, unknown> };
  const node = parsed?.xml ?? {};

  return {
    toUserName: str(node.ToUserName) ?? '',
    fromUserName: str(node.FromUserName) ?? '',
    createTime: Number(node.CreateTime) || 0,
    msgType: str(node.MsgType) ?? '',
    msgId: str(node.MsgId),
    content: str(node.Content),
    mediaId: str(node.MediaId),
    recognition: str(node.Recognition),
    format: str(node.Format),
    event: str(node.Event),
    eventKey: str(node.EventKey),
  };
}

/** CDATA 里不能直接出现 "]]>"，出现时拆开转义，防止破坏 XML 结构。 */
function cdata(value: string): string {
  return value.replace(/]]>/g, ']]]]><![CDATA[>');
}

/**
 * 构造被动回复（文本）XML。
 *
 * 注意方向是反的：回复的 ToUserName = 入站消息的 FromUserName（发给谁），
 * 回复的 FromUserName = 入站消息的 ToUserName（公众号自己）。
 */
export function buildPassiveTextReply(
  inbound: Pick<WxInboundMessage, 'toUserName' | 'fromUserName'>,
  content: string,
): string {
  const toUserName = inbound.fromUserName;
  const fromUserName = inbound.toUserName;
  const createTime = Math.floor(Date.now() / 1000);

  return `<xml>
<ToUserName><![CDATA[${cdata(toUserName)}]]></ToUserName>
<FromUserName><![CDATA[${cdata(fromUserName)}]]></FromUserName>
<CreateTime>${createTime}</CreateTime>
<MsgType><![CDATA[text]]></MsgType>
<Content><![CDATA[${cdata(content)}]]></Content>
</xml>`;
}
