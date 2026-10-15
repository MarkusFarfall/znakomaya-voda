"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { GameDialog, useGameDialog } from "./Dialog";
import { ART } from "@/game/render/boats/art";
import { getSprite } from "@/game/render/boats/sprites";
import { boat3dSnapshot, getBoat3dPref } from "@/game/render/boats3d/boat3d";
import type { BoatStyle } from "@/game/types";
import { gearList, isJumper, type Engine, type Trip } from "@/game/engine";
import type { GearKind } from "@/game/world";
import { availableNow, conditionsNow, fishNotes } from "@/game/lore";
import { FISH, FISH_BY_ID, RARITY_INFO, VARIANT_INFO } from "@/game/fish";
import type { Building, FishDef, LocId, PortId } from "@/game/types";
import { BAITS, BAIT_BY_ID, BOATS, BOAT_CLASS_NAMES, PORTS, PORT_BY_ID, LINES, LOCATIONS, LOC_BY_ID, MILESTONES, REELS, RODS, SONARS, WEATHER_INFO, spotsOf } from "@/game/world";
import { HarborGlyph, type HarborSymbol } from "./PortIdentity";
import { WorldAtlas } from "./WorldAtlas";
import { FishIcon } from "./FishIcon";
import { BaitIcon, GearIcon, Icon, MiscIcon } from "./Icons";

export const fmt = (n: number) => Math.round(n).toLocaleString("ru-RU");
export const fmtW = (w: number) => (w < 1 ? `${Math.round(w * 1000)} г` : `${w.toFixed(w < 10 ? 2 : 1)} кг`);
const LEN_K: Record<string, number> = { fusiform: 0.011, deep: 0.024, flat: 0.02, eel: 0.0016, long: 0.0032, billfish: 0.006, shark: 0.008, angler: 0.03, ray: 0.04, squid: 0.004, blob: 0.04, puffer: 0.05 };
export const fishLength = (f: FishDef, w: number) => Math.cbrt((w * 1000) / (LEN_K[f.shape] ?? 0.011));
const fmtLen = (cm: number) => (cm >= 100 ? `${(cm / 100).toFixed(2)} м` : `${Math.round(cm)} см`);

/** `above` поднимает окно выше титульной заставки (z-50) — нужно панелям, доступным до начала игры. */
export function Modal({ label, title, onClose, children, tabs, right, wide = true, above = false }: { label?: string; title: string; onClose: () => void; children: ReactNode; tabs?: ReactNode; right?: ReactNode; wide?: boolean; above?: boolean }) {
  return <GameDialog label={label} title={title} onClose={onClose} tabs={tabs} right={right} wide={wide} above={above}>{children}</GameDialog>;
}

function Row({ k, v, strong }: { k: string; v: ReactNode; strong?: boolean }) {
  return (
    <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[var(--line)] py-1.5">
      <dt className="muted text-[12px]">{k}</dt>
      <dd className={`num min-w-0 max-w-full break-words text-right ${strong ? "text-[15px] text-[#f1ebdd]" : "text-[13px] text-[#ddd7ca]"}`}>{v}</dd>
    </div>
  );
}

