export interface Template1 {
  name: MessageOption
  location: MessageOption,
  temp: MessageOption,
  date: MessageOption;
  aqi: MessageOption;
  suggestion: MessageOption;
  upperBody: MessageOption;
  lowerBody: MessageOption;
  shoes: MessageOption;
  misc: MessageOption;
  constellationScore: MessageOption;
  constellationSummary: MessageOption;
}

interface MessageOption {
  value: string;
  color?: string;
}
