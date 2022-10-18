import * as dotenv from 'dotenv';
import Redis from 'ioredis';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import { parseDayOfWeek } from './src/qWeather/days';
import cbw from './src/clothing';
import type { Input } from './src/clothing';
import WXMessager from './src/WXMessager';
import QWeather from './src/qWeather/QWeather';
import { MessageTemplateAirCondition } from './src/templates';
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

  const tempText = `${weatherForecastToday.tempMin}°C~${weatherForecastToday.tempMax}°C，${weatherForecastToday.textDay}。`;

  const input: Input = {
    description: weatherForecastToday.textDay,
    pop: parseFloat(weatherForecastToday.precip),
    temperature: parseInt(weather.temp),
    windGust: parseInt(weather.windScale),
  };
  const clothing = cbw(input);


  return { airCondition, weather, airSuggestion, clothing, tempText };
};

interface ConstellationResponse {
  score: string,
  summary: string
}
const getConstellationInfo = async (consName: string, type: string): Promise<ConstellationResponse> => {
  const juhe = new Juhe(JUHE_KEY);
  const today = await juhe.getConstellation(consName, type);

  const score = `天秤座综合指数：${today.all}, 爱情指数：${today.love}, 财运指数：${today.money}, 工作指数：${today.work}。`;

  return { score, summary: today.summary };
};

const getOotd = (clothing: any): string => {
  const { upperbody, lowerbody, shoes, misc } = clothing;
  const title = '今日份ootd推荐:\n';
  const ootd = `上身：${upperbody}\n下身：${lowerbody}\n鞋子：${shoes}\n配饰：${misc || '随心'}`;
  return title + ootd;
};

const main = async () => {
  const location = '北京';
  const { airCondition, weather, airSuggestion, clothing, tempText } = await getWeatherInfo(location);
  const { score, summary } = await getConstellationInfo('天秤座', 'today');
  console.log(score, summary);

  const ootd = getOotd(clothing);

  const dateMsg = dayjs().format('YYYY年MM月DD') + ' ' + parseDayOfWeek(dayjs().day());

  const message: MessageTemplateAirCondition = {
    first: {
      value: `早上好呀 Yuki～\n今天是${dateMsg}\n你的${location}天气播报来咯~`,
    },
    keyword1: {
      value: tempText,
    },
    keyword2: {
      value: weather.humidity,
    },
    keyword3: {
      value: airCondition.pm2p5,
    },
    keyword4: {
      value: `${airCondition.aqi} (${airCondition.category})\n${airSuggestion}`,
    },
    remark: {
      value: `\n${ootd} \n\n${score}`,
    },
    // upperBody: {
    //   value: clothing.upperbody.toString(),
    // },
    // lowerBody: {
    //   value: clothing.lowerbody,
    // },
    // shoes: {
    //   value: clothing.shoes,
    // },
    // misc: {
    //   value: clothing.misc.toString() == '' ? '无' : clothing.misc.toString(),
    // },
    // constellationScore: {
    //   value: score,
    // },
    // constellationSummary: {
    //   value: summary,
    // },
    // temp: `今天${location}的温度是${weather.temp}°C，空气质量为 ${airCondition.aqi} (${airCondition.category})，可以穿${clothing.upperbody}`,
  };

  const messager = new WXMessager(APP_ID, APP_SECRET, redis);
  await messager.getAddressToken();

  messager.prepareMessage(message);
  const templateId = 'PtcfMU9fncCsOQODjxvVCbcRjSHoT9uoEhsQ4lHnZgA';
  const toUser = 'oxiA26q-oCvF4j149xR2ruQsTGKc';
  await messager.send(toUser, templateId);
};

main().then(() => {
  console.log('Done');
  redis.disconnect();
}).catch((err) => {throw err;});