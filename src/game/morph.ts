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
  /** Контрастный ложный глазок у хвоста (например, у красного горбыля). */
  caudalOcellus: boolean;
  /** Отдельное тёмное пятно на боку, как у солнечника. */
  lateralOcellus: boolean;
  /** Плечевое пятно у пикши. */
  shoulderSpot: boolean;
  /** Число лучей-колючек в передней спинной секции. */
  dorsalSpines: number;
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

/** Все 301 позиции кодекса — детерминированные модели; порядок совпадает с FISH. */
export const CURATED_FISH_MODEL_IDS = [
  "goby", "horse_mackerel", "mullet", "red_mullet", "wrasse", "picarel",
  "blenny", "saddled_bream", "black_goby", "sprat", "pipefish", "scorpionfish",
  "turbot", "croaker", "garfish", "bonito", "bluefish", "stargazer",
  "rainbow_wrasse", "sea_bream_bay", "gilthead", "salema", "weever", "sea_horse",
  "shi_drum", "bay_turbot_giant", "bay_master", "atherina", "anchovy", "golden_mullet",
  "flounder", "taran", "roach", "bream", "rudd", "crucian",
  "gudgeon", "pilengas", "sazan", "zander", "asp", "chekhon",
  "tench", "shemaya", "catfish", "starry_sturgeon", "sturgeon", "sterlet",
  "beluga", "sea_bass", "cod", "mackerel", "sargo", "pandora",
  "gurnard", "sole", "comber", "tub_gurnard", "black_seabream", "rockling",
  "seabass_lavrak", "dogfish", "pollack_yellow", "cuckoo_ray", "monkfish", "conger",
  "cuckoo_wrasse", "john_dory", "red_scorpion", "wreckfish", "spurdog_giant", "angel_shark",
  "stone_patriarch", "pollock", "whiting", "herring", "plaice_eu", "perch",
  "smelt", "ide", "vendace", "garfish_baltic", "roach_baltic", "silver_bream",
  "sea_trout", "lumpfish", "pike", "whitefish", "burbot", "zander_baltic",
  "eel", "wels_skerry", "grayling", "atl_sturgeon", "sea_eagle_trout", "pike_legend",
  "haddock", "plaice", "capelin", "blue_whiting", "polar_cod", "pink_salmon",
  "saithe_black", "sprat_nor", "norway_pout", "spotted_wolffish", "char", "ling",
  "tusk", "beaked_redfish", "norway_haddock", "arctic_skate", "lemon_sole", "halibut",
  "salmon", "argentine", "porbeagle", "rabbit_chimaera", "black_scabbard", "greenland_shark",
  "halibut_green", "nordvik_halibut", "lofoten_cod", "ballan", "surfperch", "garibaldi",
  "kelp_bass", "opaleye", "rockfish_blue", "kelp_greenling", "wolffish", "thornback",
  "sheephead", "lingcod", "cabezon", "halibut_cali", "treefish", "pacific_bonito",
  "chimaera", "white_seabass", "leopard_shark", "wolf_eel", "sevengill", "giant_seabass",
  "octopus", "white_sturgeon", "great_white", "kelp_leviathan", "clownfish", "surgeonfish",
  "parrotfish", "butterflyfish", "rabbitfish", "damselfish", "goatfish_yellow", "squirrelfish",
  "angelfish", "moray", "barracuda", "lionfish", "red_snapper", "boxfish",
  "hawkfish", "bluefin_jack", "flame_angel", "grouper", "eagle_ray", "clown_trigger",
  "moorish_idol", "giant_trevally", "coral_trout", "mandarin", "harlequin_tusk", "napoleon",
  "tiger_shark", "manta", "dogtooth", "golden_moray", "sergeant", "mudskipper",
  "mangrove_snapper", "mojarra", "sheepshead", "scat", "halfbeak", "pufferfish",
  "blacktip", "archerfish", "snook", "jack_crevalle", "red_drum", "gar_tropical",
  "bonefish", "tarpon", "lemon_shark", "cubera", "barramundi", "goliath",
  "bull_shark", "sawfish", "yellowfin", "mahi", "sardine", "skipjack",
  "albacore", "bullet_tuna", "pompano_black", "blue_shark", "cobia", "escolar",
  "dolphinfish_pompano", "oilfish", "pilot_fish", "swordfish", "mako", "sailfish",
  "hammerhead", "striped_marlin", "sunfish", "lancetfish", "tripletail", "blue_marlin",
  "opah", "bluefin", "oceanic_whitetip", "shortfin_mako_giant", "santiago", "whale_shark",
  "flying_fish", "soldierfish", "convict_tang", "moorish_tang", "bigeye_scad", "bluestripe_snapper",
  "wahoo", "dentex", "triggerfish", "unicornfish", "bluefin_trevally", "opakapaka",
  "amberjack", "lava_moray", "kampachi", "picasso_trigger", "onaga", "galapagos_shark",
  "deepwater_snapper", "black_marlin", "deep_bigeye", "coelacanth", "pele_marlin", "hatchetfish",
  "lanternfish", "grenadier", "bristlemouth", "hagfish", "deep_angler", "blobfish",
  "viperfish", "orange_roughy", "snipe_eel", "fangtooth", "loosejaw", "gulper_shark",
  "gulper", "ghost_chimaera", "black_swallower", "tripodfish", "pelican_eel", "anglerfish_beard",
  "dragonfish_black", "cookiecutter", "giant_squid", "goblin_shark", "oarfish", "barreleye",
  "sixgill", "abyss_octopus", "abyss_snail", "leviathan", "silverfish", "marbled_rockcod",
  "bald_notothen", "emerald_rockcod", "antarctic_eelpout", "ice_pout", "macrourus", "icefish",
  "antarctic_skate", "crocodile_icefish", "spiny_plunderfish", "marbled_plunderfish", "dragonfish", "toothfish",
  "blue_whiting_giant", "unicorn_icefish", "sleeper_shark", "bathydraco", "southern_right_mola", "colossal_squid",
  "white_icefish_king",
] as const;

