import type { SpotFeature } from './types';

export interface HabitatCue {
  title: string;
  hint: string;
  mark: string;
}

/** Short, practical field notes: each region is a habitat, not just another depth marker. */
export const HABITAT_CUES: Record<SpotFeature, HabitatCue> = {
  pier: { title: 'Тень свай', hint: 'Проверьте кромку укрытия у опор', mark: '▥' },
  sandbar: { title: 'Песчаная отмель', hint: 'Работайте по границе мелководья', mark: '≈' },
  ridge: { title: 'Каменная гряда', hint: 'Сместите заброс вдоль камней', mark: '⌁' },
  arch: { title: 'Каменная арка', hint: 'Ищите рыбу у склона и прохода', mark: '⌒' },
  current: { title: 'Приливный сулой', hint: 'Течение собирает корм и стаи', mark: '≫' },
  wall: { title: 'Подводная стена', hint: 'Сравните верх свала и глубину', mark: '▱' },
  waterfall: { title: 'Речной вынос', hint: 'Ищите границу пресной и солёной воды', mark: '≋' },
  icebay: { title: 'Ледяная бухта', hint: 'Проверьте тихую воду у кромки льда', mark: '◇' },
  deep: { title: 'Горловина фьорда', hint: 'Начните со склона, не только со дна', mark: '⌄' },
  lagoon: { title: 'Тёплая лагуна', hint: 'Мелководье и коралловые укрытия', mark: '◉' },
  reefwall: { title: 'Край рифа', hint: 'Переход от полки к синей воде', mark: '▱' },
  wreck: { title: 'Затонувший галеон', hint: 'Укрытия вокруг корпуса и обломков', mark: '⚓' },
  sargassum: { title: 'Саргассово поле', hint: 'Плавающие водоросли укрывают малька', mark: '⌇' },
  seamount: { title: 'Подводная гора', hint: 'Обловите вершину и бровку', mark: '△' },
  blue: { title: 'Синяя вода', hint: 'Пелагический горизонт меняется с глубиной', mark: '◌' },
  twilight: { title: 'Сумеречная зона', hint: 'Переход света: пробуйте разные слои', mark: '◐' },
  vents: { title: 'Чёрные курильщики', hint: 'Тёплые источники собирают необычную жизнь', mark: '♨' },
  trench: { title: 'Жёлоб', hint: 'Глубокий уступ — не только максимальная глубина', mark: '⌄' },
  reeds: { title: 'Кромка камыша', hint: 'Тихая полоса у корней и травы', mark: '╱' },
  channel: { title: 'Фарватер', hint: 'Течение идёт вдоль глубокого канала', mark: '≫' },
  stilts: { title: 'Рыбачьи мостки', hint: 'Обловите тень под настилом', mark: '▥' },
  sound: { title: 'Межостровный пролив', hint: 'Стая проходит по струе между островами', mark: '≫' },
  cottage: { title: 'Островной берег', hint: 'Проверьте растительность и каменную кромку', mark: '⌂' },
  trough: { title: 'Ледниковая ложбина', hint: 'Рельефная борозда держит разные горизонты', mark: '⌄' },
  kelpforest: { title: 'Ламинариевый лес', hint: 'Рыба прячется между стволами ламинарии', mark: '╱' },
  otters: { title: 'Бухта каланов', hint: 'Спокойная мелкая вода у водорослей', mark: '◡' },
  canyon: { title: 'Подводный каньон', hint: 'Начните с верхней кромки обрыва', mark: '⌄' },
  roots: { title: 'Корни мангров', hint: 'Ищите окна между корневыми укрытиями', mark: '╱' },
  flats: { title: 'Солёные отмели', hint: 'Кромка мели меняет кормовую зону', mark: '≈' },
  creek: { title: 'Мангровый ручей', hint: 'Проверьте поворот протоки и струю', mark: '≫' },
  blacksand: { title: 'Чёрный песок', hint: 'Тёплая мелкая полка у лавы', mark: '≈' },
  lava: { title: 'Лавовый склон', hint: 'Обловите уступы на разных глубинах', mark: '⌁' },
  caldera: { title: 'Край кальдеры', hint: 'Сильный рельеф: вершина и внешний склон', mark: '△' },
  iceedge: { title: 'Кромка пакового льда', hint: 'Рыба держится на границе льда и воды', mark: '◇' },
  icebergs: { title: 'Айсберговое поле', hint: 'Подводные тени вокруг дрейфующих льдин', mark: '◇' },
  polynya: { title: 'Полынья', hint: 'Открытое окно среди льда и течений', mark: '◉' },
};

export function habitatActivityText(count: number, depth: number) {
  const n = Math.max(0, Math.floor(Number.isFinite(count) ? count : 0));
  const d = Math.max(0, Math.round(Number.isFinite(depth) ? depth : 0));
  if (n === 0) return `На ${d} м сейчас тихо — попробуйте соседний слой или ориентир`;
  const lastTwo = n % 100;
  const last = n % 10;
  const fishWord = last === 1 && lastTwo !== 11 ? 'вид' : last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14) ? 'вида' : 'видов';
  return `На ${d} м в этой зоне сейчас активны ${n} ${fishWord}`;
}
