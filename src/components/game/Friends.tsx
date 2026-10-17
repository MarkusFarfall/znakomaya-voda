"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { FISH_BY_ID } from "@/game/fish";
import { LOCATIONS, LOC_POS, PORTS, PORT_BY_ID } from "@/game/world";
import {
  avatarHue, boatOf, dayLabel, initialsOf, isOnline, lastSeenLabel, locOf, normalizeQuery,
  playTimeLabel, rankFleet, whereLabel, FRIEND_LIMIT,
  type FleetMetric, type FriendCatch, type FriendProfile, type FriendRequestRow, type FriendSummary,
  type FriendsOverview, type RankedFleetMember, type SearchResult,
} from "@/game/friends";
import { fetchFriendProfile, fetchFriends, friendAction, searchPlayers } from "@/game/persist";
import type { BoatDef, LocId, PortId, Variant } from "@/game/types";
import { fmt, fmtW, Modal } from "./Panels";
import { Icon, WEATHER_ICON } from "./Icons";
import { BoatPreview } from "./Panels";
import { FishIcon } from "./FishIcon";

// ───────────────────────── helpers ─────────────────────────

type SocialView = "overview" | "fleet" | "league" | "requests" | "discover";
type FleetFilter = "all" | "online" | "sea" | "port" | "recent";
type FleetSort = "active" | "level" | "codex" | "catches";
type SocialMember = FriendSummary & { isMe?: boolean };
type FleetArea = { key: string; position: [number, number]; locationId: LocId | null; portId: PortId | null; members: SocialMember[] };

const NAV_ITEMS: { id: SocialView; label: string; icon: string }[] = [
  { id: "overview", label: "Обзор", icon: "compass" },
  { id: "fleet", label: "Экипаж", icon: "friends" },
  { id: "league", label: "Лига", icon: "medal" },
  { id: "requests", label: "Заявки", icon: "order" },
  { id: "discover", label: "Найти", icon: "sonar" },
];

const METRICS: { id: FleetMetric; label: string; short: string; icon: string; note: string }[] = [
  { id: "level", label: "Уровень", short: "УРОВЕНЬ", icon: "star", note: "развитие капитана" },
  { id: "codex", label: "Виды в кодексе", short: "КОДЕКС", icon: "book", note: "полнота коллекции" },
  { id: "catches", label: "Поймано рыб", short: "УЛОВ", icon: "fish", note: "всего зарегистрировано" },
  { id: "achievements", label: "Достижения", short: "ЗНАКИ", icon: "medal", note: "полученные награды" },
  { id: "playtime", label: "Время на воде", short: "ВРЕМЯ", icon: "clock", note: "проведено в игре" },
];

function areaKey(where: FriendSummary["where"]): string | null {
  if (!where || where.hidden) return null;
  if (where.atPort && where.port) return `port:${where.port}`;
  if (where.location) return `loc:${where.location}`;
  return null;
}

function areaLabel(key: string): string {
  const [kind, id] = key.split(":");
  if (kind === "port") return PORT_BY_ID[id as PortId]?.name ?? "Порт";
  return LOCATIONS.find((location) => location.id === id)?.name ?? "Акватория";
}

function pointFor(where: FriendSummary["where"]): [number, number] | null {
  if (!where || where.hidden) return null;
  if (where.atPort && where.port) return PORT_BY_ID[where.port]?.pos ?? null;
  return where.location ? LOC_POS[where.location] ?? null : null;
}

function metricLabel(metric: FleetMetric, value: number): string {
  if (metric === "playtime") return playTimeLabel(value);
  if (metric === "level") return `${fmt(value)} ур.`;
  if (metric === "codex") return `${fmt(value)} видов`;
  if (metric === "catches") return `${fmt(value)} рыб`;
  return `${fmt(value)} знаков`;
}

function safeTime(iso: string | null | undefined): number {
  const value = iso ? new Date(iso).getTime() : 0;
  return Number.isFinite(value) ? value : 0;
}

// ───────────────────────── карта флота ─────────────────────────

/** Общая схема акваторий. Отображает только последние сохранённые точки, приватность соблюдается. */
function FleetMap({ members, selectedArea, onSelectArea }: { members: SocialMember[]; selectedArea: string | null; onSelectArea: (area: string | null) => void }) {
  const mapId = `fleet-map-${useId().replace(/:/g, "")}`;
  const areas = useMemo(() => {
    const grouped = new Map<string, FleetArea>();
    for (const member of members) {
      const key = areaKey(member.where);
      const position = pointFor(member.where);
      if (!key || !position || !member.where) continue;
      const existing = grouped.get(key);
      if (existing) existing.members.push(member);
      else grouped.set(key, {
        key,
        position,
        locationId: member.where.atPort ? null : member.where.location,
        portId: member.where.atPort ? member.where.port : null,
        members: [member],
      });
    }
    return [...grouped.values()].sort((a, b) => a.key.localeCompare(b.key));
  }, [members]);

  return (
    <div className="friends-fleet-map" aria-label="Последние сохранённые позиции экипажа">
      <svg className="friends-fleet-map-art" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <pattern id={`${mapId}-grid`} width="8" height="8" patternUnits="userSpaceOnUse"><path d="M8 0H0V8" fill="none" stroke="#b2ddd4" strokeOpacity=".11" strokeWidth=".18" /></pattern>
          <pattern id={`${mapId}-ice`} width="1.7" height="1.7" patternUnits="userSpaceOnUse"><path d="M0 1.7L1.7 0" stroke="#d9eee6" strokeOpacity=".22" strokeWidth=".16" /></pattern>
          <radialGradient id={`${mapId}-glow`} cx="48%" cy="49%" r="68%"><stop stopColor="#177d75" stopOpacity=".2" /><stop offset="1" stopColor="#06191d" stopOpacity="0" /></radialGradient>
        </defs>
        <rect width="100" height="100" fill="#07191d" />
        <rect width="100" height="100" fill={`url(#${mapId}-glow)`} />
        <rect width="100" height="100" fill={`url(#${mapId}-grid)`} />
        <path d="M0 0h26c-3 4-8 4-9 8-1 4 6 5 5 9-1 4-8 4-8 8 0 5 8 6 7 10-1 4-8 5-7 9 1 4 7 5 5 9-2 5-9 5-8 10 1 4 6 6 4 10-2 4-8 5-7 9l3 9-11 2z" fill="#182d2b" stroke="#adcac159" strokeWidth=".3" />
        <path d="M0 83c12 0 17-3 26-2 6 1 8 4 14 5 7 1 11-3 17-2 6 1 11 6 18 5 8-1 14-5 25-5v16H0z" fill={`url(#${mapId}-ice)`} stroke="#b5d4ce66" strokeWidth=".35" />
        <path d="M9 74C17 61 23 55 31 48S45 38 53 42 65 57 74 52 87 36 94 26" fill="none" stroke="#9ed5ca" strokeOpacity=".28" strokeWidth=".35" strokeDasharray="1.2 1.3" />
        {[0, 1, 2, 3].map((index) => <ellipse key={index} cx="79" cy="28" rx={7 + index * 4} ry={3.8 + index * 2.2} fill="none" stroke="#a9d5d0" strokeOpacity=".12" strokeWidth=".2" />)}
      </svg>

      {LOCATIONS.map((location) => {
        const [x, y] = LOC_POS[location.id];
        return <span key={location.id} className="friends-map-place" style={{ left: `${x}%`, top: `${y}%` }} title={location.name} aria-hidden="true"><i />{location.name}</span>;
      })}
      {PORTS.map((port) => <span key={port.id} className="friends-map-port" style={{ left: `${port.pos[0]}%`, top: `${port.pos[1]}%` }} title={port.name} aria-hidden="true"><i /></span>)}

      {areas.map((area) => {
        const names = area.members.map((member) => member.isMe ? "Вы" : member.username).join(", ");
        const online = area.members.some((member) => isOnline(member.lastSeenAt));
        return (
          <button
            key={area.key}
            type="button"
            className={`friends-map-marker ${selectedArea === area.key ? "is-selected" : ""} ${online ? "is-live" : ""}`}
            style={{ left: `${area.position[0]}%`, top: `${area.position[1]}%` }}
            title={`${areaLabel(area.key)}: ${names}`}
            aria-label={`${areaLabel(area.key)}: ${names}. Показать в экипаже`}
            onClick={() => onSelectArea(selectedArea === area.key ? null : area.key)}
          >
            <span className="friends-map-marker-core"><Icon name={area.portId ? "anchor" : "boat"} size={14} /></span>
            {area.members.length > 1 && <b>{area.members.length}</b>}
          </button>
        );
      })}
      {areas.length === 0 && <div className="friends-map-empty"><Icon name="map" size={20} /><span>Пока нет сохранённых точек на карте</span></div>}
      <div className="friends-map-compass" aria-hidden="true"><span>N</span><Icon name="arrowR" size={14} /></div>
      <div className="friends-map-scale" aria-hidden="true"><span /> 1 000 миль</div>
    </div>
  );
}

