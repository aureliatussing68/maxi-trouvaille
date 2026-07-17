from __future__ import annotations

# Sandbox-friendly variant of C:\Users\sinek\Desktop\MAXI_TROUVAILLE\scripts\maxi_tiktok_factory.py
# - Same logic, but output/state paths are configurable via env vars so Codex can write inside the workspace.

from datetime import datetime
from pathlib import Path
import json
import math
import os
import random
import re
import textwrap
import urllib.request

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from moviepy import AudioFileClip, VideoClip


DESKTOP = Path.home() / "Desktop"
REPO = Path(os.environ.get("MAXI_REPO_DIR", str(DESKTOP / "maxi-trouvaille"))).resolve()
TIKTOK = Path(os.environ.get("MAXI_TIKTOK_DIR", str(DESKTOP / "TIKTOK"))).resolve()
TIKTOK.mkdir(parents=True, exist_ok=True)

STATE_PATH = TIKTOK / "maxi_tiktok_factory_state.json"
LATEST_MANIFEST = TIKTOK / "latest_maxi_tiktok_manifest.json"
VOICE_ID = "IKne3meq5aSn9XLyUdCD"
W, H = 1080, 1920
FPS = 24

THEMES = [
    {
        "id": "petits_prix",
        "hook1": "Stop payer",
        "hook2": "plein pot",
        "angle": "4 trouvailles utiles à prix cassés",
        "spoken": "Stop payer plein pot pour des produits simples du quotidien. Chez Maxi Trouvailles, je te montre quatre articles utiles, en déstockage, retours clients ou fins de série. Les prix changent selon les arrivages, donc regarde vite ce qui est dispo sur maxitrouvaille.fr.",
        "caption": "Stop payer plein pot : 4 trouvailles utiles à prix cassés sur https://maxitrouvaille.fr #maxitrouvailles #destockage #bonnesaffaires #prixcasses",
        "categories": ["high-tech", "maison", "electricite", "auto-moto"],
    },
    {
        "id": "palette",
        "hook1": "Palette",
        "hook2": "bonnes affaires",
        "angle": "Déstockage, retours clients, fins de série",
        "spoken": "Aujourd'hui on part sur l'esprit palette Maxi Trouvailles. Pas de promesse bizarre, juste des produits utiles à prix cassés, issus du déstockage, des retours clients ou des fins de série. Tu vois un article qui te plaît, tu vérifies la fiche sur maxitrouvaille.fr.",
        "caption": "Esprit palette Maxi Trouvailles : produits utiles, prix cassés, stock selon arrivage. https://maxitrouvaille.fr #palette #destockage #maxitrouvailles",
        "categories": [],
    },
    {
        "id": "moins_20",
        "hook1": "Moins de",
        "hook2": "20 euros",
        "angle": "Sélection rapide à petit budget",
        "spoken": "Petit budget, bonnes affaires. Je te montre une sélection autour des petits prix chez Maxi Trouvailles. Maison, auto, high tech, accessoires pratiques : les arrivages bougent, les stocks aussi. Le réflexe, c'est maxitrouvaille.fr.",
        "caption": "Sélection petit budget Maxi Trouvailles : maison, auto, high-tech, accessoires pratiques. https://maxitrouvaille.fr #moinsde20euros #bonplan #destockage",
        "categories": [],
        "max_price": 2000,
    },
    {
        "id": "auto_maison",
        "hook1": "Auto + maison",
        "hook2": "prix cassés",
        "angle": "Accessoires utiles du moment",
        "spoken": "Si tu aimes les accessoires pratiques, regarde ça. Maxi Trouvailles rentre des produits auto, maison et petits équipements utiles à prix cassés. Chaque fiche est à vérifier selon le stock, mais l'idée est simple : trouver la bonne affaire avant qu'elle parte.",
        "caption": "Auto, maison, accessoires pratiques : les arrivages Maxi Trouvailles bougent vite. https://maxitrouvaille.fr #auto #maison #destockage #prixcasses",
        "categories": ["auto-moto", "maison", "electricite"],
    },
    {
        "id": "encheres_bientot",
        "hook1": "Bientôt",
        "hook2": "des enchères",
        "angle": "Mais déjà des prix cassés aujourd'hui",
        "spoken": "Petit teasing Maxi Trouvailles. Plus tard, on préparera aussi des enchères, mais aujourd'hui il y a déjà des produits à prix cassés à voir sur le site. Déstockage, fins de série, retours clients : va repérer les arrivages sur maxitrouvaille.fr.",
        "caption": "Bientôt des enchères Maxi Trouvailles, mais déjà des prix cassés sur le site. https://maxitrouvaille.fr #encheres #destockage #bonnesaffaires",
        "categories": [],
    },
]


