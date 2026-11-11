"""Fetch the Home Office small boat figures and rebuild the site's data files.

Runs from .github/workflows/update.yml every 15 minutes from 12 noon UK time until
yesterday's figures are in (scripts/gate.py decides). Each run reads the 7-day page and
stops unless there are new or changed figures, or today's full update hasn't run yet.
Two sources, both provisional Home Office data:
  1. The weekly time-series spreadsheet (.ods), daily figures since 2018.
  2. The "last 7 days" page, updated every day.
The 7-day page wins where the two overlap, because it is newer.

Outputs (see publish()):
  data.json    full daily history, loaded by the homepage
  recent.json  last 90 days plus totals: tiny, for the embed widget
  data.csv     the full history as a spreadsheet download
  index.html   an up-to-date description, link-preview picture and dataset dates for Google
  og-image.png link preview picture; week-card.png weekly summary picture
  gender.json, nationalities.json, natyears.json, asylum.json, boatreturns.json, perboat.json, returns.json, petitions.json: see scripts/extras.py
  status.json  tiny heartbeat the page polls: when we last checked, and which build of the figures is current
"""
import io
import json
import re
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data.json"
PUB = "https://www.gov.uk/government/publications/migrants-detected-crossing-the-english-channel-in-small-boats"
LAST7 = PUB + "/migrants-detected-crossing-the-english-channel-in-small-boats-last-7-days"
HEADERS = {"User-Agent": "channel-crossings-tracker (GitHub Action)"}
RECENT_DAYS = 90


def load():
    if DATA.exists():
        return json.loads(DATA.read_text())
    return {"days": []}


# ---------------------------------------------------------------- fetching

def to_int(v):
    import pandas as pd
    try:
        if pd.isna(v):
            return 0
    except TypeError:
        pass
    if isinstance(v, float):                    # a column with a blank cell comes back as floats: 44.0, not 440
        return int(v)
    m = re.match(r"\s*(\d[\d,]*)", str(v))      # the leading number only, so "312 [note 1]" is 312
    return int(m.group(1).replace(",", "")) if m else 0


def usable(d, figure):
    """A real day with a figure: not a blank cell, a date outside 2018 to today, or a stray number read as a date."""
    import pandas as pd
    return not pd.isna(d) and pd.Timestamp("2018-01-01") <= d <= pd.Timestamp.now() and bool(re.search(r"\d", str(figure)))


def fetch_last7():
    import pandas as pd
    import requests
    page = requests.get(LAST7, headers=HEADERS, timeout=60)
    page.raise_for_status()                     # an error page has no tables: say what really went wrong
    tables = pd.read_html(io.StringIO(page.text))
    out = {}
    for t in tables:
        cols = [str(c).lower() for c in t.columns]
        people = [i for i, c in enumerate(cols) if re.search(r"migrant|people|person", c) and "boat" not in c]
        if not people:
            continue
        dcol = next((t.columns[i] for i, c in enumerate(cols) if "date" in c), t.columns[0])
        mcol = t.columns[people[0]]
        bcol = next((t.columns[i] for i, c in enumerate(cols) if "boat" in c), None)
        ucol = next((t.columns[i] for i, c in enumerate(cols) if "uncontrolled" in c), None)
        for _, r in t.iterrows():
            d = pd.to_datetime(str(r[dcol]), errors="coerce", dayfirst=True)
            if not usable(d, r[mcol]):
                continue                    # not a date, or no figure in the cell yet
            key = d.strftime("%Y-%m-%d")
            out[key] = {
                "date": key,
                "migrants": to_int(r[mcol]),
                "boats": to_int(r[bcol]) if bcol is not None else 0,
                "uncontrolled": to_int(r[ucol]) if ucol is not None else None,
            }
    return out


