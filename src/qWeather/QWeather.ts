import axios from 'axios';
import { AirNowResponse, WeatherNow, WeatherNowResponse, WeatherDailyResponse, WeatherDaily, AirNow } from './types';

const CITY_LOOKUP_URL = 'https://geoapi.qweather.com/v2/city/lookup';
const WEATHER_NOW_URL = 'https://devapi.qweather.com/v7/weather/now';
const WEATHER_FORECAST_URL = 'https://devapi.qweather.com/v7/weather/3d';
const AIR_NOW_URL = 'https://devapi.qweather.com/v7/air/now';

class QWeather {
  apiKey: string;

  aqiCategory?: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey; 
  }

  async getCityCode(city: string) {
    const { data } = await axios({
      method: 'get',
      url: CITY_LOOKUP_URL,
      params: {
        location: city,
        key: this.apiKey,
      },
    });

    if (data.code !== '200' || data.location.length === 0) {
      throw new Error('Cannot find city code');
    }
    return data.location[0].id;
  }

  async getWeatherNow(location: string): Promise<WeatherNow> {
    const { data } = await axios({
      method: 'get',
      url: WEATHER_NOW_URL,
      params: {
        location: location,
        key: this.apiKey,
        lang: 'zh',
      },
    });

    if (data.code !== '200') {
      throw new Error('Cannot get weather');
    }

    return (data as WeatherNowResponse).now;
  }

  async getWeatherForecast(location: string): Promise<WeatherDaily> {
    try {
      const { data } = await axios({
        method: 'get',
        url: WEATHER_FORECAST_URL,
        params: {
          location: location,
          key: this.apiKey,
          lang: 'zh',
        },
      });
      return (data as WeatherDailyResponse).daily[0];
    } catch (err) {
      throw err;
    }
  }

  async getAirNow(location: string): Promise<AirNow> {
    try {
      const { data } = await axios({
        method: 'get',
        url: AIR_NOW_URL,
        params: {
          location: location,
          key: this.apiKey,
          lang: 'zh',
        },
      });
      const airNow = (data as AirNowResponse).now;
      this.aqiCategory = airNow.category;
      return airNow;
    } catch (e) {
      throw e;
    }
  }

  getAqiSuggestion() {
    switch (this.aqiCategory) {
      case '优':
        return '空气质量不错！快出去骑单车吧！';
      case '良':
        return '空气还阔以～可以出门陪小伙伴玩耍～';
      case '轻度污染':
        return '出门记得戴口罩防尘哦～';
      case '中度污染':
        return '要出去玩的话尽量选择室内吧';
      case '重度污染':
        return '不适合外出，尽量呆在家里吧！';
      case '严重污染':
        return '不适合外出，尽量呆在家里吧！';
      default:
        return '空气质量令人满意，基本无空气污染';
    }
  }
}

export default QWeather;