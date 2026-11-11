"""Breaking news about Channel small boat crossings, for the box at the top of the site.

Runs every 15 minutes from .github/workflows/news.yml. Reads the public news feeds of a few
UK outlets, keeps breaking stories (last 3 hours) about small boats, the Channel,
migration or UK politics (Dan, 2 Oct 2026: "anything to do with political news ...
migration, the boats ... can show"), and writes news.json. It also notes the newest story from
today saying boats are crossing the Channel today ("reported"), which the site shows as a
"Crossings reported today" chip until the Home Office figures for the day are out. Every feed is optional: if one
is down or changes, the others still work.

To change what's shown, edit FEEDS, POLITICS_FEEDS, STRONG, BLOCK or MAX_AGE_HOURS below.
To pin or hide a story by hand, edit news-override.json (see the bottom of this file).
"""
import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from xml.etree import ElementTree as ET
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "news.json"
OVERRIDE = ROOT / "news-override.json"
HEADERS = {"User-Agent": "channel-crossings-news (GitHub Action; channelcrossings.world)"}
MAX_AGE_HOURS = 3          # breaking news only: older stories are dropped

FEEDS = [
    ("BBC News", "https://feeds.bbci.co.uk/news/uk/rss.xml"),
    ("BBC News", "https://feeds.bbci.co.uk/news/politics/rss.xml"),
    ("Sky News", "https://feeds.skynews.com/feeds/rss/uk.xml"),
    ("Sky News", "https://feeds.skynews.com/feeds/rss/politics.xml"),
    ("The Guardian", "https://www.theguardian.com/uk/immigration/rss"),
    ("The Telegraph", "https://www.telegraph.co.uk/news/rss.xml"),
    ("GB News", "https://www.gbnews.com/feeds/news.rss"),
    ("GOV.UK", "https://www.gov.uk/search/news-and-communications.atom?keywords=small+boats"),
]

# Every story from these feeds is political news, so it can show as it is
POLITICS_FEEDS = {"https://feeds.bbci.co.uk/news/politics/rss.xml", "https://feeds.skynews.com/feeds/rss/politics.xml"}

# Otherwise a story must match one of these in its headline or summary: the boats and the Channel...
STRONG = re.compile(
    r"small[- ]boats?|channel (?:migrants?|crossings?)|crossed the channel|crossing the channel|"
    r"migrant (?:boat|dinghy|dinghies)|dinghy|dinghies|one in,? one out|border security command|"
    r"boat (?:arrivals|crossings)|people[- ]smuggl|smuggling gangs?|"
    # ...migration...
    r"\bmigra(?:nts?|tion)\b|\bimmigra(?:nts?|tion)\b|\basylum\b|\brefugees?\b|\bdeport\w*|\bborders?\b|\bthe channel\b|"
    # ...and UK politics: parties, politicians, Parliament and government
    r"\bpolitic\w*|\bgovernment\b|\bparliament\b|\bwestminster\b|\bcommons\b|house of lords|\bmps?\b|"
    r"prime minister|downing street|home secretary|home office|\bchancellor\b|\bcabinet\b|\bminister\b|"
    r"general election|by-election|\bpolls?\b|\bbrexit\b|\bpmqs?\b|"
    r"\blabour\b|\bconservatives?\b|\btor(?:y|ies)\b|reform uk|\breform party\b|restore britain|lib(?:eral)? dems?|"
    r"green party|\bsnp\b|plaid cymru|"
    r"starmer|burnham|farage|rupert lowe|badenoch|mahmood|jenrick|braverman|rayner|reeves|streeting|polanski",
    re.I)
# ...and must not be about something else that happens to share the words
# "Crossings reported today": a story published today (UK time) that says boats are crossing now. Both must match:
# what happened (people crossing, arriving or being brought ashore)...
CROSS_EVENT = re.compile(
    r"cross(?:ed|ing|es)? the channel|channel crossings? (?:today|this morning)|"
    r"(?:brought|taken) (?:ashore|in)(?:to)? (?:at |in )?dover|arriv\w* (?:in|at) dover|landed (?:at|in|on) (?:dover|kent|the kent coast)|"
    r"(?:picked up|intercepted|rescued) (?:in|from|off) the channel|small boats? (?:arriv|land|cross)\w*|"
    r"(?:migrants?|people) (?:in|on) (?:a |small )?(?:boats?|dinghy|dinghies)",
    re.I)
# ...and that it is today's news, not a monthly or yearly total
CROSS_TODAY = re.compile(r"\btoday\b|this morning|\bovernight\b|\bearlier\b|\bright now\b|\bthis afternoon\b|"
                         r"\bdozens\b|\bhundreds\b|\bmore than \d|\b\d{2,4} (?:people|migrants)\b", re.I)
CROSS_NOT = re.compile(r"so far this year|this year|last year|in 20\d\d|since (?:jan|the start|labour|july)|record year|"
                       r"\bmonth\b|\bweekly\b|\bannual\b|\bstatistics\b|\btotal\b|court|trial|jailed|sentenced", re.I)

