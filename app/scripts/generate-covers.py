#!/usr/bin/env python3
"""シード作品のカバーアート生成パイプライン。

本番の /api/admin/covers (COVER_TASK_SECRET でゲート) 経由で画像を生成し、
3:4 にクロップして public/covers/<slug>.webp へ保存する。
前提: OpenAI組織で画像モデル(gpt-image-1)が有効なこと。

  COVER_TASK_SECRET=xxx python3 scripts/generate-covers.py [slug ...]
"""
import base64
import io
import json
import os
import sys
import time
import urllib.request

BASE = os.environ.get("COVER_API_BASE", "https://bukucha.vercel.app")
SECRET = os.environ["COVER_TASK_SECRET"]
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "covers")

STYLE = (
    "Beautiful anime-style illustration for a Japanese romance web novel cover, "
    "shoujo manga aesthetic, handsome young adult man, detailed expressive eyes, "
    "soft cinematic lighting, rich colors, portrait composition, upper body, "
    "face clearly visible near the top of the frame. No text, no letters, no watermark."
)

# 全てオリジナルキャラクター(prisma/seed.ts の書き下ろし設定に対応)
PROMPTS = {
    "rainy-senpai": "A young man with dark messy hair in a school uniform holding a paintbrush, standing in an art classroom at dusk, orange sunset light through rainy windows, slightly averted tender gaze.",
    "dukes-return": "A man with silver hair and cold sharp eyes in a dark military duke uniform with gold epaulettes, grand marble entrance hall at night, candlelight, intense gaze at viewer.",
    "midnight-boss": "A man with black hair in a white dress shirt with loosened necktie, dim office at midnight lit only by a monitor glow, tired but soft smile.",
    "villainess-prince": "An elegant prince with golden hair in white and gold royal attire kneeling gracefully in a chandelier-lit ballroom, confident knowing smile.",
    "knight-childhood": "A loyal knight with brown hair in silver armor standing guard in a candlelit stone corridor at night, restrained longing expression.",
    "contract-marriage": "A composed young businessman in a tailored dark suit sitting in a modern luxury living room at evening, an envelope on the table, sincere earnest gaze.",
    "shadow-emperor": "A young emperor in dark east-asian style robes holding a removed ceremonial mask, moonlit palace veranda with hanging lanterns, gentle unmasked smile.",
    "quiet-coworker": "A quiet office worker with glasses and neat black hair holding a smartphone, office kitchenette with soft daylight, shy surprised expression.",
    "enemy-general": "A battle-hardened young general with short dark hair and a scar, firelit war tent with maps, cutting a rope with a dagger, unexpectedly soft eyes.",
    "sharehouse-ex": "A young man with light brown hair in casual clothes holding a coffee mug in a shared-house kitchen, morning light, nostalgic bittersweet smile.",
    "stepbrother": "A young man with ash gray hair in a loose knit sweater sitting on a sofa in a dim evening living room, quiet heavy gaze at viewer.",
    "wizard-disciple": "An ageless wizard with long pale hair in dark robes floating down from a library ladder in a tower full of old books, candlelight, wry amused expression.",
    "rival-fiance": "A japanese swordsman with black hair in dark kimono standing in a white sand garden, katana at his side, sharp challenging gaze, falling maple leaves.",
    "rival-voice": "A stylish young voice actor with silver-blue hair wearing headphones on one ear in a recording studio, red on-air lamp glow, teasing smirk at viewer.",
    "bought-duchess": "A cold beautiful duke with black hair in an ornate dark coat sitting at a candlelit study desk, tapping a contract, possessive smile.",
    "shadow-prince": "A young man identical to a prince, standing alone in a moonlit palace garden removing a white glove, fragile uncertain expression, blue night tones.",
    "neighbor-novelist": "A sleepy young novelist with messy black hair and dark circles holding out a stack of manuscript pages at an apartment door at night, earnest pleading eyes.",
    "revenge-love": "A refined young heir in an elegant suit at a night-view restaurant table, wine glass set down, calm dangerous gentle smile.",
    "snow-lodge": "A rugged quiet man with dark hair in a heavy sweater tending a fireplace in a snowbound mountain lodge, blizzard through the window, warm firelight on his face.",
    "cinderella": "A young prince disguised in a hooded traveler cloak at a lively market bakery, holding up a glass slipper, bright hopeful grin, morning light.",
}


def crop_3x4(png_bytes: bytes) -> bytes:
    from PIL import Image

    im = Image.open(io.BytesIO(png_bytes)).convert("RGB")
    w, h = im.size
    target_h = int(w / 0.75)
    if h > target_h:
        # 顔が上部に来る構図なので上寄せでクロップ
        top = min(int(h * 0.04), h - target_h)
        im = im.crop((0, top, w, top + target_h))
    out = im.resize((768, 1024))
    buf = io.BytesIO()
    out.save(buf, "WEBP", quality=82, method=6)
    return buf.getvalue()


def generate(slug: str, prompt: str) -> None:
    body = json.dumps({"secret": SECRET, "prompt": f"{prompt} {STYLE}"}).encode()
    req = urllib.request.Request(
        f"{BASE}/api/admin/covers", data=body, method="POST",
        headers={"content-type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=280) as r:
        d = json.load(r)
    if "b64" not in d:
        raise RuntimeError(d.get("error", "unknown"))
    webp = crop_3x4(base64.b64decode(d["b64"]))
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, f"{slug}.webp")
    open(path, "wb").write(webp)
    print(f"ok {slug} ({len(webp) // 1024}KB)")


if __name__ == "__main__":
    targets = sys.argv[1:] or list(PROMPTS)
    for i, slug in enumerate(targets):
        for attempt in range(3):
            try:
                generate(slug, PROMPTS[slug])
                break
            except Exception as e:  # noqa: BLE001
                print(f"retry {slug} ({attempt + 1}): {str(e)[:200]}")
                time.sleep(10)
        else:
            print(f"FAILED {slug}")
        time.sleep(2)
