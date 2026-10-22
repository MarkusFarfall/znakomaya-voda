"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { DEFAULT_SETTINGS, normalizeSettings, type Settings } from "@/game/settings";
import { GameAudio } from "@/game/audio";
import { depthToU, Engine, newSave, uToDepth, type TravelMode, type Trip } from "@/game/engine";
import { FISH } from "@/game/fish";
import { FIGHT_PANEL_HEIGHT } from "@/game/fishing";
import { clearLocal, deleteRemote, fetchMe, flushCatches, forgetRememberedAccount, loadLocal, loadRemote, loadRememberedAccount, logCatch, logout as apiLogout, pickNewest, rememberAccount, saveLocal, saveRemote, syncFriendPresence, type AccountUser } from "@/game/persist";
import { RecoveryScreen, rememberFailure } from "./Recovery";
import { AccountBadge, ProfileModal, type AccountState } from "./Account";
import { AuthScreen } from "./AuthScreen";
import { MILESTONES } from "@/game/world";
import { CAM_MODES, Scene, type CamMode } from "@/game/render/scene";
import { PortScene, type Building } from "@/game/render/port";
import { installCanvasGuards, setFonts } from "@/game/render/util";
import type { BaitId, SaveData } from "@/game/types";
import { BAITS, PORT_BY_ID, SEASONS, WEATHER_INFO, spotsOf } from "@/game/world";
import { BaitIcon, Icon, MoonIcon } from "./Icons";
import { EventFeed } from "./EventFeed";
import { DailyTracker, QuestTracker, XpBar } from "./JournalTrackers";
import type { PortTab } from "./Panels";
import { setBoat3dPref } from "@/game/render/boats3d/boat3d";
import { ensureSprite } from "@/game/render/boats/sprites";
import type { FriendsState } from "./friendsHook";
import { useFriends } from "./friendsHook";
import { MobileFishing } from "./MobileFishing";
import { LocalNavigationPanel } from "./LocalNavigation";
import { PortHub } from "./PortHub";

const LazyLoading = () => <div className="zv-ui absolute inset-0 z-[70] flex items-center justify-center bg-[#02050a]/35" aria-busy="true"><span className="label">Открываем…</span></div>;
const CatchModal = dynamic(() => import("./Panels").then((mod) => mod.CatchModal), { ssr: false, loading: LazyLoading });
const PortModal = dynamic(() => import("./Panels").then((mod) => mod.PortModal), { ssr: false, loading: LazyLoading });
const FindModal = dynamic(() => import("./Journal").then((mod) => mod.FindModal), { ssr: false, loading: LazyLoading });
const JournalModal = dynamic(() => import("./Journal").then((mod) => mod.JournalModal), { ssr: false, loading: LazyLoading });
const LetterModal = dynamic(() => import("./Journal").then((mod) => mod.LetterModal), { ssr: false, loading: LazyLoading });
const SettingsModal = dynamic(() => import("./SettingsModal").then((mod) => mod.SettingsModal), { ssr: false, loading: LazyLoading });
const CoolerModal = dynamic(() => import("./CoolerModal").then((mod) => mod.CoolerModal), { ssr: false, loading: LazyLoading });
const Codex = dynamic(() => import("./Codex").then((mod) => mod.Codex), { ssr: false, loading: LazyLoading });
const TravelChoice = dynamic(() => import("./Travel").then((mod) => mod.TravelChoice), { ssr: false, loading: LazyLoading });
const TravelOverlay = dynamic(() => import("./Travel").then((mod) => mod.TravelOverlay), { ssr: false, loading: LazyLoading });
const RestTransition = dynamic(() => import("./RestTransition").then((mod) => mod.RestTransition), { ssr: false, loading: LazyLoading });
const FriendsModal = dynamic(() => import("./Friends").then((mod) => mod.FriendsModal), { ssr: false, loading: LazyLoading });

const CAM_NAMES: Record<CamMode, string> = { auto: "авто", surface: "поверхность", hook: "за снастью", bottom: "дно" };
const fmt = (n: number) => Math.round(n).toLocaleString("ru-RU");
const SETTINGS_KEY = "zv_settings";


