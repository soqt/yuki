import * as dotenv from 'dotenv';
import moment from 'moment-timezone';
import { parseDayOfWeek } from '../qWeather/days';
import cbw from '../clothing';
import type { Input } from '../clothing';
import WXMessager from '../WXMessager/WXMessager';
import QWeather from '../qWeather/QWeather';
import { MessageTemplateAirCondition } from '../WXMessager/templates';
import Juhe from '../juhe/Juhe';
dotenv.config();


const { APP_ID, APP_SECRET, QWEATHER_KEY, JUHE_KEY, WX_TEMPLATE_ID } = process.env;

if (!APP_ID || !APP_SECRET || !QWEATHER_KEY || !JUHE_KEY) {
  throw new Error('APP_ID or APP_SECRET is not defined');
}

if (!WX_TEMPLATE_ID) {
  throw new Error('WX_TEMPLATE_ID or WX_TO_USER is not defined');
}


const getWeatherInfo = async (location: string) => {
  const qWeather = new QWeather(QWEATHER_KEY);
  const cityCode = await qWeather.getCityCode(location);

  const airCondition = await qWeather.getAirNow(cityCode);
  const weather = await qWeather.getWeatherNow(cityCode);
  const weatherForecastToday = await qWeather.getWeatherForecast(cityCode);
  const airSuggestion = qWeather.getAqiSuggestion();
  const humiditySuggestions = qWeather.getHumiditySuggestion();

  const tempText = `${weatherForecastToday.tempMin}°C~${weatherForecastToday.tempMax}°C，${weatherForecastToday.textDay}。`;

  const input: Input = {
    description: weatherForecastToday.textDay,
    pop: parseFloat(weatherForecastToday.precip),
    temperature: parseInt(weather.temp),
    windGust: parseInt(weather.windScale),
  };
  const clothing = cbw(input);


  return { airCondition, weather, airSuggestion, humiditySuggestions, clothing, tempText };
};

interface ConstellationResponse {
  score: string,
  summary: string
}
const getConstellationInfo = async (consName: string, type: string): Promise<ConstellationResponse> => {
  const juhe = new Juhe(JUHE_KEY);
  const constellation = await juhe.getConstellation(consName, type);

  const score = `天秤座综合指数：${constellation.all}, 爱情指数：${constellation.love}, 财运指数：${constellation.money}, 工作指数：${constellation.work}。`;

  return { score, summary: constellation.summary };
};

const getOotd = (clothing: any): string => {
  const { upperbody, lowerbody, shoes, misc } = clothing;
  const title = '今日份ootd推荐:\n';
  const ootd = `上身：${upperbody}\n下身：${lowerbody}\n鞋子：${shoes}\n配饰：${misc.length > 0 ? misc : '随心'}`;
  return title + ootd;
};

const getDate = (): string => {
  const tz = moment(new Date()).tz('Asia/Shanghai');
  const formatedToday = tz.format('YYYY年MM月DD日');
  const week = tz.day();
  const dateMsg = `${formatedToday} ${parseDayOfWeek(week)}`;
  return dateMsg;
};

const sendGm = async (location: string, openid: string) => {
  const date = getDate();

  try {
    const { airCondition, weather, airSuggestion, humiditySuggestions, clothing, tempText } = await getWeatherInfo(location);
    const { score } = await getConstellationInfo('天秤座', 'today');
    
    const ootd = getOotd(clothing);

    const message: MessageTemplateAirCondition = {
      first: {
        value: `早上好呀Yuki～\n今天是${date}\n你的${location}天气播报来咯~`,
      },
      keyword1: {
        value: tempText,
      },
      keyword2: {
        value: `${weather.humidity}%\n${humiditySuggestions}`,
      },
      keyword3: {
        value: airCondition.pm2p5,
      },
      keyword4: {
        value: `${airCondition.aqi} (${airCondition.category})\n${airSuggestion}`,
      },
      remark: {
        value: `${ootd} \n\n${score}`,
      },
    };

    console.log(message);

    const messager = new WXMessager(APP_ID, APP_SECRET);
    // await messager.getAddressToken();
    messager.prepareMessage(message);
    const templateId = WX_TEMPLATE_ID;
    await messager.send(openid, templateId);
  } catch (err) {
    throw err;
  }
};

export { sendGm };