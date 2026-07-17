from pathlib import Path
import math
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from moviepy import AudioArrayClip, VideoClip

DESKTOP = Path.home() / "Desktop"
REPO = DESKTOP / "maxi-trouvaille"
OUT = DESKTOP / "TIKTOK" / "video_ready.mp4"
OUT.parent.mkdir(parents=True, exist_ok=True)

image_dir = REPO / "public" / "uploads" / "generated-products"
images = list(image_dir.glob("*.webp"))[:10]
if not images:
    raise SystemExit("Aucune image produit trouvee")

W, H = 1080, 1920
DURATION = 15
FPS = 24
random.seed(7)

font_bold_path = Path("C:/Windows/Fonts/arialbd.ttf")
font_regular_path = Path("C:/Windows/Fonts/arial.ttf")
font_heavy = ImageFont.truetype(str(font_bold_path), 92)
font_title = ImageFont.truetype(str(font_bold_path), 76)
font_mid = ImageFont.truetype(str(font_bold_path), 58)
font_small = ImageFont.truetype(str(font_regular_path), 40)
font_url = ImageFont.truetype(str(font_bold_path), 46)

palette = [
    ((10, 116, 113), (255, 190, 55)),
    ((28, 36, 46), (255, 111, 75)),
    ((22, 101, 52), (246, 199, 82)),
    ((33, 33, 33), (20, 184, 166)),
]
scenes = [
    ("Regarde ce que", "j'ai trouvé", "Arrivages déstockage"),
    ("Produits Amazon", "jusqu'à -50%", "Retours clients • fins de série"),
    ("Prix cassés", "bonnes affaires", "Stock limité"),
    ("Disponible sur", "maxitrouvaille.fr", "À commander maintenant"),
]

loaded = []
for p in images:
    im = Image.open(p).convert("RGB")
    loaded.append(im)


def cover_resize(im, size):
    tw, th = size
    iw, ih = im.size
    scale = max(tw / iw, th / ih)
    nw, nh = int(iw * scale), int(ih * scale)
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - tw) // 2
    top = (nh - th) // 2
    return im.crop((left, top, left + tw, top + th))


def draw_center(draw, text, y, font, fill, stroke=0):
    box = draw.textbbox((0, 0), text, font=font, stroke_width=stroke)
    x = (W - (box[2] - box[0])) // 2
    draw.text((x, y), text, font=font, fill=fill, stroke_width=stroke, stroke_fill=(20, 20, 20))


def rounded_panel(draw, xy, radius=36, fill=(255, 255, 255, 230), outline=None):
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=4 if outline else 1)


def gradient(c1, c2):
    arr = np.zeros((H, W, 3), dtype=np.uint8)
    for y in range(H):
        ratio = y / H
        wave = 0.06 * math.sin((y / H) * math.pi * 3)
        r = min(1, max(0, ratio + wave))
        arr[y, :, :] = [int(c1[i] * (1 - r) + c2[i] * r) for i in range(3)]
    return Image.fromarray(arr)

backgrounds = [gradient(*colors) for colors in palette]


def make_frame(t):
    scene_idx = min(int(t / (DURATION / len(scenes))), len(scenes) - 1)
    line1, line2, sub = scenes[scene_idx]
    base = backgrounds[scene_idx].copy().filter(ImageFilter.GaussianBlur(0.3))
    draw = ImageDraw.Draw(base, "RGBA")

    # Moving light bands
    for i in range(5):
        y = int(((t * 115) + i * 430) % (H + 240)) - 240
        draw.rounded_rectangle((-140, y, W + 140, y + 74), radius=38, fill=(255, 255, 255, 20))

    # Product card animation
    product = loaded[int(t * 0.75) % len(loaded)]
    zoom = 1 + 0.04 * math.sin(t * 2.1)
    card_w, card_h = int(760 * zoom), int(760 * zoom)
    prod = cover_resize(product, (card_w, card_h))
    angle = 3.5 * math.sin(t * 1.6)
    prod = prod.rotate(angle, expand=True, resample=Image.Resampling.BICUBIC)
    shadow = Image.new("RGBA", prod.size, (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow)
    sdraw.rounded_rectangle((20, 20, prod.size[0] - 20, prod.size[1] - 20), radius=46, fill=(0, 0, 0, 120))
    shadow = shadow.filter(ImageFilter.GaussianBlur(28))
    px = (W - prod.size[0]) // 2
    py = 510 + int(26 * math.sin(t * 2.4))
    base.paste(shadow, (px + 8, py + 18), shadow)
    mask = Image.new("L", prod.size, 0)
    mdraw = ImageDraw.Draw(mask)
    mdraw.rounded_rectangle((0, 0, prod.size[0], prod.size[1]), radius=56, fill=255)
    base.paste(prod, (px, py), mask)

    # Text
    draw_center(draw, line1, 135, font_title, (255, 255, 255), stroke=3)
    draw_center(draw, line2, 222, font_heavy, (255, 223, 83), stroke=4)
    rounded_panel(draw, (90, 390, W - 90, 468), radius=34, fill=(255, 255, 255, 235))
    draw_center(draw, sub, 405, font_small, (25, 25, 25))

    # Price badges
    pulse = int(8 * math.sin(t * 8))
    rounded_panel(draw, (120, 1305 - pulse, W - 120, 1418 - pulse), radius=44, fill=(255, 255, 255, 242))
    draw_center(draw, "DESTOCKAGE", 1323 - pulse, font_mid, (10, 116, 113))
    rounded_panel(draw, (220, 1445 + pulse, W - 220, 1546 + pulse), radius=42, fill=(255, 223, 83, 245))
    draw_center(draw, "PRIX CASSES", 1462 + pulse, font_mid, (31, 31, 31))

    draw_center(draw, "maxitrouvaille.fr", 1708, font_url, (255, 255, 255), stroke=3)
    draw_center(draw, "Colis perdus • retours clients • fins de série", 1782, font_small, (255, 255, 255), stroke=2)

    return np.array(base)

# Simple upbeat synthetic audio bed.
sr = 44100
samples = int(DURATION * sr)
time = np.arange(samples) / sr
audio = np.zeros(samples, dtype=np.float32)
for beat in np.arange(0, DURATION, 0.5):
    start = int(beat * sr)
    end = min(samples, start + int(0.13 * sr))
    env = np.linspace(1, 0, end - start, dtype=np.float32)
    freq = 150 if int(beat * 2) % 2 == 0 else 220
    audio[start:end] += 0.16 * np.sin(2 * np.pi * freq * time[: end - start]) * env
for beat in np.arange(0.25, DURATION, 1.0):
    start = int(beat * sr)
    end = min(samples, start + int(0.08 * sr))
    env = np.linspace(1, 0, end - start, dtype=np.float32)
    audio[start:end] += 0.08 * np.sin(2 * np.pi * 880 * time[: end - start]) * env
audio = np.clip(audio, -0.6, 0.6).reshape(-1, 1)

audio_clip = AudioArrayClip(audio, fps=sr)
clip = VideoClip(make_frame, duration=DURATION).with_fps(FPS).with_audio(audio_clip)
clip.write_videofile(str(OUT), fps=FPS, codec="libx264", audio_codec="aac", preset="medium", bitrate="4500k", logger=None)
print(OUT)
