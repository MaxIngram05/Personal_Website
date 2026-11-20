"""
Builds the optimized images in public/ from the originals in Resources/.

    pip install pillow
    python scripts/build-images.py

Re-run it whenever you add or replace something in Resources/. It also draws
the original pixel art used by the site (heart cursor, favicon, save star,
OG card), so nothing here depends on third-party game assets.
"""
from pathlib import Path
import shutil
import subprocess

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "Resources"
OUT = ROOT / "public"
IMG = OUT / "images"
FONT = Path(__file__).resolve().parent / "PressStart2P-Regular.ttf"  # OFL-licensed

RED = (255, 32, 48, 255)
YELLOW = (255, 214, 0, 255)
HARD_BLUE = (58, 155, 255, 255)  # Konami "hard mode" heart
HARD_PURPLE = (200, 107, 255, 255)
BLACK = (0, 0, 0, 255)
WHITE = (255, 255, 255, 255)

# 9x8 heart, drawn for this site.
HEART = [
    ".XX...XX.",
    "XXXX.XXXX",
    "XXXXXXXXX",
    "XXXXXXXXX",
    ".XXXXXXX.",
    "..XXXXX..",
    "...XXX...",
    "....X....",
]


def grid_to_image(grid, fill, outline=None):
    """Render a character grid; optional 1px outline around the shape."""
    pad = 1 if outline else 0
    w, h = len(grid[0]) + 2 * pad, len(grid) + 2 * pad
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    filled = {(x + pad, y + pad) for y, row in enumerate(grid) for x, c in enumerate(row) if c == "X"}
    if outline:
        for x, y in filled:
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    im.putpixel((x + dx, y + dy), outline)
    for x, y in filled:
        im.putpixel((x, y), fill)
    return im


def up(im, k):
    return im.resize((im.width * k, im.height * k), Image.NEAREST)


def save_webp(im, path, quality=82, lossless=False):
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, "WEBP", quality=quality, lossless=lossless, method=6)
    print(f"  {path.relative_to(ROOT)}  {im.size}  {path.stat().st_size // 1024} KB")


def save_png(im, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, "PNG", optimize=True)
    print(f"  {path.relative_to(ROOT)}  {im.size}  {path.stat().st_size // 1024} KB")


def fit(im, max_w, max_h=None):
    im = im.copy()
    im.thumbnail((max_w, max_h or 10_000), Image.LANCZOS)
    return im


def remove_white_bg(im, tol=40, enclosed_tol=None):
    """Flood-fill near-white from the borders to transparent, then crop.
    enclosed_tol also clears near-white pixels anywhere (e.g. inside bike wheels)."""
    im = im.convert("RGBA")
    if enclosed_tol is not None:
        im.putdata([(0, 0, 0, 0) if min(p[:3]) >= 255 - enclosed_tol else p for p in getattr(im, "get_flattened_data", im.getdata)()])
    w, h = im.size
    px = im.load()
    seen = bytearray(w * h)
    stack = [(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)]
    while stack:
        x, y = stack.pop()
        i = y * w + x
        if seen[i]:
            continue
        seen[i] = 1
        r, g, b, a = px[x, y]
        if a and min(r, g, b) < 255 - tol:
            continue
        px[x, y] = (0, 0, 0, 0)
        if x > 0: stack.append((x - 1, y))
        if x < w - 1: stack.append((x + 1, y))
        if y > 0: stack.append((x, y - 1))
        if y < h - 1: stack.append((x, y + 1))
    return im.crop(im.getbbox())


def build_avatar():
    gif = Image.open(SRC / "max-idle.gif")
    scale = 9  # the GIF is 15x29 pixel art upscaled 9x
    fw, fh = gif.width // scale, gif.height // scale
    sheet = Image.new("RGBA", (fw * gif.n_frames, fh), (0, 0, 0, 0))
    for i in range(gif.n_frames):
        gif.seek(i)
        frame = gif.convert("RGBA").resize((fw, fh), Image.NEAREST)
        sheet.paste(frame, (i * fw, 0))
        if i == 0:
            save_png(frame, IMG / "avatar.png")
    save_png(sheet, IMG / "avatar-sheet.png")
    return sheet.crop((0, 0, fw, fh))


