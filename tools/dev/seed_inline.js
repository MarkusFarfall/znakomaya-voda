// Офлайн-сид для Playwright: приложение уходит в офлайн-старт, если /api/auth/me
// отвечает 503 (это делают все прогоны через page.route). Здесь кладём в
// localStorage «последний аккаунт» и локальное сохранение, чтобы кнопка
// «ПРОДОЛЖИТЬ» вела в игру без БД.
(() => {
  const pid = "devtools-0001-0001";
  const user = {"id": "u-dev-1", "username": "Рыбак", "createdAt": "2026-01-01T00:00:00.000Z"};
  const save = {"version": 3, "name": "Рыбак", "money": 60, "minutes": 320, "location": "bay", "spot": "bay_pier", "boat": 0, "boatsOwned": [0], "market": {"day": 1, "sold": {}}, "port": "home", "portsKnown": ["home"], "unlocked": ["bay"], "daily": {"date": "", "tasks": [], "streak": 0, "lastComplete": "", "bonusClaimed": false, "rerolls": 1, "recentTpls": []}, "lastRest": -99999, "sonar": 0, "rod": 0, "reel": 0, "line": 0, "hook": 0, "mods": {}, "baits": {"shrimp": 5}, "currentBait": "worm", "targetDepth": 5, "weather": "fog", "weatherQueued": "clear", "weatherNext": 470, "wind": 0.2, "codex": {}, "cooler": [], "hints": [], "events": [], "nextEventAt": 1020, "milestones": [], "orders": [], "ordersDone": 0, "flags": ["visit_bay"], "xp": 0, "perks": {}, "achievements": [], "quest": 0, "finds": {}, "stats": {"totalCaught": 0, "totalEarned": 0, "linesSnapped": 0, "escaped": 0, "playSeconds": 0, "biggest": null, "perfectHooks": 0, "nightCatches": 0, "stormCatches": 0, "releases": 0, "jumps": 0, "maxDepthCaught": 0}, "atPort": false};
  try {
    localStorage.setItem('zv_last_account:v1', JSON.stringify({ playerId: pid, user }));
    localStorage.setItem('zv_save:' + pid, JSON.stringify(save));
  } catch (e) { /* квота */ }
})();
