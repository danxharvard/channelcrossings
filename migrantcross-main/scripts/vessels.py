"""Collect the positions of lifeboats, Border Force, coastguard and navy vessels in the Dover Strait.

Runs from .github/workflows/vessels.yml every 15 minutes. Listens to aisstream.io's free live AIS feed for a
couple of minutes, keeps only rescue and government vessels, and writes vessels.json for the map.
Needs the AISSTREAM_KEY secret (free: sign in at aisstream.io with GitHub, then make an API key);
without it the script does nothing.

How a vessel is recognised:
  - its AIS ship type: 51 search and rescue, 55 law enforcement, 35 military
  - or its name: RNLI/RNLB lifeboats, the Gosport lifeboats (GAFIRS: Joan Dora Fuller, Ian Fuller), HMC (Border Force
    cutters), HMS, and the French state vessels named in NAMES below
  - or it is a search and rescue aircraft (AIS message 9), such as the coastguard helicopter
A ship's type only comes with its static report (every few minutes), so what we learn is kept in vessels.json and
remembered for 30 days, and a vessel seen once is recognised from its position reports alone afterwards.
"""
import asyncio
import json
import os
import re
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "vessels.json"
URL = "wss://stream.aisstream.io/v0/stream"
BOX = [[50.30, 0.00], [51.60, 2.70]]   # Beachy Head to Dunkirk, Le Touquet to North Foreland
SOLENT = [[50.70, -1.45], [50.90, -0.95]]   # Portsmouth Harbour and the eastern Solent, for the Gosport lifeboats
LISTEN = 150                           # seconds; most vessels report their position every few seconds to 3 minutes
FORGET = timedelta(days=30)            # what we know about a vessel we haven't seen for this long is dropped

TYPES = {51: "rescue", 55: "border", 35: "navy"}
# French state vessels that patrol the coast and shadow or rescue the small boats are matched too: SNSM lifeboats, the
# Abeille emergency tugs, the Gendarmerie maritime, the Douanes (customs, "DF" cutters), the Affaires maritimes and the
# Marine nationale patrol boats based in Cherbourg and Boulogne. Only official vessels: never private or named boats.
NAMES = [(re.compile(r"\b(RNLI|RNLB|LIFEBOAT|SNSM|SAUVETEUR|ABEILLE|GAFIRS|GOSPORT ILB|JOAN DORA FULLER|IAN FULLER)\b"), "rescue"),
         (re.compile(r"^(HMC|UKBF|BORDER FORCE)\b|\b(GENDARMERIE|GENDARMES|DOUANES?|AFFAIRES MARITIMES)\b|^DF ?\d"), "border"),
         (re.compile(r"^(HMS|HMNB|FS)\b|\bMARINE NATIONALE\b|^(FLAMANT|CORMORAN|PLUVIER)$"), "navy")]
POSITION = {"PositionReport", "StandardClassBPositionReport", "ExtendedClassBPositionReport", "StandardSearchAndRescueAircraftReport"}
STATIC = {"ShipStaticData", "StaticDataReport"}


def kind_of(name, ship_type):
    for rx, k in NAMES:
        if rx.search(name or ""):
            return k
    return TYPES.get(ship_type)


def num(v, lo, hi):
    """A number from an AIS field, or None for the 'not available' values (heading 511, speed 102.3 and so on)."""
    return round(v, 1) if isinstance(v, (int, float)) and lo <= v <= hi else None


async def listen(key, known):
    import websockets
    seen = {}
    sub = {"APIKey": key, "BoundingBoxes": [BOX, SOLENT], "FilterMessageTypes": sorted(POSITION | STATIC)}
    deadline = time.monotonic() + LISTEN
    async with websockets.connect(URL, open_timeout=30, compression="deflate", max_size=2**20) as ws:
        await ws.send(json.dumps(sub))
        while (left := deadline - time.monotonic()) > 0:
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=left)
            except (asyncio.TimeoutError, websockets.ConnectionClosed):
                break                          # time's up, or the feed hung up: keep what was heard so far
            try:
                m = json.loads(raw)
            except ValueError:
                continue                       # one garbled message shouldn't throw away the whole run
            if not isinstance(m, dict):
                continue
            if "error" in m:
                sys.exit("aisstream: " + str(m["error"]))
            t, meta = m.get("MessageType"), m.get("MetaData") or {}
            body = (m.get("Message") or {}).get(t) or {}
            mmsi = meta.get("MMSI") or body.get("UserID")
            if not mmsi:
                continue
            mmsi = str(mmsi)
            v = known.setdefault(mmsi, {"mmsi": mmsi})
            name = (meta.get("ShipName") or "").strip() or v.get("name")
            if name:
                v["name"] = re.sub(r"\s+", " ", name.strip("@ "))
            if t in STATIC:
                st = body.get("Type") or (body.get("ReportB") or {}).get("ShipType")
                if isinstance(st, int) and st:
                    v["type"] = st
                continue
            if t == "StandardSearchAndRescueAircraftReport":
                v["kind"] = "aircraft"
            lat, lon = num(meta.get("latitude"), -90, 90), num(meta.get("longitude"), -180, 180)
            if lat is None or lon is None:
                continue
            v.update(lat=round(meta["latitude"], 5), lon=round(meta["longitude"], 5), sog=num(body.get("Sog"), 0, 1022 if t.endswith("AircraftReport") else 102.2),
                     cog=num(body.get("Cog"), 0, 359.9), hdg=num(body.get("TrueHeading"), 0, 359),
                     seen=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"))
            seen[mmsi] = v
    return seen


def main():
    key = os.environ.get("AISSTREAM_KEY", "").strip()
    if not key:
        print("No AISSTREAM_KEY secret yet, so no vessel positions")
        return
    old = json.loads(OUT.read_text()) if OUT.exists() else {"vessels": []}
    known = {v["mmsi"]: v for v in old.get("vessels", [])}
    # everyone else's details, so a ship type learned this run sticks to its MMSI; trimmed to ours before saving
    others = {}
    try:
        heard = asyncio.run(listen(key, others))
    except Exception as e:
        # the feed has no uptime promise: a failed run just keeps the last positions
        print("aisstream unavailable:", repr(e))
        return
    for mmsi, v in others.items():
        k = v.get("kind") or kind_of(v.get("name"), v.get("type")) or known.get(mmsi, {}).get("kind")
        if not k:
            continue
        mine = known.setdefault(mmsi, {"mmsi": mmsi})
        mine.update({x: v[x] for x in ("name", "type") if v.get(x)})
        if v.get("seen"):   # heard this run: its latest position and movement replace the last ones
            for x in ("lat", "lon", "sog", "cog", "hdg", "seen"):
                mine.pop(x, None)
                if v.get(x) is not None:
                    mine[x] = v[x]
        mine["kind"] = k
    cutoff = datetime.now(timezone.utc) - FORGET
    keep = [v for v in known.values() if v.get("seen") and datetime.fromisoformat(v["seen"].replace("Z", "+00:00")) > cutoff]
    keep.sort(key=lambda v: v["seen"], reverse=True)
    OUT.write_text(json.dumps({"vessels": keep}, separators=(",", ":")) + "\n")   # unchanged when nothing was heard, so no commit
    print(f"Heard {len(heard)} vessels; {sum(1 for v in heard if v in known)} rescue or government; {len(keep)} remembered")


if __name__ == "__main__":
    main()
