import axios from 'axios';
import Redis from 'ioredis';

const WX_ACCESS_TOKEN_URL = 'https://api.weixin.qq.com/cgi-bin/token';
const WX_SEND_MESSAGE_URL = 'https://api.weixin.qq.com/cgi-bin/message/template/send?';

class WXMessager {
  appId: string;
 
  appSecret: string;

  accessToken?: string;

  data?: object;

  storage: Redis;


  constructor(appId: string, appSecret: string, storage: Redis) {
    this.appId = appId;
    this.appSecret = appSecret;
    this.storage = storage;
  }

  async getAddressToken(): Promise<string> {
    try {
      let accessToken = await this.storage.get('wx_access_token');
      if (!accessToken) {
        const { data } = await axios({
          method: 'get',
          url: WX_ACCESS_TOKEN_URL,
          params: {
            grant_type: 'client_credential',
            appid: this.appId,
            secret: this.appSecret,
          },
        });

        if (data.errcode) {
          throw new Error(data.errmsg);
        }
        const { access_token: newAccessToken, expires_in: expiresIn } = data;
        this.storage.set('wx_access_token', newAccessToken, 'EX', expiresIn);
        accessToken = newAccessToken;
      }
      this.accessToken = accessToken!;
      return accessToken!;
    } catch (err) {
      throw err;
    }
  }

  prepareMessage(message: any) {
    const data = {
      date: {
        value: message.date,
      },
      temp: {
        value: message.temp,
      },
    };
    this.data = data;
  }

  async send(toUser: string, templateId: string) {
    try {
      await this.getAddressToken();
      const url = `${WX_SEND_MESSAGE_URL}?access_token=${this.accessToken}`;
      console.log(url);

      const { data } = await axios({
        method: 'POST',
        url: url,
        data: {
          access_token: this.accessToken,
          touser: toUser,
          template_id: templateId,
          data: this.data,
        },
      });

      if (data.errcode) {
        throw new Error(data.errmsg);
      }
      console.log(data);
    } catch (err) {
      throw err;
    }

  }
}

export default WXMessager;