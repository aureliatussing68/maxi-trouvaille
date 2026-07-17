from pathlib import Path
import json
import math
import os
import urllib.request

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from moviepy import AudioFileClip, VideoClip


DESKTOP = Path.home() / "Desktop"
REPO = DESKTOP / "maxi-trouvaille"
TIKTOK = DESKTOP / "TIKTOK"
TIKTOK.mkdir(parents=True, exist_ok=True)

OUT = TIKTOK / "video_selection_maxi_trouvailles.mp4"
VOICE_MP3 = TIKTOK / "voiceover_selection_maxi_trouvailles.mp3"
SCRIPT_TXT = TIKTOK / "script_selection_voix.txt"
PREVIEW = TIKTOK / "video_selection_preview.jpg"

VOICE_ID = "IKne3meq5aSn9XLyUdCD"
SCRIPT = (
    "Petit tour rapide chez Maxi Trouvailles. "
    "Aujourd'hui, je te montre quatre bonnes affaires simples et utiles. "
    "Un ventilateur tour de cou rechargeable, une double prise avec ports USB, "
    "un filtre de douche chromé, et un accoudoir auto avec rangement. "
    "Ce sont des produits de déstockage, retours clients ou fins de série, "
    "avec des prix cassés selon les arrivages. "
    "Va voir les disponibilités sur maxitrouvaille.fr."
)
SCRIPT_TXT.write_text(SCRIPT, encoding="utf-8")

PRODUCTS = [
    {
        "title": "Ventilateur tour de cou",
        "price": "15 €",
        "tag": "Recharge USB",
        "image": "ventilateur-tour-de-cou.webp",
    },
    {
        "title": "Double prise + USB",
        "price": "15 €",
        "tag": "Maison pratique",
        "image": "double-prise-usb.webp",
    },
    {
        "title": "Filtre de douche",
        "price": "19 €",
        "tag": "Salle de bain",
        "image": "filtre-douche-chrome.webp",
    },
    {
        "title": "Accoudoir voiture",
        "price": "19 €",
        "tag": "Auto confort",
        "image": "accoudoir-central-usb.webp",
    },
]


def env_key():
    env_path = REPO / ".env.local"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            if line.strip().startswith("ELEVENLABS_API_KEY="):
                return line.split("=", 1)[1].strip()
    return os.environ.get("ELEVENLABS_API_KEY", "").strip()


def generate_voice():
    key = env_key()
    if not key:
        raise RuntimeError("ELEVENLABS_API_KEY introuvable")
    payload = {
        "text": SCRIPT,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {
            "stability": 0.42,
            "similarity_boost": 0.82,
            "style": 0.52,
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
    with urllib.request.urlopen(req, timeout=90) as response:
        VOICE_MP3.write_bytes(response.read())


generate_voice()
voice = AudioFileClip(str(VOICE_MP3))
DURATION = min(24.0, max(17.0, voice.duration + 0.5))
voice = voice.subclipped(0, min(voice.duration, DURATION - 0.25)).with_start(0.2)

W, H = 1080, 1920
FPS = 24
IMG_DIR = REPO / "public" / "uploads" / "generated-products"
images = [Image.open(IMG_DIR / p["image"]).convert("RGB") for p in PRODUCTS]

font_title = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 88)
font_big = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 68)
font_mid = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 48)
font_small = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 36)
font_small_bold = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 38)
font_price = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 62)


def cover(im, size):
    tw, th = size
    iw, ih = im.size
    scale = max(tw / iw, th / ih)
    im = im.resize((int(iw * scale), int(ih * scale)), Image.Resampling.LANCZOS)
    x = (im.size[0] - tw) // 2
    y = (im.size[1] - th) // 2
    return im.crop((x, y, x + tw, y + th))


