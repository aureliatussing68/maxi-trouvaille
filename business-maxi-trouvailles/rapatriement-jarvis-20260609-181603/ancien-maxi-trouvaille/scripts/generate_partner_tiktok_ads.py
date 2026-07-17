from __future__ import annotations

from datetime import datetime
from pathlib import Path
import json
import math
import textwrap

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from moviepy import AudioFileClip, VideoClip

from maxi_tiktok_factory import (
    FPS,
    H,
    REPO,
    TIKTOK,
    W,
    center,
    cover,
    generate_voice,
    gradient,
    presenter,
    rounded_shadow,
)


OUTPUT_DIR = TIKTOK / "partner_ads"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


ADS = [
    {
        "id": "mini_imprimante",
        "title": "Mini imprimante thermique Bluetooth",
        "short_title": "Mini imprimante",
        "price": "29,90 €",
        "image": "/uploads/partner-products/mini-imprimante-thermique.webp",
        "hook": "Imprime sans encre",
        "benefit": "notes, listes, étiquettes",
        "script": (
            "Regarde cette mini imprimante thermique Bluetooth. Pas besoin d'encre, "
            "elle est pratique pour les notes, les listes et les petites étiquettes. "
            "Produit neuf partenaire, disponible chez Maxi Trouvailles à vingt-neuf euros quatre-vingt-dix. "
            "Va voir sur maxitrouvaille.fr."
        ),
        "caption": (
            "Mini imprimante thermique Bluetooth à 29,90 € chez Maxi Trouvailles. "
            "Produit neuf partenaire, délai confirmé après commande. https://maxitrouvaille.fr "
            "#maxitrouvailles #bonplan #organisation #prixcasses"
        ),
    },
    {
        "id": "organisateur_cables",
        "title": "Organisateur de câbles et accessoires tech",
        "short_title": "Organisateur tech",
        "price": "12,90 €",
        "image": "/uploads/partner-products/organisateur-cables-voyage.webp",
        "hook": "Fini les câbles partout",
        "benefit": "chargeurs, écouteurs, voyage",
        "script": (
            "Si tes câbles traînent partout, voilà une petite trouvaille utile. "
            "Cette pochette range les chargeurs, écouteurs et accessoires tech en quelques secondes. "
            "Produit neuf partenaire chez Maxi Trouvailles, prix simple à douze euros quatre-vingt-dix. "
            "Disponible sur maxitrouvaille.fr."
        ),
        "caption": (
            "Organisateur de câbles et accessoires tech à 12,90 €. Simple, pratique, utile. "
            "https://maxitrouvaille.fr #maxitrouvailles #accessoires #bonplan #voyage"
        ),
    },
    {
        "id": "projecteur_galaxie",
        "title": "Projecteur galaxie LED pour ambiance",
        "short_title": "Projecteur galaxie",
        "price": "24,90 €",
        "image": "/uploads/partner-products/projecteur-galaxie-led.webp",
        "hook": "Ambiance galaxie",
        "benefit": "chambre, salon, idée cadeau",
        "script": (
            "Nouvelle trouvaille ambiance chez Maxi Trouvailles. "
            "Ce projecteur galaxie LED transforme une chambre ou un salon en coin détente. "
            "Une idée cadeau simple, produit neuf partenaire à vingt-quatre euros quatre-vingt-dix. "
            "Regarde sur maxitrouvaille.fr."
        ),
        "caption": (
            "Projecteur galaxie LED à 24,90 €. Ambiance chambre, salon ou cadeau. "
            "https://maxitrouvaille.fr #maxitrouvailles #deco #galaxie #bonnesaffaires"
        ),
    },
    {
        "id": "aspirateur_voiture",
        "title": "Mini aspirateur voiture sans fil",
        "short_title": "Aspirateur voiture",
        "price": "39,90 €",
        "image": "/uploads/partner-products/aspirateur-voiture-sans-fil.webp",
        "hook": "Voiture propre rapidement",
        "benefit": "miettes, poussière, sièges",
        "script": (
            "Pour nettoyer rapidement la voiture, regarde ce mini aspirateur sans fil. "
            "Il est fait pour les miettes, la poussière et les petits coins difficiles. "
            "Produit neuf partenaire chez Maxi Trouvailles, affiché à trente-neuf euros quatre-vingt-dix. "
            "Commande sur maxitrouvaille.fr."
        ),
        "caption": (
            "Mini aspirateur voiture sans fil à 39,90 €. Produit neuf partenaire chez Maxi Trouvailles. "
            "https://maxitrouvaille.fr #maxitrouvailles #auto #nettoyage #prixcasses"
        ),
    },
]


def image_path(raw: str) -> Path:
    return (REPO / "public" / raw.lstrip("/")).resolve()


def draw_wrapped(
    draw: ImageDraw.ImageDraw,
    text: str,
    xy: tuple[int, int],
    width: int,
    font: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int, int],
    line_gap: int = 10,
) -> int:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        box = draw.textbbox((0, 0), candidate, font=font)
        if box[2] - box[0] <= width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)

    x, y = xy
    for line in lines:
        draw.text((x, y), line, font=font, fill=fill)
        y += font.size + line_gap
    return y


