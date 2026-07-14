import express, { Request, Response } from 'express';
import { verifySignature } from '../wechat/signature';
import { parseInboundXml } from '../wechat/xml';
import { handleInboundMessage } from '../wechat/handler';

const router = express.Router();

function asString(v: unknown): string | undefined {
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
  return undefined;
}

function verifyRequestSignature(req: Request): boolean {
  const signature = asString(req.query.signature);
  const timestamp = asString(req.query.timestamp);
  const nonce = asString(req.query.nonce);
  if (!signature || !timestamp || !nonce) return false;
  return verifySignature({ signature, timestamp, nonce });
}

// 服务器配置校验：公众号后台填写 URL 后微信会发一个 GET 来验证。
// GET /wechat?signature=&timestamp=&nonce=&echostr=
router.get('/', (req: Request, res: Response) => {
  if (!verifyRequestSignature(req)) {
    res.status(401).send('signature verification failed');
    return;
  }
  res.type('text/plain').send(asString(req.query.echostr) ?? '');
});

// 消息回调。微信推送 Content-Type: text/xml 的 body，这里用一个只挂在本路由上的
// text 解析器把 req.body 变成原始 XML 字符串——app.ts 里全局的 express.json() 只认
// application/json，不会消费这个请求体，两者不冲突。
router.post(
  '/',
  express.text({ type: () => true }),
  async (req: Request, res: Response) => {
    if (!verifyRequestSignature(req)) {
      res.status(401).send('signature verification failed');
      return;
    }

    try {
      const inbound = parseInboundXml(req.body as string);
      const replyBody = await handleInboundMessage(inbound);
      if (replyBody.trimStart().startsWith('<xml>')) {
        res.type('application/xml').send(replyBody);
      } else {
        res.type('text/plain').send(replyBody);
      }
    } catch (err) {
      console.error('[wechat] 处理入站消息失败', err);
      // 即使处理出错也回 success，避免微信因为收不到合法响应而反复重试同一条消息。
      res.type('text/plain').send('success');
    }
  },
);

export default router;
