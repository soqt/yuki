import Redis from 'ioredis';

const { NODE_ENV, STORE_BACKEND } = process.env;

let cached: Redis | null | undefined;

/**
 * Shared, lazily-created ioredis client for the app's stores (user profiles,
 * conversations). Returns `null` when Redis is intentionally disabled
 * (`STORE_BACKEND=memory`), in which case callers fall back to in-memory maps.
 *
 * `enableOfflineQueue: false` makes commands reject fast (instead of hanging)
 * when Redis is unreachable, so the stores can fall back to memory without
 * blocking a web request. Host convention matches ../redis/index.ts.
 */
export function getRedis(): Redis | null {
  if (cached !== undefined) return cached;
  if (STORE_BACKEND === 'memory') {
    cached = null;
    return cached;
  }

  const client = new Redis({
    host: NODE_ENV === 'production' ? 'yuki_redis' : '127.0.0.1',
    port: 6379,
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
  });

  let warned = false;
  client.on('error', (err: Error) => {
    if (!warned) {
      warned = true;
      console.warn('[store] Redis 不可用，已回退到内存存储（重启会丢数据）：', err.message);
    }
  });

  cached = client;
  return cached;
}
