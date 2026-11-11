"""Post the latest daily figures to the Channel Crossings Facebook Page.

Runs from .github/workflows/update.yml straight after new figures are published.
Posts once for each new set of figures, with the link preview picture (og-image.png)
and a short caption. fb.json remembers the last day posted, so a day is never posted twice.

Needs two GitHub secrets (Settings > Secrets and variables > Actions):
  FB_PAGE_ID     the Page's ID number
  FB_PAGE_TOKEN  a Page access token with pages_manage_posts (one made from a
                 long-lived user token doesn't expire)
Until both are set, this does nothing.
"""
import json
import os
import sys
from datetime import date, datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STATE = ROOT / "fb.json"
GRAPH = "https://graph.facebook.com/v25.0"      # supported until July 2028
SITE = "https://channelcrossings.world"
MAX_DAYS = 7                                     # never post a backlog older than a week


def nice(iso):
    d = date.fromisoformat(iso)
    return f"{d:%A} {d.day} {d:%B}"


def caption(days, new):
    """new: the days not posted yet, oldest first. The totals run to the latest day."""
    last = new[-1]
    lines = []
    if len(new) == 1:
        n, b = last["migrants"], last.get("boats") or 0
        if n:
            lines.append(f"{n:,} {'person' if n == 1 else 'people'} crossed the Channel in small boats on "
                         f"{nice(last['date'])}, in {b:,} {'boat' if b == 1 else 'boats'}.")
        else:
            lines.append(f"No small boat crossings of the Channel were detected on {nice(last['date'])}.")
    else:
        total = sum(d["migrants"] for d in new)
        lines.append(f"{total:,} {'person' if total == 1 else 'people'} crossed the Channel in small boats "
                     f"over the last {len(new)} days of figures:")
        for d in new:
            n, b = d["migrants"], d.get("boats") or 0
            lines.append(f"• {nice(d['date'])}: " + (f"{n:,} in {b:,} {'boat' if b == 1 else 'boats'}" if n else "none"))
    lines.append("")

    yr = last["date"][:4]
    ytd = sum(d["migrants"] for d in days if d["date"][:4] == yr and d["date"] <= last["date"])
    prev_cut = str(int(yr) - 1) + last["date"][4:]
    prev = sum(d["migrants"] for d in days if d["date"][:4] == str(int(yr) - 1) and d["date"] <= prev_cut)
    line = f"{yr} so far: {ytd:,}"
    if prev:
        pct = round((ytd / prev - 1) * 100)
        line += f" ({'up' if pct > 0 else 'down'} {abs(pct)}% on {int(yr) - 1} at the same point)" if pct else f" (the same as {int(yr) - 1})"
    lines.append(line + ".")
    week = [d for d in days if d["date"] <= last["date"]][-7:]
    lines.append(f"Last 7 days: {sum(d['migrants'] for d in week):,}.")
    lines += ["", "Source: Home Office provisional figures.", f"Charts, records and running totals: {SITE}"]
    return "\n".join(lines)


def main():
    page, token = os.environ.get("FB_PAGE_ID"), os.environ.get("FB_PAGE_TOKEN")
    if not page or not token:
        print("Facebook: not set up (FB_PAGE_ID and FB_PAGE_TOKEN secrets), skipping")
        return
    days = json.loads((ROOT / "data.json").read_text())["days"]
    state = json.loads(STATE.read_text()) if STATE.exists() else {}
    posted = state.get("lastPosted") or ""
    latest = days[-1]["date"]
    if latest <= posted:
        print(f"Facebook: already posted figures to {posted}")
        return
    cutoff = (date.fromisoformat(latest).toordinal() - MAX_DAYS + 1)
    new = [d for d in days if d["date"] > posted and date.fromisoformat(d["date"]).toordinal() >= cutoff]
    if not posted:
        new = new[-1:]                      # first ever post: just the latest day
    text = caption(days, new)

    import requests
    with open(ROOT / "og-image.png", "rb") as img:
        r = requests.post(f"{GRAPH}/{page}/photos", timeout=120,
                          data={"caption": text, "access_token": token},
                          files={"source": ("channel-crossings.png", img, "image/png")})
    body = r.json() if r.headers.get("content-type", "").startswith(("application/json", "text/javascript")) else {}
    if not r.ok or "id" not in body:
        err = body.get("error", {})
        print(f"Facebook: post failed ({r.status_code}): {err.get('message') or r.text[:300]}", file=sys.stderr)
        if err.get("code") == 190:
            print("The Page token has expired or been revoked. Make a new one and update the FB_PAGE_TOKEN secret.",
                  file=sys.stderr)
        sys.exit(1)                          # fails the step so GitHub emails you; the figures are already published
    STATE.write_text(json.dumps({"lastPosted": latest, "postId": body.get("post_id") or body["id"],
                                 "postedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")}, indent=1) + "\n")
    print(f"Facebook: posted figures to {latest}")


if __name__ == "__main__":
    if "--preview" in sys.argv:              # show the caption without posting: python scripts/facebook.py --preview
        d = json.loads((ROOT / "data.json").read_text())["days"]
        print(caption(d, d[-1:]))
    else:
        main()
