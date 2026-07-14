import axios from 'axios';

const WX_CUSTOM_SEND_URL = 'https://api.weixin.qq.com/cgi-bin/message/custom/send';

/**
 * 通过「客服消息」接口给用户异步推送一条文本消息。
 *
 * 和 WXMessager 一样遵循「用微信云时不需要 access_token」的约定：部署在微信云托管
 * (CloudRun) 上时，对 api.weixin.qq.com 的调用是免鉴权的。如果哪天脱离云托管环境
 * 部署，需要恢复下面注释的 access_token 拼接逻辑（参考 WXMessager.getAccessToken）。
 *
 * 客服消息只能在用户与公众号产生互动后的 48 小时窗口内发送——这正是模块 B 用它来
 * 异步下发 agent 回复的前提：用户刚发消息触发了这次调用，窗口必然是打开的。
 */
export async function sendCustomServiceText(openid: string, content: string): Promise<void> {
  try {
    // await messager.getAccessToken(); 用微信云时不需要
    // const url = `${WX_CUSTOM_SEND_URL}?access_token=${accessToken}`;

    const { data } = await axios({
      method: 'POST',
      url: WX_CUSTOM_SEND_URL,
      data: {
        // access_token: accessToken, 用微信云时不需要
        touser: openid,
        msgtype: 'text',
        text: { content },
      },
    });

    if (data.errcode) {
      throw new Error(`[${data.errcode}] ${data.errmsg}`);
    }
  } catch (err) {
    throw err;
  }
}
