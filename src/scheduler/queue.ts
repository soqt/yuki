import * as dotenv from 'dotenv';
import { ConnectionOptions, Queue } from 'bullmq';
import Redis from 'ioredis';

dotenv.config();

const { NODE_ENV } = process.env;

/** Name of the single BullMQ queue used for all scheduled/recurring tasks. */
export const QUEUE_NAME = 'yuki-tasks';

/** Job name used for every task pushed onto the queue (one-shot or recurring). */
export const TASK_JOB_NAME = 'run-task';

/**
 * Payload stored on every BullMQ job. Produced by `BullSchedulerPort.create()`,
 * consumed by `worker.ts`.
 */
export interface TaskJobData {
  openid: string;
  /** What to remind about / the task description, fed back into the agent. */
  message: string;
  /** Optional city, for weather-type tasks. */
  location?: string;
  /** The `taskStore` record id this job belongs to (== the ReminderRecord id). */
  taskId: string;
  /** Mirrors ReminderRecord.recurring, so the worker knows whether to prune
   *  the taskStore record after this job fires (one-shot) or leave it (recurring,
   *  since the Job Scheduler keeps producing new runs). */
  recurring: boolean;
}

/**
 * Shared ioredis connection for BullMQ. Follows the same host convention as
 * ../redis/index.ts (`yuki_redis` inside the docker-compose network in
 * production, `127.0.0.1` in development), but is its own connection: BullMQ
 * requires `maxRetriesPerRequest: null` on any connection handed to a
 * Queue/Worker, which is not set on the app's general-purpose redis client.
 */
export const connection = new Redis({
  host: NODE_ENV === 'production' ? 'yuki_redis' : '127.0.0.1',
  port: 6379,
  maxRetriesPerRequest: null,
});

// The project resolves two copies of ioredis (the direct dependency here,
// and the one bundled under bullmq's own pnpm subtree), so structurally
// identical `Redis` instances end up as nominally distinct types from
// TypeScript's point of view. This cast is safe: at runtime it's the same
// ioredis client either way, this only works around the duplicate-package
// type identity mismatch.
export const bullConnection = connection as unknown as ConnectionOptions;

/** The BullMQ queue backing SchedulerPort. Typed so `.add()` / job scheduler
 *  templates require a well-formed TaskJobData. */
export const taskQueue = new Queue<TaskJobData>(QUEUE_NAME, { connection: bullConnection });
