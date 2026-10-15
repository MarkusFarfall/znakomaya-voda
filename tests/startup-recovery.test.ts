import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { Engine, newSave } from '../src/game/engine';
import { fetchMe, loadLocal, loadRemote, readSavedProgress } from '../src/game/persist';
import { LOCATIONS } from '../src/game/world';

const worker = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
function sw(cached?: Response, network: Response | Error = new Error('offline')) {
  const handlers: Record<string, (event: { waitUntil(p: Promise<unknown>): void }) => void> = {};
  const deleted: string[] = [], written: string[] = [];
  const cache = { match: async () => cached, put: async (r: Request) => { written.push(r.url); } };
  const context = vm.createContext({ URL, Response, fetch: async () => { if (network instanceof Error) throw network; return network; }, caches: { open: async () => cache, keys: async () => ['zv-zv-v1', 'zv-assets-v2', 'other-app'], delete: async (k: string) => { deleted.push(k); } }, self: { location: { origin: 'https://game.test' }, clients: { claim: async () => {} }, addEventListener: (key: string, f: typeof handlers[string]) => { handlers[key] = f; } } });
  vm.runInContext(worker, context);
  return { run: vm.runInContext('handle', context) as (r: Request) => Promise<Response>, handlers, deleted, written };
}
test('offline JS/CSS requests never receive an HTML offline page', async () => {
  for (const file of ['game.js', 'game.css']) {
    const w = sw(new Response('<html>old poisoned cache</html>', { headers: { 'content-type': 'text/html' } }));
    const res = await w.run(new Request('https://game.test/_next/static/' + file));
    assert.equal(res.status, 503); assert.match(res.headers.get('content-type')!, /text\/plain/);
    assert.equal(w.written.length, 0);
  }
});
test('immutable JavaScript is cached, but a server HTML fallback is rejected', async () => {
  const req = new Request('https://game.test/_next/static/game.js');
  const good = sw(undefined, new Response('window.ok=true', { headers: { 'content-type': 'application/javascript' } }));
  assert.equal((await good.run(req)).status, 200); assert.equal(good.written.length, 1);
  const bad = sw(undefined, new Response('<html>error</html>', { headers: { 'content-type': 'text/html' } }));
  assert.equal((await bad.run(req)).status, 503); assert.equal(bad.written.length, 0);
});
test('worker activation only deletes game-owned obsolete caches', async () => {
  const w = sw(); let pending: Promise<unknown> | undefined;
  w.handlers.activate({ waitUntil(p) { pending = p; } }); await pending;
  assert.deepEqual(w.deleted, ['zv-zv-v1']);
});
test('cloud API and RSC requests never use an offline document', async () => {
  const w = sw(new Response('<html>offline</html>'));
  await assert.rejects(w.run(new Request('https://game.test/api/save')));
  await assert.rejects(w.run(new Request('https://game.test/?_rsc=123')));
});
test('unreadable local progress fails closed and stays byte-identical', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  try {
    for (const raw of ['{broken', 'null', '[]', '{}', '{"name":"Рыбак","minutes":null}']) {
      const values = new Map([['zv_save:review', raw]]);
      Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => values.get(key) ?? null } });
      assert.throws(() => loadLocal('review'), /локальное сохранение/);
      assert.equal(values.get('zv_save:review'), raw);
    }
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
test('invalid cloud response cannot masquerade as a missing save', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ save: {} }), { headers: { 'content-type': 'application/json' } }));
  await assert.rejects(loadRemote('review'), /неполное/);
});
test('stuck authentication request times out to offline instead of an endless boot', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  t.mock.method(globalThis, 'fetch', (_url: unknown, init?: RequestInit) => new Promise<Response>((_resolve, reject) => { init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))); }));
  const result = fetchMe(); t.mock.timers.tick(12_001);
  assert.ok('offline' in await result);
});
test('actual travel to every aquatory survives a save/load without resetting progress', () => {
  const e = new Engine(newSave('Регрессия переходов'));
  e.s.boat = 8; e.s.boatsOwned = [0, 8]; e.s.money = 1_000_000;
  e.s.unlocked = LOCATIONS.map(l => l.id); e.s.codex = { goby: { count: 7, maxWeight: .4, firstDay: 1, variants: [] } };
  for (const loc of LOCATIONS.filter(l => l.id !== 'bay')) {
    e.s.atPort = false;
    assert.equal(e.travel({ kind: 'loc', loc: loc.id }, 'motor'), true, loc.id);
    const source = JSON.stringify(e.s), loaded = readSavedProgress(JSON.parse(source)), restored = new Engine(loaded);
    assert.equal(restored.loc.id, loc.id); assert.equal(restored.s.name, e.s.name);
    assert.equal(restored.s.money, e.s.money); assert.deepEqual(restored.s.boatsOwned, [0, 8]);
    assert.equal(restored.s.codex.goby.count, 7); assert.equal(restored.navigation.velocity, 0);
    assert.ok(Number.isFinite(restored.navigation.x)); assert.ok(Number.isFinite(restored.bedAt(restored.navigation.nx)));
  }
});
