import { buildWeatherTool } from './weather';
import { buildHoroscopeTool } from './horoscope';
import type { AgentTool } from '../types';

/** The always-on tools, wrapping the existing QWeather / Juhe / clothing code. */
export function buildCoreTools(): AgentTool[] {
  return [buildWeatherTool(), buildHoroscopeTool()];
}

export { buildWeatherTool } from './weather';
export { buildHoroscopeTool } from './horoscope';
export { buildSchedulingTools } from './scheduling';
