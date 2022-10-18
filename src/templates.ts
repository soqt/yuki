export interface MessageTemplateAirCondition {
  first: MessageOption
  keyword1: MessageOption,
  keyword2: MessageOption,
  keyword3: MessageOption;
  keyword4: MessageOption;
  remark: MessageOption;

}

interface MessageOption {
  value: string;
  color?: string;
}
