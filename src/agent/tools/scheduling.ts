import type { AgentTool, SchedulerPort } from '../types';

interface CreateArgs {
  message: string;
  when: string;
  recurring?: boolean;
  location?: string;
}
interface CancelArgs {
  id: string;
}

/**
 * Agent-facing scheduling tools. These define the LLM surface for
 * "remind me / do X every day"; the actual queue + persistence is provided by
 * module C via a SchedulerPort implementation, wired in at agent construction:
 *
 *   const agent = createAgent();
 *   for (const t of buildSchedulingTools(mySchedulerPort)) agent.registerTool(t);
 */
export function buildSchedulingTools(scheduler: SchedulerPort): AgentTool[] {
  const create: AgentTool<CreateArgs> = {
    name: 'create_reminder',
    description:
      '为用户登记一个提醒或定时任务。一次性任务给出具体时间，循环任务给出 cron 表达式。' +
      '例如“明天9点提醒我开会”或“每天早上7点播报北京天气”。',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: '提醒内容或任务描述' },
        when: {
          type: 'string',
          description:
            '一次性任务用 ISO-8601 时间（如 2026-07-13T09:00:00+08:00）；循环任务用 cron 表达式（如 0 7 * * *）。',
        },
        recurring: {
          type: 'boolean',
          description: '是否为循环任务；when 为 cron 表达式时应为 true。',
        },
        location: { type: 'string', description: '如果任务与天气相关，可带上城市名。' },
      },
      required: ['message', 'when'],
    },
    run: async (args, ctx): Promise<string> => {
      const rec = await scheduler.create({
        openid: ctx.user.openid,
        message: args.message,
        when: args.when,
        recurring: !!args.recurring,
        location: args.location,
      });
      return `已登记任务 #${rec.id}：${rec.message}（${rec.recurring ? '循环' : '一次性'} ${rec.when}）`;
    },
  };

  const list: AgentTool = {
    name: 'list_reminders',
    description: '列出用户当前所有的提醒 / 定时任务。',
    inputSchema: { type: 'object', properties: {} },
    run: async (_args, ctx): Promise<string> => {
      const records = await scheduler.list(ctx.user.openid);
      if (!records.length) return '当前没有已登记的提醒或定时任务。';
      return records
        .map((r) => `#${r.id} ${r.message}（${r.recurring ? '循环' : '一次性'} ${r.when}，${r.status}）`)
        .join('\n');
    },
  };

  const cancel: AgentTool<CancelArgs> = {
    name: 'cancel_reminder',
    description: '取消一个已登记的提醒 / 定时任务，需要任务 id。',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: '任务 id' } },
      required: ['id'],
    },
    run: async (args, ctx): Promise<string> => {
      const ok = await scheduler.cancel(ctx.user.openid, args.id);
      return ok ? `已取消任务 #${args.id}。` : `没有找到任务 #${args.id}。`;
    },
  };

  return [create, list, cancel];
}
