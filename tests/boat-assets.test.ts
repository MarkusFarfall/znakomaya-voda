import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { BOAT_IMAGES } from "../src/game/render/boats/images";

const root = new URL("../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf-8");
const manifest = JSON.parse(read("public/boats/manifest.json")) as {
  algorithm: string;
  boats: Record<string, { file: string; width: number; height: number; bytes: number; sha256: string; source: string }>;
};

test("все суда имеют заранее подготовленный WebP с действительным хэшем", () => {
  const styles = Object.keys(BOAT_IMAGES);
  assert.equal(styles.length, 9);
  assert.deepEqual(new Set(styles), new Set(Object.keys(manifest.boats)));
  let total = 0;
  for (const [style, url] of Object.entries(BOAT_IMAGES)) {
    assert.ok(url.endsWith(".webp"), `${style}: production-файл не WebP`);
    const item = manifest.boats[style];
    assert.equal(item.file, url);
    assert.ok(item.width <= 1024 && item.height <= 1024, `${style}: превышен мастер-размер`);
    assert.ok(existsSync(new URL(`public${url}`, root)), `${style}: нет ${url}`);
    assert.ok(existsSync(new URL(item.source, root)), `${style}: нет исходника`);
    const hash = createHash("sha256").update(readFileSync(new URL(`public${url}`, root))).digest("hex");
    assert.equal(hash, item.sha256, `${style}: файл не совпадает с манифестом`);
    total += item.bytes;
  }
  assert.ok(total < 3_000_000, `пакет судов слишком большой: ${total} байт`);
});

test("service worker кэширует именно новые корпуса и не тянет старые JPG", () => {
  const sw = read("public/sw.js");
  assert.match(sw, /zv-assets-v3/);
  for (const url of Object.values(BOAT_IMAGES)) assert.ok(sw.includes(`\"${url}\"`), `в precache нет ${url}`);
  assert.doesNotMatch(sw, /\/boats\/[a-z]+\.jpg/);
});

test("production-загрузчик копирует bitmap без попиксельной обработки", () => {
  const source = read("src/game/render/boats/sprites.ts");
  assert.match(source, /function fromProcessedImage\(img: HTMLImageElement\)/);
  assert.match(source, /endsWith\("\.webp"\) \? fromProcessedImage\(img\) : process\(img\)/);
  assert.match(source, /getImageData и попиксельной работы/);
});