const FIRST_WAVE_IDS = new Set<string>(CURATED_FISH_MODEL_IDS.slice(0, 50));

/**
 * Базовый профиль формы для видов без отдельной исторической настройки.
 * Сначала выбирается силуэт каталога, затем на него накладывается профиль таксона
 * и, в последнюю очередь, видовые акценты. Никаких игровых параметров здесь нет.
 */
const ARCHETYPE_BASELINES: Record<FishDef["shape"], Partial<Morph>> = {
  fusiform: { depth: 0.96, hump: 0, belly: 0.98, snout: 0.42, snoutLen: 0.02, jaw: "terminal", lips: false, tail: "fork", tailSize: 1, dorsal: "classic", dorsalH: 0.95, analH: 0.9, pectoral: 1, pectoralWing: false, eye: 1, barbels: 0, scutes: false, lateral: true, lateralScutes: false, finlets: false, adipose: false, headBump: false, pelvicDisc: false, headCirri: false, visibleTeeth: false, caudalBand: false, opercularSpot: false, caudalOcellus: false, lateralOcellus: false, shoulderSpot: false, dorsalSpines: 8, finEdge: null, ped: 0.065, patScale: 1, patDensity: 1, gills: 5, ratTail: false, thresher: false, hammer: false },
  deep: { depth: 1.16, hump: 0.04, belly: 1.08, snout: 0.34, snoutLen: 0.02, jaw: "terminal", lips: false, tail: "round", tailSize: 0.94, dorsal: "spiny", dorsalH: 1.05, analH: 0.98, pectoral: 1.08, pectoralWing: false, eye: 1.04, barbels: 0, scutes: false, lateral: true, lateralScutes: false, finlets: false, adipose: false, headBump: false, pelvicDisc: false, headCirri: false, visibleTeeth: false, caudalBand: false, opercularSpot: false, caudalOcellus: false, lateralOcellus: false, shoulderSpot: false, dorsalSpines: 8, finEdge: null, ped: 0.08, patScale: 1.05, patDensity: 1, gills: 5, ratTail: false, thresher: false, hammer: false },
  long: { depth: 0.76, hump: -0.02, belly: 0.9, snout: 0.62, snoutLen: 0.04, jaw: "terminal", lips: false, tail: "fork", tailSize: 0.92, dorsal: "low", dorsalH: 0.84, analH: 0.88, pectoral: 0.88, pectoralWing: false, eye: 1.08, barbels: 0, scutes: false, lateral: true, lateralScutes: false, finlets: false, adipose: false, headBump: false, pelvicDisc: false, headCirri: false, visibleTeeth: false, caudalBand: false, opercularSpot: false, caudalOcellus: false, lateralOcellus: false, shoulderSpot: false, dorsalSpines: 8, finEdge: null, ped: 0.055, patScale: 0.9, patDensity: 0.95, gills: 5, ratTail: false, thresher: false, hammer: false },
  eel: { depth: 0.88, hump: 0, belly: 0.96, snout: 0.3, snoutLen: 0.02, jaw: "terminal", lips: false, tail: "pointed", tailSize: 0.82, dorsal: "long", dorsalH: 0.86, analH: 0.84, pectoral: 0.78, pectoralWing: false, eye: 1.12, barbels: 0, scutes: false, lateral: false, lateralScutes: false, finlets: false, adipose: false, headBump: false, pelvicDisc: false, headCirri: false, visibleTeeth: false, caudalBand: false, opercularSpot: false, caudalOcellus: false, lateralOcellus: false, shoulderSpot: false, dorsalSpines: 8, finEdge: null, ped: 0.035, patScale: 0.95, patDensity: 1, gills: 5, ratTail: false, thresher: false, hammer: false },
  flat: { depth: 1, hump: 0, belly: 1, snout: 0.28, snoutLen: 0.02, jaw: "down", lips: false, tail: "round", tailSize: 0.85, dorsal: "long", dorsalH: 0.82, analH: 0.82, pectoral: 0.82, pectoralWing: false, eye: 1.05, barbels: 0, scutes: false, lateral: false, lateralScutes: false, finlets: false, adipose: false, headBump: false, pelvicDisc: false, headCirri: false, visibleTeeth: false, caudalBand: false, opercularSpot: false, caudalOcellus: false, lateralOcellus: false, shoulderSpot: false, dorsalSpines: 8, finEdge: null, ped: 0.05, patScale: 1, patDensity: 1, gills: 5, ratTail: false, thresher: false, hammer: false },
  shark: { depth: 0.98, hump: 0, belly: 0.96, snout: 0.78, snoutLen: 0.02, jaw: "terminal", lips: false, tail: "pointed", tailSize: 1.05, dorsal: "classic", dorsalH: 1.15, analH: 0.7, pectoral: 1.12, pectoralWing: false, eye: 1.05, barbels: 0, scutes: false, lateral: false, lateralScutes: false, finlets: false, adipose: false, headBump: false, pelvicDisc: false, headCirri: false, visibleTeeth: false, caudalBand: false, opercularSpot: false, caudalOcellus: false, lateralOcellus: false, shoulderSpot: false, dorsalSpines: 8, finEdge: null, ped: 0.045, patScale: 1, patDensity: 1, gills: 5, ratTail: false, thresher: false, hammer: false },
  billfish: { depth: 0.94, hump: -0.02, belly: 0.94, snout: 0.95, snoutLen: 0.26, jaw: "beak", lips: false, tail: "lunate", tailSize: 1.12, dorsal: "sail", dorsalH: 1.25, analH: 0.88, pectoral: 1.12, pectoralWing: false, eye: 1.04, barbels: 0, scutes: false, lateral: true, lateralScutes: false, finlets: false, adipose: false, headBump: false, pelvicDisc: false, headCirri: false, visibleTeeth: false, caudalBand: false, opercularSpot: false, caudalOcellus: false, lateralOcellus: false, shoulderSpot: false, dorsalSpines: 8, finEdge: null, ped: 0.04, patScale: 0.9, patDensity: 1, gills: 5, ratTail: false, thresher: false, hammer: false },
  ray: { depth: 1, hump: 0, belly: 1, snout: 0.2, snoutLen: 0, jaw: "down", lips: false, tail: "pointed", tailSize: 1, dorsal: "low", dorsalH: 0.8, analH: 0.6, pectoral: 1.35, pectoralWing: false, eye: 1.05, barbels: 0, scutes: false, lateral: false, lateralScutes: false, finlets: false, adipose: false, headBump: false, pelvicDisc: false, headCirri: false, visibleTeeth: false, caudalBand: false, opercularSpot: false, caudalOcellus: false, lateralOcellus: false, shoulderSpot: false, dorsalSpines: 8, finEdge: null, ped: 0.05, patScale: 1, patDensity: 1, gills: 5, ratTail: false, thresher: false, hammer: false },
  angler: { depth: 1.12, hump: 0.1, belly: 1.1, snout: 0.12, snoutLen: 0.02, jaw: "up", lips: false, tail: "round", tailSize: 0.88, dorsal: "spiny", dorsalH: 1.15, analH: 0.88, pectoral: 1.2, pectoralWing: false, eye: 1.2, barbels: 0, scutes: false, lateral: false, lateralScutes: false, finlets: false, adipose: false, headBump: false, pelvicDisc: false, headCirri: false, visibleTeeth: false, caudalBand: false, opercularSpot: false, caudalOcellus: false, lateralOcellus: false, shoulderSpot: false, dorsalSpines: 8, finEdge: null, ped: 0.06, patScale: 1, patDensity: 1, gills: 5, ratTail: false, thresher: false, hammer: false },
  squid: { depth: 1, hump: 0, belly: 1, snout: 0.5, snoutLen: 0, jaw: "terminal", lips: false, tail: "round", tailSize: 1, dorsal: "low", dorsalH: 1, analH: 1, pectoral: 1, pectoralWing: false, eye: 1.1, barbels: 0, scutes: false, lateral: false, lateralScutes: false, finlets: false, adipose: false, headBump: false, pelvicDisc: false, headCirri: false, visibleTeeth: false, caudalBand: false, opercularSpot: false, caudalOcellus: false, lateralOcellus: false, shoulderSpot: false, dorsalSpines: 8, finEdge: null, ped: 0.04, patScale: 1, patDensity: 1, gills: 5, ratTail: false, thresher: false, hammer: false },
  puffer: { depth: 1.12, hump: 0, belly: 1.04, snout: 0.22, snoutLen: 0, jaw: "terminal", lips: false, tail: "round", tailSize: 0.92, dorsal: "low", dorsalH: 0.76, analH: 0.72, pectoral: 1, pectoralWing: false, eye: 1.1, barbels: 0, scutes: false, lateral: false, lateralScutes: false, finlets: false, adipose: false, headBump: false, pelvicDisc: false, headCirri: false, visibleTeeth: false, caudalBand: false, opercularSpot: false, caudalOcellus: false, lateralOcellus: false, shoulderSpot: false, dorsalSpines: 8, finEdge: null, ped: 0.08, patScale: 1, patDensity: 1, gills: 5, ratTail: false, thresher: false, hammer: false },
  blob: { depth: 1.05, hump: 0.12, belly: 1.08, snout: 0.14, snoutLen: 0, jaw: "terminal", lips: false, tail: "round", tailSize: 0.82, dorsal: "low", dorsalH: 0.7, analH: 0.72, pectoral: 0.86, pectoralWing: false, eye: 1.1, barbels: 0, scutes: false, lateral: false, lateralScutes: false, finlets: false, adipose: false, headBump: false, pelvicDisc: false, headCirri: false, visibleTeeth: false, caudalBand: false, opercularSpot: false, caudalOcellus: false, lateralOcellus: false, shoulderSpot: false, dorsalSpines: 8, finEdge: null, ped: 0.06, patScale: 1, patDensity: 1, gills: 5, ratTail: false, thresher: false, hammer: false },
};

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
  // №51–100: следующая полная волна видовых силуэтов и анатомических акцентов.
  cod: { depth: 1.02, hump: 0.02, belly: 1.05, snout: 0.22, tail: "truncate", dorsal: "triple", dorsalH: 0.94, pectoral: 0.92, eye: 1.05, barbels: 1, lateral: true },
  mackerel: { depth: 0.82, belly: 0.9, snout: 0.78, tail: "lunate", tailSize: 1.12, dorsal: "double", dorsalH: 0.9, finlets: true, ped: 0.045, patScale: 0.72 },
  sargo: { depth: 1.24, hump: 0.05, belly: 1.12, snout: 0.28, tail: "fork", dorsal: "spiny", dorsalH: 1.12, patScale: 1.12, patDensity: 1.2 },
  pandora: { depth: 0.98, belly: 0.96, snout: 0.3, tail: "emarg", dorsal: "spiny", dorsalH: 0.95, eye: 1.1, patScale: 0.92 },
  gurnard: { depth: 0.98, snout: 0.12, tail: "truncate", dorsal: "double", pectoral: 1.55, pectoralWing: true, patScale: 1.1 },
  sole: { depth: 0.92, snout: 0.12, jaw: "down", tail: "round", dorsal: "long", pectoral: 0.75, patScale: 0.9 },
  comber: { depth: 1.05, hump: 0.05, snout: 0.28, tail: "truncate", dorsal: "spiny", dorsalH: 1.22, eye: 1.14 },
  tub_gurnard: { depth: 0.9, snout: 0.08, tail: "truncate", dorsal: "double", pectoral: 1.45, pectoralWing: true, patScale: 1.28 },
  black_seabream: { depth: 1.2, hump: 0.05, belly: 1.08, tail: "emarg", dorsal: "spiny", dorsalH: 1.08, patScale: 0.82, patDensity: 1.22 },
  rockling: { depth: 0.82, snout: 0.12, tail: "round", dorsal: "long", dorsalH: 0.82, barbels: 3, lateral: false, patDensity: 1.15 },
  seabass_lavrak: { depth: 0.92, snout: 0.6, tail: "emarg", dorsal: "double", dorsalH: 1.02, pectoral: 1.06, lateral: true, ped: 0.06 },
  dogfish: { depth: 0.9, snout: 0.72, tail: "pointed", dorsal: "double", dorsalH: 0.8, pectoral: 1.08, ped: 0.05 },
  pollack_yellow: { depth: 0.9, snout: 0.32, tail: "truncate", dorsal: "triple", dorsalH: 0.92, barbels: 0, lateral: true },
  cuckoo_ray: { depth: 1.02, tail: "pointed", pectoral: 1.35, patScale: 1.15, patDensity: 0.82 },
  monkfish: { depth: 1.24, hump: 0.13, belly: 1.2, snout: 0.12, jaw: "up", tail: "round", pectoral: 1.28, eye: 1.08, dorsal: "spiny" },
  conger: { depth: 0.88, snout: 0.24, jaw: "up", tail: "pointed", dorsal: "long", pectoral: 0.82, eye: 1.08 },
  cuckoo_wrasse: { depth: 0.98, belly: 1.02, snout: 0.42, lips: true, tail: "round", dorsal: "long", dorsalH: 1.08, patScale: 1.18 },
  john_dory: { depth: 1.42, hump: 0.06, belly: 1.16, snout: 0.22, tail: "round", dorsal: "filament", dorsalH: 1.45, pectoral: 1.1, eye: 0.94, patScale: 1.15, lateralOcellus: true },
  red_scorpion: { depth: 1.34, hump: 0.12, belly: 1.12, snout: 0.12, tail: "truncate", dorsal: "spiny", dorsalH: 1.45, pectoral: 1.5, eye: 1.24, patScale: 1.3 },
  wreckfish: { depth: 1.34, hump: 0.12, belly: 1.18, snout: 0.24, tail: "round", dorsal: "spiny", dorsalH: 1.18, pectoral: 1.2, ped: 0.1 },
  spurdog_giant: { depth: 0.9, snout: 0.72, tail: "pointed", tailSize: 1.45, thresher: true, dorsal: "classic", dorsalH: 0.9 },
  angel_shark: { depth: 1.05, snout: 0.18, tail: "pointed", pectoral: 1.42, dorsal: "low", dorsalH: 0.72 },
  stone_patriarch: { depth: 1.3, hump: 0.1, belly: 1.14, snout: 0.2, tail: "truncate", dorsal: "spiny", dorsalH: 1.32, pectoral: 1.16, eye: 1.18, patScale: 1.28 },
  pollock: { depth: 0.88, snout: 0.32, tail: "truncate", dorsal: "triple", dorsalH: 0.92, barbels: 0, lateral: true },
  whiting: { depth: 0.84, snout: 0.35, tail: "truncate", dorsal: "triple", dorsalH: 0.86, barbels: 1, eye: 1.12 },
  herring: { depth: 0.78, snout: 0.62, jaw: "up", tail: "deepfork", tailSize: 1.06, dorsal: "low", eye: 1.24, ped: 0.045 },
  plaice_eu: { depth: 1.04, snout: 0.24, tail: "round", pectoral: 0.8, patScale: 1.16, patDensity: 0.76 },
  perch: { depth: 1.22, hump: 0.05, belly: 1.08, snout: 0.28, tail: "emarg", dorsal: "double", dorsalH: 1.2, eye: 1.05, patScale: 1.12 },
  smelt: { depth: 0.72, snout: 0.54, tail: "deepfork", dorsal: "low", adipose: true, eye: 1.2, ped: 0.045 },
  ide: { depth: 1.02, hump: 0.03, belly: 1.02, snout: 0.34, tail: "fork", dorsal: "classic", eye: 1.02, patScale: 1.1 },
  vendace: { depth: 0.82, snout: 0.56, tail: "deepfork", dorsal: "low", adipose: true, eye: 1.25, patScale: 0.82 },
  garfish_baltic: { depth: 0.8, snout: 0.28, tail: "fork", dorsal: "spiny", dorsalH: 1.18, scutes: true, lateralScutes: true, patScale: 0.9 },
  roach_baltic: { depth: 0.98, hump: 0.02, belly: 1.02, tail: "fork", dorsal: "classic", eye: 1.14, patScale: 1.04 },
  silver_bream: { depth: 1.24, hump: 0.06, belly: 1.12, snout: 0.2, tail: "emarg", dorsal: "classic", analH: 1.04, pectoral: 0.92 },
  sea_trout: { depth: 0.96, snout: 0.44, tail: "fork", dorsal: "classic", adipose: true, patScale: 1.1, patDensity: 1.1 },
  lumpfish: { depth: 1.18, hump: 0.1, belly: 1.12, snout: 0.12, tail: "round", dorsal: "low", pectoral: 1.12, pelvicDisc: true, patScale: 1.18 },
  pike: { depth: 0.72, snout: 0.88, snoutLen: 0.07, jaw: "up", tail: "emarg", dorsal: "low", dorsalH: 0.7, analH: 0.72, pectoral: 0.84, eye: 1.08 },
  whitefish: { depth: 0.9, snout: 0.52, tail: "fork", dorsal: "classic", adipose: true, eye: 1.05 },
  burbot: { depth: 0.92, snout: 0.16, jaw: "down", tail: "round", dorsal: "long", barbels: 1, lateral: false, eye: 1.08 },
  zander_baltic: { depth: 0.82, snout: 0.58, jaw: "up", tail: "emarg", dorsal: "double", dorsalH: 1.04, eye: 1.22, visibleTeeth: true },
  eel: { depth: 0.88, snout: 0.3, jaw: "terminal", tail: "pointed", dorsal: "long", pectoral: 0.72, eye: 0.92 },
  wels_skerry: { depth: 0.88, snout: 0.72, jaw: "up", tail: "fork", dorsal: "classic", adipose: true, eye: 1.22, visibleTeeth: true },
  grayling: { depth: 0.9, snout: 0.4, tail: "fork", dorsal: "sail", dorsalH: 1.55, adipose: true, patScale: 0.84 },
  atl_sturgeon: { depth: 0.94, snout: 0.88, snoutLen: 0.14, tail: "fork", dorsal: "low", barbels: 2, scutes: true, patScale: 1.18 },
  sea_eagle_trout: { depth: 0.94, snout: 0.48, tail: "emarg", dorsal: "classic", adipose: true, patScale: 1.22, patDensity: 1.18 },
  pike_legend: { depth: 0.74, snout: 0.92, snoutLen: 0.08, jaw: "up", tail: "emarg", dorsal: "low", dorsalH: 0.68, patScale: 1.32, patDensity: 0.72 },
  haddock: { depth: 0.94, snout: 0.22, tail: "truncate", dorsal: "triple", barbels: 1, lateral: true, patScale: 0.82, shoulderSpot: true },
  plaice: { depth: 0.92, snout: 0.2, tail: "round", pectoral: 0.78, patScale: 1.12, patDensity: 1.06 },
  capelin: { depth: 0.72, snout: 0.56, tail: "deepfork", dorsal: "low", adipose: true, eye: 1.18, patScale: 0.78 },
  blue_whiting: { depth: 0.82, snout: 0.3, tail: "truncate", dorsal: "triple", barbels: 0, eye: 1.14 },
  // Дополнительные диагностические признаки в поздних океанических и абиссальных зонах.
  pink_salmon: { depth: 1.02, hump: 0.14, belly: 1.05, tail: "emarg", adipose: true, dorsal: "classic", patScale: 1.12 },
  spotted_wolffish: { depth: 0.96, snout: 0.22, jaw: "down", tail: "round", dorsal: "long", lips: true, visibleTeeth: true, patDensity: 1.2 },
  arctic_skate: { depth: 1.05, tail: "pointed", pectoral: 1.3, patScale: 1.12, patDensity: 0.9 },
  leopard_shark: { depth: 1.08, snout: 0.66, tail: "pointed", dorsal: "double", dorsalH: 1.08, patScale: 1.15 },
  clownfish: { depth: 1.18, belly: 1.08, tail: "round", dorsal: "long", dorsalH: 1.12, pectoral: 1.08, patScale: 0.86 },
  surgeonfish: { depth: 1.2, belly: 1.04, tail: "lunate", dorsal: "long", analH: 1.14, snout: 0.52, ped: 0.05 },
  parrotfish: { depth: 1.18, snout: 0.48, jaw: "beak", lips: true, tail: "emarg", dorsal: "long", visibleTeeth: false },
  butterflyfish: { depth: 1.2, snout: 0.95, jaw: "terminal", tail: "truncate", dorsal: "long", analH: 1.35, eye: 1.1, patScale: 0.86, caudalOcellus: true },
  rabbitfish: { depth: 1.18, snout: 0.62, tail: "emarg", dorsal: "spiny", dorsalH: 1.18, eye: 1.08 },
  mudskipper: { depth: 1.1, hump: 0.12, snout: 0.14, tail: "round", dorsal: "long", pectoral: 1.5, eye: 1.55, pelvicDisc: true, lateral: false },
  mojarra: { depth: 1.08, snout: 0.86, jaw: "up", tail: "fork", dorsal: "spiny", pectoral: 0.92, eye: 1.08 },
  sheepshead: { depth: 1.24, hump: 0.05, snout: 0.2, tail: "fork", dorsal: "spiny", dorsalH: 1.1, visibleTeeth: true, lips: true },
  pufferfish: { depth: 1.18, belly: 1.08, snout: 0.2, tail: "round", dorsal: "low", pectoral: 1.08, eye: 1.18, patScale: 1.12, patDensity: 1.12 },
  archerfish: { depth: 1.18, snout: 0.82, jaw: "up", tail: "emarg", dorsal: "classic", dorsalH: 1.1, eye: 1.18 },
  red_drum: { depth: 0.98, hump: 0.03, belly: 1.02, tail: "truncate", dorsal: "double", caudalOcellus: true, lateral: true },
  sawfish: { depth: 1, snout: 0.9, tail: "pointed", dorsal: "classic", pectoral: 1.25, gills: 5 },
  flying_fish: { depth: 0.78, snout: 0.58, tail: "deepfork", dorsal: "low", pectoral: 1.55, pectoralWing: true, ped: 0.045 },
  mandarin: { depth: 1.06, snout: 0.28, tail: "round", dorsal: "double", dorsalH: 1.14, pectoral: 1.08, eye: 1.2, patScale: 1.3, patDensity: 1.18 },
  opah: { depth: 1.38, hump: 0.02, belly: 1.22, tail: "emarg", dorsal: "long", dorsalH: 1.2, analH: 1.2, pectoral: 1.2, eye: 1.08 },
  coelacanth: { depth: 1.15, snout: 0.28, tail: "round", dorsal: "double", dorsalH: 0.92, pectoral: 1.2, patScale: 1.25 },
  hatchetfish: { depth: 1.38, hump: 0.14, belly: 1.28, snout: 0.1, tail: "truncate", dorsal: "low", eye: 1.24, patScale: 0.7 },
  bristlemouth: { depth: 0.72, snout: 0.74, jaw: "up", tail: "fork", dorsal: "low", eye: 1.2, visibleTeeth: true },
  fangtooth: { depth: 1.08, snout: 0.08, jaw: "up", tail: "truncate", dorsal: "spiny", eye: 1.3, visibleTeeth: true },
  loosejaw: { depth: 0.7, snout: 0.72, jaw: "up", tail: "truncate", dorsal: "low", eye: 1.25, visibleTeeth: true },
  black_swallower: { depth: 0.92, belly: 1.2, snout: 0.1, jaw: "up", tail: "truncate", dorsal: "low", eye: 1.16, visibleTeeth: true },
  tripodfish: { depth: 0.7, snout: 0.42, tail: "pointed", dorsal: "low", pectoral: 1.32, eye: 1.25 },
  giant_squid: { depth: 1.16, eye: 1.5, patDensity: 1.1 },
  colossal_squid: { depth: 1.32, eye: 1.6, patDensity: 1.2 },
  barreleye: { depth: 0.9, snout: 0.12, tail: "truncate", dorsal: "low", eye: 1.55 },
  abyss_octopus: { depth: 1.05, eye: 1.45, pectoral: 1.2 },
  abyss_snail: { depth: 0.92, snout: 0.1, tail: "round", pectoral: 0.8, eye: 0.9 },
  marbled_rockcod: { depth: 1.1, snout: 0.28, tail: "truncate", dorsal: "spiny", dorsalH: 1.14, patScale: 1.15 },
  bald_notothen: { depth: 0.86, snout: 0.34, tail: "truncate", dorsal: "low", eye: 1.15, patDensity: 0.88 },
  emerald_rockcod: { depth: 1.02, snout: 0.28, tail: "truncate", dorsal: "spiny", pectoral: 1.12, eye: 1.12 },
  antarctic_skate: { depth: 1.05, tail: "pointed", pectoral: 1.32, patScale: 1.08 },
  crocodile_icefish: { depth: 0.82, snout: 0.76, jaw: "up", tail: "truncate", dorsal: "low", eye: 1.12 },
  spiny_plunderfish: { depth: 1.18, hump: 0.12, snout: 0.12, tail: "round", dorsal: "spiny", dorsalH: 1.2, pectoral: 1.15 },
  marbled_plunderfish: { depth: 1.24, hump: 0.12, snout: 0.08, jaw: "up", tail: "round", dorsal: "spiny", pectoral: 1.18, eye: 1.2, headCirri: true },
  toothfish: { depth: 1.08, snout: 0.44, tail: "truncate", dorsal: "double", pectoral: 1.12, eye: 1.14 },
  unicorn_icefish: { depth: 0.86, snout: 0.64, snoutLen: 0.05, tail: "truncate", dorsal: "low", eye: 1.15 },
  sleeper_shark: { depth: 1.08, snout: 0.56, tail: "pointed", dorsal: "low", dorsalH: 0.68, pectoral: 1.14 },
  southern_right_mola: { depth: 1.24, hump: 0.02, belly: 1.18, tail: "round", dorsal: "long", dorsalH: 1.12, analH: 1.12, pectoral: 1.14, eye: 1.05 },
  white_icefish_king: { depth: 1.16, snout: 0.42, tail: "truncate", dorsal: "double", pectoral: 1.12, eye: 1.18 },
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
    caudalOcellus: false,
    lateralOcellus: false,
    shoulderSpot: false,
    dorsalSpines: 8,
    finEdge: r() < 0.28 ? (f.colors.accent ?? null) : null,
    ped: rng(0.06, 0.12),
    patScale: rng(0.75, 1.35),
    patDensity: rng(0.7, 1.4),
    gills: 5,
    ratTail: false,
    thresher: false,
    hammer: false,
  };

  // Первые 50 сохраняют уже отточенную базу; остальные используют устойчивые архетипы.
  if (!FIRST_WAVE_IDS.has(f.id)) Object.assign(m, ARCHETYPE_BASELINES[f.shape]);

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
  if (inG(f, "Sebastes", "Scorpaena", "Pterois", "Scorpaenichthys", "Trachinus")) Object.assign(m, { dorsal: "spiny", dorsalH: inG(f, "Pterois") ? 2 : 1.2, dorsalSpines: inG(f, "Pterois") ? 13 : 10, eye: 1.3, jaw: "up", tail: "truncate" });
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
  if (inG(f, "Anarhichas", "Anarrhichthys", "Ophiodon")) Object.assign(m, { jaw: "down", lips: true, visibleTeeth: true });
  if (inG(f, "Gasterosteus")) Object.assign(m, { depth: 0.76, dorsal: "spiny", dorsalH: 1.15, dorsalSpines: 3, tail: "fork", scutes: true, lateral: false });
  if (inG(f, "Amphiprion")) Object.assign(m, { depth: 1.18, tail: "round", dorsal: "long", dorsalH: 1.1, analH: 1.08, pectoral: 1.08 });
  if (inG(f, "Siganus")) Object.assign(m, { depth: 1.16, snout: 0.62, tail: "emarg", dorsal: "spiny", dorsalH: 1.15 });
  if (inG(f, "Synchiropus")) Object.assign(m, { depth: 0.86, snout: 0.18, tail: "round", dorsal: "double", dorsalH: 1.15, eye: 1.25 });
  if (inG(f, "Eucinostomus")) Object.assign(m, { snout: 0.86, jaw: "up", dorsal: "spiny", tail: "fork" });
  if (inG(f, "Toxotes")) Object.assign(m, { snout: 0.82, jaw: "up", tail: "emarg", eye: 1.18 });
  if (inG(f, "Periophthalmus")) Object.assign(m, { depth: 1.1, eye: 1.55, pectoral: 1.5, tail: "round", dorsal: "long" });
  if (inG(f, "Girella")) Object.assign(m, { depth: 1.18, snout: 0.34, tail: "truncate", dorsal: "double" });
  if (inG(f, "Brama")) Object.assign(m, { depth: 1.3, snout: 0.2, tail: "emarg", dorsal: "long", analH: 1.1 });
  if (inG(f, "Hoplostethus")) Object.assign(m, { depth: 1.22, snout: 0.26, tail: "truncate", dorsal: "spiny", eye: 1.3 });
  if (inG(f, "Diodon")) Object.assign(m, { depth: 1.18, tail: "round", eye: 1.18, pectoral: 1.08, patScale: 1.12 });
  if (inG(f, "Ostracion")) Object.assign(m, { depth: 1.08, tail: "round", dorsal: "low", pectoral: 0.82, eye: 1.08, lateral: false });
  if (inG(f, "Exocoetus")) Object.assign(m, { depth: 0.78, pectoralWing: true, pectoral: 1.55, tail: "deepfork", dorsal: "low" });
  if (inG(f, "Argyropelecus")) Object.assign(m, { depth: 1.38, belly: 1.28, dorsal: "low", eye: 1.24 });
  if (inG(f, "Myctophum")) Object.assign(m, { depth: 0.8, eye: 1.25, adipose: true, dorsal: "low" });
  if (inG(f, "Anoplogaster", "Chiasmodon", "Malacosteus")) Object.assign(m, { jaw: "up", visibleTeeth: true, eye: 1.28 });
  if (inG(f, "Dissostichus")) Object.assign(m, { depth: 1.08, tail: "truncate", dorsal: "double", pectoral: 1.12 });
  if (inG(f, "Pogonophryne", "Harpagifer")) Object.assign(m, { depth: 1.2, hump: 0.12, dorsal: "spiny", pectoral: 1.15 });
  if (inG(f, "Harpagifer")) Object.assign(m, { snout: 0.18, jaw: "terminal", eye: 1.12 });
  if (inG(f, "Pogonophryne")) Object.assign(m, { snout: 0.08, jaw: "up", headCirri: true, eye: 1.2 });
  if (inG(f, "Linophryne")) Object.assign(m, { jaw: "up", headCirri: true });
  if (inG(f, "Lampris")) Object.assign(m, { depth: 1.38, tail: "emarg", dorsal: "long", analH: 1.2, pectoral: 1.2 });

  // Камбалы: видовая длина корпуса берётся из общего профиля и уточняется таксономией.
  if (f.shape === "flat") Object.assign(m, { lateral: false, dorsal: "long", tail: "round", pectoral: 0.82 });
  if (inG(f, "Solea", "Microstomus")) Object.assign(m, { depth: 0.92, snout: 0.12, jaw: "down", patDensity: 0.86 });
  if (inG(f, "Hippoglossus")) Object.assign(m, { depth: 0.96, snout: 0.5, tail: "emarg", dorsal: "long", pectoral: 0.9 });
  if (inG(f, "Reinhardtius")) Object.assign(m, { depth: 0.86, snout: 0.42, tail: "emarg", lateral: true });
  if (inG(f, "Scophthalmus")) Object.assign(m, { depth: 1.06, snout: 0.28, tail: "round", patScale: 1.12, patDensity: 1.15 });
  if (inG(f, "Pleuronectes", "Platichthys", "Liopsetta", "Paralichthys", "Amblyraja", "Bathyraja", "Leucoraja", "Raja")) Object.assign(m, { depth: 1.02, tail: "round", patScale: 1.08 });

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