/** Персональная карта участника — схема, а не точная навигационная карта. */
export function FriendChart({ where, boat, compact = false }: { where: FriendSummary["where"]; boat: BoatDef | null; compact?: boolean }) {
  const chartId = `friend-chart-${useId().replace(/:/g, "")}`;
  const target = pointFor(where);
  const hidden = !!where?.hidden;
  return (
    <div className={`friends-chart ${compact ? "is-compact" : ""}`}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <pattern id={`${chartId}-grid`} width="8" height="8" patternUnits="userSpaceOnUse"><path d="M8 0H0V8" fill="none" stroke="#b2ddd4" strokeOpacity=".12" strokeWidth=".18" /></pattern>
          <radialGradient id={`${chartId}-deep`} cx="78%" cy="35%" r="60%"><stop stopColor="#061115" /><stop offset="1" stopColor="#0b2023" stopOpacity="0" /></radialGradient>
        </defs>
        <rect width="100" height="100" fill="#0b2023" />
        <rect width="100" height="100" fill={`url(#${chartId}-grid)`} />
        <rect width="100" height="100" fill={`url(#${chartId}-deep)`} />
        <path d="M0 0h24c-3 5-8 5-9 10s6 5 5 10-8 4-8 9 7 7 5 11-8 4-7 9 6 6 4 10-8 6-6 12l3 8H0z" fill="#20302a" stroke="#c8d8bd45" strokeWidth=".35" />
        <path d="M0 86c11-3 17-1 25 1s13 2 21 0 13 0 19 3 12 3 19 1 11-2 16-1v10H0z" fill="#cfe1d738" stroke="#cfe1d750" strokeWidth=".35" />
        <path d="M12 72C23 60 28 53 40 49s20-1 28 3 16 1 26-12" fill="none" stroke="#9ed5ca" strokeOpacity=".22" strokeWidth=".4" strokeDasharray="1.4 1.8" />
        {LOCATIONS.map((location) => {
          const [x, y] = LOC_POS[location.id];
          return <rect key={location.id} x={x - 0.5} y={y - 0.5} width="1" height="1" transform={`rotate(45 ${x} ${y})`} fill="#d8e4d7" fillOpacity=".4" />;
        })}
      </svg>
      {target && !hidden && <span className="friends-chart-pin" style={{ left: `${target[0]}%`, top: `${target[1]}%` }}><i /><Icon name={where?.atPort ? "anchor" : "boat"} size={16} /></span>}
      <div className="friends-chart-stamp"><Icon name={hidden ? "lock" : where?.atPort ? "anchor" : "compass"} size={13} />{hidden ? "Координаты закрыты" : whereLabel(where)}</div>
      {!hidden && boat && <div className="friends-chart-boat">{boat.name} · класс {boat.tier}</div>}
      {hidden && <div className="friends-chart-veil"><Icon name="lock" size={17} /><span>Местоположение скрыто</span></div>}
      {!where && <div className="friends-chart-veil"><Icon name="compass" size={17} /><span>Воды ещё не отмечены</span></div>}
    </div>
  );
}

function Avatar({ id, name, size = 44, online, self = false }: { id: string; name: string; size?: number; online?: boolean; self?: boolean }) {
  const hue = avatarHue(id);
  return (
    <span
      className={`friends-avatar ${online ? "is-online" : ""} ${self ? "is-self" : ""}`}
      style={{
        width: size, height: size, fontSize: Math.round(size * 0.34),
        background: `radial-gradient(circle at 32% 28%, hsl(${hue} 52% 42%), hsl(${hue} 42% 17%))`,
      }}
      aria-hidden="true"
    >
      {initialsOf(name)}
      {online && <i className="friends-avatar-presence" />}
    </span>
  );
}

function WhereLine({ f }: { f: FriendSummary }) {
  const online = isOnline(f.lastSeenAt);
  const w = f.where;
  return (
    <div className="friends-where-line">
      <span className={`friends-where-copy ${w?.hidden ? "is-private" : ""}`}>
        <Icon name={w?.hidden ? "lock" : w?.atPort ? "anchor" : "pin"} size={13} />
        <span className="truncate">{whereLabel(w)}</span>
        {!w?.hidden && w?.weather && <Icon name={WEATHER_ICON[w.weather]} size={13} />}
      </span>
      <span className={`friends-presence ${online ? "is-online" : ""}`}>
        <i />{online ? "В игре" : lastSeenLabel(f.lastSeenAt)}
      </span>
    </div>
  );
}

function NumberTile({ icon, label, value, accent = false, foot }: { icon: string; label: string; value: string; accent?: boolean; foot?: string }) {
  return (
    <div className={`friends-number-tile ${accent ? "is-accent" : ""}`}>
      <div className="friends-number-top"><Icon name={icon} size={16} /><span>{label}</span></div>
      <strong>{value}</strong>
      {foot && <small>{foot}</small>}
    </div>
  );
}

function CatchRow({ c, big = false }: { c: FriendCatch; big?: boolean }) {
  const fish = FISH_BY_ID[c.fishId];
  const location = locOf(c.locationId);
  return (
    <div className={`friends-catch-row ${big ? "is-best" : ""}`}>
      <span className="friends-catch-art">{fish ? <FishIcon fish={fish} size={big ? 58 : 46} variant={(c.variant as Variant | null) ?? null} /> : <Icon name="fish" size={22} />}</span>
      <div className="friends-catch-copy">
        <strong>{fish?.name ?? "Неизвестный вид"}</strong>
        <small>{location?.name ?? c.locationId}{c.gameDay ? ` · день ${c.gameDay}` : ""}</small>
      </div>
      <b className="friends-catch-weight">{fmtW(c.weight)}</b>
    </div>
  );
}

function MessageBanner({ message }: { message: { ok: boolean; text: string } | null }) {
  if (!message) return null;
  return <div className={`friends-message ${message.ok ? "is-ok" : "is-error"}`} role="status" aria-live="polite"><Icon name={message.ok ? "check" : "wave"} size={16} /><span>{message.text}</span></div>;
}

function PrivacyCard({ hidden, busy, onSet }: { hidden: boolean; busy: boolean; onSet: (hide: boolean) => void }) {
  return (
    <section className="friends-privacy-card">
      <div className="friends-card-heading"><span className="friends-mini-icon"><Icon name={hidden ? "lock" : "pin"} size={16} /></span><div><div className="friends-kicker">ПРИВАТНОСТЬ</div><h3>Координаты под контролем</h3></div></div>
      <p>{hidden ? "Экипаж видит вашу статистику, но не место стоянки." : "Друзья видят последнюю сохранённую акваторию и порт."}</p>
      <div className="friends-privacy-toggle" role="group" aria-label="Видимость местоположения">
        <button type="button" aria-pressed={!hidden} className={!hidden ? "is-active" : ""} disabled={busy} onClick={() => onSet(false)}><Icon name="pin" size={14} />На карте</button>
        <button type="button" aria-pressed={hidden} className={hidden ? "is-active" : ""} disabled={busy} onClick={() => onSet(true)}><Icon name="lock" size={14} />Скрыть</button>
      </div>
    </section>
  );
}

