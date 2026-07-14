import WXMessager from '../WXMessager/WXMessager';

/**
 * Where a scheduled/fired task's rendered text goes. Kept as a small
 * interface so the worker can run with zero WeChat config out of the box
 * (`ConsoleNotifier`) and a real push channel can be swapped in later.
 */
export interface Notifier {
  push(openid: string, text: string): Promise<void>;
}

/**
 * Default notifier — just logs. Lets `worker.ts` run standalone with no
 * WeChat credentials configured, e.g. for local development or before the
 * WeChat template is set up.
 */
export class ConsoleNotifier implements Notifier {
  async push(openid: string, text: string): Promise<void> {
    console.log(`[scheduler] push -> ${openid}:\n${text}`);
  }
}

/**
 * Delivers a scheduled task's text as a 公众号模板消息 (template message).
 *
 * IMPORTANT — scheduled/proactive pushes MUST go out as 模板消息 / 订阅消息,
 * NOT 客服消息. 客服消息 only works within the 48-hour window after the user
 * last messaged the account; a timer-fired task (e.g. "每天早上7点播报天气")
 * usually runs outside that window, so 客服消息 would silently fail.
 *
 * The message is sent via `WXMessager.send()` (which posts to
 * `cgi-bin/message/template/send`, auth-free under 微信云托管 — same
 * convention as the rest of the project). The template's data is built as a
 * single free-text field so arbitrary agent-generated text fits.
 *
 * ⚠️ Requires WeChat-backend setup (product, not code):
 *  - Create/approve a template whose body is a single free-text field, e.g.
 *    `{{content.DATA}}`. Do NOT reuse `WX_TEMPLATE_ID` from src/gm/service.ts —
 *    that one is shaped for the fixed keyword1..4 weather template.
 *  - Put the new template id in `WX_REMINDER_TEMPLATE_ID`, and (if the field
 *    isn't named `content`) its field name in `WX_REMINDER_TEMPLATE_FIELD`.
 */
export class TemplateMessageNotifier implements Notifier {
  private messager: WXMessager;

  private templateId: string;

  private field: string;

  constructor(appId: string, appSecret: string, templateId: string, field = 'content') {
    this.messager = new WXMessager(appId, appSecret);
    this.templateId = templateId;
    this.field = field;
  }

  async push(openid: string, text: string): Promise<void> {
    // Template-message data shape: { <field>: { value, color? } }. Assumes a
    // single free-text field (see class docs). Adjust if your template has more.
    this.messager.prepareMessage({ [this.field]: { value: text } });
    await this.messager.send(openid, this.templateId);
  }
}

/**
 * Picks a notifier from env: a real `TemplateMessageNotifier` when a reminder
 * template is configured (`WX_REMINDER_TEMPLATE_ID` + `APP_ID`/`APP_SECRET`),
 * otherwise `ConsoleNotifier` so the worker still runs with zero config.
 */
export function createNotifierFromEnv(): Notifier {
  const { APP_ID, APP_SECRET, WX_REMINDER_TEMPLATE_ID, WX_REMINDER_TEMPLATE_FIELD } = process.env;
  if (APP_ID && APP_SECRET && WX_REMINDER_TEMPLATE_ID) {
    return new TemplateMessageNotifier(
      APP_ID,
      APP_SECRET,
      WX_REMINDER_TEMPLATE_ID,
      WX_REMINDER_TEMPLATE_FIELD || 'content',
    );
  }
  return new ConsoleNotifier();
}
