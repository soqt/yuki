import type Anthropic from '@anthropic-ai/sdk';
import { getRedis } from './redisClient';

// Redis-backed conversation history (key `yuki:conv:{openid}`, JSON), with an
// in-memory fallback when Redis is down or disabled (STORE_BACKEND=memory).
const MAX_HISTORY = 20;
const key = (openid: string) => `yuki:conv:${openid}`;
const mem = new Map<string, Anthropic.MessageParam[]>();

/** 取某个用户上一轮结束时的历史，供下一轮 agent.chat() 传入。 */
export async function getHistory(openid: string): Promise<Anthropic.MessageParam[]> {
  const redis = getRedis();
  if (redis) {
    try {
      const raw = await redis.get(key(openid));
      return raw ? (JSON.parse(raw) as Anthropic.MessageParam[]) : [];
    } catch {
      // fall back to memory below
    }
  }
  return mem.get(openid) ?? [];
}

/** 保存 agent.chat() 返回的最新历史，裁剪到最近 MAX_HISTORY 条，避免无限增长。 */
export async function setHistory(openid: string, history: Anthropic.MessageParam[]): Promise<void> {
  const trimmed = history.slice(-MAX_HISTORY);
  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(key(openid), JSON.stringify(trimmed));
      return;
    } catch {
      // fall back to memory below
    }
  }
  mem.set(openid, trimmed);
}
