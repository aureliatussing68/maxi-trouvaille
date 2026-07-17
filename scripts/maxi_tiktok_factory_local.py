from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
import json
import os
import random
import subprocess
import textwrap

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from moviepy import AudioFileClip, CompositeVideoClip, ImageClip


ROOT = Path(__file__).resolve().parents[1]
DATA_PRODUCTS = ROOT / "data" / "quick-products.json"
OUT_DIR = ROOT / "tmp" / "TIKTOK"
OUT_DIR.mkdir(parents=True, exist_ok=True)

DEFAULT_PREV_MANIFEST = Path.home() / "Desktop" / "TIKTOK" / "latest_maxi_tiktok_manifest.json"
DEFAULT_PREV_MANIFEST_SANDBOX = OUT_DIR / "latest_maxi_tiktok_manifest.json"

W, H = 1080, 1920
FPS = 24


THEMES = [
    {
        "id": "palette",
        "hook": "Esprit palette :\nprix cassés",
        "angle": "Déstockage, retours clients, fins de série",
        "spoken": "Aujourd'hui on part sur l'esprit palette Maxi Trouvailles. Pas de promesse bizarre : juste des produits utiles à prix cassés, issus du déstockage, des retours clients ou des fins de série. Les stocks bougent vite, alors vérifie les fiches sur maxitrouvaille.fr.",
        "caption": "Esprit palette Maxi Trouvailles : produits utiles, prix cassés, stock selon arrivage. https://maxitrouvaille.fr #palette #destockage #maxitrouvailles",
        "categories": [],
    },
    {
        "id": "moins_20",
        "hook": "Moins de 20€ :\n4 pépites",
        "angle": "Sélection rapide à petit budget",
        "spoken": "Petit budget, bonnes affaires. Je te montre une sélection autour des petits prix chez Maxi Trouvailles. Maison, auto, high tech, accessoires pratiques : les arrivages bougent, les stocks aussi. Le réflexe, c'est maxitrouvaille.fr.",
        "caption": "Sélection petit budget Maxi Trouvailles : maison, auto, high-tech, accessoires pratiques. https://maxitrouvaille.fr #moinsde20euros #bonplan #destockage",
        "categories": [],
        "max_price": 2000,
    },
    {
        "id": "arrivage",
        "hook": "Arrivage du jour :\nà saisir",
        "angle": "Nouveautés + stocks limités",
        "spoken": "Arrivage du jour chez Maxi Trouvailles. Je te montre quatre articles utiles : auto, maison, high tech, ou sport. Les stocks sont limités et ça part vite, donc va jeter un œil sur maxitrouvaille.fr pour voir ce qui est encore dispo.",
        "caption": "Arrivage du jour Maxi Trouvailles : 4 articles utiles, stock limité. https://maxitrouvaille.fr #arrivage #bonnesaffaires #destockage",
        "categories": ["high-tech", "maison", "electricite", "auto-moto", "sport-loisirs"],
    },
    {
        "id": "encheres_bientot",
        "hook": "Bientôt\nles enchères",
        "angle": "Mais déjà des prix cassés aujourd'hui",
        "spoken": "Petit teasing Maxi Trouvailles. Plus tard, on préparera aussi des enchères, mais aujourd'hui il y a déjà des produits à prix cassés à voir sur le site. Déstockage, fins de série, retours clients : va repérer les arrivages sur maxitrouvaille.fr.",
        "caption": "Bientôt des enchères Maxi Trouvailles, mais déjà des prix cassés sur le site. https://maxitrouvaille.fr #encheres #destockage #bonnesaffaires",
        "categories": [],
    },
]

THEMES_BY_ID = {t["id"]: t for t in THEMES}


@dataclass(frozen=True)
class PickedProduct:
    title: str
    price_cents: int
    tag: str
    slug: str
    image_path: Path


def _money(cents: int) -> str:
    euros = cents / 100
    if euros.is_integer():
        return f"{int(euros)} €"
    return f"{euros:.2f}".replace(".", ",") + " €"


