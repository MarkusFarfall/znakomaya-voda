import { depthToU, uToDepth, type Engine } from "@/game/engine";
import { BAITS } from "@/game/world";
import type { Settings } from "@/game/settings";
import type { CSSProperties } from "react";
import { HoldControl } from "./HoldControl";
import { BaitIcon } from "./Icons";

export function MobileFishing({
  engine: e,
  controls,
  landscape,
}: {
  engine: Engine;
  controls: Settings["controls"];
  landscape: boolean;
}) {
  const phase = e.phase,
    fight = phase === "fight",
    disabled = e.paused || phase === "casting" || phase === "caught";
  const label =
    phase === "idle"
      ? "Заброс"
      : phase === "charging"
        ? "Отпустить"
        : phase === "bite"
          ? "Подсечь!"
          : fight
            ? "Подмотка"
            : phase === "casting"
              ? "Заброс…"
              : e.nibbling
                ? "Пробует…"
                : "Смотать";
  const hint =
    phase === "idle"
      ? "Удерживайте и отпустите"
      : phase === "charging"
        ? "Отпустите на нужной силе"
        : fight
          ? "Отпустите, чтобы стравить"
          : phase === "bite"
            ? "Нажмите сейчас"
            : e.nibbling
              ? "Дождитесь поклёвки"
              : "Снасть в воде";
  const max = e.maxDepth,
    depth = Math.min(max, e.s.targetDepth);
  return (
    <section
      aria-label="Мобильная рыбалка"
      className={`mobile-fishing zv-ui ${landscape ? "mobile-fishing--land" : ""} ${controls.hand === "left" ? "mobile-fishing--left" : ""}`}
      style={
        {
          "--control-size": `${56 * controls.size}px`,
          opacity: controls.opacity,
        } as CSSProperties
      }
      onPointerDown={(ev) => ev.stopPropagation()}
    >
      <div className="mobile-fishing__status">
        <strong>
          {phase === "waiting"
            ? "Ожидаем поклёвку"
            : phase === "sinking"
              ? "Снасть опускается"
              : label}
        </strong>
        <span>{hint}</span>
      </div>
      <div className="mobile-fishing__depth">
        <span>Глубина</span>
        <input
          className="depth-range"
          aria-label="Глубина ловли"
          type="range"
          min="0"
          max="1000"
          disabled={!["idle", "charging"].includes(phase)}
          value={Math.round((depthToU(depth) / depthToU(max)) * 1000)}
          onChange={(ev) =>
            e.setDepth(
              uToDepth((Number(ev.target.value) / 1000) * depthToU(max)),
            )
          }
        />
        <b>{depth} м</b>
      </div>
      <div className="mobile-fishing__actions">
        <div className="mobile-fishing__secondary">
          {fight ? (
            <div className="mobile-fishing__rudder">
              {([-1, 1] as const).map((dir) => (
                <HoldControl
                  key={dir}
                  label={dir < 0 ? "Удилище влево" : "Удилище вправо"}
                  className="water-hold"
                  disabled={e.paused}
                  onPress={() => {
                    e.keyDir = dir;
                    e.pullDir = dir;
                    e.emit();
                  }}
                  onRelease={() => {
                    if (e.keyDir === dir) {
                      e.keyDir = 0;
                      e.pullDir = 0;
                    }
                    e.emit();
                  }}
                >
                  {dir < 0 ? "←" : "→"}
                </HoldControl>
              ))}
            </div>
          ) : (
            <div className="mobile-fishing__baits">
              {BAITS.filter(
                (b) =>
                  b.id === "worm" ||
                  (e.s.baits[b.id] ?? 0) > 0 ||
                  e.s.currentBait === b.id,
              ).map((b) => {
                const count = b.id === "worm" ? "∞" : (e.s.baits[b.id] ?? 0).toLocaleString("ru-RU");
                const countLabel = b.id === "worm" ? "безлимитный запас" : `осталось ${e.s.baits[b.id] ?? 0}`;
                return (
                  <button
                    key={b.id}
                    className="mobile-fishing__bait"
                    aria-label={`Наживка: ${b.name}, ${countLabel}`}
                    aria-pressed={e.s.currentBait === b.id}
                    title={`${b.name} · ${b.id === "worm" ? "безлимит" : `×${e.s.baits[b.id] ?? 0}`}`}
                    disabled={b.id !== "worm" && !(e.s.baits[b.id] ?? 0)}
                    onClick={() => e.setBait(b.id)}
                  >
                    <BaitIcon id={b.id} size={20} />
                    <span className="mobile-fishing__bait-count" aria-hidden="true">{count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <HoldControl
          label={label}
          className={`mobile-fishing__primary ${phase === "bite" ? "mobile-fishing__primary--bite" : ""}`}
          disabled={disabled}
          onPress={() => {
            e.pointerDown();
            e.emit();
          }}
          onRelease={(cancelled) => {
            if (cancelled) e.cancelInput();
            else e.pointerUp();
            e.emit();
          }}
        >
          <span>{label}</span>
          <small>
            {phase === "charging"
              ? "выберите силу"
              : fight
                ? "удерживайте"
                : phase === "idle"
                  ? "держите → отпустите"
                  : "нажмите"}
          </small>
        </HoldControl>
      </div>
    </section>
  );
}