def center(draw, text, y, font, fill, stroke=0):
    box = draw.textbbox((0, 0), text, font=font, stroke_width=stroke)
    draw.text(((W - box[2] + box[0]) // 2, y), text, font=font, fill=fill, stroke_width=stroke, stroke_fill=(22, 22, 22))


def bg(t):
    top = np.array([8, 91, 86], dtype=np.float32)
    mid = np.array([242, 190, 58], dtype=np.float32)
    bottom = np.array([245, 248, 244], dtype=np.float32)
    arr = np.zeros((H, W, 3), dtype=np.uint8)
    for y in range(H):
        r = y / H
        wave = 0.035 * math.sin((y / 145) + t * 0.9)
        if r < 0.58:
            m = max(0, min(1, r / 0.58 + wave))
            color = top * (1 - m) + mid * m
        else:
            m = max(0, min(1, (r - 0.58) / 0.42 + wave))
            color = mid * (1 - m) + bottom * m
        arr[y, :, :] = color.astype(np.uint8)
    return Image.fromarray(arr)


def shadow_card(base, box, radius=42, alpha=120):
    x1, y1, x2, y2 = box
    sh = Image.new("RGBA", (x2 - x1 + 70, y2 - y1 + 70), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    sd.rounded_rectangle((35, 35, x2 - x1 + 35, y2 - y1 + 35), radius=radius, fill=(0, 0, 0, alpha))
    sh = sh.filter(ImageFilter.GaussianBlur(22))
    base.paste(sh, (x1 - 25, y1 - 15), sh)


def draw_presenter(draw, t):
    cx, cy = 170, 1470
    draw.ellipse((cx - 70, cy - 310, cx + 70, cy - 170), fill=(238, 199, 165, 255), outline=(30, 30, 30, 50), width=3)
    draw.arc((cx - 45, cy - 265, cx - 8, cy - 230), 200, 340, fill=(35, 35, 35, 255), width=4)
    draw.arc((cx + 8, cy - 265, cx + 45, cy - 230), 200, 340, fill=(35, 35, 35, 255), width=4)
    mouth = 8 + int(5 * abs(math.sin(t * 8)))
    draw.ellipse((cx - 22, cy - 220, cx + 22, cy - 220 + mouth), fill=(80, 35, 35, 255))
    draw.rounded_rectangle((cx - 100, cy - 165, cx + 100, cy + 75), radius=56, fill=(20, 126, 116, 255))
    draw.rounded_rectangle((cx + 120, cy - 92, cx + 185, cy + 100), radius=28, fill=(42, 42, 42, 255))
    draw.ellipse((cx + 104, cy - 115, cx + 201, cy - 18), fill=(32, 32, 32, 255))
    draw.line((cx + 150, cy + 100, cx + 150, cy + 185), fill=(55, 55, 55, 255), width=8)
    draw.arc((cx + 105, cy + 125, cx + 195, cy + 220), 0, 180, fill=(55, 55, 55, 255), width=8)


def product_card(base, draw, i, x, y, w, h, t):
    p = PRODUCTS[i]
    shadow_card(base, (x, y, x + w, y + h), radius=34, alpha=100)
    draw.rounded_rectangle((x, y, x + w, y + h), radius=34, fill=(255, 255, 255, 246))
    pic = cover(images[i], (w - 50, 300))
    mask = Image.new("L", pic.size, 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle((0, 0, pic.size[0], pic.size[1]), radius=26, fill=255)
    base.paste(pic, (x + 25, y + 25 + int(4 * math.sin(t * 2 + i))), mask)
    draw.text((x + 30, y + 350), p["tag"], font=font_small, fill=(15, 116, 108, 255))
    draw.text((x + 30, y + 396), p["title"], font=font_small_bold, fill=(32, 32, 32, 255))
    draw.rounded_rectangle((x + w - 190, y + h - 82, x + w - 30, y + h - 25), radius=22, fill=(255, 221, 70, 255))
    draw.text((x + w - 155, y + h - 76), p["price"], font=font_small_bold, fill=(25, 25, 25, 255))


def make_frame(t):
    base = bg(t)
    draw = ImageDraw.Draw(base, "RGBA")
    for i in range(6):
        y = int((t * 130 + i * 330) % (H + 170)) - 170
        draw.rounded_rectangle((-120, y, W + 120, y + 60), radius=30, fill=(255, 255, 255, 24))

    draw.rounded_rectangle((70, 80, W - 70, 172), radius=42, fill=(255, 255, 255, 238))
    center(draw, "MAXI TROUVAILLES", 102, font_mid, (12, 92, 84))

    if t < 4.0:
        center(draw, "Sélection", 285, font_title, (255, 255, 255), stroke=3)
        center(draw, "petits prix", 390, font_title, (255, 225, 77), stroke=4)
        draw_presenter(draw, t)
        draw.rounded_rectangle((260, 1240, W - 80, 1515), radius=46, fill=(255, 255, 255, 236))
        draw.text((310, 1300), "4 articles utiles", font=font_big, fill=(25, 25, 25, 255))
        draw.text((310, 1395), "à prix cassés", font=font_big, fill=(15, 116, 108, 255))
    elif t < 18.2:
        idx = min(3, int((t - 4.0) / 3.55))
        p = PRODUCTS[idx]
        center(draw, p["title"], 270, font_big, (255, 255, 255), stroke=3)
        center(draw, p["price"], 350, font_price, (255, 225, 77), stroke=4)
        shadow_card(base, (105, 470, W - 105, 1295), radius=52, alpha=120)
        draw.rounded_rectangle((105, 470, W - 105, 1295), radius=52, fill=(255, 255, 255, 245))
        pic = cover(images[idx], (820, 570))
        mask = Image.new("L", pic.size, 0)
        md = ImageDraw.Draw(mask)
        md.rounded_rectangle((0, 0, pic.size[0], pic.size[1]), radius=42, fill=255)
        base.paste(pic, (130, 520), mask)
        draw.rounded_rectangle((150, 1135, 930, 1235), radius=34, fill=(16, 117, 109, 245))
        center(draw, p["tag"], 1160, font_mid, (255, 255, 255))
        draw_presenter(draw, t)
    else:
        center(draw, "Arrivages", 300, font_title, (255, 255, 255), stroke=3)
        center(draw, "selon stock", 405, font_title, (255, 225, 77), stroke=4)
        product_card(base, draw, 0, 80, 600, 440, 515, t)
        product_card(base, draw, 1, 560, 600, 440, 515, t)
        product_card(base, draw, 2, 80, 1160, 440, 515, t)
        product_card(base, draw, 3, 560, 1160, 440, 515, t)

    draw.rounded_rectangle((80, 1745, W - 80, 1830), radius=36, fill=(15, 15, 15, 95))
    center(draw, "maxitrouvaille.fr", 1764, font_mid, (255, 255, 255))
    return np.array(base)


Image.fromarray(make_frame(1.0)).save(PREVIEW, quality=92)
clip = VideoClip(make_frame, duration=DURATION).with_fps(FPS).with_audio(voice)
clip.write_videofile(str(OUT), fps=FPS, codec="libx264", audio_codec="aac", preset="medium", bitrate="5200k", logger=None)
print(str(OUT))
