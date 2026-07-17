from __future__ import annotations

from datetime import datetime
from pathlib import Path
import json
import math
import os
import random
import re
import textwrap
import urllib.request
import subprocess

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from moviepy import AudioFileClip, VideoClip


DESKTOP = Path.home() / "Desktop"
REPO = DESKTOP / "maxi-trouvaille"
TIKTOK = DESKTOP / "TIKTOK"
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


def load_products(theme: dict) -> list[dict]:
    data = json.loads((REPO / "data" / "quick-products.json").read_text(encoding="utf-8"))
    products = []
    for product in data:
        path = image_path(product)
        if not path:
            continue
        if product.get("status") != "published":
            continue
        if theme.get("categories") and product.get("categoryId") not in theme["categories"]:
            continue
        if theme.get("max_price") and int(product.get("price", 10**9)) > int(theme["max_price"]):
            continue
        products.append(
            {
                "title": clean_title(product.get("name", "Produit Maxi Trouvailles")),
                "price": money(int(product.get("price", 0))),
                "tag": product_tag(product),
                "image": path,
                "slug": product.get("slug", ""),
            }
        )
    if len(products) < 4:
        return load_products({k: v for k, v in theme.items() if k not in {"categories", "max_price"}})
    return products


def next_theme() -> tuple[dict, int]:
    state = read_state()
    index = int(state.get("index", 0))
    theme = THEMES[index % len(THEMES)]
    state["index"] = index + 1
    state["last_theme"] = theme["id"]
    state["last_run"] = datetime.now().isoformat(timespec="seconds")
    write_state(state)
    return theme, index


def env_key() -> str:
    env_path = REPO / ".env.local"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            if line.strip().startswith("ELEVENLABS_API_KEY="):
                return line.split("=", 1)[1].strip()
    return os.environ.get("ELEVENLABS_API_KEY", "").strip()


