from pathlib import Path
import json
import math
import os
import subprocess
import urllib.request

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from moviepy import AudioFileClip, VideoClip

DESKTOP = Path.home() / "Desktop"
REPO = DESKTOP / "maxi-trouvaille"
TIKTOK = DESKTOP / "TIKTOK"
TIKTOK.mkdir(parents=True, exist_ok=True)
OUT = TIKTOK / "video_ready_voice.mp4"
VOICE_MP3 = TIKTOK / "voiceover_maxi_trouvaille.mp3"
SCRIPT_TXT = TIKTOK / "script_voix.txt"

VOICE_ID = "IKne3meq5aSn9XLyUdCD"
SCRIPT = (
    "Regarde ce que j'ai trouvé aujourd'hui. "
    "Sur Maxi Trouvailles, il y a des produits de déstockage, "
    "des retours clients et des fins de série à prix cassés. "
    "Tu repères la bonne affaire, tu commandes, et tu profites d'un prix malin. "
    "Les arrivages sont disponibles sur maxitrouvaille.fr."
)
SCRIPT_TXT.write_text(SCRIPT, encoding="utf-8")


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
            "stability": 0.48,
            "similarity_boost": 0.78,
            "style": 0.32,
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
DURATION = min(20.0, max(12.0, voice_clip.duration + 0.6))
voice_clip = voice_clip.subclipped(0, min(voice_clip.duration, DURATION - 0.25)).with_start(0.25)

W, H = 1080, 1920
FPS = 24
image_dir = REPO / "public" / "uploads" / "generated-products"
image_paths = list(image_dir.glob("*.webp"))[:12]
if not image_paths:
    raise RuntimeError("Images produits introuvables")
images = [Image.open(p).convert("RGB") for p in image_paths]

font_bold = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 80)
font_big = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 96)
font_mid = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 56)
font_small = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 42)
font_url = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 48)

scenes = [
    (0.0, "Regarde ce que", "j'ai trouvé", "Arrivages de déstockage"),
    (4.2, "Retours clients", "fins de série", "Produits utiles à prix malin"),
    (8.5, "Prix cassés", "jusqu'à -50%", "Bonnes affaires en ligne"),
    (13.0, "Disponible sur", "maxitrouvaille.fr", "Stock limité selon arrivage"),
]


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
    draw.text((x, y), text, font=font, fill=fill, stroke_width=stroke, stroke_fill=(18, 18, 18))


def rounded(draw, xy, radius=36, fill=(255, 255, 255, 230), outline=None):
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=4 if outline else 1)


def scene_for(t):
    current = scenes[0]
    for scene in scenes:
        if t >= scene[0]:
            current = scene
    return current[1:]


def background(t):
    c1 = np.array([13, 116, 111], dtype=np.float32)
    c2 = np.array([255, 190, 55], dtype=np.float32)
    if t > 8.5:
        c1 = np.array([30, 35, 45], dtype=np.float32)
        c2 = np.array([20, 184, 166], dtype=np.float32)
    arr = np.zeros((H, W, 3), dtype=np.uint8)
    for y in range(H):
        r = y / H
        wave = 0.05 * math.sin((y / H) * math.pi * 4 + t * 0.5)
        mix = min(1, max(0, r + wave))
        arr[y, :, :] = (c1 * (1 - mix) + c2 * mix).astype(np.uint8)
    return Image.fromarray(arr)


def make_frame(t):
    base = background(t)
    draw = ImageDraw.Draw(base, "RGBA")

    for i in range(6):
        y = int(((t * 130) + i * 360) % (H + 220)) - 220
        draw.rounded_rectangle((-160, y, W + 160, y + 72), radius=36, fill=(255, 255, 255, 18))

    line1, line2, sub = scene_for(t)
    draw_center(draw, line1, 130, font_bold, (255, 255, 255), stroke=3)
    draw_center(draw, line2, 222, font_big, (255, 225, 80), stroke=4)
    rounded(draw, (90, 375, W - 90, 460), radius=34, fill=(255, 255, 255, 238))
    draw_center(draw, sub, 394, font_small, (26, 26, 26))

    product = images[int(t * 0.85) % len(images)]
    zoom = 1 + 0.055 * math.sin(t * 1.8)
    card_w = int(760 * zoom)
    card_h = int(760 * zoom)
    prod = cover_resize(product, (card_w, card_h))
    prod = prod.rotate(3.5 * math.sin(t * 1.35), expand=True, resample=Image.Resampling.BICUBIC)
    px = (W - prod.size[0]) // 2
    py = 535 + int(20 * math.sin(t * 2.1))
    shadow = Image.new("RGBA", prod.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle((16, 16, prod.size[0] - 16, prod.size[1] - 16), radius=56, fill=(0, 0, 0, 120))
    shadow = shadow.filter(ImageFilter.GaussianBlur(28))
    base.paste(shadow, (px + 8, py + 22), shadow)
    mask = Image.new("L", prod.size, 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle((0, 0, prod.size[0], prod.size[1]), radius=58, fill=255)
    base.paste(prod, (px, py), mask)

    # Caption strip, short and readable while voice speaks.
    if t < 4.2:
        caption = "Des arrivages utiles, simples, à petit prix"
    elif t < 8.5:
        caption = "Déstockage • retours clients • fins de série"
    elif t < 13.0:
        caption = "Prix cassés, souvent autour de -50%"
    else:
        caption = "Commande sur maxitrouvaille.fr"
    rounded(draw, (78, 1315, W - 78, 1428), radius=46, fill=(255, 255, 255, 242))
    draw_center(draw, caption, 1344, font_mid, (18, 95, 90))

    rounded(draw, (205, 1472, W - 205, 1572), radius=42, fill=(255, 224, 83, 246))
    draw_center(draw, "PRIX CASSES", 1490, font_mid, (31, 31, 31))
    draw_center(draw, "maxitrouvaille.fr", 1710, font_url, (255, 255, 255), stroke=3)
    draw_center(draw, "Nouveaux produits selon arrivage", 1785, font_small, (255, 255, 255), stroke=2)
    return np.array(base)

clip = VideoClip(make_frame, duration=DURATION).with_fps(FPS).with_audio(voice_clip)
clip.write_videofile(str(OUT), fps=FPS, codec="libx264", audio_codec="aac", preset="medium", bitrate="4700k", logger=None)
print(str(OUT))
