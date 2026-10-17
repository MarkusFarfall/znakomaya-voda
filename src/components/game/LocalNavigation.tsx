import type { Engine } from "@/game/engine";
import type { Scene } from "@/game/render/scene";
import { regionAt, waterBedAt, waterRegions } from "@/game/aquatory";
import { HABITAT_CUES, habitatActivityText } from "@/game/exploration";
import { DEFAULT_SETTINGS, type Settings } from "@/game/settings";
import { HoldControl } from "./HoldControl";
import { memo, useEffect, useReducer, type CSSProperties } from "react";

export const LocalNavigationPanel = memo(function LocalNavigationPanel({
  engine: e,
  scene,
  landscape,
  mobile = false,
  controls = DEFAULT_SETTINGS.controls,
}: {
  engine: Engine;
  scene: Scene;
  landscape: boolean;
  mobile?: boolean;
  controls?: Settings["controls"];
}) {
  const [, refresh] = useReducer((value: number) => value + 1, 0);
  useEffect(() => e.subscribeNavigation(refresh), [e]);
  const n = e.navigation,
    W = n.worldWidth,
    manual = mobile && controls.sailing === "arrows";
  const pos = n.nx * 1000,
    target = n.target === null || n.manual ? null : (n.target / W) * 1000;
  const regions = waterRegions(e.s.location);
  const targetDepth = Math.min(e.s.targetDepth, e.maxDepth);
  const castSpot = regionAt(e.s.location, e.castNX() * W).spot;
  const activeHabitatCount = e.candidates(targetDepth).filter(({ fish }) => castSpot.bias.includes(fish.id)).length;
  const cue = HABITAT_CUES[castSpot.feature];
  const readoutTitle = castSpot.name === cue.title ? cue.title : `${castSpot.name} · ${cue.title}`;
  const profile = Array.from(
    { length: 121 },
    (_, i) =>
      `${(i / 120) * 1000},${26 + (waterBedAt(e.s.location, (i / 120) * W) / e.loc.maxDepth) * 32}`,
  ).join(" ");
  const state =
    n.state === "turning"
      ? "Разворачиваемся"
      : n.state === "braking"
        ? "Тормозим"
        : n.manual
          ? n.manual < 0
            ? "Идём влево"
            : "Идём вправо"
          : n.moving
            ? "Идём к точке"
            : "Лодка остановлена";
  const arrow = (dir: -1 | 1) =>
    manual ? (
      <HoldControl
        label={dir < 0 ? "Двигаться влево" : "Двигаться вправо"}
        className="local-navigation__edge water-hold"
        disabled={e.paused}
        onPress={() => e.steerNavigation(dir)}
        onRelease={() => {
          if (n.manual === dir) e.steerNavigation(0);
        }}
      >
        {dir < 0 ? "←" : "→"}
      </HoldControl>
    ) : (
      <button
        className="local-navigation__edge"
        onClick={() => e.navigateTo(dir < 0 ? n.left : n.right)}
        aria-label={
          dir < 0 ? "Плыть к левой границе" : "Плыть к правой границе"
        }
      >
        {dir < 0 ? "←" : "→"}
      </button>
    );
  return (
    <section
      aria-label="Перемещение по акватории"
      className={`zv-ui local-navigation ${landscape ? "local-navigation--land" : ""} ${manual ? "local-navigation--manual" : ""}`}
      style={
        {
          "--control-size": `${56 * controls.size}px`,
          opacity: mobile ? controls.opacity : 1,
        } as CSSProperties
      }
      onPointerDown={(ev) => ev.stopPropagation()}
    >
      <div className="local-navigation__head">
        <div className="local-navigation__heading">
          <span className="local-navigation__eyebrow">
            {e.loc.name} · {e.spot.name}
          </span>
          <strong role="status">{state}</strong>
        </div>
        <div className="local-navigation__actions">
          <button
            className="btn btn-quiet"
            onClick={() => e.stopNavigation()}
            disabled={!n.moving}
          >
            Стоп
          </button>
          <button
            className="btn btn-solid"
            onClick={() => e.requestFishingMode()}
            disabled={e.returningToFishing}
            title={
              n.moving
                ? "Лодка плавно затормозит и вернётся к рыбалке; заброс не начнётся сам"
                : "Вернуться к рыбалке; заброс выполняется вручную"
            }
          >
            {e.returningToFishing ? "Тормозим…" : "Рыбачить"}
          </button>
        </div>
      </div>
      <div className="local-navigation__readout" aria-live="polite">
        <span className="local-navigation__readout-mark" aria-hidden="true">{cue.mark}</span>
        <div>
          <strong>{readoutTitle}</strong>
          <span>{cue.hint} · {habitatActivityText(activeHabitatCount, targetDepth)}</span>
        </div>
        <span className="local-navigation__readout-count" aria-label={`${activeHabitatCount} активных видов`}>{activeHabitatCount}</span>
      </div>
      <div className="local-navigation__chartrow">
        {arrow(-1)}
        <div className="local-navigation__chart">
          <svg
            viewBox="0 0 1000 64"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d="M0 20H1000" stroke="#99c7bc" strokeOpacity=".25" />
            <polygon
              points={`0,64 ${profile} 1000,64`}
              fill="#728e80"
              fillOpacity=".22"
            />
            <polyline
              points={profile}
              fill="none"
              stroke="#9aae97"
              strokeOpacity=".6"
            />
            <rect
              x={(scene.cameraX / W) * 1000}
              y="2"
              width={(scene.viewWidth / W) * 1000}
              height="59"
              rx="4"
              fill="#d6d5ad"
              fillOpacity=".05"
              stroke="#d6d5ad"
              strokeOpacity=".28"
            />
            {regions.slice(1).map((r, i) => (
              <path
                key={r.id}
                d={`M${((i + 1) / regions.length) * 1000} 7V60`}
                stroke="#c7b994"
                strokeDasharray="3 5"
                strokeOpacity=".45"
              />
            ))}
            {target !== null && (
              <>
                <path
                  d={`M${pos} 19H${target}`}
                  stroke="#dfc68f"
                  strokeDasharray="5 6"
                />
                <path d={`M${target} 7V31`} stroke="#f1d69d" strokeWidth="2" />
              </>
            )}
            <path
              d={`M${pos - 12} 17H${pos + 12}L${pos + 7} 25H${pos - 7}Z`}
              fill="#f7e2b5"
            />
          </svg>
          {!manual && (
            <input
              type="range"
              min="0"
              max="1000"
              step="2"
              value={Math.round(target ?? pos)}
              aria-label="Точка назначения в акватории"
              onChange={(ev) => e.navigateTo(Number(ev.target.value) / 1000)}
            />
          )}
        </div>
        {arrow(1)}
      </div>
      <div
        className="local-navigation__regions"
        aria-label="Ориентиры акватории"
      >
        {regions.map((r) => (
          <span
            key={r.id}
            className={e.spot.id === r.id ? "is-current" : ""}
            title={r.desc}
          >
            {r.name}
          </span>
        ))}
      </div>
      <div className="local-navigation__hint">
        <span>
          {e.returningToFishing
            ? "Тормозим — после остановки откроется рыбалка"
            : manual
              ? n.moving
                ? "Стрелки — ход · «Рыбачить» плавно тормозит"
                : "Держите стрелку для хода · отпустите для остановки"
              : n.moving
                ? "«Рыбачить» плавно остановит лодку; заброс — вручную"
                : "Нажмите на воду или выберите точку на карте"}
        </span>
        <span>{Math.round(((n.nx - n.left) / (n.right - n.left)) * 100)}%</span>
      </div>
    </section>
  );
});