# People on the ground who post sightings as they happen (Dan, 4 Oct 2026: "Those people are on the ground").
# Their public Telegram channels are read from t.me/s/<channel>, which needs no key. A post from today that
# mentions boats arriving or crossing counts by itself: no "today" wording needed, it's live.
GROUND = [("Active Patriot UK", "RealActivePatriotUK")]   # also @PatriotActive on X
GROUND_EVENT = re.compile(
    r"\barriv\w*|\blanding|\blanded|\bboats?\b|dinghy|dinghies|border force|\brnli\b|lifeboat|"
    r"\bdover\b|dungeness|folkestone|\bdeal\b|kingsdown|\bcrossings?\b|in the channel", re.I)
GROUND_NOT = re.compile(r"\bcourt\b|\btrial\b|\bcharged\b|\bjailed\b|\bsentenc\w*|\bhotel\b|\bpetition\b|"
                        r"so far this year|this year|last year|\bweek\b|\bmonth\b", re.I)

BLOCK = re.compile(r"channel 4|channel 5|tv channel|youtube channel|channel swim|swim the channel|"
                   r"channel islands|jersey|guernsey|sky channel|"
                   r"^track |in charts|in numbers|explained|explainer|at a glance|key facts", re.I)   # explainers, not news


def text(el, tag, ns=None):
    x = el.find(tag, ns or {})
    return x.text.strip() if x is not None and x.text else ""


def parse_date(s):
    if not s:
        return None
    try:
        d = parsedate_to_datetime(s)                      # RSS: "Mon, 28 Sep 2026 10:15:00 GMT"
    except (TypeError, ValueError):
        try:
            d = datetime.fromisoformat(s.replace("Z", "+00:00"))   # Atom: ISO 8601
        except ValueError:
            return None
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def clean(s):
    s = re.sub(r"<[^>]+>", " ", s or "")
    return re.sub(r"\s+", " ", s).strip()


def read_feed(source, url):
    import requests
    xml = requests.get(url, headers=HEADERS, timeout=30).content
    root = ET.fromstring(xml)
    out = []
    for it in root.iter("item"):                          # RSS
        out.append({"source": source, "title": clean(text(it, "title")), "url": text(it, "link"),
                    "summary": clean(text(it, "description")), "published": parse_date(text(it, "pubDate"))})
    atom = {"a": "http://www.w3.org/2005/Atom"}
    for it in root.findall("a:entry", atom):              # Atom (GOV.UK)
        link = it.find("a:link", atom)
        out.append({"source": source, "title": clean(text(it, "a:title", atom)),
                    "url": link.get("href", "") if link is not None else "",
                    "summary": clean(text(it, "a:summary", atom)),
                    "published": parse_date(text(it, "a:published", atom) or text(it, "a:updated", atom))})
    return out


def read_telegram(source, channel):
    """The latest posts of a public Telegram channel, from its web preview (t.me/s/...)."""
    import html
    import requests
    page = requests.get(f"https://t.me/s/{channel}", headers=HEADERS, timeout=30).text
    out = []
    for block in page.split('class="tgme_widget_message_wrap')[1:]:
        post = re.search(r'data-post="([^"]+)"', block)
        when = re.search(r'<time[^>]*datetime="([^"]+)"', block)
        body = re.search(r'class="tgme_widget_message_text[^"]*"[^>]*>(.*?)</div>', block, re.S)
        if not (post and when and body):
            continue
        t = clean(html.unescape(re.sub(r"<br\s*/?>", " ", body.group(1))))
        out.append({"source": source, "title": t[:160] + ("…" if len(t) > 160 else ""), "summary": t,
                    "url": "https://t.me/" + post.group(1), "published": parse_date(when.group(1)), "ground": True})
    return out


def read_telegram_api(source, channel):
    """The latest posts of a Telegram channel through Telegram's own API (for channels with the web preview off).
    Needs TG_API_ID, TG_API_HASH and TG_SESSION (made once with scripts/tg_login.py) as GitHub secrets."""
    import asyncio
    from telethon import TelegramClient
    from telethon.sessions import StringSession

    async def go():
        out = []
        async with TelegramClient(StringSession(os.environ["TG_SESSION"]), int(os.environ["TG_API_ID"]),
                                  os.environ["TG_API_HASH"]) as client:
            async for m in client.iter_messages(channel, limit=30):
                t = clean(m.message or "")
                if not t or not m.date:
                    continue
                out.append({"source": source, "title": t[:160] + ("…" if len(t) > 160 else ""), "summary": t,
                            "url": f"https://t.me/{channel}/{m.id}", "published": m.date, "ground": True})
        return out
    return asyncio.run(asyncio.wait_for(go(), 60))


def words(title):
    return set(re.findall(r"[a-z]{4,}", title.lower()))


