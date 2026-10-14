import type { Building, HotId, Season, WeatherId } from '../types';

/**
 * Минимум атмосферы, который нужен китам портов.
 * В игре собирается адаптером из `e.atmosphere.state` (палитра там — RGB-кортежи, здесь — #rrggbb; см. INTEGRATION.md).
 */
export interface KitAtmo {
  sunElev: number; sunAz: number; sunVis: number;
  night: number; golden: number;
  cover: number; fog: number; rain: number; snow: number; ice: number;
  wind: number; windDir: number; waves: number;
  starVis: number; aurora: number;
  moonElev: number; moonAz: number; moonPhase: number; moonVis: number; moonIllum: number;
  weather: WeatherId; season: Season; day: number;
  /** игровой час 0..24 — распорядок дня, часы работы, башенные часы */
  hour?: number;
  palette: { skyTop: string; skyMid: string; skyHor: string; glow: string; sun: string; cloud: string; seaNear: string; deep: string; fog: string };
}

/** Кадр порта — всё, что нужно киту для рисования. Создаётся PortScene раз в кадр. */
export interface PF {
  ctx: CanvasRenderingContext2D;
  W: number;
  H: number;
  t: number;
  /** Integrated wind direction: particles must not use time * changing direction. */
  windTravel: number;
  dt: number;
  sc: number;
  /** горизонт */
  hY: number;
  /** верх набережной (плоскость, где стоят здания) */
  quayY: number;
  /** уровень воды */
  waterY: number;
  /** y поверхности воды в точке x с учётом волны */
  waveY: (x: number) => number;
  /** земля под ногами: quayY - 6*sc */
  gY: number;
  A: KitAtmo;
  night: number;
  golden: number;
  lit: boolean;
  reflecting: boolean;
  /** ярмарочный день (в игре — выходные по реальному календарю) */
  fair: boolean;
  /** сколько народу на улице 0..1 (ночь, ливень, сиеста → меньше) */
  activity: number;
  /** мокрая набережная 0..1 */
  wet: number;
  /** тень от солнца на земле: сторона и длина в px */
  shadow: { dir: 1 | -1; len: number; a: number };
  /** прогресс активных событий распорядка: id → 0..1 */
  ev: Record<string, number>;
  /** «рыба дня» с рынка (названия) — для досок и вывесок */
  hotFish: string[];
  /** true, пока рисуется закрытое в этот час здание: окна тёмные, без света */
  closed: boolean;
  open: (b: Building) => boolean;
  /** качка на воде с учётом волны: смещение по y в px */
  bob: (seed: number, amp?: number) => number;
  /** затемнение ночью */
  dim: (c: string, k?: number) => string;
  /** цвет окна (с мерцанием ночью; тёмный, если здание закрыто) */
  win: (seed?: number, warm?: string) => string;
  glow: (x: number, y: number, r: number, color: string, a?: number) => void;
  pool: (x: number, y: number, r: number, color: string, a: number) => void;
  smoke: (x: number, y: number, r?: number, dark?: boolean) => void;
  spark: (x: number, y: number) => void;
  /** детерминированный шум по индексу */
  h: (i: number) => number;
  /** Visual randomness is isolated from fishing and weather events. */
  random: () => number;
  quality: 0 | 1 | 2;
  precipEnabled: boolean;
  hover: HotId | null;
}

export type TrafficKind = 'fisher' | 'trawler' | 'ferry' | 'sail' | 'zodiac' | 'pirogue' | 'fireboat' | 'tug';
export interface TrafficSpec {
  kind: TrafficKind;
  hull: string;
  trim: string;
  scale: number;
  /** секунд на проход через экран */
  period: number;
  /** полоса: 0 — у горизонта, 1 — у набережной */
  lane: number;
  /** сдвиг фазы, c */
  offset?: number;
}

export interface BirdSpec { kind: 'gull' | 'pelican' | 'skua' | 'frigate'; n: number }

/** Событие распорядка дня порта */
export interface SceneEvent {
  id: string;
  /** подпись для интерфейса: «Рыбный аукцион» */
  label: string;
  /** час начала 0..24 */
  from: number;
  /** час конца; может быть > 24 для окна через полночь (20 → 25 = до 01:00) */
  to: number;
  /** только в эти сезоны */
  seasons?: Season[];
  /** множитель людности на улице, пока событие идёт */
  activity?: number;
  /** рисование; u — прогресс 0..1 внутри окна */
  draw?(f: PF, u: number): void;
}

/**
 * Кит порта. Обязательные методы повторяют ветки оригинального PortScene
 * (backdrop / building / extras / props / mooredBoats), необязательные — новые слои.
 */
export interface PortKit {
  layout: Record<HotId, number>;
  quay: 'wood' | 'stone' | 'concrete' | 'sand' | 'ice';
  pal: { quay: string; quayFace: string; water: [string, string]; lamp: string; lampLight: string };
  walkers: { n: number; cols: string[]; speed: number; hats?: boolean };
  fogBase?: number;
  /** позиции фонарей (доли ширины) — подобраны так, чтобы не перекрывать фасады */
  lampXs?: number[];
  /** высота плафона фонаря над землёй в единицах sc (мотыльки, гирлянды ярмарки) */
  lampTop?: number;
  /** суда, курсирующие по гавани */
  traffic?: TrafficSpec[];
  birds?: BirdSpec;
  /** часы работы зданий [открытие, закрытие]; нет записи — круглосуточно */
  hours?: Partial<Record<Building, [number, number]>>;
  /** распорядок дня */
  events?: SceneEvent[];
  /** холодно: у прохожих пар изо рта */
  cold?: (f: PF) => boolean;
  /** x доски «рыба дня» (доля ширины); по умолчанию слева от рынка */
  hotBoard?: number;
  /** судоходство на линии горизонта (FarShipSpec[] из horizon.ts); рисуется до backdrop, за островами и мысами */
  farShips?: import('./portHorizon').FarShipSpec[];
  /** всё, что на горизонте и в небе над ним (дальние берега, зарево городов, самолёты); рисуется после неба, до backdrop */
  horizon?(f: PF): void;
  /** задний план за водой (горы, город, лес) */
  backdrop(f: PF): void;
  /** объекты на дальней воде (корабли, айсберги, буи) */
  farWater(f: PF): void;
  /** дальний ряд построек за главными зданиями (не интерактивный) */
  backRow?(f: PF): void;
  /** детали покрытия набережной: доски, разметка, следы, ракушки */
  ground?(f: PF): void;
  /** здание; возвращает y верхней точки для хотспота */
  building(f: PF, b: Building, x: number, w: number): number;
  /** крупные детали на набережной (рисуются и в отражении) */
  extras(f: PF): void;
  /** мелкие детали */
  props(f: PF): void;
  /** название порта: вывеска, буквы на холме, надпись на стенке */
  signage?(f: PF): void;
  /** пришвартованные суда на ближней воде */
  moored(f: PF): void;
  /** жители и животные */
  locals(f: PF): void;
  /** ближний план (ветки, туман, боке, частицы) */
  foreground(f: PF): void;
  /** фонарь набережной */
  lamp(f: PF, x: number): void;
}