function FriendCard({ f, onOpen, onRemove, onUi }: { f: FriendSummary; onOpen: () => void; onRemove: () => void; onUi: () => void }) {
  const boat = f.where?.hidden ? null : boatOf(f.where?.boat ?? null);
  const online = isOnline(f.lastSeenAt);
  return (
    <article className="friends-friend-card">
      <div className="friends-friend-topline"><span className={`friends-status-chip ${online ? "is-live" : ""}`}><i />{online ? "В СЕТИ" : "НА СВЯЗИ ПОЗЖЕ"}</span><span className="friends-since">{f.friendsSince ? `в экипаже с ${new Date(f.friendsSince).toLocaleDateString("ru-RU", { month: "short", year: "2-digit" })}` : "член экипажа"}</span></div>
      <button type="button" className="friends-friend-identity" onClick={() => { onUi(); onOpen(); }} aria-label={`Открыть паспорт ${f.username}`}>
        <Avatar id={f.userId} name={f.username} size={54} online={online} />
        <span className="friends-friend-name-wrap"><strong>{f.username}</strong><small>Капитан · уровень {f.level}</small></span>
        <span className="friends-friend-arrow"><Icon name="arrowR" size={17} /></span>
      </button>
      <WhereLine f={f} />
      <div className="friends-friend-stats">
        <div><b>{fmt(f.codexCount)}</b><small>видов</small></div>
        <div><b>{fmt(f.totalCaught)}</b><small>уловов</small></div>
        <div><b>{fmt(f.achievements)}</b><small>знаков</small></div>
      </div>
      <div className="friends-friend-footer">
        <span>{boat ? <><Icon name="boat" size={13} />{boat.name}</> : <><Icon name="wave" size={13} />{f.where?.hidden ? "Судно скрыто" : "Пока без судна"}</>}</span>
        <div>
          <button type="button" className="friends-quiet-action" onClick={() => { onUi(); onOpen(); }}>Паспорт</button>
          <button type="button" className="friends-remove-action" aria-label={`Удалить ${f.username} из друзей`} onClick={() => { onUi(); onRemove(); }}>Удалить</button>
        </div>
      </div>
    </article>
  );
}

function RequestCard({ r, incoming, busy, onAccept, onRemove, onUi }: { r: FriendRequestRow; incoming: boolean; busy: boolean; onAccept?: () => void; onRemove: () => void; onUi: () => void }) {
  return (
    <article className="friends-request-card">
      <Avatar id={r.userId} name={r.username} size={46} />
      <div className="friends-request-copy"><strong>{r.username}</strong><small>Уровень {r.level} <i>·</i> кодекс {r.codexCount} видов <i>·</i> {incoming ? `поступила ${lastSeenLabel(r.createdAt)}` : `отправлена ${lastSeenLabel(r.createdAt)}`}</small></div>
      <div className="friends-request-actions">
        {incoming && onAccept && <button type="button" className="friends-action-primary" disabled={busy} onClick={() => { onUi(); onAccept(); }}><Icon name="check" size={15} />Принять</button>}
        <button type="button" className="friends-action-secondary" disabled={busy} onClick={() => { onUi(); onRemove(); }}>{incoming ? "Отклонить" : "Отозвать"}</button>
      </div>
    </article>
  );
}

function MiniCrewMember({ member, onOpen }: { member: SocialMember; onOpen: () => void }) {
  const online = isOnline(member.lastSeenAt);
  return (
    <button type="button" className="friends-mini-member" onClick={onOpen} aria-label={`Открыть паспорт ${member.isMe ? "ваш" : member.username}`}>
      <Avatar id={member.userId} name={member.username} size={36} online={online} self={member.isMe} />
      <span><b>{member.isMe ? "Вы" : member.username}</b><small>{online ? "В эфире" : lastSeenLabel(member.lastSeenAt)}</small></span>
    </button>
  );
}

function LeaderRow({ member, metric, maximum, onOpen }: { member: RankedFleetMember<SocialMember>; metric: FleetMetric; maximum: number; onOpen: () => void }) {
  const width = maximum > 0 ? Math.max(6, Math.min(100, member.value / maximum * 100)) : 6;
  return (
    <button type="button" className={`friends-leader-row ${member.isMe ? "is-self" : ""}`} onClick={onOpen}>
      <span className={`friends-leader-rank rank-${member.rank <= 3 ? member.rank : "other"}`}>{String(member.rank).padStart(2, "0")}</span>
      <Avatar id={member.userId} name={member.username} size={34} online={isOnline(member.lastSeenAt)} self={member.isMe} />
      <span className="friends-leader-person"><b>{member.isMe ? "Вы" : member.username}</b><i><span style={{ width: `${width}%` }} /></i></span>
      <strong>{metricLabel(metric, member.value)}</strong>
    </button>
  );
}

function EmptyCard({ icon, title, text, action }: { icon: string; title: string; text: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="friends-empty-card"><span className="friends-empty-icon"><Icon name={icon} size={22} /></span><h3>{title}</h3><p>{text}</p>{action && <button type="button" className="friends-action-primary" onClick={action.onClick}>{action.label}<Icon name="arrowR" size={15} /></button>}</div>
  );
}

// ───────────────────────── состояние и загрузка ─────────────────────────

export interface FriendsState {
  data: FriendsOverview | null;
  failed: boolean;
  pending: number;
  reload: () => Promise<void>;
}

/** Список друзей и значок входящих заявок обновляются раз в минуту на видимой вкладке. */
export function useFriends(userId: string | null): FriendsState {
  const [snapshot, setSnapshot] = useState<{ userId: string; data: FriendsOverview } | null>(null);
  const [failedUserId, setFailedUserId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!userId) return;
    const data = await fetchFriends();
    if (data) {
      setSnapshot({ userId, data });
      setFailedUserId(null);
    } else setFailedUserId(userId);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    const load = async () => {
      const data = await fetchFriends();
      if (!alive) return;
      if (data) {
        setSnapshot({ userId, data });
        setFailedUserId(null);
      } else setFailedUserId(userId);
    };
    void load();
    const timer = setInterval(() => {
      if (typeof document === "undefined" || document.visibilityState === "visible") void load();
    }, 60_000);
    return () => { alive = false; clearInterval(timer); };
  }, [userId]);

  const data = userId && snapshot?.userId === userId ? snapshot.data : null;
  return {
    data,
    failed: !!userId && failedUserId === userId,
    pending: data?.incoming.length ?? 0,
    reload,
  };
}

// ───────────────────────── главный клуб ─────────────────────────