def pick(stories, now):
    fresh = []
    for s in stories:
        if not s["title"] or not s["url"].startswith("http") or not s["published"]:
            continue
        age = now - s["published"]
        if age < timedelta(minutes=-10) or age > timedelta(hours=MAX_AGE_HOURS):
            continue
        blob = s["title"] + " " + s["summary"]
        if not (s.get("politics") or STRONG.search(blob)) or BLOCK.search(blob):
            continue
        fresh.append(s)
    fresh.sort(key=lambda s: s["published"], reverse=True)
    # The same story from several outlets: keep the first (newest) one
    kept = []
    for s in fresh:
        w = words(s["title"])
        if any(len(w & words(k["title"])) / max(1, len(w | words(k["title"]))) > 0.45 for k in kept):
            continue
        if any(s["url"] == k["url"] for k in kept):
            continue
        kept.append(s)
    return kept[:5]


def reported_today(stories, now):
    """The newest story from today (UK time) saying boats are crossing the Channel today, or None."""
    uk = ZoneInfo("Europe/London")
    today = now.astimezone(uk).date()
    hits = []
    for s in stories:
        if not s["title"] or not s["url"].startswith("http") or not s["published"]:
            continue
        if s["published"].astimezone(uk).date() != today or s["published"] > now + timedelta(minutes=10):
            continue
        blob = s["title"] + " " + s["summary"]
        if s.get("ground"):
            if GROUND_EVENT.search(blob) and not GROUND_NOT.search(blob):
                hits.append(s)
        # news: the headline itself must be about boats crossing (a passing mention in the summary isn't enough)
        elif CROSS_EVENT.search(s["title"]) and CROSS_TODAY.search(blob) and not CROSS_NOT.search(s["title"]) and not BLOCK.search(blob):
            hits.append(s)
    if not hits:
        return None
    s = max(hits, key=lambda x: x["published"])
    return {"date": today.isoformat(), "title": s["title"], "url": s["url"], "source": s["source"],
            "published": s["published"].astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "ground": bool(s.get("ground"))}


def main():
    now = datetime.now(timezone.utc)
    stories, read = [], 0
    for source, url in FEEDS:
        try:
            got = read_feed(source, url)
            for g in got:
                g["politics"] = url in POLITICS_FEEDS
            stories += got
            read += 1
            print(f"{source}: {len(got)} items")
        except Exception as e:  # noqa: BLE001 - one broken feed shouldn't stop the others
            print(f"{source}: skipped ({e})")
    if not read:                     # no network, not "no news": keep the stories we have
        print("No feed could be read, so news.json is left as it is")
        return
    items = pick(stories, now)
    for source, channel in GROUND:   # live sightings: only for "reported today", never the news strip
        try:
            api = all(os.environ.get(k) for k in ("TG_API_ID", "TG_API_HASH", "TG_SESSION"))
            got = read_telegram_api(source, channel) if api else read_telegram(source, channel)
            stories += got
            print(f"{source} (Telegram): {len(got)} posts")
        except Exception as e:  # noqa: BLE001
            print(f"{source} (Telegram): skipped ({e})")
    reported = reported_today(stories, now)

    # Manual control: news-override.json can hide stories (by URL) or pin one to the top
    # {"hide": ["https://..."], "pin": {"title": "...", "url": "https://...", "source": "...", "until": "2026-09-30T18:00:00Z"}}
    try:
        old = json.loads(OUT.read_text())
    except (OSError, ValueError):
        old = {}
    # once a crossing has been reported today it stays reported, even after the post or story drops out of its feed
    if not reported and (old.get("reported") or {}).get("date") == now.astimezone(ZoneInfo("Europe/London")).date().isoformat():
        reported = old["reported"]
    # a pinned story keeps the time it was first pinned, so the file only changes when the stories do
    pinned_at = lambda url: parse_date(next((i.get("published", "") for i in old.get("items", []) if i.get("url") == url), ""))
    if OVERRIDE.exists():
        try:
            o = json.loads(OVERRIDE.read_text())
            hide = set(o.get("hide", []))
            items = [s for s in items if s["url"] not in hide]
            pin = o.get("pin")
            if pin and pin.get("url") and parse_date(pin.get("until", "")) and parse_date(pin["until"]) > now:
                items = [{"source": pin.get("source", "Channel Crossings"), "title": pin["title"], "url": pin["url"],
                          "summary": "", "published": pinned_at(pin["url"]) or now, "pinned": True}] + [s for s in items if s["url"] != pin["url"]]
        except Exception as e:  # noqa: BLE001
            print("Override skipped:", e)

    out = {"checkedAt": now.strftime("%Y-%m-%dT%H:%M:%SZ"), "items": [
        {"title": s["title"], "url": s["url"], "source": s["source"],
         "published": s["published"].astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
         "breaking": True}   # older stories were dropped by pick(), so everything kept is breaking
        for s in items], "reported": reported}
    # Only rewrite the file when the stories change, so the site isn't republished every 15 minutes for nothing
    if old.get("items") == out["items"] and old.get("reported") == out["reported"]:
        print("No change")
        return
    OUT.write_text(json.dumps(out, indent=1) + "\n")
    print(f"{len(items)} story(ies) kept")


if __name__ == "__main__":
    sys.exit(main())