type Boot = { state: "loading" } | { state: "auth" } | { state: "title"; save: SaveData | null };

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [safeStart, setSafeStart] = useState(false);
  const [engine0] = useState(() => new Engine());
  const engineRef = useRef<Engine>(engine0);
  const [scene0] = useState(() => new Scene());
  const sceneRef = useRef<Scene>(scene0);
  const [portScene0] = useState(() => new PortScene());
  const portSceneRef = useRef<PortScene>(portScene0);
  const [audio0] = useState(() => new GameAudio());
  const audioRef = useRef<GameAudio>(audio0);
  const pidRef = useRef<string>("");
  const presenceSessionRef = useRef<{ playerId: string; sessionId: string } | null>(null);
  const [boot, setBoot] = useState<Boot>({ state: "loading" });
  const [playing, setPlaying] = useState(false);
  const [starting, setStarting] = useState(false);
  const startGuard = useRef(false);
  const [resting, setResting] = useState(false);
  const [panel, setPanel] = useState<null | "codex" | "port" | "journal" | "friends" | "cooler">(null);
  const [letter, setLetter] = useState<number | null>(null);
  const [tripReq, setTripReq] = useState<Trip | null>(null);
  const [travelling, setTravelling] = useState<{ trip: Trip; mode: TravelMode } | null>(null);
  const [portTab, setPortTab] = useState<PortTab>("market");
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS);
  const [touch, setTouch] = useState(false);
  const [view, setView] = useState({ compact: false, land: true });
  const [info, setInfo] = useState(false);
  const [account, setAccount] = useState<AccountState>({ user: null, stats: null, offline: false });
  const [authOpen, setAuthOpen] = useState<null | "profile">(null);
  const [camMode, setCamModeState] = useState<CamMode>("auto");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [cloud, setCloud] = useState<string>("проверка…");
  /** Друзья: список, заявки и значок на кнопке. Работает и до начала игры. */
  const friends = useFriends(account.user?.id ?? null);
  const accountUserId = account.user?.id;
  const [, force] = useReducer((x: number) => x + 1, 0);
  const [name, setName] = useState("");
  const lastRemote = useRef(0);
  const remoteDirty = useRef(false);
  /** Сбои звука и рендера: кадр обязан выжить, иначе игра замирает навсегда. */
  const audioFails = useRef(0);
  const frameFails = useRef(0);

  const engine = engine0;
  const audio = audio0;
  useEffect(() => {
    // Отладочные хуки — только в разработке. В проде `window.__zv` позволял править сохранение из консоли
    // и отправлять его на сервер — с ним рейтинг начинался с правки localStorage.
    if (process.env.NODE_ENV !== "production") {
      const w = window as unknown as { __zv?: Engine; __zvAudio?: typeof GameAudio; __zvSound?: () => unknown };
      w.__zv = engine;
      w.__zvAudio = GameAudio;
      // Срез состояния звука — для поддержки и автотестов.
      w.__zvSound = () => ({ ...audioRef.current.debug(), audioFails: audioFails.current, frameFails: frameFails.current, streamedRegions: sceneRef.current.streamedRegions });
    }
    const vis = () => {
      const hidden = document.visibilityState === "hidden";
      audioRef.current.setHidden(hidden);
      if (hidden) engine.cancelInput();
    };
    const cancelInput = () => engine.cancelInput();
    window.addEventListener("blur", cancelInput);
    // Связь вернулась — досылаем уловы, пойманные офлайн.
    const onOnline = () => { if (pidRef.current) void flushCatches(pidRef.current); };
    document.addEventListener("visibilitychange", vis);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", vis);
      window.removeEventListener("blur", cancelInput);
      window.removeEventListener("online", onOnline);
    };
  }, [engine]);

  /** Лучшее из локального и серверного сохранения профиля */
  const loadBest = useCallback(async (pid: string) => {
    const local = loadLocal(pid);
    const remote = await loadRemote(pid);
    setCloud(remote === undefined ? "только на устройстве" : "сервер и устройство");
    if (!local && remote === undefined) throw new Error("Не удалось проверить серверное сохранение. Повторите запуск при наличии связи.");
    const best = pickNewest(local, remote);
    // Apply before writing: a failed migration must never replace the original.
    engineRef.current.s = best ?? newSave();
    if (best) saveLocal(pid, best);
    engineRef.current.phase = "idle";
    return best;
  }, []);

  // Настройки и данные устройства доступны только в браузере, поэтому читаются при монтировании
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    installCanvasGuards();
    const cs = getComputedStyle(document.documentElement);
    setFonts(cs.getPropertyValue("--font-text").trim(), cs.getPropertyValue("--font-display").trim());
    try {
      const cm = localStorage.getItem("zv_cam") as CamMode | null;
      if (cm && CAM_MODES.includes(cm)) { sceneRef.current.camMode = cm; setCamModeState(cm); }
    } catch { /* ignore */ }
    let st = DEFAULT_SETTINGS;
    try {
      const a = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null") as Partial<Settings> | null;
      if (a) st = normalizeSettings(a);
      else if ((navigator.hardwareConcurrency ?? 8) <= 4 || window.matchMedia("(pointer: coarse)").matches) st = { ...st, quality: 1 };
    } catch { /* ignore */ }
    const safeQuery = new URLSearchParams(window.location.search).get("safe") === "1";
    let safe = safeQuery;
    try { safe ||= localStorage.getItem("zv_safe_start") === "1"; } catch { /* query still works */ }
    if (safe) st = { ...st, quality: 0, model3d: false, sound: false, music: false, gfx: { refl: false, shafts: false, caustics: false, foam: true, precip: false } };
    setSafeStart(safe);
    setSettingsState(st);
    audioRef.current.enabled = st.sound;
    audioRef.current.music = st.music;
    audioRef.current.volume = st.volume;
    audioRef.current.setQuality(st.quality);
    setTouch(window.matchMedia("(pointer: coarse)").matches);
    const onResize = () => setView({ compact: window.innerWidth < 820 || window.innerHeight < 560, land: window.innerWidth >= window.innerHeight });
    onResize();
    window.addEventListener("resize", onResize);
    (async () => {
      const me = await fetchMe();
      // Если сеть или база недоступны, можно продолжить сохранённую на этом устройстве игру.
      // Локальный маркер содержит только имя и id профиля — не пароль и не токен сессии.
      if ("offline" in me) {
        const remembered = loadRememberedAccount();
        const local = remembered ? loadLocal(remembered.playerId) : null;
        if (remembered && local) {
          pidRef.current = remembered.playerId;
          engineRef.current.s = local;
          setAccount({ user: remembered.user, stats: null, offline: true });
          setCloud("только на устройстве");
          setName(local.name || remembered.user.username);
          setBoot({ state: "title", save: local });
          return;
        }
        setAccount((a) => ({ ...a, offline: true }));
        engineRef.current.s = newSave();
        setBoot({ state: "auth" });
        return;
      }
      if (!me.user || !me.playerId) {
        forgetRememberedAccount();
        engineRef.current.s = newSave();
        setBoot({ state: "auth" });
        return;
      }
      pidRef.current = me.playerId;
      rememberAccount(me.playerId, me.user);
      // Уловы, пойманные без связи, уходят на сервер при первой возможности.
      void flushCatches(me.playerId);
      setAccount({ user: me.user, stats: me.stats, offline: false });
      const best = await loadBest(me.playerId);
      setName(best?.name ?? me.user.username);
      setBoot({ state: "title", save: best });
    })().catch(error => setStartupError(rememberFailure(error)));
    return () => window.removeEventListener("resize", onResize);
  }, [loadBest]);
  /* eslint-enable react-hooks/set-state-in-effect */


  const unlockAudio = useCallback(() => audioRef.current.init(), []);

  const setSettings = useCallback((value: Settings) => {
    const st = normalizeSettings(value);
    setSettingsState(st);
    audioRef.current.setEnabled(st.sound);
    audioRef.current.setMusic(st.music);
    audioRef.current.setVolume(st.volume);
    audioRef.current.setQuality(st.quality);
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(st)); } catch { /* Preferences still apply when browser storage is unavailable. */ }
  }, []);

  useEffect(() => {
    sceneRef.current.zoom = settings.zoom;
    sceneRef.current.gfx = { ...settings.gfx };
    sceneRef.current.boat3dOn = settings.model3d;
    portSceneRef.current.boat3dOn = settings.model3d;
    portSceneRef.current.precipEnabled = settings.gfx.precip;
    portSceneRef.current.reflectionsEnabled = settings.gfx.refl;
    portSceneRef.current.quality = settings.quality;
    setBoat3dPref(settings.model3d);
  }, [settings.zoom, settings.gfx, settings.model3d, settings.quality]);

  // Один обработчик: колесо — глубина, Shift + колесо — камера. Не оба сразу.
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const onWheel = (e: WheelEvent) => {
      if (!playing || engineRef.current.paused || e.ctrlKey || e.deltaY === 0) return;
      e.preventDefault();
      if (e.shiftKey) {
        const z = Math.min(2, Math.max(1, Math.round((settings.zoom - e.deltaY * 0.0012) * 20) / 20));
        if (z !== settings.zoom) setSettings({ ...settings, zoom: z });
      } else {
        const engine = engineRef.current;
        engine.setDepth(uToDepth(depthToU(engine.s.targetDepth) + (e.deltaY > 0 ? 0.06 : -0.06)));
      }
    };
    cv.addEventListener("wheel", onWheel, { passive: false });
    return () => cv.removeEventListener("wheel", onWheel);
  }, [settings, playing, panel, setSettings]);

  const persist = useCallback(async (remote: boolean) => {
    const e = engineRef.current;
    const pid = pidRef.current;
    saveLocal(pid, e.s);
    if (!remote || !pid) return;
    const r = await saveRemote(pid, e.s);
    if (r.ok) {
      setCloud("сервер и устройство");
      setAccount((a) => a.offline ? { ...a, offline: false } : a);
      remoteDirty.current = false;
    } else if (r.conflict) {
      // на сервере более свежий прогресс (другое устройство)
      const keep = confirm("На сервере найден более поздний прогресс с другого устройства.\n\nОК — загрузить прогресс с сервера.\nОтмена — перезаписать сервер текущим.");
      if (keep) {
        e.s = r.conflict;
        e.phase = "idle";
        saveLocal(pid, e.s);
        e.toast("Загружен прогресс с сервера", "info");
      } else {
        await saveRemote(pid, e.s, true);
      }
      remoteDirty.current = false;
    } else if (r.unauthorized) {
      setCloud("требуется вход");
    } else setCloud("только на устройстве");
  }, []);

  const refreshMe = useCallback(async () => {
    const me = await fetchMe();
    if ("offline" in me) return;
    setAccount({ user: me.user, stats: me.stats, offline: false });
  }, []);

  const onAuthed = useCallback(async (user: AccountUser, playerId: string, mode: "login" | "register") => {
    const e = engineRef.current;
    setAuthOpen(null);
    setAccount({ user, stats: null, offline: false });
    pidRef.current = playerId;
    rememberAccount(playerId, user);
    void flushCatches(playerId);
    try {
    if (mode === "register") {
      // новая учётная запись: имя рыбака берём из имени пользователя, если своё ещё не задано
      if (!e.s.name || e.s.name === "Рыбак") e.s.name = user.username;
      saveLocal(playerId, e.s);
      await saveRemote(playerId, e.s, true);
      setBoot({ state: "title", save: e.s });
      e.toast("Учётная запись создана", "good", "Прогресс сохраняется на сервере");
    } else {
      const best = await loadBest(playerId);
      if (!best) {
        e.s = newSave(user.username);
        saveLocal(playerId, e.s);
        await saveRemote(playerId, e.s, true);
      }
      setBoot({ state: "title", save: best ?? e.s });
      e.toast(`С возвращением, ${user.username}`, "good");
    }
    setName(e.s.name);
    void refreshMe();
    } catch (error) { setStartupError(rememberFailure(error)); }
  }, [loadBest, refreshMe]);

  /** Выход: сохраняем прогресс на сервер и возвращаемся на экран входа. */
  const onLogout = useCallback(async () => {
    await persist(true);
    const live = presenceSessionRef.current;
    if (live) await syncFriendPresence(live.playerId, live.sessionId, null);
    await apiLogout();
    forgetRememberedAccount();
    setAccount({ user: null, stats: null, offline: false });
    setAuthOpen(null);
    pidRef.current = "";
    engineRef.current.s = newSave();
    engineRef.current.phase = "idle";
    setBoot({ state: "auth" });
    setPlaying(false);
    setResting(false);
    setPanel(null);
    setTravelling(null);
    setTripReq(null);
    setLetter(null);
  }, [persist]);

  const onDeleted = useCallback(async () => {
    clearLocal(pidRef.current);
    forgetRememberedAccount();
    setAccount({ user: null, stats: null, offline: false });
    setAuthOpen(null);
    pidRef.current = "";
    engineRef.current.s = newSave();
    engineRef.current.phase = "idle";
    setBoot({ state: "auth" });
    setPlaying(false);
    setResting(false);
    setPanel(null);
  }, []);

  const setCamMode = useCallback((m: CamMode) => {
    sceneRef.current.camMode = m;
    setCamModeState(m);
    try { localStorage.setItem("zv_cam", m); } catch { /* ignore */ }
  }, []);
  const cycleCam = useCallback(() => {
    const i = CAM_MODES.indexOf(sceneRef.current.camMode);
    const m = CAM_MODES[(i + 1) % CAM_MODES.length];
    setCamMode(m);
    engineRef.current.toast(`Камера: ${CAM_NAMES[m]}`, "info");
  }, [setCamMode]);

  useEffect(() => {
    const unsub = engine.subscribe(force);
    engineRef.current.onCatchLogged = (c) => { if (pidRef.current) logCatch(pidRef.current, c); };
    const iv = setInterval(() => {
      force();
      if (playing) engine.refreshDaily();
      if (engine.dirty && playing) {
        engine.dirty = false;
        remoteDirty.current = true;
        saveLocal(pidRef.current, engine.s);
      }
      if (playing && remoteDirty.current && Date.now() - lastRemote.current > 25000) {
        lastRemote.current = Date.now();
        persist(true);
      }
    }, 1000);
    const onHide = () => { if (playing && document.visibilityState !== "visible") { saveLocal(pidRef.current, engine.s); if (pidRef.current) void saveRemote(pidRef.current, engine.s); } };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      unsub();
      clearInterval(iv);
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [engine, playing, persist]);

  const mobileControls=touch||view.compact;
  const buttonFishing=mobileControls&&settings.controls.fishing==='buttons';
  useEffect(()=>{sceneRef.current.mobileButtons=buttonFishing;engineRef.current.cancelInput();},[buttonFishing,settings.controls.sailing]);

  /** Короткий heartbeat не трогает saves; остановка/порт/скрытая вкладка освобождают live-сеанс. */
  useEffect(() => {
    const playerId = pidRef.current;
    if (!playing || !accountUserId || account.offline || !playerId) {
      sceneRef.current.setFriendPresence([]);
      return;
    }
    const sessionId = typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `zv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
    const session = { playerId, sessionId };
    presenceSessionRef.current = session;
    let closed = false;
    let requestPending = false;
    let leaseActive = false;
    let releasePending = false;

    const canPublish = () => !closed
      && friends.data?.hideLocation !== true
      && !travelling
      && document.visibilityState === "visible"
      && !engineRef.current.s.atPort;

    const sendStop = () => {
      if (requestPending) { releasePending = true; return; }
      if (!leaseActive && !releasePending) return;
      leaseActive = false;
      releasePending = false;
      requestPending = true;
      void syncFriendPresence(playerId, sessionId, null).finally(() => {
        requestPending = false;
        releasePending = false;
      });
    };

    const release = () => {
      sceneRef.current.setFriendPresence([]);
      if (!leaseActive && !requestPending) return;
      leaseActive = false;
      releasePending = true;
      if (requestPending) return;
      sendStop();
    };

    const publish = async () => {
      if (!canPublish()) { release(); return; }
      if (requestPending) return;
      const current = engineRef.current;
      const position = {
        location: current.s.location,
        x: current.navigation.nx,
        heading: current.navigation.heading,
        velocity: current.navigation.velocity / current.navigation.worldWidth,
        boat: current.s.boat,
        activity: current.navigation.moving ? "sailing" as const : current.phase !== "idle" ? "fishing" as const : "drifting" as const,
      };
      requestPending = true;
      leaseActive = true;
      let response: Awaited<ReturnType<typeof syncFriendPresence>> = null;
      try { response = await syncFriendPresence(playerId, sessionId, position); }
      catch { /* повторим по таймеру; локальный снимок истечёт по TTL */ }
      requestPending = false;
      if (releasePending || !canPublish()) {
        leaseActive = false;
        releasePending = true;
        sendStop();
        return;
      }
      if (response) sceneRef.current.setFriendPresence(response.friends, response.serverNow);
    };

    const onVisibility = () => { if (document.visibilityState === "visible") void publish(); else release(); };
    const onPageHide = () => release();
    const timer = window.setInterval(() => { void publish(); }, 2_000);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onVisibility);
    void publish();

    return () => {
      closed = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onVisibility);
      release();
      if (presenceSessionRef.current?.sessionId === sessionId) presenceSessionRef.current = null;
    };
  }, [playing, accountUserId, account.offline, friends.data?.hideLocation, travelling]);

  const quality = settings.quality;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf: number | null = null;
    let loop: ((now: number) => void) | null = null;
    const schedule = () => { if (raf === null && loop) raf = requestAnimationFrame(loop); };
    let last = performance.now();
    let clearedWhileAuth = false;
    let W = 0, H = 0;
    // Титул показывает последнюю позицию игрока: декоративная копия сохранения,
    // отдельный движок в паузе. Иначе за списком «Продолжить» был синий градиент.
    // Титульный фон зависит только от сохранения, но пересобирать цикл на
    // каждое изменение ссылки не нужно: boot.state меняется вместе с ним.
    const previewSave = boot.state === "title" && !playing && !travelling ? boot.save : null;
    let title: Engine | null = null;
    if (previewSave) {
      try {
        const snap = JSON.parse(JSON.stringify(previewSave)) as SaveData;
        snap.atPort = false;
        snap.events = [];
        title = new Engine(snap);
        title.paused = true;
        title.phase = "idle";
      } catch { title = null; }
    }
    let titleAcc = 0;
    let titleInterval = 1 / 15;
    sceneRef.current.quality = quality;
    const resize = () => {
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      // Ограничиваем число физических пикселей. На 4K-дисплее DPR=2 даёт
      // больше восьми миллионов пикселей на каждый кадр — для морской сцены
      // это заметно дороже, чем небольшой выигрыш в резкости.
      const requested = quality >= 2 ? Math.min(2, window.devicePixelRatio || 1) : quality === 1 ? Math.min(1.5, window.devicePixelRatio || 1) : 1;
      const budget = quality >= 2 ? 2_600_000 : quality === 1 ? 1_650_000 : 950_000;
      const dpr = Math.max(0.75, Math.min(requested, Math.sqrt(budget / Math.max(1, W * H))));
      canvas.width = Math.max(1, Math.floor(W * dpr));
      canvas.height = Math.max(1, Math.floor(H * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      clearedWhileAuth = false;
      schedule();
    };
    resize();
    window.addEventListener("resize", resize);
    loop = (now: number) => {
      raf = null;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const e = engineRef.current;
      const a = audioRef.current;
      const scene = sceneRef.current;

      // Пока открыт экран входа, большой canvas с игрой не нужен: его заменяет
      // лёгкая SVG-сцена авторизации. Статичный титульный/переходный фон рисуется
      // один раз; повторный кадр нужен только после resize или смены состояния.
      if (!playing || travelling || startupError) {
        if (title && W > 0 && H > 0) {
          // Живой, но спокойный фон: ~15 кадров/с и медленный ход мира.
          titleAcc += dt;
          if (titleAcc >= titleInterval) {
            const step = Math.min(0.25, titleAcc) * 0.55;
            titleAcc = 0;
            const t0 = performance.now();
            try {
              title.update(step);
              scene.render(ctx, title, W, H, step);
              clearedWhileAuth = false;
            } catch (err) {
              console.warn("[title] фон недоступен", err);
              title = null;
            }
            // Слабые устройства получают более редкий кадр, а не рывки.
            const cost = performance.now() - t0;
            titleInterval = cost > 26 ? 1 / 7 : cost > 14 ? 1 / 11 : 1 / 15;
          }
          e.sfx.length = 0;
          schedule();
          return;
        }
        if (!clearedWhileAuth) {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.fillStyle = "#07151f";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          const glow = ctx.createRadialGradient(canvas.width * .75, canvas.height * .15, 0, canvas.width * .5, canvas.height * .3, Math.max(canvas.width, canvas.height));
          glow.addColorStop(0, "#183746"); glow.addColorStop(1, "#050a12");
          ctx.fillStyle = glow; ctx.fillRect(0, 0, canvas.width, canvas.height);
          clearedWhileAuth = true;
        }
        e.sfx.length = 0;
        return;
      }
      if (clearedWhileAuth) { resize(); clearedWhileAuth = false; }
      // Engine and renderer share the guard; either used to be able to kill RAF.

      // Размер canvas может оказаться нулевым (окно свёрнуто, элемент ещё не разложен).
      // Рисовать в этом случае нечего, но цикл обязан выжить.
      if (W > 0 && H > 0) {
        // Исключение в кадре раньше обрывало requestAnimationFrame навсегда:
        // игра замирала, а звук пропадал до перезагрузки страницы.
        try {
          e.update(dt);
          if (e.s.atPort) portSceneRef.current.render(ctx, e, W, H, dt);
          else scene.render(ctx, e, W, H, dt);
          frameFails.current = 0;
        } catch (err) {
          if (++frameFails.current <= 3) console.warn("[render] кадр пропущен", err);
          if (frameFails.current === 3) { setPlaying(false); setStartupError(rememberFailure(err)); }
        }
        // Во время заставки музыка и процедурная среда не должны продолжать
        // генерировать звук за кадром. SFX сбрасываются только в активной игре.
        if (playing && a.ready) {
          try {
            while (e.lightningEvents.length) {
              const strike = e.lightningEvents.shift()!;
              a.thunder(strike.dist, strike.power);
            }
            while (e.sfx.length) a.play(e.sfx.shift()!);
            const under = Math.max(0, Math.min(1, (scene.camY - H * 0.05) / (H * 0.35)));
            a.update(e, dt, under);
          } catch (err) {
            audioFails.current++;
            if (audioFails.current === 1) console.warn("[audio] сбой звука, кадр продолжается", err);
            if (audioFails.current === 30) { a.setEnabled(false); console.warn("[audio] звук отключён после 30 сбоев"); }
            e.sfx.length = 0;
            e.lightningEvents.length = 0;
          }
        } else {
          e.sfx.length = 0;
          e.lightningEvents.length = 0;
        }
      } else {
        e.sfx.length = 0;
        e.lightningEvents.length = 0;
      }
      schedule();
    };
    schedule();
    return () => { if (raf !== null) cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quality, playing, boot.state, travelling, startupError]);

  useEffect(() => {
    engineRef.current.paused = !playing || panel !== null || settingsOpen || letter !== null || authOpen !== null || boot.state === "auth" || engine.s.atPort || !!travelling || !!tripReq;
    if (engineRef.current.paused) engineRef.current.cancelInput();
    audioRef.current.setActive(playing);
    audioRef.current.setUiActive(boot.state !== "loading");
    audioRef.current.setMuffled(playing && (panel !== null || settingsOpen || letter !== null || authOpen !== null));
  }, [engine, playing, panel, settingsOpen, letter, authOpen, travelling, tripReq, engine.s.atPort, boot.state]);

  const openPanel = useCallback((p: "codex" | "journal" | "friends" | "cooler") => {
    audioRef.current.ui("open");
    setPanel((cur) => (cur === p ? null : cur === "port" ? cur : p));
  }, []);
  const closePanel = useCallback(() => { audioRef.current.ui("close"); setPanel(null); }, []);
  const openPort = useCallback(() => {
    if (engine.s.atPort) return;
    if (engine.navigation.moving) { engine.toast("Сначала остановите лодку", "info"); return; }
    if (engine.phase === "fight" || engine.phase === "bite" || engine.phase === "caught") { engine.toast("Сначала закончите с рыбой", "bad"); return; }
    audioRef.current.ui("open");
    setTripReq({ kind: "port", port: engine.nearestPort() });
  }, [engine]);
  const requestTrip = useCallback((t: Trip) => { audioRef.current.ui("click"); setPanel(null); setTripReq(t); }, []);
  const startTrip = useCallback((mode: TravelMode) => {
    if (!tripReq) return;
    audioRef.current.play("travel");
    setTravelling({ trip: tripReq, mode });
    setTripReq(null);
  }, [tripReq]);
  const finishTrip = useCallback(() => {
    if (!travelling) return;
    engine.travel(travelling.trip, travelling.mode);
    setTravelling(null);
    void persist(true);
  }, [engine, travelling, persist]);
  const openBuilding = useCallback((b: Building | "dock" | "map" | "orders") => {
    audioRef.current.ui("open");
    const tab: PortTab = b === "market" ? "market" : b === "shop" ? "gear" : b === "shipyard" ? "boats" : b === "tavern" ? "rest" : b === "orders" ? "orders" : "map";
    setPortTab(tab);
    setPanel("port");
  }, []);
  const openLetter = useCallback(() => {
    if (engine.s.quest >= 20) { openPanel("journal"); return; }
    audioRef.current.ui("paper");
    engineRef.current.hasLetter = false;
    setLetter(engine.s.quest);
  }, [engine, openPanel]);

  useEffect(() => {
    if (!playing) return;
    const down = (ev: KeyboardEvent) => {
      const tgt = ev.target as HTMLElement | null;
      if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA")) {
        if (ev.code !== "Escape") return;
        tgt.blur();
      }
      if (tgt?.closest("[data-game-dialog]")) return;
      if (tgt?.closest("button") && (ev.code === "Space" || ev.code === "Enter")) return;
      unlockAudio();
      if (travelling) return;
      if (ev.code === "Space") { ev.preventDefault(); if (!ev.repeat && !panel && !letter && !engine.lastCatch && !engine.lastFind && !engine.s.atPort && !tripReq) { if (engine.navigationMode) engine.stopNavigation(); else engine.pointerDown(); } }
      else if (ev.code === "KeyN" && !panel && !letter && !settingsOpen && !tripReq && !authOpen && !engine.paused) engine.setNavigationMode(!engine.navigationMode);
      else if (ev.code === "KeyC") openPanel("codex");
      else if (ev.code === "KeyJ") openPanel("journal");
      else if (ev.code === "KeyF") openPanel("friends");
      else if (ev.code === "KeyP" && !panel) openPort();
      else if (ev.code === "KeyV" && !panel) cycleCam();
      else if (ev.code === "KeyM") setSettings({ ...settings, sound: !settings.sound });
      else if (ev.code === "Escape") { if (authOpen) setAuthOpen(null); else if (tripReq) setTripReq(null); else if (panel) closePanel(); else if (engine.navigationMode) { if (engine.navigation.moving) engine.stopNavigation(); else engine.setNavigationMode(false); } setLetter(null); }
      else if ((ev.code === "ArrowUp" || ev.code === "KeyW") && !panel) engine.setDepth(uToDepth(depthToU(engine.s.targetDepth) - 0.08));
      else if ((ev.code === "ArrowDown" || ev.code === "KeyS") && !panel) engine.setDepth(uToDepth(depthToU(engine.s.targetDepth) + 0.08));
      else if (/^Digit[0-9]$/.test(ev.code) && !panel) {
        const n = Number(ev.code.slice(5));
        const b = BAITS[n === 0 ? 9 : n - 1];
        if (b) engine.setBait(b.id);
      }
      else if ((ev.code === "ArrowLeft" || ev.code === "KeyA") && !engine.paused) { ev.preventDefault(); if(engine.navigationMode)engine.steerNavigation(-1);else{engine.keyDir=-1;engine.pullDir=-1;} }
      else if ((ev.code === "ArrowRight" || ev.code === "KeyD") && !engine.paused) { ev.preventDefault(); if(engine.navigationMode)engine.steerNavigation(1);else{engine.keyDir=1;engine.pullDir=1;} }
    };
    const up = (ev: KeyboardEvent) => {
      if (ev.code === "Space") engine.pointerUp();
      if (["ArrowLeft", "KeyA", "ArrowRight", "KeyD"].includes(ev.code)) { const dir=ev.code==="ArrowLeft"||ev.code==="KeyA"?-1:1;if(engine.navigation.manual===dir)engine.steerNavigation(0);engine.keyDir=0;engine.pullDir=0; }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [playing, panel, letter, engine, openPort, openPanel, closePanel, unlockAudio, settings, setSettings, cycleCam, travelling, tripReq, authOpen, settingsOpen]);

  const start = async (fresh: boolean) => {
    if (startGuard.current) return;
    startGuard.current = true;
    setStarting(true);
    try {
      // Keep the first game frame gesture-unlocked, then prepare only the boat the player will see.
      unlockAudio();
      audioRef.current.setActive(true);
      audio.ui("confirm");
      const e = engineRef.current;
      if (fresh) {
        e.s = newSave(name.trim() || "Рыбак");
        e.phase = "idle";
      } else if (name.trim()) e.s.name = name.trim();
      await ensureSprite(e.boat.style);
      if (fresh) {
        setTimeout(() => setLetter(0), 1400);
        setTimeout(() => e.tip("tip_cast", "Удерживайте левую кнопку мыши или пробел, чтобы набрать силу заброса. Отпустите — снасть уйдёт в воду."), 5000);
      }
      e.fade = 1.4;
      e.dirty = true;
      e.checkProgress();
      e.refreshDaily();
      setPlaying(true);
      setTimeout(() => persist(true), 500);
    } finally {
      startGuard.current = false;
      setStarting(false);
    }
  };

  const reset = async () => {
    clearLocal(pidRef.current);
    await deleteRemote(pidRef.current);
    engineRef.current.s = newSave();
    engineRef.current.phase = "idle";
    setPanel(null);
    setPlaying(false);
    setResting(false);
    setBoot({ state: "title", save: null });
  };

  const startRest = useCallback(() => {
    if (resting || engine.restBlock) return;
    audioRef.current.init();
    audioRef.current.play("rest");
    setResting(true);
  }, [engine, resting]);
  const finishRest = useCallback(() => {
    const rested = engine.restUntilDawn();
    setResting(false);
    if (rested) void persist(true);
  }, [engine, persist]);

  const s = engine.s;
  const maxD = engine.maxDepth;
  const cands = playing ? engine.candidates(Math.min(s.targetDepth, maxD)) : [];
  const newCands = cands.filter((c) => !s.codex[c.fish.id]).length;
  const found = Object.keys(s.codex).length;
  const rank = [...MILESTONES].reverse().find((m) => found >= m.count)?.title ?? "Новичок";
  const hh = String(Math.floor(engine.hour)).padStart(2, "0");
  // Показываем реальные игровые минуты, а не округление к десятиминутным делениям.
  const mm = String(Math.floor(engine.s.minutes % 60)).padStart(2, "0");
  const w = WEATHER_INFO[engine.weather];
  const atmo = engine.atmosphere.summary();
  const moonPhase = Math.round(engine.atmosphere.state.moonPhase * 8) % 8;
  const fc = engine.forecast;
  const busy = engine.navigation.moving || engine.phase === "fight" || engine.phase === "bite" || engine.phase === "caught";
  const events = engine.eventDirector.activeList();

  const status: Record<string, [string, string]> = {
    idle: engine.coolerFull ? ["Садок полон", "Вернитесь в порт"] : ["Готов к забросу", "Удерживайте ЛКМ или пробел"],
    charging: ["Заброс", "Отпустите для броска"],
    casting: ["Заброс", ""],
    sinking: ["Снасть уходит на глубину", "Клик — смотать"],
    waiting: engine.nibbling
      ? [engine.pendingFind ? "Снасть дрогнула" : "Рыба пробует наживку", "Не спешите — ждите уверенной потяжки"]
      : ["Ожидание поклёвки", `Клик — смотать · ${engine.bait.name.toLowerCase()}`],
    bite: ["Поклёвка", "Подсекайте"],
    fight: ["Вываживание", "Удерживайте — подмотка · A / D — против рывка"],
    caught: ["Улов", ""],
  };
  const [stTitle, stSub] = status[engine.phase];

  const controlReserve=engine.navigationMode?(view.land&&view.compact?130:205):buttonFishing?(view.land?140:195):view.compact?(view.land?70:146):150;
  if (startupError) return <RecoveryScreen message={startupError} />;
  return (
    <div data-zv-ready={boot.state !== "loading" ? "true" : undefined} className="relative h-dvh w-full select-none overflow-hidden bg-[#050a12] text-[#e6e1d6]" onPointerDownCapture={unlockAudio}>
      {safeStart && boot.state === "title" && !playing && <a href="/recover.html" className="absolute bottom-3 left-0 right-0 z-[80] text-center text-xs text-[#bfa777]">Безопасный запуск · восстановление</a>}
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 h-full w-full touch-none ${engine.navigationMode ? "cursor-crosshair" : ""}`}
        onPointerDown={(e) => {
          if (e.button === 0 && playing && !engine.paused && !panel && !letter && !engine.lastCatch && !engine.lastFind && !engine.s.atPort) {
            if (engine.navigationMode) {
              if(mobileControls&&settings.controls.sailing==="arrows")return;
              const rect = e.currentTarget.getBoundingClientRect();
              if (sceneRef.current.isWaterPoint(e.clientY - rect.top)) engine.navigateTo(sceneRef.current.screenToWorldNX(e.clientX - rect.left));
              return;
            }
            if(buttonFishing)return;
            e.currentTarget.setPointerCapture(e.pointerId);
            engine.pointerDown();
            const k = e.clientX / window.innerWidth;
            engine.setPointerDir(k < 0.4 ? -1 : k > 0.6 ? 1 : 0);
          }
        }}
        onPointerMove={(e) => {
          if (!buttonFishing && engine.reeling) {
            const k = e.clientX / window.innerWidth;
            engine.setPointerDir(k < 0.4 ? -1 : k > 0.6 ? 1 : 0);
          }
        }}
        onPointerUp={(e) => {
          if (e.button !== 0 || buttonFishing || engine.navigationMode) return;
          engine.pointerUp();
          if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={() => (!buttonFishing&&!engine.navigationMode)&&engine.cancelInput()}
        onLostPointerCapture={() => (!buttonFishing&&!engine.navigationMode)&&engine.cancelInput()}
        onPointerLeave={(e) => { if (!e.currentTarget.hasPointerCapture(e.pointerId)) (!buttonFishing&&!engine.navigationMode)&&engine.cancelInput(); }}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* ───────── ТИТУЛ ───────── */}
      {!playing && boot.state !== "auth" && (
        <div className="absolute inset-0 z-50 flex items-center bg-[linear-gradient(90deg,rgba(3,7,12,0.9)_0%,rgba(3,7,12,0.62)_30%,rgba(3,7,12,0.18)_58%,rgba(3,7,12,0)_78%)]">
          <div className="title-in zv-title mx-6 max-h-[100dvh] max-w-[520px] overflow-y-auto py-6 sm:ml-[7vw]">
            <div className="label-brass">Симулятор морской рыбалки</div>
            <h1 className="font-serif mt-3 text-[clamp(48px,8vw,112px)] font-light leading-[0.92] text-[#f4eee0] sm:mt-4">Знакомая<br />вода</h1>
            <p className="zv-title-tagline font-serif mt-4 max-w-sm text-[18px] italic leading-snug text-[#d8cfbd] sm:mt-6 sm:text-[22px]">Лодка, удочка, море и одинокий рыбак на рассвете. Никакой спешки.</p>
            <div className="zv-title-rule mt-6 h-px w-24 bg-[var(--brass)] sm:mt-10" />
            {boot.state === "loading" ? (
              <div className="label pulse-soft mt-10">Загрузка</div>
            ) : (
              <div className="zv-title-form mt-6 w-full max-w-[340px] space-y-3 sm:mt-10">
                <div className="label">Имя</div>
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="Рыбак" className="field !text-left" />
                {boot.save && (
                  <button className="btn btn-solid h-12 w-full justify-between px-5" disabled={starting} onClick={() => void start(false)}>
                    <span>{starting ? "Подготовка лодки…" : "Продолжить"}</span>
                    <span className="num text-[10px] opacity-70">день {Math.floor(boot.save.minutes / 1440) + 1} · {Object.keys(boot.save.codex).length}/{FISH.length}</span>
                  </button>
                )}
                <button className={`btn ${boot.save ? "btn-quiet" : "btn-solid"} h-12 w-full`} disabled={starting} onClick={() => { if (!boot.save || confirm("Начать заново? Текущий прогресс будет перезаписан.")) void start(true); }}>
                  {starting ? "Подготовка лодки…" : "Новая игра"}
                </button>
                <div className="flex items-center justify-between border-t border-[var(--line)] pt-3">
                  <div className="text-[11px] leading-snug">
                    <span className="dim">Учётная запись</span><br />
                    <span className="text-[#ece6d8]">{account.user?.username ?? "—"}</span>
                  </div>
                  <div className="flex gap-1.5">
                    <button className="btn btn-sm btn-quiet" onClick={() => openPanel("friends")}>Друзья{friends.pending > 0 ? ` · ${friends.pending}` : ""}</button>
                    <button className="btn btn-sm btn-quiet" onClick={() => { audio.ui("click"); setAuthOpen("profile"); }}>Профиль</button>
                    <button className="btn btn-sm" onClick={() => { audio.ui("click"); void onLogout(); }}>Выйти</button>
                  </div>
                </div>
                <div className="text-[11px] dim">Сохранение: {cloud}{account.offline ? " · сервер недоступен" : ""}</div>
              </div>
            )}
          </div>
          <div className="zv-title-keys absolute bottom-6 left-[7vw] right-6 hidden flex-wrap gap-x-6 gap-y-1 text-[11px] dim md:flex">
            <span>ЛКМ / Пробел — заброс и подмотка</span><span>A · D — против рывка</span><span>Колесо — глубина · Shift + колесо — зум</span><span>C · J · P — кодекс, журнал, порт</span>
          </div>
        </div>
      )}

      {boot.state === "auth" && <AuthScreen onReady={onAuthed} offline={account.offline} />}
      {authOpen === "profile" && account.user && <ProfileModal account={account} sync={cloud} onClose={() => setAuthOpen(null)} onLogout={onLogout} onDeleted={onDeleted} />}
      {/* Друзья доступны и на титуле, поэтому рендерим вне блока активной игры. */}
      {panel === "friends" && <FriendsModal state={friends} me={account.user?.id ?? null} onClose={closePanel} onUi={(k) => audioRef.current.ui(k ?? "click")} />}

      {playing && engine.s.atPort && !travelling && (
        <PortHub onSettings={() => setSettingsOpen(true)} engine={engine} onHover={(id) => { portSceneRef.current.hover = id; }} hot={portScene0.hot} compact={view.compact} onOpen={openBuilding} onTravel={requestTrip} onJournal={() => openPanel("journal")} onCodex={() => openPanel("codex")} account={account} onAccount={() => setAuthOpen("profile")} />
      )}
      {tripReq && <TravelChoice engine={engine} trip={tripReq} onCancel={() => setTripReq(null)} onGo={startTrip} />}
      {travelling && <TravelOverlay engine={engine} trip={travelling.trip} mode={travelling.mode} onDone={finishTrip} quality={settings.quality} model3d={settings.model3d} />}

      {playing && (
        <>
          {!engine.s.atPort && !panel && !tripReq && !travelling && !settingsOpen && letter === null && !authOpen && !engine.lastCatch && !engine.lastFind && (
            engine.navigationMode ? <LocalNavigationPanel engine={engine} scene={scene0} landscape={view.compact && view.land} mobile={mobileControls} controls={settings.controls} onSettings={() => setSettingsOpen(true)} /> : ["idle","waiting","sinking"].includes(engine.phase) &&
            <button className="zv-ui navigation-entry" style={{bottom:controlReserve+12,right:58}} disabled={!!engine.navigationBlock} onClick={() => engine.setNavigationMode(true)} title={engine.navigationBlock ?? "Выбрать точку и плыть · N"}>
              <span aria-hidden="true">↔</span> Перемещение
              {!!engine.navigationBlock && <small>уберите снасть</small>}
            </button>
          )}

          {!view.compact && !engine.s.atPort && (
            <>
          {/* ───────── ЛЕВЫЙ ВЕРХ ───────── */}
          <div className="zv-ui game-hud absolute left-4 top-4 z-20 w-[300px] space-y-2">
            <div className="glass px-4 pb-3 pt-3.5">
              <div className="label-brass">{engine.loc.name}</div>
              <div className="flex items-end justify-between gap-3">
                <div className="font-serif text-[22px] leading-tight text-[#f4eee0]">{engine.spot.name}</div>
                <div className="num text-[26px] font-light leading-none text-[#f1ebdd]">{hh}<span className="opacity-50">:</span>{mm}</div>
              </div>
              <div className="mt-1 flex justify-between text-[11px] muted">
                <span>{SEASONS[engine.season]}, день {engine.dayOfSeason} из 7</span>
                <span>год {engine.year}</span>
              </div>
              <div className="rule my-2.5" />
              <div className="flex items-center justify-between text-[12px] text-[#ddd7ca]">
                <span className="flex items-center gap-1.5" title={w.desc}><span aria-hidden="true" className="text-base leading-none">{atmo.icon}</span>{atmo.weatherName}</span>
                <span className="num flex items-center gap-1"><Icon name="thermo" size={14} className="opacity-60" />{atmo.temp > 0 ? "+" : ""}{atmo.temp}°</span>
                <span className="num flex items-center gap-1"><Icon name="wind" size={14} className="opacity-60" />{atmo.wind} м/с</span>
                <span title={atmo.moonName}><MoonIcon phase={moonPhase} size={16} /></span>
              </div>
              <div className="mt-1.5 text-[11px] dim">{atmo.phaseName} · облачность {atmo.cover}% · далее {WEATHER_INFO[fc.w].name.toLowerCase()}, через ~{Math.max(1, Math.round(fc.inMin / 60))} ч</div>
              <button disabled={busy} onClick={() => openBuilding("map")} className="btn btn-quiet mt-3 w-full justify-between !tracking-[0.08em] disabled:cursor-not-allowed">
                <span className="flex items-center gap-2"><Icon name="map" size={14} />Карта акваторий</span>
                <span className="text-[9px] normal-case tracking-normal muted">путь и топливо</span>
              </button>
              <div className="mt-3 border-t border-[var(--line)] pt-2" onPointerDown={(e) => e.stopPropagation()}>
                {spotsOf(s.location).map((sp) => {
                  const on = s.spot === sp.id;
                  return (
                    <div key={sp.id} aria-current={on?"location":undefined} title={sp.desc}  className={`group flex w-full items-center gap-2 py-[3px] text-left text-[12px] transition disabled:cursor-default ${on ? "text-[#f1ebdd]" : "muted hover:text-white"}`}>
                      <span className={`h-1.5 w-1.5 rotate-45 ${on ? "bg-[var(--brass)]" : "border border-white/30"}`} />
                      <span className="flex-1 truncate">{sp.name}</span>
                      <span className={`num text-[10px] ${sp.maxDepth > engine.line.value ? "text-[var(--color-bad)]" : "dim"}`}>{sp.maxDepth} м</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div onPointerDown={(e) => e.stopPropagation()}><QuestTracker engine={engine} onOpen={openLetter} /></div>
            <div onPointerDown={(e) => e.stopPropagation()}><DailyTracker engine={engine} onOpen={() => openPanel("journal")} /></div>
            {events.map((entry) => {
              const omen = entry.live.phase === "omen";
              const left = Math.max(0, entry.left);
              return (
                <div key={entry.live.uid} className="glass flex items-center gap-3 px-4 py-2.5">
                  <span className="text-base">{omen ? "❔" : entry.def.icon}</span>
                  <span className="flex-1 text-[12px] text-[#ece6d8]">{omen ? `Предвестие: ${entry.def.name}` : entry.def.name}</span>
                  <span className="num text-[11px] dim">{Math.ceil(left)} мин</span>
                </div>
              );
            })}
          </div>

          {/* ───────── ПРАВЫЙ ВЕРХ ───────── */}
          <div className="zv-ui game-hud absolute right-4 top-4 z-20 flex w-[330px] flex-col items-stretch gap-2" onPointerDown={(e) => e.stopPropagation()}>
            <div className="glass px-4 py-3">
              <div className="grid grid-cols-3 gap-3">
                <div><div className="label">Средства</div><div className="num text-[17px] text-[var(--brass-2,#e3c996)]">{fmt(s.money)} ₽</div></div>
                <button
                  className="min-w-0 text-left transition hover:text-[var(--brass)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--brass)]"
                  onClick={() => openPanel("cooler")}
                  aria-label={`Открыть садок: ${s.cooler.length} из ${engine.coolerCap}`}
                  title="Просмотреть улов и отпустить выбранную рыбу"
                >
                  <div className="label">Садок</div>
                  <div className={`num text-[17px] ${engine.coolerFull ? "text-[var(--color-bad)]" : "text-[#f1ebdd]"}`}>{s.cooler.length}<span className="dim">/{engine.coolerCap}</span></div>
                </button>
                <div><div className="label">Кодекс</div><div className="num text-[17px] text-[#f1ebdd]">{found}<span className="dim">/{FISH.length}</span></div></div>
              </div>
              <div className="rule my-2.5" />
              <XpBar engine={engine} />
              <div className="mt-1.5 flex justify-between text-[10px] dim"><span>{s.name}</span><span>{rank}</span></div>
            </div>
            <div className="flex justify-end gap-1.5">
              <button className="iconbtn" onClick={cycleCam} title={`Камера: ${CAM_NAMES[camMode]} [V]`}><Icon name="target" size={15} /><span className="normal-case tracking-normal">{CAM_NAMES[camMode]}</span></button>
              <button className="iconbtn" onClick={() => setSettings({ ...settings, sound: !settings.sound })} title="Звук [M]"><Icon name={settings.sound ? "speaker" : "mute"} size={16} /></button>
              <AccountBadge account={account} compact onClick={() => setAuthOpen("profile")} />
              <button className="iconbtn" onClick={() => openPanel("journal")} title="Журнал [J]"><Icon name="journal" size={16} />{(engine.perkPoints > 0 || engine.hasLetter || engine.daily.tasks.some((t) => t.done && !t.claimed)) && <span className="dot" />}</button>
              <button className="iconbtn" onClick={() => openPanel("codex")} title="Кодекс [C]"><Icon name="book" size={16} /></button>
              <button className="iconbtn" onClick={() => openPanel("friends")} title="Друзья [F]"><Icon name="friends" size={16} />{friends.pending > 0 && <span className="dot" />}</button>
              <button className="iconbtn" onClick={openPort} title={`В порт ${PORT_BY_ID[engine.nearestPort()].name} [P]`}><Icon name="anchor" size={16} /><span className="normal-case tracking-normal">{PORT_BY_ID[engine.nearestPort()].name}</span></button>
            </div>
          </div>

            </>
          )}
          {view.compact && !engine.s.atPort && (
            <div className="zv-ui game-hud game-hud-compact hud-layer z-20">
              <div className="!pointer-events-none flex items-start justify-between gap-2">
                <button onPointerDown={(e) => e.stopPropagation()} onClick={() => { audio.ui(info ? "close" : "open"); setInfo((v) => !v); }} className={`hud-overview glass pointer-events-auto relative flex min-w-0 max-w-[58vw] items-center gap-2.5 px-3 py-2 text-left ${info ? "!border-[var(--brass)]" : ""}`}>
                  <span className="num text-[18px] font-light leading-none text-[#f1ebdd]">{hh}<span className="opacity-50">:</span>{mm}</span>
                  <span className="h-6 w-px shrink-0 bg-[var(--line-2)]" />
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] leading-tight text-[#f1ebdd]">{engine.spot.name}</span>
                    <span className="block truncate text-[10px] leading-tight dim">{engine.loc.name}</span>
                  </span>
                  <span aria-hidden="true" className="shrink-0 text-base leading-none">{atmo.icon}</span>
                  <span className="num hidden shrink-0 text-[11px] muted min-[420px]:inline">{engine.temperature > 0 ? "+" : ""}{engine.temperature}°</span>
                  {(events.length > 0 || engine.hasLetter) && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[var(--brass)] shadow-[0_0_6px_var(--brass)]" />}
                </button>
                <div className="hud-toolbar pointer-events-auto flex flex-col items-end gap-1.5" onPointerDown={(e) => e.stopPropagation()}>
                  <div className="hud-tools flex gap-1.5">
                    <button className="iconbtn" onClick={cycleCam} aria-label="Камера"><Icon name="target" size={16} /></button>
                    <button className="iconbtn" onClick={() => openPanel("journal")} aria-label="Журнал"><Icon name="journal" size={16} />{(engine.perkPoints > 0 || engine.hasLetter || engine.daily.tasks.some((t) => t.done && !t.claimed)) && <span className="dot" />}</button>
                    <button className="iconbtn" onClick={() => openPanel("codex")} aria-label="Кодекс"><Icon name="book" size={16} /></button>
                    <button className="iconbtn" onClick={() => openPanel("friends")} aria-label="Друзья"><Icon name="friends" size={16} />{friends.pending > 0 && <span className="dot" />}</button>
                    <button className="iconbtn" onClick={openPort} aria-label="Порт"><Icon name="anchor" size={16} /></button>
                  </div>
                  <div className="glass num flex items-center gap-3 whitespace-nowrap px-3 py-1.5 text-[12px]">
                    <span className="text-[var(--brass-2,#e3c996)]">{fmt(s.money)} ₽</span>
                    <button
                      type="button"
                      className={`inline-flex items-center gap-1.5 rounded-sm transition hover:text-[var(--brass-2,#e3c996)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--brass)] ${engine.coolerFull ? "text-[var(--color-bad)]" : "text-[#ece6d8]"}`}
                      onClick={() => openPanel("cooler")}
                      aria-label={`Открыть садок: ${s.cooler.length} из ${engine.coolerCap}`}
                      title="Просмотреть улов и отпустить выбранную рыбу"
                    ><Icon name="basket" size={12} />{s.cooler.length}/{engine.coolerCap}</button>
                  </div>
                </div>
              </div>
              {info && (
                <>
                  <div className="fixed inset-0 z-0" onPointerDown={(e) => { e.stopPropagation(); setInfo(false); }} />
                  <div className="sheet-up glass relative z-10 mt-2 min-w-0 max-w-full max-h-[calc(100dvh-150px)] w-[min(360px,100%)] overflow-x-hidden overflow-y-auto overscroll-contain p-4" onPointerDown={(e) => e.stopPropagation()}>
                    <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <span className="label-brass truncate">{engine.loc.name}</span>
                      <span className="truncate text-[11px] dim">{SEASONS[engine.season]}, день {engine.dayOfSeason}/7 · год {engine.year}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[12px] text-[#ddd7ca]">
                      <span className="flex items-center gap-1.5"><span aria-hidden="true" className="text-base leading-none">{atmo.icon}</span>{atmo.weatherName}</span>
                      <span className="num flex items-center gap-1"><Icon name="wind" size={14} className="opacity-60" />{atmo.wind} м/с</span>
                      <span className="flex items-center gap-1.5"><MoonIcon phase={moonPhase} size={15} />{atmo.moonName}</span>
                    </div>
                    <div className="mt-1 text-[11px] dim">{w.desc} · {atmo.phaseName}, облачность {atmo.cover}%. Далее — {WEATHER_INFO[fc.w].name.toLowerCase()}, через ~{Math.max(1, Math.round(fc.inMin / 60))} ч</div>
                    <button disabled={busy} onClick={() => { setInfo(false); openBuilding("map"); }} className="btn btn-quiet mt-3 w-full justify-between !tracking-[0.08em] disabled:cursor-not-allowed">
                      <span className="flex items-center gap-2"><Icon name="map" size={14} />Карта акваторий</span>
                      <span className="text-[9px] normal-case tracking-normal muted">расстояние и топливо</span>
                    </button>
                    <div className="label mt-4">Ориентиры акватории</div>
                    <div className="mt-1">
                      {spotsOf(s.location).map((sp) => {
                        const on = s.spot === sp.id;
                        return (
                          <div key={sp.id} aria-current={on?"location":undefined}  className={`flex min-w-0 w-full items-center gap-2 border-b border-[var(--line)] py-2.5 text-left text-[13px] ${on ? "text-[#f1ebdd]" : "muted"}`}>
                            <span className={`h-1.5 w-1.5 shrink-0 rotate-45 ${on ? "bg-[var(--brass)]" : "border border-white/30"}`} />
                            <span className="min-w-0 flex-1 truncate">{sp.name}</span>
                            <span className={`num text-[11px] ${sp.maxDepth > engine.line.value ? "text-[var(--color-bad)]" : "dim"}`}>{sp.maxDepth} м</span>
                          </div>
                        );
                      })}
                    </div>
                    {events.length > 0 && (
                      <>
                        <div className="label mt-4">На воде сейчас</div>
                        {events.map((entry) => (
                          <div key={entry.live.uid} className="flex min-w-0 items-center gap-2 border-b border-[var(--line)] py-2 text-[12px]">
                            <span className="shrink-0">{entry.live.phase === "omen" ? "❔" : entry.def.icon}</span>
                            <span className="min-w-0 flex-1 truncate text-[#ece6d8]">{entry.live.phase === "omen" ? `Предвестие: ${entry.def.name}` : entry.def.name}</span>
                            <span className="num shrink-0 dim">{Math.max(0, Math.ceil(entry.left))} мин</span>
                          </div>
                        ))}
                      </>
                    )}
                    <div className="mt-4"><QuestTracker engine={engine} onOpen={() => { setInfo(false); openLetter(); }} /></div>
                    <div className="mt-2"><DailyTracker engine={engine} onOpen={() => { setInfo(false); openPanel("journal"); }} /></div>
                    <div className="mt-3"><XpBar engine={engine} /></div>
                    <div className="mt-4 flex gap-2">
                      <button className="iconbtn flex-1" onClick={() => setSettings({ ...settings, sound: !settings.sound })}><Icon name={settings.sound ? "speaker" : "mute"} size={15} />{settings.sound ? "Звук" : "Без звука"}</button>
                    </div>
                    <div className="label mt-4">Камера</div>
                    <div className="seg mt-1.5 w-full">
                      {CAM_MODES.map((m) => (
                        <button key={m} className={`flex-1 !px-1 ${camMode === m ? "on" : ""}`} onClick={() => setCamMode(m)}>{CAM_NAMES[m]}</button>
                      ))}
                    </div>
                    <button className="iconbtn mt-3 w-full justify-between" onClick={() => { setInfo(false); setAuthOpen("profile"); }}>
                      <span className="normal-case tracking-normal">{account.user?.username ?? "Аккаунт"}</span>
                      <span className="dim normal-case tracking-normal">{cloud}</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          {/* ───────── БАННЕР ───────── */}
          {engine.banner && (
            <div key={engine.banner.id} className={`banner pointer-events-none absolute left-1/2 z-20 flex w-[92vw] -translate-x-1/2 flex-col items-center text-center ${view.compact ? "top-[22vh]" : "top-[13vh]"}`}>
              <div className="flex items-center gap-5">
                <span className="h-px w-16 bg-gradient-to-r from-transparent to-[var(--brass)]" />
                <span className={`font-serif font-medium text-[#f4eee0] [text-shadow:0_2px_24px_rgba(0,0,0,0.6)] ${view.compact ? "text-[26px]" : "whitespace-nowrap text-[38px]"}`}>{engine.banner.text}</span>
                <span className="h-px w-16 bg-gradient-to-l from-transparent to-[var(--brass)]" />
              </div>
              {engine.banner.sub && <div className="label-brass mt-1 [text-shadow:0_1px_8px_rgba(0,0,0,0.8)]">{engine.banner.sub}</div>}
            </div>
          )}

          {/* ───────── ЛЕНТА ───────── */}
          <div className="pointer-events-none absolute left-3 z-20 flex max-w-[78vw] flex-col gap-1.5" style={{bottom:controlReserve+(engine.phase==="charging"?96:64),display:["fight","bite"].includes(engine.phase)?"none":undefined}}>
            {(view.compact ? engine.toasts.slice(-2) : engine.toasts).map((t) => (
              <div key={t.id} className={`log-item log-${t.kind}`}>
                <div>
                  <div className="text-[12px] text-[#ece6d8]">{t.text}</div>
                  {t.sub && <div className="text-[11px] dim">{t.sub}</div>}
                </div>
              </div>
            ))}
          </div>

          <EventFeed
            director={engine.eventDirector}
            onChoose={(uid, choiceId) => engine.chooseEvent(uid, choiceId)}
            onCue={(message) => {
              if (message.type === "start" && ["legendary", "mythic"].includes(message.def.tier)) audio.play("legend");
              else if (message.type === "outcome") audio.play("quest");
              else if (message.type === "omen" || message.type === "start") audio.play("event");
            }}
            hidden={buttonFishing || engine.navigationMode || panel !== null || letter !== null || authOpen !== null || !!travelling || !!tripReq || (touch && engine.phase === "fight")}
            compact={view.compact}
            land={view.land}
            port={engine.s.atPort}
          />

          {!buttonFishing && !view.compact && !engine.s.atPort && !engine.navigationMode && (
            <>
          {/* ───────── НИЖНЯЯ ПАНЕЛЬ ───────── */}
          <div className="zv-ui game-controls absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-2 px-4 pb-4" onPointerDown={(e) => e.stopPropagation()}>
            {engine.tipNow && (
              <div key={engine.tipNow.id} className="tip glass flex max-w-[640px] items-start gap-3 px-4 py-2.5">
                <span className="label-brass mt-0.5 shrink-0">Совет</span>
                <span className="text-[12px] leading-relaxed text-[#ddd7ca]">{engine.tipNow.text}</span>
                <button className="dim hover:text-white" onClick={() => engine.dismissTip()} aria-label="Скрыть"><Icon name="close" size={13} /></button>
              </div>
            )}
            <div className="glass grid w-full max-w-[1120px] grid-cols-1 items-center md:grid-cols-[220px_1fr_auto]">
              <div className={`border-b border-[var(--line)] px-4 py-3 md:border-b-0 md:border-r ${engine.phase === "bite" ? "bg-[var(--brass-soft)]" : ""}`}>
                <div className={`text-[13px] ${engine.phase === "bite" ? "pulse-soft font-semibold tracking-[0.12em] text-[var(--brass-2,#e3c996)] uppercase" : "text-[#f1ebdd]"}`}>{stTitle}</div>
                <div className="truncate text-[11px] dim">{stSub}</div>
              </div>
              <div className="flex items-center gap-4 px-5 py-3">
                <span className="label shrink-0">Глубина</span>
                <input
                  type="range"
                  aria-label="Глубина ловли"
                  min={0}
                  max={1000}
                  disabled={!["idle", "charging"].includes(engine.phase)}
                  value={Math.round((depthToU(Math.min(s.targetDepth, maxD)) / depthToU(maxD)) * 1000)}
                  onChange={(e) => engine.setDepth(uToDepth((Number(e.target.value) / 1000) * depthToU(maxD)))}
                  className="depth-range min-w-[120px] flex-1"
                />
                <span className="num w-14 text-right text-[16px] text-[#f1ebdd]">{Math.min(s.targetDepth, maxD)}<span className="ml-0.5 text-[11px] dim">м</span></span>
                <span className="hidden w-[190px] shrink-0 text-[11px] leading-tight dim lg:block">
                  {cands.length === 0 ? <span className="text-[var(--color-bad)]">На этой глубине сейчас пусто</span> : s.sonar === 0 ? "Рыба здесь есть" : <>Видов на горизонте: <span className="num text-[#ece6d8]">{cands.length}</span>{s.sonar >= 2 && newCands > 0 && <span className="text-[var(--brass)]"> · новых {newCands}</span>}</>}
                  {engine.maxDepth < engine.spot.maxDepth && <><br /><span className="text-[var(--color-bad)]/80">Леска до {engine.line.value} м</span></>}
                </span>
              </div>
              <div className="flex items-center gap-3 border-t border-[var(--line)] px-4 py-3 md:border-l md:border-t-0">
                <span className="label shrink-0">Наживка</span>
                <div className="seg">
                  {BAITS.map((b, i) => {
                    const n = b.id === "worm" ? Infinity : s.baits[b.id] ?? 0;
                    if (n <= 0 && b.id !== s.currentBait) return null;
                    return (
                      <button key={b.id} title={`${b.desc} [${i + 1}]`} onClick={() => { audio.ui("click"); engine.setBait(b.id as BaitId); }} className={s.currentBait === b.id ? "on" : ""}>
                        <BaitIcon id={b.id} size={16} className="mr-1.5 inline-block -translate-y-px align-middle" />
                        {b.name}{n !== Infinity && <span className="num ml-1 dim">{n}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

            </>
          )}
          {!buttonFishing && view.compact && !engine.s.atPort && !engine.navigationMode && (
            <div className="zv-ui game-controls absolute inset-x-0 bottom-0 z-20 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pl-[max(8px,env(safe-area-inset-left))] pr-[max(8px,env(safe-area-inset-right))]" onPointerDown={(e) => e.stopPropagation()}>
              {engine.tipNow && engine.phase !== "fight" && engine.phase !== "bite" && !engine.nibbling && (
                <div key={engine.tipNow.id} className="tip glass mx-auto mb-1.5 flex max-w-[560px] items-start gap-2 px-3 py-2">
                  <span className="flex-1 text-[11px] leading-snug text-[#ddd7ca]">{engine.tipNow.text}</span>
                  <button className="dim" onClick={() => engine.dismissTip()} aria-label="Скрыть"><Icon name="close" size={12} /></button>
                </div>
              )}
              {view.land ? (
                <div className="glass flex items-center gap-3 px-3 py-2">
                  <div className={`w-[128px] shrink-0 truncate text-[12px] ${engine.phase === "bite" ? "pulse-soft font-semibold uppercase tracking-[0.12em] text-[var(--brass-2,#e3c996)]" : "text-[#f1ebdd]"}`}>{stTitle}</div>
                  <input
                  type="range"
                  aria-label="Глубина ловли"
                  min={0}
                  max={1000}
                  disabled={!["idle", "charging"].includes(engine.phase)}
                  value={Math.round((depthToU(Math.min(s.targetDepth, maxD)) / depthToU(maxD)) * 1000)}
                  onChange={(e) => engine.setDepth(uToDepth((Number(e.target.value) / 1000) * depthToU(maxD)))}
                  className="depth-range min-w-0 flex-1"
                />
                  <span className="num w-12 shrink-0 text-right text-[14px] text-[#f1ebdd]">{Math.min(s.targetDepth, maxD)}<span className="text-[10px] dim"> м</span></span>
                  <div className="no-scrollbar zv-fade-x flex max-w-[38%] gap-1 overflow-x-auto">
                  {BAITS.map((b) => {
                    const n = b.id === "worm" ? Infinity : s.baits[b.id] ?? 0;
                    if (n <= 0 && b.id !== s.currentBait) return null;
                    const on = s.currentBait === b.id;
                    return (
                      <button key={b.id} onClick={() => { audio.ui("click"); engine.setBait(b.id as BaitId); }} className={`flex shrink-0 items-center gap-1.5 border px-2.5 py-1.5 text-[11px] ${on ? "border-[rgba(200,164,106,0.6)] bg-[var(--brass-soft)] text-[#f0dcb4]" : "border-[var(--line)] muted"}`}>
                        <BaitIcon id={b.id} size={15} />
                        {b.name}{n !== Infinity && <span className="num dim">{n}</span>}
                      </button>
                    );
                  })}
                  </div>
                </div>
              ) : (
                <div className="glass px-3 pb-2 pt-2.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className={`truncate text-[13px] ${engine.phase === "bite" ? "pulse-soft font-semibold uppercase tracking-[0.12em] text-[var(--brass-2,#e3c996)]" : "text-[#f1ebdd]"}`}>{stTitle}</span>
                    <span className="truncate text-[10px] dim">{cands.length === 0 ? "здесь сейчас пусто" : s.sonar >= 1 ? `видов: ${cands.length}` : ""}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <span className="label shrink-0">Глубина</span>
                    <input
                  type="range"
                  aria-label="Глубина ловли"
                  min={0}
                  max={1000}
                  disabled={!["idle", "charging"].includes(engine.phase)}
                  value={Math.round((depthToU(Math.min(s.targetDepth, maxD)) / depthToU(maxD)) * 1000)}
                  onChange={(e) => engine.setDepth(uToDepth((Number(e.target.value) / 1000) * depthToU(maxD)))}
                  className="depth-range min-w-0 flex-1"
                />
                    <span className="num w-12 shrink-0 text-right text-[15px] text-[#f1ebdd]">{Math.min(s.targetDepth, maxD)}<span className="text-[10px] dim"> м</span></span>
                  </div>
                  <div className="no-scrollbar zv-fade-x -mx-3 mt-2 flex gap-1.5 overflow-x-auto px-3">
                  {BAITS.map((b) => {
                    const n = b.id === "worm" ? Infinity : s.baits[b.id] ?? 0;
                    if (n <= 0 && b.id !== s.currentBait) return null;
                    const on = s.currentBait === b.id;
                    return (
                      <button key={b.id} onClick={() => { audio.ui("click"); engine.setBait(b.id as BaitId); }} className={`flex shrink-0 items-center gap-1.5 border px-2.5 py-1.5 text-[11px] ${on ? "border-[rgba(200,164,106,0.6)] bg-[var(--brass-soft)] text-[#f0dcb4]" : "border-[var(--line)] muted"}`}>
                        <BaitIcon id={b.id} size={15} />
                        {b.name}{n !== Infinity && <span className="num dim">{n}</span>}
                      </button>
                    );
                  })}
                  </div>
                </div>
              )}
            </div>
          )}
          {!buttonFishing && touch && engine.phase === "fight" && (
            <div className="pointer-events-none absolute inset-x-0 z-30 flex justify-between px-4" style={{ bottom: view.compact ? (view.land ? 84 : 146 + FIGHT_PANEL_HEIGHT + 26) : 150 + FIGHT_PANEL_HEIGHT + 26 }}>
              {([-1, 1] as const).map((d) => (
                <button
                  key={d}
                  className="glass pointer-events-auto flex h-20 w-20 items-center justify-center text-[#ece6d8] active:border-[var(--brass)] active:text-[var(--brass)]"
                  aria-label={d < 0 ? "Подматывать и уводить удилище влево" : "Подматывать и уводить удилище вправо"}
                  style={{ touchAction: "none" }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    if (engine.paused || e.button !== 0) return;
            e.currentTarget.setPointerCapture(e.pointerId);
                    engine.keyDir = d; engine.pullDir = d; engine.reeling = true;
                  }}
                  onPointerUp={(e) => {
                    e.stopPropagation();
                    engine.cancelInput();
                    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
                  }}
                  onPointerCancel={() => engine.cancelInput()}
                  onLostPointerCapture={() => engine.cancelInput()}
                  onPointerLeave={() => engine.cancelInput()}
                ><Icon name={d < 0 ? "arrowL" : "arrowR"} size={28} /></button>
              ))}
            </div>
          )}

          {!engine.s.atPort && !panel && !tripReq && !travelling && !settingsOpen && !engine.navigationMode && letter === null && !authOpen && engine.phase !== "caught" && (
            <div className="pointer-events-none absolute inset-0 z-[25]">
              <button style={{ position: "absolute", ...(["fight","bite","charging","casting"].includes(engine.phase)?{top:view.compact?(view.land?102:122):220}:{bottom:controlReserve+12}),right:12 }} className="iconbtn pointer-events-auto !bg-[rgba(6,12,18,0.72)]" onClick={() => setSettingsOpen(true)} title="Настройки" aria-label="Настройки"><Icon name="gear" size={16} /></button>
            </div>
          )}

          {buttonFishing&&!engine.navigationMode&&!engine.s.atPort&&!panel&&!tripReq&&!travelling&&!settingsOpen&&letter===null&&!authOpen&&!engine.lastCatch&&!engine.lastFind&&<MobileFishing engine={engine} controls={settings.controls} landscape={view.land&&view.compact}/>}
          {engine.phase === "caught" && engine.lastCatch && <CatchModal engine={engine} />}
          {engine.phase === "caught" && engine.lastFind && <FindModal engine={engine} />}
          {panel === "codex" && <Codex codex={engine.s.codex} onClose={closePanel} />}
          {panel === "journal" && <JournalModal engine={engine} onClose={closePanel} />}
          {panel === "cooler" && <CoolerModal engine={engine} onClose={closePanel} />}
          {settingsOpen && <SettingsModal settings={settings} setSettings={setSettings} camMode={camMode} onCamMode={setCamMode} onClose={() => setSettingsOpen(false)} />}
          {panel === "port" && <PortModal key={portTab} engine={engine} cloud={cloud} initialTab={portTab} mapOnly={!engine.s.atPort && portTab === "map"} onClose={closePanel} onTravel={requestTrip} onRest={startRest} onReset={reset} />}
          {letter !== null && <LetterModal engine={engine} index={letter} onClose={() => { audio.ui("paper"); setLetter(null); }} />}
        </>
      )}
      {resting && playing && <RestTransition portName={engine.port.name} onComplete={finishRest} />}
    </div>
  );
}
