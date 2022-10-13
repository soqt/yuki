import * as dotenv from 'dotenv';
import Redis from 'ioredis';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import { parseDayOfWeek } from './src/qWeather/days';
import cbw from './src/clothing';
import type { Input } from './src/clothing';
import WXMessager from './src/WXMessager';
import QWeather from './src/qWeather/QWeather';
// import { Template1 } from './src/templates';
dotenv.config();

const location = '北京';
dayjs.locale('zh-cn');
dayjs.extend(timezone);
dayjs.tz.setDefault('Asia/Shanghai');


const { APP_ID, APP_SECRET, QWEATHER_KEY } = process.env;

if (!APP_ID || !APP_SECRET || !QWEATHER_KEY) {
  throw new Error('APP_ID or APP_SECRET is not defined');
}

const redis = new Redis();

const sleep = async (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const main = async () => {
  const qWeather = new QWeather(QWEATHER_KEY);
  const cityCode = await qWeather.getCityCode(location);

  const airCondition = await qWeather.getAirNow(cityCode);
  await sleep(1000);
  const weather = await qWeather.getWeatherNow(cityCode);
  await sleep(1000);
  const weatherToday = await qWeather.getWeatherForecast(cityCode);
  console.log(weatherToday);

  const input: Input = {
    description: weatherToday.textDay,
    pop: parseFloat(weatherToday.precip),
    temperature: parseInt(weather.temp),
    windGust: parseInt(weather.windScale),
  };

  const clothing = cbw(input);
  console.log(clothing);





  const message: any = {
    date: {
      value: dayjs().format('YYYY年MM月DD') + ' ' + parseDayOfWeek(dayjs().day()),
    },
    aqi: {
      value: `${airCondition.aqi} (${airCondition.category})`,
    },
    suggestion: {
      value: '天气真的好好呀',
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
    // temp: `今天${location}的温度是${weather.temp}°C，空气质量为 ${airCondition.aqi} (${airCondition.category})，可以穿${clothing.upperbody}`,
  };

  const messager = new WXMessager(APP_ID, APP_SECRET, redis);
  await messager.getAddressToken();

  messager.prepareMessage(message);
  const templateId = '_AVY61tbN-lpmV00QCk5PHXFPO0yVZrCAaZ96crZG0k';
  const toUser = 'oCcIy58YxtyBZE1POm9awZ7tnrX4';
  await messager.send(toUser, templateId);
};

main().then(() => {
  console.log('Done');
  redis.disconnect();
}).catch((err) => {throw err;});