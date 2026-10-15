"use client";

import { useId, useState } from "react";
import { Toggle, type Settings } from "./Journal";
import { Icon } from "./Icons";
import { Modal } from "./Panels";

function Sect({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <section className="settings-section">
      <div className="label-brass mb-3">{name}</div>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function OptRow({
  k,
  hint,
  children,
}: {
  k: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <div className="settings-row" role="group" aria-labelledby={id}>
      <div className="settings-copy">
        <div id={id} className="text-[13px] text-[#ddd7ca]">
          {k}
        </div>
        {hint && <div className="text-[11px] leading-snug dim">{hint}</div>}
      </div>
      <div className="settings-controls">{children}</div>
    </div>
  );
}

const QN = ["Низкое", "Среднее", "Высокое"];
const CAMS = [
  ["auto", "Авто"],
  ["surface", "Поверхность"],
  ["hook", "За снастью"],
  ["bottom", "Дно"],
] as const;

export function SettingsModal({
  settings,
  setSettings,
  camMode,
  onCamMode,
  onClose,
}: {
  settings: Settings;
  setSettings: (s: Settings) => void;
  camMode: string;
  onCamMode: (m: "auto" | "surface" | "hook" | "bottom") => void;
  onClose: () => void;
}) {
  const [section, setSection] = useState("graphics");
  const set = (patch: Partial<Settings>) =>
    setSettings({ ...settings, ...patch });
  const setGfx = (patch: Partial<Settings["gfx"]>) =>
    setSettings({ ...settings, gfx: { ...settings.gfx, ...patch } });
  return (
    <Modal label="Игра" title="Настройки" onClose={onClose} wide={false}>
      <div className="settings-workbench">
        <div className="settings-intro">
          <Icon name="gear" size={24} />
          <div>
            <strong>Ваша игра, ваш ритм</strong>
            <p>Изменения применяются сразу. Прогресс не затрагивается.</p>
          </div>
        </div>
        <div className="settings-nav" role="group" aria-label="Раздел настроек">
          {[
            ["graphics", "sun", "Графика"],
            ["camera", "target", "Камера"],
            ["sound", "speaker", "Звук"],
            ["controls", "anchor", "Управление"],
          ].map(([id, icon, label]) => (
            <button
              key={id}
              aria-pressed={section === id}
              onClick={() => setSection(id)}
            >
              <Icon name={icon} size={18} />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <div className="settings-page" key={section}>
          {section === "graphics" && (
            <>
              <Sect name="Графика">
                <OptRow
                  k="Качество"
                  hint="низкое — без отражений и каустики; высокое — все эффекты"
                >
                  <div className="seg flex w-full sm:w-56">
                    {QN.map((n, i) => (
                      <button
                        key={n}
                        aria-pressed={settings.quality === i}
                        className={`flex-1 ${settings.quality === i ? "on" : ""}`}
                        onClick={() => set({ quality: i })}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </OptRow>
                <OptRow
                  k="Отражения"
                  hint={
                    settings.quality === 0
                      ? "Сохранено, но не отображается на низком качестве"
                      : "Берег и небо отражаются в воде"
                  }
                >
                  <Toggle
                    label="Отражения"
                    on={settings.gfx.refl}
                    onChange={(v) => setGfx({ refl: v })}
                  />
                </OptRow>
                <OptRow
                  k="Световые лучи"
                  hint={
                    settings.quality === 0
                      ? "Для лучей нужно среднее или высокое качество"
                      : "Солнечный свет под водой во время рыбалки"
                  }
                >
                  <Toggle
                    label="Световые лучи"
                    on={settings.gfx.shafts}
                    onChange={(v) => setGfx({ shafts: v })}
                  />
                </OptRow>
                <OptRow
                  k="Каустика"
                  hint={
                    settings.quality < 2
                      ? "Для каустики выберите высокое качество"
                      : "Подводные световые узоры во время рыбалки"
                  }
                >
                  <Toggle
                    label="Каустика"
                    on={settings.gfx.caustics}
                    onChange={(v) => setGfx({ caustics: v })}
                  />
                </OptRow>
                <OptRow
                  k="Пена и брызги"
                  hint="Кильватер и брызги во время рыбалки"
                >
                  <Toggle
                    label="Пена и брызги"
                    on={settings.gfx.foam}
                    onChange={(v) => setGfx({ foam: v })}
                  />
                </OptRow>
                <OptRow
                  k="Дождь и снег"
                  hint="осадки в кадре; погода в мире не меняется"
                >
                  <Toggle
                    label="Дождь и снег"
                    on={settings.gfx.precip}
                    onChange={(v) => setGfx({ precip: v })}
                  />
                </OptRow>
                <OptRow
                  k="3D-модели судов"
                  hint="объёмные корпуса с анимациями вместо рисунков; при смене — короткий переход"
                >
                  <Toggle
                    label="3D-модели судов"
                    on={settings.model3d}
                    onChange={(v) => set({ model3d: v })}
                  />
                </OptRow>
              </Sect>
            </>
          )}
          {section === "camera" && (
            <Sect name="Камера на рыбалке">
              <OptRow
                k="Режим камеры"
                hint="Авто следует за снастью. Дно — обзор рельефа с адаптацией экспозиции. Клавиша V меняет режим."
              >
                <div className="seg flex w-full sm:w-56">
                  {CAMS.map(([id, n]) => (
                    <button
                      key={id}
                      aria-pressed={camMode === id}
                      className={`flex-1 ${camMode === id ? "on" : ""}`}
                      onClick={() => onCamMode(id)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </OptRow>
              <OptRow
                k="Приближение"
                hint="камера подходит к лодке; Shift + колесо мыши над водой"
              >
                <input
                  type="range"
                  aria-label="Приближение"
                  min={100}
                  max={200}
                  step={5}
                  value={Math.round(settings.zoom * 100)}
                  onChange={(e) => set({ zoom: Number(e.target.value) / 100 })}
                  className="depth-range w-full max-w-48 sm:w-48"
                />
                <span className="num w-12 text-right text-[13px] text-[#ece6d8]">
                  {Math.round(settings.zoom * 100)}%
                </span>
              </OptRow>
            </Sect>
          )}
          {section === "controls" && (
            <Sect name="Управление">
              <p className="settings-note">
                На телефоне: удерживайте кнопку снасти для подмотки, меняйте
                глубину ползунком, гасите рывки боковыми кнопками.
              </p>
              <div className="settings-shortcuts text-[12px]">
                {[
                  ["Заброс, подсечка, подмотка", "ЛКМ / Пробел"],
                  ["Перемещение ↔ рыбалка", "N"],
                  ["Остановка на ходу", "Пробел / Esc"],
                  ["Противодействие рывку", "A · D / курсор к краю"],
                  ["Глубина", "Колесо / W · S"],
                  ["Приближение", "Shift + колесо"],
                  ["Наживка", "1 – 9, 0"],
                  ["Камера", "V"],
                  ["Кодекс · Журнал · Порт", "C · J · P"],
                  ["Звук", "M"],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="flex justify-between border-b border-[var(--line)] py-2"
                  >
                    <span className="muted">{k}</span>
                    <span className="text-[#ddd7ca]">{v}</span>
                  </div>
                ))}
              </div>
            </Sect>
          )}
          {section === "sound" && (
            <Sect name="Звук">
              <OptRow
                k="Звук в игре"
                hint="Общий выключатель: эффекты и музыка · клавиша M"
              >
                <Toggle
                  label="Звук в игре"
                  on={settings.sound}
                  onChange={(v) => set({ sound: v })}
                />
              </OptRow>
              <OptRow
                k="Музыка"
                hint={
                  settings.sound
                    ? "Фоновое музыкальное сопровождение"
                    : "Сохранится и зазвучит, когда включите звук в игре"
                }
              >
                <Toggle
                  label="Музыка"
                  on={settings.music}
                  onChange={(v) => set({ music: v })}
                />
              </OptRow>
              <OptRow
                k="Громкость"
                hint={
                  settings.sound
                    ? "Общий уровень эффектов и музыки"
                    : "Звук выключен. Уровень запомнится на будущее"
                }
              >
                <input
                  type="range"
                  aria-label="Громкость"
                  min={0}
                  max={100}
                  value={Math.round(settings.volume * 100)}
                  onChange={(e) =>
                    set({ volume: Number(e.target.value) / 100 })
                  }
                  className="depth-range w-full max-w-48 sm:w-48"
                />
                <span className="num w-12 text-right text-[13px] text-[#ece6d8]">
                  {Math.round(settings.volume * 100)}%
                </span>
              </OptRow>
            </Sect>
          )}
        </div>
        <div className="settings-footer">
          <span>Локальные настройки устройства</span>
          <button onClick={onClose}>
            Готово <span aria-hidden="true">✓</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
