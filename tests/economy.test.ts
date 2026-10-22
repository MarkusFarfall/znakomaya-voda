import assert from "node:assert/strict";
import test from "node:test";
import { Engine, migrateSave, newSave } from "../src/game/engine";
import type { CaughtFish, Order } from "../src/game/types";

const catchOf = (uid: string, weight: number, value: number): CaughtFish => ({
  uid,
  fishId: "goby",
  weight,
  variant: null,
  value,
  day: 1,
  loc: "bay",
  at: 300,
});

test("single fish sale follows the same saturated market quote as the cooler", () => {
  const engine = new Engine(newSave());
  engine.s.atPort = true;
  engine.s.cooler = [catchOf("small", 0.1, 100), catchOf("large", 0.4, 200)];

  const quote = engine.coolerQuote();
  const smallQuote = quote.get("small");
  assert.ok(smallQuote !== undefined);
  assert.ok((quote.get("large") ?? 0) > smallQuote);

  engine.sellOne("small");

  assert.equal(engine.s.money, 60 + smallQuote);
  assert.deepEqual(engine.s.cooler.map((c) => c.uid), ["large"]);
});

test("market saturation survives a same-day trip away and back to the port", () => {
  const engine = new Engine(newSave());
  engine.s.atPort = true;
  const first = catchOf("first", 0.2, 120);
  engine.s.cooler = [first];
  const fullPrice = engine.coolerQuote().get(first.uid)!;
  engine.sellOne(first.uid);

  engine.s.port = "nordhavn";
  engine.s.cooler = [];
  // Вернувшись в родной порт в тот же игровой день, игрок получает его
  // сохранённый счётчик насыщения, а не новый «пустой» рынок.
  engine.s.port = "home";
  const second = catchOf("second", 0.2, 120);
  engine.s.cooler = [second];
  const reducedPrice = engine.coolerQuote().get(second.uid)!;

  assert.ok(reducedPrice < fullPrice);
});

test("a ready order beats separately selling its fish, even on a saturated market", () => {
  const engine = new Engine(newSave());
  engine.s.atPort = true;
  engine.s.market = { day: engine.day * 10, sold: { goby: 100 } };
  engine.s.cooler = [catchOf("small", 0.2, 100), catchOf("large", 0.4, 200)];
  const order: Order = { id: "contract", fishId: "goby", count: 2, minWeight: 0, reward: 50, expiresDay: 3, client: "Трактир" };
  engine.s.orders = [order];

  const separateSale = [...engine.coolerQuote().values()].reduce((sum, value) => sum + value, 0);
  const payout = engine.orderReward(order);
  assert.ok(payout >= separateSale + 20);

  assert.equal(engine.fulfillOrder(order.id), true);
  assert.equal(engine.s.money, 60 + payout);
  assert.equal(engine.s.stats.totalEarned, payout);
  assert.equal(engine.s.cooler.length, 0);
});

test("bottle discoveries remain in migrated saves", () => {
  const save = newSave();
  save.hints = ["goby"];

  assert.deepEqual(migrateSave(save)?.hints, ["goby"]);
});

test("legacy order without count/minWeight still counts fish in the cooler", () => {
  // Старые сохранения хранили заказы без count и minWeight. Сравнение
  // «вес >= undefined» всегда ложно, поэтому сданная рыба не засчитывалась.
  const save = newSave();
  save.orders = [{ id: "legacy", fishId: "goby", reward: 120, expiresDay: 9, client: "Трактир" } as unknown as Order];
  const migrated = migrateSave(JSON.parse(JSON.stringify(save)));
  assert.ok(migrated);
  const engine = new Engine(migrated);
  engine.s.atPort = true;
  engine.s.cooler = [catchOf("a", 0.2, 100), catchOf("b", 0.35, 160)];

  const order = engine.s.orders[0];
  assert.equal(engine.orderCount(order), 1);
  assert.equal(order.minWeight, 0);
  // В заказе нужна одна рыба, поэтому и к сдаче предлагается одна.
  assert.equal(engine.orderMatches(order).length, 1);
  assert.equal(engine.orderReady(order), true);
  assert.equal(engine.fulfillOrder(order.id), true);
  assert.equal(engine.s.cooler.length, 1);
});

test("order weight floor ignores nothing when minWeight is missing", () => {
  const engine = new Engine(newSave());
  engine.s.atPort = true;
  engine.s.cooler = [catchOf("a", 0.2, 100)];
  const order = { id: "x", fishId: "goby", count: 1, reward: 80, expiresDay: 5, client: "Бар" } as Order;
  engine.s.orders = [order];
  assert.equal(engine.orderMatches(order).length, 1);
  assert.equal(engine.fulfillOrder(order.id), true);
});

