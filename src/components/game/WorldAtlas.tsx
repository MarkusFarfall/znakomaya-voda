"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Engine } from "@/game/engine";
import type { LocId, PortId } from "@/game/types";
import { LOCATIONS, LOC_BY_ID, PORTS, PORT_BY_ID, spotsOf } from "@/game/world";
import { FISH } from "@/game/fish";
import {
  atlasKey,
  atlasPoint,
  atlasRoute,
  atlasTargets,
  clampAtlasView,
  targetPoint,
  zoomAtlas,
  type AtlasTarget,
  type AtlasView,
} from "@/game/atlas";
import { HarborGlyph } from "./PortIdentity";
import { Icon } from "./Icons";
import "./atlas.css";

const number = (v: number) => Math.round(v).toLocaleString("ru-RU");
const duration = (m: number) =>
  m >= 60
    ? `${Math.floor(m / 60)} ч ${Math.round(m % 60)} мин`
    : `${Math.round(m)} мин`;
const climate: Record<string, string> = {
  temperate: "Умеренные воды",
  north: "Северные воды",
  tropic: "Тропики",
  ocean: "Открытый океан",
  polar: "Полярные воды",
  misty: "Туманный берег",
};

function Terrain({ uid }: { uid: string }) {
  return (
    <g aria-hidden="true">
      <defs>
        <radialGradient id={`${uid}-sea`} cx="25%" cy="60%" r="85%">
          <stop stopColor="#255868" />
          <stop offset=".5" stopColor="#153646" />
          <stop offset="1" stopColor="#091f30" />
        </radialGradient>
        <linearGradient id={`${uid}-land`} x2="90%" y2="100%">
          <stop stopColor="#465850" />
          <stop offset="1" stopColor="#223d39" />
        </linearGradient>
        <pattern
          id={`${uid}-grid`}
          width="62.5"
          height="62.5"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M62.5 0H0V62.5"
            stroke="#b0cfce"
            strokeWidth=".6"
            opacity=".12"
            fill="none"
          />
        </pattern>
        <pattern
          id={`${uid}-ice`}
          width="12"
          height="12"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="m0 12 12-12"
            stroke="#c6dfdf"
            strokeWidth="1"
            opacity=".25"
          />
        </pattern>
      </defs>
      <rect width="1000" height="625" fill={`url(#${uid}-sea)`} />
      <rect width="1000" height="625" fill={`url(#${uid}-grid)`} />
      <g fill="none" stroke="#8bb5b7" opacity=".14" strokeWidth="1">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <path
            key={i}
            d={`M${80 + i * 25} 640C${280 + i * 40} 430 ${35 + i * 30} 270 ${160 + i * 35} -20`}
          />
        ))}
        {[0, 1, 2, 3, 4].map((i) => (
          <ellipse
            key={i}
            cx="860"
            cy="150"
            rx={45 + i * 26}
            ry={28 + i * 21}
            transform="rotate(-20 860 150)"
          />
        ))}
        <path d="M500 485c40-65 145-80 215-30s26 100-20 107-163 30-195-25Z" />
        <path d="M470 490c70-110 200-100 269-38s40 129-25 141-230 20-244-60Z" />
      </g>
      <g fill={`url(#${uid}-land)`} stroke="#92a996" strokeWidth="1.3">
        <path d="M0 0H133l-8 27-37 12 12 30 42 6 12 48-22 23 32 34 32 9 19 37-14 28 31 29-28 23-42-8-32 33-25 12-16 40-32 24 14 30-22 32-12 57-22 24 9 36-15 34H0Z" />
        <path d="M305 119l19-17 15 8-7 19-20 7Zm-37 31 12-16 15 9-5 17Zm69-3 18-11 12 14-18 13Zm-44 30 16-13 15 10-7 14Z" />
        <path d="m383 352 22 9 15 18 24-2 18 18-16 12-39-9-24-19Z" />
        <path d="M635 533c-21-17 3-39 27-36l26 13 12 24-28 16Z" />
        <path d="m458 603 24-25 39 8 21 36h-84Z" />
        <path d="m710 394 12-26 18-27 19 33 22 17-11 15-40 5Z" />
      </g>
      <g fill="none" stroke="#879889" strokeWidth="1" opacity=".35">
        <path d="M31 41c63 9 33 81 65 112s-25 72 18 102 25 52-20 96S57 440 35 480" />
        <path d="M20 95c44 18 16 79 43 98s-9 58 9 92-33 71-40 108" />
        {[0, 1, 2].map((i) => (
          <path
            key={i}
            d={`m${38 + i * 22} ${82 + i * 27} 12-24 17 27-11-7-6 5-5-6Z`}
          />
        ))}
        <path d="m728 387 12-38 13 40-11-10-7 7Z" />
      </g>
      <path
        d="M0 527c24 3 25-19 49-3M89 64l-35 9-14-12"
        stroke="#397182"
        strokeWidth="5"
        fill="none"
      />
      <path
        d="M760 625l27-58 35-18 45 11 39-24 45 10 49-11v90Z"
        fill="#89aeb5"
        fillOpacity=".19"
        stroke="#b0ced0"
        strokeOpacity=".5"
      />
      <path
        d="M760 625l27-58 35-18 45 11 39-24 45 10 49-11v90Z"
        fill={`url(#${uid}-ice)`}
      />
      <g
        fill="#b3cccb"
        opacity=".34"
        fontSize="12"
        letterSpacing="4"
        fontFamily="serif"
      >
        <text x="350" y="52">
          СЕВЕРНЫЕ ВОДЫ
        </text>
        <text x="510" y="225">
          ОТКРЫТОЕ МОРЕ
        </text>
        <text x="530" y="600">
          ЮЖНЫЙ ПОЯС
        </text>
      </g>
      <g
        stroke="#b1d4ca"
        opacity=".17"
        fill="none"
        strokeWidth="1.4"
        className="atlas-currents"
      >
        <path d="M390 130q60 30 70 85t75 100" />
        <path d="M730 450q-80 40-120-20t-120 20" />
      </g>
      <g
        transform="translate(909 430)"
        stroke="#d9c39a"
        strokeWidth="1"
        opacity=".5"
      >
        <circle r="37" fill="none" />
        <circle r="29" fill="none" strokeDasharray="1 7" />
        <path d="M0-48 8 0 0 48-8 0Z" fill="#cbb27b" fillOpacity=".3" />
        <path d="M-48 0 0-6 48 0 0 6Z" fill="none" />
        <text
          y="-56"
          textAnchor="middle"
          stroke="none"
          fill="#e2d2b1"
          fontSize="14"
        >
          N
        </text>
      </g>
    </g>
  );
}

