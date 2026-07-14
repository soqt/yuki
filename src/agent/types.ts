// Core domain types for the agent. Kept free of any LLM-SDK dependency so that
// tool authors and the scheduling backend (module C) can implement against a
// stable contract.

/** Who the agent is talking to / acting for. Populated from a user profile store. */
export interface UserProfile {
  /** WeChat openid — the stable per-user identifier. */
  openid: string;
  /** How the assistant addresses the user, e.g. "Yuki". */
  nickname?: string;
  /** Default city used when a request doesn't name one. */
  city?: string;
  /** Default constellation, e.g. "天秤座". */
  constellation?: string;
  /** IANA timezone, defaults to Asia/Shanghai. */
  timezone?: string;
}

/** Everything a tool needs at call time beyond its own arguments. */
export interface AgentContext {
  user: UserProfile;
  /** Overridable "now" for testing; defaults to new Date() in the agent. */
  now?: Date;
}

/**
 * A tool the agent can call. `inputSchema` is a JSON Schema object describing
 * the arguments; `run` receives the validated arguments plus the context.
 * The returned string is fed back to the model as the tool result.
 */
export interface AgentTool<I = any> {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  run: (input: I, ctx: AgentContext) => Promise<string>;
}

// --- Scheduling seam --------------------------------------------------------
// Module C (BullMQ) implements SchedulerPort. Module A only defines the
// contract and the agent-facing tools that call it (see tools/scheduling.ts),
// so the LLM surface for "remind me / do X every day" is owned here while the
// queue + persistence live in C.

export interface ReminderInput {
  openid: string;
  /** What to remind about / the task description. */
  message: string;
  /** One-shot: ISO-8601 datetime. Recurring: a cron expression. */
  when: string;
  recurring?: boolean;
  /** Optional city, for weather-type tasks. */
  location?: string;
}

export interface ReminderRecord {
  id: string;
  message: string;
  when: string;
  recurring: boolean;
  status: string;
}

export interface SchedulerPort {
  create(input: ReminderInput): Promise<ReminderRecord>;
  list(openid: string): Promise<ReminderRecord[]>;
  cancel(openid: string, id: string): Promise<boolean>;
}
