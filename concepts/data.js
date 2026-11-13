/* Shared data loader for the UI concepts. Reads the same JSON files as the live site. */
(function () {
  const BASE = "../";
  const get = (f) => fetch(BASE + f, { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const fmt = (n) => (n == null ? "–" : Math.round(n).toLocaleString("en-GB"));
  const d8 = (s) => new Date(s + "T12:00:00Z");
  const doy = (s) => { const d = d8(s); return Math.floor((d - Date.UTC(d.getUTCFullYear(), 0, 1, 12)) / 864e5); };
  const long = (s) => { const d = d8(s); return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; };
  const short = (s) => { const d = d8(s); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)}`; };

  async function load() {
    const [data, news, vessels, nat, gender, returns, perboat, status] = await Promise.all(
      ["data.json", "news.json", "vessels.json", "nationalities.json", "gender.json", "returns.json", "perboat.json", "status.json"].map(get)
    );
    const days = data.days;
    const latest = days[days.length - 1];
    const year = +latest.date.slice(0, 4);
    const latestDoy = doy(latest.date);
    const latestCrossing = [...days].reverse().find((d) => d.migrants > 0);
    let quietStreak = 0;
    for (let i = days.length - 1; i >= 0 && !days[i].migrants; i--) quietStreak++;

    const years = {};
    for (const d of days) {
      const y = +d.date.slice(0, 4);
      (years[y] ||= { year: y, total: 0, boats: 0, days: [], cum: [], best: null });
      const Y = years[y];
      Y.total += d.migrants; Y.boats += d.boats || 0; Y.days.push(d); Y.cum.push(Y.total);
      if (!Y.best || d.migrants > Y.best.migrants) Y.best = d;
    }
    const cur = years[year];
    const prev = years[year - 1];
    const prevSame = prev ? prev.cum[Math.min(latestDoy, prev.cum.length - 1)] : null;
    const change = prevSame ? ((cur.total - prevSame) / prevSame) * 100 : null;
    const yearList = Object.values(years).sort((a, b) => a.year - b.year);
    const allTotal = yearList.reduce((s, y) => s + y.total, 0);
    const last = (n) => days.slice(-n);
    const crossingDays = cur.days.filter((d) => d.migrants > 0).length;

    const STRAIT = { minLat: 50.55, maxLat: 51.45, minLon: 0.7, maxLon: 2.3 };
    const inStrait = (v) => v.lat > STRAIT.minLat && v.lat < STRAIT.maxLat && v.lon > STRAIT.minLon && v.lon < STRAIT.maxLon;
    const vs = (vessels && vessels.vessels) || [];

    return {
      days, latest, latestCrossing, quietStreak, year, latestDoy, years, yearList, cur, prev, prevSame, change, allTotal, crossingDays,
      last7: last(7), last30: last(30),
      avgPerBoat: cur.boats ? cur.total / cur.boats : null,
      news: (news && news.items) || [],
      vessels: vs, strait: vs.filter(inStrait), STRAIT,
      nat, gender, returns, perboat, status, checkedAt: data.checkedAt,
    };
  }

  // Simplified Strait of Dover coastline (lat, lon) for stylised maps.
  const COAST = {
    england: [[50.77,0.28],[50.84,0.47],[50.855,0.573],[50.9,0.68],[50.94,0.77],[50.93,0.86],[50.913,0.976],[50.95,0.98],[51.02,0.98],[51.07,1.08],[51.08,1.18],[51.1,1.27],[51.125,1.32],[51.14,1.37],[51.18,1.405],[51.22,1.405],[51.27,1.365],[51.31,1.37],[51.33,1.42],[51.375,1.445],[51.39,1.38],[51.37,1.13],[51.36,1.02],[51.4,0.88],[51.44,0.76],[51.48,0.6],[51.5,0.4]],
    france: [[50.3,1.55],[50.4,1.56],[50.52,1.58],[50.63,1.57],[50.73,1.6],[50.77,1.61],[50.87,1.58],[50.885,1.66],[50.93,1.71],[50.945,1.75],[50.965,1.85],[51.0,2.12],[51.05,2.37],[51.085,2.52],[51.1,2.58],[51.15,2.7],[51.23,2.9]],
    places: [
      { n: "Dover", lat: 51.125, lon: 1.32, side: "uk" }, { n: "Folkestone", lat: 51.08, lon: 1.18, side: "uk" },
      { n: "Dungeness", lat: 50.913, lon: 0.976, side: "uk" }, { n: "Ramsgate", lat: 51.33, lon: 1.42, side: "uk" },
      { n: "Calais", lat: 50.965, lon: 1.85, side: "fr" }, { n: "Dunkirk", lat: 51.05, lon: 2.37, side: "fr" },
      { n: "Boulogne", lat: 50.73, lon: 1.6, side: "fr" }, { n: "Gravelines", lat: 51.0, lon: 2.12, side: "fr" },
    ],
  };

  function theme(btn) {
    const root = document.documentElement;
    let t = null;
    try { t = localStorage.getItem("cc-concept-theme"); } catch (e) {}
    if (t) root.dataset.theme = t;
    if (btn) btn.addEventListener("click", () => {
      const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
      root.dataset.theme = dark ? "light" : "dark";
      try { localStorage.setItem("cc-concept-theme", root.dataset.theme); } catch (e) {}
    });
  }

  const ago = (iso) => {
    const m = Math.round((Date.now() - new Date(iso)) / 6e4);
    if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60);
    return h < 24 ? `${h} hour${h > 1 ? "s" : ""} ago` : `${Math.round(h / 24)} day${Math.round(h / 24) > 1 ? "s" : ""} ago`;
  };

  window.CC = { load, fmt, long, short, d8, doy, MONTHS, DAYS, COAST, theme, ago };
})();
