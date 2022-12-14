import axios from 'axios';
import { AirNowResponse, WeatherNow, WeatherNowResponse, WeatherDailyResponse, WeatherDaily, AirNow } from './types';

const CITY_LOOKUP_URL = 'https://geoapi.qweather.com/v2/city/lookup';
const WEATHER_NOW_URL = 'https://devapi.qweather.com/v7/weather/now';
const WEATHER_FORECAST_URL = 'https://devapi.qweather.com/v7/weather/3d';
const AIR_NOW_URL = 'https://devapi.qweather.com/v7/air/now';

class QWeather {
  apiKey: string;

  aqiCategory?: string;

  humidity?: number;

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

    const weatherNow = (data as WeatherNowResponse).now;
    this.humidity = parseInt(weatherNow.humidity);

    return weatherNow;
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
      case '???':
        return '?????????????????????????????????????????????';
      case '???':
        return '???????????????????????????????????????????????????';
      case '????????????':
        return '?????????????????????????????????';
      case '????????????':
        return '???????????????????????????????????????';
      case '????????????':
        return '??????????????????????????????????????????';
      case '????????????':
        return '??????????????????????????????????????????';
      default:
        return '????????????????????????????????????????????????';
    }
  }

  getHumiditySuggestion() {
    if (!this.humidity) {
      return '';
    }
    if (this.humidity < 30) {
      return '????????????????????????????????????';
    } else if (this.humidity > 70) {
      return '??????????????????????????????';
    } else {
      return '??????????????????????????????????????????';
    }
  }
}

export default QWeather;