"use client";

import { Toggle, type Settings } from "./Journal";
import { Modal } from "./Panels";

function Sect({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="label-brass mb-3">{name}</div>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function OptRow({ k, hint, children }: { k: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col items-stretch justify-between gap-3 border-b border-[var(--line)] py-2 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0">
        <div className="text-[13px] text-[#ddd7ca]">{k}</div>
        {hint && <div className="text-[11px] leading-snug dim">{hint}</div>}
      </div>
      <div className="flex w-full shrink-0 items-center justify-end gap-2 sm:w-auto">{children}</div>
    </div>
  );
}

const QN = ["Низкое", "Среднее", "Высокое"];
const CAMS: [string, string][] = [["auto", "Авто"], ["surface", "Поверхность"], ["hook", "За снастью"], ["bottom", "Дно"]];

export function SettingsModal({ settings, setSettings, camMode, onCamMode, onClose }: { settings: Settings; setSettings: (s: Settings) => void; camMode: string; onCamMode: (m: "auto" | "surface" | "hook" | "bottom") => void; onClose: () => void }) {
  const set = (patch: Partial<Settings>) => setSettings({ ...settings, ...patch });
  const setGfx = (patch: Partial<Settings["gfx"]>) => setSettings({ ...settings, gfx: { ...settings.gfx, ...patch } });
  return (
    <Modal label="Игра" title="Настройки" onClose={onClose} wide={false}>
      <div className="flex min-w-0 flex-col gap-7 p-4 sm:p-7">
        <Sect name="Графика">
          <OptRow k="Качество" hint="низкое — без отражений и каустики; высокое — все эффекты">
            <div className="seg flex w-full sm:w-56">
              {QN.map((n, i) => (
                <button key={n} className={`flex-1 ${settings.quality === i ? "on" : ""}`} onClick={() => set({ quality: i })}>{n}</button>
              ))}
            </div>
          </OptRow>
          <OptRow k="Отражения" hint="берег и небо зеркалятся в воде">
            <Toggle on={settings.gfx.refl} onChange={(v) => setGfx({ refl: v })} />
          </OptRow>
          <OptRow k="Световые лучи" hint="солнечные shafts под водой">
            <Toggle on={settings.gfx.shafts} onChange={(v) => setGfx({ shafts: v })} />
          </OptRow>
          <OptRow k="Каустика" hint="блики у поверхности на высокой детализации">
            <Toggle on={settings.gfx.caustics} onChange={(v) => setGfx({ caustics: v })} />
          </OptRow>
          <OptRow k="Пена и брызги" hint="кильватер, бурун, брызги при вываживании">
            <Toggle on={settings.gfx.foam} onChange={(v) => setGfx({ foam: v })} />
          </OptRow>
          <OptRow k="Дождь и снег" hint="осадки в кадре; погода в мире не меняется">
            <Toggle on={settings.gfx.precip} onChange={(v) => setGfx({ precip: v })} />
          </OptRow>
          <OptRow k="3D-модели судов" hint="объёмные корпуса с анимациями вместо рисунков; при смене — короткий переход">
            <Toggle on={settings.model3d} onChange={(v) => set({ model3d: v })} />
          </OptRow>
        </Sect>

        <Sect name="Камера">
          <OptRow k="Режим по умолчанию" hint="авто следит за снастью; переключается клавишей V">
            <div className="seg flex w-full sm:w-56">
              {CAMS.map(([id, n]) => (
                <button key={id} className={`flex-1 ${camMode === id ? "on" : ""}`} onClick={() => onCamMode(id as "auto")}>{n}</button>
              ))}
            </div>
          </OptRow>
          <OptRow k="Приближение" hint="камера подходит к лодке; колесо мыши над водой тоже работает">
            <input
              type="range"
              min={100}
              max={200}
              step={5}
              value={Math.round(settings.zoom * 100)}
              onChange={(e) => set({ zoom: Number(e.target.value) / 100 })}
              className="depth-range w-full max-w-48 sm:w-48"
            />
            <span className="num w-12 text-right text-[13px] text-[#ece6d8]">{Math.round(settings.zoom * 100)}%</span>
          </OptRow>
        </Sect>

        <Sect name="Управление">
          <div className="text-[12px]">
            {[
              ["Заброс, подсечка, подмотка", "ЛКМ / Пробел"],
              ["Противодействие рывку", "A · D / курсор к краю"],
              ["Глубина", "Колесо / W · S"],
              ["Наживка", "1 – 9, 0"],
              ["Камера", "V"],
              ["Кодекс · Журнал · Порт", "C · J · P"],
              ["Звук", "M"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-[var(--line)] py-2"><span className="muted">{k}</span><span className="text-[#ddd7ca]">{v}</span></div>
            ))}
          </div>
        </Sect>

        <Sect name="Звук">
          <OptRow k="Эффекты" hint="волны, снасти, интерфейс [M]">
            <Toggle on={settings.sound} onChange={(v) => set({ sound: v })} />
          </OptRow>
          <OptRow k="Музыка">
            <Toggle on={settings.music} onChange={(v) => set({ music: v })} />
          </OptRow>
          <OptRow k="Громкость">
            <input type="range" min={0} max={100} value={Math.round(settings.volume * 100)} onChange={(e) => set({ volume: Number(e.target.value) / 100 })} className="depth-range w-full max-w-48 sm:w-48" />
            <span className="num w-12 text-right text-[13px] text-[#ece6d8]">{Math.round(settings.volume * 100)}%</span>
          </OptRow>
        </Sect>
      </div>
    </Modal>
  );
}
