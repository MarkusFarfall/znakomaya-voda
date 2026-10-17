export const fmt = (value: number) => Math.round(value).toLocaleString("ru-RU");
export const fmtW = (weight: number) => weight < 1 ? `${Math.round(weight * 1000)} г` : `${weight.toFixed(weight < 10 ? 2 : 1)} кг`;