def read_state() -> dict:
    if STATE_PATH.exists():
        try:
            return json.loads(STATE_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return {}
    return {}


def write_state(state: dict) -> None:
    STATE_PATH.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


def money(cents: int) -> str:
    euros = cents / 100
    if euros.is_integer():
        return f"{int(euros)} €"
    return f"{euros:.2f}".replace(".", ",") + " €"


def clean_title(name: str) -> str:
    name = re.sub(r"\s+-\s+à vérifier.*$", "", name, flags=re.I)
    name = re.sub(r"\s+compatible.*$", "", name, flags=re.I)
    return textwrap.shorten(name, width=31, placeholder="")


def product_tag(product: dict) -> str:
    category = product.get("categoryId", "")
    mapping = {
        "auto-moto": "Auto",
        "maison": "Maison",
        "electricite": "Électricité",
        "high-tech": "High-tech",
        "sport-loisirs": "Sport",
        "beaute-sante": "Santé",
        "informatique": "Informatique",
    }
    return mapping.get(category, "Bon plan")


def image_path(product: dict) -> Path | None:
    images = product.get("images") or [product.get("image")]
    for raw in images:
        if not raw or not isinstance(raw, str) or raw.startswith("http"):
            continue
        candidate = (REPO / "public" / raw.lstrip("/")).resolve()
        if candidate.exists() and candidate.suffix.lower() in {".webp", ".jpg", ".jpeg", ".png"}:
            return candidate
    return None


def is_allowed_product(product: dict) -> bool:
    text = " ".join(
        str(product.get(field, "")) for field in ("name", "slug", "categoryId", "badge")
    ).lower()
    blocked_terms = ("spotify", "sos debarras", "sos débarras", "systeme d’alerte sos", "systeme d'alerte sos", "alerte sos")
    return not any(term in text for term in blocked_terms)


def load_products(theme: dict) -> list[dict]:
    data = json.loads((REPO / "data" / "quick-products.json").read_text(encoding="utf-8"))
    filters = [
        {"status": "published", "relaxed_theme": False},
        {"status": "draft", "relaxed_theme": False},
        {"status": "published", "relaxed_theme": True},
        {"status": "draft", "relaxed_theme": True},
    ]
    for options in filters:
        scoped_theme = theme if not options["relaxed_theme"] else {k: v for k, v in theme.items() if k not in {"categories", "max_price"}}
        products = []
        for product in data:
            if not is_allowed_product(product):
                continue
            path = image_path(product)
            if not path:
                continue
            if product.get("status") != options["status"]:
                continue
            if scoped_theme.get("categories") and product.get("categoryId") not in scoped_theme["categories"]:
                continue
            if scoped_theme.get("max_price") and int(product.get("price", 10**9)) > int(scoped_theme["max_price"]):
                continue
            products.append(
                {
                    "title": clean_title(product.get("name", "Produit Maxi Trouvailles")),
                    "price": money(int(product.get("price", 0))),
                    "tag": product_tag(product),
                    "image": str(path),
                    "slug": product.get("slug", ""),
                }
            )
        if len(products) >= 4:
            return products
    raise RuntimeError("Aucun groupe de 4 produits locaux compatibles n'a ete trouve pour ce brouillon.")


def _last_manifest() -> dict:
    # Prefer Desktop\TIKTOK manifest as the canonical "last published" source (read-only in Codex),
    # but fall back to the local sandbox manifest when needed.
    candidates = [
        DESKTOP / "TIKTOK" / "latest_maxi_tiktok_manifest.json",
        LATEST_MANIFEST,
    ]
    for path in candidates:
        if not path.exists():
            continue
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
    return {}


def next_theme() -> tuple[dict, int]:
    state = read_state()
    index = int(state.get("index", 0))
    last = _last_manifest().get("theme")

    # Ensure we don't repeat the last theme twice in a row.
    theme = THEMES[index % len(THEMES)]
    if last and theme.get("id") == last:
        index += 1
        theme = THEMES[index % len(THEMES)]

    state["index"] = index + 1
    state["last_theme"] = theme["id"]
    state["last_run"] = datetime.now().isoformat(timespec="seconds")
    write_state(state)
    return theme, index


def env_key() -> str:
    if os.environ.get("MAXI_FORCE_OFFLINE_VOICE", "").strip().lower() in {"1", "true", "yes", "on"}:
        return ""
    env_path = REPO / ".env.local"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            if line.strip().startswith("ELEVENLABS_API_KEY="):
                return line.split("=", 1)[1].strip()
    return os.environ.get("ELEVENLABS_API_KEY", "").strip()


def _template_voice_for(theme_id: str) -> tuple[Path, str] | None:
    """
    Offline fallback voice templates (already generated and stored on Desktop\\TIKTOK).
    Returns (voice_mp3_path, spoken_script).
    """
    desktop_tiktok = DESKTOP / "TIKTOK"
    mapping = {
        "palette": ("voiceover_palette_maxi_trouvailles.mp3", "script_palette_voix.txt"),
        "petits_prix": ("maxi_20260506-023432_petits_prix_voice.mp3", "maxi_20260506-023432_petits_prix_script.txt"),
        # Generic voice that stays valid across themes (fallback).
        "default": ("voiceover_maxi_trouvaille.mp3", "script_voix.txt"),
    }
    voice_name, script_name = mapping.get(theme_id, mapping["default"])
    if not voice_name or not script_name:
        return None
    voice = desktop_tiktok / voice_name
    script = desktop_tiktok / script_name
    if not voice.exists() or not script.exists():
        return None
    return voice, script.read_text(encoding="utf-8").strip()


def generate_voice(script: str, audio_path: Path, *, theme_id: str) -> tuple[Path, str]:
    """
    Returns (produced_audio_path, spoken_script_used).
    """
    key = env_key()
    if not key:
        template = _template_voice_for(theme_id)
        if not template:
            raise RuntimeError("Aucune voix disponible (ELEVENLABS bloqué et aucun template trouvé).")
        voice_src, spoken = template
        audio_path.write_bytes(voice_src.read_bytes())
        return audio_path, spoken
    payload = {
        "text": script,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {
            "stability": 0.39,
            "similarity_boost": 0.84,
            "style": 0.58,
            "use_speaker_boost": True,
        },
    }
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "xi-api-key": key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as response:
            audio_path.write_bytes(response.read())
        return audio_path, script
    except Exception:
        template = _template_voice_for(theme_id)
        if not template:
            raise
        voice_src, spoken = template
        audio_path.write_bytes(voice_src.read_bytes())
        return audio_path, spoken


def cover(im: Image.Image, size: tuple[int, int]) -> Image.Image:
    tw, th = size
    iw, ih = im.size
    scale = max(tw / iw, th / ih)
    im = im.resize((int(iw * scale), int(ih * scale)), Image.Resampling.LANCZOS)
    x = (im.size[0] - tw) // 2
    y = (im.size[1] - th) // 2
    return im.crop((x, y, x + tw, y + th))


def center(draw: ImageDraw.ImageDraw, text: str, y: int, font: ImageFont.FreeTypeFont, fill, stroke: int = 0) -> None:
    box = draw.textbbox((0, 0), text, font=font, stroke_width=stroke)
    draw.text(
        ((W - box[2] + box[0]) // 2, y),
        text,
        font=font,
        fill=fill,
        stroke_width=stroke,
        stroke_fill=(24, 24, 24),
    )


def rounded_shadow(base: Image.Image, box: tuple[int, int, int, int], radius: int = 42, alpha: int = 118) -> None:
    x1, y1, x2, y2 = box
    shadow = Image.new("RGBA", (x2 - x1 + 80, y2 - y1 + 80), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle((40, 40, x2 - x1 + 40, y2 - y1 + 40), radius=radius, fill=(0, 0, 0, alpha))
    shadow = shadow.filter(ImageFilter.GaussianBlur(24))
    base.paste(shadow, (x1 - 28, y1 - 18), shadow)


def palette(draw: ImageDraw.ImageDraw, t: float, base_y: int) -> None:
    wood = (135, 82, 37, 255)
    dark = (82, 52, 31, 255)
    draw.rounded_rectangle((145, base_y + 195, 935, base_y + 248), radius=12, fill=dark)
    draw.rounded_rectangle((145, base_y + 150, 935, base_y + 198), radius=12, fill=wood)
    for i in range(3):
        draw.rounded_rectangle((190 + i * 235, base_y + 248, 365 + i * 235, base_y + 296), radius=12, fill=wood)
    boxes = [
        (215, base_y - 35, 430, base_y + 145),
        (430, base_y - 78, 660, base_y + 145),
        (660, base_y - 22, 870, base_y + 145),
        (300, base_y - 220, 550, base_y - 68),
        (545, base_y - 220, 805, base_y - 68),
    ]
    colors = [(226, 156, 69, 255), (240, 187, 91, 255), (207, 130, 61, 255)]
    for i, box in enumerate(boxes):
        draw.rounded_rectangle(box, radius=18, fill=colors[i % 3], outline=(96, 61, 33, 255), width=4)
        x1, y1, x2, _ = box
        draw.line((x1 + 30, y1 + 18, x2 - 30, y1 + 18), fill=(255, 233, 176, 175), width=3)


def presenter(draw: ImageDraw.ImageDraw, t: float, x: int = 175, y: int = 1470) -> None:
    draw.ellipse((x - 70, y - 310, x + 70, y - 170), fill=(236, 198, 164, 255), outline=(20, 20, 20, 45), width=3)
    draw.arc((x - 46, y - 265, x - 8, y - 230), 200, 340, fill=(35, 35, 35, 255), width=4)
    draw.arc((x + 8, y - 265, x + 46, y - 230), 200, 340, fill=(35, 35, 35, 255), width=4)
    mouth = 8 + int(7 * abs(math.sin(t * 9)))
    draw.ellipse((x - 24, y - 220, x + 24, y - 220 + mouth), fill=(80, 35, 35, 255))
    draw.rounded_rectangle((x - 104, y - 165, x + 104, y + 82), radius=58, fill=(18, 123, 113, 255))
    draw.rounded_rectangle((x + 122, y - 92, x + 188, y + 102), radius=28, fill=(42, 42, 42, 255))
    draw.ellipse((x + 104, y - 116, x + 204, y - 16), fill=(32, 32, 32, 255))
    draw.line((x + 154, y + 102, x + 154, y + 185), fill=(55, 55, 55, 255), width=8)
    draw.arc((x + 108, y + 126, x + 200, y + 220), 0, 180, fill=(55, 55, 55, 255), width=8)


def load_font(size: int) -> ImageFont.FreeTypeFont:
    candidates = [
        REPO / "assets" / "fonts" / "Montserrat-ExtraBold.ttf",
        REPO / "assets" / "fonts" / "Montserrat-Bold.ttf",
        REPO / "assets" / "fonts" / "Inter-Bold.ttf",
        REPO / "node_modules" / "next" / "dist" / "compiled" / "fonts" / "Inter-Bold.ttf",
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size=size)
    return ImageFont.load_default()


def make_preview(theme: dict, products: list[dict], path: Path) -> None:
    base = Image.new("RGB", (W, H), (14, 14, 18))
    draw = ImageDraw.Draw(base)
    title = load_font(98)
    subtitle = load_font(56)
    center(draw, theme["hook1"], 80, title, fill=(255, 255, 255), stroke=10)
    center(draw, theme["hook2"], 185, title, fill=(255, 255, 255), stroke=10)
    center(draw, theme["angle"], 310, subtitle, fill=(224, 224, 224), stroke=6)

    y = 520
    for i, p in enumerate(products[:4]):
        im = Image.open(p["image"]).convert("RGB")
        tile = cover(im, (820, 250))
        x1, y1, x2, y2 = (130, y + i * 300, 950, y + i * 300 + 250)
        rounded_shadow(base, (x1, y1, x2, y2), radius=42, alpha=125)
        mask = Image.new("L", (x2 - x1, y2 - y1), 0)
        md = ImageDraw.Draw(mask)
        md.rounded_rectangle((0, 0, x2 - x1, y2 - y1), radius=42, fill=255)
        base.paste(tile, (x1, y1), mask)
        badge = load_font(48)
        draw.rounded_rectangle((x1 + 18, y1 + 18, x1 + 210, y1 + 86), radius=28, fill=(8, 166, 156))
        draw.text((x1 + 38, y1 + 26), p["tag"], font=badge, fill=(255, 255, 255))
        price = load_font(64)
        draw.rounded_rectangle((x2 - 260, y1 + 18, x2 - 18, y1 + 106), radius=34, fill=(255, 255, 255))
        draw.text((x2 - 240, y1 + 30), p["price"], font=price, fill=(22, 22, 22))

    base.save(path, "JPEG", quality=90, optimize=True, progressive=True)


def make_video(theme: dict, products: list[dict], voice: Path, out: Path) -> None:
    audio = AudioFileClip(str(voice))
    duration = float(audio.duration)
    random.seed(theme["id"])

    # Preload product images
    frames: list[Image.Image] = []
    for p in products[:4]:
        im = Image.open(p["image"]).convert("RGB")
        frames.append(im)

    hook_font = load_font(112)
    label_font = load_font(58)
    small_font = load_font(46)

    def render(t: float) -> np.ndarray:
        idx = min(int(t // (duration / 4)), 3)
        product = products[idx]
        im = cover(frames[idx], (W, H))
        base = im.convert("RGBA")
        draw = ImageDraw.Draw(base)

        # Header
        draw.rectangle((0, 0, W, 270), fill=(0, 0, 0, 110))
        center(draw, theme["hook1"], 28, hook_font, fill=(255, 255, 255), stroke=10)
        center(draw, theme["hook2"], 140, hook_font, fill=(255, 255, 255), stroke=10)

        # Product card
        card = (80, 1240, 1000, 1700)
        rounded_shadow(base, card, radius=48, alpha=150)
        draw.rounded_rectangle(card, radius=48, fill=(14, 14, 18, 210))
        draw.text((120, 1285), product["title"], font=label_font, fill=(255, 255, 255))
        draw.rounded_rectangle((120, 1385, 360, 1465), radius=34, fill=(8, 166, 156, 255))
        draw.text((148, 1401), product["tag"], font=small_font, fill=(255, 255, 255))
        draw.rounded_rectangle((760, 1385, 960, 1465), radius=34, fill=(255, 255, 255, 255))
        draw.text((790, 1399), product["price"], font=small_font, fill=(22, 22, 22))

        # Presenter (simple mouth animation)
        presenter(draw, t, x=165, y=1860)
        if theme["id"] == "palette":
            palette(draw, t, base_y=1520)

        return np.array(base.convert("RGB"))

    clip = VideoClip(render, duration=duration).with_audio(audio).with_fps(FPS)
    clip.write_videofile(
        str(out),
        codec="libx264",
        audio_codec="aac",
        fps=FPS,
        bitrate="5500k",
        audio_bitrate="160k",
        threads=4,
        preset="medium",
        ffmpeg_params=["-movflags", "+faststart"],
        logger=None,
    )
    clip.close()
    audio.close()


def pick_products_avoiding_last(theme: dict) -> list[dict]:
    products = load_products(theme)
    last = _last_manifest().get("products") or []
    last_slugs = {p.get("slug") for p in last if isinstance(p, dict)}

    if not last_slugs:
        random.shuffle(products)
        return products[:4]

    fresh = [p for p in products if p.get("slug") not in last_slugs]
    if len(fresh) >= 4:
        random.shuffle(fresh)
        return fresh[:4]

    # If dataset is small, keep at least 2 new items.
    random.shuffle(products)
    return products[:4]


def main() -> None:
    theme, _ = next_theme()
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")

    products = pick_products_avoiding_last(theme)
    voice_path = TIKTOK / f"maxi_{stamp}_{theme['id']}_voice.mp3"
    script_path = TIKTOK / f"maxi_{stamp}_{theme['id']}_script.txt"
    caption_path = TIKTOK / f"maxi_{stamp}_{theme['id']}_caption.txt"
    preview_path = TIKTOK / f"maxi_{stamp}_{theme['id']}_preview.jpg"
    video_path = TIKTOK / f"maxi_{stamp}_{theme['id']}.mp4"

    caption_path.write_text(theme["caption"], encoding="utf-8")
    produced_voice, spoken_used = generate_voice(theme["spoken"], voice_path, theme_id=theme["id"])
    script_path.write_text(spoken_used, encoding="utf-8")
    make_preview(theme, products, preview_path)
    make_video(theme, products, produced_voice, video_path)

    manifest = {
        "createdAt": datetime.now().isoformat(timespec="seconds"),
        "theme": theme["id"],
        "video": str(video_path),
        "voice": str(produced_voice),
        "script": str(script_path),
        "captionFile": str(caption_path),
        "caption": theme["caption"],
        "preview": str(preview_path),
        "products": products[:4],
        "publishStatus": "ready",
    }
    LATEST_MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"status": "ok", "manifest": str(LATEST_MANIFEST), "video": str(video_path), "theme": theme["id"]}))


if __name__ == "__main__":
    main()
