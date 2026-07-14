import * as crypto from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config();

export interface WxSignatureQuery {
  signature: string;
  timestamp: string;
  nonce: string;
}

/**
 * 校验微信服务器发来的请求签名。
 *
 * 算法：sha1([token, timestamp, nonce].sort().join('')) === signature
 * token 就是公众号后台「服务器配置」里填写的 Token，通过 WX_TOKEN 环境变量注入。
 */
export function verifySignature({ signature, timestamp, nonce }: WxSignatureQuery): boolean {
  const token = process.env.WX_TOKEN;
  if (!token) {
    console.warn('[wechat] WX_TOKEN 未配置，签名校验无法通过');
    return false;
  }
  if (!signature || !timestamp || !nonce) return false;

  const hash = crypto
    .createHash('sha1')
    .update([token, timestamp, nonce].sort().join(''))
    .digest('hex');

  return hash === signature;
}
