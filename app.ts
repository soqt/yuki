import * as dotenv from 'dotenv';
import Redis from 'ioredis';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import { parseDayOfWeek } from './src/qWeather/days';
import cbw from './src/clothing';
import type { Input } from './src/clothing';
import WXMessager from './src/WXMessager';
import QWeather from './src/qWeather/QWeather';
import { Template1 } from './src/templates';
import Juhe from './src/juhe/Juhe';
dotenv.config();

dayjs.locale('zh-cn');
dayjs.extend(timezone);
dayjs.tz.setDefault('Asia/Shanghai');


const { APP_ID, APP_SECRET, QWEATHER_KEY, JUHE_KEY } = process.env;

if (!APP_ID || !APP_SECRET || !QWEATHER_KEY || !JUHE_KEY) {
  throw new Error('APP_ID or APP_SECRET is not defined');
}

const redis = new Redis();

const getWeatherInfo = async (location: string) => {
  const qWeather = new QWeather(QWEATHER_KEY);
  const cityCode = await qWeather.getCityCode(location);

  const airCondition = await qWeather.getAirNow(cityCode);
  const weather = await qWeather.getWeatherNow(cityCode);
  const weatherForecastToday = await qWeather.getWeatherForecast(cityCode);
  const airSuggestion = qWeather.getAqiSuggestion();

  const tempText = `温度：${weatherForecastToday.tempMin}°C~${weatherForecastToday.tempMax}°C，${weatherForecastToday.textDay}。`;

  const input: Input = {
    description: weatherForecastToday.textDay,
    pop: parseFloat(weatherForecastToday.precip),
    temperature: parseInt(weather.temp),
    windGust: parseInt(weather.windScale),
  };
  const clothing = cbw(input);



  return { airCondition, airSuggestion, clothing, tempText };
};

interface ConstellationResponse {
  score: string,
  summary: string
}
const getConstellationInfo = async (consName: string, type: string): Promise<ConstellationResponse> => {
  const juhe = new Juhe(JUHE_KEY);
  const today = await juhe.getConstellation(consName, type);

  const score = `天秤座今日综合指数：${today.all}, 爱情指数：${today.love}, 财运指数：${today.money}, 工作指数：${today.work}。`;

  return { score, summary: today.summary };
};

const main = async () => {
  const location = '北京';
  const { airCondition, airSuggestion, clothing, tempText } = await getWeatherInfo(location);
  const { score, summary } = await getConstellationInfo('天秤座', 'today');

  const message: Template1 = {
    name: {
      value: 'Yuki',
    },
    location: {
      value: location,
    },
    date: {
      value: dayjs().format('YYYY年MM月DD') + ' ' + parseDayOfWeek(dayjs().day()),
    },
    temp: {
      value: tempText,
    },
    aqi: {
      value: `${airCondition.aqi} (${airCondition.category}) ${tempText}`,
    },
    suggestion: {
      value: airSuggestion,
    },
    upperBody: {
      value: clothing.upperbody.toString(),
    },
    lowerBody: {
      value: clothing.lowerbody,
    },
    shoes: {
      value: clothing.shoes,
    },
    misc: {
      value: clothing.misc.toString() == '' ? '无' : clothing.misc.toString(),
    },
    constellationScore: {
      value: score,
    },
    constellationSummary: {
      value: summary,
    },
    // temp: `今天${location}的温度是${weather.temp}°C，空气质量为 ${airCondition.aqi} (${airCondition.category})，可以穿${clothing.upperbody}`,
  };

  const messager = new WXMessager(APP_ID, APP_SECRET, redis);
  await messager.getAddressToken();

  messager.prepareMessage(message);
  const templateId = 'QZJiGoJdONU9kuI425WVZTZu1jnaILYY_uscF5gO8cE';
  const toUser = 'oCcIy58YxtyBZE1POm9awZ7tnrX4';
  await messager.send(toUser, templateId);
};

main().then(() => {
  console.log('Done');
  redis.disconnect();
}).catch((err) => {throw err;});