def _clean_title(name: str) -> str:
    name = " ".join((name or "").split())
    return textwrap.shorten(name, width=34, placeholder="")


def _tag(category_id: str) -> str:
    mapping = {
        "auto-moto": "Auto",
        "maison": "Maison",
        "electricite": "Électricité",
        "high-tech": "High-tech",
        "sport-loisirs": "Sport",
        "beaute-sante": "Santé",
        "informatique": "Informatique",
    }
    return mapping.get(category_id or "", "Bon plan")


def _pick_theme(prev_theme: str | None) -> dict:
    def has_voice(t: dict) -> bool:
        return any(OUT_DIR.glob(f"*_{t['id']}_voice.mp3"))

    base = [t for t in THEMES if has_voice(t)] or THEMES
    options = [t for t in base if t["id"] != prev_theme] or base
    # Favor variety between "budget" and "angle".
    order = ["arrivage", "palette", "moins_20", "encheres_bientot"]
    options.sort(key=lambda t: order.index(t["id"]) if t["id"] in order else 999)
    return random.choice(options[: max(2, len(options))])


def _load_prev_manifest(path: Path) -> dict | None:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def _load_products(theme: dict, prev_slugs: set[str]) -> list[PickedProduct]:
    data = json.loads(DATA_PRODUCTS.read_text(encoding="utf-8"))
    products = data.get("products", []) if isinstance(data, dict) else data

    allowed_categories: set[str] = set(theme.get("categories") or [])
    max_price: int | None = theme.get("max_price")

    candidates: list[dict] = []
    for p in products:
        slug = (p.get("slug") or "").strip()
        if not slug or slug in prev_slugs:
            continue
        price_cents = int(p.get("priceCents") or p.get("price") or 0)
        if price_cents <= 0:
            continue
        if max_price is not None and price_cents > int(max_price):
            continue
        category_id = (p.get("categoryId") or "").strip()
        if allowed_categories and category_id not in allowed_categories:
            continue
        image = (p.get("images") or [p.get("image")] or [None])[0]
        if not image:
            continue
        image_path = _resolve_image_path(image)
        if not image_path.exists():
            continue
        candidates.append(p)

    random.shuffle(candidates)
    picked: list[PickedProduct] = []
    for p in candidates:
        if len(picked) >= 4:
            break
        slug = p["slug"]
        category_id = p.get("categoryId") or ""
        title = _clean_title(p.get("name") or p.get("title") or slug)
        price_cents = int(p.get("priceCents") or p.get("price") or 0)
        image = (p.get("images") or [p.get("image")] or [None])[0]
        image_path = _resolve_image_path(image)
        picked.append(
            PickedProduct(
                title=title,
                price_cents=price_cents,
                tag=_tag(category_id),
                slug=slug,
                image_path=image_path,
            )
        )

    if len(picked) < 4:
        raise RuntimeError(f"Pas assez de produits éligibles trouvés (trouvés={len(picked)}).")
    return picked


def _resolve_image_path(image: str) -> Path:
    raw = str(image).strip()
    if raw.lower().startswith("c:\\"):
        return Path(raw)
    if raw.startswith("/"):
        # Site path like /uploads/... lives under public/
        return (ROOT / "public" / raw.lstrip("/")).resolve()
    return (ROOT / raw).resolve()


