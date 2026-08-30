"""Generates the responsive derivatives for every named image slot.

Sources live in images/incoming/ (git-ignored originals). Outputs land at the
slot paths in images/ with -800 / -1400 / -2000 variants for srcset, per
HANDOFF §7. Never upscales past the source. Re-run after adding photos:

    python src/assets/make-images.py
"""

from PIL import Image, ImageOps
import os

INC = "images/incoming"
OUT = "images"
WIDTHS = (800, 1400, 2000)

# slot -> (source file, target aspect ratio, focal point as a 0-1 fraction of height)
SLOTS = {
    # The On Tour band: the barn venue — chandeliers, wood ceiling, a golfer
    # mid-swing. The most distinctive image in the set. Focal point sits high so
    # the 4:3 crop keeps the ceiling that makes the shot.
    "on-tour-event": ("787083099_122117958375317629_8993458394852566752_n.jpg", 4 / 3, 0.34),
}

# Everything else from the shoot, kept at a consistent ratio for the On Tour
# page gallery in the next gate. Order is roughly best-first.
GALLERY = [
    ("on-tour-night-lit",   "747723349_122112884259317629_8352073034481131110_n.jpg", 0.50),
    ("on-tour-night-crowd", "748419020_122112884289317629_6175815159143883759_n.jpg", 0.50),
    ("on-tour-backyard",    "722030820_122107341639317629_150203463593522030_n.jpg",  0.55),
    ("on-tour-festival",    "735150244_122110223511317629_5695142584139311258_n.jpg", 0.55),
    ("on-tour-corporate",   "735735758_122110343721317629_7443517403690169618_n.jpg", 0.52),
    ("on-tour-setup",       "743940519_122112179463317629_5020007806811816318_n.jpg", 0.48),
    ("on-tour-driveway",    "787342219_122117959221317629_8892327711035785371_n.jpg", 0.50),
]
GALLERY_AR = 4 / 3


def load(name):
    im = Image.open(os.path.join(INC, name))
    im = ImageOps.exif_transpose(im)          # phone photos carry rotation
    return im.convert("RGB")


def crop_to(im, ar, focal=0.5):
    """Centre-crop to `ar`, biased vertically toward the focal point."""
    w, h = im.size
    if w / h > ar:                            # too wide -> trim sides
        nw = int(round(h * ar))
        x = (w - nw) // 2
        return im.crop((x, 0, x + nw, h))
    nh = int(round(w / ar))                   # too tall -> trim top/bottom
    y = int(round((h - nh) * focal))
    y = max(0, min(y, h - nh))
    return im.crop((0, y, w, y + nh))


def export(im, stem):
    made = []
    for wpx in WIDTHS:
        if wpx > im.width:                    # never upscale
            continue
        r = im.resize((wpx, round(wpx * im.height / im.width)), Image.LANCZOS)
        p = f"{OUT}/{stem}-{wpx}.jpg"
        r.save(p, "JPEG", quality=82, optimize=True, progressive=True)
        made.append((p, r.size, os.path.getsize(p)))
    # the plain path stays the default src / swap target
    default = min(im.width, WIDTHS[-1])
    r = im.resize((default, round(default * im.height / im.width)), Image.LANCZOS)
    p = f"{OUT}/{stem}.jpg"
    r.save(p, "JPEG", quality=82, optimize=True, progressive=True)
    made.append((p, r.size, os.path.getsize(p)))
    return made


print("slots:")
for stem, (src, ar, focal) in SLOTS.items():
    im = crop_to(load(src), ar, focal)
    for p, size, b in export(im, stem):
        print(f"  {p:<34} {size[0]}x{size[1]:<5} {b/1024:6.0f} KB")

print("\ngallery (for the On Tour page):")
for stem, src, focal in GALLERY:
    im = crop_to(load(src), GALLERY_AR, focal)
    for p, size, b in export(im, stem):
        print(f"  {p:<34} {size[0]}x{size[1]:<5} {b/1024:6.0f} KB")

print("\nre-deriving the studio render slots:")
for stem, src, ar, focal in [
    ("hero-studio",   "../studio-coming-soon.jpg", 21 / 9, 0.50),
    ("studio-inside", "../studio-coming-soon.jpg", 4 / 3,  0.50),
]:
    im = crop_to(load(src), ar, focal)
    for p, size, b in export(im, stem):
        print(f"  {p:<34} {size[0]}x{size[1]:<5} {b/1024:6.0f} KB")

# --- Open Graph share card (1200x630), composed from hero + logo ----------
print("\nog share card:")
hero = crop_to(load("../hero-studio.jpg"), 1200 / 630, 0.5).resize((1200, 630), Image.LANCZOS)
scrim = Image.new("RGBA", (1200, 630), (0, 0, 0, 0))
from PIL import ImageDraw as _D
_d = _D.Draw(scrim)
for y in range(630):                                   # bottom-weighted scrim
    a = int(215 * (y / 630) ** 1.5) + 40
    _d.line([(0, y), (1200, y)], fill=(10, 20, 36, min(a, 235)))
card = Image.alpha_composite(hero.convert("RGBA"), scrim)
logo = Image.open(f"{OUT}/logo@2x.png").convert("RGBA")
logo.thumbnail((330, 330))
card.paste(logo, (72, 630 - logo.height - 116), logo)
_d2 = _D.Draw(card)
from PIL import ImageFont as _F
_d2.text((74, 630 - 96), "MEMBERS-ONLY INDOOR GOLF  ·  WAWAKA, INDIANA  ·  OPENING 2026",
         font=_F.truetype("C:/Windows/Fonts/ARIALNB.TTF", 27), fill=(230, 238, 248))
card.convert("RGB").save(f"{OUT}/og-share.jpg", "JPEG", quality=86, optimize=True)
print(f"  {OUT}/og-share.jpg                  1200x630   {os.path.getsize(OUT+'/og-share.jpg')/1024:.0f} KB")
