import type { SchedulerPort } from '../agent/types';
import { BullSchedulerPort } from './BullSchedulerPort';

/**
 * Factory for the `SchedulerPort` implementation, meant to be wired straight
 * into the agent (see src/agent/README.md's "给模块 C" section):
 *
 *   import { createAgent, buildSchedulingTools } from '../agent';
 *   import { createScheduler } from '../scheduler';
 *
 *   const agent = createAgent();
 *   for (const t of buildSchedulingTools(createScheduler())) agent.registerTool(t);
 */
export function createScheduler(): SchedulerPort {
  return new BullSchedulerPort();
}

export { BullSchedulerPort } from './BullSchedulerPort';
export { taskQueue, connection, QUEUE_NAME, TASK_JOB_NAME } from './queue';
export type { TaskJobData } from './queue';
export { taskStore, TaskStore } from './taskStore';
export { ConsoleNotifier, TemplateMessageNotifier, createNotifierFromEnv } from './notifier';
export type { Notifier } from './notifier';