test("bundle order needs every line and consumes exactly those fish", () => {
  const engine = new Engine(newSave());
  engine.s.atPort = true;
  engine.s.cooler = [
    catchOf("g1", 0.2, 100),
    catchOf("g2", 0.25, 120),
    { ...catchOf("p1", 0.3, 140), fishId: "perch" },
  ];
  const order: Order = {
    id: "set",
    fishId: "goby",
    count: 2,
    minWeight: 0,
    reward: 400,
    expiresDay: 5,
    client: "Шеф",
    kind: "bundle",
    lines: [
      { fishId: "goby", count: 2, minWeight: 0 },
      { fishId: "perch", count: 2, minWeight: 0 },
    ],
  };
  engine.s.orders = [order];

  // Половина набора — ещё не заказ: сдача недоступна, оплата базовая.
  const progress = engine.orderProgress(order);
  assert.deepEqual(progress.map((p) => `${p.have}/${p.need}`), ["2/2", "1/2"]);
  assert.equal(engine.orderReady(order), false);
  assert.equal(engine.orderReward(order), 400);
  assert.equal(engine.fulfillOrder(order.id), false);
  assert.equal(engine.s.cooler.length, 3);

  engine.s.cooler.push({ ...catchOf("p2", 0.35, 160), fishId: "perch" });
  assert.equal(engine.orderReady(order), true);
  assert.equal(engine.fulfillOrder(order.id), true);
  assert.equal(engine.s.cooler.length, 0);
  // Сданный заказ исчезает, а витрина тут же получает замену.
  assert.ok(!engine.s.orders.some((o) => o.id === "set"));
  assert.equal(engine.s.orders.length, engine.orderSlots);
});

test("bundles do not reuse the same fish for two identical lines", () => {
  const engine = new Engine(newSave());
  engine.s.cooler = [catchOf("only", 0.3, 100)];
  const order: Order = {
    id: "dup",
    fishId: "goby",
    count: 1,
    minWeight: 0,
    reward: 200,
    expiresDay: 5,
    client: "Бар",
    kind: "bundle",
    lines: [
      { fishId: "goby", count: 1, minWeight: 0 },
      { fishId: "goby", count: 1, minWeight: 0 },
    ],
  };
  engine.s.orders = [order];
  assert.deepEqual(engine.orderProgress(order).map((p) => p.have), [1, 0]);
  assert.equal(engine.orderReady(order), false);
});

test("trophy order respects the weight floor", () => {
  const engine = new Engine(newSave());
  engine.s.atPort = true;
  engine.s.cooler = [catchOf("light", 0.2, 90), catchOf("heavy", 0.9, 300)];
  const order: Order = {
    id: "trophy",
    fishId: "goby",
    count: 1,
    minWeight: 0.7,
    reward: 600,
    expiresDay: 4,
    client: "Клуб",
    kind: "trophy",
    lines: [{ fishId: "goby", count: 1, minWeight: 0.7 }],
  };
  engine.s.orders = [order];
  assert.deepEqual(engine.orderMatches(order).map((c) => c.uid), ["heavy"]);
  assert.equal(engine.orderReady(order), true);
  assert.equal(engine.fulfillOrder(order.id), true);
  assert.deepEqual(engine.s.cooler.map((c) => c.uid), ["light"]);
});

test("declining an order is limited per day and brings a replacement", () => {
  const engine = new Engine(newSave());
  engine.s.atPort = true;
  engine.refreshOrders();
  const slots = engine.orderSlots;
  assert.equal(engine.s.orders.length, slots);
  assert.equal(engine.orderDeclinesLeft, 2);

  const first = engine.s.orders[0].id;
  assert.equal(engine.declineOrder(first), true);
  assert.equal(engine.orderDeclinesLeft, 1);
  assert.equal(engine.s.orders.length, slots);
  assert.ok(!engine.s.orders.some((o) => o.id === first));

  assert.equal(engine.declineOrder(engine.s.orders[0].id), true);
  assert.equal(engine.orderDeclinesLeft, 0);
  assert.equal(engine.declineOrder(engine.s.orders[0].id), false);
  assert.equal(engine.s.orders.length, slots);

  // На следующий день отказы снова доступны.
  engine.s.minutes += 1440;
  assert.equal(engine.orderDeclinesLeft, 2);
});

test("order level raises reward and opens extra slots", () => {
  const engine = new Engine(newSave());
  assert.equal(engine.orderLevel, 1);
  assert.equal(engine.orderSlots, 3);
  engine.s.ordersDone = 8;
  assert.equal(engine.orderLevel, 3);
  assert.equal(engine.orderSlots, 4);
  engine.s.ordersDone = 40;
  assert.equal(engine.orderLevel, 5);
  assert.equal(engine.orderSlots, 5);
});

test("generated orders are well formed: unique fish per line, sane counts", () => {
  const engine = new Engine(newSave());
  engine.s.atPort = true;
  for (let i = 0; i < 40; i++) {
    engine.s.orders = [];
    engine.refreshOrders();
    for (const o of engine.s.orders) {
      const lines = engine.orderLines(o);
      assert.ok(lines.length >= 1 && lines.length <= 3);
      const ids = lines.map((l) => l.fishId);
      assert.equal(new Set(ids).size, ids.length);
      for (const l of lines) {
        assert.ok(l.count >= 1 && l.count <= 12);
        assert.ok(l.minWeight >= 0);
      }
      assert.ok(o.reward >= 50);
      assert.ok(o.expiresDay > engine.day);
      assert.ok(["single", "bulk", "bundle", "trophy"].includes(o.kind ?? "single"));
    }
  }
});
