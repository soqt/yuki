import QWeather from '../../qWeather/QWeather';
import clothesByWeather, { Input } from '../../clothing';
import type { AgentTool, AgentContext } from '../types';

interface WeatherArgs {
  location?: string;
}

function formatClothing(c: ReturnType<typeof clothesByWeather>): string {
  const upper = Array.isArray(c.upperbody) ? c.upperbody.join('、') : c.upperbody;
  const misc = c.misc.length ? c.misc.join('、') : '随心';
  return `上身：${upper}；下身：${c.lowerbody}；鞋子：${c.shoes}；配饰：${misc}`;
}

/**
 * Wraps the existing QWeather + clothing modules into a single tool: the model
 * asks for a city, gets back weather + air + a clothing recommendation.
 */
export function buildWeatherTool(): AgentTool<WeatherArgs> {
  return {
    name: 'get_weather',
    description:
      '查询某城市的实时天气、气温、空气质量、湿度，并给出穿衣建议。用户未指定城市时会使用其默认城市。',
    inputSchema: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: '城市名，例如“北京”“上海”。留空则使用用户默认城市。',
        },
      },
    },
    run: async (args: WeatherArgs, ctx: AgentContext): Promise<string> => {
      const key = process.env.QWEATHER_KEY;
      if (!key) throw new Error('QWEATHER_KEY 未配置');

      const location = args.location || ctx.user.city;
      if (!location) throw new Error('没有可用的城市，请让用户提供城市名');

      const qw = new QWeather(key);
      const cityCode = await qw.getCityCode(location);
      // Order matters: getAirNow / getWeatherNow set state that the suggestion
      // helpers read afterwards.
      const air = await qw.getAirNow(cityCode);
      const now = await qw.getWeatherNow(cityCode);
      const forecast = await qw.getWeatherForecast(cityCode);
      const aqiSuggestion = qw.getAqiSuggestion();
      const humiditySuggestion = qw.getHumiditySuggestion();

      const input: Input = {
        description: forecast.textDay,
        pop: parseFloat(forecast.precip),
        temperature: parseInt(now.temp, 10),
        windGust: parseInt(now.windScale, 10),
      };
      const clothing = clothesByWeather(input);

      return [
        `城市：${location}`,
        `今日：${forecast.tempMin}°C ~ ${forecast.tempMax}°C，${forecast.textDay}`,
        `实时：${now.temp}°C，${now.text}，风力 ${now.windScale} 级`,
        `湿度：${now.humidity}%（${humiditySuggestion}）`,
        `空气：AQI ${air.aqi}（${air.category}），PM2.5 ${air.pm2p5}（${aqiSuggestion}）`,
        `穿衣建议：${formatClothing(clothing)}`,
      ].join('\n');
    },
  };
}
