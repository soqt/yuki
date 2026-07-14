import { randomUUID } from 'crypto';
import type { ReminderInput, ReminderRecord, SchedulerPort } from '../agent/types';
import { taskQueue, TASK_JOB_NAME, TaskJobData } from './queue';
import { taskStore } from './taskStore';

/** Used for cron evaluation when registering a recurring job scheduler.
 *  ReminderInput carries no timezone field, so this mirrors the agent's own
 *  default (see Agent.ts: `ctx.user.timezone || 'Asia/Shanghai'`). */
const DEFAULT_TZ = 'Asia/Shanghai';

/**
 * BullMQ-backed implementation of `SchedulerPort` (the contract module A
 * defines in `src/agent/types.ts`).
 *
 * - Recurring tasks (`input.recurring === true`) treat `input.when` as a cron
 *   expression and are registered via BullMQ v5's Job Scheduler API
 *   (`queue.upsertJobScheduler`), which owns re-creating the next delayed job
 *   on every tick — no manual re-scheduling needed.
 * - One-shot tasks treat `input.when` as an ISO-8601 datetime and become a
 *   single delayed job (`queue.add(..., { delay })`), keyed by the same id
 *   used as the BullMQ jobId.
 *
 * Per-user `list()` / `cancel()` are backed by `taskStore` (a Redis hash),
 * since BullMQ addresses jobs/schedulers by id, not by an arbitrary "owner".
 */
export class BullSchedulerPort implements SchedulerPort {
  async create(input: ReminderInput): Promise<ReminderRecord> {
    const id = randomUUID();
    const recurring = !!input.recurring;

    const data: TaskJobData = {
      openid: input.openid,
      message: input.message,
      location: input.location,
      taskId: id,
      recurring,
    };

    if (recurring) {
      // input.when is a cron expression, e.g. "0 7 * * *".
      await taskQueue.upsertJobScheduler(
        id,
        { pattern: input.when, tz: DEFAULT_TZ },
        { name: TASK_JOB_NAME, data },
      );
    } else {
      // input.when is an ISO-8601 datetime.
      const when = new Date(input.when);
      if (Number.isNaN(when.getTime())) {
        throw new Error(`无法识别的时间：${input.when}`);
      }
      const delay = when.getTime() - Date.now();
      if (delay <= 0) {
        // Reject rather than clamp: a "reminder" scheduled in the past is
        // almost certainly a misunderstood request (bad timezone, wrong
        // date), and silently firing it immediately would surprise the user.
        throw new Error('提醒时间必须晚于当前时间');
      }
      await taskQueue.add(TASK_JOB_NAME, data, { delay, jobId: id });
    }

    const record: ReminderRecord = {
      id,
      message: input.message,
      when: input.when,
      recurring,
      status: 'scheduled',
    };
    await taskStore.save(input.openid, record);
    return record;
  }

  async list(openid: string): Promise<ReminderRecord[]> {
    return taskStore.list(openid);
  }

  async cancel(openid: string, id: string): Promise<boolean> {
    const record = await taskStore.get(openid, id);
    if (!record) return false;

    if (record.recurring) {
      await taskQueue.removeJobScheduler(id);
    } else {
      await taskQueue.remove(id);
    }
    return taskStore.remove(openid, id);
  }
}
