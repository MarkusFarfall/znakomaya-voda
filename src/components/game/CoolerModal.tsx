"use client";

import { useState } from "react";
import type { Engine } from "@/game/engine";
import { FISH_BY_ID, RARITY_INFO, VARIANT_INFO } from "@/game/fish";
import { LOC_BY_ID } from "@/game/world";
import { FishIcon } from "./FishIcon";
import { GameDialog } from "./Dialog";
import { Icon } from "./Icons";

const money = (value: number) => Math.round(value).toLocaleString("ru-RU");
const weight = (value: number) => value < 1 ? `${Math.round(value * 1000)} г` : `${value.toFixed(value < 10 ? 2 : 1)} кг`;

/** Содержимое садка доступно и на воде, и поверх портового рынка. */
export function CoolerModal({ engine, onClose }: { engine: Engine; onClose: () => void }) {
  const [pendingRelease, setPendingRelease] = useState<string | null>(null);
  const catches = engine.s.cooler;
  const quote = engine.coolerQuote();
  const total = [...quote.values()].reduce((sum, value) => sum + value, 0);

  return (
    <GameDialog
      label="Текущий улов"
      title="Садок"
      onClose={onClose}
      wide={false}
      right={<span className="num text-[13px] text-[#ece6d8]">{catches.length} / {engine.coolerCap}</span>}
    >
      <div className="min-w-0 p-4 sm:p-6">
        <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-3 border border-[var(--line)] bg-[#0a121c] px-4 py-3">
          <div className="flex min-w-0 items-start gap-3">
            <Icon name="basket" size={20} className="mt-0.5 shrink-0 text-[var(--brass)]" />
            <p className="min-w-0 text-[12px] leading-relaxed muted">Выпуск отдельной рыбы не приносит денег: запись о поимке и кодекс сохраняются, а счётчик выпусков увеличится.</p>
          </div>
          <div className="shrink-0 text-right">
            <div className="label">Оценка улова</div>
            <div className="num text-[15px] text-[var(--brass-2,#e3c996)]">{money(total)} ₽</div>
          </div>
        </div>

        {catches.length === 0 ? (
          <div className="cell py-14 text-center">
            <Icon name="basket" size={34} className="mx-auto text-[var(--line-2)]" />
            <p className="font-serif mt-3 text-[21px] italic muted">Садок пуст</p>
            <p className="mt-1 text-[12px] dim">Сохранённый улов появится здесь.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {catches.map((item) => {
              const fish = FISH_BY_ID[item.fishId];
              const variant = item.variant ? VARIANT_INFO[item.variant] : null;
              const rarity = RARITY_INFO[fish.rarity];
              const forOrder = engine.s.orders.some((order) => order.fishId === item.fishId && item.weight >= order.minWeight);
              const freshness = engine.freshness(item);
              const value = quote.get(item.uid) ?? engine.marketValue(item);
              const confirming = pendingRelease === item.uid;

              return (
                <article key={item.uid} className="cell min-w-0 p-3 sm:p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="plate flex h-12 w-[76px] shrink-0 items-center justify-center sm:w-[88px]">
                      <FishIcon fish={fish} size={84} height={42} variant={item.variant} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="break-words text-[15px] text-[#f1ebdd]">{fish.name}</div>
                      <div className="text-[11px]" style={{ color: variant?.color ?? rarity.color }}>{variant?.name ?? rarity.name}</div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] muted">
                        <span>{weight(item.weight)}</span>
                        <span>{LOC_BY_ID[item.loc]?.name ?? "Акватория"}</span>
                        <span>день {item.day}</span>
                      </div>
                    </div>
                    <div className="num shrink-0 text-right text-[11px] text-[var(--brass-2,#e3c996)]">≈ {money(value)} ₽</div>
                  </div>

                  <div className="mt-2 flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[10.5px]">
                    <span className={freshness < 0.8 ? "text-[var(--color-bad)]" : freshness < 0.95 ? "text-[#d8c090]" : "text-[var(--color-ok)]"}>
                      Свежесть · {Math.round(freshness * 100)}%
                    </span>
                    {forOrder && <span className="text-[#d8c090]">Подходит для заказа</span>}
                  </div>

                  <div className="mt-3 flex min-w-0 flex-wrap items-center justify-end gap-2 border-t border-[var(--line)] pt-3">
                    {confirming ? (
                      <>
                        <span className="mr-auto min-w-0 text-[11px] text-[#d8c090]">Отпустить эту рыбу?</span>
                        <button className="btn btn-sm btn-quiet" onClick={() => setPendingRelease(null)}>Оставить</button>
                        <button className="btn btn-sm btn-solid" onClick={() => { if (engine.releaseCoolerFish(item.uid)) setPendingRelease(null); }}>Подтвердить выпуск</button>
                      </>
                    ) : (
                      <button
                        className="btn btn-sm btn-quiet"
                        aria-label={`Отпустить ${fish.name}, ${weight(item.weight)}`}
                        onClick={() => setPendingRelease(item.uid)}
                      >
                        Отпустить
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </GameDialog>
  );
}
