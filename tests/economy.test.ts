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
  assert.equal(engine.orderMatches(order).length, 2);
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
