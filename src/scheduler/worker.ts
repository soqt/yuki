import * as dotenv from 'dotenv';
import { Job, Worker } from 'bullmq';
import { createAgent } from '../agent';
import type { UserProfile } from '../agent/types';
import { bullConnection, QUEUE_NAME, TaskJobData } from './queue';
import { taskStore } from './taskStore';
import { createNotifierFromEnv, Notifier } from './notifier';

dotenv.config();

// Uses the real 模板消息 push when WX_REMINDER_TEMPLATE_ID is configured,
// otherwise falls back to logging (see notifier.ts for why scheduled pushes
// can't use 客服消息).
const notifier: Notifier = createNotifierFromEnv();

async function processTask(job: Job<TaskJobData>): Promise<void> {
  const { openid, message, location, taskId, recurring } = job.data;
  const user: UserProfile = { openid, city: location };

  const { reply } = await createAgent().chat({
    message,
    ctx: { user },
  });

  await notifier.push(openid, reply);

  // One-shot tasks are done after firing once; prune the bookkeeping record
  // so list_reminders doesn't keep showing a "scheduled" task that already
  // ran. Recurring tasks keep their record — the Job Scheduler keeps
  // producing new runs under the same id.
  if (!recurring) {
    try {
      await taskStore.remove(openid, taskId);
    } catch (err) {
      console.error(`[scheduler] failed to prune task ${taskId} for ${openid}:`, err);
    }
  }
}

const worker = new Worker<TaskJobData>(QUEUE_NAME, processTask, { connection: bullConnection });

worker.on('completed', (job) => {
  console.log(`[scheduler] job ${job.id} (${job.name}) completed`);
});

worker.on('failed', (job, err) => {
  console.error(`[scheduler] job ${job?.id} (${job?.name}) failed:`, err);
});

console.log(`[scheduler] worker started, listening on queue "${QUEUE_NAME}"`);

export { worker };
