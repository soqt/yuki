import Juhe from '../../juhe/Juhe';
import type { AgentTool, AgentContext } from '../types';

interface HoroscopeArgs {
  constellation?: string;
  type?: string;
}

/** Wraps the Juhe constellation API into a tool. */
export function buildHoroscopeTool(): AgentTool<HoroscopeArgs> {
  return {
    name: 'get_horoscope',
    description:
      '查询星座运势（综合/爱情/财运/工作指数以及运势总结）。用户未指定星座时使用其默认星座。',
    inputSchema: {
      type: 'object',
      properties: {
        constellation: {
          type: 'string',
          description: '星座名，例如“天秤座”。留空则使用用户默认星座。',
        },
        type: {
          type: 'string',
          enum: ['today', 'tomorrow', 'week', 'month', 'year'],
          description: '运势周期，默认 today。',
        },
      },
    },
    run: async (args: HoroscopeArgs, ctx: AgentContext): Promise<string> => {
      const key = process.env.JUHE_KEY;
      if (!key) throw new Error('JUHE_KEY 未配置');

      const constellation = args.constellation || ctx.user.constellation;
      if (!constellation) throw new Error('没有可用的星座，请让用户提供星座名');

      const type = args.type || 'today';
      const juhe = new Juhe(key);
      const c = await juhe.getConstellation(constellation, type);
      if (c.error_code) throw new Error(`星座接口错误 code=${c.error_code}`);

      return [
        `星座：${constellation}（${type}）`,
        `综合指数：${c.all}，爱情：${c.love}，财运：${c.money}，工作：${c.work}`,
        `健康：${c.health}，幸运色：${c.color}，幸运数字：${c.number}，速配：${c.QFriend}`,
        `运势总结：${c.summary}`,
      ].join('\n');
    },
  };
}
