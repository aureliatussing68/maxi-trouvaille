from pathlib import Path
import json
import math
import os
import textwrap
import urllib.request

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from moviepy import AudioFileClip, VideoClip


DESKTOP = Path.home() / "Desktop"
REPO = DESKTOP / "maxi-trouvaille"
TIKTOK = DESKTOP / "TIKTOK"
TIKTOK.mkdir(parents=True, exist_ok=True)

OUT = TIKTOK / "video_palette_maxi_trouvailles.mp4"
VOICE_MP3 = TIKTOK / "voiceover_palette_maxi_trouvailles.mp3"
SCRIPT_TXT = TIKTOK / "script_palette_voix.txt"
THUMB = TIKTOK / "video_palette_preview.jpg"

VOICE_ID = "IKne3meq5aSn9XLyUdCD"
SCRIPT = (
    "Aujourd'hui, on ouvre une palette de bonnes affaires Maxi Trouvailles. "
    "Pas de colis surprise, ici on montre des articles utiles, simples, et à prix cassés. "
    "Raquettes, éclairage, filtre de robinet, accessoires auto et petits équipements maison. "
    "Les produits viennent du déstockage, des retours clients ou des fins de série. "
    "Regarde les arrivages sur maxitrouvaille.fr."
)
SCRIPT_TXT.write_text(SCRIPT, encoding="utf-8")

PRODUCTS = [
    {
        "title": "Ventilateur USB",
        "price": "15 €",
        "category": "High-tech",
        "image": "ventilateur-tour-de-cou.webp",
    },
    {
        "title": "Raquettes tennis",
        "price": "25 €",
        "category": "Sport",
        "image": "../quick-products/1777647119070-d0z5fg5.webp",
    },
    {
        "title": "Filtre robinet",
        "price": "18 €",
        "category": "Maison",
        "image": "../quick-products/1777965396342-hr1jm1t.webp",
    },
    {
        "title": "Plafonnier LED",
        "price": "12 €",
        "category": "Maison",
        "image": "../quick-products/1777965323267-sj5aeyb.webp",
    },
]


def read_env_key():
    env_path = REPO / ".env.local"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            if line.strip().startswith("ELEVENLABS_API_KEY="):
                return line.split("=", 1)[1].strip()
    return os.environ.get("ELEVENLABS_API_KEY", "").strip()


def generate_voice():
    api_key = read_env_key()
    if not api_key:
        raise RuntimeError("ELEVENLABS_API_KEY introuvable")
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"
    payload = {
        "text": SCRIPT,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {
            "stability": 0.43,
            "similarity_boost": 0.8,
            "style": 0.45,
            "use_speaker_boost": True,
        },
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "xi-api-key": api_key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=90) as response:
        VOICE_MP3.write_bytes(response.read())


generate_voice()
voice_clip = AudioFileClip(str(VOICE_MP3))
DURATION = min(22.0, max(16.0, voice_clip.duration + 0.5))
voice_clip = voice_clip.subclipped(0, min(voice_clip.duration, DURATION - 0.25)).with_start(0.2)

W, H = 1080, 1920
FPS = 24
IMG_DIR = REPO / "public" / "uploads" / "generated-products"
product_images = []
for product in PRODUCTS:
    img_path = (IMG_DIR / product["image"]).resolve()
    product_images.append(Image.open(img_path).convert("RGB"))

font_huge = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 96)
font_big = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 76)
font_mid = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 54)
font_small = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 40)
font_small_bold = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 40)
font_tiny = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 32)


def cover_resize(im, size):
    tw, th = size
    iw, ih = im.size
    scale = max(tw / iw, th / ih)
    resized = im.resize((int(iw * scale), int(ih * scale)), Image.Resampling.LANCZOS)
    left = (resized.size[0] - tw) // 2
    top = (resized.size[1] - th) // 2
    return resized.crop((left, top, left + tw, top + th))


def text_center(draw, text, y, font, fill, stroke=0):
    box = draw.textbbox((0, 0), text, font=font, stroke_width=stroke)
    x = (W - (box[2] - box[0])) // 2
    draw.text((x, y), text, font=font, fill=fill, stroke_width=stroke, stroke_fill=(28, 28, 28))


def wrap_text(draw, text, font, max_width):
    words = text.split()
    lines = []
    current = ""
    for word in words:
        test = f"{current} {word}".strip()
        if draw.textbbox((0, 0), test, font=font)[2] <= max_width:
            current = test
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def gradient_bg(t):
    top = np.array([11, 96, 88], dtype=np.float32)
    bottom = np.array([246, 188, 55], dtype=np.float32)
    if t > 12.5:
        top = np.array([31, 37, 51], dtype=np.float32)
        bottom = np.array([10, 158, 145], dtype=np.float32)
    arr = np.zeros((H, W, 3), dtype=np.uint8)
    for y in range(H):
        r = y / H
        wave = math.sin(t * 0.65 + y / 190) * 0.025
        mix = min(1, max(0, r + wave))
        arr[y, :, :] = (top * (1 - mix) + bottom * mix).astype(np.uint8)
    return Image.fromarray(arr)