def generate_voice(script: str, mp3_path: Path) -> None:
    if os.environ.get("MAXI_TIKTOK_OFFLINE_VOICE", "").strip().lower() in {"1", "true", "yes"}:
        mp3_path.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-f",
                "lavfi",
                "-i",
                "anullsrc=r=44100:cl=stereo",
                "-t",
                "20",
                "-q:a",
                "6",
                str(mp3_path),
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return
    key = env_key()
    if not key:
        raise RuntimeError("ELEVENLABS_API_KEY introuvable")
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
            mp3_path.write_bytes(response.read())
    except Exception:
        mp3_path.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-f",
                "lavfi",
                "-i",
                "anullsrc=r=44100:cl=stereo",
                "-t",
                "20",
                "-q:a",
                "6",
                str(mp3_path),
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )


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
    draw.text(((W - box[2] + box[0]) // 2, y), text, font=font, fill=fill, stroke_width=stroke, stroke_fill=(24, 24, 24))


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


def gradient(t: float) -> Image.Image:
    top = np.array([8, 91, 86], dtype=np.float32)
    mid = np.array([246, 189, 53], dtype=np.float32)
    bottom = np.array([245, 248, 244], dtype=np.float32)
    arr = np.zeros((H, W, 3), dtype=np.uint8)
    for y in range(H):
        r = y / H
        wave = 0.03 * math.sin((y / 150) + t * 0.8)
        if r < 0.56:
            m = max(0, min(1, r / 0.56 + wave))
            color = top * (1 - m) + mid * m
        else:
            m = max(0, min(1, (r - 0.56) / 0.44 + wave))
            color = mid * (1 - m) + bottom * m
        arr[y, :, :] = color.astype(np.uint8)
    return Image.fromarray(arr)


def draw_product(base: Image.Image, draw: ImageDraw.ImageDraw, product: dict, image: Image.Image, y_shift: int, fonts: dict, t: float) -> None:
    rounded_shadow(base, (105, 470, W - 105, 1300), radius=52, alpha=120)
    draw.rounded_rectangle((105, 470, W - 105, 1300), radius=52, fill=(255, 255, 255, 246))
    pic = cover(image, (820, 575))
    mask = Image.new("L", pic.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, pic.size[0], pic.size[1]), radius=42, fill=255)
    base.paste(pic, (130, 520 + y_shift), mask)
    draw.rounded_rectangle((150, 1145, 930, 1248), radius=34, fill=(16, 117, 109, 246))
    center(draw, product["tag"], 1172, fonts["mid"], (255, 255, 255))
    presenter(draw, t)


def render_video(theme: dict, selected: list[dict], paths: dict) -> None:
    script = theme["spoken"]
    paths["script"].write_text(script, encoding="utf-8")
    paths["caption"].write_text(theme["caption"], encoding="utf-8")
    generate_voice(script, paths["voice"])
    voice = AudioFileClip(str(paths["voice"]))
    duration = min(24.0, max(18.0, voice.duration + 0.5))
    voice = voice.subclipped(0, min(voice.duration, duration - 0.25)).with_start(0.2)
    images = [Image.open(p["image"]).convert("RGB") for p in selected]

    fonts = {
        "title": ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 86),
        "huge": ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 94),
        "big": ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 66),
        "mid": ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 48),
        "small": ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 36),
        "small_bold": ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 38),
        "price": ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 64),
    }

    def make_frame(t: float) -> np.ndarray:
        base = gradient(t)
        draw = ImageDraw.Draw(base, "RGBA")
        for i in range(6):
            y = int((t * 120 + i * 330) % (H + 170)) - 170
            draw.rounded_rectangle((-120, y, W + 120, y + 60), radius=30, fill=(255, 255, 255, 23))

        draw.rounded_rectangle((70, 80, W - 70, 172), radius=42, fill=(255, 255, 255, 238))
        center(draw, "MAXI TROUVAILLES", 102, fonts["mid"], (12, 92, 84))

        if t < 3.6:
            center(draw, theme["hook1"], 270, fonts["title"], (255, 255, 255), stroke=3)
            center(draw, theme["hook2"], 370, fonts["huge"], (255, 225, 77), stroke=4)
            if theme["id"] == "palette":
                palette(draw, t, 980)
            else:
                presenter(draw, t)
                draw.rounded_rectangle((260, 1240, W - 80, 1515), radius=46, fill=(255, 255, 255, 236))
                draw.text((310, 1295), "Bonnes affaires", font=fonts["big"], fill=(25, 25, 25, 255))
                draw.text((310, 1390), "selon arrivage", font=fonts["big"], fill=(15, 116, 108, 255))
        elif t < 17.8:
            idx = min(3, int((t - 3.6) / 3.55))
            product = selected[idx]
            center(draw, product["title"], 260, fonts["big"], (255, 255, 255), stroke=3)
            center(draw, product["price"], 345, fonts["price"], (255, 225, 77), stroke=4)
            draw_product(base, draw, product, images[idx], int(7 * math.sin(t * 2.2)), fonts, t)
        else:
            center(draw, "Va voir", 255, fonts["title"], (255, 255, 255), stroke=3)
            center(draw, "avant que ça parte", 355, fonts["title"], (255, 225, 77), stroke=4)
            x_positions = [75, 555, 75, 555]
            y_positions = [590, 590, 1135, 1135]
            for i, product in enumerate(selected):
                x, y = x_positions[i], y_positions[i]
                rounded_shadow(base, (x, y, x + 450, y + 500), radius=34, alpha=90)
                draw.rounded_rectangle((x, y, x + 450, y + 500), radius=34, fill=(255, 255, 255, 245))
                pic = cover(images[i], (400, 295))
                mask = Image.new("L", pic.size, 0)
                ImageDraw.Draw(mask).rounded_rectangle((0, 0, 400, 295), radius=28, fill=255)
                base.paste(pic, (x + 25, y + 25), mask)
                draw.text((x + 28, y + 344), product["title"], font=fonts["small_bold"], fill=(28, 28, 28, 255))
                draw.rounded_rectangle((x + 268, y + 420, x + 420, y + 476), radius=20, fill=(255, 221, 70, 255))
                draw.text((x + 300, y + 430), product["price"], font=fonts["small_bold"], fill=(25, 25, 25, 255))

        draw.rounded_rectangle((80, 1745, W - 80, 1830), radius=36, fill=(15, 15, 15, 95))
        center(draw, "maxitrouvaille.fr", 1764, fonts["mid"], (255, 255, 255))
        return np.array(base)

    Image.fromarray(make_frame(1.0)).save(paths["preview"], quality=92)
    clip = VideoClip(make_frame, duration=duration).with_fps(FPS).with_audio(voice)
    clip.write_videofile(str(paths["video"]), fps=FPS, codec="libx264", audio_codec="aac", preset="medium", bitrate="5400k", logger=None)


def main() -> None:
    theme, index = next_theme()
    products = load_products(theme)
    random.seed(datetime.now().strftime("%Y%m%d%H") + theme["id"])
    selected = random.sample(products, 4)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    base = TIKTOK / f"maxi_{stamp}_{theme['id']}"
    paths = {
        "video": base.with_suffix(".mp4"),
        "voice": base.with_name(base.name + "_voice.mp3"),
        "script": base.with_name(base.name + "_script.txt"),
        "caption": base.with_name(base.name + "_caption.txt"),
        "preview": base.with_name(base.name + "_preview.jpg"),
    }
    render_video(theme, selected, paths)
    manifest = {
        "createdAt": datetime.now().isoformat(timespec="seconds"),
        "theme": theme["id"],
        "video": str(paths["video"]),
        "voice": str(paths["voice"]),
        "script": str(paths["script"]),
        "captionFile": str(paths["caption"]),
        "caption": theme["caption"],
        "preview": str(paths["preview"]),
        "products": [{k: str(v) for k, v in product.items()} for product in selected],
        "publishStatus": "ready",
    }
    manifest_path = base.with_name(base.name + "_manifest.json")
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    LATEST_MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"manifest": str(manifest_path), "latest": str(LATEST_MANIFEST), "video": str(paths["video"])}, ensure_ascii=False))


if __name__ == "__main__":
    main()
