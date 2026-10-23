/** Общая логарифмическая шкала глубины для снасти, камеры и эхолота. */
export const depthToU = (depth: number) => Math.log(1 + depth / 8);
export const uToDepth = (unit: number) => (Math.exp(unit) - 1) * 8;
