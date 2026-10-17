import type { FishDef } from "./types";

export type TailType = "fork" | "deepfork" | "lunate" | "round" | "truncate" | "emarg" | "pointed";
export type DorsalType = "classic" | "double" | "triple" | "long" | "spiny" | "sail" | "low" | "filament";
export type JawType = "terminal" | "up" | "down" | "beak";

/** Индивидуальная морфология вида */
export interface Morph {
  depth: number; // множитель высоты тела
  hump: number; // смещение самой высокой точки спины
  belly: number; // выпуклость брюха
  snout: number; // 0 — тупая морда, 1 — заострённая
  snoutLen: number; // для вытянутых: длина рыла/клюва
  jaw: JawType;
  lips: boolean;
  tail: TailType;
  tailSize: number;
  dorsal: DorsalType;
  dorsalH: number;
  analH: number;
  pectoral: number; // размер грудного плавника
  pectoralWing: boolean; // крылья-плавники (тригла)
  eye: number;
  barbels: 0 | 1 | 2 | 3; // 1 — подбородочный, 2 — пара, 3 — длинные усы
  scutes: boolean;
  lateral: boolean;
  lateralScutes: boolean;
  finlets: boolean;
  adipose: boolean;
  headBump: boolean;
  /** Парный брюшной плавник, сросшийся в присасывательный диск у бычков. */
  pelvicDisc: boolean;
  /** Кожные усики/бахрома над глазом у отдельных донных видов. */
  headCirri: boolean;
  /** Небольшие видимые клыки у хищных костистых рыб. */
  visibleTeeth: boolean;
  /** Тёмное кольцо на хвостовом стебле у ласкиря. */
  caudalBand: boolean;
  /** Золотистое пятно на жаберной крышке у золотистого кефаля. */
  opercularSpot: boolean;
  finEdge: string | null;
  ped: number; // толщина хвостового стебля
  patScale: number;
  patDensity: number;
  gills: number;
  ratTail: boolean;
  thresher: boolean;
  hammer: boolean;
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const G = (f: FishDef) => f.latin.split(" ")[0];
const inG = (f: FishDef, ...g: string[]) => g.includes(G(f));

/**
 * Ручная художественная настройка первых 50 видов текущего порядка кодекса.
 * Это только силуэт и анатомические акценты; параметры улова не затрагиваются.
 */
export const CURATED_FISH_MODEL_IDS = [
  "goby", "horse_mackerel", "mullet", "red_mullet", "wrasse", "picarel", "blenny", "saddled_bream", "black_goby", "sprat",
  "pipefish", "scorpionfish", "turbot", "croaker", "garfish", "bonito", "bluefish", "stargazer", "rainbow_wrasse", "sea_bream_bay",
  "gilthead", "salema", "weever", "sea_horse", "shi_drum", "bay_turbot_giant", "bay_master", "atherina", "anchovy", "golden_mullet",
  "flounder", "taran", "roach", "bream", "rudd", "crucian", "gudgeon", "pilengas", "sazan", "zander",
  "asp", "chekhon", "tench", "shemaya", "catfish", "starry_sturgeon", "sturgeon", "sterlet", "beluga", "sea_bass",
] as const;

/** Видоспецифичные поправки поверх общих семейных правил. */
const MODEL_OVERRIDES: Record<string, Partial<Morph>> = {
  // Тихая бухта: у бычков — крупная голова, округлый хвост и брюшной присасывательный диск.
  goby: { depth: 1.16, hump: 0.1, belly: 1.1, snout: 0.12, jaw: "terminal", tail: "round", tailSize: 0.9, dorsal: "double", dorsalH: 1.05, analH: 0.8, pectoral: 1.3, eye: 1.32, pelvicDisc: true, lateral: false, patScale: 0.95, patDensity: 1.12, ped: 0.09 },
  horse_mackerel: { depth: 0.88, belly: 0.92, snout: 0.72, tail: "deepfork", tailSize: 1.12, dorsal: "double", dorsalH: 0.95, pectoral: 1.05, eye: 1.12, lateral: true, lateralScutes: true, ped: 0.045, patScale: 0.78 },
  mullet: { depth: 0.84, hump: -0.02, belly: 0.92, snout: 0.1, jaw: "terminal", lips: false, tail: "emarg", dorsal: "double", dorsalH: 0.82, analH: 0.82, pectoral: 0.92, eye: 1, lateral: true, ped: 0.075, patScale: 0.86 },
  red_mullet: { depth: 0.98, hump: 0.03, belly: 1.02, snout: 0.08, jaw: "down", tail: "fork", dorsal: "double", dorsalH: 0.95, analH: 0.9, pectoral: 1.12, eye: 1.12, barbels: 2, lateral: true, patDensity: 0.92 },
  wrasse: { depth: 1.12, hump: 0.02, belly: 1.08, snout: 0.34, jaw: "terminal", lips: true, tail: "round", tailSize: 1.02, dorsal: "long", dorsalH: 0.9, analH: 1.1, pectoral: 1.08, eye: 1.05 },
  picarel: { depth: 1.02, hump: 0.02, belly: 1.02, snout: 0.42, tail: "fork", tailSize: 0.94, dorsal: "long", dorsalH: 0.82, analH: 0.9, pectoral: 0.92, eye: 1.08, lateral: true, ped: 0.07 },
  blenny: { depth: 1.04, hump: 0.1, belly: 1.02, snout: 0.08, tail: "round", tailSize: 0.82, dorsal: "long", dorsalH: 1.02, analH: 0.9, pectoral: 1.28, eye: 1.32, headCirri: true, lateral: false },
  saddled_bream: { depth: 1.24, hump: 0.03, belly: 1.14, snout: 0.32, tail: "fork", dorsal: "spiny", dorsalH: 1.05, analH: 1, pectoral: 1.02, eye: 1.05, caudalBand: true, lateral: true, patScale: 1.05 },
  black_goby: { depth: 1.28, hump: 0.13, belly: 1.14, snout: 0.06, jaw: "terminal", tail: "round", tailSize: 0.9, dorsal: "double", dorsalH: 1.14, pectoral: 1.34, eye: 1.38, pelvicDisc: true, lateral: false, patScale: 1.05, patDensity: 1.08 },
  sprat: { depth: 0.78, snout: 0.62, jaw: "up", tail: "deepfork", tailSize: 1.05, dorsal: "low", dorsalH: 0.75, pectoral: 0.9, eye: 1.28, ped: 0.05, lateral: true, patScale: 0.78 },
  pipefish: { depth: 0.56, snout: 0.35, snoutLen: 0.12, jaw: "terminal", tail: "round", tailSize: 0.55, dorsal: "low", dorsalH: 0.5, analH: 0.45, pectoral: 0.6, eye: 0.9, lateral: false },
  scorpionfish: { depth: 1.22, hump: 0.1, belly: 1.1, snout: 0.16, tail: "truncate", dorsal: "spiny", dorsalH: 1.38, analH: 1.08, pectoral: 1.45, eye: 1.32, patScale: 1.2, patDensity: 1.18 },
  turbot: { depth: 1.05, snout: 0.28, tail: "round", pectoral: 1.05, eye: 1.12, patScale: 1.1, patDensity: 1.15 },
  croaker: { depth: 1.18, hump: 0.08, belly: 1.1, snout: 0.2, jaw: "terminal", tail: "truncate", dorsal: "double", dorsalH: 0.88, analH: 1.08, pectoral: 1.02, eye: 1.08, lateral: true },
  garfish: { depth: 0.58, snout: 0.72, snoutLen: 0.2, jaw: "beak", tail: "deepfork", tailSize: 1.05, dorsal: "low", dorsalH: 0.55, analH: 0.55, pectoral: 0.68, eye: 1.05, lateral: true, ped: 0.055 },
  bonito: { depth: 0.86, hump: -0.02, belly: 0.9, snout: 0.8, tail: "lunate", tailSize: 1.1, dorsal: "double", dorsalH: 0.95, analH: 0.9, pectoral: 1, eye: 1.08, finlets: true, lateral: true, ped: 0.045, patScale: 0.78 },
  bluefish: { depth: 0.8, hump: -0.03, belly: 0.9, snout: 0.82, jaw: "up", tail: "deepfork", tailSize: 1.1, dorsal: "double", dorsalH: 0.92, analH: 0.95, pectoral: 1.02, eye: 1.05, visibleTeeth: true, lateral: true, ped: 0.05 },
  stargazer: { depth: 1.12, hump: 0.12, belly: 1.08, snout: 0.04, jaw: "up", tail: "round", dorsal: "spiny", dorsalH: 1.05, pectoral: 1.3, eye: 1.45, lateral: false, patScale: 1.18, patDensity: 1.16 },
  rainbow_wrasse: { depth: 0.8, hump: 0.01, belly: 0.9, snout: 0.35, lips: true, tail: "emarg", dorsal: "long", dorsalH: 0.88, analH: 0.95, pectoral: 1.05, eye: 1.12 },
  sea_bream_bay: { depth: 1.08, hump: 0.04, belly: 1.04, snout: 0.78, jaw: "terminal", tail: "fork", dorsal: "spiny", dorsalH: 1.12, analH: 1.05, pectoral: 1.02, eye: 1.04 },
  gilthead: { depth: 1.18, hump: 0.06, belly: 1.1, snout: 0.28, jaw: "terminal", lips: true, tail: "emarg", dorsal: "spiny", dorsalH: 1.12, analH: 1, pectoral: 1.02, eye: 0.98, ped: 0.07 },
  salema: { depth: 1.22, hump: 0.04, belly: 1.12, snout: 0.38, tail: "fork", dorsal: "spiny", dorsalH: 1.06, analH: 1, pectoral: 1, eye: 1.02, lateral: true, patScale: 1.32, patDensity: 1.1 },
  weever: { depth: 0.74, hump: -0.02, belly: 0.94, snout: 0.22, jaw: "up", tail: "truncate", dorsal: "spiny", dorsalH: 1.42, analH: 0.78, pectoral: 1.12, eye: 1.3, ped: 0.08 },
  sea_horse: { depth: 1, snout: 0.2, snoutLen: 0.12, dorsalH: 0.9, pectoral: 0.72, eye: 1.12, patDensity: 1.18 },
  shi_drum: { depth: 1.04, hump: 0.04, belly: 1.02, snout: 0.4, jaw: "down", tail: "truncate", dorsal: "double", dorsalH: 0.92, pectoral: 1.05, eye: 1.05, barbels: 1, lateral: true },
  bay_turbot_giant: { depth: 1.12, snout: 0.28, tail: "round", pectoral: 1.08, eye: 1.16, patScale: 1.18, patDensity: 1.5 },
  bay_master: { depth: 0.96, hump: 0.01, belly: 1.02, snout: 0.06, tail: "emarg", tailSize: 1.18, dorsal: "double", dorsalH: 0.92, analH: 0.85, pectoral: 1.12, eye: 1.1, lateral: true, ped: 0.06 },
  atherina: { depth: 0.66, hump: -0.02, belly: 0.82, snout: 0.58, tail: "deepfork", dorsal: "double", dorsalH: 0.68, analH: 0.78, pectoral: 0.9, eye: 1.22, lateral: true, ped: 0.05, patScale: 0.72 },
  anchovy: { depth: 0.8, hump: -0.02, belly: 0.9, snout: 0.82, jaw: "down", tail: "deepfork", dorsal: "low", dorsalH: 0.78, pectoral: 0.9, eye: 1.18, lateral: true, ped: 0.05 },
  golden_mullet: { depth: 0.86, hump: 0, belly: 0.94, snout: 0.08, jaw: "terminal", tail: "emarg", dorsal: "double", dorsalH: 0.84, analH: 0.82, pectoral: 0.95, eye: 1.02, lateral: true, opercularSpot: true, ped: 0.07 },
  flounder: { depth: 0.98, snout: 0.22, tail: "round", pectoral: 1.02, eye: 1.08, patScale: 1.08, patDensity: 1.22 },
  taran: { depth: 0.94, hump: 0.02, belly: 0.98, snout: 0.26, jaw: "terminal", tail: "fork", dorsal: "classic", dorsalH: 0.9, analH: 0.9, pectoral: 0.98, eye: 1.02, lateral: true },
  roach: { depth: 0.86, hump: -0.01, belly: 0.92, snout: 0.24, jaw: "terminal", tail: "fork", dorsal: "classic", dorsalH: 0.84, analH: 0.86, pectoral: 0.92, eye: 1.05, lateral: true, ped: 0.07 },
  bream: { depth: 1.32, hump: 0.08, belly: 1.18, snout: 0.18, jaw: "down", tail: "emarg", dorsal: "low", dorsalH: 0.78, analH: 1.28, pectoral: 0.9, eye: 0.92 },
  rudd: { depth: 1.18, hump: 0.04, belly: 1.12, snout: 0.28, jaw: "up", tail: "fork", dorsal: "classic", dorsalH: 1.05, analH: 1.02, pectoral: 1.02, eye: 1.18, lateral: true },
  crucian: { depth: 1.3, hump: 0.08, belly: 1.2, snout: 0.12, jaw: "terminal", tail: "round", dorsal: "long", dorsalH: 0.92, analH: 1, pectoral: 0.98, eye: 0.96, patScale: 1.18 },
  gudgeon: { depth: 0.82, hump: 0, belly: 0.9, snout: 0.16, jaw: "down", lips: true, tail: "fork", dorsal: "classic", dorsalH: 0.86, pectoral: 1.12, eye: 1.05, barbels: 2, lateral: true },
  pilengas: { depth: 0.86, hump: 0, belly: 0.94, snout: 0.08, jaw: "terminal", lips: false, tail: "emarg", dorsal: "double", dorsalH: 0.84, analH: 0.84, pectoral: 0.95, eye: 1, lateral: true, ped: 0.07 },
  sazan: { depth: 1.28, hump: 0.1, belly: 1.2, snout: 0.1, jaw: "down", lips: true, tail: "emarg", dorsal: "long", dorsalH: 1.05, analH: 0.92, pectoral: 1.1, eye: 0.94, barbels: 2, patScale: 1.2 },
  zander: { depth: 0.88, hump: 0, belly: 0.94, snout: 0.72, jaw: "up", tail: "emarg", dorsal: "double", dorsalH: 1.08, analH: 0.9, pectoral: 1.04, eye: 1.34, visibleTeeth: true, lateral: true, ped: 0.06 },
  asp: { depth: 0.76, hump: -0.03, belly: 0.88, snout: 0.76, jaw: "up", tail: "deepfork", dorsal: "classic", dorsalH: 0.88, analH: 0.92, pectoral: 0.92, eye: 1.02, lateral: true, ped: 0.055 },
  chekhon: { depth: 0.68, hump: -0.06, belly: 0.78, snout: 0.28, jaw: "up", tail: "fork", dorsal: "low", dorsalH: 0.72, analH: 1.18, pectoral: 0.84, eye: 1.08, lateral: true, ped: 0.055 },
  tench: { depth: 1.18, hump: 0.06, belly: 1.14, snout: 0.08, jaw: "down", lips: true, tail: "round", dorsal: "classic", dorsalH: 0.9, analH: 0.88, pectoral: 0.95, eye: 0.82, barbels: 2, patScale: 1.25 },
  shemaya: { depth: 0.76, hump: -0.02, belly: 0.88, snout: 0.56, tail: "deepfork", dorsal: "low", dorsalH: 0.76, pectoral: 0.9, eye: 1.12, lateral: true, ped: 0.05, patScale: 0.78 },
  catfish: { depth: 1.12, hump: 0.02, belly: 1.12, snout: 0.05, jaw: "up", dorsal: "low", pectoral: 1.08, eye: 1.08, barbels: 3, lateral: false },
  starry_sturgeon: { depth: 0.92, hump: -0.04, belly: 0.9, snout: 1, snoutLen: 0.2, jaw: "down", tail: "fork", dorsal: "low", pectoral: 0.9, eye: 1.02, barbels: 2, scutes: true, lateral: false, patScale: 1.3 },
  sturgeon: { depth: 1.02, hump: 0, belly: 1, snout: 0.9, snoutLen: 0.11, jaw: "down", tail: "fork", dorsal: "low", pectoral: 0.98, eye: 0.98, barbels: 2, scutes: true, lateral: false, patScale: 1.12 },
  sterlet: { depth: 0.86, hump: -0.02, belly: 0.9, snout: 0.9, snoutLen: 0.08, jaw: "down", tail: "fork", dorsal: "low", pectoral: 0.9, eye: 0.95, barbels: 2, scutes: true, lateral: false, patScale: 1.2 },
  beluga: { depth: 1.12, hump: 0.04, belly: 1.08, snout: 0.72, snoutLen: 0.05, jaw: "down", tail: "fork", dorsal: "low", pectoral: 1.12, eye: 1.12, barbels: 2, scutes: true, lateral: false, patScale: 0.9 },
  sea_bass: { depth: 1.18, hump: 0.04, belly: 1.08, snout: 0.24, tail: "truncate", dorsal: "spiny", dorsalH: 1.25, analH: 0.95, pectoral: 1.12, eye: 1.32, lateral: true, ped: 0.07 },
};

const cache = new Map<string, Morph>();

export function getMorph(f: FishDef): Morph {
  const hit = cache.get(f.id);
  if (hit) return hit;
  const r = hash(`morph:${f.id}:${f.latin}`);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const rng = (a: number, b: number) => a + r() * (b - a);
  const deep = f.shape === "deep";
  const m: Morph = {
    depth: rng(0.86, 1.18),
    hump: rng(-0.1, 0.16),
    belly: rng(0.85, 1.15),
    snout: rng(0.15, 0.7),
    snoutLen: rng(0, 0.06),
    jaw: pick<JawType>(["terminal", "terminal", "terminal", "up", "down"]),
    lips: false,
    tail: deep ? pick<TailType>(["round", "truncate", "emarg", "emarg", "fork"]) : pick<TailType>(["fork", "fork", "deepfork", "emarg", "truncate"]),
    tailSize: rng(0.85, 1.2),
    dorsal: pick<DorsalType>(deep ? ["classic", "spiny", "long", "classic"] : ["classic", "double", "classic", "spiny", "low"]),
    dorsalH: rng(0.75, 1.35),
    analH: rng(0.7, 1.3),
    pectoral: rng(0.8, 1.3),
    pectoralWing: false,
    eye: rng(0.85, 1.25),
    barbels: 0,
    scutes: false,
    lateral: r() < 0.55,
    lateralScutes: false,
    finlets: false,
    adipose: false,
    headBump: false,
    pelvicDisc: false,
    headCirri: false,
    visibleTeeth: false,
    caudalBand: false,
    opercularSpot: false,
    finEdge: r() < 0.28 ? (f.colors.accent ?? null) : null,
    ped: rng(0.06, 0.12),
    patScale: rng(0.75, 1.35),
    patDensity: rng(0.7, 1.4),
    gills: 5,
    ratTail: false,
    thresher: false,
    hammer: false,
  };

  // ───── семейства ─────
  if (inG(f, "Acipenser", "Huso")) Object.assign(m, { snout: 1, snoutLen: f.id === "starry_sturgeon" ? 0.2 : f.id === "beluga" ? 0.05 : 0.11, jaw: "down", barbels: 2, scutes: true, tail: "fork", dorsal: "low", lateral: false });
  if (inG(f, "Gadus", "Melanogrammus", "Merlangius", "Pollachius", "Boreogadus", "Micromesistius", "Trisopterus", "Molva", "Brosme", "Lota", "Gaidropsarus")) Object.assign(m, { barbels: 1, dorsal: f.id === "tusk" || f.id === "burbot" ? "long" : "triple", tail: f.id === "burbot" || f.id === "tusk" ? "round" : "truncate", lateral: true });
  if (inG(f, "Silurus")) Object.assign(m, { barbels: 3, snout: 0.05, jaw: "up", dorsal: "low", tail: "round" });
  if (inG(f, "Cyprinus", "Gobio", "Tinca")) Object.assign(m, { barbels: 2, lips: true, jaw: "down" });
  if (inG(f, "Mullus", "Mulloidichthys")) Object.assign(m, { barbels: 2, snout: 0.1, jaw: "down", dorsal: "double" });
  if (inG(f, "Salmo", "Oncorhynchus", "Salvelinus", "Coregonus", "Stenodus", "Thymallus", "Osmerus", "Argentina", "Mallotus")) Object.assign(m, { adipose: true, dorsal: "classic", tail: f.id === "salmon" ? "emarg" : "fork" });
  if (inG(f, "Thymallus")) Object.assign(m, { dorsal: "sail", dorsalH: 1.6 });
  if (inG(f, "Thunnus", "Katsuwonus", "Auxis", "Sarda", "Gymnosarda", "Acanthocybium", "Scomber")) Object.assign(m, { tail: "lunate", finlets: true, dorsal: "double", ped: 0.045, snout: 0.75, eye: f.id === "deep_bigeye" ? 1.5 : m.eye });
  if (inG(f, "Caranx", "Seriola", "Selar", "Trachurus", "Elagatis", "Naucrates")) Object.assign(m, { tail: "deepfork", lateralScutes: inG(f, "Caranx", "Trachurus", "Selar"), dorsal: "double", ped: 0.05 });
  if (inG(f, "Epinephelus", "Plectropomus", "Polyprion", "Stereolepis", "Paralabrax", "Serranus", "Myripristis", "Sargocentron")) Object.assign(m, { dorsal: "spiny", tail: inG(f, "Epinephelus", "Stereolepis") ? "round" : "truncate", jaw: "up", lips: inG(f, "Epinephelus", "Stereolepis") });
  if (inG(f, "Lutjanus", "Pristipomoides", "Etelis", "Lobotes")) Object.assign(m, { dorsal: "spiny", tail: inG(f, "Etelis", "Pristipomoides") ? "deepfork" : "emarg" });
  if (inG(f, "Sebastes", "Scorpaena", "Pterois", "Scorpaenichthys", "Trachinus")) Object.assign(m, { dorsal: "spiny", dorsalH: inG(f, "Pterois") ? 2 : 1.2, eye: 1.3, jaw: "up", tail: "truncate" });
  if (inG(f, "Labrus", "Symphodus", "Coris", "Cheilinus", "Choerodon", "Semicossyphus", "Hexagrammos")) Object.assign(m, { lips: true, tail: "round", dorsal: "long", snout: 0.35 });
  if (f.id === "napoleon" || f.id === "sheephead") m.headBump = true;
  if (inG(f, "Scarus")) Object.assign(m, { jaw: "beak", tail: "emarg", dorsal: "long" });
  if (inG(f, "Acanthurus", "Paracanthurus", "Zebrasoma", "Naso")) Object.assign(m, { tail: "lunate", dorsal: "long", snout: 0.55, eye: 1.1 });
  if (inG(f, "Balistes", "Balistoides", "Rhinecanthus")) Object.assign(m, { dorsal: "spiny", dorsalH: 1.5, snout: 0.8, jaw: "terminal", tail: "truncate", eye: 0.9 });
  if (inG(f, "Chaetodon", "Pomacanthus", "Centropyge", "Abudefduf", "Hypsypops", "Chromis", "Scatophagus")) Object.assign(m, { dorsal: "long", tail: "truncate", snout: f.id === "butterflyfish" ? 0.95 : 0.5, analH: 1.4 });
  if (inG(f, "Zanclus")) Object.assign(m, { dorsal: "filament", snout: 0.95, tail: "emarg" });
  if (inG(f, "Mugil", "Chelon", "Planiliza")) Object.assign(m, { snout: 0.05, dorsal: "double", tail: "emarg", jaw: "terminal" });
  if (inG(f, "Clupea", "Sardina", "Engraulis", "Sprattus", "Clupeonella", "Atherina", "Spicara")) Object.assign(m, { tail: "deepfork", dorsal: "low", eye: 1.35, ped: 0.05, snout: 0.6 });
  if (inG(f, "Chelidonichthys")) Object.assign(m, { pectoralWing: true, snout: 0.05, dorsal: "double" });
  if (inG(f, "Zeus")) Object.assign(m, { dorsal: "filament", jaw: "up", tail: "round" });
  if (inG(f, "Coryphaena")) Object.assign(m, { headBump: f.id === "mahi", dorsal: "long", tail: "deepfork", snout: 0 });
  if (inG(f, "Sparus", "Diplodus", "Pagellus", "Dentex", "Spondyliosoma", "Archosargus", "Sarpa")) Object.assign(m, { dorsal: "spiny", tail: "fork", snout: 0.35 });
  if (inG(f, "Perca", "Sander", "Dicentrarchus", "Centropomus", "Lates")) Object.assign(m, { dorsal: "double", tail: "emarg", lateral: true });
  if (inG(f, "Rutilus", "Abramis", "Blicca", "Scardinius", "Leuciscus", "Alburnus", "Carassius", "Pelecus")) Object.assign(m, { dorsal: "classic", tail: "fork", jaw: inG(f, "Pelecus") ? "up" : m.jaw });
  if (inG(f, "Megalops", "Albula")) Object.assign(m, { tail: "deepfork", dorsal: f.id === "tarpon" ? "filament" : "classic", jaw: "up", eye: 1.3 });
  if (inG(f, "Sciaena", "Umbrina", "Sciaenops", "Atractoscion")) Object.assign(m, { barbels: f.id === "shi_drum" ? 1 : 0, dorsal: "double", tail: "truncate" });
  if (inG(f, "Anarhichas")) Object.assign(m, { jaw: "down", lips: true });

  // вытянутые
  if (f.shape === "long" || f.shape === "eel") {
    m.snoutLen = 0.02;
    if (inG(f, "Belone", "Hemiramphus")) m.snoutLen = 0.2;
    if (inG(f, "Esox")) Object.assign(m, { snoutLen: 0.07, dorsal: "low" });
    if (inG(f, "Sphyraena", "Alepisaurus", "Aphanopus")) m.snoutLen = 0.09;
    if (inG(f, "Coryphaenoides", "Macrourus", "Hydrolagus", "Chimaera")) Object.assign(m, { ratTail: true, eye: 1.5 });
    if (inG(f, "Syngnathus", "Hippocampus", "Nemichthys")) m.snoutLen = 0.12;
  }

  // акулы
  if (f.shape === "shark") {
    m.snout = rng(0.4, 1);
    if (inG(f, "Hexanchus")) m.gills = 6;
    if (inG(f, "Notorynchus")) m.gills = 7;
    if (inG(f, "Alopias")) m.thresher = true;
    if (inG(f, "Sphyrna")) m.hammer = true;
    if (inG(f, "Mitsukurina")) m.snoutLen = 0.12;
    if (inG(f, "Rhincodon")) Object.assign(m, { snout: 0, depth: 1.25 });
    if (inG(f, "Isurus", "Lamna", "Carcharodon")) Object.assign(m, { tail: "lunate", snout: 1 });
    if (inG(f, "Somniosus", "Squalus", "Centrophorus", "Isistius")) Object.assign(m, { dorsalH: 0.55, tail: "pointed" });
  }

  // Явные видовые параметры должны побеждать и семейные, и случайные значения.
  Object.assign(m, MODEL_OVERRIDES[f.id]);
  cache.set(f.id, m);
  return m;
}
