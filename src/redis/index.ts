import Redis from 'ioredis';

const { NODE_ENV } = process.env;

if (!NODE_ENV) {
  throw new Error('NODE_ENV is not defined');
}

let redis: Redis;

const connectToRedis = () => {
  redis = new Redis({
    host: NODE_ENV === 'production' ? 'yuki_redis' : '127.0.0.1',
    port: 6379,
  });
};

export { redis, connectToRedis };