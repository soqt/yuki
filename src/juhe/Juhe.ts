import axios from 'axios';

const CONSTELLATION_URL = 'http://web.juhe.cn/constellation/getAll';

interface ConstellationResponse {
  name: string;
  datetime: string;
  all: string;
  color: string;
  health: string;
  love: string;
  money: string;
  number: string;
  QFriend: string;
  summary: string;
  work: string;
  error_code: number;
}

class Juhe {
  apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getConstellation(consName: string, type: string): Promise<ConstellationResponse> {
    const { data } = await axios({
      method: 'get',
      url: CONSTELLATION_URL,
      params: {
        key: this.apiKey,
        consName: consName,
        type: type,
      },
    });
    return data as ConstellationResponse;
  }
}

export default Juhe;
