import axios from 'axios';

const WX_ACCESS_TOKEN_URL = 'https://api.weixin.qq.com/cgi-bin/token';
const WX_SEND_MESSAGE_URL = 'https://api.weixin.qq.com/cgi-bin/message/template/send';


class WXMessager {
  appId: string;
 
  appSecret: string;

  accessToken?: string;

  data?: object;

  storage?: any;

  constructor(appId: string, appSecret: string) {
    this.appId = appId;
    this.appSecret = appSecret;
  }

  // 获取微信Access Token并维护
  // 用微信云时不需要
  async getAccessToken(): Promise<string> {
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
        if (this.storage) {
          this.storage.set('wx_access_token', newAccessToken, 'EX', expiresIn);
        }
        accessToken = newAccessToken;
      }
      this.accessToken = accessToken!;
      return accessToken!;
    } catch (err) {
      throw err;
    }
  }

  prepareMessage(message: any) {
    this.data = message;
  }

  async send(toUser: string, templateId: string): Promise<string> {
    try {
      // await this.getAccessToken(); 用微信云时不需要
      // const url = `${WX_SEND_MESSAGE_URL}?access_token=${this.accessToken}`;

      const { data } = await axios({
        method: 'POST',
        url: WX_SEND_MESSAGE_URL,
        data: {
          // access_token: this.accessToken, 用微信云时不需要
          touser: toUser,
          template_id: templateId,
          data: this.data,
        },
      });

      if (data.errcode) {
        throw new Error(data.errmsg);
      }
      return data.msgid;
    } catch (err) {
      throw err;
    }
  }
}

export default WXMessager;