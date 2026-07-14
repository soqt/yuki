import Anthropic from '@anthropic-ai/sdk';
import moment from 'moment-timezone';
import type { AgentContext, AgentTool } from './types';

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8';
// Hard cap on model<->tool round-trips per turn (incl. web-search continuations),
// so a misbehaving loop can't run forever.
const MAX_TOOL_TURNS = 12;

// Anthropic server-side web search. Requires a capable model
// (Opus 4.6+/Sonnet 4.6+); the default claude-opus-4-8 qualifies.
const WEB_SEARCH_TOOL: Anthropic.ToolUnion = {
  type: 'web_search_20260209',
  name: 'web_search',
};

export interface AgentOptions {
  model?: string;
  maxTokens?: number;
  tools?: AgentTool[];
  /** Enable Anthropic's server-side web search tool. */
  webSearch?: boolean;
  /** Additional raw server-side tool defs (executed by Anthropic, not us). */
  serverTools?: Anthropic.ToolUnion[];
  /** Inject a pre-configured client (tests, alternate credentials). */
  client?: Anthropic;
  /** Extra text appended to the system prompt (e.g. app-specific rules). */
  systemPreamble?: string;
}

export interface ChatParams {
  message: string;
  /** Prior turns, for multi-turn conversations. Pass back what chat() returns. */
  history?: Anthropic.MessageParam[];
  ctx: AgentContext;
}

export interface ChatResult {
  reply: string;
  /** Full message history including this turn — persist and pass back next time. */
  history: Anthropic.MessageParam[];
}

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

/**
 * The agent core: a Claude tool-use loop. Owns the model, the system prompt,
 * and a registry of tools. `chat()` runs one conversational turn to completion
 * (executing tools as needed) and returns the reply plus updated history.
 *
 * Integration points for the rest of the system:
 *  - Module B (WeChat inbound) calls `chat()` per inbound message, persisting
 *    `history` per user for multi-turn context.
 *  - Module C (scheduler) registers scheduling tools via `registerTool()`, and
 *    can also call `chat()` from a job to generate a scheduled push.
 */
export class Agent {
  private client: Anthropic;
  private model: string;
  private maxTokens: number;
  private tools = new Map<string, AgentTool>();
  private serverTools: Anthropic.ToolUnion[];
  private systemPreamble: string;

  constructor(opts: AgentOptions = {}) {
    // A bare `new Anthropic()` resolves ANTHROPIC_API_KEY (or an ant-auth
    // profile) from the environment.
    this.client = opts.client ?? new Anthropic();
    this.model = opts.model ?? DEFAULT_MODEL;
    this.maxTokens = opts.maxTokens ?? 8192;
    this.systemPreamble = opts.systemPreamble ?? '';
    this.serverTools = [...(opts.serverTools ?? [])];
    if (opts.webSearch) this.serverTools.push(WEB_SEARCH_TOOL);
    for (const t of opts.tools ?? []) this.registerTool(t);
  }

  registerTool(tool: AgentTool): this {
    this.tools.set(tool.name, tool);
    return this;
  }

  listTools(): string[] {
    return [...this.tools.keys()];
  }

  async chat({ message, history = [], ctx }: ChatParams): Promise<ChatResult> {
    const messages: Anthropic.MessageParam[] = [
      ...history,
      { role: 'user', content: message },
    ];
    const system = this.buildSystem(ctx);
    const tools = this.toolDefs();

    for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
      const res = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        thinking: { type: 'adaptive' },
        system,
        tools,
        messages,
      });

      // Preserve the full assistant content (incl. thinking blocks) so the next
      // request in the loop stays valid.
      messages.push({ role: 'assistant', content: res.content });

      // A server-side tool (e.g. web_search) hit its internal loop limit —
      // re-send as-is and the server resumes; do NOT add a user turn.
      if (res.stop_reason === 'pause_turn') {
        continue;
      }

      // Client tools requested — execute them and feed results back.
      if (res.stop_reason === 'tool_use') {
        const toolResults = await this.runToolCalls(res.content, ctx);
        messages.push({ role: 'user', content: toolResults });
        continue;
      }

      // end_turn / max_tokens / refusal / ... — done.
      return { reply: extractText(res.content), history: messages };
    }

    return {
      reply: '（这条消息处理得有点久，麻烦再说一次或换个说法～）',
      history: messages,
    };
  }

  private toolDefs(): Anthropic.ToolUnion[] {
    const clientDefs: Anthropic.ToolUnion[] = [...this.tools.values()].map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema as unknown as Anthropic.Tool.InputSchema,
    }));
    return [...clientDefs, ...this.serverTools];
  }

  private async runToolCalls(
    content: Anthropic.ContentBlock[],
    ctx: AgentContext,
  ): Promise<Anthropic.ToolResultBlockParam[]> {
    const calls = content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );
    // Run requested tools concurrently; return all results in one user turn.
    return Promise.all(
      calls.map(async (call): Promise<Anthropic.ToolResultBlockParam> => {
        const tool = this.tools.get(call.name);
        if (!tool) {
          return {
            type: 'tool_result',
            tool_use_id: call.id,
            content: `未知工具：${call.name}`,
            is_error: true,
          };
        }
        try {
          const out = await tool.run(call.input, ctx);
          return { type: 'tool_result', tool_use_id: call.id, content: out };
        } catch (err) {
          return {
            type: 'tool_result',
            tool_use_id: call.id,
            content: `工具执行失败：${(err as Error).message}`,
            is_error: true,
          };
        }
      }),
    );
  }

  private buildSystem(ctx: AgentContext): string {
    const tz = ctx.user.timezone || 'Asia/Shanghai';
    const now = moment(ctx.now ?? new Date()).tz(tz);
    const dateStr = `${now.format('YYYY-MM-DD HH:mm')} ${WEEKDAYS[now.day()]}`;

    const u = ctx.user;
    const profile = [
      u.nickname ? `- 昵称：${u.nickname}` : '',
      u.city ? `- 默认城市：${u.city}` : '',
      u.constellation ? `- 星座：${u.constellation}` : '',
      `- 时区：${tz}`,
    ]
      .filter(Boolean)
      .join('\n');

    return [
      '你是 Yuki 的私人 AI 助理，通过微信与主人对话。',
      '你温暖、简洁、贴心，用中文回复；因为是在微信里，回复尽量精炼，别长篇大论。',
      `当前时间：${dateStr}。`,
      '主人的资料：',
      profile,
      '',
      '工作方式：',
      '- 需要实时信息（天气、空气、星座、提醒等）时调用相应工具，不要凭空编造。',
      '- 用户没有明确指定城市 / 星座时，使用上面资料里的默认值。',
      '- 涉及“提醒 / 定时 / 每天 / 待办”这类请求时，如果有排程工具就用它登记任务。',
      this.systemPreamble,
    ]
      .filter(Boolean)
      .join('\n');
  }
}

function extractText(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
}
