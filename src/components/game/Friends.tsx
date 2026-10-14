"use client";

import { useCallback, useEffect, useMemo, useState, useId } from "react";
import { FISH_BY_ID } from "@/game/fish";
import { LOCATIONS, LOC_POS, PORTS, PORT_BY_ID } from "@/game/world";
import {
  avatarHue, boatOf, dayLabel, initialsOf, isOnline, lastSeenLabel, locOf, normalizeQuery,
  playTimeLabel, whereLabel, FRIEND_LIMIT,
  type FriendCatch, type FriendProfile, type FriendRequestRow, type FriendSummary, type FriendsOverview, type SearchResult,
} from "@/game/friends";
import { fetchFriendProfile, fetchFriends, friendAction, searchPlayers } from "@/game/persist";
import type { BoatDef, Variant } from "@/game/types";
import { fmt, fmtW, Modal } from "./Panels";
import { Icon, WEATHER_ICON } from "./Icons";
import { BoatPreview } from "./Panels";
import { FishIcon } from "./FishIcon";

/**
 * Друзья: список, заявки, поиск и профиль.
 *
 * Профиль показывает то, что в одиночной игре важнее всего: где сейчас лодка
 * друга (карта акваторий с его точкой), на чём он ходит (рисунок судна его
 * класса), и как идёт его промысел — уровень, кодекс, уловы, рекорды.
 */

// ───────────────────────── судно по классу ─────────────────────────

/** Силуэт судна: те же цвета корпуса и отделки, что в игре. */
// ───────────────────────── карта акваторий ─────────────────────────

/**
 * Морская карта без движка: та же география, что в планшете порта, но читает
 * только снимок мира друга. `compact` — без подписей, для карточки в списке.
 */
