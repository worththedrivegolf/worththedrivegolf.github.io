"""Draws the interim in-bay simulator illustration.

Original Worth the Drive artwork in the brand palette, rendered straight to the
images/sim-screen.png slot so the owner's real GSPro screenshot is a plain file
swap later (same path, same 16:9 ratio, no code change).

Run: python src/assets/make-sim-screen.py
"""

from PIL import Image, ImageDraw, ImageFont

W, H = 1600, 900
NAVY_DARKEST = (10, 20, 36)
NAVY_DEEP = (14, 26, 46)
WHITE = (255, 255, 255)
GREEN_BRIGHT = (123, 198, 91)
GOLD = (245, 197, 24)
MUTED = (143, 160, 184)
BODY_DARK = (201, 211, 228)

# Arial Narrow stands in for Oswald's condensed proportions in this raster.
FONT = "C:/Windows/Fonts/ARIALNB.TTF"
FONT_R = "C:/Windows/Fonts/ARIALN.TTF"


def f(path, size):
    return ImageFont.truetype(path, size)


def vgrad(img, box, top, bottom):
    """Vertical gradient — PIL has none, so paint it a row at a time."""
    x0, y0, x1, y1 = box
    d = ImageDraw.Draw(img)
    span = max(1, y1 - y0)
    for y in range(y0, y1):
        t = (y - y0) / span
        d.line([(x0, y), (x1, y)],
               fill=tuple(round(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))


img = Image.new("RGB", (W, H), NAVY_DARKEST)
d = ImageDraw.Draw(img, "RGBA")

# --- sky, ridge, treeline -------------------------------------------------
vgrad(img, (0, 0, W, 470), (18, 49, 87), (201, 214, 194))
d.polygon([(0, 452), (150, 400), (280, 428), (420, 372), (560, 420), (700, 386),
           (860, 430), (1010, 392), (1160, 428), (1320, 384), (1460, 424),
           (1600, 400), (1600, 480), (0, 480)], fill=(36, 67, 95))
d.polygon([(0, 472), (210, 440), (390, 464), (580, 442), (780, 468), (980, 444),
           (1200, 470), (1400, 448), (1600, 468), (1600, 492), (0, 492)],
          fill=(27, 58, 80))
d.rectangle([0, 468, W, 500], fill=(22, 53, 31))

# --- rough + fairway ------------------------------------------------------
vgrad(img, (0, 492, W, H), (60, 107, 38), (30, 68, 22))
d.polygon([(690, 496), (910, 496), (1290, H), (300, H)], fill=(62, 122, 40))
for a, b, c, e in [(742, 772, 928, 838), (812, 842, 1108, 1018), (872, 900, 1286, 1198)]:
    d.polygon([(a, 496), (b, 496), (c, H), (e, H)], fill=(255, 255, 255, 22))

# --- green, pin, flag -----------------------------------------------------
d.ellipse([672, 490, 928, 534], fill=(99, 176, 67))
d.ellipse([672, 488, 928, 530], fill=(119, 196, 85))
d.ellipse([831, 503, 841, 513], fill=(14, 26, 46))
d.rectangle([834, 440, 837, 510], fill=(232, 238, 246))
d.polygon([(838, 442), (889, 456), (838, 470)], fill=(203, 22, 29))

# --- ball flight trace (dotted quadratic) ---------------------------------
pts = []
for i in range(61):
    t = i / 60
    x = (1 - t) ** 2 * 470 + 2 * (1 - t) * t * 610 + t * t * 834
    y = (1 - t) ** 2 * 852 + 2 * (1 - t) * t * 520 + t * t * 496
    pts.append((x, y))
for i, (x, y) in enumerate(pts):
    if i % 3 == 0:
        d.ellipse([x - 3, y - 3, x + 3, y + 3], fill=GOLD)
d.ellipse([461, 843, 479, 861], fill=WHITE)

# --- vignette -------------------------------------------------------------
ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
od = ImageDraw.Draw(ov)
for y in range(H):
    if y < 300:
        a = int(150 * (1 - y / 300))
    elif y > 560:
        a = int(190 * ((y - 560) / (H - 560)))
    else:
        a = 0
    if a:
        od.line([(0, y), (W, y)], fill=(10, 20, 36, a))
img = Image.alpha_composite(img.convert("RGBA"), ov).convert("RGB")
d = ImageDraw.Draw(img, "RGBA")

# --- shot label -----------------------------------------------------------
d.rounded_rectangle([72, 64, 340, 104], 5, fill=(93, 168, 58, 46))
d.text((90, 74), "S H O T   7   ·   7   I R O N", font=f(FONT, 19), fill=GREEN_BRIGHT)

# --- metric tiles ---------------------------------------------------------
tiles = [("BALL SPEED", "118.4", "MPH", False),
         ("CARRY", "171", "YDS", False),
         ("LAUNCH", "18.2", "DEG", False),
         ("CLUB PATH", "1.4", "IN", True)]
x = 72
for label, value, unit, hi in tiles:
    d.rounded_rectangle([x, 700, x + 330, 828], 10, fill=(14, 26, 46, 214),
                        outline=(123, 198, 91, 115) if hi else (255, 255, 255, 33), width=1)
    d.text((x + 22, 722), " ".join(label), font=f(FONT_R, 18), fill=MUTED)
    vf = f(FONT, 56)
    d.text((x + 22, 752), value, font=vf, fill=GREEN_BRIGHT if hi else WHITE)
    vw = d.textlength(value, font=vf)
    d.text((x + 32 + vw, 782), unit, font=f(FONT, 23), fill=BODY_DARK)
    x += 360

img.save("images/sim-screen.png", optimize=True)
print("  images/sim-screen.png written")
