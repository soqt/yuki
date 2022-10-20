function umbrella(pop: number, description: string) {
  if (description.includes('雪')) {
    return;
  }

  if (pop > 0 && pop < 10.0) {
    return '有可能需要雨伞🌂';
  }

  if (pop > 10) {
    return '雨伞☔️';
  }
  return;
}

function windBreaker(windGust: number) {
  if (windGust > 7) {
    return '防风衣🌬';
  }
  return;
}

function rainJacket(temperature: number, pop: number, description: string) {
  const getUmbrella = umbrella(pop, description);
  if (getUmbrella && temperature > 10) {
    return '雨衣🌧';
  }
  return;
}

function jackets(temperature: number) {
  if (temperature >= 15 && temperature < 18) {
    return '薄夹克';
  }
  if (temperature <= 15 && temperature > 5) {
    return '暖和的夹克🧥';
  }
  if (temperature <= 5) {
    return '外套🧥';
  }
  return;
}

function baselayer(temperature: number) {
  if (temperature <= 15) {
    return '毛衣';
  }
  return;
}

function upperbody(temperature: number, windGust: number, pop: number, description: string) {
  const upper = [
    windBreaker(windGust),
    rainJacket(temperature, pop, description),
    jackets(temperature),
    baselayer(temperature),
  ].filter(p => typeof p !== 'undefined');

  return upper.length ? upper : ['衬衫👚'];
}

function lowerbody(temperature: number, windGust: number) {
  if (temperature > 20) {
    if (windGust > 8) {
      return '长裤👖';
    }
    return '短裤🩳';
  } else {
    return '长裤👖';
  }
}

function misc(description: string, temperature: number, pop: number): string[] {
  const obj = [];
  if (temperature < 10) {
    obj.push(
      '手套🧤',
      '帽子🧢',
      '围巾🧣',
    );
    if (temperature < -10) {
      obj.push('暖和的袜子🧦');
    }
  }
  const getUmbrella = umbrella(pop, description);
  if (getUmbrella) {
    obj.push(getUmbrella);
  }
  const keywords = ['晴', '太阳', 'sunny'];
  const containsSunnyKeywords = keywords.some(keyword => keyword.includes(description));
  if (containsSunnyKeywords) {
    obj.push('墨镜🕶️');
  }
  return obj;
}

function shoes(temperature: number, pop: number, description: string) {
  if (temperature > 10) {
    if (umbrella(pop, description)) {
      return '雨靴⛸';
    }
    return '运动鞋👟';
  }
  return '靴子👢';
}

export interface Input {
  description: string;
  temperature: number;
  windGust: number;
  pop: number;
}
function clothesByWeather(input: Input) {
  const { description, temperature, windGust, pop } = input;
  // Assumes all metrics units are celsius, m/s
  let des = description.toLowerCase();
  return {
    'upperbody': upperbody(temperature, windGust, pop, description),
    'lowerbody': lowerbody(temperature, windGust),
    'shoes': shoes(temperature, pop, description),
    'misc': misc(des, temperature, pop),
  };
}

export default clothesByWeather;