def fetch_timeseries():
    """Best effort: the spreadsheet's layout can change, so failures are non-fatal."""
    import pandas as pd
    import requests
    page = requests.get(PUB, headers=HEADERS, timeout=60).text
    m = re.search(r'https://assets\.publishing\.service\.gov\.uk/[^"\']+\.ods', page)
    if not m:
        print("No time-series spreadsheet link found")
        return {}
    raw = requests.get(m.group(0), headers=HEADERS, timeout=120).content
    sheets = pd.read_excel(io.BytesIO(raw), engine="odf", sheet_name=None, header=None)
    out = {}
    for name, df in sheets.items():
        hdr = None
        for i in range(min(len(df), 30)):
            row = [str(x).lower() for x in df.iloc[i].tolist()]
            if any("date" in c for c in row) and any("migrant" in c for c in row):
                hdr = i
                break
        if hdr is None:
            continue
        cols = [str(x).lower() for x in df.iloc[hdr].tolist()]
        body = df.iloc[hdr + 1:]
        di = next(i for i, c in enumerate(cols) if "date" in c)
        mi = next(i for i, c in enumerate(cols) if "migrant" in c)
        bi = next((i for i, c in enumerate(cols) if "boat" in c), None)
        for _, r in body.iterrows():
            d = pd.to_datetime(r.iloc[di], errors="coerce", dayfirst=True)
            if not usable(d, r.iloc[mi]):
                continue                    # a blank row for a day still to come would read as 0 people
            key = d.strftime("%Y-%m-%d")
            out[key] = {
                "date": key,
                "migrants": to_int(r.iloc[mi]),
                "boats": to_int(r.iloc[bi]) if bi is not None else 0,
                "uncontrolled": None,
            }
        if out:
            print(f"Time series: {len(out)} days from sheet '{name}'")
            break
    return out


# ---------------------------------------------------------------- merging

def merge(data, ts, last7, today):
    """Combine stored days with fresh figures and flag any revised days."""
    old = {d["date"]: d for d in data.get("days", [])}
    days = {k: dict(v) for k, v in old.items()}
    changes = sum(1 for k, v in ts.items() if k in old and v["migrants"] != old[k]["migrants"])
    if changes > 31:                          # a new layout (weekly totals, another table) rather than real revisions
        print(f"Time series ignored: it would change {changes} days already held")
        ts = {}

    # Neither the spreadsheet nor (if its column goes) the 7-day page may wipe an uncontrolled landings figure we hold
    for k, v in list(ts.items()) + list(last7.items()):
        prev = days.get(k, {})
        if v["uncontrolled"] is None and prev.get("uncontrolled") is not None:
            v = {**v, "uncontrolled": prev["uncontrolled"]}
        days[k] = v

    revised = 0
    for k, d in days.items():
        before = old.get(k)
        if not before:
            continue
        if d["migrants"] != before["migrants"]:
            # Keep the first published figure if a day is revised more than once
            first = before.get("revised", {}).get("from", before["migrants"])
            if d["migrants"] == first:
                d.pop("revised", None)          # revised back to the original figure
            else:
                d["revised"] = {"from": first, "on": today}
                revised += 1
        elif before.get("revised"):
            d["revised"] = before["revised"]    # unchanged today: keep the earlier note
    if revised:
        print(f"{revised} day(s) revised")
    return sorted(days.values(), key=lambda d: d["date"])


def year_totals(data, ordered):
    latest = ordered[-1]["date"]
    year = latest[:4]
    have_full_year = any(d["date"] <= f"{year}-01-07" for d in ordered if d["date"].startswith(year))
    if have_full_year:
        data["ytdBase"] = 0
        data["ytdBaseDate"] = f"{year}-01-00"
        prev_year = str(int(year) - 1)
        same_point = prev_year + latest[4:]
        prev_total = sum(d["migrants"] for d in ordered if d["date"].startswith(prev_year) and d["date"] <= same_point)
        if prev_total:
            data["prevYearSamePoint"] = prev_total
        else:
            data.pop("prevYearSamePoint", None)   # none by this date last year: don't keep the old year's figure
    elif data.get("ytdBaseDate", "")[:4] != year:
        data["ytdBase"] = 0
        data["ytdBaseDate"] = f"{year}-01-00"
        data.pop("prevYearSamePoint", None)


# ---------------------------------------------------------------- outputs

def dump_days(days):
    """Compact JSON with one day per line: small to download, readable in diffs."""
    return "[\n" + ",\n".join(json.dumps(d, separators=(",", ":")) for d in days) + "\n]"


def recent_view(data, n=RECENT_DAYS):
    """The last n days plus a year-to-date base, so totals work without the full history."""
    days = data["days"]
    recent = days[-n:]
    year = days[-1]["date"][:4]
    start = recent[0]["date"]
    base_date = data.get("ytdBaseDate", f"{year}-01-00")
    base = data.get("ytdBase", 0)
    if start[:4] == year and start > base_date:
        before = sum(d["migrants"] for d in days if base_date < d["date"] < start and d["date"][:4] == year)
        base, base_date = base + before, (date.fromisoformat(start) - timedelta(days=1)).isoformat()
    out = {
        "ytdBase": base,
        "ytdBaseDate": base_date,
        "fullYear": data.get("ytdBaseDate") == f"{year}-01-00",
        "checkedAt": data.get("checkedAt"),
        "days": recent,
    }
    if data.get("prevYearSamePoint"):
        out["prevYearSamePoint"] = data["prevYearSamePoint"]
    out["periods"] = period_totals(days)
    return out


