"""Draw og-image.png: the picture X and other sites show when the link is shared.

Called at the end of update.py, so the image always carries the latest figure.
Uses Pillow and the DejaVu fonts that come with GitHub's Ubuntu runners.
"""
import os
from datetime import date, timedelta
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
W, H = 1200, 630
BLUE = (0, 122, 255)
WHITE = (255, 255, 255)
SOFT = (214, 232, 255)
ORANGE = (255, 159, 10)

FONT_DIRS = [
    "/usr/share/fonts/truetype/dejavu",
    "/usr/share/fonts/dejavu",
]


def font(bold, size):
    name = "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"
    for d in FONT_DIRS:
        p = Path(d) / name
        if p.exists():
            return ImageFont.truetype(str(p), size)
    return ImageFont.load_default(size)


def save(img, out):
    """Write via a temporary file: update.py carries on if a picture fails, so a half-written one would be published."""
    tmp = Path(str(out) + ".tmp")
    img.save(tmp, format="PNG", optimize=True)
    os.replace(tmp, out)


def fmt(n):
    return f"{n:,}"


def nice_date(iso):
    d = date.fromisoformat(iso)
    return f"{d.strftime('%a')} {d.day} {d.strftime('%B')}"


def draw(data, out=ROOT / "og-image.png"):
    days = sorted(data.get("days", []), key=lambda d: d["date"])
    if not days:
        return
    last = days[-1]
    year = last["date"][:4]
    week = sum(d["migrants"] for d in days[-7:])
    ytd = None
    base_date = data.get("ytdBaseDate", "")
    if data.get("ytdBase") is not None and base_date[:4] == year:
        ytd = data["ytdBase"] + sum(
            d["migrants"] for d in days if d["date"] > base_date and d["date"][:4] == year
        )

    img = Image.new("RGB", (W, H), BLUE)
    g = ImageDraw.Draw(img)

    # Badge on the left
    badge_path = ROOT / "logo-badge.png"
    if badge_path.exists():
        badge = Image.open(badge_path).convert("RGB").resize((430, 430), Image.LANCZOS)
        mask = Image.new("L", (430, 430), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, 429, 429), fill=255)
        img.paste(badge, (70, 100), mask)

    x = 560
    g.text((x, 118), "LATEST DAY · " + nice_date(last["date"]).upper(), font=font(True, 26), fill=SOFT)
    num = fmt(last["migrants"])
    g.text((x - 6, 150), num, font=font(True, 150), fill=WHITE)
    people = "person" if last["migrants"] == 1 else "people"
    boats = "boat" if last["boats"] == 1 else "boats"
    line = (f"{people} crossed in {fmt(last['boats'])} {boats}"
            if last["migrants"] else "No crossings detected")
    g.text((x, 325), line, font=font(False, 34), fill=WHITE)

    g.line((x, 395, W - 70, 395), fill=SOFT, width=2)
    g.text((x, 420), "LAST 7 DAYS", font=font(True, 22), fill=SOFT)
    g.text((x, 452), fmt(week), font=font(True, 52), fill=WHITE)
    if ytd is not None:
        g.text((x + 300, 420), f"{year} SO FAR", font=font(True, 22), fill=SOFT)
        g.text((x + 300, 452), fmt(ytd), font=font(True, 52), fill=WHITE)

    g.rectangle((0, H - 10, W, H), fill=ORANGE)
    g.text((x, 548), "Provisional Home Office figures · Updated daily", font=font(False, 24), fill=SOFT)
    save(img, out)


def draw_week(data, out=ROOT / "week-card.png"):
    """week-card.png: 'Week in numbers' for the last complete Monday-to-Sunday week."""

    days = sorted(data.get("days", []), key=lambda d: d["date"])
    if len(days) < 14:
        return
    by = {d["date"]: d for d in days}
    last = date.fromisoformat(days[-1]["date"])
    sunday = last - timedelta(days=(last.weekday() + 1) % 7)
    monday = sunday - timedelta(days=6)
    week = [by.get((monday + timedelta(days=i)).isoformat(), {"date": (monday + timedelta(days=i)).isoformat(), "migrants": 0, "boats": 0}) for i in range(7)]
    prev = [by.get((monday - timedelta(days=7 - i)).isoformat(), {"migrants": 0}) for i in range(7)]
    total = sum(d["migrants"] for d in week)
    boats = sum(d["boats"] for d in week)
    prev_total = sum(d["migrants"] for d in prev)
    busiest = max(week, key=lambda d: d["migrants"])

    W2, H2 = 1200, 675
    img = Image.new("RGB", (W2, H2), BLUE)
    g = ImageDraw.Draw(img)
    badge_path = ROOT / "logo-badge.png"
    if badge_path.exists():
        badge = Image.open(badge_path).convert("RGB").resize((120, 120), Image.LANCZOS)
        mask = Image.new("L", (120, 120), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, 119, 119), fill=255)
        img.paste(badge, (W2 - 190, 60), mask)

    x = 80
    g.text((x, 70), "WEEK IN NUMBERS", font=font(True, 28), fill=SOFT)
    span = f"{monday.day} {monday.strftime('%b')} – {sunday.day} {sunday.strftime('%b %Y')}"
    g.text((x, 110), span, font=font(True, 44), fill=WHITE)
    g.text((x - 6, 190), fmt(total), font=font(True, 150), fill=WHITE)
    g.text((x, 370), f"{'person' if total == 1 else 'people'} crossed in {fmt(boats)} {'boat' if boats == 1 else 'boats'}",
           font=font(False, 36), fill=WHITE)

    g.line((x, 440, W2 - 80, 440), fill=SOFT, width=2)
    col = [x, x + 360, x + 720]
    g.text((col[0], 465), "WEEK BEFORE", font=font(True, 22), fill=SOFT)
    g.text((col[0], 497), fmt(prev_total), font=font(True, 48), fill=WHITE)
    if prev_total:
        pct = round((total / prev_total - 1) * 100)
        g.text((col[0], 557), f"{'↑' if pct > 0 else '↓' if pct < 0 else '='} {abs(pct)}%", font=font(True, 28),
               fill=ORANGE if pct > 0 else SOFT)
    g.text((col[1], 465), "BUSIEST DAY", font=font(True, 22), fill=SOFT)
    if busiest["migrants"]:
        bd = date.fromisoformat(busiest["date"])
        g.text((col[1], 497), fmt(busiest["migrants"]), font=font(True, 48), fill=WHITE)
        g.text((col[1], 557), bd.strftime("%A"), font=font(False, 28), fill=SOFT)
    else:
        g.text((col[1], 497), "None", font=font(True, 48), fill=WHITE)
    zero = sum(1 for d in week if d["migrants"] == 0)
    g.text((col[2], 465), "DAYS WITHOUT CROSSINGS", font=font(True, 22), fill=SOFT)
    g.text((col[2], 497), str(zero), font=font(True, 48), fill=WHITE)

    g.rectangle((0, H2 - 10, W2, H2), fill=ORANGE)
    g.text((x, H2 - 60), "channelcrossings.world · Provisional Home Office figures", font=font(False, 24), fill=SOFT)
    save(img, out)


if __name__ == "__main__":
    import json

    draw(json.loads((ROOT / "data.json").read_text()))
    print("Saved og-image.png")
