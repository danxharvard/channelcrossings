/* Channel Crossings: shared by every page.
   CC: loads the figures and works out the totals. CCUI: theme, pop-up panels, the menu, Report a crossing and Share. */
(function () {
  const BASE = "";
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
    // "Results updated": when the latest figures came in, in UK time
    const upd = document.getElementById("upd"), at = (status && status.dataAt) || data.checkedAt;
    if (upd && at) upd.textContent = new Date(at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).replace(",", " ·");
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
        if (btn) btn.addEventListener("click", () => {
      const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
      const next = dark ? "light" : "dark";
      if (window.ccTheme) ccTheme(next); else root.dataset.theme = next;
      try { localStorage.setItem("cc-theme", next); } catch (e) {}
    });
  }

  const ago = (iso) => {
    const m = Math.round((Date.now() - new Date(iso)) / 6e4);
    if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60);
    return h < 24 ? `${h} hour${h > 1 ? "s" : ""} ago` : `${Math.round(h / 24)} day${Math.round(h / 24) > 1 ? "s" : ""} ago`;
  };

  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const plural = (n, a, b) => `${fmt(n)} ${n === 1 ? a : b}`;
  const iso = (t) => new Date(t).toISOString().slice(0, 10);
  const addDays = (s, n) => iso(d8(s).getTime() + n * 864e5);
  // Today in the UK, as yyyy-mm-dd
  const ukToday = () => new Date().toLocaleString("sv-SE", { timeZone: "Europe/London" }).slice(0, 10);
  // Every run of days with no crossings, longest first
  const quietRuns = (days) => {
    const out = []; let start = null;
    days.forEach((d, i) => {
      if (!d.migrants) { if (start === null) start = i; }
      else if (start !== null) { out.push({ from: days[start].date, to: days[i - 1].date, n: i - start }); start = null; }
    });
    if (start !== null) out.push({ from: days[start].date, to: days[days.length - 1].date, n: days.length - start, open: true });
    return out.sort((a, b) => b.n - a.n);
  };
  const sum = (days) => days.reduce((a, d) => ({ people: a.people + d.migrants, boats: a.boats + (d.boats || 0), on: a.on + (d.migrants ? 1 : 0), n: a.n + 1 }), { people: 0, boats: 0, on: 0, n: 0 });
  const between = (days, from, to) => days.filter((d) => d.date >= from && d.date <= to);
  window.CC = { load, fmt, long, short, d8, doy, MONTHS, DAYS, COAST, theme, ago, esc, plural, iso, addDays, ukToday, quietRuns, sum, between, get };
})();

