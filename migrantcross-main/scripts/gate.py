"""Decide whether this run of the update job should check GOV.UK.

The job is scheduled every 15 minutes through the afternoon and evening (see update.yml).
It only goes on to check when all of these are true:
  - it is 12:00 noon UK time or later
  - we don't already have yesterday's figures (so once they're published, no more checks
    until noon tomorrow)
A run started by hand from the Actions tab always checks.

Uses only the standard library, so it runs before anything is installed and a skipped run
takes a few seconds.
"""
import json
import os
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
START_HOUR = 12          # noon UK time: checks, and the page's "New figures incoming" notice, start here


def latest_held():
    try:
        return json.loads((ROOT / "status.json").read_text()).get("latest") or ""
    except (OSError, ValueError):
        return ""


def decide(now, latest, by_hand=False):
    yesterday = (now.date() - timedelta(days=1)).isoformat()
    if by_hand:
        return True, "Run by hand"
    if now.hour < START_HOUR:
        return False, f"Before {START_HOUR}:00 UK time"
    if latest >= yesterday:
        return False, f"Already have the figures up to {latest}: next check tomorrow at {START_HOUR}:00"
    return True, f"Waiting for figures for {yesterday} (latest held: {latest or 'none'})"


def main():
    now = datetime.now(ZoneInfo("Europe/London"))
    run, why = decide(now, latest_held(), os.environ.get("GITHUB_EVENT_NAME") == "workflow_dispatch")
    print(why)
    out = os.environ.get("GITHUB_OUTPUT")
    if out:
        with open(out, "a") as f:
            f.write(f"run={'true' if run else 'false'}\n")


if __name__ == "__main__":
    main()