export function FriendsModal({ state, onClose, onUi, me }: { state: FriendsState; onClose: () => void; onUi: (k?: "click" | "open" | "close" | "paper") => void; me: string | null }) {
  const [view, setView] = useState<SocialView>("overview");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<FriendSummary | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [metric, setMetric] = useState<FleetMetric>("level");
  const [filter, setFilter] = useState<FleetFilter>("all");
  const [sort, setSort] = useState<FleetSort>("active");
  const [fleetQuery, setFleetQuery] = useState("");
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchHint, setSearchHint] = useState<string | null>(null);
  const [selfSnapshot, setSelfSnapshot] = useState<{ userId: string; profile: FriendProfile } | null>(null);
  const [clockNow, setClockNow] = useState<number | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchSequence = useRef(0);
  const d = state.data;
  const reloadFriends = state.reload;
  const friends = useMemo(
    () => [...(d?.friends ?? [])].sort((a, b) => Number(isOnline(b.lastSeenAt)) - Number(isOnline(a.lastSeenAt)) || safeTime(b.lastSeenAt) - safeTime(a.lastSeenAt) || a.username.localeCompare(b.username, "ru")),
    [d?.friends],
  );
  const incoming = d?.incoming ?? [];
  const outgoing = d?.outgoing ?? [];
  const selfProfile = selfSnapshot?.userId === me ? selfSnapshot.profile : null;
  const members = useMemo<SocialMember[]>(() => [
    ...friends.map((f) => ({ ...f, isMe: false })),
    ...(selfProfile ? [{ ...selfProfile, isMe: true }] : []),
  ], [friends, selfProfile]);
  const onlineFriends = useMemo(() => friends.filter((friend) => isOnline(friend.lastSeenAt)), [friends]);
  const sailingCount = friends.filter((friend) => friend.where && !friend.where.hidden && !friend.where.atPort).length;
  const atPortCount = friends.filter((friend) => friend.where && !friend.where.hidden && friend.where.atPort).length;
  const friendLimit = d?.limit ?? FRIEND_LIMIT;
  const ranked = useMemo(() => rankFleet(members, metric), [members, metric]);
  const levelRanked = useMemo(() => rankFleet(members, "level"), [members]);
  const myRank = ranked.find((member) => member.isMe);

  useEffect(() => {
    if (!me) return;
    let alive = true;
    void fetchFriendProfile(me).then((response) => {
      if (alive && response.ok && response.data.profile) setSelfSnapshot({ userId: me, profile: response.data.profile });
    }).catch(() => undefined);
    return () => { alive = false; };
  }, [me]);

  useEffect(() => {
    const initial = setTimeout(() => setClockNow(Date.now()), 0);
    const interval = setInterval(() => setClockNow(Date.now()), 30_000);
    return () => { clearTimeout(initial); clearInterval(interval); };
  }, []);

  const loadSelf = useCallback(async () => {
    if (!me) return;
    const response = await fetchFriendProfile(me);
    if (response.ok && response.data.profile) setSelfSnapshot({ userId: me, profile: response.data.profile });
  }, [me]);

  const runSearch = useCallback(async (normalizedQuery: string) => {
    const sequence = ++searchSequence.current;
    setSearching(true);
    setSearchHint(null);
    try {
      const response = await searchPlayers(normalizedQuery);
      if (searchSequence.current !== sequence) return;
      setSearching(false);
      if (response.ok) {
        setResults(response.data.results ?? []);
        setSearchHint(response.data.hint ?? null);
      } else {
        setResults(null);
        setSearchHint(response.data.error ?? "Поиск недоступен");
      }
    } catch {
      if (searchSequence.current !== sequence) return;
      setSearching(false);
      setResults(null);
      setSearchHint("Связь с сервером потеряна. Попробуйте ещё раз.");
    }
  }, []);

  useEffect(() => () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchSequence.current += 1;
  }, []);

  const act = useCallback(async (action: Parameters<typeof friendAction>[0], payload: Parameters<typeof friendAction>[1], okText: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await friendAction(action, payload);
      if (!response.ok) {
        setMessage({ ok: false, text: response.data.error ?? "Не получилось выполнить действие" });
        return;
      }
      setMessage({ ok: true, text: response.data.message ?? okText });
      await reloadFriends();
      if (action === "request" || action === "accept" || action === "decline" || action === "cancel" || action === "remove") {
        const normalized = normalizeQuery(query);
        if (view === "discover" && normalized) void runSearch(normalized);
      }
    } catch {
      setMessage({ ok: false, text: "Не удалось связаться с сервером. Попробуйте ещё раз." });
    } finally {
      setBusy(false);
    }
  }, [query, reloadFriends, runSearch, view]);

  const refresh = async () => {
    onUi();
    setRefreshing(true);
    try {
      await reloadFriends();
      await loadSelf();
      setMessage({ ok: true, text: "Сводка экипажа обновлена" });
    } catch {
      setMessage({ ok: false, text: "Обновить список не удалось" });
    } finally {
      setRefreshing(false);
    }
  };

  const handleSearchInput = (value: string) => {
    setQuery(value);
    setSearchHint(null);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const normalized = normalizeQuery(value);
    if (!normalized) {
      searchSequence.current += 1;
      setResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(() => {
      searchTimer.current = null;
      void runSearch(normalized);
    }, 360);
  };

  const submitSearch = (event?: { preventDefault: () => void }) => {
    event?.preventDefault();
    const normalized = normalizeQuery(query);
    if (!normalized || !me) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = null;
    void runSearch(normalized);
  };

  const setPrivacy = (hideLocation: boolean) => {
    onUi();
    void act("privacy", { hideLocation }, hideLocation ? "Местоположение скрыто от друзей" : "Местоположение снова видно экипажу");
  };

  const visibleFriends = useMemo(() => {
    const localQuery = fleetQuery.trim().toLocaleLowerCase("ru-RU");
    return friends.filter((friend) => {
      if (filter === "online" && !isOnline(friend.lastSeenAt)) return false;
      if (filter === "sea" && (!friend.where || friend.where.hidden || friend.where.atPort)) return false;
      if (filter === "port" && (!friend.where || friend.where.hidden || !friend.where.atPort)) return false;
      if (filter === "recent" && clockNow !== null && clockNow - safeTime(friend.lastSeenAt) > 86_400_000) return false;
      if (selectedArea && areaKey(friend.where) !== selectedArea) return false;
      if (localQuery && !friend.username.toLocaleLowerCase("ru-RU").includes(localQuery)) return false;
      return true;
    }).sort((a, b) => {
      if (sort === "level") return b.level - a.level || a.username.localeCompare(b.username, "ru");
      if (sort === "codex") return b.codexCount - a.codexCount || a.username.localeCompare(b.username, "ru");
      if (sort === "catches") return b.totalCaught - a.totalCaught || a.username.localeCompare(b.username, "ru");
      return Number(isOnline(b.lastSeenAt)) - Number(isOnline(a.lastSeenAt)) || safeTime(b.lastSeenAt) - safeTime(a.lastSeenAt) || a.username.localeCompare(b.username, "ru");
    });
  }, [friends, filter, selectedArea, fleetQuery, sort, clockNow]);

  const navCount = (id: SocialView) => id === "fleet" ? friends.length : id === "requests" ? incoming.length : undefined;

  return (
    <>
      <Modal
        label="СОЦИАЛЬНАЯ КАРТА · ЗНАКОМАЯ ВОДА"
        title="Штурманский клуб"
        onClose={onClose}
        above
        className="friends-dialog"
        overlayClassName="friends-overlay"
        right={<div className="friends-header-count"><span>СЕТЬ</span><b>{d ? `${friends.length}/${friendLimit}` : "—"}</b></div>}
      >
        <div className="friends-shell">
          <MessageBanner message={message} />
          {(removeTarget || confirmClear) && (
            <div className="friends-confirm" role="alertdialog" aria-live="assertive">
              <span className="friends-confirm-icon"><Icon name="lock" size={18} /></span>
              <div><strong>{removeTarget ? `Удалить ${removeTarget.username} из экипажа?` : "Отклонить все входящие заявки?"}</strong><small>{removeTarget ? "Игрок исчезнет из списка, но его игровой прогресс не изменится." : "Все неотвеченные входящие заявки будут удалены."}</small></div>
              <button type="button" className="friends-action-secondary" onClick={() => { setRemoveTarget(null); setConfirmClear(false); }}>Отмена</button>
              <button type="button" className="friends-action-danger" disabled={busy} onClick={() => {
                if (removeTarget) {
                  const target = removeTarget;
                  setRemoveTarget(null);
                  void act("remove", { userId: target.userId }, `${target.username} удалён из друзей`);
                } else {
                  setConfirmClear(false);
                  void act("clear", {}, "Входящие заявки отклонены");
                }
              }}>Подтвердить</button>
            </div>
          )}

          <section className="friends-hero">
            <div className="friends-hero-copy">
              <div className="friends-hero-kicker"><span><Icon name="sonar" size={15} /></span>КРУГ СВОИХ · СВЯЗЬ С ЭКИПАЖЕМ</div>
              <h2>В море каждый сам за себя.<br /><em>В клубе ты не один.</em></h2>
              <p>Соберите знакомых капитанов, следите за их рейсами и сравнивайте трофеи без выхода из игры.</p>
              <div className="friends-hero-actions">
                <button type="button" className="friends-hero-primary" onClick={() => { onUi(); setView("discover"); }} disabled={!me}><Icon name="friends" size={16} />Найти экипаж</button>
                {me && <button type="button" className="friends-hero-secondary" onClick={() => { onUi("paper"); setProfileUserId(me); }}><Icon name="journal" size={15} />Мой паспорт</button>}
                <button type="button" className="friends-hero-refresh" onClick={() => void refresh()} disabled={!me || refreshing} aria-label="Обновить сводку"><Icon name="forward" size={15} className={refreshing ? "friends-spin" : ""} /></button>
              </div>
            </div>
            <div className="friends-hero-board">
              <div className="friends-hero-board-top"><span>ЭКИПАЖ / СТАТУС</span><span className={onlineFriends.length ? "is-live" : ""}><i />{onlineFriends.length ? "СИГНАЛ ЕСТЬ" : "ТИХАЯ ВАХТА"}</span></div>
              <div className="friends-hero-numbers">
                <div><b>{d ? friends.length.toString().padStart(2, "0") : "—"}</b><small>в экипаже</small></div>
                <span className="friends-hero-divider" />
                <div><b className="friends-neon-number">{d ? onlineFriends.length.toString().padStart(2, "0") : "—"}</b><small>в игре сейчас</small></div>
                <span className="friends-hero-divider" />
                <div><b>{d ? incoming.length.toString().padStart(2, "0") : "—"}</b><small>новых заявок</small></div>
              </div>
              <div className="friends-capacity"><div><span>МЕСТА В ЭКИПАЖЕ</span><b>{d ? `${friends.length} / ${friendLimit}` : "—"}</b></div><i><span style={{ width: `${d ? Math.min(100, friends.length / Math.max(1, friendLimit) * 100) : 0}%` }} /></i><small>{d ? `${Math.max(0, friendLimit - friends.length)} свободно` : "Войдите, чтобы начать"}</small></div>
            </div>
            <span className="friends-hero-orbit orbit-one" aria-hidden="true" /><span className="friends-hero-orbit orbit-two" aria-hidden="true" />
          </section>

          <nav className="friends-nav" aria-label="Разделы штурманского клуба" role="tablist">
            {NAV_ITEMS.map((item) => {
              const count = navCount(item.id);
              return <button type="button" key={item.id} role="tab" aria-selected={view === item.id} className={view === item.id ? "is-active" : ""} onClick={() => { onUi(); setView(item.id); }} disabled={!me}>
                <Icon name={item.icon} size={16} /><span>{item.label}</span>{count ? <b>{count}</b> : null}
              </button>;
            })}
          </nav>

          {!me && <div className="friends-gate"><EmptyCard icon="lock" title="Нужен аккаунт капитана" text="Клуб хранит заявки и экипаж в облаке. Войдите в аккаунт, чтобы найти друзей, сравнивать уловы и видеть их последние сохранённые позиции." /></div>}
          {me && !d && state.failed && <div className="friends-gate"><EmptyCard icon="wave" title="Связь с клубом потеряна" text="Игровой прогресс не затронут. Попробуйте обновить список — экипаж загрузится, когда сервер снова будет доступен." action={{ label: "Повторить загрузку", onClick: () => void refresh() }} /></div>}
          {me && !d && !state.failed && <div className="friends-gate friends-loading"><span className="friends-loader" /><div><strong>Поднимаем связь с экипажем</strong><small>Загружаем заявки и последние сигналы…</small></div></div>}

          {d && view === "overview" && (
            <div className="friends-page friends-overview-page">
              <div className="friends-page-heading"><div><div className="friends-kicker">ПОСЛЕДНИЙ СРЕЗ СЕТИ</div><h2>Флот на карте</h2><p>Точки обновляются по сохранениям игроков. Скрытые координаты здесь не появляются.</p></div><button type="button" className="friends-outline-button" disabled={refreshing} onClick={() => void refresh()}><Icon name="forward" size={15} className={refreshing ? "friends-spin" : ""} />Обновить</button></div>
              <div className="friends-dashboard-grid">
                <section className="friends-map-card">
                  <div className="friends-panel-heading"><div><span className="friends-panel-index">01</span><div><div className="friends-kicker">РАДАР ЭКИПАЖА</div><h3>Последние отметки</h3></div></div><span className="friends-map-live"><i />{sailingCount} в море · {atPortCount} в портах</span></div>
                  <FleetMap members={members} selectedArea={selectedArea} onSelectArea={(area) => { onUi(); setSelectedArea(area); if (area) { setFilter("all"); setView("fleet"); } }} />
                  <div className="friends-map-foot"><span><i className="map-dot is-on" />В сети</span><span><i className="map-dot" />Последнее сохранение</span><span className="friends-map-foot-note">Нажмите метку, чтобы отфильтровать экипаж</span></div>
                </section>
                <aside className="friends-overview-rail">
                  <section className="friends-panel friends-presence-panel">
                    <div className="friends-panel-heading"><div><span className="friends-panel-index">02</span><div><div className="friends-kicker">ЭФИР</div><h3>Сейчас на связи</h3></div></div><b className="friends-count-pill">{onlineFriends.length}</b></div>
                    {onlineFriends.length ? <div className="friends-mini-roster">{onlineFriends.slice(0, 6).map((member) => <MiniCrewMember key={member.userId} member={{ ...member, isMe: false }} onOpen={() => { onUi("paper"); setProfileUserId(member.userId); }} />)}</div> : <div className="friends-quiet-empty"><Icon name="wave" size={18} /><span>Пока тихо. Новые сигналы появятся, когда друзья зайдут в игру.</span></div>}
                    {friends.length > 6 && <button type="button" className="friends-text-action" onClick={() => { onUi(); setView("fleet"); setFilter("online"); }}>Весь экипаж онлайн <Icon name="arrowR" size={14} /></button>}
                    {!friends.length && <button type="button" className="friends-text-action" onClick={() => { onUi(); setView("discover"); }}>Пригласить первого капитана <Icon name="arrowR" size={14} /></button>}
                  </section>
                  <PrivacyCard hidden={d.hideLocation} busy={busy} onSet={setPrivacy} />
                </aside>
              </div>
              <div className="friends-overview-bottom">
                <section className="friends-panel friends-preview-league">
                  <div className="friends-panel-heading"><div><span className="friends-panel-index">03</span><div><div className="friends-kicker">СРАВНЕНИЕ СВОИХ</div><h3>Лига капитанов</h3></div></div><button type="button" className="friends-text-action" onClick={() => { onUi(); setView("league"); }}>Вся таблица <Icon name="arrowR" size={14} /></button></div>
                  {levelRanked.length ? <div className="friends-leader-list">{levelRanked.slice(0, 4).map((member) => <LeaderRow key={member.userId} member={member} metric="level" maximum={Math.max(1, ...levelRanked.map((x) => x.value))} onOpen={() => { onUi("paper"); setProfileUserId(member.userId); }} />)}</div> : <div className="friends-quiet-empty">Добавьте капитанов — и клубный рейтинг оживёт.</div>}
                </section>
                <section className="friends-panel friends-latest-panel">
                  <div className="friends-panel-heading"><div><span className="friends-panel-index">04</span><div><div className="friends-kicker">СИГНАЛЫ С ФЛОТА</div><h3>Кто где был</h3></div></div><Icon name="clock" size={17} /></div>
                  {friends.length ? <div className="friends-latest-list">{[...friends].sort((a, b) => safeTime(b.where?.updatedAt ?? b.lastSeenAt) - safeTime(a.where?.updatedAt ?? a.lastSeenAt)).slice(0, 4).map((friend) => <button type="button" key={friend.userId} onClick={() => { onUi("paper"); setProfileUserId(friend.userId); }}><Avatar id={friend.userId} name={friend.username} size={32} online={isOnline(friend.lastSeenAt)} /><span><b>{friend.username}</b><small>{whereLabel(friend.where)}</small></span><i>{lastSeenLabel(friend.where?.updatedAt ?? friend.lastSeenAt)}</i></button>)}</div> : <div className="friends-quiet-empty"><Icon name="ship" size={18} /><span>Здесь появятся последние отметки ваших друзей.</span></div>}
                </section>
              </div>
            </div>
          )}

          {d && view === "fleet" && (
            <div className="friends-page friends-fleet-page">
              <div className="friends-page-heading"><div><div className="friends-kicker">ВАШИ ЛЮДИ · {friends.length} / {friendLimit}</div><h2>Экипаж</h2><p>Кто в сети, кто в рейсе, а кто давно не выходил в море.</p></div><button type="button" className="friends-action-primary" onClick={() => { onUi(); setView("discover"); }}><Icon name="friends" size={15} />Добавить капитана</button></div>
              <div className="friends-roster-toolbar">
                <div className="friends-filter-chips" role="group" aria-label="Фильтр экипажа">
                  {([ ["all", "Все", friends.length], ["online", "В сети", onlineFriends.length], ["sea", "В море", sailingCount], ["port", "В порту", atPortCount], ["recent", "За сутки", undefined] ] as [FleetFilter, string, number | undefined][]).map(([id, label, count]) => <button type="button" key={id} className={filter === id ? "is-active" : ""} aria-pressed={filter === id} onClick={() => { onUi(); setFilter(id); }}>{label}{count !== undefined && <b>{count}</b>}</button>)}
                </div>
                <div className="friends-roster-controls">
                  <label className="friends-local-search"><Icon name="sonar" size={15} /><input value={fleetQuery} maxLength={24} placeholder="Найти в экипаже" onChange={(event) => setFleetQuery(event.target.value)} /><span className="sr-only">Фильтр списка друзей по имени</span></label>
                  <label className="friends-sort-select"><span className="sr-only">Сортировка экипажа</span><select value={sort} onChange={(event) => setSort(event.target.value as FleetSort)}><option value="active">По активности</option><option value="level">По уровню</option><option value="codex">По кодексу</option><option value="catches">По улову</option></select><Icon name="arrowR" size={14} /></label>
                </div>
              </div>
              {selectedArea && <div className="friends-area-filter"><Icon name="pin" size={14} />Акватория: <b>{areaLabel(selectedArea)}</b><button type="button" onClick={() => setSelectedArea(null)}>Сбросить ×</button></div>}
              {visibleFriends.length ? <div className="friends-card-grid">{visibleFriends.map((friend) => <FriendCard key={friend.userId} f={friend} onUi={() => onUi()} onOpen={() => setProfileUserId(friend.userId)} onRemove={() => setRemoveTarget(friend)} />)}</div> : <EmptyCard icon={friends.length ? "compass" : "friends"} title={friends.length ? "По этому фильтру пусто" : "Ваш экипаж пока не собран"} text={friends.length ? "Смените фильтр или очистите поиск — список не меняет отношения с друзьями." : "Найдите знакомых по игровому имени. После принятия заявки вы увидите их рейсы, суда и промысел."} action={friends.length ? { label: "Сбросить фильтры", onClick: () => { setFilter("all"); setSelectedArea(null); setFleetQuery(""); } } : { label: "Найти капитанов", onClick: () => setView("discover") }} />}
            </div>
          )}

          {d && view === "league" && (
            <div className="friends-page friends-league-page">
              <div className="friends-page-heading"><div><div className="friends-kicker">ТОЛЬКО СРЕДИ ВАШЕГО ЭКИПАЖА</div><h2>Лига капитанов</h2><p>Сравнение по сохранённым общим показателям. Никаких скрытых рейтингов и чужих денег.</p></div>{myRank && <div className="friends-your-rank"><span>ВАША ПОЗИЦИЯ</span><b>№ {String(myRank.rank).padStart(2, "0")}</b><small>из {ranked.length}</small></div>}</div>
              <div className="friends-metric-picker" role="group" aria-label="Категория рейтинга">
                {METRICS.map((item) => <button type="button" key={item.id} className={metric === item.id ? "is-active" : ""} aria-pressed={metric === item.id} onClick={() => { onUi(); setMetric(item.id); }}><Icon name={item.icon} size={16} /><span>{item.label}</span></button>)}
              </div>
              <section className="friends-league-board">
                <div className="friends-league-board-head"><div><div className="friends-kicker">{METRICS.find((item) => item.id === metric)?.short} · СЕЙЧАС</div><h3>{METRICS.find((item) => item.id === metric)?.note}</h3></div><span>{ranked.length} {ranked.length === 1 ? "капитан" : "участника"}</span></div>
                {ranked.length ? <div className="friends-leader-list friends-leader-list-full">{ranked.map((member) => <LeaderRow key={member.userId} member={member} metric={metric} maximum={Math.max(1, ...ranked.map((x) => x.value))} onOpen={() => { onUi("paper"); setProfileUserId(member.userId); }} />)}</div> : <EmptyCard icon="medal" title="Лига ждёт первых капитанов" text="Добавьте друзей — и сравнивайте коллекцию, улов, достижения, время на воде и уровень." action={{ label: "Найти друзей", onClick: () => setView("discover") }} />}
                {myRank && <div className="friends-league-foot"><Icon name="chart" size={15} />Вы сравниваетесь только с собой и принятыми друзьями. Равные результаты делят одну позицию.</div>}
              </section>
            </div>
          )}

          {d && view === "requests" && (
            <div className="friends-page friends-requests-page">
              <div className="friends-page-heading"><div><div className="friends-kicker">ПРИГЛАШЕНИЯ · {incoming.length + outgoing.length}</div><h2>Рукопожатия</h2><p>Входящие заявки и приглашения, которые ещё ждут ответа.</p></div><button type="button" className="friends-outline-button" onClick={() => { onUi(); setView("discover"); }}><Icon name="sonar" size={15} />Найти игроков</button></div>
              <div className="friends-requests-grid">
                <section className="friends-panel">
                  <div className="friends-panel-heading"><div><span className="friends-panel-index">IN</span><div><div className="friends-kicker">ЖДУТ ВАС</div><h3>Входящие <span>{incoming.length}</span></h3></div></div>{incoming.length > 1 && <button type="button" className="friends-text-action is-danger" disabled={busy} onClick={() => setConfirmClear(true)}>Отклонить все</button>}</div>
                  {incoming.length ? <div className="friends-request-list">{incoming.map((request) => <RequestCard key={request.userId} r={request} incoming busy={busy} onUi={() => onUi()} onAccept={() => void act("accept", { userId: request.userId }, `${request.username} теперь в экипаже`)} onRemove={() => void act("decline", { userId: request.userId }, "Заявка отклонена")} />)}</div> : <div className="friends-quiet-empty"><Icon name="check" size={18} /><span>Нет новых приглашений. Хороший момент позвать кого-нибудь самому.</span></div>}
                </section>
                <section className="friends-panel">
                  <div className="friends-panel-heading"><div><span className="friends-panel-index">OUT</span><div><div className="friends-kicker">ЖДУТ ОТВЕТА</div><h3>Отправленные <span>{outgoing.length}</span></h3></div></div></div>
                  {outgoing.length ? <div className="friends-request-list">{outgoing.map((request) => <RequestCard key={request.userId} r={request} incoming={false} busy={busy} onUi={() => onUi()} onRemove={() => void act("cancel", { userId: request.userId }, "Приглашение отозвано")} />)}</div> : <div className="friends-quiet-empty"><Icon name="journal" size={18} /><span>Здесь появятся ваши приглашения. Можно искать игроков по точному или частичному имени.</span></div>}
                </section>
              </div>
            </div>
          )}

          {d && view === "discover" && (
            <div className="friends-page friends-discover-page">
              <div className="friends-page-heading"><div><div className="friends-kicker">РАСШИРИТЬ КРУГ</div><h2>Найти капитана</h2><p>Ищите по имени игрока — точное совпадение или часть позывного.</p></div><div className="friends-discover-count"><Icon name="friends" size={16} /><b>{Math.max(0, friendLimit - friends.length)}</b><small>мест свободно</small></div></div>
              <form className="friends-search-panel" onSubmit={submitSearch}>
                <div className="friends-search-mark"><Icon name="sonar" size={24} /></div>
                <label className="friends-search-field"><span className="friends-kicker">ПОЗЫВНОЙ / ИМЯ ИГРОКА</span><input value={query} maxLength={24} autoComplete="off" placeholder="Например, МорскойВолк" onChange={(event) => handleSearchInput(event.target.value)} /><small>{searchHint ?? "Минимум 2 символа. Место, судно и уловы не открываются до принятия заявки."}</small></label>
                <button type="submit" className="friends-action-primary" disabled={!normalizeQuery(query) || !me || searching}>{searching ? <><span className="friends-inline-loader" />Поиск</> : <><Icon name="sonar" size={16} />Искать</>}</button>
              </form>
              {searching && <div className="friends-search-loading"><span className="friends-loader" />Настраиваем сонар…</div>}
              {results && !searching && (
                <div className="friends-search-results">
                  <div className="friends-search-results-head"><div><div className="friends-kicker">СИГНАЛЫ СО СХОЖИМИ ПОЗЫВНЫМИ</div><h3>Найдено: {results.length}</h3></div><span>Отображаются имя, уровень и кодекс</span></div>
                  {results.length ? results.map((result) => <SearchResultCard key={result.userId} result={result} busy={busy} full={friends.length >= friendLimit} onUi={() => onUi()} onOpen={() => { onUi("paper"); setProfileUserId(result.userId); }} onRequest={() => void act("request", { username: result.username }, `Приглашение отправлено: ${result.username}`)} onAccept={() => void act("accept", { userId: result.userId }, "Заявка принята")} onCancel={() => void act("cancel", { userId: result.userId }, "Приглашение отозвано")} />) : <div className="friends-quiet-empty">Совпадений нет. Попробуйте другую часть имени.</div>}
                </div>
              )}
              {!results && !searching && <div className="friends-discover-hints"><div><Icon name="lock" size={17} /><span><b>Поиск не раскрывает личное</b><small>До дружбы видны только игровые имя, уровень и число видов в кодексе.</small></span></div><div><Icon name="heart" size={17} /><span><b>Взаимная заявка = мгновенная дружба</b><small>Если вы уже приглашали друг друга, ожидание не понадобится.</small></span></div><div><Icon name="map" size={17} /><span><b>Сначала знакомство, потом карта</b><small>Последняя позиция появляется только после принятия и с учётом настроек приватности.</small></span></div></div>}
            </div>
          )}

          <footer className="friends-shell-footer"><span><Icon name="wave" size={14} />ШТУРМАНСКИЙ КЛУБ · НЕЗАВИСИМО ОТ ИГРОВОГО МИРА</span><span>{d ? `${friends.length} / ${friendLimit} мест` : "Сеть ожидает подключения"}</span></footer>
        </div>
      </Modal>

      {profileUserId && <FriendProfileModal
        key={profileUserId}
        userId={profileUserId}
        self={profileUserId === me}
        compareProfile={profileUserId === me ? null : selfProfile}
        onClose={() => setProfileUserId(null)}
        onUi={onUi}
        onChanged={state.reload}
      />}
    </>
  );
}