// ───────────────────────── УЛОВ ─────────────────────────
export function CatchModal({ engine }: { engine: Engine }) {
  const dialog = useGameDialog(undefined, !!engine.lastCatch);
  const c = engine.lastCatch;
  if (!c) return null;
  const f = FISH_BY_ID[c.item.fishId];
  const r = RARITY_INFO[f.rarity];
  const v = c.item.variant ? VARIANT_INFO[c.item.variant] : null;
  const today = engine.marketValue(c.item);
  const mult = engine.marketMult(f.id);
  const order = engine.s.orders.find((o) => o.fishId === f.id && c.item.weight >= o.minWeight);
  const notes: [string, string][] = [];
  if (c.isNew) notes.push(["book", `Новый вид в кодексе · премия ${fmt(c.bonus)} ₽`]);
  if (c.isRecord) notes.push(["star", "Личный рекорд веса"]);
  if (c.perfect) notes.push(["target", "Точная подсечка"]);
  if (order) notes.push(["order", `Подходит для заказа: ${order.client}`]);
  return (
    <div className="zv-ui game-catch fade-in absolute inset-0 z-30 flex min-w-0 max-w-[100vw] items-stretch justify-center overflow-x-hidden bg-[#02050a]/55 sm:items-center sm:p-4" onPointerDown={(e) => e.stopPropagation()}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-label="Улов" data-game-dialog tabIndex={-1} className="sheet reveal safe-pad grid min-w-0 max-w-full max-h-[100dvh] w-full overflow-x-hidden overflow-y-auto overscroll-contain !rounded-none sm:!rounded-[3px] md:grid-cols-[1.15fr_1fr] sm:max-h-[94vh] sm:max-w-[880px]">
        <div className="plate relative flex min-w-0 min-h-[190px] flex-col justify-between overflow-hidden p-4 sm:p-6 [@media(min-height:560px)]:min-h-[300px]">
          <div className="flex items-center justify-between">
            <span className="label" style={{ color: r.color }}>{r.name}</span>
            <span className="label num">№ {String(FISH.indexOf(f) + 1).padStart(3, "0")} / {FISH.length}</span>
          </div>
          <div className="flex flex-1 items-center justify-center py-2 sm:py-4">
            <FishIcon fish={f} size={420} height={210} variant={c.item.variant} animate />
          </div>
          <div className="flex min-w-0 items-end justify-between gap-2">
            <div className="flex shrink-0 items-center gap-2 text-[11px] dim">
              <span className="inline-block h-px w-16 bg-[var(--line-2)]" />
              <span className="num">≈ {fmtLen(fishLength(f, c.item.weight))}</span>
            </div>
            <span className="min-w-0 truncate pl-2 text-right text-[11px] dim">{LOC_BY_ID[c.item.loc].name} · {engine.spot.name} · день {c.item.day}</span>
          </div>
        </div>
        <div className="catch-details flex min-h-0 min-w-0 flex-col overflow-hidden">
          <div className="catch-info min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 sm:p-7">
          <div className="label">{c.isNew ? "Впервые пойман" : "Улов"}</div>
          <h3 className="font-serif mt-1 break-words text-[32px] font-medium leading-[1.05] text-[#f4eee0] sm:text-[40px]">{f.name}</h3>
          <div className="font-serif break-words text-[17px] italic muted">{f.latin}</div>
          {v && <div className="mt-2 text-[12px] tracking-wide" style={{ color: v.color }}>Вариация: {v.name.toLowerCase()} · ×{v.mult}</div>}
          <dl className="mt-5">
            <Row k="Вес" v={fmtW(c.item.weight)} strong />
            <Row k="Длина" v={`≈ ${fmtLen(fishLength(f, c.item.weight))}`} />
            <Row k={`Цена · ${engine.port.name}`} v={<span className="text-[var(--brass-2,#e3c996)]">{fmt(today)} ₽</span>} strong />
            <Row k="Спрос" v={<span className={mult >= 1 ? "text-[var(--color-ok)]" : "text-[var(--color-bad)]"}>{mult >= 1.9 ? "спрос дня, ×2" : `${mult >= 1 ? "+" : "−"}${Math.abs(Math.round((mult - 1) * 100))} %`}</span>} />
            <Row k="Опыт" v={`+${c.xp}`} />
          </dl>
          {notes.length > 0 && (
            <ul className="mt-4 space-y-1.5">
              {notes.map(([ic, t]) => (
                <li key={t} className="flex min-w-0 items-center gap-2 text-[12px] text-[#ddd2b8]"><Icon name={ic} size={14} className="shrink-0 text-[var(--brass)]" /><span className="min-w-0 break-words">{t}</span></li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-[13px] leading-relaxed muted">{f.desc}</p>
          </div>
          <div className="catch-actions flex shrink-0 flex-col gap-2 border-t border-[var(--line)] bg-[#0a121c] px-5 py-4 min-[360px]:flex-row sm:px-7">
            <button className="btn btn-quiet min-w-0 flex-1 !px-2 !text-[10px] !tracking-[0.12em]" onClick={() => engine.releaseCatch()}>Отпустить</button>
            <button className="btn btn-solid min-w-0 flex-1 !px-2 !text-[10px] !tracking-[0.12em]" disabled={engine.coolerFull} onClick={() => engine.keepCatch()}>
              {engine.coolerFull ? "Садок полон" : `В садок · ${engine.s.cooler.length}/${engine.coolerCap}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── ПОРТ ─────────────────────────

export type PortTab = "market" | "orders" | "gear" | "bait" | "boats" | "map" | "rest";
export function PortModal({ engine, onClose, onTravel, onRest, onReset, cloud, initialTab = "market", mapOnly = false }: { engine: Engine; onClose: () => void; onTravel: (t: Trip) => void; onRest: () => void; onReset: () => void; cloud: string; initialTab?: PortTab; mapOnly?: boolean }) {
  const [tab, setTab] = useState<PortTab>(initialTab);
  const [flash, setFlash] = useState<string | null>(null);
  const s = engine.s;
  const say = (m: string) => { setFlash(m); setTimeout(() => setFlash(null), 2400); };
  const quote = engine.coolerQuote();
  const coolerValue = [...quote.values()].reduce((a, b) => a + b, 0);
  const readyOrders = s.orders.filter((o) => engine.orderMatches(o).length >= o.count).length;
  const tabs: [PortTab, string, string][] = [
    ["market", "Рынок", s.cooler.length ? `${s.cooler.length}` : ""],
    ["orders", "Заказы", readyOrders ? `${readyOrders} готов` : `${s.orders.length}`],
    ["gear", "Снаряжение", ""],
    ["bait", "Наживка", ""],
    ["boats", "Верфь", ""],
    ["map", "Карта", ""],
    ["rest", "Таверна", ""],
  ];
  const building: Building | null = tab === "market" ? "market" : tab === "gear" || tab === "bait" ? "shop" : tab === "boats" ? "shipyard" : tab === "rest" ? "tavern" : null;
  const venue = building ? engine.port.buildings?.[building] : undefined;
  const hot = engine.hot;
  const fc = engine.forecast;
  const atmo = engine.atmosphere.summary();
  const hh = `${String(Math.floor(engine.hour)).padStart(2, "0")}:${String(Math.floor((engine.hour % 1) * 60)).padStart(2, "0")}`;

  return (
    <Modal
      label={mapOnly ? `Точка отправления · ${s.atPort ? engine.port.name : engine.loc.name}` : `Порт · ${engine.port.place}`}
      title={tab === "map" ? "Морской атлас" : venue?.title ?? engine.port.name}
      onClose={onClose}
      tabs={(mapOnly ? tabs.filter(([id]) => id === "map") : tabs).map(([id, n, b]) => (
        <button key={id} className={`tab ${tab === id ? "on" : ""}`} onClick={() => setTab(id)}>
          <HarborGlyph kind={({market:"market",orders:"orders",gear:"shop",bait:"shop",boats:"shipyard",map:"map",rest:"tavern"} as Record<PortTab,HarborSymbol>)[id]} size={16}/>{n}{b && <span className={`num ml-1.5 ${id === "orders" && readyOrders ? "text-[var(--color-ok)]" : "dim"}`}>{b}</span>}
        </button>
      ))}
      right={
        <div className="flex items-center gap-6">
          <div className="hidden text-right sm:block"><div className="label">День {engine.day}</div><div className="num text-[15px] text-[#ece6d8]">{hh}</div></div>
          <div className="text-right"><div className="label hidden sm:block">Средства</div><div className="num text-[15px] text-[var(--brass-2,#e3c996)] sm:text-[18px]">{fmt(s.money)} ₽</div></div>
        </div>
      }
    >
      {flash && <div className="fade-in mx-4 mt-4 sm:mx-7 border-l-2 border-[var(--color-ok)] bg-[rgba(134,180,148,0.08)] px-4 py-2 text-[13px] text-[#cfe3d4]">{flash}</div>}
      <div className="min-w-0 p-4 sm:p-7">
        {!mapOnly && venue && <div className="mb-5 flex min-w-0 items-start gap-3 border-l-2 border-[var(--brass)] bg-[rgba(200,164,106,0.055)] px-4 py-3" data-port-keeper>
          <span className="harbor-venue-glyph"><HarborGlyph kind={building!} size={30}/></span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-[13px] text-[#e3c996]">{venue.keeper.name}</span>
              <span className="text-[10px] uppercase tracking-wider dim">{venue.keeper.role}</span>
            </div>
            <p className="font-serif mt-1 text-[17px] leading-snug text-[#ded8cb]">«{venue.keeper.line}»</p>
          </div>
        </div>}
        {tab === "market" && (
          <div>
            <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="label mb-2">Спрос дня · цена ×1,8</div>
                <div className="flex flex-wrap gap-3">
                  {hot.map((id) => (
                    <div key={id} className="cell flex items-center gap-2 py-1 pl-1 pr-3">
                      <FishIcon fish={FISH_BY_ID[id]} size={52} height={28} known={!!s.codex[id]} />
                      <span className="text-[13px] text-[#ece6d8]">{s.codex[id] ? FISH_BY_ID[id].name : "Неизвестный вид"}</span>
                    </div>
                  ))}
                </div>
              </div>
              <p className="w-full text-[11px] leading-relaxed dim md:order-last">Местная рыба здесь дешевле, привозная — дороже: у каждого порта свой спрос. Улов теряет свежесть — около 10% в сутки, в судах со льдом медленнее. Каждая проданная сегодня рыба вида снижает цену следующей такой же.</p>
              <div className="flex items-center gap-5">
                <div className="text-right">
                  <div className="label">Садок {s.cooler.length}/{engine.coolerCap}</div>
                  <div className="num text-[18px] text-[var(--brass-2,#e3c996)]">{fmt(coolerValue)} ₽</div>
                </div>
                <button className="btn btn-solid" disabled={!s.cooler.length} onClick={() => { const v = engine.sellAll(); say(`Улов продан: ${fmt(v)} ₽`); }}>Продать всё</button>
              </div>
            </div>
            {s.cooler.length === 0 ? (
              <p className="font-serif py-16 text-center text-xl italic dim">Садок пуст</p>
            ) : (
              <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0"><table className="market-table w-full text-[13px]">
                <thead>
                  <tr className="label text-left">
                    <th className="py-2 font-medium" colSpan={2}>Вид</th>
                    <th className="py-2 text-right font-medium">Вес</th>
                    <th className="hidden py-2 text-right font-medium sm:table-cell">Спрос</th>
                    <th className="py-2 text-right font-medium">Цена</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {s.cooler.map((c) => {
                    const f = FISH_BY_ID[c.fishId];
                    const m = engine.marketMult(c.fishId);
                    const sat = engine.saturation(c.fishId);
                    const fr = engine.freshness(c);
                    const best = PORTS.filter((p) => s.portsKnown.includes(p.id) && p.id !== s.port).map((p) => ({ p, d: (p.demand[f.loc[0]] ?? 1) * (f.rarity === "epic" || f.rarity === "legendary" ? p.rareDemand : 1) })).sort((a, b) => b.d - a.d)[0];
                    const hereD = engine.demand(c.fishId);
                    const forOrder = s.orders.some((o) => o.fishId === c.fishId && c.weight >= o.minWeight);
                    return (
                      <tr key={c.uid} className="border-t border-[var(--line)]">
                        <td className="w-20 py-1.5"><FishIcon fish={f} size={72} height={36} variant={c.variant} /></td>
                        <td className="py-1.5">
                          <div className="text-[#ece6d8]">{f.name}</div>
                          <div className="text-[11px] dim">{c.variant ? VARIANT_INFO[c.variant].name : RARITY_INFO[f.rarity].name}{forOrder ? " · нужна для заказа" : ""}</div>
                          <div className="flex flex-wrap gap-x-3 text-[10.5px]">
                            <span className={fr < 0.8 ? "text-[var(--color-bad)]" : fr < 0.95 ? "text-[#d8c090]" : "text-[var(--color-ok)]"}><MiscIcon name="fresh" size={11} className="mr-0.5 inline -translate-y-px" />{Math.round(fr * 100)}%</span>
                            {best && best.d > hereD * 1.08 && <span className="text-[var(--brass)]"><MiscIcon name="demand" size={11} className="mr-0.5 inline -translate-y-px" />{best.p.name} ×{best.d.toFixed(2)}</span>}
                          </div>
                        </td>
                        <td className="num py-1.5 text-right muted">{fmtW(c.weight)}</td>
                        <td className={`num hidden py-1.5 text-right sm:table-cell ${m >= 1 ? "text-[var(--color-ok)]" : "text-[var(--color-bad)]"}`}>{m >= 1.9 ? "×2" : `${m >= 1 ? "+" : "−"}${Math.abs(Math.round((m - 1) * 100))}%`}</td>
                        <td className="num py-1.5 text-right text-[var(--brass-2,#e3c996)]">{fmt(quote.get(c.uid) ?? engine.marketValue(c))} ₽{sat < 0.999 && <div className="text-[10px] text-[var(--color-bad)]">рынок −{Math.round((1 - sat) * 100)}%</div>}</td>
                        <td className="w-24 py-1.5 text-right"><button className="btn btn-sm btn-quiet" onClick={() => engine.sellOne(c.uid)}>Продать</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table></div>
            )}
          </div>
        )}

        {tab === "orders" && (
          <div>
            <p className="mb-5 max-w-2xl text-[13px] muted">После сбора улова выплата пересчитывается и гарантирует минимум 15% сверх отдельной продажи тех же рыб. Несобранный заказ показывает базовую оплату. Заказы обновляются при заходе в порт. Выполнено: <span className="num text-[#ece6d8]">{s.ordersDone}</span></p>
            <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
              {s.orders.map((o) => {
                const f = FISH_BY_ID[o.fishId];
                const have = engine.orderMatches(o).length;
                const known = !!s.codex[o.fishId];
                const left = o.expiresDay - engine.day;
                const ready = have >= o.count;
                const payout = engine.orderReward(o);
                return (
                  <div key={o.id} className={`cell flex flex-col p-5 ${ready ? "!border-[rgba(134,180,148,0.45)]" : ""}`}>
                    <div className="flex items-center justify-between"><span className="label">{o.client}</span><span className={`text-[11px] ${left <= 0 ? "text-[var(--color-bad)]" : "dim"}`}>{left <= 0 ? "последний день" : `${left} дн.`}</span></div>
                    <div className="plate my-3 flex justify-center py-2"><FishIcon fish={f} size={200} height={84} known={known} /></div>
                    <div className="font-serif text-[22px] text-[#f1ebdd]">{known ? f.name : "Неизвестный вид"}</div>
                    <div className="text-[11px] dim">{known ? f.latin : LOC_BY_ID[f.loc[0]].name}</div>
                    <dl className="mt-3">
                      <Row k="Количество" v={<span className={ready ? "text-[var(--color-ok)]" : ""}>{have} / {o.count}</span>} />
                      {o.minWeight > 0 && <Row k="Масса от" v={fmtW(o.minWeight)} />}
                      <Row k={ready ? "Оплата · бонус к рынку" : "Базовая оплата"} v={<span className="text-[var(--brass-2,#e3c996)]">{fmt(payout)} ₽</span>} strong />
                    </dl>
                    <button className="btn btn-solid mt-4 w-full" disabled={!ready} onClick={() => engine.fulfillOrder(o.id) && say(`Заказ сдан: +${fmt(payout)} ₽`)}>Сдать заказ</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === "gear" && (
          <div>
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <details className="gear-notes min-w-0 flex-1"><summary className="cursor-pointer text-[12px] text-[var(--brass)]">Мастерская и доработки</summary><p className="mt-2 max-w-3xl text-[12px] leading-relaxed muted">Каждая снасть имеет класс и три ступени доработок. Уровень доработки не может быть выше класса самой снасти, а мастерские разных портов берутся за разную сложность. Здесь, в «{engine.port.name}», — до класса {engine.port.gearMax.rod + 1} и доработок {Math.min(3, engine.port.gearMax.rod)} уровня; цены ×{engine.port.priceMult.toFixed(2)}.</p></details>
              <div className="hidden text-right sm:block"><div className="label">Средства</div><div className="num text-[18px] text-[var(--brass-2,#e3c996)]">{fmt(s.money)} ₽</div></div>
            </div>
            <div className="space-y-3">
              {GEAR_ROWS.map(([k, name, what]) => {
                const list = gearList(k);
                const lvl = s[k];
                const cur = list[lvl], next = list[lvl + 1];
                const block = engine.gearBlock(k);
                const mods = k === "sonar" ? [] : engine.modsOf(k);
                return (
                  <div key={k} className="cell grid min-w-0 gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1.4fr)]">
                    <div className="flex min-w-0 gap-4">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center border border-[var(--line-2)] bg-[#081019] text-[var(--brass)] sm:h-16 sm:w-16"><GearIcon kind={k} size={38} /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-baseline justify-between gap-2">
                          <span className="min-w-0 truncate label">{name}</span>
                          <span className="num shrink-0 text-[10px] dim">класс {lvl + 1}/{list.length}</span>
                        </div>
                        <div className="font-serif break-words text-[22px] leading-tight text-[#f1ebdd]">{cur.name}</div>
                        <div className="break-words text-[12px] muted">{what}: <span className="num text-[#ece6d8]">{gearValue(k, cur.value, cur.desc)}</span></div>
                        <div className="mt-2 flex gap-1">{list.map((_, i) => <div key={i} className={`h-[3px] flex-1 ${i <= lvl ? "bg-[var(--brass)]" : i <= engine.port.gearMax[k] ? "bg-white/25" : "bg-white/8"}`} />)}</div>
                        {next ? (
                          <div className="mt-3 flex min-w-0 flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                            <div className="min-w-0 flex-1">
                              <div className="break-words text-[13px] text-[#ece6d8]">→ {next.name}</div>
                              <div className="break-words text-[11px] dim">{next.desc}{k !== "hook" && k !== "sonar" ? ` · ${gearValue(k, next.value, next.desc)}` : ""}</div>
                            </div>
                            <button className="btn btn-sm btn-solid min-w-0 w-full !h-auto min-h-8 !whitespace-normal py-2 sm:w-auto" disabled={!!block} onClick={() => engine.buyGear(k) && say(`Приобретено: ${next.name}`)}>{block ?? `${fmt(engine.gearPrice(k))} ₽`}</button>
                          </div>
                        ) : <div className="mt-3 text-[12px] text-[var(--color-ok)]">Лучшее из доступного</div>}
                      </div>
                    </div>
                    {mods.length > 0 ? (
                      <div className="grid min-w-0 gap-2 border-t border-[var(--line)] pt-3 lg:grid-cols-3 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
                        {mods.map((m) => {
                          const ml = engine.mod(m.id);
                          const mb = engine.modBlock(m.id);
                          return (
                            <div key={m.id} className="flex min-w-0 flex-col border border-[var(--line)] bg-[#0a121c] p-3">
                              <div className="flex min-w-0 items-center justify-between gap-2">
                                <span className="min-w-0 break-words text-[12.5px] leading-tight text-[#ece6d8]">{m.name}</span>
                                <span className="flex shrink-0 gap-[3px]">{Array.from({ length: m.max }, (_, i) => <span key={i} className={`h-2 w-2 rotate-45 ${i < ml ? "bg-[var(--brass)]" : i < lvl ? "border border-[var(--brass)]/50" : "border border-white/15"}`} />)}</span>
                              </div>
                              <div className="mt-1 break-words text-[11px] text-[#cfc6b3]">{ml > 0 ? m.desc(ml) : "Не установлено"}</div>
                              {ml < m.max && <div className="break-words text-[10.5px] dim">Ур. {ml + 1}: {m.desc(ml + 1)}</div>}
                              <button className="btn btn-sm mt-auto w-full !h-7 !text-[9.5px]" style={{ marginTop: 10 }} disabled={!!mb} onClick={() => engine.buyMod(m.id) && say(`${m.name}: уровень ${ml + 1}`)}>{mb ?? `${fmt(engine.modPrice(m.id))} ₽`}</button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="border-t border-[var(--line)] pt-3 text-[12px] leading-relaxed muted lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
                        {cur.desc}. Эхолот видит рельеф и рыбу по горизонтам; старшие модели отмечают редкость, ещё не пойманные виды и легенд.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === "bait" && (
          <div>
            <p className="mb-4 max-w-3xl text-[12px] muted">Натуральная наживка съедается почти каждой рыбой. Искусственные приманки служат долго и теряются в основном при обрыве. Крупная наживка отсекает мелочь и приносит рыбу тяжелее; вне рабочего диапазона глубин любая наживка работает хуже.</p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {BAITS.map((b) => {
                const sold = engine.baitSold(b.id);
                const have = b.id === "worm" ? "∞" : String(s.baits[b.id] ?? 0);
                const where = PORTS.filter((p) => p.baits.includes(b.id)).map((p) => p.name).join(", ");
                return (
                  <div key={b.id} className={`cell flex flex-col p-4 ${s.currentBait === b.id ? "!border-[rgba(200,164,106,0.5)]" : ""}`}>
                    <div className="flex items-start gap-3">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center border border-[var(--line)] bg-[#081019]"><BaitIcon id={b.id} size={34} /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-serif text-[19px] leading-tight text-[#f1ebdd]">{b.name}</span>
                          <span className="num text-[13px] text-[#ece6d8]">{have}</span>
                        </div>
                        <div className="label !text-[9px]">{b.kind === "lure" ? "искусственная" : b.kind === "special" ? "особая" : "натуральная"}{b.mimics ? ` · как ${b.mimics.map((m) => BAIT_BY_ID[m].name.toLowerCase()).join(", ")}` : ""}</div>
                      </div>
                    </div>
                    <p className="mt-2 text-[12px] leading-snug muted">{b.desc}</p>
                    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
                      <StatBar k="Размер" v={(b.size + 1) / 2} t={b.size > 0.35 ? "крупная" : b.size < -0.35 ? "мелкая" : "средняя"} />
                      <StatBar k="Поклёвка" v={(b.bite - 0.8) / 0.5} t={`${b.bite >= 1 ? "+" : "−"}${Math.abs(Math.round((b.bite - 1) * 100))}%`} />
                      <StatBar k="Прочность" v={b.durable} t={b.id === "worm" ? "∞" : `${Math.round(b.durable * 100)}%`} />
                      <StatBar k="Глубина" v={Math.min(1, Math.log10(b.depth[1] + 1) / 3.3)} t={`${b.depth[0]}–${b.depth[1]} м`} />
                    </div>
                    <div className="mt-auto pt-4">
                      {b.price > 0 && (sold ? (
                        <button className="btn btn-sm w-full" disabled={s.money < engine.baitPrice(b.id)} onClick={() => engine.buyBait(b.id) && say(`${b.name}: +${b.pack}`)}>+{b.pack} шт · {fmt(engine.baitPrice(b.id))} ₽</button>
                      ) : (
                        <div className="border border-[var(--line)] px-3 py-2 text-[11px] dim">Здесь не продаётся · {where}</div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === "boats" && (
          <div>
            <p className="mb-5 max-w-3xl text-[13px] muted">Суда остаются во владении — выходите в море на том, что лучше подходит для задачи. Класс судна открывает акватории; купить судно можно, если во флоте есть судно предыдущего класса.</p>
            {BOAT_CLASS_NAMES.map((cn, tier) => (
              <div key={cn} className="mb-6">
                <div className="mb-2 flex items-baseline gap-3">
                  <span className="label-brass">Класс {romanize(tier + 1)}</span>
                  <span className="font-serif text-[18px] text-[#ece6d8]">{cn}</span>
                  <span className="text-[11px] dim">{LOCATIONS.filter((l) => l.boatTier === tier).map((l) => l.name).join(", ")}</span>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {BOATS.map((b, i) => ({ b, i })).filter(({ b }) => b.tier === tier).map(({ b, i }) => {
                    const owned = s.boatsOwned.includes(i);
                    const active = s.boat === i;
                    const block = engine.boatBlock(i);
                    const tooFull = owned && !active && s.cooler.length > b.cooler + engine.perk("cooler") * 2;
                    return (
                      <div key={b.id} className={`cell flex flex-col p-4 sm:p-5 ${active ? "!border-[rgba(200,164,106,0.55)]" : ""} ${!owned && b.tier > engine.fleetTier + 1 ? "opacity-55" : ""}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-serif text-[21px] leading-tight text-[#f1ebdd]">{b.name}</div>
                            <div className="text-[11px] text-[var(--brass)]">{b.special}</div>
                          </div>
                          {active ? <span className="label-brass shrink-0">В строю</span> : owned ? <span className="label shrink-0">Во флоте</span> : <span className="num shrink-0 text-[15px] text-[var(--brass-2,#e3c996)]">{fmt(b.price)} ₽</span>}
                        </div>
                        <BoatPreview hull={b.hull} trim={b.trim} tier={b.tier} style={b.style} />
                        <p className="text-[12px] muted">{b.desc}</p>
                        <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-1.5">
                          <StatBar k="Трюм" v={b.cooler / 42} t={`${b.cooler}`} />
                          <StatBar k="Ход" v={(1.45 - b.travelMult) / 0.85} t={`×${(1 / b.travelMult).toFixed(2)}`} />
                          <StatBar k="Остойчивость" v={b.stability} t={b.stormSafe ? "штормовое" : `${Math.round(b.stability * 100)}%`} />
                          <StatBar k="Бесшумность" v={(b.quiet - 0.8) / 0.5} t={`${b.quiet >= 1 ? "+" : "−"}${Math.abs(Math.round((b.quiet - 1) * 100))}%`} />
                          <StatBar k="Расход топлива" v={1 - b.fuel / 420} t={b.fuel ? `${b.fuel} ₽/ч` : "нет"} />
                          <StatBar k="К редким видам" v={b.rareBonus / 0.12} t={b.rareBonus ? `+${Math.round(b.rareBonus * 100)}%` : "—"} />
                        </div>
                        <div className="mt-auto pt-4">
                          {active ? null : owned ? (
                            <button className="btn btn-quiet w-full" disabled={tooFull} onClick={() => engine.setBoat(i) && say(`Выходим на судне «${b.name.split("«")[1]?.replace("»", "") ?? b.name}»`)}>{tooFull ? "Улов не поместится в трюм" : "Пересесть"}</button>
                          ) : (
                            <button className="btn btn-solid w-full" disabled={!!block} onClick={() => engine.buyBoat(i) && say(`Новое судно: ${b.name}`)}>{block ?? `Купить · ${fmt(b.price)} ₽`}</button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "map" && <WorldAtlas engine={engine} onSail={(id) => onTravel({ kind: "port", port: id })} onGo={(l, sp) => {
          if (!engine.s.atPort && l === engine.s.location) {
            onClose();
            return;
          }
          onTravel({ kind: "loc", loc: l, spot: sp });
        }} />}

        {tab === "rest" && (
          <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
            <div className="cell p-5 sm:p-6">
              <div className="label">{engine.port.buildings?.tavern.title ?? TAVERN[engine.port.id]}</div>
              <h3 className="font-serif mt-1 flex items-center gap-2 text-2xl text-[#f1ebdd]"><MiscIcon name="bed" size={20} className="text-[var(--brass)]" />Ночлег</h3>
              <p className="mt-2 text-[13px] muted">Комнаты сдают с 19:00 до 4:00, не чаще раза за 16 часов. Отдых до пяти утра, за ночь сменится погода и появятся новые заказы. Цена ночлега — <span className="num text-[#ece6d8]">{fmt(engine.port.innFee)} ₽</span>.</p>
              <div className="mt-5 flex items-center gap-4 border-y border-[var(--line)] py-4">
                <span aria-hidden="true" className="text-3xl leading-none">{atmo.icon}</span>
                <div>
                  <div className="label">Сводка по радио</div>
                  <div className="text-[13px] text-[#ece6d8]">Сейчас {atmo.weatherName.toLowerCase()}, {atmo.temp > 0 ? "+" : ""}{atmo.temp}°, ветер {atmo.wind} м/с, облачность {atmo.cover}%. Через ~{Math.max(1, Math.round(fc.inMin / 60))} ч ожидается: {WEATHER_INFO[fc.w].name.toLowerCase()}.</div>
                </div>
              </div>
              <button className="btn btn-solid mt-5" disabled={!!engine.restBlock} onClick={onRest}>{engine.restBlock ?? `Снять комнату · ${fmt(engine.port.innFee)} ₽`}</button>
            </div>
            <div className="cell p-5 sm:p-6">
              {engine.port.ambience && <p className="font-serif mb-4 text-[17px] italic leading-snug muted">{engine.port.ambience}</p>}
              {engine.port.dish && <div className="mb-4 text-[12px] muted"><span className="label-brass mr-2">На столе</span>{engine.port.dish}</div>}
              {!!engine.port.rumours?.length && <div className="mb-5 border-y border-[var(--line)] py-3">
                <div className="label mb-2">Разговоры у причала</div>
                <p className="text-[12px] leading-relaxed muted">{engine.port.rumours[(engine.day - 1) % engine.port.rumours.length]}</p>
                <p className="mt-1.5 text-[10px] dim">Местные байки. Действующие заказы — на доске заказов.</p>
              </div>}
              <div className="label">Судовой журнал</div>
              <div className="mt-3">
                <div className="mb-3"><div className="label mb-1">Имя</div><input aria-label="Имя в судовом журнале" className="field !text-left" maxLength={24} defaultValue={s.name} onBlur={(ev) => engine.setName(ev.target.value)} /></div>
                <dl>
                  <Row k="Поймано рыб" v={fmt(s.stats.totalCaught)} />
                  <Row k="Заработано" v={`${fmt(s.stats.totalEarned)} ₽`} />
                  <Row k="Выполнено заказов" v={fmt(s.ordersDone)} />
                  <Row k="Крупнейший улов" v={s.stats.biggest ? `${FISH_BY_ID[s.stats.biggest.fishId]?.name}, ${fmtW(s.stats.biggest.weight)}` : "—"} />
                  <Row k="Сохранение" v={cloud} />
                </dl>
              </div>
              <button className="btn btn-sm btn-danger mt-5" onClick={() => { if (confirm("Стереть сохранение и начать заново?")) onReset(); }}>Начать заново</button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

const romanize = (n: number) => ["I", "II", "III", "IV", "V", "VI"][n - 1] ?? String(n);

// Морская карта
const GEAR_ROWS: [GearKind, string, string][] = [["rod", "Удилище", "Предел натяжения"], ["reel", "Катушка", "Скорость подмотки"], ["line", "Леска", "Рабочая глубина"], ["hook", "Крючок", "Удержание"]];
const gearValue = (k: GearKind, v: number, desc: string) => (k === "line" ? `${v} м` : k === "reel" ? `×${v}` : k === "hook" ? ["базовое", "острое", "надёжное", "самозасекающее", "абсолютное"][v] ?? String(v) : k === "sonar" ? desc.toLowerCase() : String(v));
const TAVERN: Record<PortId, string> = { home: "Таверна «Старый якорь»", nordhavn: "Постоялый двор «Кракен»", mirador: "Отель «Пирс»", coral: "Гостевой дом «Ла Пальма»", southcross: "Жилой модуль станции" };


function StatBar({ k, v, t }: { k: string; v: number; t: string }) {
  return (
    <div>
      <div className="flex justify-between text-[11px]"><span className="muted">{k}</span><span className="num text-[#ddd7ca]">{t}</span></div>
      <div className="mt-1 h-[3px] bg-white/10"><div className="h-full bg-[var(--brass)]" style={{ width: `${Math.max(4, Math.min(1, v) * 100)}%` }} /></div>
    </div>
  );
}

/** Превью судна в верфи: настоящий рисунок из игровой сцены, в масштабе длин */
export function BoatPreview(p: { hull: string; trim: string; tier: number; style?: string; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const use3d = getBoat3dPref();
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const st = (p.style ?? "row") as BoatStyle;
    let raf = 0;
    const draw = () => {
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = Math.max(1, Math.floor(cv.clientWidth * dpr));
      const H = Math.max(1, Math.floor(cv.clientHeight * dpr));
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      ctx.clearRect(0, 0, W, H);
      const wl = H * 0.66;
      ctx.fillStyle = "rgba(143,179,200,0.10)";
      ctx.fillRect(0, wl, W, H - wl);
      ctx.strokeStyle = "rgba(143,179,200,0.35)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, wl + 0.5);
      ctx.lineTo(W, wl + 0.5);
      ctx.stroke();
      // 3D-режим: снимок общей WebGL-сцены; нет WebGL — прежний рисунок
      if (use3d) {
        const sn = boat3dSnapshot(st, W, H);
        if (sn) {
          ctx.drawImage(sn, 0, 0, W, H);
          return;
        }
      }
      const sp = getSprite(st);
      if (!sp) { raf = requestAnimationFrame(draw); return; }
      const A = ART[st];
      const pxm = (W * 0.92) / 14.5;
      const bw = A.w * pxm;
      const bh = (bw * sp.h) / sp.w;
      const x = (W - bw) / 2;
      const y = wl - A.wl * bh;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      // лёгкое отражение в воде
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.translate(0, 2 * wl);
      ctx.scale(1, -1);
      ctx.drawImage(sp.mips[0], x, y, bw, bh);
      ctx.restore();
      ctx.drawImage(sp.mips[0], x, y, bw, bh);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [p.style, use3d]);
  return <canvas ref={ref} className={p.className ?? "my-2 h-24 w-full"} />;
}