def _select_existing_voice(theme_id: str) -> tuple[Path, str]:
    """
    Network is sandboxed; reuse a previously generated voice track if present.
    Returns (voice_path, script_text).
    """
    candidates = sorted(OUT_DIR.glob(f"*_{theme_id}_voice.mp3"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not candidates:
        raise RuntimeError(f"Aucune voix existante trouvée pour le thème '{theme_id}' dans {OUT_DIR}.")
    voice_path = candidates[0]

    script_path = voice_path.with_name(voice_path.name.replace("_voice.mp3", "_script.txt"))
    script_text = THEMES_BY_ID.get(theme_id, {}).get("spoken", "")
    if script_path.exists():
        script_text = script_path.read_text(encoding="utf-8").strip() or script_text
    if not script_text:
        script_text = "Découvre les arrivages Maxi Trouvailles sur maxitrouvaille.fr."
    return voice_path, script_text


def _cover(im: Image.Image, size: tuple[int, int]) -> Image.Image:
    tw, th = size
    iw, ih = im.size
    scale = max(tw / iw, th / ih)
    im = im.resize((int(iw * scale), int(ih * scale)), Image.Resampling.LANCZOS)
    x = (im.size[0] - tw) // 2
    y = (im.size[1] - th) // 2
    return im.crop((x, y, x + tw, y + th))


def _font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    # Best-effort font selection on Windows.
    candidates = []
    if os.name == "nt":
        windir = os.environ.get("WINDIR", r"C:\Windows")
        candidates += [
            Path(windir) / "Fonts" / ("seguisb.ttf" if bold else "segoeui.ttf"),
            Path(windir) / "Fonts" / ("arialbd.ttf" if bold else "arial.ttf"),
        ]
    for p in candidates:
        if p.exists():
            return ImageFont.truetype(str(p), size=size)
    return ImageFont.load_default()


def _draw_card(product: PickedProduct) -> Image.Image:
    base = Image.new("RGB", (W, H), (10, 10, 12))
    bg = Image.open(product.image_path).convert("RGB")
    bg = _cover(bg, (W, H))
    bg = bg.filter(ImageFilter.GaussianBlur(10))
    base.paste(bg, (0, 0))

    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    d.rounded_rectangle((52, 1120, W - 52, 1780), radius=46, fill=(0, 0, 0, 160))
    base = Image.alpha_composite(base.convert("RGBA"), overlay).convert("RGB")

    # Product image "card"
    product_im = Image.open(product.image_path).convert("RGBA")
    product_im = _cover(product_im, (860, 860))
    card = Image.new("RGBA", (900, 900), (255, 255, 255, 0))
    cd = ImageDraw.Draw(card)
    cd.rounded_rectangle((0, 0, 899, 899), radius=54, fill=(255, 255, 255, 235))
    product_im = Image.alpha_composite(card, Image.new("RGBA", (900, 900), (0, 0, 0, 0)))
    product_im.paste(_cover(Image.open(product.image_path).convert("RGBA"), (860, 860)), (20, 20))

    base_rgba = base.convert("RGBA")
    base_rgba.paste(product_im, ((W - 900) // 2, 150), product_im)

    d = ImageDraw.Draw(base_rgba)
    title = product.title
    price = _money(product.price_cents)
    tag = product.tag

    title_font = _font(62, bold=True)
    meta_font = _font(52, bold=True)
    small_font = _font(42, bold=False)

    d.text((90, 1175), title, font=title_font, fill=(255, 255, 255))
    d.text((90, 1270), f"{price}  •  {tag}", font=meta_font, fill=(255, 214, 77))
    d.text((90, 1360), "Stock selon arrivage — vérifie la fiche", font=small_font, fill=(235, 235, 235))

    # CTA
    btn = Image.new("RGBA", (720, 120), (0, 0, 0, 0))
    bd = ImageDraw.Draw(btn)
    bd.rounded_rectangle((0, 0, 719, 119), radius=40, fill=(18, 123, 113, 235))
    bd.text((36, 30), "Voir sur maxitrouvaille.fr", font=_font(44, bold=True), fill=(255, 255, 255))
    base_rgba.paste(btn, ((W - 720) // 2, 1610), btn)

    return base_rgba.convert("RGB")


def _draw_hook(theme: dict) -> Image.Image:
    im = Image.new("RGB", (W, H), (12, 12, 14))
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, W, H), fill=(12, 12, 14))
    d.rounded_rectangle((80, 260, W - 80, 1200), radius=56, fill=(0, 0, 0, 150))
    d.rounded_rectangle((110, 300, W - 110, 1160), radius=46, outline=(18, 123, 113), width=6)

    hook_font = _font(104, bold=True)
    angle_font = _font(56, bold=False)
    small_font = _font(44, bold=False)

    hook = theme["hook"]
    angle = theme["angle"]
    d.multiline_text((130, 380), hook, font=hook_font, fill=(255, 255, 255), spacing=18)
    d.text((130, 710), angle, font=angle_font, fill=(255, 214, 77))
    d.text((130, 830), "4 articles • montage rapide • stock limité", font=small_font, fill=(235, 235, 235))
    d.text((130, 980), "maxitrouvaille.fr", font=_font(64, bold=True), fill=(18, 123, 113))
    return im


def _write_caption_files(stem: str, caption: str, script: str) -> dict[str, Path]:
    caption_path = OUT_DIR / f"{stem}_caption.txt"
    script_path = OUT_DIR / f"{stem}_script.txt"
    caption_path.write_text(caption.strip() + "\n", encoding="utf-8")
    script_path.write_text(script.strip() + "\n", encoding="utf-8")
    return {"captionFile": caption_path, "script": script_path}


def main() -> None:
    prev = _load_prev_manifest(DEFAULT_PREV_MANIFEST)
    prev2 = _load_prev_manifest(DEFAULT_PREV_MANIFEST_SANDBOX)
    prev_theme = (prev2 or prev or {}).get("theme")
    prev_slugs = {
        p.get("slug")
        for p in ((prev or {}).get("products", []) + (prev2 or {}).get("products", []))
        if p.get("slug")
    }

    theme = _pick_theme(prev_theme)
    picked = _load_products(theme, prev_slugs=set(prev_slugs))

    now = datetime.now(timezone.utc)
    ts = now.strftime("%Y%m%d-%H%M%S")
    stem = f"maxi_{ts}_{theme['id']}"

    voice_path, script_text = _select_existing_voice(theme["id"])
    audio = AudioFileClip(str(voice_path))

    # Target ~18–20s, but keep in sync with audio.
    total = min(max(audio.duration + 0.6, 16.0), 21.0)
    hook_dur = 2.4
    per = max((total - hook_dur) / 4, 3.2)

    images: list[Image.Image] = [_draw_hook(theme)] + [_draw_card(p) for p in picked]
    durations = [hook_dur] + [per] * 4

    clips = []
    for im, dur in zip(images, durations, strict=True):
        arr = np.array(im)
        clip = ImageClip(arr).with_duration(dur)
        clips.append(clip)

    video = CompositeVideoClip(clips).with_audio(audio).with_fps(FPS)

    mp4_path = OUT_DIR / f"{stem}.mp4"
    video.write_videofile(
        str(mp4_path),
        codec="libx264",
        audio_codec="aac",
        fps=FPS,
        threads=4,
        preset="medium",
        logger=None,
    )

    # Preview image
    preview = OUT_DIR / f"{stem}_preview.jpg"
    images[1].resize((720, 1280), Image.Resampling.LANCZOS).save(preview, quality=92, optimize=True)

    caption = theme["caption"]
    caption_files = _write_caption_files(stem, caption=caption, script=script_text)

    manifest = {
        "createdAt": now.isoformat(),
        "theme": theme["id"],
        "video": str(mp4_path),
        "voice": str(voice_path),
        "script": str(caption_files["script"]),
        "captionFile": str(caption_files["captionFile"]),
        "caption": caption,
        "preview": str(preview),
        "products": [
            {
                "title": p.title,
                "price": _money(p.price_cents),
                "tag": p.tag,
                "image": str(p.image_path),
                "slug": p.slug,
            }
            for p in picked
        ],
        "publishStatus": "ready",
        "note": "Généré en sandbox (voix réutilisée, réseau restreint). À copier vers Desktop\\TIKTOK si besoin.",
    }

    latest = OUT_DIR / "latest_maxi_tiktok_manifest.json"
    latest.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(str(latest))


if __name__ == "__main__":
    main()