function SearchResultCard({ result, busy, full, onUi, onOpen, onRequest, onAccept, onCancel }: {
  result: SearchResult; busy: boolean; full: boolean; onUi: () => void; onOpen: () => void;
  onRequest: () => void; onAccept: () => void; onCancel: () => void;
}) {
  return (
    <article className="friends-result-card">
      <Avatar id={result.userId} name={result.username} size={44} />
      <div className="friends-result-copy"><strong>{result.username}{result.relation === "self" && <i>Это вы</i>}</strong><small>Уровень {result.level} <span>·</span> {result.codexCount} видов в кодексе</small></div>
      <div className="friends-result-actions">
        {result.relation === "none" && <button type="button" className="friends-action-primary" disabled={busy || full} onClick={() => { onUi(); onRequest(); }}>{full ? "Нет мест" : <><Icon name="friends" size={15} />Пригласить</>}</button>}
        {result.relation === "friend" && <button type="button" className="friends-action-secondary" onClick={onOpen}>Паспорт</button>}
        {result.relation === "incoming" && <button type="button" className="friends-action-primary" disabled={busy || full} onClick={() => { onUi(); onAccept(); }}>{full ? "Нет мест" : <><Icon name="check" size={15} />Принять</>}</button>}
        {result.relation === "outgoing" && <button type="button" className="friends-action-secondary" disabled={busy} onClick={() => { onUi(); onCancel(); }}>Отозвать</button>}
        {result.relation === "self" && <span className="friends-self-result">ПОЗЫВНОЙ КАПИТАНА</span>}
      </div>
    </article>
  );
}