export function WorldAtlas({
  engine,
  onGo,
  onSail,
}: {
  engine: Engine;
  onGo: (loc: LocId, spot: string) => void;
  onSail: (port: PortId) => void;
}) {
  const initial: AtlasTarget = engine.s.atPort
    ? { kind: "port", id: engine.s.port }
    : { kind: "loc", id: engine.s.location };
  const [selected, setSelected] = useState<AtlasTarget>(initial);
  const [spot, setSpot] = useState(engine.s.spot);
  const [filter, setFilter] = useState<"all" | "loc" | "port" | "open">("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<AtlasView>({ x: 0, y: 0, zoom: 1 });
  const [width, setWidth] = useState(700);
  const svg = useRef<SVGSVGElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const detail = useRef<HTMLElement>(null);
  const drag = useRef<{ x: number; y: number; view: AtlasView } | null>(null);
  const uid = useId();
  useEffect(() => {
    const node = stage.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const known = (t: AtlasTarget) =>
    t.kind === "loc"
      ? engine.isUnlocked(t.id)
      : engine.s.portsKnown.includes(t.id);
  const name = (t: AtlasTarget) =>
    known(t)
      ? t.kind === "loc"
        ? LOC_BY_ID[t.id].name
        : PORT_BY_ID[t.id].name
      : t.kind === "loc"
        ? "Неизведанные воды"
        : "Неизвестный порт";
  const unlocked = known(selected);
  const location = selected.kind === "loc" ? LOC_BY_ID[selected.id] : null;
  const port = selected.kind === "port" ? PORT_BY_ID[selected.id] : null;
  const spots = location ? spotsOf(location.id) : [];
  const chosenSpot = spots.find((s) => s.id === spot) ?? spots[0];
  const route = atlasRoute(engine, selected, chosenSpot?.id);
  const list = atlasTargets.filter(
    (t) =>
      (filter === "all" ||
        (filter === "open" && known(t)) ||
        filter === t.kind) &&
      (!search.trim() ||
        name(t)
          .toLocaleLowerCase()
          .includes(search.trim().toLocaleLowerCase())),
  );
  const select = (t: AtlasTarget) => {
    setSelected(t);
    if (t.kind === "loc")
      setSpot(t.id === engine.s.location ? engine.s.spot : spotsOf(t.id)[0].id);
  };
  const origin = atlasPoint(engine.here),
    dest = targetPoint(selected);
  const key = atlasKey(selected);
  const curve = `M${origin[0]} ${origin[1]} Q${(origin[0] + dest[0]) / 2} ${(origin[1] + dest[1]) / 2 - Math.min(80, Math.abs(origin[0] - dest[0]) * 0.24 + 20)} ${dest[0]} ${dest[1]}`;
  const zoom = (delta: number) => setView((v) => zoomAtlas(v, v.zoom + delta));
  const focusSelection = () =>
    setView(clampAtlasView({ zoom: 2, x: dest[0] - 250, y: dest[1] - 156.25 }));
  const fish = location ? FISH.filter((f) => f.loc.includes(location.id)) : [];
  const caught = fish.filter((f) => engine.s.codex[f.id]).length;
  return (
    <section className="atlas" aria-label="Морской атлас">
      <div className="atlas-top">
        <div>
          <span className="atlas-eyebrow">ПЛАНШЕТ ШТУРМАНА</span>
          <h3>Куда отправимся?</h3>
        </div>
        <div className="atlas-progress">
          <span>
            {engine.s.unlocked.length}
            <small> / {LOCATIONS.length}</small>
          </span>
          <div>
            акваторий открыто
            <i>
              <b
                style={{
                  width: `${(engine.s.unlocked.length / LOCATIONS.length) * 100}%`,
                }}
              />
            </i>
          </div>
        </div>
      </div>
      <div className="atlas-layout">
        <div className="atlas-main">
          <div className="atlas-stage" ref={stage}>
            <div className="atlas-map-caption">
              <span>ЗНАКОМЫЕ ВОДЫ</span>
              <small>морская карта · маршруты условные</small>
            </div>
            <svg
              ref={svg}
              className="atlas-map"
              viewBox={`${view.x} ${view.y} ${1000 / view.zoom} ${625 / view.zoom}`}
              role="group"
              aria-label="Интерактивная карта. Масштаб — кнопками, перемещение — перетаскиванием или стрелками."
              tabIndex={0}
              onKeyDown={(e) => {
                if (
                  [
                    "ArrowLeft",
                    "ArrowRight",
                    "ArrowUp",
                    "ArrowDown",
                    "+",
                    "-",
                    "Home",
                  ].includes(e.key)
                ) {
                  e.preventDefault();
                  if (e.key === "+") zoom(0.25);
                  else if (e.key === "-") zoom(-0.25);
                  else if (e.key === "Home") setView({ x: 0, y: 0, zoom: 1 });
                  else
                    setView((v) =>
                      clampAtlasView({
                        ...v,
                        x:
                          v.x +
                          (e.key === "ArrowLeft"
                            ? -70
                            : e.key === "ArrowRight"
                              ? 70
                              : 0) /
                            v.zoom,
                        y:
                          v.y +
                          (e.key === "ArrowUp"
                            ? -70
                            : e.key === "ArrowDown"
                              ? 70
                              : 0) /
                            v.zoom,
                      }),
                    );
                }
              }}
              onPointerDown={(e) => {
                if (
                  e.button !== 0 ||
                  (e.target as Element).closest("[data-map-node]")
                )
                  return;
                drag.current = { x: e.clientX, y: e.clientY, view };
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                const d = drag.current;
                if (!d) return;
                const scale = svg.current?.getScreenCTM()?.a ?? 1;
                setView(
                  clampAtlasView({
                    ...d.view,
                    x: d.view.x - (e.clientX - d.x) / scale,
                    y: d.view.y - (e.clientY - d.y) / scale,
                  }),
                );
              }}
              onPointerUp={() => {
                drag.current = null;
              }}
              onPointerCancel={() => {
                drag.current = null;
              }}
              onLostPointerCapture={() => {
                drag.current = null;
              }}
            >
              <Terrain uid={uid} />
              {!route.here && !route.local && (
                <path
                  d={curve}
                  fill="none"
                  stroke={unlocked ? "#e1c18a" : "#87a5b1"}
                  strokeWidth={2 / view.zoom}
                  strokeDasharray={`${7 / view.zoom} ${6 / view.zoom}`}
                  className="atlas-route"
                  opacity={unlocked ? 0.9 : 0.4}
                />
              )}
              {atlasTargets.map((t, i) => {
                const [x, y] = targetPoint(t),
                  active = atlasKey(t) === key,
                  open = known(t),
                  scale = Math.max(1, 650 / width) / Math.sqrt(view.zoom);
                return (
                  <g
                    key={atlasKey(t)}
                    transform={`translate(${x} ${y}) scale(${scale})`}
                    data-map-node={atlasKey(t)}
                    role="button"
                    tabIndex={0}
                    aria-label={`${name(t)}${open ? "" : ` ${i + 1}`}`}
                    aria-pressed={active}
                    onClick={() => select(t)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        select(t);
                      }
                    }}
                    className={`atlas-marker ${active ? "active" : ""} ${open ? "" : "unknown"}`}
                  >
                    <circle r="24" fill="transparent" />
                    <circle
                      r={active ? 16 : 12}
                      fill="#102a37"
                      stroke={active ? "#f0d398" : open ? "#a3c7c6" : "#587580"}
                      strokeWidth={active ? 2 : 1.4}
                    />
                    {t.kind === "port" ? (
                      <path
                        d="M0-6v12M-4-2h8M-6 1c0 8 12 8 12 0M0-7v-.1"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.4"
                      />
                    ) : open ? (
                      <path
                        d="m0-5 5 5-5 5-5-5Z"
                        fill={active ? "#e0bd7d" : "#92c5be"}
                      />
                    ) : (
                      <text
                        textAnchor="middle"
                        y="4"
                        fill="#90abb6"
                        fontSize="13"
                      >
                        ?
                      </text>
                    )}
                    {(active ||
                      (width > 600 && open) ||
                      (view.zoom > 1.8 && open)) && (
                      <text
                        x={x > 790 ? -21 : 21}
                        y="4"
                        textAnchor={x > 790 ? "end" : "start"}
                        className="atlas-marker-name"
                      >
                        {name(t)}
                      </text>
                    )}
                  </g>
                );
              })}
              <g
                transform={`translate(${origin[0]} ${origin[1]})`}
                pointerEvents="none"
              >
                <circle
                  r={22 / view.zoom}
                  fill="none"
                  stroke="#d8c28c"
                  strokeWidth={1 / view.zoom}
                  opacity=".7"
                />
                <circle r={3 / view.zoom} fill="#f4e2b9" />
              </g>
            </svg>
            <div className="atlas-map-tools">
              <button
                aria-label="Приблизить карту"
                onClick={() => zoom(0.4)}
                disabled={view.zoom >= 3}
              >
                +
              </button>
              <span>{Math.round(view.zoom * 100)}%</span>
              <button
                aria-label="Отдалить карту"
                onClick={() => zoom(-0.4)}
                disabled={view.zoom <= 1}
              >
                −
              </button>
              <button
                aria-label="Показать всю карту"
                onClick={() => setView({ x: 0, y: 0, zoom: 1 })}
              >
                <Icon name="map" size={17} />
              </button>
            </div>
            <div className="atlas-legend">
              <span>
                <i />
                акватория
              </span>
              <span>
                <HarborGlyph kind="crest" size={12} />
                порт
              </span>
              <span className="dim">? не разведано</span>
            </div>
          </div>
          <div className="atlas-directory">
            <div className="atlas-directory-head">
              <span className="atlas-eyebrow">НАПРАВЛЕНИЯ</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Найти место…"
                aria-label="Поиск по атласу"
              />
            </div>
            <div
              className="atlas-filters"
              role="group"
              aria-label="Фильтр направлений"
            >
              {(
                [
                  ["all", "Все"],
                  ["loc", "Акватории"],
                  ["port", "Порты"],
                  ["open", "Открытые"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  aria-pressed={filter === id}
                  onClick={() => setFilter(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="atlas-destinations">
              {list.map((t, i) => (
                <button
                  key={atlasKey(t)}
                  aria-label={`Выбрать: ${name(t)}${known(t) ? "" : ` ${i + 1}`}`}
                  aria-pressed={atlasKey(t) === key}
                  onClick={() => {
                    select(t);
                    if (window.matchMedia("(max-width: 640px)").matches)
                      detail.current?.scrollIntoView({
                        block: "start",
                        behavior: window.matchMedia(
                          "(prefers-reduced-motion: reduce)",
                        ).matches
                          ? "instant"
                          : "smooth",
                      });
                  }}
                >
                  <span className="atlas-destination-icon">
                    <HarborGlyph
                      kind={t.kind === "port" ? "crest" : "sea"}
                      size={20}
                    />
                  </span>
                  <span>
                    <b>{name(t)}</b>
                    <small>
                      {known(t)
                        ? t.kind === "port"
                          ? "Порт · службы и отдых"
                          : `${LOC_BY_ID[t.id].maxDepth} м · ${climate[LOC_BY_ID[t.id].climate]}`
                        : "Условия открытия →"}
                    </small>
                  </span>
                  <span className="atlas-destination-arrow">
                    {known(t) ? "↗" : "?"}
                  </span>
                </button>
              ))}
            </div>
            {!list.length && (
              <div className="atlas-empty">
                Место не найдено.
                <button
                  onClick={() => {
                    setSearch("");
                    setFilter("all");
                  }}
                >
                  Сбросить поиск
                </button>
              </div>
            )}
          </div>
        </div>
        <aside
          ref={detail}
          className="atlas-detail"
          aria-label="Выбранное направление"
        >
          <div key={key} className="atlas-detail-content">
            <div
              className={`atlas-vignette ${location?.climate ?? port?.id ?? "temperate"}`}
            >
              <svg viewBox="0 0 320 92" fill="none" aria-hidden="true">
                <circle cx="246" cy="32" r="17" fill="#d9cc9a" opacity=".6" />
                <path
                  d="M0 71 42 32 67 59 103 22 157 74 195 49 235 75 280 35 320 62v30H0Z"
                  fill="#63877c"
                  opacity=".45"
                />
                <path
                  d="M0 75q45-22 83-6t79 0 76 0 82-5v28H0Z"
                  fill="#234e55"
                />
                <path
                  d="M0 83h320m-270 6h53m37-11h80m20 10h38"
                  stroke="#aec6b8"
                  opacity=".3"
                />
              </svg>
              <span>
                <HarborGlyph kind={port ? "crest" : "sea"} size={34} />
              </span>
            </div>
            <div className="atlas-detail-heading">
              <span className="atlas-eyebrow">
                {port
                  ? "ПОРТ НАЗНАЧЕНИЯ"
                  : unlocked
                    ? climate[location!.climate]
                    : "ЗА ГРАНИЦЕЙ ИЗВЕСТНОГО"}
              </span>
              <h3>{name(selected)}</h3>
              <button className="atlas-focus" onClick={focusSelection}>
                <Icon name="target" size={14} /> На карте
              </button>
            </div>
            <p className="atlas-description">
              {unlocked
                ? (port?.desc ?? location?.desc)
                : "Каждое открытие расширяет карту. Выполните условия, чтобы исследовать эти воды."}
            </p>
            {unlocked && location && (
              <>
                <div className="atlas-facts">
                  <span>
                    <b>
                      {location.maxDepth}
                      <small> м</small>
                    </b>
                    глубина
                  </span>
                  <span>
                    <b>
                      {caught}
                      <small> / {fish.length}</small>
                    </b>
                    видов открыто
                  </span>
                  <span>
                    <b>{location.boatTier + 1}</b>класс судна
                  </span>
                </div>
                <div className="atlas-spots">
                  <span className="atlas-eyebrow">ОРИЕНТИРЫ АКВАТОРИИ</span>
                  {spots.map((sp) => (
                    <div className="atlas-region"
                      key={sp.id}
                      aria-current={engine.s.location===sp.loc&&engine.s.spot===sp.id?"location":undefined}
                      title="Соединены одной акваторией — плывите вдоль берега"
                    >
                      <span>
                        <b>{sp.name}</b>
                        <small>{sp.desc}</small>
                      </span>
                      <strong>
                        {sp.maxDepth}
                        <small> м</small>
                      </strong>
                    </div>
                  ))}
                </div>
              </>
            )}
            {unlocked && port && (
              <>
                <p className="atlas-port-tagline">{port.tagline}</p>
                <div className="atlas-port-services">
                  {(["market", "shop", "shipyard", "tavern"] as const).map(
                    (k) => (
                      <span key={k}>
                        <HarborGlyph kind={k} size={22} />
                        {port.buildings?.[k].title}
                      </span>
                    ),
                  )}
                </div>
                <p className="atlas-description">
                  {port.landmarks?.join(" · ")}
                </p>
              </>
            )}
            {!unlocked && location && (
              <ul className="atlas-unlock">
                {engine.unlockState(location.id).reqs.map((r) => (
                  <li key={r.label} className={r.ok ? "done" : ""}>
                    <span>{r.ok ? "✓" : "○"}</span>
                    <div>
                      {r.label}
                      <small>{r.have}</small>
                    </div>
                  </li>
                ))}
                <li>
                  <span>
                    {engine.fleetTier >= location.boatTier ? "✓" : "○"}
                  </span>
                  <div>Судно класса {location.boatTier + 1}</div>
                </li>
              </ul>
            )}
            {!unlocked && port && (
              <p className="atlas-description">
                Исследуйте соседние акватории:{" "}
                {port.serves
                  .map((id) =>
                    engine.isUnlocked(id)
                      ? LOC_BY_ID[id].name
                      : "неизведанные воды",
                  )
                  .join(", ")}
                .
              </p>
            )}
          </div>
          <div className="atlas-route-summary" aria-live="polite">
            <div className="atlas-eyebrow">
              {route.here
                ? "ТЕКУЩЕЕ МЕСТО"
                : `ОТ ${engine.s.atPort ? engine.port.name : engine.loc.name}`}
            </div>
            {!route.here && unlocked && (
              <>
                <div className="atlas-quote">
                  <span>
                    {engine.canMotor && !route.local ? "Мотор" : "Переход"}
                  </span>
                  <b>
                    {duration(
                      engine.canMotor
                        ? route.motor.minutes
                        : route.sail.minutes,
                    )}
                  </b>
                  <strong>
                    {route.motor.fuel
                      ? `${number(route.motor.fuel)} ₽`
                      : "бесплатно"}
                  </strong>
                </div>
                {engine.canMotor && !route.local && (
                  <div className="atlas-quote muted">
                    <span>Своим ходом</span>
                    <b>{duration(route.sail.minutes)}</b>
                    <strong>бесплатно</strong>
                  </div>
                )}
              </>
            )}
            <button
              className="atlas-go"
              disabled={!unlocked || !!route.blocked}
              onClick={() => {
                if (route.blocked || !unlocked) return;
                if (selected.kind === "port") onSail(selected.id);
                else if (chosenSpot) onGo(selected.id, chosenSpot.id);
              }}
            >
              <HarborGlyph kind="sea" size={22} />
              <span>
                {!unlocked
                  ? "Нужно исследовать"
                  : (route.blocked ??
                    (route.local ? "Вы уже здесь" : "Выбрать переход"))}
              </span>
              {!route.blocked && unlocked && <span>→</span>}
            </button>
            {unlocked && !route.here && !route.blocked && (
              <small className="atlas-route-note">
                {route.local
                  ? "Переход внутри акватории"
                  : "Выбор хода и подтверждение — на следующем экране"}
              </small>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
