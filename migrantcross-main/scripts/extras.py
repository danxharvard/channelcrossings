"""Extra data for the dashboard, gathered by the daily update.

  gender.json        small boat arrivals by sex and age (Home Office quarterly dataset)
  nationalities.json small boat arrivals by nationality (the same quarterly dataset)
  natyears.json      the same, for every year since 2018 (Studio's Ask for a chart)
  perboat.json       average people per boat, worked out from the daily figures
  returns.json       UK-France "one in, one out" transfers and returns (Home Office monthly table)
  petitions.json     open UK Parliament petitions about small boat crossings

Each part is independent: if one source fails, the others still update and the
page keeps showing the last good file.
"""
import io
import json
import os
import re
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
H = {"User-Agent": "channel-crossings-tracker (GitHub Action)"}


def save(name, obj):
    """Write via a temporary file: update_all() carries on after a failure, so a half-written file would be published.
    Nothing is written when only updatedAt would change (the page doesn't use it), so a quiet day adds no noise."""
    try:
        if {**json.loads((ROOT / name).read_text()), "updatedAt": obj.get("updatedAt")} == obj:
            return
    except (OSError, ValueError, TypeError):
        pass
    tmp = ROOT / (name + ".tmp")
    tmp.write_text(json.dumps(obj, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    os.replace(tmp, ROOT / name)


def now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


# ------------------------------------------------------------ by sex and age

TABLES = "https://www.gov.uk/government/statistical-data-sets/immigration-system-statistics-data-tables"


_CACHE = {}


def dataset_url():
    """Link to the latest quarterly illegal entry routes spreadsheet on GOV.UK."""
    if "url" not in _CACHE:
        page = requests.get(TABLES, headers=H, timeout=60).text
        links = re.findall(r'https://assets\.publishing\.service\.gov\.uk/[^"\']+\.xlsx', page)
        _CACHE["url"] = next(l for l in links if re.search(r"(illegal-entry-routes|irregular-migration).*dataset", l, re.I))
    return _CACHE["url"]


def workbook():
    """The spreadsheet, downloaded once per run however many boxes need it."""
    if "wb" not in _CACHE:
        import openpyxl
        raw = requests.get(dataset_url(), headers=H, timeout=180).content
        _CACHE["wb"] = openpyxl.load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
    return _CACHE["wb"]


def unchanged(name, url):
    f = ROOT / name
    return f.exists() and json.loads(f.read_text()).get("source") == url


def year_ending(quarter):
    y, qn = int(quarter[:4]), int(quarter[-1])
    return f"year ending {({1: 'March', 2: 'June', 3: 'September', 4: 'December'})[qn]} {y}"


def update_gender():
    url = dataset_url()
    if unchanged("gender.json", url):
        print("Sex and age: dataset unchanged")
        return
    wb = workbook()
    ws = next(s for s in wb.worksheets if s.title.lower().startswith("data_") and ("d01" in s.title.lower()))
    rows = ws.iter_rows(values_only=True)
    head = None
    for r in rows:
        cells = [str(c).strip().lower() if c is not None else "" for c in r]
        if "sex" in cells and "quarter" in cells:
            head = cells
            break
    col = {k: head.index(k) for k in ("quarter", "method of entry", "sex", "age group")}
    col["n"] = next(i for i, c in enumerate(head) if "number" in c)

    recs = []
    for r in rows:
        if r is None or len(r) <= col["n"] or r[col["quarter"]] is None:
            continue
        if "small boat" not in str(r[col["method of entry"]]).lower():
            continue
        try:
            n = int(r[col["n"]] or 0)
        except (TypeError, ValueError):
            continue
        recs.append((str(r[col["quarter"]]).strip(), str(r[col["sex"]]).strip(), str(r[col["age group"]]).strip(), n))
    quarters = sorted({q for q, *_ in recs if re.fullmatch(r"\d{4} Q[1-4]", q)})   # not totals or notes
    last4 = set(quarters[-4:])

    def tally(keep):
        sex = {"Male": 0, "Female": 0, "Unknown": 0}
        age = {"17 and under": 0, "18 to 24": 0, "25 to 39": 0, "40 and over": 0, "Unknown": 0}
        adult_men = 0
        for q, s, a, n in recs:
            if not keep(q):
                continue
            sex[s if s in ("Male", "Female") else "Unknown"] += n
            age[a if a in age else "Unknown"] += n
            if s == "Male" and a in ("18 to 24", "25 to 39", "40 and over"):
                adult_men += n
        return {"sex": sex, "age": age, "adultMen": adult_men, "total": sum(sex.values())}

    last_q = quarters[-1]                              # e.g. "2026 Q2"
    save("gender.json", {
        "source": url,
        "latestQuarter": last_q,
        "period": year_ending(last_q),
        "lastYear": tally(lambda q: q in last4),
        "since2018": tally(lambda q: q in quarters),
        "updatedAt": now_iso(),
    })
    print(f"Sex and age: saved, latest quarter {last_q}")


# ------------------------------------------------------------ by nationality

def find_table(need, prefer="d01"):
    """First data sheet with a header row holding every column in `need`: (header, row iterator)."""
    sheets = [ws for ws in workbook().worksheets if ws.title.lower().startswith("data_")]
    sheets.sort(key=lambda ws: prefer not in ws.title.lower())
    for ws in sheets:
        rows = ws.iter_rows(values_only=True)
        for i, r in enumerate(rows):
            if i > 40:
                break
            cells = [str(c).strip().lower() if c is not None else "" for c in r]
            if all(k in cells for k in need):
                return cells, rows
    raise LookupError("no sheet with " + ", ".join(need))


def update_nationalities():
    url = dataset_url()
    if unchanged("nationalities.json", url):
        print("Nationalities: dataset unchanged")
        return
    head, rows = find_table(("quarter", "method of entry", "nationality"))
    qc, mc, nc = head.index("quarter"), head.index("method of entry"), head.index("nationality")
    num = next(i for i, c in enumerate(head) if "number" in c)
    counts = {}                                        # (quarter, nationality) -> people
    for r in rows:
        if r is None or len(r) <= num or r[qc] is None or "small boat" not in str(r[mc]).lower():
            continue
        try:
            n = int(r[num] or 0)
        except (TypeError, ValueError):
            continue
        k = (str(r[qc]).strip(), str(r[nc]).strip())
        counts[k] = counts.get(k, 0) + n
    quarters = sorted({q for q, _ in counts if re.fullmatch(r"\d{4} Q[1-4]", q)})
    if len(quarters) < 8:
        raise ValueError(f"only {len(quarters)} quarters found")
    this, before = set(quarters[-4:]), set(quarters[-8:-4])

    def year(keep):
        out = {}
        for (q, nat), n in counts.items():
            if q in keep:
                out[nat] = out.get(nat, 0) + n
        return out
    now, prev = year(this), year(before)
    total = sum(now.values())
    unknown = re.compile(r"unknown|not (currently )?recorded|not known|other", re.I)
    ranked = sorted((k for k in now if not unknown.search(k)), key=lambda k: -now[k])[:5]
    top = [{"name": k, "n": now[k], "pc": round(now[k] / total * 100, 1),
            "change": round((now[k] / prev[k] - 1) * 100) if prev.get(k) else None} for k in ranked]
    if total < 1000 or not top:
        raise ValueError("figures look wrong")
    save("nationalities.json", {
        "source": url,
        "latestQuarter": quarters[-1],
        "period": year_ending(quarters[-1]),
        "total": total,
        "top": top,
        "other": total - sum(t["n"] for t in top),
        "updatedAt": now_iso(),
    })
    print(f"Nationalities: saved, top {ranked[0]} for {year_ending(quarters[-1])}")


def update_nat_years():
    """Small boat arrivals by nationality for every year since records began (natyears.json), for Studio's Ask for a chart.
    The 20 largest nationalities over all the years, plus any that were in a year's top five; the rest is the gap to the total."""
    url = dataset_url()
    if unchanged("natyears.json", url):
        print("Nationalities by year: dataset unchanged")
        return
    head, rows = find_table(("quarter", "method of entry", "nationality"))
    qc, mc, nc = head.index("quarter"), head.index("method of entry"), head.index("nationality")
    num = next(i for i, c in enumerate(head) if "number" in c)
    counts, quarters = {}, set()                       # (year, nationality) -> people
    for r in rows:
        if r is None or len(r) <= num or r[qc] is None or "small boat" not in str(r[mc]).lower():
            continue
        q = str(r[qc]).strip()
        if not re.fullmatch(r"\d{4} Q[1-4]", q):
            continue
        try:
            n = int(r[num] or 0)
        except (TypeError, ValueError):
            continue
        quarters.add(q)
        k = (q[:4], str(r[nc]).strip())
        counts[k] = counts.get(k, 0) + n
    years = sorted({y for y, _ in counts})
    if len(years) < 3:
        raise ValueError(f"only {len(years)} years found")
    total = [sum(n for (y, _), n in counts.items() if y == yr) for yr in years]
    unknown = re.compile(r"unknown|not (currently )?recorded|not known|other", re.I)
    names = {k for _, k in counts if not unknown.search(k)}
    overall = sorted(names, key=lambda k: -sum(counts.get((y, k), 0) for y in years))
    keep = set(overall[:20])
    for y in years:
        keep |= set(sorted(names, key=lambda k: -counts.get((y, k), 0))[:5])
    nats = [{"name": k, "n": [counts.get((y, k), 0) for y in years]} for k in overall if k in keep]
    if sum(total) < 10000:
        raise ValueError("figures look wrong")
    last_q = max(quarters)
    in_last = sum(1 for q in quarters if q.startswith(last_q[:4]))
    save("natyears.json", {
        "source": url,
        "latestQuarter": last_q,
        "years": years,
        "partial": {last_q[:4]: in_last} if in_last < 4 else {},   # the latest year, when its quarters aren't all in
        "total": total,
        "nats": nats,
        "updatedAt": now_iso(),
    })
    print(f"Nationalities by year: saved {years[0]} to {last_q}")


# ------------------------------------------------------------ what happened to their asylum claims

GROUPS = {"grant of protection": "granted", "grant of other leave": "granted", "refused": "refused",
          "withdrawn": "withdrawn", "administrative outcome": "withdrawn", "awaiting initial decision": "waiting"}


def update_asylum():
    """Claims and first decisions for small boat arrivals, by year of arrival (tables IER_D02 and IER_D03)."""
    url = dataset_url()
    if unchanged("asylum.json", url):
        print("Asylum outcomes: dataset unchanged")
        return
    head, rows = find_table(("quarter", "asylum claim", "applicant type", "arrivals"), prefer="d02")
    qc, cc, n = head.index("quarter"), head.index("asylum claim"), head.index("arrivals")
    arrived, claimed = {}, {}
    for r in rows:
        if r is None or len(r) <= n or not re.fullmatch(r"\d{4} Q[1-4]", str(r[qc] or "").strip()):
            continue
        y, k = str(r[qc]).strip()[:4], int(r[n] or 0)
        arrived[y] = arrived.get(y, 0) + k
        if str(r[cc]).strip().lower() == "asylum claim raised":
            claimed[y] = claimed.get(y, 0) + k

    head, rows = find_table(("quarter", "asylum case outcome group", "applicant type", "outcomes"), prefer="d03")
    qc, gc, ac, n = head.index("quarter"), head.index("asylum case outcome group"), head.index("applicant type"), head.index("outcomes")
    years, quarters, main = {}, set(), {"granted": 0, "refused": 0}
    for r in rows:
        if r is None or len(r) <= n or not re.fullmatch(r"\d{4} Q[1-4]", str(r[qc] or "").strip()):
            continue
        g = GROUPS.get(str(r[gc]).strip().lower())
        if not g:
            raise ValueError(f"unknown outcome group {r[gc]!r}")
        q, k = str(r[qc]).strip(), int(r[n] or 0)
        quarters.add(q)
        t = years.setdefault(q[:4], {"granted": 0, "refused": 0, "withdrawn": 0, "waiting": 0})
        t[g] += k
        if g in main and str(r[ac]).strip().lower() == "main applicant":
            main[g] += k                               # the Home Office's grant rate counts cases, not people

    out = [{"year": int(y), "arrived": arrived.get(y, 0), "claimed": claimed.get(y, 0), **years[y]} for y in sorted(years)]
    total = {k: sum(y[k] for y in out) for k in ("arrived", "claimed", "granted", "refused", "withdrawn", "waiting")}
    total["decided"] = total["granted"] + total["refused"]
    total["grantRate"] = round(main["granted"] / (main["granted"] + main["refused"]) * 100)
    if total["claimed"] < 10000 or abs(sum(total[k] for k in ("granted", "refused", "withdrawn", "waiting")) - total["claimed"]) > total["claimed"] * 0.02:
        raise ValueError(f"figures look wrong: {total}")
    last = max(quarters)
    save("asylum.json", {
        "source": url,
        "from": out[0]["year"],
        "latestQuarter": last,
        "period": f"arrivals from {out[0]['year']} to the end of {last[:4]}" if last.endswith("Q4") else f"arrivals from {out[0]['year']} to {last}",
        "total": total,
        "years": out,
        "updatedAt": now_iso(),
    })
    print(f"Asylum outcomes: saved, arrivals to {last}, grant rate {total['grantRate']}%")


# ------------------------------------------------------------ small boat arrivals returned from the UK

def update_boat_returns(days):
    """Returns of people who came by small boat, each quarter and by nationality (summary tables Ret_06a and Ret_06b)."""
    import pandas as pd
    page = requests.get(TABLES, headers=H, timeout=60).text
    url = next(l for l in re.findall(r'https://assets\.publishing\.service\.gov\.uk/[^"\']+\.(?:ods|xlsx)', page)
               if re.search(r"returns-summary", l, re.I))
    if unchanged("boatreturns.json", url):
        print("Small boat returns: tables unchanged")
        return
    sheets = pd.read_excel(io.BytesIO(requests.get(url, headers=H, timeout=180).content), sheet_name=None, header=None)
    a = next(df for name, df in sheets.items() if name.lower().startswith("ret_06a"))
    b = next(df for name, df in sheets.items() if name.lower().startswith("ret_06b"))
    quarters = []
    for label, n in a.iloc[:, :2].itertuples(index=False):
        m = re.fullmatch(r"(\d{4} Q[1-4])( \[p\])?", str(label).strip())
        if m and pd.notna(n):
            quarters.append({"q": m.group(1), "n": int(n), **({"p": True} if m.group(2) else {})})
    top, total = [], 0
    for label, n in b.iloc[:, :2].itertuples(index=False):
        label = str(label).strip()
        if pd.isna(n) or not re.fullmatch(r"\d+(\.0)?", str(n)):
            continue
        if label.lower() == "total":
            total = int(n)
        elif label.lower() != "other":
            top.append({"name": label, "n": int(n)})
    if len(quarters) < 12 or not total:
        raise ValueError("figures look wrong")
    year, before = sum(q["n"] for q in quarters[-4:]), sum(q["n"] for q in quarters[-8:-4])
    if abs(year - total) > 5:
        raise ValueError(f"quarters add to {year}, the nationality table to {total}")
    last = quarters[-1]["q"]
    y, qn = int(last[:4]), int(last[-1])           # the year ending with that quarter, for the arrivals over the same months
    end = date(y, qn * 3, 1) + timedelta(days=31)
    end = end.replace(day=1)
    start = end.replace(year=end.year - 1)
    arrived = sum(d.get("migrants") or 0 for d in days if start.isoformat() <= d["date"] < end.isoformat())
    save("boatreturns.json", {
        "source": url,
        "latestQuarter": last,
        "period": year_ending(last),
        "year": year,
        "change": round((year / before - 1) * 100) if before else None,
        "arrived": arrived or None,
        "quarters": quarters,
        "top": top[:5],
        "updatedAt": now_iso(),
    })
    print(f"Small boat returns: saved, {year} in the {year_ending(last)}")


# ------------------------------------------------------------ people per boat (from the daily figures)

def update_perboat(days):
    days = [d for d in days if d.get("date")]
    if not days:
        return
    years, months = {}, {}
    for d in days:
        b = d.get("boats") or 0
        if not b:
            continue
        for key, bucket in ((d["date"][:4], years), (d["date"][:7], months)):
            p = bucket.setdefault(key, [0, 0])
            p[0] += d["migrants"]
            p[1] += b
    last = days[-1]["date"]
    since = (date.fromisoformat(last) - timedelta(days=89)).isoformat()
    recent = [d for d in days if d["date"] >= since and d.get("boats")]
    rp, rb = sum(d["migrants"] for d in recent), sum(d["boats"] for d in recent)
    busy = {m: v for m, v in months.items() if v[1] >= 5}          # ignore months with a handful of boats
    best = max(busy, key=lambda m: busy[m][0] / busy[m][1]) if busy else None
    save("perboat.json", {
        "years": [{"y": y, "people": p, "boats": b, "avg": round(p / b)} for y, (p, b) in sorted(years.items())],
        "partialYear": last[:4] if last[5:] != "12-31" else None,
        "last90": {"people": rp, "boats": rb, "avg": round(rp / rb) if rb else None, "to": last},
        "recordMonth": {"month": best, "avg": round(busy[best][0] / busy[best][1])} if best else None,
        "updatedAt": now_iso(),
    })
    print("People per boat: saved")


# ------------------------------------------------------------ UK-France returns

RETURNS_COLLECTION = "https://www.gov.uk/api/content/government/publications/the-border-security-commanders-annual-report-data"
RETURNS_TITLE = re.compile(r"transfers into and returns from the United Kingdom under the UK.France Agreement", re.I)


def count(v):
    """A table cell as a whole number: a column with a blank cell reads as floats (12.0 is 12, not 120), and
    "12 [note 3]" or "1,204" keep only the leading number."""
    if isinstance(v, float):
        return 0 if v != v else int(v)
    m = re.match(r"\s*(\d[\d,]*)", str(v))
    return int(m.group(1).replace(",", "")) if m else 0


def _period(title):
    """'... between 6 August 2025 and 30 June 2026' -> ('2025-08-06', '2026-06-30')"""
    m = re.search(r"between (\d{1,2} \w+ \d{4}) and (\d{1,2} \w+ \d{4})", title)
    if not m:
        return None, None
    f = lambda s: datetime.strptime(s, "%d %B %Y").date().isoformat()
    return f(m.group(1)), f(m.group(2))


def returns_pages():
    """Every GOV.UK page of UK-France transfer and return figures we can find: (title, url)."""
    found = {}
    try:
        for a in requests.get(RETURNS_COLLECTION, headers=H, timeout=60).json().get("details", {}).get("attachments", []):
            if RETURNS_TITLE.search(a.get("title", "")):
                found[a["url"]] = a["title"]
    except Exception as e:  # noqa: BLE001
        print("Returns: collection not read:", e)
    try:
        res = requests.get("https://www.gov.uk/api/search.json", headers=H, timeout=60, params={
            "q": "Transfers into and returns from the United Kingdom under the UK-France Agreement",
            "count": 20, "order": "-public_timestamp", "fields": "title,link"}).json().get("results", [])
        for x in res:
            if RETURNS_TITLE.search(x.get("title", "")):
                found[x["link"]] = x["title"]
    except Exception as e:  # noqa: BLE001
        print("Returns: search not read:", e)
    return [(t, u if u.startswith("http") else "https://www.gov.uk" + u) for u, t in found.items()]


def update_returns(days):
    import pandas as pd
    pages = [p for p in returns_pages() if _period(p[0])[1]]
    if not pages:
        raise LookupError("no UK-France returns page found")
    title, url = max(pages, key=lambda p: _period(p[0])[1])           # the most recent period
    start, end = _period(title)
    html = requests.get(url, headers=H, timeout=60).text
    months = []
    for t in pd.read_html(io.StringIO(html)):
        cols = [" ".join(map(str, c)) if isinstance(c, tuple) else str(c) for c in t.columns]
        find = lambda pat: next((i for i, c in enumerate(cols) if re.search(pat, c, re.I)), None)
        ci, co = find(r"^\s*in\b|transfer"), find(r"^\s*out\b|return")
        cy, cm = find(r"year"), find(r"month")
        if ci is None or co is None or cm is None:
            continue
        year = None
        for row in t.itertuples(index=False):
            if cy is not None and re.fullmatch(r"\d{4}", str(row[cy]).strip()):
                year = str(row[cy]).strip()                                # years may only be given once
            text = str(row[cm]).strip()
            if not re.search(r"\d{4}", text) and year:
                text += " " + year
            try:
                m = datetime.strptime(text, "%B %Y").strftime("%Y-%m")
            except ValueError:
                continue                                                  # the total row, notes
            months.append({"month": m, "in": count(row[ci]), "out": count(row[co])})
        if months:
            break
    if not months:
        raise ValueError("no monthly table on " + url)
    tin, tout = sum(m["in"] for m in months), sum(m["out"] for m in months)
    arrivals = sum(d["migrants"] for d in days if start <= d["date"] <= end) if days else None
    save("returns.json", {
        "source": url, "title": title, "from": start, "to": end,
        "months": months, "in": tin, "out": tout,
        "arrivals": arrivals,
        "updatedAt": now_iso(),
    })
    print(f"UK-France returns: saved to {end}, {tout} out, {tin} in")


# ------------------------------------------------------------ petitions

PETITION_SEARCHES = ["small boats", "small boat", "channel crossings", "channel migrants", "illegal crossings"]
PETITION_WORDS = re.compile(r"small boat|channel crossing|cross(ing)? the channel|english channel|dinghies|boats? back", re.I)


def update_petitions():
    found = {}
    for q in PETITION_SEARCHES:
        for state in ("open", "closed"):
            r = requests.get("https://petition.parliament.uk/petitions.json", params={"q": q, "state": state},
                             headers=H, timeout=60)
            r.raise_for_status()
            for p in r.json().get("data", []):
                a = p["attributes"]
                text = " ".join(str(a.get(k) or "") for k in ("action", "background"))
                if not PETITION_WORDS.search(text):
                    continue
                if state == "closed" and (a.get("closed_at") or "") < (date.today() - timedelta(days=365)).isoformat():
                    continue          # keep closed petitions from the past year only
                found[p["id"]] = {
                    "id": p["id"],
                    "title": a["action"],
                    "signatures": a.get("signature_count", 0),
                    "state": a.get("state"),
                    "closes": (a.get("closing_date") or a.get("closed_at") or "")[:10],
                    "response": bool(a.get("government_response")),
                    "debated": bool(a.get("debate")),
                    "url": f"https://petition.parliament.uk/petitions/{p['id']}",
                }
    items = sorted(found.values(), key=lambda p: (p["state"] != "open", -p["signatures"]))[:6]                       # the page shows six
    save("petitions.json", {"petitions": items, "updatedAt": now_iso()})
    print(f"Petitions: {len(items)} saved")


def update_all(days=None):
    days = days or []
    for name, job in (("sex and age", update_gender),
                      ("nationalities", update_nationalities),
                      ("nationalities by year", update_nat_years),
                      ("asylum outcomes", update_asylum),
                      ("small boat returns", lambda: update_boat_returns(days)),
                      ("people per boat", lambda: update_perboat(days)),
                      ("UK-France returns", lambda: update_returns(days)),
                      ("petitions", update_petitions)):
        try:
            job()
        except Exception as e:  # noqa: BLE001 - keep the last good file
            print(f"{name} skipped: {e}")


if __name__ == "__main__":        # run the extras on their own: python scripts/extras.py
    update_all(json.loads((ROOT / "data.json").read_text())["days"])