/* ---- Pop-up panels, the menu, Report a crossing and Share ---- */
(function () {
  const $ = (id) => document.getElementById(id);
  const SITE = "https://channelcrossings.world/";
  const ICON = {
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.77L17.75 3Z"/></svg>',
  };
  const html = `
<dialog id="dlgMore" class="menu" aria-labelledby="hMore">
  <h2><span id="hMore">Menu</span><button class="btn" data-close>Close</button></h2>
  <div class="body">
    <a href="./">Live panel<small>the Strait, today's figures</small></a>
    <a href="trends.html">Trends<small>every day since 2018, records, outlook</small></a>
    <a href="people.html">People<small>who crosses, returns, asylum</small></a>
    <a href="#" data-open="dlgReport">Report a crossing</a>
    <a href="#" data-open="dlgShare">Share</a>
    <a href="how-it-works.html">How it works</a>
    <a href="data.csv" download>Download the figures (CSV)</a>
    <a href="privacy.html">Privacy and terms</a>
    <p>Figures: <a href="https://www.gov.uk/government/publications/migrants-detected-crossing-the-english-channel-in-small-boats">Home Office</a>, provisional. Vessel positions: aisstream.io. Weather: Open-Meteo. News: UK news feeds.</p>
  </div>
</dialog>
<dialog id="dlgReport" aria-labelledby="hRep" data-nosnippet>
  <h2><span id="hRep">Report a crossing</span><button class="btn" data-close>Close</button></h2>
  <div class="body">
    <p>Report a suspected crossing or sighting here. Thank you very much for doing so.</p>
    <form id="scForm" novalidate>
      <label class="sr" for="scText">Your report</label>
      <textarea id="scText" name="report" maxlength="500" rows="5" placeholder="What did you see, where and when?" required></textarea>
      <div class="sc-row"><span class="sc-count" id="scCount" aria-hidden="true">0 / 500</span><button type="submit" class="btn hot" id="scSend">Send report</button></div>
      <input class="hp" type="checkbox" name="botcheck" id="scHp" tabindex="-1" autocomplete="off" aria-hidden="true">
      <p>Reports are received privately and will appear publicly on the site once our team verify the sighting. This can take anywhere from 5 to 30 minutes.</p>
      <p class="sc-msg" id="scMsg" aria-live="polite"></p>
    </form>
  </div>
</dialog>
<dialog id="dlgShare" aria-labelledby="hShare">
  <h2><span id="hShare">Share</span><button class="btn" data-close>Close</button></h2>
  <div class="body">
    <p>Share Channel Crossings with people who might find the figures useful. Each post carries the latest daily figures and a link back here.</p>
    <p id="shText" style="color:var(--ink);border-left:2px solid var(--amber);padding:6px 10px;background:var(--hot2)"></p>
    <div class="share-grid">
      <button class="btn" id="shNative" hidden>Share…</button>
      <a class="btn" data-net="x" target="_blank" rel="noopener">${ICON.x.replace('<svg', '<svg style="width:11px;height:11px;vertical-align:-1px;margin-right:6px"')}Post on X</a>
      <a class="btn" data-net="wa" target="_blank" rel="noopener">WhatsApp</a>
      <a class="btn" data-net="fb" target="_blank" rel="noopener">Facebook</a>
      <a class="btn" data-net="tg" target="_blank" rel="noopener">Telegram</a>
      <button class="btn" id="shCopy">Copy link</button>
      <a class="btn" href="week-card.png" download="channel-crossings-week.png">Week card</a>
    </div>
    <p>Nothing loads from these sites until you tap.</p>
  </div>
</dialog>
<div class="toast" id="toast" role="status" aria-live="polite"></div>`;

  const toast = (t) => { const e = $("toast"); if (!e) return; e.textContent = t; e.classList.add("on"); clearTimeout(e._t); e._t = setTimeout(() => e.classList.remove("on"), 2200); };
  let shareText = "Daily small boat crossing figures for the English Channel.";

  function mount() {
    document.body.insertAdjacentHTML("beforeend", html);
    // Report: one box, sent privately through Web3Forms to the inbox its access key was made for; nothing is kept on the site
    const RS_TO = "https://api.web3forms.com/submit", RS_KEY = "7b53613b-d997-4f9f-bb7b-31e5534bf472";
    const text = $("scText"), count = () => { $("scCount").textContent = text.value.trim().length + " / 500"; };
    text.addEventListener("input", () => { count(); if ($("scMsg").classList.contains("err")) $("scMsg").textContent = ""; });
    $("scForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = $("scMsg"), send = $("scSend"), report = text.value.trim();
      if ($("scHp").checked) return;   // a bot ticked the hidden box
      if (report.length < 3) { msg.className = "sc-msg err"; msg.textContent = "Write a little more first."; text.focus(); return; }
      send.disabled = true; msg.className = "sc-msg"; msg.textContent = "Sending…";
      const when = new Date().toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
      const body = { access_key: RS_KEY, subject: "Channel crossing report: " + when, from_name: "Channel Crossings", report, page: location.href };
      try {
        const r = await fetch(RS_TO, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body), ...("timeout" in AbortSignal ? { signal: AbortSignal.timeout(10000) } : {}) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || String(j.success) === "false") throw 0;
        msg.className = "sc-msg"; msg.textContent = "Thank you. Your report has been sent."; text.value = ""; count();
      } catch (err) { msg.className = "sc-msg err"; msg.textContent = "It couldn't be sent just now. Please try again in a moment."; }
      send.disabled = false;
    });
    // Share
    if (navigator.share) { $("shNative").hidden = false; $("shNative").addEventListener("click", () => navigator.share({ title: "Channel Crossings", text: shareText, url: SITE }).catch(() => {})); }
    $("shCopy").addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(shareText + " " + SITE); toast("Copied to clipboard"); } catch (e) { toast("Couldn't copy. Try your browser's share menu."); }
    });
    setShare(shareText);
    // Open and close any pop-up from any button or link
    document.addEventListener("click", (e) => {
      const o = e.target.closest("[data-open]"), c = e.target.closest("[data-close]");
      if (o) { e.preventDefault(); document.querySelectorAll("dialog[open]").forEach((d) => d.close()); const d = $(o.dataset.open); if (d) d.showModal(); }
      else if (c) c.closest("dialog").close();
      else if (e.target.tagName === "DIALOG") e.target.close();   // a tap on the dark backdrop
    });
    CC.theme($("theme"));
    if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
  function setShare(t) {
    shareText = t; const e = encodeURIComponent;
    const el = $("shText"); if (!el) return;
    el.textContent = t;
    const href = { x: "https://x.com/intent/post?text=" + e(t) + "&url=" + e(SITE), fb: "https://www.facebook.com/sharer/sharer.php?u=" + e(SITE), wa: "https://wa.me/?text=" + e(t + " " + SITE), tg: "https://t.me/share/url?url=" + e(SITE) + "&text=" + e(t) };
    document.querySelectorAll("#dlgShare [data-net]").forEach((a) => (a.href = href[a.dataset.net]));
  }
  // The share line, from the figures
  function shareFrom(D) {
    const L = D.latest, n = L.migrants;
    return (n ? `${CC.fmt(n)} ${n === 1 ? "person" : "people"} crossed the Channel in small boats on ${CC.long(L.date)}.` : `No small boat crossings of the Channel were detected on ${CC.long(L.date)}.`)
      + ` ${D.year} so far: ${CC.fmt(D.cur.total)}.`;
  }
  window.CCUI = { mount, toast, setShare, shareFrom };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
})();
