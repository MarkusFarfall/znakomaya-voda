"use client";

import type { Engine } from "@/game/engine";
import { SONAR_MODE_LABEL } from "@/game/sonar";
import { Icon } from "./Icons";

/** Кнопки питания и режима эхолота; сам прибор остаётся в сохранении при выключении. */
export function SonarControls({ engine: e, compact = false }: { engine: Engine; compact?: boolean }) {
  if (e.s.sonar <= 0) return null;
  const enabled = e.s.sonarEnabled;
  const roman = ["", "I", "II", "III"][e.s.sonar];
  return (
    <div className={`flex justify-end gap-1.5 ${compact ? "sonar-controls sonar-controls--compact" : "sonar-controls"}`} aria-label="Управление эхолотом">
      <button
        type="button"
        className={`iconbtn ${enabled ? "!border-[rgba(143,203,208,0.42)] !text-[#a8dfe2]" : "opacity-70"}`}
        aria-label={enabled ? `Выключить эхолот ${roman} [B]` : `Включить эхолот ${roman} [B]`}
        aria-pressed={enabled}
        title={enabled ? "Эхолот включён · выключить [B]" : "Эхолот выключен · включить [B]"}
        onClick={() => e.toggleSonar()}
      >
        <Icon name="sonar" size={16} />
        {!compact && <span className="normal-case tracking-normal">Эхолот {roman} · {enabled ? "вкл" : "выкл"}</span>}
      </button>
      {enabled && (
        <button
          type="button"
          className="iconbtn"
          aria-label={`Режим эхолота: ${SONAR_MODE_LABEL[e.s.sonarMode]}. Сменить [Shift+B]`}
          title="Сменить режим [Shift+B]"
          onClick={() => e.cycleSonarMode()}
        >
          <span className="normal-case tracking-normal">{compact ? SONAR_MODE_LABEL[e.s.sonarMode] : `Режим: ${SONAR_MODE_LABEL[e.s.sonarMode]}`}</span>
        </button>
      )}
    </div>
  );
}