// ───────────────────────── паспорт капитана ─────────────────────────

export function FriendProfileModal({ userId, self = false, compareProfile = null, onClose, onUi, onChanged }: {
  userId: string; self?: boolean; compareProfile?: FriendProfile | null; onClose: () => void;
  onUi: (k?: "click" | "open" | "close" | "paper") => void; onChanged: () => Promise<void>;
}) {
  const [profile, setProfile] = useState<FriendProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tab, setTab] = useState<"passport" | "trophies">("passport");

  useEffect(() => {
    let alive = true;
    void fetchFriendProfile(userId).then((response) => {
      if (!alive) return;
      if (response.ok && response.data.profile) setProfile(response.data.profile);
      else setError(response.data.error ?? "Паспорт недоступен");
    }).catch(() => { if (alive) setError("Связь с клубом потеряна. Попробуйте открыть паспорт позже."); });
    return () => { alive = false; };
  }, [userId]);

  const removeFriend = async () => {
    if (!profile) return;
    setBusy(true);
    setMessage(null);
    const response = await friendAction("remove", { userId: profile.userId });
    setBusy(false);
    if (!response.ok) {
      setMessage(response.data.error ?? "Не удалось удалить игрока");
      setConfirmRemove(false);
      return;
    }
    await onChanged();
    onClose();
  };

  return (
    <Modal
      label={self ? "ВАШ ЛИЧНЫЙ БОРТОВОЙ ЖУРНАЛ" : "ПАСПОРТ КАПИТАНА · ЭКИПАЖ"}
      title={profile?.username ?? "Загрузка паспорта"}
      onClose={() => { onUi("close"); onClose(); }}
      above
      className="friends-profile-dialog"
      overlayClassName="friends-profile-overlay"
      right={profile && !self ? <div className="friends-header-count"><span>В ЭКИПАЖЕ С</span><b>{profile.friendsSince ? new Date(profile.friendsSince).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "2-digit" }) : "—"}</b></div> : undefined}
    >
      <div className="friends-profile-shell">
        {error && <div className="friends-message is-error" role="alert"><Icon name="wave" size={16} />{error}</div>}
        {message && <div className="friends-message is-error" role="alert"><Icon name="wave" size={16} />{message}</div>}
        {!profile && !error && <div className="friends-profile-loading"><span className="friends-loader" /><b>Сверяем судовой журнал…</b></div>}
        {profile && (
          <>
            <ProfileHero profile={profile} self={self} onRemove={() => setConfirmRemove(true)} />
            {confirmRemove && <div className="friends-confirm profile-confirm" role="alertdialog"><span className="friends-confirm-icon"><Icon name="lock" size={18} /></span><div><strong>Убрать {profile.username} из друзей?</strong><small>Это действие не затрагивает учётную запись, уловы и игровой прогресс игрока.</small></div><button type="button" className="friends-action-secondary" onClick={() => setConfirmRemove(false)}>Отмена</button><button type="button" className="friends-action-danger" disabled={busy} onClick={() => { onUi(); void removeFriend(); }}>Удалить</button></div>}
            <div className="friends-profile-tabs" role="tablist" aria-label="Разделы паспорта">
              <button type="button" role="tab" aria-selected={tab === "passport"} className={tab === "passport" ? "is-active" : ""} onClick={() => { onUi(); setTab("passport"); }}><Icon name="journal" size={15} />Паспорт</button>
              <button type="button" role="tab" aria-selected={tab === "trophies"} className={tab === "trophies" ? "is-active" : ""} onClick={() => { onUi(); setTab("trophies"); }}><Icon name="fish" size={15} />Трофеи <b>{profile.best.length + profile.recent.length}</b></button>
            </div>
            {tab === "passport" ? <ProfilePassport profile={profile} compareProfile={compareProfile} /> : <ProfileTrophies profile={profile} />}
          </>
        )}
      </div>
    </Modal>
  );
}

