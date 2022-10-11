import * as dotenv from 'dotenv';
import Redis from 'ioredis';
import WXMessager from './src/WXMessager';
import QWeather from './src/qWeather/QWeather';
dotenv.config();

const { APP_ID, APP_SECRET, QWEATHER_KEY } = process.env;

if (!APP_ID || !APP_SECRET || !QWEATHER_KEY) {
  throw new Error('APP_ID or APP_SECRET is not defined');
}

const redis = new Redis();

const main = async () => {
  const templateId = 't79J1uxf5lUi_dGVeVOQFzx4lOy2S_0YCI8-umxDblY';
  const toUser = 'oCcIy58YxtyBZE1POm9awZ7tnrX4';

  const qWeather = new QWeather(QWEATHER_KEY);

  const cityCode = await qWeather.getCityCode('北京');

  const airCondition = await qWeather.getAirNow(cityCode);

  const weather = await qWeather.getWeatherNow(cityCode);
  console.log(weather, airCondition);

  const message = {
    date: '2020-01-01',
    temp: 'Hello, World!',
  };

  const messager = new WXMessager(APP_ID, APP_SECRET, redis);
  await messager.getAddressToken();

  messager.prepareMessage(message);
  const res = await messager.send(toUser, templateId);
  console.log(res);
};

main();