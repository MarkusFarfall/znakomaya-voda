# Инструменты прогонов (Playwright)

Всё это крутится поверх `npm run dev` на `http://localhost:3000`. После перезагрузки
воркспейса зависимости и браузер не переживают снапшот — восстановление:

```bash
cd /home/user/repo   && npm ci --no-audit --no-fund
cd /home/user/tools  && npm i playwright-core@1.56.1 --no-audit --no-fund
cd /home/user/tools  && npx playwright-core install --with-deps chromium-headless-shell
```

Браузер ставится в `~/.cache/ms-playwright/chromium_headless_shell-1194` — этот путь
прописан в скриптах. Скриншоты пишутся в `/home/user/audit-final/`.

## seed_inline.js

Прогоны перехватывают `**/api/auth/me` и отвечают 503, поэтому игра стартует в
офлайн-режиме. Чтобы кнопка «ПРОДОЛЖИТЬ» вела в игру без БД, перед загрузкой
страницы в `localStorage` кладутся «последний аккаунт» и локальное сохранение
(`localStorage.addInitScript({ path: '.../seed_inline.js' })`).

Файл — копия `/home/user/tools/seed_inline.js`; сохранение внутри — снимок
`/home/user/save.json` (стартовый прогресс).

## Скрипты

| Скрипт | Что делает |
|---|---|
| `scene.mjs W H минут погода x имя` | кадр сцены в заданной точке акватории |
| `repro.mjs W H тег "setup"` | кадр с произвольной настройкой (`boat()`, `loc()`, `time()`, `weather()`, `ev()`) |
| `tour2.mjs` | обход 12 акваторий × день/ночь: `pageerror`, `frameFails`, `regions` |
| `measure.mjs w= h= x= repeat=` | счётчики операций на кадр из `window.__cvstats` |
| `evcheck.mjs id id …` | форс-триггер событий и скриншоты |
| `trshot.mjs` | контейнеровоз в полной силе (`trader`) |
| `port.mjs тег` | портовая сцена |

## instr.js

Патч прототипа `CanvasRenderingContext2D` со счётчиками (`beginPath`, `lineTo`,
`fillRect`, `drawImage`, …) — подключается через `addInitScript`, результат
читается из `window.__cvstats`. Нужен `measure.mjs`.