def build_hearts():
    save_png(up(grid_to_image(HEART, RED, BLACK), 2), IMG / "cursor-heart.png")
    save_png(up(grid_to_image(HEART, YELLOW, BLACK), 2), IMG / "cursor-heart-hover.png")
    save_png(up(grid_to_image(HEART, HARD_BLUE, BLACK), 2), IMG / "cursor-heart-hard.png")
    save_png(up(grid_to_image(HEART, HARD_PURPLE, BLACK), 2), IMG / "cursor-heart-hard-hover.png")


def build_favicon():
    """Browser-tab icon and home-screen icon from my pixel face logo."""
    logo = Image.open(SRC / "website logo.png").convert("RGBA")
    logo = logo.crop((0, 0, logo.width - 1, logo.height - 1))  # drop the half-transparent edge
    side = max(logo.size)
    square = Image.new("RGBA", (side, side), logo.getpixel((0, 0)))
    square.paste(logo, ((side - logo.width) // 2, side - logo.height))  # face sits on the bottom edge
    save_png(square.resize((32, 32), Image.BOX), IMG / "favicon.png")
    save_png(square.resize((180, 180), Image.LANCZOS), IMG / "apple-touch-icon.png")


def pixel_text(draw_im, xy, text, k, fill):
    """Draw Press Start 2P at its native 8px grid, then scale by k (crisp, no AA)."""
    font = ImageFont.truetype(str(FONT), 8) if FONT.exists() else ImageFont.load_default()
    bbox = font.getbbox(text)
    tmp = Image.new("RGBA", (bbox[2] + 2, 10), (0, 0, 0, 0))
    ImageDraw.Draw(tmp).text((0, 0), text, font=font, fill=fill)
    # threshold alpha so edges stay hard
    a =tmp.getchannel("A").point(lambda v: 255 if v > 100 else 0)
    tmp.putalpha(a)
    tmp = up(tmp, k)
    draw_im.paste(tmp, xy, tmp)
    return tmp.width


def build_og(avatar):
    W, H = 1200, 630
    og = Image.new("RGBA", (W, H), BLACK)
    d = ImageDraw.Draw(og)
    for i in range(6):  # chunky white frame
        d.rectangle((24 + i, 24 + i, W - 25 - i, H - 25 - i), outline=WHITE)
    import random
    rnd = random.Random(7)
    for _ in range(70):
        x, y = rnd.randrange(40, W - 40), rnd.randrange(40, H - 40)
        s = rnd.choice((3, 3, 6))
        d.rectangle((x, y, x + s - 1, y + s - 1), fill=(255, 255, 255, rnd.choice((90, 160, 255))))
    av = up(avatar, 15)
    og.paste(av, (110, (H - av.height) // 2), av)
    x = 420
    pixel_text(og, (x, 170), "MAX INGRAM", 7, WHITE)
    pixel_text(og, (x, 270), "SOFTWARE ENGINEER", 4, YELLOW)
    pixel_text(og, (x, 330), "SOEN @ CONCORDIA", 3, WHITE)
    pixel_text(og, (x, 372), "MONTREAL - EN/FR", 3, WHITE)
    h = up(grid_to_image(HEART, RED), 6)
    og.paste(h, (x, 450), h)
    pixel_text(og, (x + 80, 458), "maxingram.dev", 4, WHITE)
    save_png(og.convert("RGB"), IMG / "og-image.png")


def build_pixel_art():
    for src, dst, w, enclosed in [
        ("Pixelated bike.webp", "about/bike.webp", 320, 14),
        ("Guitar pixelated.webp", "about/guitar.webp", 240, None),
        ("Gamecontroller.webp", "about/games.webp", 280, None),
    ]:
        art = remove_white_bg(Image.open(SRC / src), enclosed_tol=enclosed)
        save_webp(fit(art, w), IMG / dst, quality=90)


def build_photos():
    for src, dst, w in [
        ("ContextFinder.ai Sample use image.png", "projects/contextfinder.webp", 480),
        ("Advocato photo.png", "projects/advocato.webp", 1000),
        ("Shrekathon group photo.png", "projects/jumpshrek-team.webp", 960),
        ("Jumpshrek photo.png", "projects/jumpshrek.webp", 700),
        ("Robowars.JPEG", "projects/sumo-robot.webp", 960),
        ("ConuhacksX group photo.png", "projects/caffeinecrash-team.webp", 960),
        ("Caffeine crash photo.png", "projects/caffeinecrash.webp", 702),
        ("LINKT photo.png", "projects/linkt.webp", 1000),
        ("WhosOnBreak.png", "projects/scheduling-app.webp", 480),
        ("Max Teaching (use if you need not necessary).png", "journey/teaching.webp", 480),
    ]:
        save_webp(fit(Image.open(SRC / src).convert("RGB"), w), IMG / dst)
    # Event banners: trim the stray green strip on the Shrekathon art, and the
    # empty blue margins around the ConuHacks wordmark.
    shrek = Image.open(SRC / "Shrekathon logo, .png").convert("RGB")
    save_webp(fit(shrek.crop((0, 0, shrek.width - 10, shrek.height)), 840), IMG / "journey/shrekathon.webp")
    conu = Image.open(SRC / "CONUHACKX LOGO.png").convert("RGB")
    save_webp(fit(conu.crop((80, 14, 840, 128)), 400), IMG / "journey/conuhacks.webp", quality=88)
    headshot = SRC / "headshot.jpg"
    if headshot.exists():
        save_webp(fit(Image.open(headshot).convert("RGB"), 360), IMG / "about/headshot.webp")


def build_logos():
    for src, dst in [
        ("Dormakaba logo.png", "journey/dormakaba.webp"),
        ("SCS.png", "journey/scs.webp"),
        ("Inventor stem.png", "journey/inventor-stem.webp"),
        ("Conu logo.png", "journey/concordia.webp"),
    ]:
        im = Image.open(SRC / src).convert("RGBA")
        bg = Image.new("RGBA", im.size, WHITE)
        bg.alpha_composite(im)
        bg = bg.convert("RGB")
        # trim surrounding whitespace so the logo fills its tile
        ink = bg.convert("L").point(lambda v: 255 if v < 235 else 0).getbbox()
        if ink:
            pad = 8
            bg = bg.crop((max(ink[0] - pad, 0), max(ink[1] - pad, 0), min(ink[2] + pad, bg.width), min(ink[3] + pad, bg.height)))
        save_webp(fit(bg, 240, 120), IMG / dst, quality=88)


def build_save_star():
    """Crop the save-point star video to a small silent loop (mp4 + webm) and a poster.
    Needs ffmpeg: on PATH, or `pip install imageio-ffmpeg`."""
    src = SRC / "Savepoint Star.mp4"
    if not src.exists():
        return
    ff = shutil.which("ffmpeg")
    if not ff:
        try:
            import imageio_ffmpeg
            ff = imageio_ffmpeg.get_ffmpeg_exe()
        except ImportError:
            print("  (skipped save-star video: no ffmpeg; pip install imageio-ffmpeg)")
            return
    out = OUT / "media"
    # Re-encoding isn't byte-identical, so skip it unless the source changed.
    done = [out / f for f in ("save-star.mp4", "save-star.webm", "save-star-poster.webp")]
    if all(f.exists() and f.stat().st_mtime >= src.stat().st_mtime for f in done):
        return
    out.mkdir(parents=True, exist_ok=True)
    vf = "crop=240:240:814:409,fps=24"  # the star sits in this square of the 1920x1080 source
    run = lambda *args: subprocess.run([ff, "-hide_banner", "-loglevel", "error", "-y", "-i", str(src), *args], check=True)
    run("-an", "-vf", vf, "-c:v", "libx264", "-profile:v", "main", "-pix_fmt", "yuv420p", "-crf", "26",
        "-movflags", "+faststart", str(out / "save-star.mp4"))
    run("-an", "-vf", vf, "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "40", str(out / "save-star.webm"))
    poster = out / "save-star.png"
    run("-vf", vf, "-frames:v", "1", str(poster))
    save_webp(Image.open(poster).convert("RGB"), out / "save-star-poster.webp", quality=85)
    poster.unlink()
    for f in ("save-star.mp4", "save-star.webm"):
        print(f"  public/media/{f}  {(out / f).stat().st_size // 1024} KB")


def main():
    print("Building images...")
    avatar = build_avatar()
    build_hearts()
    build_favicon()
    build_og(avatar)
    build_pixel_art()
    build_photos()
    build_logos()
    build_save_star()
    resume = SRC / "Max Ingram Resume.pdf"  # gitignored; only on my machine
    if resume.exists():
        shutil.copyfile(resume, OUT / "resume.pdf")
        print("  public/resume.pdf")


if __name__ == "__main__":
    main()
