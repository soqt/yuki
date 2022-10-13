import axios from 'axios';
import { AirNowResponse, WeatherNow, WeatherNowResponse, WeatherDailyResponse, WeatherDaily, AirNow } from './types';

const CITY_LOOKUP_URL = 'https://geoapi.qweather.com/v2/city/lookup';
const WEATHER_NOW_URL = 'https://devapi.qweather.com/v7/weather/now';
const WEATHER_FORECAST_URL = 'https://devapi.qweather.com/v7/weather/3d';
const AIR_NOW_URL = 'https://devapi.qweather.com/v7/air/now';

class QWeather {
  apiKey: string;

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
      const res = await axios({
        method: 'get',
        url: AIR_NOW_URL,
        params: {
          location: location,
          key: this.apiKey,
          lang: 'zh',
        },
      });
      return (res.data as AirNowResponse).now;
    } catch (e) {
      throw e;
    }
  }
}

export default QWeather;