export function FriendChart({ where, boat, compact = false }: { where: FriendSummary["where"]; boat: BoatDef | null; compact?: boolean }) {
  const chartId = useId();
  const Y = (p: number) => p * 0.625;
  const target = where && !where.hidden ? (where.atPort && where.port && where.port in PORT_BY_ID ? PORT_BY_ID[where.port as keyof typeof PORT_BY_ID].pos : where.location ? LOC_POS[where.location] : null) : null;
  const home = PORTS[0].pos;
  const hidden = !!where?.hidden;
  return (
    <div className="relative aspect-[16/10] overflow-hidden border border-[var(--line-2)] bg-[#0b1824]">
      <svg viewBox="0 0 100 62.5" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <radialGradient id={`${chartId}-fdeep`} cx="86%" cy="36%" r="22%"><stop offset="0" stopColor="#03080f" /><stop offset="1" stopColor="#0b1824" stopOpacity="0" /></radialGradient>
          <radialGradient id={`${chartId}-fshelf`} cx="15%" cy="60%" r="40%"><stop offset="0" stopColor="#153246" /><stop offset="1" stopColor="#0b1824" stopOpacity="0" /></radialGradient>
          <pattern id={`${chartId}-fgrid`} width="6.25" height="6.25" patternUnits="userSpaceOnUse"><path d="M6.25 0H0V6.25" fill="none" stroke="rgba(143,179,200,0.07)" strokeWidth="0.15" /></pattern>
          <pattern id={`${chartId}-fice`} width="1.4" height="1.4" patternUnits="userSpaceOnUse"><path d="M0 1.4L1.4 0" stroke="rgba(200,225,240,0.25)" strokeWidth="0.12" /></pattern>
        </defs>
        <rect width="100" height="62.5" fill={`url(#${chartId}-fshelf)`} />
        <rect width="100" height="62.5" fill={`url(#${chartId}-fgrid)`} />
        <rect width="100" height="62.5" fill={`url(#${chartId}-fdeep)`} />
        {[0, 1, 2, 3].map((i) => <ellipse key={i} cx="86" cy="15" rx={4 + i * 3.5} ry={2.5 + i * 2.2} fill="none" stroke="rgba(143,179,200,0.1)" strokeWidth="0.18" />)}
        <path d="M0 62.5 L0 0 L19 0 C18 3 12 4 13 7 C14 9 19 8 20 11 C21 14 17 15 19 18 C22 21 26 19 27 23 C27 26 22 26 21 29 C20 33 24 34 22 38 C20 42 16 40 14 43 C12 46 16 48 13 51 C11 53 7 51 5 54 L4 56 C6 58 9 57 10 60 L10 62.5 Z" fill="#1b2721" stroke="rgba(230,225,214,0.28)" strokeWidth="0.2" />
        <path d="M3 62.5 C4 58 2 56 4 54" fill="none" stroke="#2a4a5a" strokeWidth="0.7" />
        <path d="M13 7 C10 6 7 8 4 7" fill="none" stroke="#0b1824" strokeWidth="0.8" />
        {[[32, 12], [34, 13.5], [29, 16], [33, 16.5], [36, 15], [31, 18.5], [28, 13]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx={0.8 + (i % 3) * 0.3} ry={0.5} fill="#2a3530" stroke="rgba(230,225,214,0.25)" strokeWidth="0.1" />)}
        <path d="M38 36 C40 38 44 38 46 40 C45 41 42 40.5 40 41 C38 40 37 38 38 36 Z" fill="#1f2a24" stroke="rgba(230,225,214,0.25)" strokeWidth="0.15" />
        <path d="M63 58 C65 55.5 69 55 71 57 C72 59 68 60 65 60 C63 60 62 59 63 58 Z" fill="#23302a" stroke="rgba(230,225,214,0.22)" strokeWidth="0.15" />
        <path d="M44 62.5 C45 59 49 58 53 59 C55 60 54 62 56 62.5 Z" fill="#1f3326" stroke="rgba(230,225,214,0.22)" strokeWidth="0.15" />
        <path d="M72 38.5 L74 35.5 L76 38.5 Z" fill="#2a2422" stroke="rgba(230,225,214,0.35)" strokeWidth="0.15" />
        <circle cx="74" cy="35.2" r="0.35" fill="rgba(255,120,50,0.7)" />
        <path d="M76 62.5 L78 56 C82 54.5 88 55 93 53.5 C96 53 98 54 100 53 L100 62.5 Z" fill={`url(#${chartId}-fice)`} stroke="rgba(220,236,246,0.45)" strokeWidth="0.2" />
        <path d="M76 62.5 L78 56 C82 54.5 88 55 93 53.5 C96 53 98 54 100 53 L100 62.5 Z" fill="rgba(200,225,240,0.1)" />
        {target && <line x1={home[0]} y1={Y(home[1])} x2={target[0]} y2={Y(target[1])} stroke="rgba(200,164,106,0.5)" strokeWidth="0.24" strokeDasharray="0.9 0.9" />}
        <g transform="translate(93 44)" stroke="rgba(230,225,214,0.35)" strokeWidth="0.2" fill="none">
          <circle r="4" /><circle r="2.9" strokeDasharray="0.3 0.6" />
          <path d="M0 -5.2 L0.8 0 L0 5.2 L-0.8 0 Z" fill="rgba(200,164,106,0.5)" />
          <path d="M-5.2 0 L0 -0.6 L5.2 0 L0 0.6 Z" fill="rgba(230,225,214,0.2)" />
        </g>
      </svg>

      {/* точки акваторий */}
      {LOCATIONS.map((l) => {
        const [x, y] = LOC_POS[l.id];
        const here = !!where && !hidden && !where.atPort && where.location === l.id;
        if (compact && !here) return <span key={l.id} className="absolute h-1 w-1 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-white/18" style={{ left: `${x}%`, top: `${y}%` }} />;
        return (
          <div key={l.id} className={`absolute -translate-x-1/2 -translate-y-1/2 ${here ? "" : "opacity-45"}`} style={{ left: `${x}%`, top: `${y}%` }}>
            <span className={`block h-2 w-2 rotate-45 border ${here ? "border-[var(--brass)] bg-[var(--brass)]" : "border-white/35 bg-[#0b1824]"}`} />
            {!compact && <span className={`font-serif absolute left-3.5 top-1/2 -translate-y-1/2 whitespace-nowrap text-[10px] leading-none ${here ? "text-[#f4eee0]" : "text-white/45"}`}>{l.name}</span>}
          </div>
        );
      })}

      {/* его лодка */}
      {target && !hidden && (
        <div className="absolute z-10 -translate-x-1/2 -translate-y-1/2" style={{ left: `${target[0]}%`, top: `${target[1]}%` }}>
          <span className="absolute left-1/2 top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full border border-[var(--brass)] opacity-30" />
          <span className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--brass)] bg-[rgba(200,164,106,0.16)]" />
          <span className="relative block -translate-y-7 text-[var(--brass)]"><Icon name={where?.atPort ? "anchor" : "boat"} size={compact ? 14 : 18} /></span>
        </div>
      )}

      {hidden && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-[rgba(4,10,16,0.72)] text-center">
          <Icon name="lock" size={18} />
          <div className="label">Местоположение скрыто</div>
          {!compact && <div className="max-w-[240px] text-[11px] dim">Игрок не показывает, где его лодка. Статистика и уловы при этом доступны.</div>}
        </div>
      )}
      {!where && !hidden && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-[rgba(4,10,16,0.6)] text-center">
          <Icon name="compass" size={18} />
          <div className="label">Ещё не выходил в море</div>
        </div>
      )}
      {!compact && (
        <div className="absolute bottom-1.5 left-3 text-[9px] tracking-[0.2em] text-white/30">
          {boat ? boat.name.toUpperCase() : "КАРТА АКВАТОРИЙ"} · МАСШТАБ УСЛОВНЫЙ
        </div>
      )}
    </div>
  );
}

