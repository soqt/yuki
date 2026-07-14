import type { UserProfile } from '../agent';
import { getRedis } from './redisClient';

// Redis-backed user profiles (key `yuki:profile:{openid}`), with an in-memory
// fallback so the assistant still works if Redis is down or disabled
// (STORE_BACKEND=memory) — just without persistence.
const key = (openid: string) => `yuki:profile:${openid}`;
const mem = new Map<string, UserProfile>();

function defaultProfile(openid: string): UserProfile {
  return {
    openid,
    city: '北京',
    constellation: '天秤座',
    timezone: 'Asia/Shanghai',
  };
}

/** 取用户资料；不存在时创建一份带默认值的资料并持久化。 */
export async function getOrCreate(openid: string): Promise<UserProfile> {
  const redis = getRedis();
  if (redis) {
    try {
      const raw = await redis.get(key(openid));
      if (raw) return JSON.parse(raw) as UserProfile;
      const created = defaultProfile(openid);
      await redis.set(key(openid), JSON.stringify(created));
      return created;
    } catch {
      // fall back to memory below
    }
  }
  let profile = mem.get(openid);
  if (!profile) {
    profile = defaultProfile(openid);
    mem.set(openid, profile);
  }
  return profile;
}

/** 局部更新用户资料（例如以后加了「设置城市」这类意图）。 */
export async function update(openid: string, patch: Partial<UserProfile>): Promise<UserProfile> {
  const merged: UserProfile = { ...(await getOrCreate(openid)), ...patch, openid };
  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(key(openid), JSON.stringify(merged));
      return merged;
    } catch {
      // fall back to memory below
    }
  }
  mem.set(openid, merged);
  return merged;
}