function ProfileHero({ profile, self, onRemove }: { profile: FriendProfile; self: boolean; onRemove: () => void }) {
  const online = isOnline(profile.lastSeenAt);
  const boat = profile.where?.hidden ? null : boatOf(profile.where?.boat ?? null);
  return (
    <section className="friends-profile-hero">
      <div className="friends-profile-identity"><Avatar id={profile.userId} name={profile.username} size={76} online={online} self={self} /><div className="friends-profile-name"><div className="friends-profile-overline"><span className={online ? "is-live" : ""}><i />{online ? "В ИГРЕ СЕЙЧАС" : lastSeenLabel(profile.lastSeenAt).toUpperCase()}</span><span>КАПИТАН · УРОВЕНЬ {profile.level}</span></div><h2>{profile.username}</h2><p>{whereLabel(profile.where)}{!profile.where?.hidden && profile.where?.weatherName ? ` · ${profile.where.weatherName}` : ""}</p></div><div className="friends-profile-action">{!self && <button type="button" className="friends-remove-action" onClick={onRemove}>Убрать из друзей</button>}</div></div>
      <div className="friends-profile-details"><div className="friends-profile-chart"><FriendChart where={profile.where} boat={boat} compact /></div><div className="friends-profile-vessel">{boat ? <><BoatPreview hull={boat.hull} trim={boat.trim} tier={boat.tier} style={boat.style} className="w-full" /><div><span>ТЕКУЩЕЕ СУДНО · КЛАСС {boat.tier}</span><b>{boat.name}</b><small>{boat.desc}</small></div></> : <div className="friends-no-vessel"><Icon name={profile.where?.hidden ? "lock" : "boat"} size={22} /><span>{profile.where?.hidden ? "Игрок скрыл сведения о судне" : "Сведения о судне ещё не сохранены"}</span></div>}</div><div className="friends-profile-meta"><span><i>АККАУНТ С</i><b>{profile.accountSince ? new Date(profile.accountSince).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }) : "—"}</b></span><span><i>ПРОВЕДЕНО В ИГРЕ</i><b>{playTimeLabel(profile.playSeconds)}</b></span><span><i>ДРУЖБА С</i><b>{self ? "Вы — капитан" : profile.friendsSince ? new Date(profile.friendsSince).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" }) : "—"}</b></span></div></div>
    </section>
  );
}