// ───────────────────────── мелкие куски ─────────────────────────

function Avatar({ id, name, size = 44, online }: { id: string; name: string; size?: number; online?: boolean }) {
  const hue = avatarHue(id);
  return (
    <span
      className={`font-serif relative flex shrink-0 items-center justify-center rounded-full border ${online ? "border-[var(--color-ok)]" : "border-[var(--line-2)]"}`}
      style={{
        width: size, height: size, fontSize: Math.round(size * 0.36),
        background: `radial-gradient(circle at 32% 28%, hsl(${hue} 34% 34%), hsl(${hue} 30% 15%))`,
        color: "#f2ecdd", boxShadow: online ? "0 0 0 2px rgba(126,190,140,0.18)" : undefined,
      }}
      aria-hidden="true"
    >
      {initialsOf(name)}
      {online && <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-[#0b141c] bg-[var(--color-ok)]" />}
    </span>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="min-w-0 border border-[var(--line)] px-3 py-2">
      <div className="break-words label !text-[9px]">{label}</div>
      <div className={`num mt-0.5 break-words text-[16px] leading-none ${accent ? "text-[var(--brass-2,#e3c996)]" : "text-[#ece6d8]"}`}>{value}</div>
    </div>
  );
}

function WhereLine({ f }: { f: FriendSummary }) {
  const w = f.where;
  const online = isOnline(f.lastSeenAt);
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px]">
      <span className={`inline-flex items-center gap-1.5 ${w?.hidden ? "dim italic" : "text-[#d8d1c2]"}`}>
        {w?.weatherName && w.weather && <Icon name={WEATHER_ICON[w.weather]} size={13} />}
        {whereLabel(w)}
        {w?.gameDay ? <span className="dim"> · {dayLabel(w.gameDay)}</span> : null}
      </span>
      <span className={`ml-auto flex items-center gap-1.5 ${online ? "text-[var(--color-ok)]" : "dim"}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${online ? "bg-[var(--color-ok)]" : "bg-white/25"}`} />
        {online ? "в игре сейчас" : lastSeenLabel(f.lastSeenAt)}
      </span>
    </div>
  );
}

function CatchRow({ c, big }: { c: FriendCatch; big?: boolean }) {
  const fish = FISH_BY_ID[c.fishId];
  const loc = locOf(c.locationId);
  return (
    <div className="flex items-center gap-3 border-b border-[var(--line)] py-1.5">
      <span className="w-[54px] shrink-0">{fish ? <FishIcon fish={fish} size={54} variant={(c.variant as Variant | null) ?? null} /> : <span className="dim text-[11px]">—</span>}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] text-[#ece6d8]">{fish?.name ?? "Неизвестный вид"}</div>
        <div className="truncate text-[10.5px] dim">{loc?.name ?? c.locationId}{c.gameDay ? ` · день ${c.gameDay}` : ""}</div>
      </div>
      <div className={`num shrink-0 ${big ? "text-[15px] text-[var(--brass-2,#e3c996)]" : "text-[13px] text-[#ddd7ca]"}`}>{fmtW(c.weight)}</div>
    </div>
  );
}

// ───────────────────────── карточка друга ─────────────────────────