def rounded_shadow(base, box, radius=38, shadow_alpha=110):
    x1, y1, x2, y2 = box
    shadow = Image.new("RGBA", (x2 - x1 + 80, y2 - y1 + 80), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle((40, 40, x2 - x1 + 40, y2 - y1 + 40), radius=radius, fill=(0, 0, 0, shadow_alpha))
    shadow = shadow.filter(ImageFilter.GaussianBlur(24))
    base.paste(shadow, (x1 - 30, y1 - 22), shadow)


def draw_palette(draw, t):
    base_y = 1060 + int(10 * math.sin(t * 2))
    wood = (128, 81, 39, 255)
    dark = (86, 55, 31, 255)
    for i in range(3):
        draw.rounded_rectangle((190 + i * 235, base_y + 220, 370 + i * 235, base_y + 265), radius=12, fill=wood)
    draw.rounded_rectangle((150, base_y + 170, 930, base_y + 220), radius=12, fill=dark)
    draw.rounded_rectangle((145, base_y + 130, 935, base_y + 175), radius=12, fill=wood)
    box_colors = [(224, 154, 69, 255), (237, 182, 89, 255), (211, 133, 62, 255)]
    boxes = [
        (210, base_y - 30, 430, base_y + 135),
        (430, base_y - 70, 660, base_y + 135),
        (660, base_y - 20, 870, base_y + 135),
        (300, base_y - 205, 550, base_y - 60),
        (545, base_y - 205, 805, base_y - 60),
    ]
    for idx, box in enumerate(boxes):
        draw.rounded_rectangle(box, radius=18, fill=box_colors[idx % len(box_colors)], outline=(101, 65, 34, 255), width=4)
        x1, y1, x2, y2 = box
        draw.line((x1 + 30, y1 + 18, x2 - 30, y1 + 18), fill=(255, 226, 166, 170), width=3)


def draw_product_card(base, draw, idx, t):
    product = PRODUCTS[idx]
    im = product_images[idx]
    x = 115
    y = 520
    w = 850
    h = 840
    rounded_shadow(base, (x, y, x + w, y + h), radius=48, shadow_alpha=120)
    draw.rounded_rectangle((x, y, x + w, y + h), radius=48, fill=(255, 255, 255, 244))

    pic = cover_resize(im, (720, 485))
    mask = Image.new("L", pic.size, 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle((0, 0, pic.size[0], pic.size[1]), radius=38, fill=255)
    px = x + 65
    py = y + 65 + int(8 * math.sin(t * 2.3))
    base.paste(pic, (px, py), mask)

    draw.text((x + 65, y + 585), product["category"].upper(), font=font_tiny, fill=(18, 126, 114))
    draw.text((x + 65, y + 628), product["title"], font=font_mid, fill=(31, 31, 31))
    draw.rounded_rectangle((x + 65, y + 712, x + 315, y + 790), radius=28, fill=(255, 218, 66, 255))
    draw.text((x + 96, y + 728), product["price"], font=font_small_bold, fill=(25, 25, 25))
    draw.text((x + 350, y + 728), "selon arrivage", font=font_small, fill=(86, 86, 86))


def make_frame(t):
    base = gradient_bg(t)
    draw = ImageDraw.Draw(base, "RGBA")

    for i in range(8):
        y = int((t * 118 + i * 300) % (H + 200)) - 200
        draw.rounded_rectangle((-140, y, W + 140, y + 58), radius=28, fill=(255, 255, 255, 18))

    draw.rounded_rectangle((70, 80, W - 70, 182), radius=44, fill=(255, 255, 255, 235))
    text_center(draw, "MAXI TROUVAILLES", 103, font_mid, (17, 95, 88))

    if t < 4.4:
        text_center(draw, "Une palette", 265, font_big, (255, 255, 255), stroke=3)
        text_center(draw, "de bonnes affaires", 350, font_huge, (255, 224, 72), stroke=4)
        draw_palette(draw, t)
        card_text = "Déstockage, retours clients, fins de série"
        draw.rounded_rectangle((95, 1428, W - 95, 1562), radius=42, fill=(255, 255, 255, 235))
        text_center(draw, card_text, 1470, font_small_bold, (34, 34, 34))
    elif t < 17.2:
        idx = min(3, int((t - 4.4) / 3.2))
        draw_product_card(base, draw, idx, t)
    else:
        text_center(draw, "Disponible", 430, font_huge, (255, 255, 255), stroke=4)
        text_center(draw, "maintenant", 535, font_huge, (255, 224, 72), stroke=4)
        draw.rounded_rectangle((105, 760, W - 105, 940), radius=54, fill=(255, 255, 255, 242))
        text_center(draw, "maxitrouvaille.fr", 812, font_big, (17, 95, 88))
        draw_palette(draw, t)

    bottom = "Prix cassés - stock limité - produits à vérifier selon annonce"
    draw.rounded_rectangle((70, 1678, W - 70, 1756), radius=32, fill=(0, 0, 0, 92))
    text_center(draw, bottom, 1698, font_tiny, (255, 255, 255))
    return np.array(base)


first_frame = Image.fromarray(make_frame(0.4))
first_frame.save(THUMB, quality=92)

clip = VideoClip(make_frame, duration=DURATION).with_fps(FPS).with_audio(voice_clip)
clip.write_videofile(
    str(OUT),
    fps=FPS,
    codec="libx264",
    audio_codec="aac",
    preset="medium",
    bitrate="5200k",
    logger=None,
)
print(str(OUT))