# Dates for the "since" totals. Labour took office on 5 July 2024 (Keir Starmer);
# Andy Burnham became Prime Minister on 20 July 2026.
PERIODS = {"labour": "2024-07-05", "burnham": "2026-07-20"}


def period_totals(days):
    out = {}
    last = date.fromisoformat(days[-1]["date"])
    for key, start in PERIODS.items():
        span = [d for d in days if d["date"] >= start]
        out[key] = {"from": start, "people": sum(d["migrants"] for d in span),
                    "boats": sum(d["boats"] for d in span),
                    "days": (last - date.fromisoformat(start)).days + 1}   # calendar days, so quiet days count
    return out


def write_csv(days):
    lines = ["date,people,boats,uncontrolled_landings"]
    for d in days:
        u = "" if d.get("uncontrolled") is None else str(d["uncontrolled"])
        lines.append(f"{d['date']},{d['migrants']},{d['boats']},{u}")
    (ROOT / "data.csv").write_text("\n".join(lines) + "\n")


def nice_date(iso):
    d = date.fromisoformat(iso)
    return f"{d.strftime('%a')} {d.day} {d.strftime('%B')}"


def update_page(data, recent):
    """Keep index.html's description, latest figures, dataset dates and link-preview picture up to date."""
    page = ROOT / "index.html"
    html = page.read_text(encoding="utf-8")       # the page holds "·" and other non-ASCII text: don't rely on the locale
    last = data["days"][-1]
    latest = last["date"]

    n = last["migrants"]
    ytd = recent["ytdBase"] + sum(d["migrants"] for d in recent["days"] if d["date"] > recent["ytdBaseDate"] and d["date"][:4] == latest[:4])
    lead = (f"{n:,} {'person' if n == 1 else 'people'} crossed the Channel in small boats on {nice_date(latest)}."
            if n else f"No small boat crossings of the Channel were detected on {nice_date(latest)}.")
    desc = f"{lead} {latest[:4]} so far: {ytd:,}. Daily Home Office figures, a migrant tracker."
    html = re.sub(r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{desc}">', html, count=1)

    # The lines under the title and the big number, written as the page's script writes them, so Google and other
    # readers find the latest figures in the page itself, not only after the script has run
    d = date.fromisoformat(latest)
    long = f"{d.strftime('%A')}, {d.day} {d.strftime('%B')} {d.year}"
    boats = last["boats"]
    # the day as a calendar tile, with "N people crossed" or "No crossings detected" beside it
    html = re.sub(r'(id="hqMon">)[^<]*', lambda m: m.group(1) + d.strftime("%b"), html, count=1)
    html = re.sub(r'(id="hqDay">)[^<]*', lambda m: m.group(1) + str(d.day), html, count=1)
    html = re.sub(r'(id="heroNum">)[^<]*', lambda m: m.group(1) + (f"{n:,}" if n else ""), html, count=1)
    html = re.sub(r'(id="hqT">)[^<]*', lambda m: m.group(1) + ((" person detected" if n == 1 else " people detected") if n else "No crossings detected"), html, count=1)
    html = re.sub(r'(id="heroSub">)[^<]*', lambda m: m.group(1) + long + (f" · {boats:,}&nbsp;boat{'' if boats == 1 else 's'}" if n else ""), html, count=1)
    sr = (f"{n:,} {'person' if n == 1 else 'people'} crossed in {boats:,} small boat{'' if boats == 1 else 's'} on {long}"
          if n else f"No crossings detected for {long}")
    html = re.sub(r'(id="heroSr" aria-live="polite">)[^<]*', lambda m: m.group(1) + sr, html, count=1)

    html = re.sub(r'"dateModified":\s*"[^"]*"', f'"dateModified": "{latest}"', html, count=1)
    html = re.sub(r'"temporalCoverage":\s*"[^"]*"', f'"temporalCoverage": "{data["days"][0]["date"]}/{latest}"', html, count=1)
    html = re.sub(r"og-image\.png(\?v=[0-9-]*)?", "og-image.png?v=" + latest, html)
    page.write_text(html, encoding="utf-8")


SITE = "https://channelcrossings.world/"
INDEXNOW_KEY = "3c699a48e42e6f3a4c6573138dd6fc80"   # proves we own the site: the same key is in /3c699a48e42e6f3a4c6573138dd6fc80.txt


def write_sitemap(latest):
    """Tell search engines when the figures last changed."""
    pages = [("", latest, "daily", "1.0"), ("how-it-works.html", None, "monthly", "0.6"), ("privacy.html", None, "yearly", "0.3")]
    rows = "".join(f"  <url><loc>{SITE}{p}</loc>" + (f"<lastmod>{m}</lastmod>" if m else "") + f"<changefreq>{c}</changefreq><priority>{pr}</priority></url>\n"
                   for p, m, c, pr in pages)
    (ROOT / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + rows + "</urlset>\n")


def ping_indexnow():
    """New figures: ask Bing (which also feeds DuckDuckGo, Yahoo and Ecosia) and others to look again.
    Google doesn't take part in IndexNow; it reads the sitemap instead."""
    try:
        import requests
        r = requests.post("https://api.indexnow.org/indexnow", timeout=20, json={
            "host": "channelcrossings.world", "key": INDEXNOW_KEY,
            "keyLocation": f"{SITE}{INDEXNOW_KEY}.txt", "urlList": [SITE]})
        print("IndexNow:", r.status_code)
    except Exception as e:  # noqa: BLE001 - never let this stop the update
        print("IndexNow skipped:", e)


def publish(data):
    """Write every output file from data (with data['days'] already merged)."""
    ordered = data["days"]
    DATA.write_text(
        json.dumps({k: v for k, v in data.items() if k != "days"}, indent=1)[:-2]
        + ',\n "days": ' + dump_days(ordered) + "\n}\n"
    )
    recent = recent_view(data)
    (ROOT / "recent.json").write_text(json.dumps(recent, separators=(",", ":")) + "\n")
    write_csv(ordered)
    update_page(data, recent)
    write_sitemap(ordered[-1]["date"])
    print(f"Saved {len(ordered)} days, latest {ordered[-1]['date']}")

    try:
        from og_image import draw, draw_week
        draw(data)
        draw_week(data)
        print("Saved og-image.png and week-card.png")
    except Exception as e:  # noqa: BLE001 - the pictures are optional
        print("Pictures skipped:", e)


def write_status(data, now):
    """The heartbeat: written on every check (even when nothing changed) so the page can say when we last
    looked, and can fetch the full figures only when dataAt moves past the copy it already holds."""
    days = data.get("days") or []
    (ROOT / "status.json").write_text(json.dumps({
        "checkedAt": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "dataAt": data.get("checkedAt"),
        "latest": days[-1]["date"] if days else None,
    }, separators=(",", ":")) + "\n")


def unchanged(data, last7, now):
    """True when the 7-day page matches what we hold and today's full update has already run."""
    held = {d["date"]: d for d in data.get("days", [])}
    same = all(k in held and all(held[k].get(f) == v[f] for f in ("migrants", "boats", "uncontrolled") if v[f] is not None)
               for k, v in last7.items())
    return same and (data.get("checkedAt") or "")[:10] == now.strftime("%Y-%m-%d")


def main():
    data = load()
    now = datetime.now(timezone.utc)
    last7 = fetch_last7()
    if not last7:
        print("Could not read the last-7-days table", file=sys.stderr)
        sys.exit(1)
    # Frequent checks: stop here if nothing new has been published (no files change, nothing republished)
    if unchanged(data, last7, now):
        print("No new figures")
        write_status(data, now)
        return
    try:
        ts = fetch_timeseries()
    except Exception as e:  # noqa: BLE001
        print("Time series skipped:", e)
        ts = {}

    data["days"] = merge(data, ts, last7, now.strftime("%Y-%m-%d"))
    odd = [d for d in data["days"] if not (0 <= d["migrants"] <= 2500 and 0 <= d["boats"] <= 60)]
    if odd:                                   # the record is 1,305 people and 36 boats in a day
        sys.exit(f"Not publishing: implausible figures {odd[:3]}")
    year_totals(data, data["days"])
    try:
        from extras import update_all
        update_all(data["days"])   # sex and age, nationalities, people per boat, returns, petitions: each optional
    except Exception as e:  # noqa: BLE001 - never let the extras stop the daily figures
        print("Extras skipped:", e)
    data["checkedAt"] = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    data["source"] = PUB
    publish(data)
    write_status(data, now)
    ping_indexnow()


if __name__ == "__main__":
    if "--publish-only" in sys.argv:   # rebuild outputs from data.json without fetching
        data = load()
        publish(data)
        write_status(data, datetime.now(timezone.utc))
    else:
        main()