function ProfilePassport({ profile, compareProfile }: { profile: FriendProfile; compareProfile: FriendProfile | null }) {
  const stats = [
    { label: "Уровень", value: fmt(profile.level), icon: "star", accent: true },
    { label: "Виды в кодексе", value: fmt(profile.codexCount), icon: "book" },
    { label: "Всего уловов", value: fmt(profile.totalCaught), icon: "fish" },
    { label: "Достижения", value: fmt(profile.achievements), icon: "medal" },
    { label: "Мировые рекорды", value: fmt(profile.recordsHeld), icon: "target", accent: profile.recordsHeld > 0 },
    { label: "Заказы выполнены", value: fmt(profile.ordersDone), icon: "order" },
    { label: "Судов во флоте", value: fmt(profile.boatsOwned), icon: "boat" },
    { label: "Средства", value: `${fmt(profile.money)} ₽`, icon: "coin" },
  ];
  const biggestFish = profile.biggest ? FISH_BY_ID[profile.biggest.fishId] : null;
  return (
    <div className="friends-profile-page">
      {compareProfile && <ProfileComparison profile={profile} mine={compareProfile} />}
      <section className="friends-profile-stat-section"><div className="friends-section-heading"><div><div className="friends-kicker">СОСТОЯНИЕ КАПИТАНА</div><h3>Показатели рейса</h3></div><span>Сводка из последнего сохранения</span></div><div className="friends-profile-stats">{stats.map((stat) => <div key={stat.label} className={`friends-profile-stat ${stat.accent ? "is-accent" : ""}`}><Icon name={stat.icon} size={17} /><small>{stat.label}</small><b>{stat.value}</b></div>)}</div></section>
      <div className="friends-profile-bottom-grid">
        <section className="friends-panel friends-captain-log"><div className="friends-section-heading"><div><div className="friends-kicker">ПРОМЫСЕЛ И МАРШРУТЫ</div><h3>Привычки на воде</h3></div><Icon name="map" size={17} /></div><div className="friends-log-facts">{profile.favoriteLocation && <div><Icon name="pin" size={15} /><span><small>Любимая акватория</small><b>{profile.favoriteLocation.name}</b><i>{fmt(profile.favoriteLocation.count)} уловов зарегистрировано здесь</i></span></div>}{biggestFish && profile.biggest && <div><Icon name="scale" size={15} /><span><small>Крупнейший трофей</small><b>{biggestFish.name} · {fmtW(profile.biggest.weight)}</b><i>личный рекорд веса</i></span></div>}{profile.recordsHeld > 0 && <div><Icon name="medal" size={15} /><span><small>Мировые рекорды</small><b>{profile.recordsHeld} в таблице видов</b><i>лучший зарегистрированный вес</i></span></div>}{!profile.favoriteLocation && !biggestFish && profile.recordsHeld === 0 && <div className="friends-quiet-empty">Журнал промысла пока пуст.</div>}</div></section>
        <section className="friends-panel friends-captain-map"><div className="friends-section-heading"><div><div className="friends-kicker">ПОСЛЕДНИЕ КООРДИНАТЫ</div><h3>Карта рейса</h3></div><span>{profile.where?.gameDay ? dayLabel(profile.where.gameDay) : "—"}</span></div><FriendChart where={profile.where} boat={profile.where?.hidden ? null : boatOf(profile.where?.boat ?? null)} /></section>
      </div>
    </div>
  );
}

function ProfileComparison({ profile, mine }: { profile: FriendProfile; mine: FriendProfile }) {
  const comparisons: { label: string; icon: string; theirs: number; mine: number; suffix: string }[] = [
    { label: "Уровень", icon: "star", theirs: profile.level, mine: mine.level, suffix: "ур." },
    { label: "Виды", icon: "book", theirs: profile.codexCount, mine: mine.codexCount, suffix: "видов" },
    { label: "Улов", icon: "fish", theirs: profile.totalCaught, mine: mine.totalCaught, suffix: "рыб" },
    { label: "Достижения", icon: "medal", theirs: profile.achievements, mine: mine.achievements, suffix: "знаков" },
  ];
  return (
    <section className="friends-comparison"><div className="friends-comparison-heading"><span><Icon name="target" size={17} /></span><div><div className="friends-kicker">ДРУЖЕСКОЕ СРАВНЕНИЕ</div><h3>Кто ведёт в этом рейсе?</h3></div><small>вы ↔ {profile.username}</small></div><div className="friends-comparison-grid">{comparisons.map((comparison) => { const total = Math.max(1, comparison.theirs, comparison.mine); const theirsWidth = Math.max(3, comparison.theirs / total * 100); const mineWidth = Math.max(3, comparison.mine / total * 100); return <div key={comparison.label} className="friends-comparison-stat"><div><span><Icon name={comparison.icon} size={14} />{comparison.label}</span><b>{comparison.mine.toLocaleString("ru-RU")} : {comparison.theirs.toLocaleString("ru-RU")} <small>{comparison.suffix}</small></b></div><div className="friends-versus-bars"><i><span style={{ width: `${mineWidth}%` }} /></i><i><span style={{ width: `${theirsWidth}%` }} /></i></div><small><span>Вы</span><span>{profile.username}</span></small></div>; })}</div></section>
  );
}

function ProfileTrophies({ profile }: { profile: FriendProfile }) {
  const biggestFish = profile.biggest ? FISH_BY_ID[profile.biggest.fishId] : null;
  return (
    <div className="friends-trophies-page">
      {biggestFish && profile.biggest && <section className="friends-trophy-highlight"><div className="friends-trophy-glow" /><div className="friends-trophy-art"><FishIcon fish={biggestFish} size={200} variant={profile.best.find((catchRow) => catchRow.fishId === biggestFish.id)?.variant as Variant | null ?? null} /></div><div><div className="friends-kicker">КРУПНЕЙШИЙ ТРОФЕЙ · ЛИЧНЫЙ РЕКОРД</div><h3>{biggestFish.name}</h3><p>{fmtW(profile.biggest.weight)} · {profile.favoriteLocation?.name ?? "место не указано"}</p><span><Icon name="medal" size={14} />{profile.recordsHeld ? `${profile.recordsHeld} мировых рекорда` : "Новый рекорд ещё впереди"}</span></div></section>}
      <div className="friends-trophies-grid">
        <section className="friends-panel"><div className="friends-section-heading"><div><div className="friends-kicker">ТАБЛИЦА ВЕСА</div><h3>Лучшие уловы</h3></div><span>{profile.best.length}</span></div>{profile.best.length ? profile.best.map((catchRow, index) => <CatchRow key={`best-${catchRow.fishId}-${index}`} c={catchRow} big={index === 0} />) : <div className="friends-quiet-empty">Рекордных уловов пока нет.</div>}</section>
        <section className="friends-panel"><div className="friends-section-heading"><div><div className="friends-kicker">БОРТОВОЙ ЖУРНАЛ</div><h3>Последние уловы</h3></div><span>{profile.recent.length}</span></div>{profile.recent.length ? profile.recent.map((catchRow, index) => <CatchRow key={`recent-${catchRow.fishId}-${index}`} c={catchRow} />) : <div className="friends-quiet-empty">Здесь появится первый записанный улов.</div>}</section>
      </div>
    </div>
  );
}