function FriendCard({ f, onOpen, onRemove, onUi }: { f: FriendSummary; onOpen: () => void; onRemove: () => void; onUi: () => void }) {
  const boat = boatOf(f.where?.boat ?? null);
  const online = isOnline(f.lastSeenAt);
  return (
    <div className="cell friend-card border border-[var(--line)] bg-[rgba(9,17,24,0.5)] p-3 transition-colors hover:border-[rgba(200,164,106,0.4)]">
      <div className="flex items-start gap-3">
        <Avatar id={f.userId} name={f.username} online={online} />
        <div className="min-w-0 flex-1">
          <button className="font-serif max-w-full truncate text-left text-[19px] leading-tight text-[#f1ebdd] hover:text-white" onClick={() => { onUi(); onOpen(); }}>
            {f.username}
          </button>
          <div className="num text-[10.5px] text-[var(--brass-2,#e3c996)]">уровень {f.level} · {f.codexCount} видов · {fmt(f.totalCaught)} рыб</div>
          <div className="mt-1.5"><WhereLine f={f} /></div>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-[1.35fr_1fr]">
        <FriendChart where={f.where} boat={boat} compact />
        <div className="flex flex-col justify-between border border-[var(--line)] bg-[rgba(6,13,19,0.6)] p-1.5">
          {boat ? (
            <>
              <BoatPreview hull={boat.hull} trim={boat.trim} tier={boat.tier} style={boat.style} className="w-full" />
              <div className="mt-1 min-w-0">
                <div className="truncate text-[11.5px] text-[#e6e0d2]">{boat.name}</div>
                <div className="num truncate text-[10px] dim">класс {boat.tier} · трюм {boat.cooler}{boat.stormSafe ? " · штормовое" : ""}</div>
              </div>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-1 py-3 text-center">
              <Icon name="boat" size={18} />
              <div className="text-[10.5px] dim">{f.where?.hidden ? "судно скрыто" : "нет данных о судне"}</div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button className="btn btn-sm btn-quiet flex-1" onClick={() => { onUi(); onOpen(); }}>Профиль</button>
        <button className="btn btn-sm btn-danger" onClick={() => { onUi(); onRemove(); }} aria-label={`Удалить ${f.username} из друзей`}>Удалить</button>
      </div>
    </div>
  );
}

function RequestCard({ r, onAccept, onDecline, onUi }: { r: FriendRequestRow; onAccept?: () => void; onDecline: () => void; onUi: () => void }) {
  return (
    <div className="friend-request cell flex min-w-0 items-center gap-3 border border-[var(--line)] bg-[rgba(9,17,24,0.5)] px-3 py-2.5">
      <Avatar id={r.userId} name={r.username} size={38} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] text-[#f1ebdd]">{r.username}</div>
        <div className="num truncate text-[10.5px] dim">уровень {r.level} · {r.codexCount} видов · {lastSeenLabel(r.createdAt)} заявка</div>
      </div>
      {onAccept && <button className="btn btn-sm btn-solid shrink-0" onClick={() => { onUi(); onAccept(); }}>Принять</button>}
      <button className="btn btn-sm btn-quiet shrink-0" onClick={() => { onUi(); onDecline(); }}>{onAccept ? "Отклонить" : "Отозвать"}</button>
    </div>
  );
}

// ───────────────────────── состояние ─────────────────────────

export interface FriendsState {
  /** null — данных нет: либо ещё грузим, либо сервер недоступен (см. `failed`). */
  data: FriendsOverview | null;
  failed: boolean;
  pending: number;
  reload: () => Promise<void>;
}

/** Список друзей и значок заявок: грузим при входе и освежаем раз в минуту на видимой вкладке. */
export function useFriends(userId: string | null): FriendsState {
  const [data, setData] = useState<FriendsOverview | null>(null);
  const [failed, setFailed] = useState(false);

  /** Ручное обновление — после действий с заявками. */
  const reload = useCallback(async () => {
    if (!userId) return;
    const d = await fetchFriends();
    if (d) { setData(d); setFailed(false); } else setFailed(true);
  }, [userId]);

  // Первая загрузка и освежение раз в минуту (только на видимой вкладке).
  // Загрузчик объявлен внутри эффекта: состояние меняется уже после await.
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    const load = async () => {
      const d = await fetchFriends();
      if (!alive) return;
      if (d) { setData(d); setFailed(false); } else setFailed(true);
    };
    void load();
    const t = setInterval(() => {
      if (typeof document === "undefined" || document.visibilityState === "visible") void load();
    }, 60_000);
    return () => { alive = false; clearInterval(t); };
  }, [userId]);

  // Без аккаунта друзей не бывает: обнуляем список выводом, а не эффектом.
  return {
    data: userId ? data : null,
    failed: userId ? failed : false,
    pending: userId ? (data?.incoming.length ?? 0) : 0,
    reload,
  };
}

// ───────────────────────── панель друзей ─────────────────────────

