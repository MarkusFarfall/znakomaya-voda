#!/usr/bin/env python3
"""Собирает прозрачные WebP судов заранее, а не на устройстве игрока.

    python3 scripts/prepare-boats.py          # полная пересборка
    python3 scripts/prepare-boats.py --check  # только проверка готовых ресурсов

Требуется Pillow. Алгоритм повторяет прежний magenta-key из boats/sprites.ts,
но выполняется один раз на машине разработчика. Манифест детерминирован и не
содержит дату, поэтому повторный запуск не создаёт шум в Git.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Any

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "boats"
OUTPUT = ROOT / "public" / "boats"
MANIFEST = OUTPUT / "manifest.json"
STYLES = ("row", "kayak", "dinghy", "barkas", "cutter", "yacht", "seiner", "trawler", "research")
ALGORITHM = "magenta-key-v1-master-1024"
MASTER_SIZE = 1024  # запас для 400 px на экране и DPR=2; дальше работают mip-уровни


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def clamp(value: float) -> int:
    return max(0, min(255, round(value)))


def process(path: Path) -> tuple[Image.Image, dict[str, Any]]:
    source_hash = sha256(path)
    with Image.open(path) as opened:
        img = opened.convert("RGBA")
    width, height = img.size
    src = list(img.getdata())
    corners = ((0, 0), (width - 1, 0), (0, height - 1), (width - 1, height - 1), (width // 2, 0), (width // 2, height - 1))
    has_alpha = any(src[y * width + x][3] < 200 for x, y in corners)
    rows = [0] * height
    cols = [0] * width
    out: list[tuple[int, int, int, int]] = []

    for y in range(height):
        for x in range(width):
            r, g, b, alpha = src[y * width + x]
            if has_alpha:
                out.append((r, g, b, alpha))
                if alpha > 128:
                    rows[y] += 1
                    cols[x] += 1
                continue

            magenta = min(r, b) - g
            if magenta <= 34:
                out.append((r, g, b, 255))
                rows[y] += 1
                cols[x] += 1
                continue
            if magenta >= 215:
                out.append((r, g, b, 0))
                continue

            a = 1 - (magenta - 34) / 181
            a = max(0.0, min(1.0, (a - 0.12) / 0.88))
            if a <= 0.004:
                out.append((r, g, b, 0))
                continue

            rr = (r - (1 - a) * 255) / a
            bb = (b - (1 - a) * 255) / a
            gg = g / a
            tint = min(rr, bb) - gg
            if tint > 0:
                rr -= tint * 0.75
                bb -= tint * 0.75
            alpha_byte = round(a * 255)
            out.append((clamp(rr), clamp(gg), clamp(bb), alpha_byte))
            if a > 0.5:
                rows[y] += 1
                cols[x] += 1

    img.putdata(out)
    y0, y1, x0, x1 = 0, height - 1, 0, width - 1
    while y0 < height - 1 and rows[y0] < 3:
        y0 += 1
    while y1 > y0 and rows[y1] < 3:
        y1 -= 1
    while x0 < width - 1 and cols[x0] < 3:
        x0 += 1
    while x1 > x0 and cols[x1] < 3:
        x1 -= 1
    if x1 <= x0 or y1 <= y0:
        raise ValueError(f"{path.name}: после очистки не осталось судна")

    cropped = img.crop((x0, y0, x1 + 1, y1 + 1))
    if max(cropped.size) > MASTER_SIZE:
        cropped.thumbnail((MASTER_SIZE, MASTER_SIZE), Image.Resampling.LANCZOS)
    if cropped.getextrema()[3][0] != 0:
        raise ValueError(f"{path.name}: фон остался непрозрачным")
    return cropped, {"source": f"assets/boats/{path.name}", "sourceSha256": source_hash}


def encode(img: Image.Image) -> bytes:
    from io import BytesIO

    buffer = BytesIO()
    img.save(buffer, "WEBP", lossless=True, quality=100, method=6)
    return buffer.getvalue()


def write_if_changed(path: Path, data: bytes) -> bool:
    if path.exists() and path.read_bytes() == data:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return True


def build() -> None:
    manifest: dict[str, Any] = {"version": 1, "algorithm": ALGORITHM, "boats": {}}
    changed = 0
    for style in STYLES:
        source = SOURCE / f"{style}.jpg"
        if not source.exists():
            raise FileNotFoundError(source)
        image, source_info = process(source)
        data = encode(image)
        target = OUTPUT / f"{style}.webp"
        changed += write_if_changed(target, data)
        manifest["boats"][style] = {
            **source_info,
            "file": f"/boats/{style}.webp",
            "width": image.width,
            "height": image.height,
            "bytes": len(data),
            "sha256": hashlib.sha256(data).hexdigest(),
        }
        print(f"{style:10} {image.width:4}×{image.height:<4} {len(data) / 1024:7.1f} КБ")

    payload = (json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8")
    changed += write_if_changed(MANIFEST, payload)
    print(f"Готово: {len(STYLES)} судов; файлов изменено: {changed}")


def check() -> None:
    manifest = json.loads(MANIFEST.read_text("utf-8"))
    if manifest.get("algorithm") != ALGORITHM:
        raise ValueError("Неизвестный алгоритм манифеста")
    if set(manifest.get("boats", {})) != set(STYLES):
        raise ValueError("Манифест покрывает не все суда")
    for style in STYLES:
        item = manifest["boats"][style]
        path = OUTPUT / f"{style}.webp"
        if not path.exists():
            raise FileNotFoundError(path)
        if sha256(path) != item["sha256"]:
            raise ValueError(f"{style}: хэш не совпадает с манифестом")
        with Image.open(path) as image:
            if image.mode != "RGBA":
                raise ValueError(f"{style}: ожидался RGBA WebP")
            if image.size != (item["width"], item["height"]):
                raise ValueError(f"{style}: размер не совпадает с манифестом")
            if image.getextrema()[3][0] != 0:
                raise ValueError(f"{style}: нет прозрачного фона")
            image.verify()
    print(f"Проверено: {len(STYLES)} WebP, прозрачность, размеры и SHA-256 совпадают")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="проверить готовые WebP и манифест")
    args = parser.parse_args()
    try:
        check() if args.check else build()
        return 0
    except Exception as exc:
        print(f"Ошибка: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
