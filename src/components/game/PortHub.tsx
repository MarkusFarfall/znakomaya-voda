"use client";

import { useGameDialog } from "./Dialog";
import { useState, type CSSProperties } from "react";
import type { Engine, Trip } from "@/game/engine";
import type { Building, Hotspot } from "@/game/render/port";
import { BOATS, LOC_BY_ID, SEASONS, spotsOf } from "@/game/world";
import { AccountBadge, type AccountState } from "./Account";
import { Icon } from "./Icons";
import { HarborGlyph, PORT_ACCENT } from "./PortIdentity";
import { fmt } from "./Panels";

const LABELS: Record<Building, { name: string; sub: string }> = {
  market: { name: "Рынок", sub: "продать улов" },
  shop: { name: "Лавка снастей", sub: "снаряжение и наживка" },
  shipyard: { name: "Верфь", sub: "суда" },
  tavern: { name: "Таверна", sub: "ночлег и покой" },
};

function BuildingIcon({ b, size = 18 }: { b: Building | "sea" | "orders"; size?: number }) {
  return <HarborGlyph kind={b} size={size} />;
}

const fmtH = (m: number) => (m >= 60 ? `${(m / 60).toFixed(1).replace(".", ",")} ч` : `${Math.round(m)} мин`);

function DepartSheet({ engine, onClose, onTravel, onMap }: { engine: Engine; onClose: () => void; onTravel: (t: Trip) => void; onMap: () => void }) {
  const dialog = useGameDialog(onClose);
  const s = engine.s;
  const port = engine.port;
  const last: Trip = { kind: "loc", loc: s.location, spot: s.spot };
  const lastOk = LOC_BY_ID[s.location].boatTier <= engine.boat.tier;
  const quote = (t: Trip) => engine.tripQuote(t, engine.canMotor ? "motor" : "sail");
  return (
    <div className="zv-ui game-travel-choice fade-in absolute inset-0 z-30 flex min-w-0 max-w-[100vw] items-end justify-center overflow-x-hidden bg-[#02050a]/60 backdrop-blur-[2px] sm:items-center sm:p-4" onPointerDown={(e) => { e.stopPropagation(); onClose(); }}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-label="Куда выходим?" data-game-dialog tabIndex={-1} className="sheet reveal safe-bottom min-w-0 max-w-full max-h-[88dvh] w-full overflow-x-hidden overflow-y-auto !rounded-none p-5 sm:!rounded-[3px] sm:max-w-[620px] sm:p-7" onPointerDown={(e) => e.stopPropagation()}>
        <div className="flex min-w-0 items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="truncate label-brass">Отплытие · {engine.boat.name}</div>
            <h2 className="font-serif mt-1 truncate text-[30px] leading-none text-[#f1ebdd]">Куда выходим?</h2>
          </div>
          <button className="iconbtn shrink-0" onClick={onClose} aria-label="Закрыть"><Icon name="close" size={16} /></button>
        </div>
        {lastOk && (
          <button onClick={() => onTravel(last)} className="cell cell-hover mt-5 flex w-full items-center gap-4 !border-[rgba(200,164,106,0.55)] p-4 text-left">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center border border-[var(--brass)] text-[var(--brass)]"><Icon name="pin" size={20} /></span>
            <span className="min-w-0 flex-1">
              <span className="label-brass block">Вернуться</span>
              <span className="block font-serif text-[20px] leading-tight text-[#f1ebdd]">{engine.spot.name}</span>
              <span className="block text-[11px] dim">{LOC_BY_ID[s.location].name}</span>
            </span>
            <span className="num shrink-0 text-right text-[12px] muted">{fmtH(quote(last).minutes)}</span>
          </button>
        )}
        {port.serves.map((lid) => {
          const L = LOC_BY_ID[lid];
          const fog = !engine.isUnlocked(lid);
          const locked = fog || L.boatTier > engine.boat.tier;
          return (
            <div key={lid} className="mt-5">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="font-serif text-[18px] text-[#ece6d8]">{fog ? "Не разведано" : L.name}</span>
                <span className="text-[11px] dim">{fog ? engine.unlockState(lid).reqs.filter((r) => !r.ok).map((r) => r.label).join(" · ") : locked ? `нужно судно класса ${L.boatTier + 1}` : `до ${L.maxDepth} м`}</span>
              </div>
              <div className="grid gap-1.5 sm:grid-cols-3">
                {spotsOf(lid).map((sp) => {
                  const t: Trip = { kind: "loc", loc: lid, spot: sp.id };
                  const q = quote(t);
                  return (
                    <button key={sp.id} disabled={locked} onClick={() => onTravel(t)} className="cell cell-hover p-3 text-left disabled:cursor-not-allowed disabled:opacity-40">
                      <span className="block text-[13px] leading-tight text-[#ece6d8]">{sp.name}</span>
                      <span className="mt-1 flex justify-between text-[10.5px] dim">
                        <span className={sp.maxDepth > engine.line.value ? "text-[var(--color-bad)]" : ""}>{sp.maxDepth} м</span>
                        <span className="num">{fmtH(q.minutes)}{q.fuel ? ` · ${fmt(q.fuel)} ₽` : ""}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        <button className="btn btn-quiet mt-6 w-full" onClick={onMap}><Icon name="map" size={14} />Другие акватории и порты — на карте</button>
        {engine.fleetTier > engine.boat.tier && <p className="mt-3 text-[11px] dim">На верфи можно пересесть на судно старшего класса: {BOATS.filter((b, i) => s.boatsOwned.includes(i) && b.tier > engine.boat.tier).map((b) => b.name).join(", ")}.</p>}
      </div>
    </div>
  );
}

export function PortHub({ engine, hot, compact, onOpen, onTravel, onJournal, onCodex, account, onAccount, onHover, onSettings }: {
  engine: Engine;
  hot: Hotspot[];
  compact: boolean;
  onOpen: (b: Building | "map" | "orders") => void;
  onTravel: (t: Trip) => void;
  onJournal: () => void;
  onCodex: () => void;
  onSettings: () => void;
  account: AccountState;
  onAccount: () => void;
  onHover?: (b: Building | null) => void;
}) {
  const s = engine.s;
  const port = engine.port;
  const [depart, setDepart] = useState(false);
  const atmo = engine.atmosphere.summary();
  const hh = String(Math.floor(engine.hour)).padStart(2, "0");
  const mm = String(Math.floor(engine.s.minutes % 60)).padStart(2, "0");
  const ready = s.orders.filter((o) => engine.orderMatches(o).length >= o.count).length;
  const coolerValue = [...engine.coolerQuote().values()].reduce((a, b) => a + b, 0);
  const badges: Partial<Record<Building, string>> = {
    market: s.cooler.length ? `${s.cooler.length} · ${fmt(coolerValue)} ₽` : "",
    shop: engine.perkPoints ? "" : "",
  };
  const dock: { id: Building | "sea" | "orders"; name: string }[] = [
    { id: "market", name: "Рынок" },
    { id: "orders", name: ready ? `Заказы · ${ready}` : "Заказы" },
    { id: "shop", name: "Лавка" },
    { id: "shipyard", name: "Верфь" },
    { id: "tavern", name: "Таверна" },
  ];

  return (
    <div style={{ "--port-accent": PORT_ACCENT[port.id] } as CSSProperties} className="zv-ui game-port harbor-ui hud-layer z-20" onPointerDown={(e) => e.stopPropagation()}>
      {/* шапка */}
      <div className="harbor-header">
        <div className="harbor-identity fade-in">
          <div className="harbor-crest"><HarborGlyph kind="crest" size={32}/></div><div className="harbor-title">
          <div className="harbor-kicker">{port.place}</div>
          <h1>{port.name}</h1>
          <div className="harbor-weather">
            <span className="num text-[15px] text-[#f1ebdd]">{hh}:{mm}</span>
            <span className="flex items-center gap-1"><Icon name={s.weather === "clear" ? "sun" : s.weather === "cloudy" ? "cloud" : s.weather} size={14}/>{atmo.weatherName} · {atmo.temp > 0 ? "+" : ""}{atmo.temp}°</span>
            <span className="hidden dim sm:inline">{SEASONS[engine.season]}, день {engine.dayOfSeason}</span>
          </div>
          {engine.fairBonus > 1 && <div className="mt-1.5 text-[11px] text-[var(--brass-2,#e3c996)]">Ярмарка выходного дня · цены на рынке +10%</div>}
          {port.tagline && !compact && <p className="harbor-tagline">{port.tagline}</p>}
          </div>
        </div>
        <div className="harbor-utilities">
          <div className="flex gap-1.5">
            <AccountBadge account={account} compact onClick={onAccount} />
            <button className="iconbtn" onClick={onJournal} aria-label="Журнал"><Icon name="journal" size={16} />{(engine.perkPoints > 0 || engine.hasLetter || engine.daily.tasks.some((t) => t.done && !t.claimed)) && <span className="dot" />}</button>
            <button className="iconbtn" onClick={onCodex} aria-label="Кодекс"><Icon name="book" size={16} /></button>
          </div>
          <div className="harbor-resources num">
            <span className="text-[var(--brass-2,#e3c996)]">{fmt(s.money)} ₽</span>
            <span className="text-[#ece6d8]"><Icon name="basket" size={12} className="mr-1 inline -translate-y-px opacity-60" />{s.cooler.length}/{engine.coolerCap}</span>
          </div>
        </div>
      </div>

      {/* метки зданий на сцене */}
      {hot.filter((h) => h.id !== "dock").map((h) => {
        const b = h.id as Building;
        const L = LABELS[b];
        const venue = port.buildings?.[b];
        const title = venue?.title ?? L.name;
        return (
          <button
            key={b}
            onClick={() => onOpen(b)}
            aria-label={`${L.name} · ${title}`}
            title={`${title} — ${L.sub}`}
            data-port-hotspot={b}
            onPointerEnter={() => onHover?.(b)}
            onPointerLeave={() => onHover?.(null)}
            onFocus={() => onHover?.(b)}
            onBlur={() => onHover?.(null)}
            className="harbor-hotspot group absolute -translate-x-1/2 -translate-y-full text-center focus-visible:outline-2 focus-visible:outline-[var(--brass)]"
            style={{ left: compact ? `clamp(26px, ${h.x}px, calc(100% - 26px))` : `clamp(92px, ${h.x}px, calc(100% - 92px))`, top: Math.max(compact ? 180 : 190, h.y - 6) }}
          >
            <span className={`harbor-hotspot-face flex items-center justify-center gap-2 transition group-hover:border-[var(--brass)] ${compact ? "h-11 w-11" : "max-w-[180px] px-2.5 py-2"}`}>
              <span className="shrink-0 text-[var(--brass)]"><BuildingIcon b={b} size={compact ? 20 : 16} /></span>
              {!compact && <span className="min-w-0 text-left">
                <span className="block text-[12px] leading-tight text-[#f1ebdd]">{title}</span>
                <span className="mt-0.5 block text-[10px] leading-tight dim">{badges[b] || L.sub}</span>
              </span>}
            </span>
            <span className="mx-auto block h-3 w-px bg-[var(--brass)]/60" />
          </button>
        );
      })}

      <div className="harbor-console">
        <div className="harbor-console-meta"><span><HarborGlyph kind="crest" size={14}/> {port.name} · портовые службы</span><small>{engine.boat.name}</small></div>
        <div className="harbor-console-body">
          <nav className="harbor-services" aria-label="Портовые службы">
            {dock.map(d=><button key={d.id} onClick={()=>onOpen(d.id as Building | "orders")}><BuildingIcon b={d.id} size={23}/><span>{d.name}</span>{d.id==="market"&&s.cooler.length>0&&<i>{s.cooler.length}</i>}</button>)}
            <button className="harbor-map-button" onClick={()=>onOpen("map")}><HarborGlyph kind="map" size={23}/><span>Атлас</span></button>
          </nav>
          <div className="harbor-depart-row"><button onClick={()=>setDepart(true)} className="harbor-depart"><HarborGlyph kind="sea" size={25}/><span><b>Выйти в море</b><small>{engine.spot.name}</small></span><span aria-hidden="true">↗</span></button><button className="harbor-settings" onClick={onSettings} aria-label="Настройки"><Icon name="gear" size={20}/></button></div>
        </div>
      </div>
      {depart && <DepartSheet engine={engine} onClose={() => setDepart(false)} onTravel={(t) => { setDepart(false); onTravel(t); }} onMap={() => { setDepart(false); onOpen("map"); }} />}
    </div>
  );
}