def render_ad(ad: dict, index: int) -> dict:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    base = OUTPUT_DIR / f"maxi_partner_{index:02d}_{ad['id']}_{stamp}"
    paths = {
        "video": base.with_suffix(".mp4"),
        "voice": base.with_name(base.name + "_voice.mp3"),
        "script": base.with_name(base.name + "_script.txt"),
        "caption": base.with_name(base.name + "_caption.txt"),
        "preview": base.with_name(base.name + "_preview.jpg"),
    }

    paths["script"].write_text(ad["script"], encoding="utf-8")
    paths["caption"].write_text(ad["caption"], encoding="utf-8")
    generate_voice(ad["script"], paths["voice"])
    voice = AudioFileClip(str(paths["voice"]))
    duration = min(18.0, max(13.5, voice.duration + 0.55))
    voice = voice.subclipped(0, min(voice.duration, duration - 0.25)).with_start(0.2)
    product_image = Image.open(image_path(ad["image"])).convert("RGB")

    fonts = {
        "brand": ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 50),
        "hook": ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 78),
        "title": ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 58),
        "mid": ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 46),
        "small": ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 34),
        "price": ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 92),
    }

    def make_frame(t: float) -> np.ndarray:
        base_img = gradient(t + index * 0.35)
        draw = ImageDraw.Draw(base_img, "RGBA")
        for i in range(7):
            y = int((t * 90 + i * 295) % (H + 160)) - 160
            draw.rounded_rectangle((-100, y, W + 100, y + 54), radius=27, fill=(255, 255, 255, 22))

        draw.rounded_rectangle((70, 82, W - 70, 170), radius=42, fill=(255, 255, 255, 238))
        center(draw, "MAXI TROUVAILLES", 104, fonts["brand"], (12, 92, 84))

        if t < 3.2:
            center(draw, "Regarde ça", 280, fonts["hook"], (255, 255, 255), stroke=3)
            center(draw, ad["hook"], 375, fonts["hook"], (255, 225, 77), stroke=4)
            presenter(draw, t, x=500, y=1540)
        elif t < duration - 3.0:
            rounded_shadow(base_img, (95, 360, W - 95, 1255), radius=54, alpha=130)
            draw.rounded_rectangle((95, 360, W - 95, 1255), radius=54, fill=(255, 255, 255, 246))
            frame_shift = int(12 * math.sin(t * 1.5))
            pic = cover(product_image, (835, 610))
            mask = Image.new("L", pic.size, 0)
            ImageDraw.Draw(mask).rounded_rectangle((0, 0, 835, 610), radius=42, fill=255)
            base_img.paste(pic, (123, 395 + frame_shift), mask)

            draw.rounded_rectangle((145, 1048, W - 145, 1185), radius=42, fill=(15, 116, 108, 246))
            center(draw, ad["price"], 1067, fonts["price"], (255, 225, 77), stroke=2)
            draw_wrapped(draw, ad["short_title"], (150, 1298), 780, fonts["title"], (255, 255, 255, 255), line_gap=8)
            draw.rounded_rectangle((142, 1478, W - 142, 1564), radius=35, fill=(255, 255, 255, 236))
            center(draw, ad["benefit"], 1499, fonts["mid"], (22, 22, 22))
        else:
            center(draw, ad["short_title"], 305, fonts["title"], (255, 255, 255), stroke=3)
            center(draw, ad["price"], 405, fonts["price"], (255, 225, 77), stroke=4)
            draw.rounded_rectangle((130, 660, W - 130, 1070), radius=58, fill=(255, 255, 255, 240))
            draw_wrapped(
                draw,
                "Produit neuf partenaire, paiement chez Maxi Trouvailles.",
                (190, 735),
                700,
                fonts["mid"],
                (24, 24, 24, 255),
                line_gap=14,
            )
            draw.rounded_rectangle((160, 1185, W - 160, 1300), radius=45, fill=(255, 225, 77, 255))
            center(draw, "Disponible sur le site", 1218, fonts["mid"], (22, 22, 22))

        draw.rounded_rectangle((80, 1745, W - 80, 1830), radius=36, fill=(15, 15, 15, 95))
        center(draw, "maxitrouvaille.fr", 1764, fonts["mid"], (255, 255, 255))
        return np.array(base_img)

    Image.fromarray(make_frame(6.0)).save(paths["preview"], quality=92)
    clip = VideoClip(make_frame, duration=duration).with_fps(FPS).with_audio(voice)
    clip.write_videofile(
        str(paths["video"]),
        fps=FPS,
        codec="libx264",
        audio_codec="aac",
        preset="medium",
        bitrate="5400k",
        logger=None,
    )

    manifest = {
        "createdAt": datetime.now().isoformat(timespec="seconds"),
        "kind": "partner-product-ad",
        "product": ad["title"],
        "price": ad["price"],
        "video": str(paths["video"]),
        "voice": str(paths["voice"]),
        "script": str(paths["script"]),
        "captionFile": str(paths["caption"]),
        "caption": ad["caption"],
        "preview": str(paths["preview"]),
        "publishStatus": "ready",
    }
    manifest_path = base.with_name(base.name + "_manifest.json")
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return manifest


def main() -> None:
    manifests = [render_ad(ad, idx + 1) for idx, ad in enumerate(ADS)]
    batch_path = OUTPUT_DIR / "partner_ads_batch_manifest.json"
    batch_path.write_text(json.dumps(manifests, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"count": len(manifests), "manifest": str(batch_path)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
