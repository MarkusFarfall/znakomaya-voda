"use client";

import type { Engine } from "@/game/engine";
import { MAX_LEVEL, QUESTS, levelTitle, xpForLevel } from "@/game/progress";
import { Icon } from "./Icons";

const fmt = (n: number) => Math.round(n).toLocaleString("ru-RU");

export function XpBar({ engine }: { engine: Engine }) {
  const lvl = engine.level;
  const lo = lvl === 1 ? 0 : xpForLevel(lvl - 1);
  const hi = xpForLevel(lvl);
  const k = lvl >= MAX_LEVEL ? 1 : (engine.s.xp - lo) / (hi - lo);
  return (
    <div className="w-full">
      <div className="flex items-baseline justify-between">
        <span className="label">Уровень <span className="num text-[#ece6d8]">{lvl}</span> · <span className="normal-case tracking-normal text-[#cfc6b3]">{levelTitle(lvl)}</span></span>
        <span className="num text-[10px] dim">{lvl >= MAX_LEVEL ? "максимум" : `${fmt(engine.s.xp - lo)} / ${fmt(hi - lo)}`}</span>
      </div>
      <div className="mt-1.5 h-px w-full bg-[var(--line-2)]">
        <div className="h-px bg-[var(--brass)] transition-all duration-700" style={{ width: `${k * 100}%` }} />
      </div>
    </div>
  );
}

export function QuestTracker({ engine, onOpen }: { engine: Engine; onOpen: () => void }) {
  const s = engine.s;
  if (s.quest >= QUESTS.length) return null;
  const q = QUESTS[s.quest];
  const [a, b] = q.progress(s);
  return (
    <button onClick={onOpen} className="glass block w-full px-4 py-3 text-left transition hover:border-[var(--line-2)]">
      <div className="flex items-center justify-between">
        <span className="label-brass">Письмо {s.quest + 1} · {QUESTS.length}</span>
        {engine.hasLetter && <span className="label pulse-soft !text-[var(--brass)]">новое</span>}
      </div>
      <div className="font-serif mt-1 text-[18px] leading-tight text-[#f1ebdd]">{q.title}</div>
      <div className="mt-0.5 flex items-baseline gap-3 text-[12px] muted">
        <span className="flex-1">{q.goal}</span>
        {b > 1 && <span className="num text-[11px] text-[#ddd7ca]">{fmt(a)} / {fmt(b)}</span>}
      </div>
      {b > 1 && <div className="mt-2 h-px bg-[var(--line-2)]"><div className="h-px bg-[var(--brass)]" style={{ width: `${Math.min(1, a / b) * 100}%` }} /></div>}
    </button>
  );
}

export function DailyTracker({ engine, onOpen }: { engine: Engine; onOpen: () => void }) {
  const d = engine.daily;
  if (!d.tasks.length) return null;
  const ready = d.tasks.filter((t) => t.done && !t.claimed).length;
  const done = d.tasks.filter((t) => t.done).length;
  const next = d.tasks.find((t) => !t.done);
  return (
    <button onClick={onOpen} className="glass block w-full px-4 py-2.5 text-left transition hover:border-[var(--line-2)]">
      <div className="flex items-center justify-between">
        <span className="label-brass">Задания дня · {done}/{d.tasks.length}</span>
        {ready > 0 ? <span className="label pulse-soft !text-[var(--brass)]">награда ×{ready}</span> : d.streak > 0 && <span className="label">серия {d.streak}</span>}
      </div>
      {next ? (
        <div className="mt-1 flex items-center gap-3 text-[12px]">
          <span className="flex-1 truncate text-[#ddd7ca]">{next.title}</span>
          <span className="num text-[11px] muted">{fmt(Math.floor(next.progress))}/{fmt(next.goal)}</span>
        </div>
      ) : (
        <div className="mt-1 text-[12px] text-[var(--color-ok)]">{d.bonusClaimed ? "Всё выполнено на сегодня" : "Все выполнены — откройте сундук"}</div>
      )}
    </button>
  );
}
