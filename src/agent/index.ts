import { Agent, AgentOptions } from './Agent';
import { buildCoreTools } from './tools';

/**
 * Create an agent pre-loaded with the core tools (weather, horoscope). Pass
 * extra `tools` to add more (e.g. scheduling tools from module C).
 */
export function createAgent(opts: AgentOptions = {}): Agent {
  const agent = new Agent({
    model: opts.model,
    maxTokens: opts.maxTokens,
    client: opts.client,
    systemPreamble: opts.systemPreamble,
    webSearch: opts.webSearch,
    serverTools: opts.serverTools,
  });
  for (const t of buildCoreTools()) agent.registerTool(t);
  for (const t of opts.tools ?? []) agent.registerTool(t);
  return agent;
}

export { Agent } from './Agent';
export type { AgentOptions, ChatParams, ChatResult } from './Agent';
export * from './types';
export {
  buildCoreTools,
  buildWeatherTool,
  buildHoroscopeTool,
  buildSchedulingTools,
} from './tools';
