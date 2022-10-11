interface QWeatherApiResponse {
  code: string;
  updateTime: string;
  fxLink: string;
}

export interface WeatherNow {
  obsTime: string;
  temp: string;
  feelsLike: string;
  icon: string;
  text: string;
  wind360: string;
  windDir: string;
  windScale: string;
  windSpeed: string;
  humidity: string;
  precip: string;
  pressure: string;
  vis: string;
  cloud: string;
  dew: string;
}

export interface AirNow {
  pubTime: string;
  aqi: string;
  level: string;
  category: string;
  primary: string;
  pm10: string;
  pm2p5: string;
  no2: string;
  so2: string;
  co: string;
  o3: string;
}

export interface WeatherNowResponse extends QWeatherApiResponse {
  now: WeatherNow;
}

export interface AirNowResponse extends QWeatherApiResponse {
  now: AirNow;
}

