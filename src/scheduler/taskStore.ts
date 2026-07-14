import type { ReminderRecord } from '../agent/types';
import { connection } from './queue';

const keyFor = (openid: string): string => `yuki:tasks:${openid}`;

/**
 * Redis-hash index of a user's scheduled tasks: `yuki:tasks:{openid}` is a
 * hash of `id -> JSON(ReminderRecord)`.
 *
 * BullMQ has no first-class "all jobs belonging to user X" query (jobs and
 * job schedulers are addressed by id, not by an arbitrary owner field), so
 * this index is the source of truth for `list()` / `cancel()` lookups by
 * openid; BullMQ itself remains the source of truth for actually firing jobs.
 */
export class TaskStore {
  async save(openid: string, record: ReminderRecord): Promise<void> {
    await connection.hset(keyFor(openid), record.id, JSON.stringify(record));
  }

  async get(openid: string, id: string): Promise<ReminderRecord | undefined> {
    const raw = await connection.hget(keyFor(openid), id);
    return raw ? (JSON.parse(raw) as ReminderRecord) : undefined;
  }

  async list(openid: string): Promise<ReminderRecord[]> {
    const fields = await connection.hgetall(keyFor(openid));
    return Object.values(fields).map((raw) => JSON.parse(raw) as ReminderRecord);
  }

  async remove(openid: string, id: string): Promise<boolean> {
    const removed = await connection.hdel(keyFor(openid), id);
    return removed > 0;
  }
}

export const taskStore = new TaskStore();