export function FriendsModal({ state, onClose, onUi, me }: { state: FriendsState; onClose: () => void; onUi: (k?: "click" | "open" | "close" | "paper") => void; me: string | null }) {
  const [tab, setTab] = useState<"friends" | "requests" | "search">(state.data && state.data.incoming.length ? "requests" : "friends");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [openProfile, setOpenProfile] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const d = state.data;
  // Кто сейчас в игре — наверху, остальные по алфавиту.
  const friends = useMemo(
    () => [...(d?.friends ?? [])].sort((a, b) => Number(isOnline(b.lastSeenAt)) - Number(isOnline(a.lastSeenAt)) || a.username.localeCompare(b.username, "ru")),
    [d],
  );
  const incoming = d?.incoming ?? [];
  const outgoing = d?.outgoing ?? [];

  const act = useCallback(async (action: Parameters<typeof friendAction>[0], payload: Parameters<typeof friendAction>[1], okText: string) => {
    setBusy(true); setMsg(null);
    const r = await friendAction(action, payload);
    setBusy(false);
    if (!r.ok) { setMsg({ ok: false, text: r.data.error ?? "Не получилось" }); return; }
    setMsg({ ok: true, text: r.data.message ?? okText });
    await state.reload();
  }, [state]);

  // Поиск с задержкой, чтобы не дёргать сервер на каждую букву. Все обновления
  // состояния — внутри отложенного колбэка: эффект ничего не меняет синхронно.
  useEffect(() => {
    const query = normalizeQuery(q);
    if (!query) return;
    let alive = true;
    const t = setTimeout(async () => {
      setSearching(true);
      const r = await searchPlayers(query);
      if (!alive) return;
      setSearching(false);
      if (r.ok) { setResults(r.data.results ?? []); setHint(r.data.hint ?? null); }
      else { setResults(null); setHint(r.data.error ?? "Поиск недоступен"); }
    }, 350);
    return () => { alive = false; clearTimeout(t); };
  }, [q]);

  const onQuery = (v: string) => {
    setQ(v);
    if (!normalizeQuery(v)) { setResults(null); setHint(null); setSearching(false); }
  };

  const removeFriend = (f: FriendSummary) => {
    if (!confirm(`Удалить ${f.username} из друзей?`)) return;
    void act("remove", { userId: f.userId }, "Удалено из друзей");
  };

  const tabs: [typeof tab, string, number?][] = [["friends", "Друзья", friends.length], ["requests", "Заявки", incoming.length || undefined], ["search", "Поиск"]];

  return (
    <>
      <Modal
        label="Команда"
        title="Друзья"
        onClose={onClose}
        above
        tabs={tabs.map(([id, n, badge]) => (
          <button key={id} className={`tab ${tab === id ? "on" : ""}`} onClick={() => { onUi(); setTab(id); }}>
            {n}{badge ? <span className={`num ml-1.5 ${id === "requests" ? "text-[var(--color-ok)]" : "dim"}`}>{badge}</span> : null}
          </button>
        ))}
        right={<div className="hidden text-right sm:block"><div className="label">Предел</div><div className="num text-[15px] text-[#ece6d8]">{friends.length}/{FRIEND_LIMIT}</div></div>}
      >
        <div className="min-w-0 px-4 pb-6 pt-4 sm:px-7">
          {msg && <div className={`mb-4 border-l-2 px-3 py-2 text-[12px] ${msg.ok ? "border-[var(--color-ok)] text-[#cfe3d4]" : "border-[var(--color-bad)] text-[#f0c8bc]"}`}>{msg.text}</div>}
          {!d && !me && (
            <div className="py-10 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-[var(--line-2)] text-[var(--brass)]"><Icon name="lock" size={20} /></div>
              <div className="font-serif text-[20px] text-[#ece6d8]">Нужен аккаунт</div>
              <p className="mx-auto mt-1 max-w-sm text-[12px] dim">Друзья, заявки и общие уловы живут в облаке: войдите или создайте учётную запись, чтобы найти других рыбаков.</p>
            </div>
          )}
          {!d && me && state.failed && (
            <div className="py-10 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-[var(--line-2)] text-[var(--color-bad)]"><Icon name="wave" size={20} /></div>
              <div className="font-serif text-[20px] text-[#ece6d8]">Сервер недоступен</div>
              <p className="mx-auto mt-1 max-w-sm text-[12px] dim">Список друзей не загрузился. Игра при этом продолжается: сохранение уйдёт в облако, как только связь вернётся.</p>
              <button className="btn btn-sm btn-quiet mt-4" disabled={busy} onClick={() => { onUi(); void state.reload(); }}>Повторить</button>
            </div>
          )}
          {!d && me && !state.failed && <div className="label pulse-soft py-10 text-center">Загрузка</div>}

          {tab === "friends" && (
            <>
              {me && (
                <button className="cell mb-4 flex w-full items-center gap-3 p-3 text-left transition hover:!border-[rgba(200,164,106,0.55)]" onClick={() => { onUi("paper"); setOpenProfile(me); }}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--brass)] text-[var(--brass)]"><Icon name="friends" size={18} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-[#ece6d8]">Мой профиль</span>
                    <span className="block truncate text-[11px] dim">статистика, судно и излюбленные точки — как у друзей</span>
                  </span>
                  <span className="dim">→</span>
                </button>
              )}
              {friends.length === 0 && d ? (
                <div className="py-10 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-[var(--line-2)] text-[var(--brass)]"><Icon name="friends" size={22} /></div>
                  <div className="font-serif text-[20px] text-[#ece6d8]">Пока никого</div>
                  <p className="mx-auto mt-1 max-w-sm text-[12px] dim">Найдите игрока по имени и отправьте заявку: после принятия вы увидите его статистику, лодку и где он сейчас ловит.</p>
                  <button className="btn btn-sm btn-quiet mt-4" onClick={() => { onUi(); setTab("search"); }}>Найти игроков</button>
                </div>
              ) : (
                <div className="grid gap-3 xl:grid-cols-2">
                  {friends.map((f) => <FriendCard key={f.userId} f={f} onUi={() => onUi()} onOpen={() => { onUi("paper"); setOpenProfile(f.userId); }} onRemove={() => removeFriend(f)} />)}
                </div>
              )}

              <div className="mt-6 border-t border-[var(--line)] pt-4">
                <div className="label mb-2">Приватность</div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="seg">
                    <button aria-pressed={!d?.hideLocation} className={!d?.hideLocation ? "on" : ""} disabled={busy} onClick={() => { onUi(); void act("privacy", { hideLocation: false }, "Местоположение видно друзьям"); }}>Показывать, где я</button>
                    <button aria-pressed={!!d?.hideLocation} className={d?.hideLocation ? "on" : ""} disabled={busy} onClick={() => { onUi(); void act("privacy", { hideLocation: true }, "Местоположение скрыто"); }}>Скрыть</button>
                  </div>
                  <div className="text-[11px] dim">Влияет только на друзей: карта, лодка и погода. Статистика и уловы остаются видны.</div>
                </div>
              </div>
            </>
          )}

          {tab === "requests" && (
            <div className="space-y-6">
              <div>
                <div className="label mb-2">Входящие{incoming.length ? ` · ${incoming.length}` : ""}</div>
                {incoming.length === 0 ? <div className="text-[12px] dim">Новых заявок нет.</div> : (
                  <>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="text-[11px] dim">Заявки без ответа копятся: чужие аккаунты могут завалить список.</div>
                      <button className="btn btn-sm btn-quiet shrink-0" disabled={busy} onClick={() => { onUi(); void act("clear", {}, "Все входящие заявки отклонены"); }}>Отклонить все</button>
                    </div>
                    <div className="space-y-2">
                      {incoming.map((r) => (
                        <RequestCard key={r.userId} r={r} onUi={() => onUi()}
                          onAccept={() => void act("accept", { userId: r.userId }, `${r.username} теперь в друзьях`)}
                          onDecline={() => void act("decline", { userId: r.userId }, "Заявка отклонена")} />
                      ))}
                    </div>
                  </>
                )}
              </div>
              <div>
                <div className="label mb-2">Отправленные{outgoing.length ? ` · ${outgoing.length}` : ""}</div>
                {outgoing.length === 0 ? <div className="text-[12px] dim">Вы никому не отправляли заявку.</div> : (
                  <div className="space-y-2">
                    {outgoing.map((r) => (
                      <RequestCard key={r.userId} r={r} onUi={() => onUi()}
                        onDecline={() => void act("cancel", { userId: r.userId }, "Заявка отозвана")} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "search" && (
            <div>
              <div className="label mb-2">Поиск по имени</div>
              <div className="flex min-w-0 gap-2">
                <input
                  className="field min-w-0 flex-1 !text-left" value={q} maxLength={24} placeholder="Имя пользователя" autoComplete="off"
                  onChange={(e) => onQuery(e.target.value)}
                />
                <button className="btn btn-sm btn-quiet" disabled={!normalizeQuery(q) || !me} onClick={async () => { onUi(); const r = await searchPlayers(q); if (r.ok) { setResults(r.data.results ?? []); setHint(r.data.hint ?? null); } }}>Найти</button>
              </div>
              <div className="mt-1 text-[10.5px] dim">{hint ?? "Минимум 2 символа. В результатах видно только имя, уровень и число видов — как в рейтинге."}</div>

              {searching && <div className="label pulse-soft mt-6 text-center">Ищем</div>}
              {results && !searching && (
                <div className="mt-4 space-y-2">
                  {results.length === 0 && <div className="text-[12px] dim">Никого не нашли. Проверьте имя: поиск по точному совпадению и по части имени.</div>}
                  {results.map((r) => (
                    <div key={r.userId} className="flex items-center gap-3 border border-[var(--line)] px-3 py-2.5">
                      <Avatar id={r.userId} name={r.username} size={36} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14px] text-[#ece6d8]">{r.username}{r.relation === "self" && <span className="dim"> · это вы</span>}</div>
                        <div className="num truncate text-[10.5px] dim">уровень {r.level} · {r.codexCount} видов</div>
                      </div>
                      {r.relation === "none" && <button className="btn btn-sm btn-solid" disabled={busy || friends.length >= FRIEND_LIMIT} onClick={() => { onUi(); void act("request", { username: r.username }, `Заявка отправлена: ${r.username}`); }}>Добавить</button>}
                      {r.relation === "friend" && <button className="btn btn-sm btn-quiet" onClick={() => { onUi("paper"); setOpenProfile(r.userId); }}>Профиль</button>}
                      {r.relation === "incoming" && <button className="btn btn-sm btn-solid" disabled={busy} onClick={() => { onUi(); void act("accept", { userId: r.userId }, "Заявка принята"); }}>Принять</button>}
                      {r.relation === "outgoing" && <button className="btn btn-sm btn-quiet" disabled={busy} onClick={() => { onUi(); void act("cancel", { userId: r.userId }, "Заявка отозвана"); }}>Отозвать</button>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {openProfile && <FriendProfileModal key={openProfile} userId={openProfile} self={openProfile === me} onClose={() => { onUi("close"); setOpenProfile(null); }} onUi={onUi} onChanged={state.reload} />}
    </>
  );
}

// ───────────────────────── профиль друга ─────────────────────────

export function FriendProfileModal({ userId, self = false, onClose, onUi, onChanged }: { userId: string; self?: boolean; onClose: () => void; onUi: (k?: "click" | "open" | "close" | "paper") => void; onChanged: () => Promise<void> }) {
  const [p, setP] = useState<FriendProfile | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Состояние сбрасывается перемонтированием (key={userId} у вызывающего кода),
  // поэтому в эффекте остаётся только запрос.
  useEffect(() => {
    let alive = true;
    void (async () => {
      const r = await fetchFriendProfile(userId);
      if (!alive) return;
      if (r.ok && r.data.profile) setP(r.data.profile);
      else setErr(r.data.error ?? "Профиль недоступен");
    })();
    return () => { alive = false; };
  }, [userId]);

  return (
    <Modal label={self ? "Ваша карточка" : "Профиль друга"} title={p?.username ?? "Загрузка"} above onClose={() => { onUi("close"); onClose(); }}
      right={p && !self ? <div className="hidden text-right sm:block"><div className="label">Друзья с</div><div className="num text-[13px] text-[#ece6d8]">{p.friendsSince ? new Date(p.friendsSince).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "2-digit" }) : "—"}</div></div> : undefined}>
      <div className="min-w-0 px-4 pb-7 pt-4 sm:px-7">
        {err && <div className="border-l-2 border-[var(--color-bad)] px-3 py-2 text-[12px] text-[#f0c8bc]">{err}</div>}
        {!p && !err && <div className="label pulse-soft py-12 text-center">Загрузка профиля</div>}
        {p && <ProfileBody p={p} busy={busy} onUi={onUi}
          onRemove={self ? undefined : async () => {
            if (!confirm(`Удалить ${p.username} из друзей?`)) return;
            setBusy(true);
            await friendAction("remove", { userId: p.userId });
            setBusy(false);
            await onChanged();
            onClose();
          }} />}
      </div>
    </Modal>
  );
}

function ProfileBody({ p, busy, onUi, onRemove }: { p: FriendProfile; busy: boolean; onUi: (k?: "click" | "open" | "close" | "paper") => void; onRemove?: () => void }) {
  const boat = boatOf(p.where?.boat ?? null);
  const online = isOnline(p.lastSeenAt);
  const w = p.where;
  const biggestFish = p.biggest ? FISH_BY_ID[p.biggest.fishId] : null;
  const stats = useMemo(() => [
    { label: "Уровень", value: String(p.level), accent: true },
    { label: "Видов в кодексе", value: String(p.codexCount) },
    { label: "Поймано рыб", value: fmt(p.totalCaught) },
    { label: "Средства", value: `${fmt(p.money)} ₽` },
    { label: "На воде", value: playTimeLabel(p.playSeconds) },
    { label: "Достижений", value: String(p.achievements) },
    { label: "Мировых рекордов", value: String(p.recordsHeld), accent: p.recordsHeld > 0 },
    { label: "Заказов выполнено", value: String(p.ordersDone) },
    { label: "Судов во флоте", value: String(p.boatsOwned) },
    { label: "Аккаунт с", value: p.accountSince ? new Date(p.accountSince).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" }) : "—" },
  ], [p]);

  return (
    <div className="min-w-0 space-y-6">
      {/* шапка */}
      <div className="flex min-w-0 flex-wrap items-center gap-4">
        <Avatar id={p.userId} name={p.username} size={62} online={online} />
        <div className="min-w-0 flex-1">
          <h3 className="font-serif truncate text-[28px] leading-tight text-[#f4eee0]">{p.username}</h3>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px]">
            <span className={online ? "text-[var(--color-ok)]" : "dim"}>
              {online ? "в игре сейчас" : `был ${lastSeenLabel(p.lastSeenAt)}`}
              <span className="dim"> ·</span>
            </span>
            <span className={w?.hidden ? "dim italic" : "text-[#d8d1c2]"}>
              {whereLabel(w)}
              {w?.weatherName && <span className="dim"> · {w.weatherName}</span>}
              {w?.gameDay && <span className="dim"> · {dayLabel(w.gameDay)}</span>}
            </span>
          </div>
        </div>
        {onRemove && <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => { onUi(); onRemove(); }}>Удалить из друзей</button>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        {/* где он и на чём */}
        <div className="space-y-4">
          <div>
            <div className="label mb-2">Последняя точка</div>
            <FriendChart where={w} boat={boat} />
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] dim">
              {w?.atPort && w.portName ? <span className="flex items-center gap-1.5"><Icon name="anchor" size={13} /> в порту {w.portName}</span> : null}
              {w?.locationName && !w.atPort ? <span className="flex items-center gap-1.5"><Icon name="compass" size={13} /> {w.locationName}{w.spotName ? ` · ${w.spotName}` : ""}</span> : null}
              {w?.weather && <span className="flex items-center gap-1.5"><Icon name={WEATHER_ICON[w.weather]} size={13} /> {w.weatherName}</span>}
              {w?.updatedAt ? <span>· снято {lastSeenLabel(w.updatedAt)}</span> : null}
            </div>
          </div>

          <div>
            <div className="label mb-2">Судно</div>
            {boat ? (
              <div className="border border-[var(--line)] bg-[rgba(6,13,19,0.55)] p-3">
                <BoatPreview hull={boat.hull} trim={boat.trim} tier={boat.tier} style={boat.style} className="h-28 w-full" />
                <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
                  <div className="font-serif text-[19px] text-[#f1ebdd]">{boat.name}</div>
                  <div className="num text-[11px] text-[var(--brass-2,#e3c996)]">класс {boat.tier}</div>
                </div>
                <p className="mt-1 text-[12px] muted">{boat.desc}</p>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[11.5px] sm:grid-cols-3">
                  {[["Трюм", `${boat.cooler}`], ["Остойчивость", `${Math.round(boat.stability * 100)}%`], ["Ход", `×${boat.travelMult}`],
                    ["Топливо", boat.fuel ? `${boat.fuel} ₽/ч` : "не нужно"], ["Шторм", boat.stormSafe ? "выдерживает" : "не для шторма"], ["Редкие", boat.rareBonus ? `+${Math.round(boat.rareBonus * 100)}%` : "—"]].map(([k, v]) => (
                    <div key={k} className="flex min-w-0 flex-wrap justify-between gap-x-3 gap-y-1 border-b border-[var(--line)] py-1"><dt className="dim">{k}</dt><dd className="num break-words text-right text-[#ddd7ca]">{v}</dd></div>
                  ))}
                </dl>
                <div className="mt-2 text-[11px] dim">Особое: {boat.special}</div>
              </div>
            ) : (
              <div className="border border-[var(--line)] px-3 py-6 text-center text-[12px] dim">
                {w?.hidden ? "Игрок скрыл, на чём он сейчас в море." : "Судно ещё не сохранено — он не выходил в море."}
              </div>
            )}
          </div>
        </div>

        {/* статистика */}
        <div className="space-y-4">
          <div>
            <div className="label mb-2">Прогресс</div>
            <div className="grid grid-cols-2 gap-2">
              {stats.map((s) => <Stat key={s.label} label={s.label} value={s.value} accent={s.accent} />)}
            </div>
          </div>

          {(p.favoriteLocation || biggestFish) && (
            <div>
              <div className="label mb-2">Промысел</div>
              <div className="space-y-1.5 text-[12px]">
                {p.favoriteLocation && <div className="flex min-w-0 flex-wrap justify-between gap-x-3 gap-y-1 border-b border-[var(--line)] py-1.5"><span className="dim">Чаще всего ловит</span><span className="break-words text-right text-[#ddd7ca]">{p.favoriteLocation.name} <span className="num dim">· {p.favoriteLocation.count}</span></span></div>}
                {biggestFish && p.biggest && <div className="flex min-w-0 flex-wrap justify-between gap-x-3 gap-y-1 border-b border-[var(--line)] py-1.5"><span className="dim">Самая крупная</span><span className="break-words text-right text-[#ddd7ca]">{biggestFish.name} <span className="num">· {fmtW(p.biggest.weight)}</span></span></div>}
                {p.recordsHeld > 0 && <div className="flex min-w-0 flex-wrap justify-between gap-x-3 gap-y-1 border-b border-[var(--line)] py-1.5"><span className="dim">Рекорды</span><span className="break-words text-right text-[var(--brass-2,#e3c996)]">держит {p.recordsHeld} мировых</span></div>}
              </div>
            </div>
          )}

          <div>
            <div className="label mb-2">Лучшие уловы</div>
            {p.best.length ? p.best.map((c, i) => <CatchRow key={`b${i}`} c={c} big={i === 0} />) : <div className="text-[12px] dim">Пока нет записанных уловов.</div>}
          </div>

          <div>
            <div className="label mb-2">Последние уловы</div>
            {p.recent.length ? p.recent.map((c, i) => <CatchRow key={`r${i}`} c={c} />) : <div className="text-[12px] dim">Пусто.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
