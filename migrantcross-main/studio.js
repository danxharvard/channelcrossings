/* Studio: every graph on Channel Crossings, drawn the way the visitor chooses, for a one-off £1.99.
   Loaded the first time the Studio tab opens. Visitors have a simple account (their email, signed in with a link
   sent to it), so a purchase follows them to any device. The account and the payment are handled by a small
   Cloudflare Worker, scripts/studio-worker.js, which talks to Stripe and sends the sign-in emails; nothing about
   the visitor is kept on this site. */
(function(){
  "use strict";

  // The address of the Studio worker (scripts/studio-worker.js), set in index.html. Until it is set, the tab only
  // appears on devices that opened the preview link, where Studio is unlocked so it can be looked over.
  const API = window.CC_STUDIO_API || "";
  const PRICE = "£1.99";

  const $ = id => document.getElementById(id), host = $("studioApp");
  if(!host || host.dataset.ready) return;
  host.dataset.ready = "1";
  const docEl = document.documentElement, reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const store = {   // localStorage, which can be missing or blocked
    get(k){ try{ return JSON.parse(localStorage.getItem("cc-studio-" + k)); }catch(e){ return null; } },
    set(k, v){ try{ localStorage.setItem("cc-studio-" + k, JSON.stringify(v)); }catch(e){} },
    del(k){ try{ localStorage.removeItem("cc-studio-" + k); }catch(e){} }
  };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[c]);
  const fmt = n => n == null || !isFinite(n) ? "–" : (Math.abs(n) < 100 && n % 1 ? n.toFixed(1) : Math.round(n).toLocaleString("en-GB"));
  const kfmt = n => n >= 1e4 ? Math.round(n / 1e3) + "k" : n >= 1e3 ? (n / 1e3).toFixed(1).replace(/\.0$/, "") + "k" : fmt(n);
  // a colour part-way from one hex colour to another, as a hex colour (so a saved picture keeps it)
  const mix = (a, b, t) => "#" + [1, 3, 5].map(i => Math.round(parseInt(a.substr(i, 2), 16) * (1 - t) + parseInt(b.substr(i, 2), 16) * t).toString(16).padStart(2, "0")).join("");
  const sum = (a, f) => a.reduce((s, x) => s + (f(x) || 0), 0);
  const parse = s => new Date(s + "T12:00:00Z");
  const iso = d => d.toISOString().slice(0, 10);
  const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const DOW = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const dLong = new Intl.DateTimeFormat("en-GB", {day:"numeric", month:"short", year:"numeric", timeZone:"UTC"});
  const dShort = new Intl.DateTimeFormat("en-GB", {day:"numeric", month:"short", timeZone:"UTC"});
  const ic = {
    bars:'<path d="M5 20v-7M10 20V6M15 20v-9M20 20V9"/>', line:'<path d="M3 17l5-6 4 3 4-7 5 5"/>', area:'<path d="M3 19V15l5-5 4 3 4-6 5 4v8z"/>',
    steps:'<path d="M3 18h4v-5h5v-4h4V5h5"/>', dots:'<circle cx="5" cy="16" r="1.6"/><circle cx="10" cy="9" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="20" cy="5" r="1.6"/>',
    lolly:'<path d="M6 20v-9M12 20V6M18 20v-6"/><circle cx="6" cy="9.5" r="1.8"/><circle cx="12" cy="4.5" r="1.8"/><circle cx="18" cy="12.5" r="1.8"/>',
    table:'<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M3.5 9.5h17M3.5 14.5h17M10 9.5v10"/>',
    hbars:'<path d="M4 6h12M4 12h16M4 18h8"/>', rose:'<path d="M12 12V3a9 9 0 0 1 7 3.5zM12 12l6 6.5A9 9 0 0 1 6 19zM12 12L5 9a9 9 0 0 1 3-4z"/>',
    donut:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/>', grid:'<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    tree:'<rect x="3.5" y="4" width="17" height="16" rx="2"/><path d="M12 4v16M12 13h8.5M16 13v7"/>', radial:'<circle cx="12" cy="12" r="3"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/>',
    stripes:'<path d="M5 4v16M9 4v16M13 4v16M17 4v16"/>', multi:'<rect x="3.5" y="4" width="7" height="7" rx="1.5"/><rect x="13.5" y="4" width="7" height="7" rx="1.5"/><rect x="3.5" y="13" width="7" height="7" rx="1.5"/><rect x="13.5" y="13" width="7" height="7" rx="1.5"/><path d="M5 9l2-2 2 1M15 9l2-3 2 2M5 18l2-1 2-2M15 18l2-2 2 1"/>',
    people:'<circle cx="7" cy="7" r="2"/><circle cx="17" cy="7" r="2"/><circle cx="7" cy="16" r="2"/><circle cx="17" cy="16" r="2"/><circle cx="12" cy="11.5" r="2"/>',
    mirror:'<path d="M3 12h18M6 12V6M10 12V8M14 12V5M18 12V7M6 12v4M10 12v6M14 12v3M18 12v5"/>',
    save:'<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14"/>'
  };
  const svgI = k => '<svg viewBox="0 0 24 24" aria-hidden="true">' + ic[k] + "</svg>";

  /* ------------------------------------------------------------ the styles: only the marks change, the page stays the site's own */
  const STYLES = [
    {id:"standard", name:"Standard", r:4, lw:2, light:["#007AFF","#FF9500","#5856D6","#30B0C7","#FF2D55","#34C759"], dark:["#0A84FF","#FF9F0A","#5E5CE6","#40C8E0","#FF375F","#30D158"],
      seqL:["#DCEBFF","#A7CDFF","#5EA6FF","#007AFF","#0053B3"], seqD:["#0D2A4D","#11457F","#1767C0","#0A84FF","#7DBBFF"]},
    {id:"sober", name:"Sober", r:3, lw:2, light:["#2F4B6E","#A8763C","#4D7A82","#8F4F5E","#7590B1","#C9A06A"], dark:["#8BA6C7","#CFA46E","#86B2B8","#C4909C","#58779C","#9A6F3E"],
      seqL:["#D3DBE5","#9FB1C6","#6681A2","#2F4B6E","#1B2D45"], seqD:["#26364A","#3B5472","#5E7FA6","#9DB6D3","#D2DEEC"]},
    {id:"graphite", name:"Graphite", r:1.5, lw:1.6, light:["#1C1C1E","#FF3B30","#8E8E93","#48484A","#C7C7CC","#636366"], dark:["#F2F2F7","#FF453A","#8E8E93","#C7C7CC","#48484A","#AEAEB2"],
      seqL:["#E5E5EA","#C7C7CC","#8E8E93","#48484A","#1C1C1E"], seqD:["#2C2C2E","#48484A","#8E8E93","#C7C7CC","#F2F2F7"]},
    {id:"glass", name:"Bright", r:7, lw:2.4, light:["#3D8BFF","#FF8A3D","#7A6CF0","#2EC4D6","#FF4F7B","#3CCB7F"], dark:["#5AA2FF","#FFA052","#8E82FF","#4FD8E8","#FF6B92","#4FE08F"],
      seqL:["#DCE8FF","#B0CBFF","#7DA6FF","#4D7FFF","#3A4FD9"], seqD:["#1A2550","#26388A","#3A56C4","#5A82FF","#9DB8FF"]},
    {id:"vivid", name:"Vivid", r:999, lw:3, light:["#E5004A","#4DB300","#00A8C6","#FF8A00","#A23BEC","#0A84FF"], dark:["#FA114F","#92E82A","#1EEAEF","#FF9F0A","#BF5AF2","#64D2FF"],
      seqL:["#FFE0E9","#FFA3BE","#FF5C8A","#E5004A","#9E0033"], seqD:["#3A0716","#7A0D2E","#C40F45","#FA114F","#FF7DA3"]},
    {id:"ocean", name:"Ocean", r:4, lw:2.2, light:["#0B3C5D","#F28C28","#328CC1","#8A9BA8","#B5523B","#1D7874"], dark:["#5AA9E6","#FF9F0A","#7FC8F8","#A7B4BF","#E07A5F","#4FB3A9"],
      seqL:["#D5E5F0","#9EC3DD","#5A97C2","#22689A","#0B3C5D"], seqD:["#0E2A40","#164466","#236B9C","#4A9BD1","#9CCDF0"]}
  ];

  /* ------------------------------------------------------------ what the visitor chose, remembered on this device */
  const prefs = Object.assign({style:"standard", measure:"people", range:"365", group:"week", ot:"bars", avg:true, rt:"lines", cal:"calendar", calY:null,
    pat:"dow", patF:"bars", yr:"bars", who:"lastYear", whoF:"waffle", nat:"hbars", ret:"bars", pb:"line"}, store.get("prefs") || {});
  const save = () => store.set("prefs", prefs);

  const isDark = () => docEl.dataset.theme === "dark" || (docEl.dataset.theme !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
  function theme(){
    const s = STYLES.find(x => x.id === prefs.style) || STYLES[0], dk = isDark(), cs = getComputedStyle(docEl);
    const v = n => cs.getPropertyValue(n).trim();
    return Object.assign({}, s, {dark:dk, c:dk ? s.dark : s.light, seq:dk ? s.seqD : s.seqL,
      ink:v("--label") || (dk ? "#fff" : "#000"), ink2:v("--label2") || "#888", grid:v("--sep") || "rgba(128,128,128,.25)",
      muted:dk ? "rgba(235,235,245,.28)" : "rgba(60,60,67,.24)", surface:dk ? "#1C1C1E" : "#FFFFFF", font:'Inter,"Helvetica Neue",Helvetica,Arial,sans-serif'});
  }

  /* ------------------------------------------------------------ the data */
  let D = [], gender = null, nats = null, rets = null, perBoat = null, last = null;
  const getJSON = u => fetch(u, {cache:"no-cache"}).then(r => { if(!r.ok) throw r.status; return r.json(); });
  // people, boats, or people per boat (the year's people over its boats, not an average of averages)
  const ofTotals = (m, b) => prefs.measure === "boats" ? b : prefs.measure === "perboat" ? (b ? m / b : null) : m;
  const measureOf = rows => ofTotals(sum(rows, r => r.migrants), sum(rows, r => r.boats));
  const mName = () => ({people:"people", boats:"boats", perboat:"people a boat"})[prefs.measure];
  // the days in the chosen range, started at the beginning of a week or month when grouped by one, so the first bar is a whole one
  function inRange(g){
    if(!D.length) return [];
    const r = prefs.range;
    if(r === "all") return D;
    let from = r === "ytd" ? last.slice(0, 4) + "-01-01" : iso(new Date(parse(last).getTime() - (+r - 1) * 864e5));
    if(g === "week") from = weekStart(from); else if(g === "month") from = from.slice(0, 8) + "01";
    return D.filter(d => d.date >= from);
  }
  function weekStart(s){ const d = parse(s), w = (d.getUTCDay() + 6) % 7; return iso(new Date(d.getTime() - w * 864e5)); }
  function bucket(rows, g){
    const key = g === "day" ? r => r.date : g === "week" ? r => weekStart(r.date) : g === "month" ? r => r.date.slice(0, 7) : r => r.date.slice(0, 4);
    const out = [], idx = {};
    rows.forEach(r => { const k = key(r); if(!(k in idx)){ idx[k] = out.length; out.push({k, rows:[]}); } out[idx[k]].rows.push(r); });
    out.forEach(b => b.v = measureOf(b.rows));
    return out;
  }
  function bLabel(k, g, long){
    if(g === "day") return long ? dLong.format(parse(k)) : dShort.format(parse(k));
    if(g === "week") return (long ? "Week of " : "") + (long ? dLong : dShort).format(parse(k));
    if(g === "month") return MON[+k.slice(5) - 1] + " " + (long ? k.slice(0, 4) : "’" + k.slice(2, 4));
    return k;
  }

  /* ------------------------------------------------------------ drawing: plain SVG with the colours written in, so a chart can be saved as a picture */
  let uid = 0;
  function Svg(W, H, T){ this.W = W; this.H = H; this.T = T; this.defs = []; this.g = []; this.id = "st" + (++uid); this.n = 0; }
  Svg.prototype.add = function(s){ this.g.push(s); return this; };
  Svg.prototype.text = function(x, y, s, o){ o = o || {};
    return this.add('<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" fill="' + (o.c || this.T.ink2) + '" font-family=\'' + this.T.font + '\' font-size="' + (o.size || 11) + '" font-weight="' + (o.w || 500)
      + '" text-anchor="' + (o.a || "start") + '"' + (o.cls ? ' class="' + o.cls + '"' : "") + (o.base ? ' dominant-baseline="' + o.base + '"' : "") + ">" + esc(s) + "</text>"); };
  // a fill for one mark: always a flat colour
  Svg.prototype.fill = function(c){ return 'fill="' + c + '"'; };
  Svg.prototype.stroke = function(c, w){ return 'class="st-l" pathLength="1" fill="none" stroke="' + c + '" stroke-width="' + (w || this.T.lw) + '" stroke-linecap="round" stroke-linejoin="round"'; };
  // a bar with rounded ends away from the baseline (bars that go down are rounded at the bottom)
  Svg.prototype.bar = function(x, y, w, h, c, o){
    o = o || {}; if(h <= 0 || w <= 0) return this;
    const r = Math.min(this.T.r, w / 2, h), hor = o.hor, a = 'class="st-b' + (hor ? " h" : o.down ? " d" : "") + '"' + this.delay(hor ? y / this.H : x / this.W) + " ";
    if(r < .6) return this.add('<rect ' + a + 'x="' + x.toFixed(2) + '" y="' + y.toFixed(2) + '" width="' + w.toFixed(2) + '" height="' + h.toFixed(2) + '" ' + this.fill(c, !hor) + "/>");
    let d;
    if(hor) d = "M" + x + " " + y + "h" + (w - r) + "a" + r + " " + r + " 0 0 1 " + r + " " + r + "v" + (h - 2 * r) + "a" + r + " " + r + " 0 0 1 " + -r + " " + r + "h" + -(w - r) + "z";
    else if(o.down) d = "M" + x + " " + y + "h" + w + "v" + (h - r) + "a" + r + " " + r + " 0 0 1 " + -r + " " + r + "h" + -(w - 2 * r) + "a" + r + " " + r + " 0 0 1 " + -r + " " + -r + "z";
    else d = "M" + x + " " + (y + h) + "v" + -(h - r) + "a" + r + " " + r + " 0 0 1 " + r + " " + -r + "h" + (w - 2 * r) + "a" + r + " " + r + " 0 0 1 " + r + " " + r + "v" + (h - r) + "z";
    return this.add('<path ' + a + 'd="' + d.replace(/(\d\.\d\d)\d+/g, "$1") + '" ' + this.fill(c, !hor) + "/>");
  };
  // how long a mark waits before it animates in: a sweep across the chart, from where it sits (0 to 1)
  Svg.prototype.delay = function(f){ return ' style="animation-delay:' + Math.round(Math.max(0, Math.min(1, f || 0)) * 420) + 'ms"'; };
  Svg.prototype.out = function(label){
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + this.W + " " + this.H + '" width="' + this.W + '" height="' + this.H + '" role="img" aria-label="' + esc(label) + '">'
      + (this.defs.length ? "<defs>" + this.defs.join("") + "</defs>" : "") + this.g.join("") + '<circle class="st-mk" r="5" cx="-99" cy="-99" fill="' + this.T.surface + '" stroke="' + this.T.ink + '" stroke-width="2" opacity="0"/></svg>';
  };
  function niceTicks(max, n){
    if(!(max > 0)) max = 1;
    const raw = max / (n || 4), p = Math.pow(10, Math.floor(Math.log10(raw))), step = [1, 2, 2.5, 5, 10].map(x => x * p).find(s => s >= raw);
    const top = Math.ceil(max / step - 1e-9) * step, list = [];
    for(let v = 0; v <= top + 1e-9; v += step) list.push(v);
    return {top, list};
  }
  // the plot area with its horizontal grid and the values up the left
  function frame(s, max, o){
    o = o || {}; const t = niceTicks(max, o.n || 4), L = o.left != null ? o.left : 38, R = o.right || 8, Tp = o.top || 10, B = o.bottom || 24;
    const f = {x0:L, x1:s.W - R, y0:s.H - B, y1:Tp, top:t.top}; f.y = v => f.y0 - (v / t.top) * (f.y0 - f.y1);
    t.list.forEach(v => { const y = f.y(v); s.add('<path d="M' + f.x0 + " " + y.toFixed(1) + "H" + f.x1 + '" stroke="' + s.T.grid + '" stroke-width="' + (v ? .6 : 1) + '"' + (v && s.T.id === "graphite" ? ' stroke-dasharray="2 3"' : "") + "/>"); s.text(f.x0 - 8, y + 3.5, kfmt(v), {a:"end"}); });
    return f;
  }
  // a smooth line through points that never overshoots them (monotone cubic), as Apple's charts draw trends
  function smooth(p){
    if(p.length < 3) return p.map((q, i) => (i ? "L" : "M") + q[0].toFixed(1) + " " + q[1].toFixed(1)).join("");
    const n = p.length, m = [], dx = [], dy = [];
    for(let i = 0; i < n - 1; i++){ dx[i] = p[i + 1][0] - p[i][0]; dy[i] = (p[i + 1][1] - p[i][1]) / (dx[i] || 1); }
    m[0] = dy[0]; m[n - 1] = dy[n - 2];
    for(let i = 1; i < n - 1; i++) m[i] = dy[i - 1] * dy[i] <= 0 ? 0 : 3 * (dx[i - 1] + dx[i]) / ((2 * dx[i] + dx[i - 1]) / dy[i - 1] + (dx[i] + 2 * dx[i - 1]) / dy[i]);
    let d = "M" + p[0][0].toFixed(1) + " " + p[0][1].toFixed(1);
    for(let i = 0; i < n - 1; i++){ const h = dx[i] / 3; d += "C" + (p[i][0] + h).toFixed(1) + " " + (p[i][1] + m[i] * h).toFixed(1) + " " + (p[i + 1][0] - h).toFixed(1) + " " + (p[i + 1][1] - m[i + 1] * h).toFixed(1) + " " + p[i + 1][0].toFixed(1) + " " + p[i + 1][1].toFixed(1); }
    return d;
  }
  const lin = p => p.map((q, i) => (i ? "L" : "M") + q[0].toFixed(1) + " " + q[1].toFixed(1)).join("");
  const stepP = p => p.map((q, i) => i ? "H" + q[0].toFixed(1) + "V" + q[1].toFixed(1) : "M" + q[0].toFixed(1) + " " + q[1].toFixed(1)).join("");
  // x labels spread evenly along the bottom, never crowded
  function xLabels(s, f, items, xOf, lab){
    const maxN = Math.max(2, Math.floor((f.x1 - f.x0) / 64)), step = Math.max(1, Math.ceil(items.length / maxN));
    for(let i = 0; i < items.length; i += step){ const x = xOf(i); s.text(x, f.y0 + 16, lab(items[i], i), {a:i === 0 && items.length > 1 && step > 1 ? "start" : "middle"}); }
  }
  function arc(cx, cy, r0, r1, a0, a1){   // a ring segment, angles from 12 o'clock clockwise
    const P = (r, a) => [cx + r * Math.sin(a), cy - r * Math.cos(a)], big = a1 - a0 > Math.PI ? 1 : 0, A = P(r1, a0), B = P(r1, a1), C = P(r0, a1), E = P(r0, a0);
    return "M" + A[0].toFixed(2) + " " + A[1].toFixed(2) + "A" + r1 + " " + r1 + " 0 " + big + " 1 " + B[0].toFixed(2) + " " + B[1].toFixed(2)
      + (r0 ? "L" + C[0].toFixed(2) + " " + C[1].toFixed(2) + "A" + r0 + " " + r0 + " 0 " + big + " 0 " + E[0].toFixed(2) + " " + E[1].toFixed(2) : "L" + cx + " " + cy) + "Z";
  }
  function table(head, rows){
    return '<div class="st-tbl-wrap"><table class="st-tbl"><thead><tr>' + head.map(h => "<th>" + esc(h) + "</th>").join("") + "</tr></thead><tbody>"
      + rows.map(r => "<tr>" + r.map(c => "<td>" + esc(c) + "</td>").join("") + "</tr>").join("") + "</tbody></table></div>";
  }
  const legend = items => '<div class="st-legend">' + items.map(i => '<span><i style="background:' + i[1] + '"></i>' + esc(i[0]) + "</span>").join("") + "</div>";

  /* ------------------------------------------------------------ the cards */
  const CARDS = [];
  function card(o){ CARDS.push(o); return o; }
  const width = el => Math.max(240, Math.round(el.clientWidth || 600));
  const hFor = (w, base) => Math.round(Math.min(base, Math.max(190, w * .55)));

  // 1. Over time: every day, week, month or year, in six forms
  card({id:"ot", full:true, title:"Crossings over time", forms:[["bars","Bars"],["line","Line"],["area","Area"],["steps","Steps"],["dots","Dots"],["lolly","Lollipop"],["table","Table"]], key:"ot",
    opts(){ return (prefs.group === "year" ? "" : seg("range", [["30","1M"],["90","3M"],["365","1Y"],["ytd","This year"],["all","All"]], "Range"))
      + seg("group", [["day","Day"],["week","Week"],["month","Month"],["year","Year"]], "Group by") + (prefs.group === "year" ? "" : seg("avg", [[true,"Average"],[false,"No average"]], "Average")); },
    draw(el, T){
      const rows = prefs.group === "year" ? D : inRange(prefs.group), B = bucket(rows, prefs.group);
      this.read = [fmt(measureOf(rows)), mName() + " · " + (rows.length ? bLabel(rows[0].date, "day", true) + " – " + bLabel(rows[rows.length - 1].date, "day", true) : "")];
      if(prefs.ot === "table") return table([prefs.group === "day" ? "Day" : prefs.group[0].toUpperCase() + prefs.group.slice(1), mName()[0].toUpperCase() + mName().slice(1)], B.slice().reverse().map(b => [bLabel(b.k, prefs.group, true), fmt(b.v)]));
      const W = width(el), H = hFor(W, 300), s = new Svg(W, H, T), max = Math.max(1, ...B.map(b => b.v || 0)), f = frame(s, max, {top:24});
      const n = B.length, bw = (f.x1 - f.x0) / Math.max(n, 1), xc = i => f.x0 + bw * (i + .5), c = T.c[0];
      const pts = B.map((b, i) => [xc(i), f.y(b.v || 0)]);
      const form = prefs.ot;
      if(form === "bars"){ const gap = bw > 6 ? Math.min(bw * .25, 3) : bw > 2.5 ? .6 : 0; B.forEach((b, i) => s.bar(f.x0 + bw * i + gap / 2, f.y(b.v || 0), Math.max(.6, bw - gap), f.y0 - f.y(b.v || 0), c)); }
      else if(form === "lolly"){ B.forEach((b, i) => { if(!b.v) return; s.add('<path d="M' + xc(i).toFixed(1) + " " + f.y0 + "V" + f.y(b.v).toFixed(1) + '" stroke="' + c + '" stroke-width="' + Math.min(2, Math.max(.6, bw * .3)) + '" opacity=".65"/>'); if(bw > 3) s.add('<circle cx="' + xc(i).toFixed(1) + '" cy="' + f.y(b.v).toFixed(1) + '" r="' + Math.min(4.5, bw * .4).toFixed(1) + '" ' + s.fill(c) + "/>"); }); }
      else if(form === "dots"){ const r = Math.max(1.4, Math.min(4.5, bw * .38)); B.forEach((b, i) => s.add('<circle cx="' + xc(i).toFixed(1) + '" cy="' + f.y(b.v || 0).toFixed(1) + '" r="' + r.toFixed(1) + '" fill="' + c + '" fill-opacity="' + (n > 300 ? .55 : .9) + '"/>')); }
      else {
        const d = form === "steps" ? stepP(pts) : form === "line" && n > 200 ? lin(pts) : smooth(pts);
        if(form === "area") s.add('<path class="st-a" d="' + d + "L" + pts[n - 1][0].toFixed(1) + " " + f.y0 + "L" + pts[0][0].toFixed(1) + " " + f.y0 + 'Z" fill="' + c + '" fill-opacity=".22"/>');   // a flat tint under the line
        s.add('<path d="' + d + '" ' + s.stroke(c, n > 400 ? Math.min(T.lw, 1.4) : T.lw) + "/>");
        // the latest value, with a soft halo, where the eye ends up
        const e = pts[n - 1]; if(n) s.add('<circle class="st-d" style="animation-delay:1s" cx="' + e[0].toFixed(1) + '" cy="' + e[1].toFixed(1) + '" r="8" fill="' + c + '" fill-opacity=".18"/><circle class="st-d" style="animation-delay:1s" cx="' + e[0].toFixed(1) + '" cy="' + e[1].toFixed(1) + '" r="3.8" fill="' + c + '" stroke="' + T.surface + '" stroke-width="1.6"/>');
      }
      // the peak, labelled
      if(n > 2){ let pk = 0; B.forEach((b, i) => { if((b.v || 0) > (B[pk].v || 0)) pk = i; });
        if(B[pk].v){ const px = xc(pk), py = f.y(B[pk].v); if(form !== "bars" && form !== "lolly") s.add('<circle class="st-d" style="animation-delay:.9s" cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="4.2" fill="' + T.surface + '" stroke="' + c + '" stroke-width="2"/>');
          s.text(Math.max(f.x0 + 34, Math.min(f.x1 - 34, px)), py - 10, "Peak " + fmt(B[pk].v), {a:"middle", c:T.ink, w:700, size:10.5, cls:"st-t"}); } }
      // the average: a rolling mean over a week of days, a month of weeks, a quarter of months
      if(prefs.avg && prefs.group !== "year"){
        const k = {day:7, week:4, month:3}[prefs.group], av = B.map((b, i) => { const w = B.slice(Math.max(0, i - k + 1), i + 1); return measureOf(w.flatMap(x => x.rows)) / (prefs.measure === "perboat" ? 1 : w.length); });
        s.add('<path d="' + smooth(av.map((v, i) => [xc(i), f.y(v || 0)])) + '" ' + s.stroke(T.c[1], Math.max(1.6, T.lw - .4)) + "/>");
        this.legend = legend([[mName()[0].toUpperCase() + mName().slice(1) + " each " + prefs.group, c], ["Average over " + {day:"7 days", week:"4 weeks", month:"3 months"}[prefs.group] + ", now " + fmt(av[n - 1]), T.c[1]]]);
      } else this.legend = "";
      xLabels(s, f, B, xc, b => bLabel(b.k, prefs.group));
      this.pts = B.map((b, i) => ({x:xc(i), y:f.y(b.v || 0), tip:"<b>" + fmt(b.v) + " " + esc(mName()) + "</b>" + esc(bLabel(b.k, prefs.group, true)) + (prefs.measure !== "boats" && b.rows.length ? "<br>" + fmt(sum(b.rows, r => r.boats)) + " boats" : "")}));
      this.mode = "x";
      return s.out("Crossings over time");
    }});

  // 2. Running total by year
  card({id:"rt", full:true, title:"Running total by year", forms:[["lines","Lines"],["vs","This year vs last"],["multi","Small multiples"],["rank","By this date"],["table","Table"]], key:"rt",
    draw(el, T){
      const years = [...new Set(D.map(d => d.date.slice(0, 4)))], cur = last.slice(0, 4), prev = String(+cur - 1), doyLast = doy(last);
      // each year's running total, day by day: [day of the year, total so far, month-day]
      const runs = years.map(y => { let m = 0, b = 0; return {y, r:D.filter(d => d.date.slice(0, 4) === y).map(d => { m += d.migrants || 0; b += d.boats || 0; return [doy(d.date), ofTotals(m, b), d.date.slice(5)]; })}; });
      // by the same date, not the same day of the year, which a leap year moves on by one
      const md = last.slice(5), atDate = run => { const p = run.r.filter(q => q[2] <= md); return p.length ? p[p.length - 1][1] : 0; };
      const curRun = runs.find(r => r.y === cur), prevRun = runs.find(r => r.y === prev);
      this.read = [fmt(atDate(curRun)), mName() + " in " + cur + " by " + dShort.format(parse(last)) + (prevRun ? " · " + fmt(atDate(prevRun)) + " in " + prev : "")];
      const form = prefs.rt, colY = y => y === cur ? T.c[0] : y === prev ? T.c[1] : T.muted;
      this.legend = form === "table" || form === "multi" ? "" : legend([[cur + " so far", T.c[0]], [prev, T.c[1]]].concat(form === "lines" && years[0] < prev ? [[years[0] + "–" + String(+prev - 1).slice(2), T.muted]] : []));
      if(form === "table") return table(["Year", "By " + dShort.format(parse(last)), "Whole year"], runs.slice().reverse().map(r => [r.y, fmt(atDate(r)), r.y === cur ? "–" : fmt(r.r[r.r.length - 1][1])]));
      const W = width(el);
      if(form === "rank"){
        const rk = runs.map(r => ({y:r.y, v:atDate(r)})).sort((a, b) => b.v - a.v), rowH = 24, H = rk.length * rowH + 8, s = new Svg(W, H, T), max = Math.max(...rk.map(r => r.v), 1), L = 44, R = 60;
        rk.forEach((r, i) => { const y = 4 + i * rowH, w = (W - L - R) * r.v / max; s.text(L - 8, y + rowH / 2 + 4, r.y, {a:"end", c:r.y === cur ? T.ink : T.ink2, w:r.y === cur ? 700 : 500}); s.bar(L, y + 4, w, rowH - 8, r.y === cur ? T.c[0] : r.y === prev ? T.c[1] : T.muted, {hor:true}); s.text(L + w + 6, y + rowH / 2 + 4, fmt(r.v), {c:T.ink, w:600}); });
        this.pts = rk.map((r, i) => ({x:W / 2, y:4 + i * rowH + rowH / 2, tip:"<b>" + fmt(r.v) + " " + esc(mName()) + "</b>" + r.y + " by " + esc(dShort.format(parse(last))) + (r.y === cur ? "" : ", #" + (i + 1))}));
        this.mode = "y"; return s.out("Each year by this date");
      }
      if(form === "multi"){
        const cols = W > 640 ? 3 : 2, cw = W / cols, ch = 92, rws = Math.ceil(runs.length / cols), H = rws * (ch + 12), s = new Svg(W, H, T), max = Math.max(...runs.map(r => r.r.length ? Math.max(...r.r.map(q => q[1] || 0)) : 0), 1);
        this.pts = [];
        runs.slice().reverse().forEach((run, i) => {
          const ox = (i % cols) * cw, oy = Math.floor(i / cols) * (ch + 12), x = d => ox + 6 + (cw - 16) * (d - 1) / 365, y = v => oy + ch - 6 - (ch - 34) * (v || 0) / max, c = colY(run.y) === T.muted ? T.c[3] : colY(run.y);
          s.add('<rect x="' + (ox + 2) + '" y="' + oy + '" width="' + (cw - 6) + '" height="' + ch + '" rx="12" fill="' + T.grid + '" fill-opacity=".25"/>');
          s.text(ox + 12, oy + 18, run.y, {c:T.ink, w:700, size:12}); const tot = run.r.length ? run.r[run.r.length - 1][1] : 0; s.text(ox + cw - 12, oy + 18, kfmt(tot), {a:"end", size:11});
          const p = run.r.map(q => [x(q[0]), y(q[1])]);
          if(p.length){ s.add('<path d="' + lin(p) + "L" + p[p.length - 1][0].toFixed(1) + " " + (oy + ch - 6) + "L" + p[0][0].toFixed(1) + " " + (oy + ch - 6) + 'Z" fill="' + c + '" fill-opacity=".14"/>'); s.add('<path d="' + lin(p) + '" ' + s.stroke(c, 1.6) + "/>"); }
          this.pts.push({x:ox + cw / 2, y:oy + ch / 2, tip:"<b>" + fmt(tot) + " " + esc(mName()) + "</b>" + run.y + (run.y === cur ? " so far" : "")});
        });
        this.mode = "xy"; return s.out("Running total, one panel a year");
      }
      const H = hFor(W, 300), s = new Svg(W, H, T);
      const show = form === "vs" ? runs.filter(r => r.y === cur || r.y === prev) : runs;
      const max = Math.max(1, ...show.map(r => Math.max(...r.r.map(q => q[1] || 0)))), f = frame(s, max, {right:44});
      const x = d => f.x0 + (f.x1 - f.x0) * (d - 1) / 365;
      MON.forEach((m, i) => { if(W < 420 && i % 2) return; s.text(x(doy("2001-" + String(i + 1).padStart(2, "0") + "-15")), f.y0 + 16, m, {a:"middle"}); });
      const ends = [];
      show.slice().sort((a, b) => (a.y === cur) - (b.y === cur) || (a.y === prev) - (b.y === prev)).forEach(run => {
        const p = run.r.map(q => [x(q[0]), f.y(q[1] || 0)]); if(!p.length) return; const c = colY(run.y), hi = run.y === cur || run.y === prev;
        if(form === "vs") s.add('<path class="st-a" d="' + stepP(p) + "V" + f.y0 + "H" + p[0][0].toFixed(1) + 'Z" fill="' + c + '" fill-opacity=".14"/>');
        s.add('<path d="' + stepP(p) + '" ' + (hi ? s.stroke(c, T.lw + (run.y === cur ? .6 : 0)) : 'class="st-l" pathLength="1" fill="none" stroke="' + c + '" stroke-width="1"') + "/>");
        const e = p[p.length - 1]; ends.push({x:e[0], y:e[1], run, hi, c});
      });
      // the year at the end of each line, nudged apart so none print on top of each other
      ends.sort((a, b) => a.y - b.y);
      ends.forEach((e, i) => { e.ly = Math.max(e.y, i ? ends[i - 1].ly + 11 : f.y1); });
      for(let i = ends.length - 1, lim = f.y0 + 2; i >= 0; i--){ ends[i].ly = Math.min(ends[i].ly, lim); lim = ends[i].ly - 11; }
      ends.forEach(e => { if(e.run.y === cur) s.add('<circle class="st-d" style="animation-delay:1s" cx="' + e.x.toFixed(1) + '" cy="' + e.y.toFixed(1) + '" r="4" fill="' + e.c + '" stroke="' + T.surface + '" stroke-width="1.6"/>');
        s.text(Math.min(e.x + 6, f.x1 + 4), e.ly + 3.5, e.run.y, {c:e.hi ? T.ink : T.ink2, w:e.hi ? 700 : 500, size:10, cls:"st-t"}); });
      this.pts = []; for(let d = 1; d <= 366; d += 3){ const vals = show.map(r => { const p = r.r.filter(q => q[0] <= d); return [r.y, p.length ? p[p.length - 1][1] : 0]; });
        const cv = vals.find(v => v[0] === cur); this.pts.push({x:x(d), y:f.y(cv && d <= doyLast ? cv[1] : (vals.find(v => v[0] === prev) || [0, 0])[1]), tip:"<b>" + esc(dShort.format(new Date(Date.UTC(2001, 0, d, 12)))) + "</b>" + vals.filter(v => v[0] === cur || v[0] === prev || form === "vs").slice().reverse().map(v => esc(v[0]) + ": " + fmt(v[0] === cur && d > doyLast ? null : v[1])).join("<br>")}); }
      this.mode = "x"; return s.out("Running total by year");
    }});
  function doy(s){ const d = parse(s); return Math.round((d - Date.UTC(d.getUTCFullYear(), 0, 1, 12)) / 864e5) + 1; }

  // 3. A year, day by day
  card({id:"cal", full:true, title:"A year, day by day", forms:[["calendar","Calendar"],["radial","Clock"],["stripes","Stripes"],["table","By month"]], key:"cal",
    opts(){ const ys = [...new Set(D.map(d => d.date.slice(0, 4)))].reverse(); return '<div class="seg" role="group" aria-label="Year">' + ys.slice(0, 6).map(y => '<button type="button" data-k="calY" data-v="' + y + '" aria-pressed="' + (String(prefs.calY || ys[0]) === y) + '">' + y + "</button>").join("") + "</div>"; },
    draw(el, T){
      const y = String(prefs.calY || last.slice(0, 4)), rows = D.filter(d => d.date.slice(0, 4) === y), val = r => measureOf([r]);
      const br = {people:[1, 100, 300, 600], boats:[1, 3, 8, 15], perboat:[1, 45, 55, 65]}[prefs.measure];
      const lvl = v => v == null || !v ? -1 : br.filter(b => v >= b).length - 1, col = v => { const l = lvl(v); return l < 0 ? T.grid : T.seq[Math.min(4, l + 1)]; };
      this.read = [fmt(measureOf(rows)), mName() + " in " + y + (y === last.slice(0, 4) ? " so far" : "")];
      this.legend = legend([["None", T.grid]].concat(br.map((b, i) => [(i === 3 ? b + "+" : b + "–" + (br[i + 1] - 1)), T.seq[i + 1]])));
      if(prefs.cal === "table"){ const ms = bucket(rows, "month"); return table(["Month", mName()[0].toUpperCase() + mName().slice(1), "Busiest day"], ms.map(m => { const top = m.rows.reduce((a, b) => (val(b) || 0) > (val(a) || 0) ? b : a); return [bLabel(m.k, "month", true), fmt(m.v), val(top) ? dShort.format(parse(top.date)) + " (" + fmt(val(top)) + ")" : "–"]; })); }
      const W = width(el), tip = r => "<b>" + (val(r) ? fmt(val(r)) + " " + esc(mName()) : "None detected") + "</b>" + esc(dLong.format(parse(r.date))) + (prefs.measure === "people" && r.boats ? "<br>" + fmt(r.boats) + " boats" : "");
      this.pts = [];
      if(prefs.cal === "stripes"){
        const H = 150, s = new Svg(W, H, T), w = (W - 4) / 366;
        rows.forEach(r => { const x = 2 + (doy(r.date) - 1) * w; s.add('<rect x="' + x.toFixed(2) + '" y="0" width="' + (w + .4).toFixed(2) + '" height="' + (H - 22) + '" fill="' + col(val(r)) + '"/>'); this.pts.push({x:x + w / 2, y:(H - 22) / 2, tip:tip(r)}); });
        MON.forEach((m, i) => s.text(2 + (doy(y + "-" + String(i + 1).padStart(2, "0") + "-01") - 1) * w, H - 6, W < 420 && i % 2 ? "" : m));
        this.mode = "x"; return s.out(y + ", one stripe a day");
      }
      if(prefs.cal === "radial"){
        const S = Math.min(W, 420), s = new Svg(W, S, T), cx = W / 2, cy = S / 2, r0 = S * .18, r1 = S / 2 - 22, mx = Math.max(1, ...rows.map(r => val(r) || 0)), da = 2 * Math.PI / 366;
        s.add('<circle cx="' + cx + '" cy="' + cy + '" r="' + r0 + '" fill="none" stroke="' + T.grid + '"/>');
        rows.forEach(r => { const a = (doy(r.date) - 1) * da, v = val(r) || 0, len = v ? 4 + (r1 - r0 - 4) * Math.sqrt(v / mx) : 1.5;
          s.add('<path d="M' + (cx + r0 * Math.sin(a)).toFixed(1) + " " + (cy - r0 * Math.cos(a)).toFixed(1) + "L" + (cx + (r0 + len) * Math.sin(a)).toFixed(1) + " " + (cy - (r0 + len) * Math.cos(a)).toFixed(1) + '" stroke="' + (v ? col(v) : T.grid) + '" stroke-width="' + Math.max(1, S / 300).toFixed(1) + '" stroke-linecap="round"/>');
          this.pts.push({x:cx + (r0 + len) * Math.sin(a), y:cy - (r0 + len) * Math.cos(a), tip:tip(r)}); });
        MON.forEach((m, i) => { const a = (doy(y + "-" + String(i + 1).padStart(2, "0") + "-15") - 1) * da; s.text(cx + (r1 + 12) * Math.sin(a), cy - (r1 + 12) * Math.cos(a) + 4, m, {a:"middle", size:10}); });
        s.text(cx, cy - 2, kfmt(measureOf(rows)), {a:"middle", c:T.ink, w:700, size:Math.round(S / 16)}); s.text(cx, cy + 16, y, {a:"middle"});
        this.mode = "xy"; return s.out(y + ", the year as a clock");
      }
      if(W < 560){
        const cols = W < 280 ? 2 : 3, mw = W / cols, pitch = Math.min(18, (mw - 10) / 7), cell = pitch - (pitch > 10 ? 2 : 1.5), mh = 18 + 6 * pitch + 10, rr = Math.min(T.r, cell * .3);
        const s = new Svg(W, Math.ceil(12 / cols) * mh, T), byDate = {}; rows.forEach(r => byDate[r.date] = r);
        MON.forEach((m, i) => {
          const ox = (i % cols) * mw, oy = Math.floor(i / cols) * mh, mm = String(i + 1).padStart(2, "0"), f = parse(y + "-" + mm + "-01"), o = (f.getUTCDay() + 6) % 7, days = new Date(Date.UTC(+y, i + 1, 0)).getUTCDate();
          s.text(ox, oy + 11, m, {c:T.ink, w:600, size:11});
          for(let d = 1; d <= days; d++){ const n = d - 1 + o, x = ox + (n % 7) * pitch, yy = oy + 18 + Math.floor(n / 7) * pitch, r = byDate[y + "-" + mm + "-" + String(d).padStart(2, "0")];
            s.add('<rect class="st-d"' + s.delay(i / 12) + ' x="' + x.toFixed(1) + '" y="' + yy.toFixed(1) + '" width="' + cell.toFixed(1) + '" height="' + cell.toFixed(1) + '" rx="' + rr.toFixed(1) + '" fill="' + (r ? col(val(r)) : T.grid) + '"' + (r ? "" : ' fill-opacity=".35"') + "/>");
            if(r) this.pts.push({x:x + cell / 2, y:yy + cell / 2, tip:tip(r)}); }
        });
        this.mode = "xy"; return s.out(y + ", month by month");
      }
      const first = parse(y + "-01-01"), off = (first.getUTCDay() + 6) % 7, wk = Math.ceil((366 + off) / 7), L = 30, cell = Math.max(6, Math.min(24, (W - L) / wk - (W > 900 ? 4 : 2))), gap = cell > 18 ? 4 : cell > 9 ? 2.5 : 1.5;
      const H = 7 * (cell + gap) + 22, s = new Svg(W, H, T), rr = Math.min(T.r, cell * .3);
      ["Mon","","Wed","","Fri","","Sun"].forEach((d, i) => d && s.text(0, 18 + i * (cell + gap) + cell / 2 + 3.5, d, {size:9.5}));
      // the days still to come this year, as faint empty squares, so the year reads as a whole
      const days = new Date(Date.UTC(+y, 1, 29)).getUTCMonth() === 1 ? 366 : 365;
      for(let d = rows.length ? doy(rows[rows.length - 1].date) + 1 : 1; d <= days; d++){ const n = d - 1 + off; s.add('<rect x="' + (L + Math.floor(n / 7) * (cell + gap)).toFixed(1) + '" y="' + (18 + (n % 7) * (cell + gap)).toFixed(1) + '" width="' + cell.toFixed(1) + '" height="' + cell.toFixed(1) + '" rx="' + rr.toFixed(1) + '" fill="' + T.grid + '" fill-opacity=".3"/>'); }
      rows.forEach(r => { const n = doy(r.date) - 1 + off, x = L + Math.floor(n / 7) * (cell + gap), yy = 18 + (n % 7) * (cell + gap);
        s.add('<rect class="st-d"' + s.delay(x / W) + ' x="' + x.toFixed(1) + '" y="' + yy.toFixed(1) + '" width="' + cell.toFixed(1) + '" height="' + cell.toFixed(1) + '" rx="' + rr.toFixed(1) + '" fill="' + col(val(r)) + '"/>'); this.pts.push({x:x + cell / 2, y:yy + cell / 2, tip:tip(r)}); });
      MON.forEach((m, i) => { const n = doy(y + "-" + String(i + 1).padStart(2, "0") + "-01") - 1 + off; if(W < 420 && i % 2) return; s.text(L + Math.floor(n / 7) * (cell + gap), 10, m, {size:10}); });
      this.mode = "xy"; return s.out(y + ", in squares");
    }});

  // 4. Patterns: the week and the year
  card({id:"pat", title:"Patterns", forms:[["bars","Bars"],["rose","Rose"],["lolly","Dot plot"],["table","Table"]], key:"patF",
    opts(){ return seg("pat", [["dow","Day of week"],["month","Month"]]); },
    draw(el, T){
      const rows = D.filter(d => d.date >= "2020-01-01"), byDow = prefs.pat === "dow", names = byDow ? DOW : MON;
      const groups = names.map(() => []); rows.forEach(r => { const d = parse(r.date); groups[byDow ? (d.getUTCDay() + 6) % 7 : d.getUTCMonth()].push(r); });
      const vals = groups.map(g => g.length ? measureOf(g) / (prefs.measure === "perboat" ? 1 : g.length) : 0), mi = vals.indexOf(Math.max(...vals));
      this.read = [byDow ? ["Mondays","Tuesdays","Wednesdays","Thursdays","Fridays","Saturdays","Sundays"][mi] : ["January","February","March","April","May","June","July","August","September","October","November","December"][mi], "busiest, " + fmt(vals[mi]) + " " + mName() + (prefs.measure === "perboat" ? "" : " a day") + " on average since 2020"];
      this.legend = "";
      if(prefs.patF === "table") return table([byDow ? "Day" : "Month", (prefs.measure === "perboat" ? "People a boat" : mName()[0].toUpperCase() + mName().slice(1) + " a day")], names.map((n, i) => [n, fmt(vals[i])]));
      const W = width(el), cAt = i => i === mi ? T.c[1] : T.c[0];
      if(prefs.patF === "rose"){
        const S = Math.min(W, 340), s = new Svg(W, S, T), cx = W / 2, cy = S / 2, R = S / 2 - 24, mx = Math.max(...vals, 1), da = 2 * Math.PI / names.length;
        [.5, 1].forEach(k => s.add('<circle cx="' + cx + '" cy="' + cy + '" r="' + (R * Math.sqrt(k)).toFixed(1) + '" fill="none" stroke="' + T.grid + '"/>'));
        this.pts = vals.map((v, i) => { const r = R * Math.sqrt(v / mx), a0 = i * da + .02, a1 = (i + 1) * da - .02;
          s.add('<path class="st-d"' + s.delay(i / names.length) + ' d="' + arc(cx, cy, 0, Math.max(r, 1), a0, a1) + '" ' + s.fill(cAt(i)) + "/>");
          s.text(cx + (R + 13) * Math.sin(i * da + da / 2), cy - (R + 13) * Math.cos(i * da + da / 2) + 4, names[i], {a:"middle", size:10.5, c:i === mi ? T.ink : T.ink2, w:i === mi ? 700 : 500});
          return {x:cx + r * .7 * Math.sin(i * da + da / 2), y:cy - r * .7 * Math.cos(i * da + da / 2), tip:"<b>" + fmt(v) + "</b>" + esc(names[i]) + ", on average"}; });
        this.mode = "xy"; return s.out("Patterns as a rose");
      }
      const H = hFor(W, 240), s = new Svg(W, H, T), f = frame(s, Math.max(...vals, 1), {left:34, top:20}), bw = (f.x1 - f.x0) / names.length, xc = i => f.x0 + bw * (i + .5);
      vals.forEach((v, i) => {
        if(prefs.patF === "lolly"){ s.add('<path d="M' + xc(i).toFixed(1) + " " + f.y0 + "V" + f.y(v).toFixed(1) + '" stroke="' + T.grid + '" stroke-width="2"/>'); s.add('<circle cx="' + xc(i).toFixed(1) + '" cy="' + f.y(v).toFixed(1) + '" r="6" ' + s.fill(cAt(i)) + "/>"); }
        else s.bar(xc(i) - bw * .32, f.y(v), bw * .64, f.y0 - f.y(v), cAt(i));
        s.text(xc(i), f.y(v) - 9, fmt(v), {a:"middle", c:i === mi ? T.ink : T.ink2, w:i === mi ? 700 : 500, size:10.5});
        s.text(xc(i), f.y0 + 16, names[i], {a:"middle"});
      });
      this.pts = vals.map((v, i) => ({x:xc(i), y:f.y(v), tip:"<b>" + fmt(v) + "</b>" + esc(names[i]) + ", on average since 2020"})); this.mode = "x";
      return s.out("Patterns");
    }});

  // 5. Year by year
  card({id:"yr", title:"Year by year", forms:[["bars","Columns"],["hbars","Bars"],["people","Pictogram"],["table","Table"]], key:"yr",
    draw(el, T){
      const cur = last.slice(0, 4), B = bucket(D, "year"), prevB = B.find(b => b.k === String(+cur - 1)), curB = B.find(b => b.k === cur);
      this.read = [fmt(curB && curB.v), mName() + " in " + cur + " so far" + (prevB ? ", against " + fmt(prevB.v) + " in all of " + prevB.k : "")];
      this.legend = legend([["Whole year", T.c[0]], [cur + " so far", T.c[1]]]);
      if(prefs.yr === "table") return table(["Year", mName()[0].toUpperCase() + mName().slice(1), "Change"], B.slice().reverse().map((b, i, a) => [b.k + (b.k === cur ? " (so far)" : ""), fmt(b.v), a[i + 1] && b.k !== cur && a[i + 1].v ? (b.v >= a[i + 1].v ? "+" : "") + Math.round((b.v / a[i + 1].v - 1) * 100) + "%" : "–"]));
      const W = width(el), col = b => b.k === cur ? T.c[1] : T.c[0], max = Math.max(...B.map(b => b.v || 0), 1);
      if(prefs.yr === "hbars" || prefs.yr === "people"){
        // the pictogram has two rows of dots a year, so each dot stands for enough that the biggest year fits (a whole number, never 2.5)
        const pic = prefs.yr === "people", L = 42, per = Math.floor((W - L - 50) / 11), unit = niceUnit(max / (per * 2)), rowH = pic ? 30 : 26, s = new Svg(W, B.length * rowH + (pic ? 24 : 6), T);
        this.pts = B.map((b, i) => { const y = 3 + i * rowH;
          s.text(L - 8, y + rowH / 2 + 4, b.k, {a:"end", c:b.k === cur ? T.ink : T.ink2, w:b.k === cur ? 700 : 500});
          if(pic){ const n = Math.round((b.v || 0) / unit), sz = Math.min(9, (W - L - 50) / Math.max(per, 1) - 2);
            for(let j = 0; j < Math.min(n, per * 2); j++) s.add('<circle cx="' + (L + 5 + (j % per) * (sz + 2.2)).toFixed(1) + '" cy="' + (y + (j < per ? 9 : 19)).toFixed(1) + '" r="' + (sz / 2).toFixed(1) + '" fill="' + col(b) + '"/>');
            s.text(L + 5 + Math.min(n, per) * (sz + 2.2) + 4, y + 13, fmt(b.v), {c:T.ink, w:600, size:10.5}); }
          else { const w = (W - L - 56) * (b.v || 0) / max; s.bar(L, y + 4, w, rowH - 8, col(b), {hor:true}); s.text(L + w + 6, y + rowH / 2 + 4, fmt(b.v), {c:T.ink, w:600}); }
          return {x:W / 2, y:y + rowH / 2, tip:"<b>" + fmt(b.v) + " " + esc(mName()) + "</b>" + b.k + (b.k === cur ? " so far" : "")}; });
        if(pic) s.text(L, B.length * rowH + 18, "Each dot is " + fmt(unit) + " " + (prefs.measure === "boats" ? (unit === 1 ? "boat" : "boats") : unit === 1 ? "person" : "people"), {size:10.5});
        this.mode = "y"; return s.out("Year by year");
      }
      const H = hFor(W, 260), s = new Svg(W, H, T), f = frame(s, max), bw = (f.x1 - f.x0) / B.length, xc = i => f.x0 + bw * (i + .5);
      B.forEach((b, i) => { s.bar(xc(i) - bw * .32, f.y(b.v || 0), bw * .64, f.y0 - f.y(b.v || 0), col(b)); s.text(xc(i), f.y0 + 16, W < 420 ? "’" + b.k.slice(2) : b.k, {a:"middle"}); if(W > 380) s.text(xc(i), f.y(b.v || 0) - 7, kfmt(b.v), {a:"middle", size:10, c:T.ink, w:600}); });
      this.pts = B.map((b, i) => ({x:xc(i), y:f.y(b.v || 0), tip:"<b>" + fmt(b.v) + " " + esc(mName()) + "</b>" + b.k + (b.k === cur ? " so far" : "")})); this.mode = "x";
      return s.out("Year by year");
    }});

  // 6. People per boat, year by year: the year's people over its boats (perboat.json)
  card({id:"pb", title:"People per boat", forms:[["line","Line"],["bars","Columns"],["seats","One boat"],["table","Table"]], key:"pb", people:true,
    draw(el, T){
      if(!perBoat) return '<p class="st-note">These figures are still loading.</p>';
      const Y = perBoat.years, part = perBoat.partialYear, l90 = perBoat.last90, first = Y[0], lab = y => y.y + (y.y === part ? " so far" : "");
      this.read = [fmt(l90.avg), "people a boat over the last 90 days, against " + fmt(first.avg) + " in " + first.y];
      this.legend = prefs.pb === "table" ? "" : legend([["Whole year", T.c[0]], [part + " so far", T.c[1]]].concat(prefs.pb === "line" ? [["Last 90 days", T.ink2]] : []));
      if(prefs.pb === "table") return table(["Year", "People a boat", "People", "Boats"], Y.slice().reverse().map(y => [lab(y), fmt(y.avg), fmt(y.people), fmt(y.boats)]));
      const W = width(el), col = y => y.y === part ? T.c[1] : T.c[0], tip = y => "<b>" + fmt(y.avg) + " people a boat</b>" + esc(lab(y)) + "<br>" + fmt(y.people) + " people in " + fmt(y.boats) + " boats";
      if(prefs.pb === "seats"){   // each year as one boat: a dot for every person in the average boat, in rows of ten
        const L = 48, gap = 2.5, sz = W < 420 ? 6 : 7.5, step = sz + gap, across = Math.max(5, Math.min(20, Math.floor((W - L - 34) / step / 5) * 5));
        let y0 = 2; const rows = Y.map(y => { const n = Math.ceil(y.avg / across), r = {y, top:y0, h:n * step - gap}; y0 += r.h + 12; return r; });
        const s = new Svg(W, y0, T); this.pts = [];
        rows.forEach(r => { s.text(L - 10, r.top + Math.min(r.h, sz) / 2 + 4, r.y.y, {a:"end", c:r.y.y === part ? T.ink : T.ink2, w:r.y.y === part ? 700 : 500});
          for(let j = 0; j < Math.round(r.y.avg); j++) s.add('<circle cx="' + (L + (j % across) * step + sz / 2).toFixed(1) + '" cy="' + (r.top + Math.floor(j / across) * step + sz / 2).toFixed(1) + '" r="' + (sz / 2).toFixed(1) + '" fill="' + col(r.y) + '"/>');
          s.text(L + Math.min(r.y.avg, across) * step + 6, r.top + Math.min(r.h, sz) / 2 + 4, fmt(r.y.avg), {c:T.ink, w:600});
          this.pts.push({x:W / 2, y:r.top + r.h / 2, tip:tip(r.y)}); });
        this.mode = "y"; return s.out("People per boat, a dot a person");
      }
      const H = hFor(W, 260), s = new Svg(W, H, T), max = Math.max(...Y.map(y => y.avg), l90.avg, 1), f = frame(s, max), bw = (f.x1 - f.x0) / Y.length, xc = i => f.x0 + bw * (i + .5);
      if(prefs.pb === "bars") Y.forEach((y, i) => { s.bar(xc(i) - bw * .32, f.y(y.avg), bw * .64, f.y0 - f.y(y.avg), col(y)); s.text(xc(i), f.y(y.avg) - 7, fmt(y.avg), {a:"middle", size:10, c:T.ink, w:600}); });
      else {
        const p = Y.map((y, i) => [xc(i), f.y(y.avg)]);
        s.add('<path class="st-a" d="' + smooth(p) + "L" + p[p.length - 1][0].toFixed(1) + " " + f.y0 + "L" + p[0][0].toFixed(1) + " " + f.y0 + 'Z" fill="' + T.c[0] + '" fill-opacity=".16"/>');
        s.add('<path d="' + smooth(p) + '" ' + s.stroke(T.c[0]) + "/>");
        const y90 = f.y(l90.avg); s.add('<path d="M' + f.x0 + " " + y90.toFixed(1) + "H" + f.x1 + '" stroke="' + T.ink2 + '" stroke-width="1" stroke-dasharray="3 4"/>');
        s.text(f.x0 + 4, y90 - 6, "Last 90 days: " + fmt(l90.avg), {size:10});
        Y.forEach((y, i) => { s.add('<circle class="st-d"' + s.delay(i / Y.length + .5) + ' cx="' + p[i][0].toFixed(1) + '" cy="' + p[i][1].toFixed(1) + '" r="' + (y.y === part ? 5 : 3.5) + '" fill="' + col(y) + '" stroke="' + T.surface + '" stroke-width="1.5"/>'); if(W > 380 || i % 2 === 0 || i === Y.length - 1) s.text(p[i][0], p[i][1] - 10, fmt(y.avg), {a:"middle", size:10, c:T.ink, w:600}); });
      }
      Y.forEach((y, i) => s.text(xc(i), f.y0 + 16, W < 420 ? "’" + y.y.slice(2) : y.y, {a:"middle"}));
      this.pts = Y.map((y, i) => ({x:xc(i), y:f.y(y.avg), tip:tip(y)})); this.mode = "x";
      return s.out("People per boat, year by year");
    }});

  // 7. Who is crossing: sex and age
  card({id:"who", title:"Sex and age", forms:[["waffle","Squares"],["hbars","Bars"],["donut","Rings"],["table","Table"]], key:"whoF", people:true,
    opts(){ return seg("who", [["lastYear","Last 12 months"],["since2018","Since 2018"]]); },
    draw(el, T){
      if(!gender) return '<p class="st-note">These figures are still loading.</p>';
      const g = gender[prefs.who] || gender.lastYear, sx = [["Men and boys", g.sex.Male, T.c[0]], ["Women and girls", g.sex.Female, T.c[1]], ["Not recorded", g.sex.Unknown, T.muted]];
      const ages = Object.entries(g.age).map(([k, v], i) => [k, v, k === "Unknown" ? T.muted : mix(T.surface, T.c[2], [.4, .6, .8, 1][Math.min(3, i)])]);
      this.read = [Math.round(g.adultMen / g.total * 100) + "%", "were adult men, " + (prefs.who === "lastYear" ? gender.period : "since 2018") + " (" + fmt(g.total) + " people)"];
      this.legend = prefs.whoF === "table" || prefs.whoF === "hbars" ? "" : legend(sx.map(x => [x[0], x[2]])) + legend(ages.map(x => [x[0] === "Unknown" ? "Age not recorded" : x[0], x[2]]));
      if(prefs.whoF === "table") return table(["Group", "People", "Share"], sx.concat(ages).map(x => [x[0], fmt(x[1]), (x[1] / g.total * 100).toFixed(1) + "%"]));
      return parts(el, T, [["By sex", sx], ["By age", ages]], g.total, prefs.whoF, this);
    }});

  // 8. Nationalities
  card({id:"nat", title:"Nationalities", forms:[["hbars","Bars"],["tree","Treemap"],["donut","Ring"],["waffle","Squares"],["table","Table"]], key:"nat", people:true,
    draw(el, T){
      if(!nats) return '<p class="st-note">These figures are still loading.</p>';
      const F = window.CC_FLAGS || {}, items = nats.top.map((n, i) => [(F[n.name] ? F[n.name] + " " : "") + n.name, n.n, T.c[i % 6]]).concat(nats.other ? [["Everyone else", nats.other, T.muted]] : []);
      this.read = [nats.top[0].name, "the largest group, " + nats.top[0].pc + "% of " + fmt(nats.total) + " people, " + nats.period];
      this.legend = prefs.nat === "table" || prefs.nat === "hbars" ? "" : legend(items.map(x => [x[0], x[2]]));
      if(prefs.nat === "table") return table(["Nationality", "People", "Share"], items.map(x => [x[0], fmt(x[1]), (x[1] / nats.total * 100).toFixed(1) + "%"]));
      return parts(el, T, [[null, items]], nats.total, prefs.nat, this);
    }});

  // 9. The UK–France returns deal, month by month
  card({id:"ret", title:"UK–France returns deal", forms:[["bars","Side by side"],["mirror","Mirror"],["line","Lines"],["table","Table"]], key:"ret", people:true,
    draw(el, T){
      if(!rets) return '<p class="st-note">These figures are still loading.</p>';
      const M = rets.months, lab = m => MON[+m.month.slice(5) - 1] + " ’" + m.month.slice(2, 4);
      this.read = [fmt(rets.out), "returned to France and " + fmt(rets.in) + " transferred to the UK, to " + dLong.format(parse(rets.to))];
      this.legend = prefs.ret === "table" ? "" : legend([["Returned to France", T.c[0]], ["Transferred to the UK", T.c[1]]]);
      if(prefs.ret === "table") return table(["Month", "Returned", "Transferred"], M.slice().reverse().map(m => [lab(m), fmt(m.out), fmt(m.in)]));
      const W = width(el), H = hFor(W, 260), s = new Svg(W, H, T), max = Math.max(...M.map(m => Math.max(m.in, m.out)), 1), mir = prefs.ret === "mirror";
      let f, xc, bw;
      if(mir){ const mid = (H - 22) / 2, t = niceTicks(max, 2); f = {x0:36, x1:W - 6, y0:H - 22}; bw = (f.x1 - f.x0) / M.length; xc = i => f.x0 + bw * (i + .5);
        const ys = v => (mid - 6) * v / t.top;
        [-t.top, -t.top / 2, 0, t.top / 2, t.top].forEach(v => { const y = mid - ys(v); s.add('<path d="M' + f.x0 + " " + y.toFixed(1) + "H" + f.x1 + '" stroke="' + T.grid + '" stroke-width="' + (v ? .6 : 1) + '"/>'); s.text(f.x0 - 8, y + 3.5, kfmt(Math.abs(v)), {a:"end"}); });
        M.forEach((m, i) => { s.bar(xc(i) - bw * .3, mid - ys(m.out), bw * .6, ys(m.out), T.c[0]); s.bar(xc(i) - bw * .3, mid, bw * .6, ys(m.in), T.c[1], {down:true}); });
        s.text(f.x1, 12, "Returned ↑", {a:"end", size:10}); s.text(f.x1, H - 28, "Transferred ↓", {a:"end", size:10});
        M.forEach((m, i) => { if(i % Math.ceil(M.length / Math.max(2, Math.floor(W / 64)))) return; s.text(xc(i), H - 6, lab(m), {a:"middle", size:10}); });
      } else {
        f = frame(s, max); bw = (f.x1 - f.x0) / M.length; xc = i => f.x0 + bw * (i + .5);
        if(prefs.ret === "line") [["out", T.c[0]], ["in", T.c[1]]].forEach(([k, c]) => { const p = M.map((m, i) => [xc(i), f.y(m[k])]); s.add('<path d="' + smooth(p) + '" ' + s.stroke(c) + "/>"); p.forEach(q => s.add('<circle cx="' + q[0].toFixed(1) + '" cy="' + q[1].toFixed(1) + '" r="3" fill="' + c + '"/>')); });
        else M.forEach((m, i) => { const w = bw * .32; s.bar(xc(i) - w - 1, f.y(m.out), w, f.y0 - f.y(m.out), T.c[0]); s.bar(xc(i) + 1, f.y(m.in), w, f.y0 - f.y(m.in), T.c[1]); });
        xLabels(s, f, M, xc, lab);
      }
      this.pts = M.map((m, i) => ({x:xc(i), y:H / 2, tip:"<b>" + esc(lab(m)) + "</b>Returned: " + fmt(m.out) + "<br>Transferred: " + fmt(m.in)})); this.mode = "x";
      return s.out("UK–France returns, month by month");
    }});

  // shares of a whole, as squares, bars, rings or a treemap
  function parts(el, T, groups, total, form, cardO){
    const W = width(el); cardO.pts = []; cardO.mode = "xy";
    if(form === "hbars"){
      const rowH = W > 520 ? 36 : 26, L = Math.min(150, W * .36), n = groups.reduce((a, g) => a + g[1].length + (g[0] ? 1 : 0), 0), s = new Svg(W, n * rowH + 4, T); let y = 2;
      groups.forEach(([h, items]) => { if(h){ s.text(0, y + 17, h, {c:T.ink, w:600, size:11.5}); y += rowH; } const mx = Math.max(...items.map(x => x[1]));
        items.forEach(([k, v, c]) => { const w = (W - L - 56) * v / mx; s.text(L - 8, y + rowH / 2 + 4, k, {a:"end"}); const bh = Math.min(rowH - 10, 20); s.bar(L, y + (rowH - bh) / 2, w, bh, c, {hor:true}); s.text(L + w + 6, y + rowH / 2 + 4, (v / total * 100).toFixed(0) + "%", {c:T.ink, w:600});
          cardO.pts.push({x:L + w / 2, y:y + rowH / 2, tip:"<b>" + fmt(v) + "</b>" + esc(k) + ", " + (v / total * 100).toFixed(1) + "%"}); y += rowH; }); });
      cardO.mode = "y"; return s.out("Shares as bars");
    }
    if(form === "donut"){
      const per = Math.min(W / groups.length, 300), S = per, s = new Svg(W, S + (groups[0][0] ? 18 : 0), T);
      groups.forEach(([h, items], gi) => { const cx = (W - per * groups.length) / 2 + per * (gi + .5), cy = S / 2, r1 = S / 2 - 12, r0 = r1 * .62, tot = sum(items, x => x[1]); let a = 0;
        items.forEach(([k, v, c]) => { const da = 2 * Math.PI * v / tot; if(da > .002){ s.add('<path class="st-d"' + s.delay(a / 2 / Math.PI) + ' d="' + arc(cx, cy, r0, r1, a + .012, a + da - .012) + '" ' + s.fill(c) + "/>"); cardO.pts.push({x:cx + (r0 + r1) / 2 * Math.sin(a + da / 2), y:cy - (r0 + r1) / 2 * Math.cos(a + da / 2), tip:"<b>" + fmt(v) + "</b>" + esc(k) + ", " + (v / tot * 100).toFixed(1) + "%"}); } a += da; });
        s.text(cx, cy + 2, (items[0][1] / tot * 100).toFixed(0) + "%", {a:"middle", c:T.ink, w:700, size:Math.round(r0 / 2.6)}); s.text(cx, cy + r0 / 2.6, items[0][0], {a:"middle", size:10});
        if(h) s.text(cx, S + 12, h, {a:"middle", c:T.ink, w:600}); });
      return s.out("Shares as rings");
    }
    if(form === "tree"){
      const items = groups[0][1].slice().sort((a, b) => b[1] - a[1]), H = Math.round(Math.min(340, W * .62)), s = new Svg(W, H, T);
      let x = 0, y = 0, w = W, h = H, rest = sum(items, i => i[1]);
      items.forEach(([k, v, c], i) => { const fr = v / rest, horiz = w >= h; let rw, rh;   // slice off each piece along the longer side
        if(i === items.length - 1){ rw = w; rh = h; } else if(horiz){ rw = w * fr; rh = h; } else { rw = w; rh = h * fr; }
        s.add('<rect class="st-d"' + s.delay(i / items.length) + ' x="' + (x + 1.5).toFixed(1) + '" y="' + (y + 1.5).toFixed(1) + '" width="' + Math.max(0, rw - 3).toFixed(1) + '" height="' + Math.max(0, rh - 3).toFixed(1) + '" rx="' + Math.min(T.r === 999 ? 14 : T.r * 2, 14) + '" ' + s.fill(c) + "/>");
        const pc = (v / sum(groups[0][1], q => q[1]) * 100).toFixed(1) + "%", fl = /^(\p{RI}\p{RI}) (.+)$/u.exec(k);
        // a flag that won't fit beside the name sits on its own line above it
        if(fl && rw - 24 < k.length * 7 && rw > 70 && rh > 62){ s.text(x + 12, y + 24, fl[1], {size:16}); s.text(x + 12, y + 44, fl[2], {c:"#fff", w:600, size:12}); s.text(x + 12, y + 60, pc, {c:"rgba(255,255,255,.85)", size:11}); }
        else if(rw > 70 && rh > 40){ s.text(x + 12, y + 22, k, {c:"#fff", w:600, size:12}); s.text(x + 12, y + 38, pc, {c:"rgba(255,255,255,.85)", size:11}); }
        cardO.pts.push({x:x + rw / 2, y:y + rh / 2, tip:"<b>" + fmt(v) + "</b>" + esc(k)});
        if(horiz){ x += rw; w -= rw; } else { y += rh; h -= rh; } rest -= v; });
      return s.out("Shares as a treemap");
    }
    // squares: 100 of them, each one person in a hundred
    const cols = 20, gap = 3, size = Math.min(16, (Math.min(W, 520) - gap * (cols - 1)) / cols), gh = 5 * (size + gap), hasH = !!groups[0][0], s = new Svg(W, groups.length * (gh + (hasH ? 22 : 0) + 8), T);
    groups.forEach(([h, items], gi) => { const oy = gi * (gh + (hasH ? 22 : 0) + 8) + (hasH ? 18 : 0), tot = sum(items, x => x[1]); if(h) s.text(0, oy - 6, h + ", every 100 people", {c:T.ink, w:600, size:11.5});
      let cum = 0, j = 0; items.forEach(([k, v, c]) => { cum += v; const upto = Math.round(cum / tot * 100);
        for(; j < upto; j++){ const x = (j % cols) * (size + gap), y = oy + Math.floor(j / cols) * (size + gap); s.add('<rect class="st-d"' + s.delay(j / 100) + ' x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + size.toFixed(1) + '" height="' + size.toFixed(1) + '" rx="' + Math.min(T.r === 999 ? size / 2 : T.r, size / 2).toFixed(1) + '" ' + s.fill(c) + "/>");
          cardO.pts.push({x:x + size / 2, y:y + size / 2, tip:"<b>" + Math.round(v / tot * 100) + " in 100</b>" + esc(k) + " (" + fmt(v) + ")"}); } }); });
    return s.out("Shares as squares");
  }

  // the smallest of 1, 2, 5, 10, 20, 50… that is at least x
  function niceUnit(x){ const p = Math.pow(10, Math.floor(Math.log10(Math.max(x, 1)))); return [1, 2, 5, 10].map(k => k * p).find(k => k >= x); }

  /* ------------------------------------------------------------ Ask for a chart: the visitor types what they want to see and gets one chart.
     studio-ask.js reads the words into a plan (what, when, grouped how, which shape); this draws the plan from the figures above,
     choosing the clearest form unless they named one. Nothing is sent anywhere: it all happens on this page. */
  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"], cap = s => s[0].toUpperCase() + s.slice(1);
  const ASK = {id:"ask", title:"", forms:[]}, askQ = {text:store.get("ask") || "", form:null};
  let asylum = null, boatRet = null, natYears = null, askExtra = null;
  const askReady = () => askExtra || (askExtra = Promise.allSettled([getJSON("asylum.json"), getJSON("boatreturns.json"), getJSON("natyears.json")]).then(([a, b, n]) => {
    asylum = a.value || null; boatRet = b.value || null; natYears = n.value && n.value.nats ? n.value : null; }));
  const cardById = id => id === "ask" ? ASK : CARDS.find(c => c.id === id);
  const mOf = (rows, m) => { const p = sum(rows, r => r.migrants), b = sum(rows, r => r.boats); return m === "boats" ? b : m === "perboat" ? (b ? p / b : null) : p; };
  const mWord = m => ({people:"people", boats:"boats", perboat:"people a boat"})[m];
  const qKey = s => s.slice(0, 4) + " Q" + Math.ceil(+s.slice(5, 7) / 3);
  const keyOf = g => g === "day" ? r => r.date : g === "week" ? r => weekStart(r.date) : g === "month" ? r => r.date.slice(0, 7) : g === "quarter" ? r => qKey(r.date) : r => r.date.slice(0, 4);
  const startOf = (s, g) => g === "week" ? weekStart(s) : g === "month" ? s.slice(0, 8) + "01" : g === "quarter" ? s.slice(0, 5) + String((Math.ceil(+s.slice(5, 7) / 3) - 1) * 3 + 1).padStart(2, "0") + "-01" : g === "year" ? s.slice(0, 4) + "-01-01" : s;
  function endOf(k, g){   // the last day of a bucket, to tell a part-done one (this month, this year) from a whole one
    if(g === "day") return k; if(g === "week") return iso(new Date(parse(k).getTime() + 6 * 864e5));
    if(g === "month") return iso(new Date(Date.UTC(+k.slice(0, 4), +k.slice(5, 7), 0, 12)));
    if(g === "quarter") return iso(new Date(Date.UTC(+k.slice(0, 4), +k.slice(-1) * 3, 0, 12)));
    return k + "-12-31";
  }
  const kLabel = (k, g, long) => g === "quarter" ? k.slice(-2) + " " + (long ? k.slice(0, 4) : "’" + k.slice(2, 4)) : bLabel(k, g, long);
  // one bar or point a bucket: [{k, label, long, v, part, tip}]
  function buckets(S, rows, g){
    const key = keyOf(g), out = [], idx = {};
    rows.forEach(r => { const k = key(r); if(!(k in idx)){ idx[k] = out.length; out.push({k, rows:[]}); } out[idx[k]].rows.push(r); });
    return out.map(b => { const v = mOf(b.rows, S.measure), part = endOf(b.k, g) > last;
      return {k:b.k, label:kLabel(b.k, g), long:kLabel(b.k, g, true) + (part ? " so far" : ""), v, part,
        tip:"<b>" + fmt(v) + " " + esc(mWord(S.measure)) + "</b>" + esc(kLabel(b.k, g, true)) + (part ? " so far" : "") + (S.measure === "people" && g !== "day" ? "<br>" + fmt(sum(b.rows, r => r.boats)) + " boats" : S.measure === "boats" ? "<br>" + fmt(sum(b.rows, r => r.migrants)) + " people" : "")}; });
  }
  const daysIn = S => D.filter(d => d.date >= (S.from || "0") && d.date <= (S.to || "9"));

  // columns (or a line, for many points): one series, the record labelled, a part-done period in the second colour
  function askColumns(el, T, items, o){
    o = o || {}; const W = width(el), H = hFor(W, 300), s = new Svg(W, H, T), n = items.length, max = Math.max(1, ...items.map(b => b.v || 0));
    const f = frame(s, max, {top:24}), bw = (f.x1 - f.x0) / Math.max(n, 1), xc = i => f.x0 + bw * (i + .5), col = b => b.part ? T.c[1] : T.c[0];
    const form = o.form || (n > 60 ? "line" : "bars"), pts = items.map((b, i) => [xc(i), f.y(b.v || 0)]);
    if(form === "bars"){ const gap = bw > 6 ? Math.min(bw * .3, 8) : bw > 2.5 ? .6 : 0;
      items.forEach((b, i) => { s.bar(f.x0 + bw * i + gap / 2, f.y(b.v || 0), Math.max(.6, bw - gap), f.y0 - f.y(b.v || 0), col(b)); if(n <= 14 && bw > 26) s.text(xc(i), f.y(b.v || 0) - 7, o.unit === "avg" ? fmt(b.v) : kfmt(b.v), {a:"middle", size:10.5, c:T.ink, w:600}); }); }
    else if(n){ const d = n > 200 ? lin(pts) : smooth(pts);
      if(form === "area") s.add('<path class="st-a" d="' + d + "L" + pts[n - 1][0].toFixed(1) + " " + f.y0 + "L" + pts[0][0].toFixed(1) + " " + f.y0 + 'Z" fill="' + T.c[0] + '" fill-opacity=".22"/>');
      s.add('<path d="' + d + '" ' + s.stroke(T.c[0], n > 400 ? Math.min(T.lw, 1.4) : T.lw) + "/>");
      const e = pts[n - 1]; s.add('<circle class="st-d" style="animation-delay:1s" cx="' + e[0].toFixed(1) + '" cy="' + e[1].toFixed(1) + '" r="4" fill="' + col(items[n - 1]) + '" stroke="' + T.surface + '" stroke-width="1.6"/>'); }
    // the highest, named, when the bars don't each carry their own number
    if(n > 2 && !(form === "bars" && n <= 14 && bw > 26)){ let pk = 0; items.forEach((b, i) => { if((b.v || 0) > (items[pk].v || 0)) pk = i; });
      if(items[pk].v) s.text(Math.max(f.x0 + 40, Math.min(f.x1 - 40, xc(pk))), f.y(items[pk].v) - 10, "Highest " + fmt(items[pk].v) + ", " + items[pk].label, {a:"middle", c:T.ink, w:700, size:10.5, cls:"st-t"}); }
    xLabels(s, f, items, xc, b => b.label);
    ASK.pts = items.map((b, i) => ({x:xc(i), y:pts[i][1], tip:b.tip})); ASK.mode = "x";
    ASK.legend = items.some(b => b.part) ? legend([[o.whole || "Whole " + (o.g || "period"), T.c[0]], [items.find(b => b.part).label + " so far", T.c[1]]]) : "";
    return s.out(ASK.title);
  }
  // ranked bars, largest first, a row each
  function askRank(el, T, items){
    const W = width(el), rowH = 28, L = Math.min(150, Math.max(70, W * .3)), s = new Svg(W, items.length * rowH + 4, T), max = Math.max(1, ...items.map(b => b.v || 0));
    ASK.pts = items.map((b, i) => { const y = 2 + i * rowH, w = (W - L - 64) * (b.v || 0) / max;
      s.text(L - 8, y + rowH / 2 + 4, b.label, {a:"end", c:i ? T.ink2 : T.ink, w:i ? 500 : 700}); s.bar(L, y + 5, w, rowH - 10, b.part ? T.c[1] : T.c[0], {hor:true});
      s.text(L + w + 6, y + rowH / 2 + 4, fmt(b.v), {c:T.ink, w:600}); return {x:W / 2, y:y + rowH / 2, tip:b.tip}; });
    ASK.mode = "y"; ASK.legend = items.some(b => b.part) ? legend([["Whole period", T.c[0]], ["Still going", T.c[1]]]) : "";
    return s.out(ASK.title);
  }
  // a few lines on one scale, each named at its end: [{name, vals, c}] against labels along the bottom
  function askLines(el, T, series, labels, o){
    o = o || {}; const W = width(el), H = hFor(W, 300), s = new Svg(W, H, T), max = Math.max(1, ...series.flatMap(x => x.vals.filter(v => v != null)));
    const f = frame(s, max, {right:o.right || 52}), n = labels.length, x = i => f.x0 + (f.x1 - f.x0) * (n > 1 ? i / (n - 1) : .5), ends = [];
    series.forEach(se => { const p = []; se.vals.forEach((v, i) => { if(v != null) p.push([x(i), f.y(v)]); }); if(!p.length) return;
      s.add('<path d="' + (o.step ? stepP(p) : smooth(p)) + '" ' + (se.faint ? 'class="st-l" pathLength="1" fill="none" stroke="' + se.c + '" stroke-width="1"' : s.stroke(se.c)) + "/>");
      if(!o.step && n <= 24 && !se.faint) p.forEach(q => s.add('<circle cx="' + q[0].toFixed(1) + '" cy="' + q[1].toFixed(1) + '" r="2.6" fill="' + se.c + '"/>'));
      const e = p[p.length - 1]; ends.push({x:e[0], y:e[1], se}); });
    ends.sort((a, b) => a.y - b.y); ends.forEach((e, i) => { e.ly = Math.max(e.y, i ? ends[i - 1].ly + 12 : f.y1); });
    for(let i = ends.length - 1, lim = f.y0 + 2; i >= 0; i--){ ends[i].ly = Math.min(ends[i].ly, lim); lim = ends[i].ly - 12; }
    ends.forEach(e => s.text(Math.min(e.x + 6, f.x1 + 4), e.ly + 3.5, e.se.name, {c:e.se.faint ? T.ink2 : T.ink, w:e.se.faint ? 500 : 700, size:10, cls:"st-t"}));
    xLabels(s, f, labels, x, l => l);
    ASK.pts = labels.map((l, i) => ({x:x(i), y:f.y((series.find(se => se.vals[i] != null && !se.faint) || {vals:[0]}).vals[i] || 0),
      tip:"<b>" + esc(o.tipHead ? o.tipHead(i) : l) + "</b>" + series.filter(se => !se.faint || series.length <= 4).filter(se => se.vals[i] != null).map(se => esc(se.name) + ": " + fmt(se.vals[i])).join("<br>")}));
    ASK.mode = "x"; ASK.legend = series.filter(x => !x.faint).length > 1 ? legend(series.filter(x => !x.faint).map(x => [x.name, x.c]).concat(series.some(x => x.faint) ? [["Other years", T.muted]] : [])) : "";
    return s.out(ASK.title);
  }
  // two measures side by side in each period, such as returned and transferred
  function askPairs(el, T, items, names){
    const W = width(el), H = hFor(W, 280), s = new Svg(W, H, T), max = Math.max(1, ...items.flatMap(b => [b.a, b.b])), f = frame(s, max), bw = (f.x1 - f.x0) / items.length, xc = i => f.x0 + bw * (i + .5);
    items.forEach((b, i) => { const w = Math.min(28, bw * .34); s.bar(xc(i) - w - 1, f.y(b.a), w, f.y0 - f.y(b.a), T.c[0]); s.bar(xc(i) + 1, f.y(b.b), w, f.y0 - f.y(b.b), T.c[1]); });
    xLabels(s, f, items, xc, b => b.label);
    ASK.pts = items.map((b, i) => ({x:xc(i), y:f.y(Math.max(b.a, b.b)), tip:"<b>" + esc(b.long) + "</b>" + esc(names[0]) + ": " + fmt(b.a) + "<br>" + esc(names[1]) + ": " + fmt(b.b) + (b.more || "")}));
    ASK.mode = "x"; ASK.legend = legend([[names[0], T.c[0]], [names[1], T.c[1]]]); return s.out(ASK.title);
  }

  // the figures a plan asks for, as items or series, with the headline and anything worth saying about them
  function askData(S, T){
    const R = {notes:[]}, cur = +last.slice(0, 4);
    if(S.topic === "crossings"){
      const per = S.measure === "perboat";
      if(S.shape === "series"){
        let rows = daysIn(Object.assign({}, S, {from:startOf(S.from || D[0].date, S.group)}));
        if(S.month){ rows = D.filter(d => +d.date.slice(5, 7) === S.month); }
        let items = buckets(S, rows, S.group);
        if(S.month) items.forEach(b => { b.long = cap(MONTHS[S.month - 1]) + " " + b.k + (b.part ? " so far" : ""); b.tip = b.tip.replace(/<\/b>[^<]*/, "</b>" + esc(b.long)); });
        if(S.years) items = items.filter(b => S.years.includes(+b.k.slice(0, 4)));
        R.items = items; R.kind = "cols"; R.g = S.month ? "month" : S.group;
        const all = rows; R.read = [fmt(mOf(all, S.measure)), mWord(S.measure) + (per ? " on average" : " in all") + ", " + (S.month ? "every " + cap(MONTHS[S.month - 1]) + " since " + D[0].date.slice(0, 4) : S.rangeLabel)];
        if(S.group === "day" && !per) R.read[1] += " · " + fmt(mOf(all, "boats")) + " boats";
        return R;
      }
      if(S.shape === "compare" && S.group !== "date" && S.group !== "day" && S.group !== "year"){
        const g = S.group, labs = g === "month" ? MON.slice() : g === "quarter" ? ["Q1", "Q2", "Q3", "Q4"] : Array.from({length:52}, (_, i) => "Wk " + (i + 1));
        const at = r => g === "month" ? +r.date.slice(5, 7) - 1 : g === "quarter" ? Math.ceil(+r.date.slice(5, 7) / 3) - 1 : Math.min(51, Math.floor((doy(r.date) - 1) / 7));
        R.series = S.years.slice().reverse().map((y, i) => { const rows = D.filter(d => +d.date.slice(0, 4) === y), by = labs.map(() => []); rows.forEach(r => by[at(r)].push(r));
          return {name:String(y) + (y === cur ? " so far" : ""), c:T.c[i % 6], vals:by.map(b => b.length ? mOf(b, S.measure) : null)}; });
        R.labels = labs; R.kind = "lines"; const tot = y => mOf(D.filter(d => +d.date.slice(0, 4) === y), S.measure), yl = S.years[S.years.length - 1];
        R.read = [fmt(tot(yl)), mWord(S.measure) + (per ? " on average" : "") + " in " + yl + (yl === cur ? " so far" : "") + ", against " + S.years.slice(0, -1).map(y => fmt(tot(y)) + " in " + y).join(", ")];
        return R;
      }
      if(S.shape === "compare" || S.shape === "cum"){
        // a running total through the year for each year asked for, by the same date
        const ys = S.years.slice().sort(), md = last.slice(5), labs = MON.slice();
        const at = y => { const rows = D.filter(d => +d.date.slice(0, 4) === y); const vals = []; let p = 0, b = 0;
          rows.forEach(r => { p += r.migrants || 0; b += r.boats || 0; vals[doy(r.date) - 1] = S.measure === "boats" ? b : per ? (b ? p / b : null) : p; }); return vals; };
        const few = ys.length <= 4;
        R.series = ys.slice().reverse().map((y, i) => ({name:String(y), y, c:few ? T.c[i] : i === 0 ? T.c[0] : i === 1 ? T.c[1] : T.muted, faint:!few && i > 1, vals:at(y)}));
        R.kind = "cum"; R.labels = labs;
        const byDate = y => { const rows = D.filter(d => +d.date.slice(0, 4) === y && d.date.slice(5) <= md); return mOf(rows, S.measure); };
        R.read = ys.includes(cur) ? [fmt(byDate(cur)), mWord(S.measure) + " in " + cur + " by " + dShort.format(parse(last)) + (ys.includes(cur - 1) ? ", against " + fmt(byDate(cur - 1)) + " by then in " + (cur - 1) : "")]
          : [fmt(mOf(D.filter(d => +d.date.slice(0, 4) === ys[ys.length - 1]), S.measure)), mWord(S.measure) + " in " + ys[ys.length - 1]];
        if(per) R.notes.push("People per boat is shown as the year’s average so far, day by day.");
        return R;
      }
      if(S.shape === "rank"){
        const g = S.unit, rows = daysIn(S); let items = buckets(S, rows, g);
        if(S.order === "asc"){ items = items.filter(b => !b.part); if(g === "day") R.notes.push("Many days have no crossings at all, so the quietest days are the days with the fewest people among those with any."), items = items.filter(b => b.v > 0); }
        items.sort((a, b) => S.order === "asc" ? (a.v || 0) - (b.v || 0) : (b.v || 0) - (a.v || 0));
        items = items.slice(0, S.n || items.length);
        items.forEach(b => b.label = g === "day" ? dLong.format(parse(b.k)) : g === "week" ? "Week of " + dShort.format(parse(b.k)) + " " + b.k.slice(0, 4) : kLabel(b.k, g, true));
        R.items = items; R.kind = "rank";
        R.read = items.length ? [fmt(items[0].v), mWord(S.measure) + ", " + (g === "day" ? "on " : "in ") + items[0].label + ", the " + (S.order === "asc" ? "quietest" : "busiest") + " " + (g === "day" ? "day" : g) + " " + (S.rangeLabel.startsWith("since records") ? "on record" : "in " + S.rangeLabel)] : ["–", "nothing in that time"];
        return R;
      }
      if(S.shape === "pattern"){
        const rows = daysIn(S), dow = S.pattern === "dow", names = dow ? DOW : MON, gs = names.map(() => []);
        rows.forEach(r => { const d = parse(r.date); gs[dow ? (d.getUTCDay() + 6) % 7 : d.getUTCMonth()].push(r); });
        const vals = gs.map(g => g.length ? mOf(g, S.measure) / (per ? 1 : g.length) : 0), mi = vals.indexOf(Math.max(...vals));
        const full = dow ? ["Mondays","Tuesdays","Wednesdays","Thursdays","Fridays","Saturdays","Sundays"] : MONTHS.map(cap);
        R.items = names.map((nm, i) => ({k:nm, label:nm, long:full[i], v:vals[i], part:false, tip:"<b>" + fmt(vals[i]) + " " + esc(mWord(S.measure)) + (per ? "" : " a day") + "</b>" + esc(full[i]) + ", on average"}));
        R.kind = "cols"; R.unit = "avg"; R.hi = mi;
        R.read = [full[mi], "busiest, with " + fmt(vals[mi]) + " " + mWord(S.measure) + (per ? "" : " a day") + " on average, " + S.rangeLabel];
        return R;
      }
    }
    if(S.topic === "nat"){
      const N = natYears;
      if(!N){
        if(!nats) return {msg:"The nationality figures are still loading."};
        R.notes.push("Nationalities year by year arrive with the next update of the figures. For now this is " + nats.period + ".");
        if(S.country){ const hit = nats.top.find(x => x.name === S.country); if(!hit){ return {msg:S.country + " isn’t among the five largest nationalities for " + nats.period + ", the only period this page has figures for so far. Year-by-year figures for every nationality arrive with the next update."}; } }
        R.kind = "share"; R.items = nats.top.map((x, i) => [x.name, x.n, T.c[i % 6]]).concat(nats.other ? [["Everyone else", nats.other, T.muted]] : []); R.total = nats.total;
        R.title = "Nationalities, " + nats.period; const one = S.country && nats.top.find(x => x.name === S.country) || nats.top[0];
        R.read = S.country ? [fmt(one.n), "people from " + one.name + ", " + one.pc + "% of everyone, " + nats.period] : [one.name, "the largest group, " + one.pc + "% of " + fmt(nats.total) + " people, " + nats.period];
        return R;
      }
      const yIdx = N.years.map((y, i) => [+y, i]).filter(([y]) => (!S.from || y >= +S.from.slice(0, 4)) && (!S.to || y <= +S.to.slice(0, 4)) && (!S.years || S.years.includes(y)));
      const part = Object.keys(N.partial || {})[0], pnote = part && yIdx.some(([y]) => String(y) === part) ? part + " covers " + N.partial[part] + " quarter" + (N.partial[part] > 1 ? "s" : "") + " so far." : "";
      if(pnote) R.notes.push("Nationality figures come in every three months; " + pnote);
      const span = yIdx.length ? (yIdx[0][0] === yIdx[yIdx.length - 1][0] ? String(yIdx[0][0]) : yIdx[0][0] + " to " + yIdx[yIdx.length - 1][0]) : "";
      if(S.shape === "natOne"){
        const nt = N.nats.find(x => x.name === S.country);
        if(!nt) return {msg:"There aren’t separate figures for " + S.country + ": it is in “everyone else”, with the smaller nationalities."};
        R.items = yIdx.map(([y, i]) => ({k:String(y), label:String(y), long:String(y), v:nt.n[i], part:String(y) === part, tip:"<b>" + fmt(nt.n[i]) + " people</b>" + y + (String(y) === part ? " so far" : "") + "<br>" + (N.total[i] ? (nt.n[i] / N.total[i] * 100).toFixed(1) + "% of everyone that year" : "")}));
        R.kind = "cols"; R.g = "year"; const tot = sum(yIdx, ([, i]) => nt.n[i]), all = sum(yIdx, ([, i]) => N.total[i]);
        R.read = [fmt(tot), "people from " + S.country + ", " + span + " (" + (all ? (tot / all * 100).toFixed(1) : 0) + "% of everyone)"];
        return R;
      }
      const totals = N.nats.map(nt => [nt.name, sum(yIdx, ([, i]) => nt.n[i])]).sort((a, b) => b[1] - a[1]), all = sum(yIdx, ([, i]) => N.total[i]);
      if(S.shape === "natTrend"){
        const top = totals.slice(0, 5).map(x => x[0]);
        R.series = top.map((nm, k) => ({name:nm, c:T.c[k], vals:yIdx.map(([, i]) => N.nats.find(x => x.name === nm).n[i])}));
        R.labels = yIdx.map(([y]) => String(y)); R.kind = "lines"; R.read = [top[0], "the largest group over " + span];
        return R;
      }
      const top = totals.slice(0, S.n || 8);
      R.kind = "share"; R.items = top.map((x, i) => [x[0], x[1], T.c[i % 6]]).concat([["Everyone else", all - sum(top, x => x[1]), T.muted]]); R.total = all;
      if(top.length > 6) R.items.forEach((x, i) => { if(i >= 6 && x[0] !== "Everyone else") x[2] = mix(T.surface, T.c[i % 6], .55); });
      R.read = [top[0][0], "the largest group, " + (top[0][1] / all * 100).toFixed(1) + "% of " + fmt(all) + " people, " + span];
      return R;
    }
    if(S.topic === "who"){
      if(!gender) return {msg:"These figures are still loading."};
      const since = S.from && S.from.slice(0, 4) < String(cur - 1), g = since ? gender.since2018 : gender.lastYear;
      R.kind = "who"; R.g = g; R.read = [Math.round(g.adultMen / g.total * 100) + "%", "were adult men, " + (since ? "since 2018" : gender.period) + " (" + fmt(g.total) + " people)"];
      if(S.from && !since) R.notes.push("Sex and age are for " + gender.period + "; ask “since 2018” for every year together.");
      return R;
    }
    if(S.topic === "deal"){
      if(!rets) return {msg:"These figures are still loading."};
      R.kind = "pairs"; R.names = ["Returned to France", "Transferred to the UK"];
      R.items = rets.months.map(m => ({label:MON[+m.month.slice(5) - 1] + " ’" + m.month.slice(2, 4), long:MON[+m.month.slice(5) - 1] + " " + m.month.slice(0, 4), a:m.out, b:m.in}));
      R.read = [fmt(rets.out), "returned to France and " + fmt(rets.in) + " transferred to the UK, to " + dLong.format(parse(rets.to))];
      return R;
    }
    if(S.topic === "asylum"){
      if(!asylum) return {msg:"The asylum figures couldn’t be loaded."};
      const Y = asylum.years.filter(y => (!S.from || y.year >= +S.from.slice(0, 4)) && (!S.to || y.year <= +S.to.slice(0, 4)));
      if(!Y.length) return {msg:"The asylum figures cover people who arrived from " + asylum.years[0].year + " to " + asylum.years[asylum.years.length - 1].year + "."};
      R.notes.push("Counted by the year people arrived, " + asylum.period + ". Claims withdrawn or still waiting aren’t in the bars; recent years still have decisions to come.");
      const tipY = y => "<br>Withdrawn: " + fmt(y.withdrawn) + "<br>Still waiting: " + fmt(y.waiting);
      if(S.outcome){ const k = S.outcome; R.kind = "cols"; R.g = "year";
        R.items = Y.map(y => ({k:String(y.year), label:String(y.year), long:String(y.year), v:y[k], part:false, tip:"<b>" + fmt(y[k]) + " " + k + "</b>arrived in " + y.year + (y.granted + y.refused ? "<br>" + Math.round(y.granted / (y.granted + y.refused) * 100) + "% of decisions were grants" : "")}));
        R.read = [fmt(sum(Y, y => y[k])), k + ", for people who arrived " + (Y.length > 1 ? Y[0].year + " to " + Y[Y.length - 1].year : "in " + Y[0].year)];
      } else {
        R.kind = "pairs"; R.names = ["Granted", "Refused"];
        R.items = Y.map(y => ({label:String(y.year), long:"Arrived in " + y.year, a:y.granted, b:y.refused, more:tipY(y)}));
        const g = sum(Y, y => y.granted), r = sum(Y, y => y.refused);
        R.read = [Math.round(g / Math.max(1, g + r) * 100) + "%", "of decisions were grants, for people who arrived " + (Y.length > 1 ? Y[0].year + " to " + Y[Y.length - 1].year : "in " + Y[0].year) + " (" + fmt(g) + " granted, " + fmt(r) + " refused)"];
      }
      return R;
    }
    if(S.topic === "removed"){
      if(!boatRet) return {msg:"These figures couldn’t be loaded."};
      let Q = boatRet.quarters.filter(q => (!S.from || q.q >= S.from.slice(0, 4)) && (!S.to || q.q.slice(0, 4) <= S.to.slice(0, 4)));
      const byYear = S.group === "year" || (!S.group && Q.length > 16), lq = boatRet.quarters[boatRet.quarters.length - 1].q;
      let items = byYear ? Object.values(Q.reduce((o, q) => { const y = q.q.slice(0, 4); (o[y] = o[y] || {k:y, v:0, n:0}).v += q.n; o[y].n++; return o; }, {})).map(y => ({k:y.k, label:y.k, long:y.k, v:y.v, part:y.n < 4}))
        : Q.map(q => ({k:q.q, label:q.q.slice(-2) + " ’" + q.q.slice(2, 4), long:q.q, v:q.n, part:false}));
      items.forEach(b => b.tip = "<b>" + fmt(b.v) + " returned</b>" + esc(b.long) + (b.part ? " so far" : ""));
      R.kind = "cols"; R.g = byYear ? "year" : "quarter"; R.items = items;
      R.read = [fmt(sum(items, b => b.v)), "small boat arrivals returned from the UK, " + (items.length ? items[0].long + " to " + (byYear ? lq : items[items.length - 1].long) : "")];
      R.notes.push("Returns are counted when they happen, not when people arrived. Figures to " + lq + ".");
      return R;
    }
    return {msg:"That couldn’t be drawn."};
  }

  // the forms the answer can switch between: the clear default first
  function askForms(S, R){
    if(R.kind === "share") return [["hbars", "Bars"], ["donut", "Ring"], ["table", "Table"]];
    if(R.kind === "who") return [["hbars", "Bars"], ["waffle", "Squares"], ["table", "Table"]];
    if(R.kind === "rank") return [["bars", "Bars"], ["table", "Table"]];
    if(R.kind === "lines" || R.kind === "cum") return [["line", "Lines"], ["table", "Table"]];
    if(R.kind === "pairs") return [["bars", "Bars"], ["table", "Table"]];
    const n = (R.items || []).length; return n > 60 ? [["line", "Line"], ["area", "Area"], ["bars", "Bars"], ["table", "Table"]] : [["bars", "Bars"], ["line", "Line"], ["table", "Table"]];
  }
  function drawAsk(T){
    const box = wrap.querySelector("[data-ask-out]"); if(!box) return;
    if(!askQ.text || !window.ccAsk || !D.length){ box.hidden = true; return; }
    const S = window.ccAsk.parse(askQ.text, {first:D[0].date, last, countries:natYears ? natYears.nats.map(n => n.name) : nats ? nats.top.map(n => n.name) : []});
    box.hidden = false; T = T || theme();
    const ch = box.querySelector("[data-chart]"), note = box.querySelector(".st-ask-note"), fm = box.querySelector(".st-forms");
    ASK.pts = null; ASK.legend = ""; ASK.svg = null; ASK.read = null;
    if(!S.understood){
      ASK.title = "Not sure what to show";
      box.querySelector("h3").textContent = ASK.title; fm.innerHTML = ""; box.querySelector(".st-read").hidden = true;
      ch.innerHTML = '<p class="st-note">Nothing in “' + esc(askQ.text) + '” matched the figures. Try asking about people, boats, people per boat, nationalities, sex and age, asylum decisions or returns, with a year or a time such as “each month”.</p>';
      box.querySelector("[data-legend]").innerHTML = ""; note.textContent = ""; box.querySelector("[data-save]").disabled = true; menus(); return;
    }
    const R = askData(S, T); ASK.title = window.ccAsk.title(S);
    if(R.title) ASK.title = R.title; else if(R.kind === "share" && !S.rangeLabel) ASK.title = "Nationalities, all years";
    box.querySelector("h3").textContent = ASK.title;
    const forms = R.msg ? [] : askForms(S, R), form = forms.some(f => f[0] === askQ.form) ? askQ.form : forms.some(f => f[0] === S.form) ? S.form : forms.length ? forms[0][0] : null;
    fm.innerHTML = forms.length > 1 ? forms.map(([v, l]) => '<button type="button" data-ask-form="' + v + '" aria-pressed="' + (v === form) + '">' + svgI(v === "line" ? "line" : v === "area" ? "area" : v === "table" ? "table" : v === "donut" ? "donut" : v === "waffle" ? "grid" : v === "hbars" ? "hbars" : "bars") + l + "</button>").join("") : "";
    let html;
    if(R.msg) html = '<p class="st-note">' + esc(R.msg) + "</p>";
    else if(form === "table") html = askTable(R, S);
    else if(R.kind === "cols") html = askColumns(ch, T, R.items, {form, unit:R.unit, g:R.g === "date" ? "period" : R.g, whole:R.g ? "Whole " + R.g : null});
    else if(R.kind === "rank") html = askRank(ch, T, R.items);
    else if(R.kind === "lines") html = askLines(ch, T, R.series, R.labels);
    else if(R.kind === "cum") html = askLines(ch, T, R.series.map(se => Object.assign({}, se, {vals:monthEnds(se.vals, se.y)})), MON, {step:false, tipHead:i => "By the end of " + MONTHS[i]});
    else if(R.kind === "pairs") html = askPairs(ch, T, R.items, R.names);
    else if(R.kind === "share") html = parts(ch, T, [[null, R.items]], R.total, form, ASK);
    else if(R.kind === "who"){ const g = R.g; html = parts(ch, T, [["By sex", [["Men and boys", g.sex.Male, T.c[0]], ["Women and girls", g.sex.Female, T.c[1]], ["Not recorded", g.sex.Unknown, T.muted]]],
      ["By age", Object.entries(g.age).map(([k, v], i) => [k === "Unknown" ? "Age not recorded" : k, v, k === "Unknown" ? T.muted : mix(T.surface, T.c[2], [.4, .6, .8, 1][Math.min(3, i)])])]], g.total, form, ASK); }
    if(R.kind === "share" && form !== "hbars" && form !== "table") ASK.legend = legend(R.items.map(x => [x[0], x[2]]));
    ch.innerHTML = html; ASK.svg = ch.querySelector("svg");
    box.querySelector("[data-legend]").innerHTML = ASK.legend || "";
    const rd = box.querySelector(".st-read"); rd.hidden = !R.read; if(R.read){ ASK.read = R.read; rd.firstChild.textContent = R.read[0]; rd.lastChild.textContent = R.read[1]; }
    box.querySelector("[data-save]").disabled = !ASK.svg;
    const said = S.notes.concat(R.notes || []);
    if(S.unknown.length) said.push("Not used: " + S.unknown.map(w => "“" + w + "”").join(", ") + ".");
    note.textContent = said.join(" ");
    menus(); fadeRows();
  }
  // a running total read at the end of each month (or the latest day, in the month still going), so a year is twelve points
  function monthEnds(vals, y){
    return MON.map((m, i) => { const endD = doy(y + "-" + String(i + 1).padStart(2, "0") + "-" + String(new Date(Date.UTC(y, i + 1, 0)).getUTCDate()).padStart(2, "0")); let v = null;
      for(let d = Math.min(endD, vals.length) - 1; d >= 0; d--) if(vals[d] != null){ v = vals[d]; break; }
      return y === +last.slice(0, 4) && i > +last.slice(5, 7) - 1 ? null : v; });
  }
  function askTable(R, S){
    const M = cap(mWord(S.measure));
    if(R.kind === "cols") return table(["", R.unit === "avg" && S.measure !== "perboat" ? M + " a day, on average" : M], (R.unit === "avg" ? R.items : R.items.slice().reverse()).map(b => [b.long, fmt(b.v)]));
    if(R.kind === "rank") return table(["", "When", M], R.items.map((b, i) => [String(i + 1), b.label, fmt(b.v)]));
    if(R.kind === "lines") return table([""].concat(R.series.map(s => s.name)), R.labels.map((l, i) => [l].concat(R.series.map(s => fmt(s.vals[i])))));
    if(R.kind === "cum") return table(["By the end of"].concat(R.series.map(s => s.name)), MON.map((m, i) => [MONTHS[i]].concat(R.series.map(s => fmt(monthEnds(s.vals, s.y)[i])))));
    if(R.kind === "pairs") return table(["", R.names[0], R.names[1]], R.items.slice().reverse().map(b => [b.long, fmt(b.a), fmt(b.b)]));
    if(R.kind === "share") return table(["Nationality", "People", "Share"], R.items.map(x => [x[0], fmt(x[1]), (x[1] / R.total * 100).toFixed(1) + "%"]));
    if(R.kind === "who"){ const g = R.g; return table(["Group", "People", "Share"], Object.entries(g.sex).concat(Object.entries(g.age)).map(([k, v]) => [{Male:"Men and boys", Female:"Women and girls", Unknown:"Not recorded"}[k] || k, fmt(v), (v / g.total * 100).toFixed(1) + "%"])); }
    return "";
  }
  function askHTML(){
    return '<section class="card st-card st-ask st-full" data-card="ask" aria-label="Ask for a chart">'
      + '<form class="st-ask-f" role="search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L20 20"/></svg>'
      + '<input type="search" name="q" enterkeyhint="go" autocomplete="off" spellcheck="false" placeholder="Ask for any chart" aria-label="Ask for a chart" value="' + esc(askQ.text) + '"><button type="submit">Show</button></form>'
      + '<div class="st-ask-eg" role="group" aria-label="Try one of these"></div>'
      + '<div class="st-ask-out" data-ask-out hidden><div class="st-top"><div><h3></h3><div class="st-read"><b>–</b><span>&nbsp;</span></div></div>'
      + '<div class="st-acts"><button type="button" class="st-act" data-save="ask" aria-label="Save this chart as a picture" title="Save as a picture">' + svgI("save") + "</button></div></div>"
      + '<div class="st-forms" role="group" aria-label="Chart form"></div>'
      + '<div class="st-chart" data-chart></div><div data-legend></div><p class="st-ask-note"></p></div></section>';
  }
  function ask(text){
    askQ.text = String(text || "").trim().slice(0, 200); askQ.form = null; store.set("ask", askQ.text);
    const i = wrap.querySelector(".st-ask-f input"); if(i && i.value !== askQ.text) i.value = askQ.text;
    (window.ccAsk ? askReady() : askScript).then(() => askReady()).then(() => { drawAsk(); play(ASK); });
  }

  function seg(key, opts, label){
    return '<div class="seg" role="group"' + (label ? ' aria-label="' + label + '"' : "") + ">" + opts.map(([v, l]) => '<button type="button" data-k="' + key + '" data-v="' + v + '" aria-pressed="' + (String(prefs[key]) === String(v)) + '">' + l + "</button>").join("") + "</div>";
  }

  /* ------------------------------------------------------------ the welcome, in the manner of an iPhone lock screen: a flat picture of the
     Channel's water, this year's total in large numerals, and four widgets on solid tiles */
  // the wallpaper: a plain sky, then five bands of water in solid colour, each a little deeper than the one above
  function wallpaper(W, H, dk){
    const P = dk ? {sky:"#0B1640", bands:["#1A2F86", "#0C47B8", "#0B7FD1", "#2346C7", "#081A55"]}
      : {sky:"#2F7BF5", bands:["#7FC4FF", "#4FA6FF", "#1E7BF0", "#1561D8", "#0B3FA8"]};
    const band = (y0, amp, ph) => {   // a band across the width, its top a smooth wave
      const n = 4, pts = [];
      for(let k = 0; k <= n; k++){ const x = W * k / n; pts.push([x, y0 + amp * Math.sin(ph + k * 1.7) + amp * .45 * Math.cos(ph * 1.3 + k * 2.9)]); }
      let d = "M" + (-4) + " " + pts[0][1].toFixed(1);
      for(let k = 1; k <= n; k++){ const a = pts[k - 1], b = pts[k], cx = (a[0] + b[0]) / 2; d += "C" + cx.toFixed(1) + " " + a[1].toFixed(1) + " " + cx.toFixed(1) + " " + b[1].toFixed(1) + " " + (k === n ? W + 4 : b[0]).toFixed(1) + " " + b[1].toFixed(1); }
      return d;
    };
    let g = '<svg viewBox="0 0 ' + W + " " + H + '" width="100%" height="100%" preserveAspectRatio="none" aria-hidden="true"><rect width="100%" height="100%" fill="' + P.sky + '"/>';
    P.bands.forEach((c, i) => { g += '<path d="' + band(H * (.34 + i * .13), H * (.035 + i * .012), i * 2.1 + .6) + "V" + (H + 4) + 'H-4Z" fill="' + c + '"/>'; });
    return g + "</svg>";
  }
  // small pictures for the widgets
  function spark(vals, w, h){   // a bar sparkline, newest on the right
    const mx = Math.max(1, ...vals), bw = w / vals.length;
    return '<svg class="st-w-spark" viewBox="0 0 ' + w + " " + h + '" preserveAspectRatio="none" aria-hidden="true">' + vals.map((v, i) => { const bh = Math.max(1.5, h * v / mx);
      return '<rect x="' + (i * bw + bw * .18).toFixed(1) + '" y="' + (h - bh).toFixed(1) + '" width="' + (bw * .64).toFixed(1) + '" height="' + bh.toFixed(1) + '" rx="' + Math.min(1.6, bw * .3).toFixed(1) + '"' + (i === vals.length - 1 ? ' class="on"' : "") + "/>"; }).join("") + "</svg>";
  }
  function line(vals, w, h){   // a smooth line with a dot at the end
    const mx = Math.max(...vals), mn = Math.min(...vals), p = vals.map((v, i) => [3 + (w - 6) * i / Math.max(1, vals.length - 1), h - 3 - (h - 6) * (v - mn) / Math.max(1e-9, mx - mn)]), e = p[p.length - 1];
    return '<svg class="st-w-line" viewBox="0 0 ' + w + " " + h + '" aria-hidden="true"><path d="' + smooth(p) + '"/><circle cx="' + e[0].toFixed(1) + '" cy="' + e[1].toFixed(1) + '" r="3"/></svg>';
  }
  const ICON = {
    compare:'<path d="M4 7h11M4 12h16M4 17h7"/>', cal:'<rect x="3.5" y="5" width="17" height="15.5" rx="3.2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    wave:'<path d="M2.5 9c1.6-1.4 3.2-1.4 4.8 0s3.2 1.4 4.7 0 3.2-1.4 4.7 0 3.2 1.4 4.8 0M2.5 15c1.6-1.4 3.2-1.4 4.8 0s3.2 1.4 4.7 0 3.2-1.4 4.7 0 3.2 1.4 4.8 0"/>',
    boat:'<path d="M3 14h18l-2.2 4.2a2 2 0 0 1-1.8 1.1H7a2 2 0 0 1-1.8-1.1z"/><circle cx="8" cy="10.5" r="1.6"/><circle cx="12" cy="10" r="1.6"/><circle cx="16" cy="10.5" r="1.6"/>'
  };
  function drawHero(){
    const el = $("stHero"); if(!el || !D.length) return;
    const cur = last.slice(0, 4), prev = String(+cur - 1), md = last.slice(5), m = r => r.migrants || 0;
    const yRows = D.filter(d => d.date.slice(0, 4) === cur), ytd = sum(yRows, m), pYtd = sum(D.filter(d => d.date.slice(0, 4) === prev && d.date.slice(5) <= md), m);
    const top = yRows.reduce((a, b) => m(b) > m(a) ? b : a, yRows[0] || D[D.length - 1]), td = parse(top.date);
    const from = iso(new Date(parse(last).getTime() - 29 * 864e5)), l30 = D.filter(d => d.date >= from), ch = pYtd ? Math.round((ytd / pYtd - 1) * 100) : null;
    const fmtDay = o => new Intl.DateTimeFormat("en-GB", Object.assign({timeZone:"UTC"}, o));
    const widget = (cls, icon, label, body) => '<div class="st-w ' + cls + '"><div class="st-w-h"><span class="st-w-ic"><svg viewBox="0 0 24 24" aria-hidden="true">' + ICON[icon] + "</svg></span>" + esc(label) + "</div>" + body + "</div>";
    const mx = Math.max(ytd, pYtd, 1);
    el.innerHTML = '<div class="st-hero-art"></div><div class="st-hero-in">'
      + '<p class="st-hero-date">' + esc(fmtDay({weekday:"long", day:"numeric", month:"long"}).format(parse(last))) + "</p>"
      + '<p class="st-hero-big" aria-label="' + fmt(ytd) + " people have crossed in " + cur + ' so far"><b>' + fmt(ytd) + "</b></p>"
      + '<p class="st-hero-sub">people have crossed the Channel in small boats in ' + cur + " so far</p>"
      + '<div class="st-hero-tiles">'
      + widget("w-cmp", "compare", "This year and last", '<div class="st-w-v">' + (ch == null ? "–" : (ch > 0 ? "+" : ch < 0 ? "−" : "") + Math.abs(ch) + "%") + "</div>"
        + '<div class="st-w-bars"><span><em>' + cur + "</em><b>" + fmt(ytd) + '</b><i style="--w:' + (ytd / mx).toFixed(3) + '"></i></span><span class="p"><em>' + prev + "</em><b>" + fmt(pYtd) + '</b><i style="--w:' + (pYtd / mx).toFixed(3) + '"></i></span></div>')
      + widget("w-cal", "cal", "Busiest day", '<div class="st-w-calrow"><div class="st-w-date"><small>' + esc(fmtDay({weekday:"short"}).format(td).toUpperCase()) + "</small><b>" + td.getUTCDate() + "</b><small>" + esc(fmtDay({month:"short"}).format(td)) + '</small></div><div><div class="st-w-v">' + fmt(m(top)) + '</div><div class="st-w-f">people in one day</div></div></div>')
      + widget("w-30", "wave", "Last 30 days", '<div class="st-w-v">' + fmt(sum(l30, m)) + '</div><div class="st-w-f">' + fmt(sum(l30, r => r.boats)) + " boats</div>" + spark(l30.map(m), 120, 30))
      + widget("w-pb", "boat", "People a boat", '<div class="st-w-v">' + (perBoat ? fmt(perBoat.last90.avg) : "–") + '</div><div class="st-w-f">' + (perBoat ? "last 90 days, up from " + fmt(perBoat.years[0].avg) + " in " + perBoat.years[0].y : "last 90 days") + "</div>"
        + (perBoat ? line(perBoat.years.map(y => y.avg), 120, 30) : ""))
      + "</div></div>";
    el.querySelector(".st-hero-art").innerHTML = wallpaper(el.clientWidth || 360, el.clientHeight || 520, isDark());
  }

  /* ------------------------------------------------------------ the page */
  const wrap = document.createElement("div"); wrap.className = "st-wrap";
  function controls(){
    return '<div class="st-bar" id="stBar"><div class="st-styles" role="group" aria-label="Style">' + STYLES.map(s => { const c = isDark() ? s.dark : s.light;
      return '<button type="button" class="st-sw" data-style="' + s.id + '" aria-pressed="' + (prefs.style === s.id) + '"><i aria-hidden="true">' + c.slice(0, 3).map(x => '<b style="background:' + x + '"></b>').join("") + "</i>" + s.name + "</button>"; }).join("") + "</div>"
      + '<div class="st-row">' + seg("measure", [["people","People"],["boats","Boats"],["perboat","People a boat"]], "Show")
      + "</div></div>";
  }
  const FORM_ICON = {calendar:"grid", waffle:"grid", vs:"area", rank:"hbars", lines:"line", seats:"people"};
  // on a wide screen the cards sit in pairs, so pairs of a similar height go together; the tall ones get a row of their own
  const ORDER = ["ot", "rt", "pat", "yr", "cal", "pb", "ret", "who", "nat"];
  CARDS.sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
  function shell(){
    let h = '<section class="st-hero" id="stHero" aria-label="The latest figures"></section>' + controls() + askHTML() + '<div class="st-grid">', head = false;
    CARDS.forEach(c => {
      if(c.people && !head){ head = true; h += '</div><div class="section-h" style="margin-bottom:-10px"><h2>Who is crossing</h2></div><div class="st-grid">'; }
      h += '<article class="card st-card' + (c.full ? " st-full" : "") + '" data-card="' + c.id + '"><div class="st-top"><div><h3>' + esc(c.title) + '</h3><div class="st-read"><b>–</b><span>&nbsp;</span></div></div>'
        + '<div class="st-acts"><button type="button" class="st-act" data-save="' + c.id + '" aria-label="Save ' + esc(c.title) + ' as a picture" title="Save as a picture">' + svgI("save") + "</button></div></div>"
        + (c.opts ? '<div class="st-opts" data-opts></div>' : "")
        + '<div class="st-forms" role="group" aria-label="Chart form">' + c.forms.map(([v, l]) => '<button type="button" data-k="' + c.key + '" data-v="' + v + '" aria-pressed="' + (prefs[c.key] === v) + '">' + svgI(FORM_ICON[v] || (ic[v] ? v : "bars")) + l + "</button>").join("") + "</div>"
        + '<div class="st-chart" data-chart></div><div data-legend></div></article>';
    });
    return h + "</div>" + '<p class="foot">Home Office figures, provisional and sometimes revised. Who is crossing, people per boat and the returns deal don’t change with Show and Range. Contains public sector information licensed under the Open Government Licence v3.0.</p>';
  }
  function drawAll(){
    if(!D.length || locked) return;
    const T = theme(); wrap.dataset.style = T.id;
    drawHero();
    CARDS.forEach(c => drawCard(c, T)); drawAsk(T);
    watchCards(); fadeRows(); menus();
  }
  // a chart animates in the first time it scrolls into view, and again whenever the visitor changes it; never on a resize or a live update
  function play(c){
    if(reduced) return; const ch = wrap.querySelector('[data-card="' + c.id + '"] [data-chart]'); if(!ch) return;
    ch.classList.remove("st-anim"); void ch.offsetWidth; ch.classList.add("st-anim");
    clearTimeout(ch._anim); ch._anim = setTimeout(() => ch.classList.remove("st-anim"), 1800);
  }
  // a row of buttons wider than its space fades at whichever end has more to scroll to
  const ROWS = ".st-forms,.st-styles,.st-row,.st-opts .seg";
  function fadeRow(el){ const more = el.scrollWidth - el.clientWidth > 2; el.classList.toggle("st-more-l", more && el.scrollLeft > 2); el.classList.toggle("st-more-r", more && el.scrollLeft < el.scrollWidth - el.clientWidth - 2); }
  const fadeRows = () => wrap.querySelectorAll(ROWS).forEach(fadeRow);
  wrap.addEventListener("scroll", e => { if(e.target.matches && e.target.matches(ROWS)) fadeRow(e.target); }, {capture:true, passive:true});
  let io = null;
  function watchCards(){
    if(io || !("IntersectionObserver" in window)) return;
    io = new IntersectionObserver(es => es.forEach(e => { if(!e.isIntersecting) return; io.unobserve(e.target); const c = CARDS.find(x => x.id === e.target.dataset.card); if(c) play(c); }), {threshold:.25});
    wrap.querySelectorAll("[data-card]").forEach(el => io.observe(el));
  }
  function drawCard(c, T){
    const el = wrap.querySelector('[data-card="' + c.id + '"]'); if(!el) return;
    const ch = el.querySelector("[data-chart]"), op = el.querySelector("[data-opts]");
    if(op) op.innerHTML = c.opts();
    c.pts = null; c.legend = "";
    ch.innerHTML = c.draw(ch, T || theme()); c.svg = ch.querySelector("svg");
    el.querySelector("[data-save]").disabled = !c.svg;   // a table or a note has no picture to save
    el.querySelector("[data-legend]").innerHTML = c.legend || "";
    const r = el.querySelector(".st-read"); if(c.read){ r.firstChild.textContent = c.read[0]; r.lastChild.textContent = c.read[1]; }
    el.querySelectorAll(".st-forms button").forEach(b => b.setAttribute("aria-pressed", prefs[c.key] === b.dataset.v));
  }
  /* on a phone, each row of buttons folds into a pull-down menu, as iOS does: a small capsule naming the choice, which opens the
     system's own menu (a <select> laid over it, so it is the real iOS picker and works with VoiceOver). Picking clicks the button it stands for */
  const CHEV = '<svg class="st-pick-c" viewBox="0 0 10 16" aria-hidden="true"><path d="M2 6l3-3 3 3M2 10l3 3 3-3"/></svg>';
  function pick(group, label){
    const bs = [...group.querySelectorAll("button")], on = bs.find(b => b.getAttribute("aria-pressed") === "true") || bs[0]; if(!on) return "";
    const lead = on.querySelector("i") ? on.querySelector("i").outerHTML : on.querySelector("svg") ? on.querySelector("svg").outerHTML : "";
    return '<label class="st-pick">' + lead + '<span>' + esc(on.textContent) + "</span>" + CHEV + '<select aria-label="' + esc(label) + '">'
      + bs.map((b, i) => '<option value="' + i + '"' + (b === on ? " selected" : "") + ">" + esc(b.textContent) + "</option>").join("") + "</select></label>";
  }
  function menus(){
    const fill = (host, groups) => { let box = host.querySelector(":scope > .st-picks"); if(!box){ box = document.createElement("div"); box.className = "st-picks"; host.insertBefore(box, groups.anchor); }
      box.innerHTML = groups.list.map(([g, l]) => pick(g, l)).join(""); box._groups = groups.list.map(x => x[0]); };
    const bar = wrap.querySelector(".st-bar");
    if(bar) fill(bar, {anchor:bar.firstChild, list:[[bar.querySelector(".st-styles"), "Style"], [bar.querySelector(".st-row .seg"), "Show"]]});
    wrap.querySelectorAll("[data-card]").forEach(el => {
      const forms = el.querySelector(".st-forms"), list = [[forms, "Chart form"]];
      el.querySelectorAll(".st-opts .seg").forEach(g => list.push([g, g.getAttribute("aria-label") || "Options"]));
      const anchor = el.querySelector(".st-opts") || forms; fill(anchor.parentElement, {anchor, list});
    });
  }
  wrap.addEventListener("change", e => {
    const sel = e.target.closest(".st-pick select"); if(!sel) return;
    const box = sel.closest(".st-picks"), i = [...box.querySelectorAll("select")].indexOf(sel), g = box._groups && box._groups[i];
    const b = g && g.querySelectorAll("button")[+sel.value]; if(b) b.click();
  });
  const affects = {measure:"*", range:["ot"], style:"*", group:["ot"], avg:["ot"], ot:["ot"], rt:["rt"], cal:["cal"], calY:["cal"], pat:["pat"], patF:["pat"], yr:["yr"], who:["who"], whoF:["who"], nat:["nat"], ret:["ret"], pb:["pb"]};
  wrap.addEventListener("click", e => {
    const sw = e.target.closest(".st-sw");
    if(sw){ prefs.style = sw.dataset.style; save(); wrap.querySelectorAll(".st-sw").forEach(b => b.setAttribute("aria-pressed", b === sw)); drawAll(); CARDS.forEach(play); return; }
    const sv = e.target.closest("[data-save]"); if(sv){ savePicture(cardById(sv.dataset.save)); return; }
    const b = e.target.closest("button[data-k]"); if(!b) return;
    const k = b.dataset.k, v = b.dataset.v; prefs[k] = v === "true" ? true : v === "false" ? false : v; save();
    b.parentElement.querySelectorAll("button[data-k]").forEach(x => x.setAttribute("aria-pressed", x === b));
    const which = affects[k] === "*" ? CARDS : CARDS.filter(c => (affects[k] || []).includes(c.id)); const T = theme(); which.forEach(c => { drawCard(c, T); play(c); }); fadeRows(); menus();
  });

  /* the tooltip: the nearest point to the pointer, along the chart (or in both directions for squares, rings and bars) */
  const tip = document.createElement("div"); tip.className = "st-tip"; tip.setAttribute("aria-hidden", "true"); document.body.appendChild(tip);
  function hover(e){
    const ch = e.target.closest && e.target.closest("[data-chart]"); if(!ch) return;
    const c = cardById(ch.closest("[data-card]").dataset.card), svg = ch.querySelector("svg");
    if(!c || !c.pts || !c.pts.length || !svg){ hideTip(); return; }
    const r = svg.getBoundingClientRect(), k = (+svg.getAttribute("width")) / r.width, px = (e.clientX - r.left) * k, py = (e.clientY - r.top) * k;
    let best = null, bd = Infinity;
    c.pts.forEach(p => { const d = c.mode === "x" ? Math.abs(p.x - px) : c.mode === "y" ? Math.abs(p.y - py) : Math.hypot(p.x - px, p.y - py); if(d < bd){ bd = d; best = p; } });
    if(!best || (c.mode === "xy" && bd > 40)){ hideTip(); return; }
    tip.innerHTML = best.tip; tip.classList.add("on");
    const mk = svg.querySelector(".st-mk"); if(mk && c.mode === "x"){ mk.setAttribute("cx", best.x); mk.setAttribute("cy", best.y); mk.setAttribute("opacity", 1); }
    const tw = tip.offsetWidth, th = tip.offsetHeight, sx = r.left + best.x / k, sy = r.top + best.y / k;
    tip.style.left = Math.max(8, Math.min(innerWidth - tw - 8, sx - tw / 2)) + "px"; tip.style.top = Math.max(8, sy - th - 14) + "px";
  }
  function hideTip(){ tip.classList.remove("on"); wrap.querySelectorAll(".st-mk").forEach(m => m.setAttribute("opacity", 0)); }
  wrap.addEventListener("pointermove", hover); wrap.addEventListener("pointerdown", hover);
  // a finger lifting counts as leaving, so on phones the tip stays until the next tap elsewhere or a scroll
  wrap.addEventListener("pointerleave", e => { if(e.pointerType !== "touch") hideTip(); });
  document.addEventListener("pointerdown", e => { if(!(e.target.closest && e.target.closest("[data-chart]"))) hideTip(); }, {passive:true});
  addEventListener("scroll", hideTip, {passive:true});

  /* save a chart as a picture: the chart on the card's colour, with its title and where the figures come from */
  function savePicture(c){
    if(!c || !c.svg){ return; }
    const T = theme(), svg = c.svg, W = +svg.getAttribute("width"), H = +svg.getAttribute("height"), P = 28, el = wrap.querySelector('[data-card="' + c.id + '"]');
    const [big, sub] = c.read || ["", ""], ff = T.font.replace(/"/g, "'");
    // words wrapped to the chart's width, so a phone-sized picture keeps all of its text
    const ctx = document.createElement("canvas").getContext("2d"), wide = (s, f) => { ctx.font = f + " " + T.font; return ctx.measureText(s).width; };
    const lines = (s, f) => s.split(" ").reduce((a, w) => { const t = a[a.length - 1] ? a[a.length - 1] + " " + w : w; if(a[a.length - 1] && wide(t, f) > W) a.push(w); else a[a.length - 1] = t; return a; }, [""]);
    const beside = wide(big, "700 24px") + 8 + wide(sub, "500 13px") <= W, subL = beside ? [] : lines(sub, "500 13px"), footL = lines("channelcrossings.world · Home Office figures, Open Government Licence v3.0", "400 11px");
    const top = 70 + subL.length * 17, bot = 29 + footL.length * 15;
    const tl = (ls, x, y0, dy) => ls.map((l, i) => '<tspan x="' + x + '" y="' + (y0 + i * dy) + '">' + esc(l) + "</tspan>").join("");
    const inner = svg.outerHTML.replace("<svg ", '<svg x="' + P + '" y="' + top + '" ').replace(/<circle class="st-mk"[^>]*>(<\/circle>)?/, "");   // without the tooltip's marker
    const doc = '<svg xmlns="http://www.w3.org/2000/svg" width="' + (W + P * 2) + '" height="' + (H + top + bot) + '"><rect width="100%" height="100%" fill="' + T.surface + '"/>'
      + '<text x="' + P + '" y="' + (P + 6) + '" font-family="' + ff + '" font-size="15" font-weight="600" fill="' + T.ink2 + '">' + esc(c.title) + "</text>"
      + '<text x="' + P + '" y="' + (P + 32) + '" font-family="' + ff + '" font-size="24" font-weight="700" fill="' + T.ink + '">' + esc(big) + (beside ? '<tspan font-size="13" font-weight="500" fill="' + T.ink2 + '" dx="8">' + esc(sub) + "</tspan>" : "") + "</text>"
      + (subL.length ? '<text font-family="' + ff + '" font-size="13" font-weight="500" fill="' + T.ink2 + '">' + tl(subL, P, P + 52, 17) + "</text>" : "")
      + inner + '<text font-family="' + ff + '" font-size="11" fill="' + T.ink2 + '">' + tl(footL, P, top + H + 28, 15) + "</text></svg>";
    const img = new Image(), url = URL.createObjectURL(new Blob([doc], {type:"image/svg+xml"}));
    img.onload = () => {
      const k = 2, cv = document.createElement("canvas"); cv.width = (W + P * 2) * k; cv.height = (H + top + bot) * k;
      const x = cv.getContext("2d"); x.scale(k, k); x.drawImage(img, 0, 0); URL.revokeObjectURL(url);
      cv.toBlob(b => { const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "channel-crossings-" + c.id + ".png"; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }, "image/png");
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
    if(el){ const b = el.querySelector("[data-save]"); b.animate && !reduced && b.animate([{transform:"scale(.85)"}, {transform:"scale(1)"}], {duration:260, easing:"cubic-bezier(.3,1.4,.5,1)"}); }
  }

  /* ------------------------------------------------------------ the account and the unlock
     An account is just an email address. Paying makes one (Stripe records the email with the payment) and signs this
     device in straight away; on another device the visitor asks for a sign-in link, which the worker emails them. The
     worker signs a token saying who they are; this page keeps it, and asks the worker whether that email has paid. */
  let acct = store.get("acct");   // {token, email, studio}
  let locked = true;   // only the worker's answer unlocks Studio, never what this device remembers
  const offer = document.createElement("div"); offer.className = "st-offer";
  const tick = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  // an error carries the worker's status (401: the sign-in has run out); no connection at all reads as plain English, not "Failed to fetch"
  function api(path, body, token){
    return fetch(API + path, {method:body ? "POST" : "GET", headers:Object.assign({"Content-Type":"application/json"}, token ? {Authorization:"Bearer " + token} : {}), body:body ? JSON.stringify(body) : undefined})
      .catch(() => { throw Object.assign(new Error("Studio couldn’t be reached. Check your connection and try again."), {offline:true}); })
      .then(r => r.json().catch(() => ({})).then(j => { if(!r.ok) throw Object.assign(new Error(j.error || "Something went wrong. Please try again."), {status:r.status}); return j; }));
  }
  function renderOffer(mode, msg, err){
    const signedIn = acct && acct.token;
    let body;
    if(mode === "key") body = '<h3>Enter your password</h3><p>This account signs in with its password.</p>'
      + '<form data-form="key"><input class="st-field" type="password" name="key" required autocomplete="current-password" placeholder="Password" aria-label="Password"><button class="st-buy" type="submit">Sign in</button></form>'
      + '<p class="st-msg' + (err ? " err" : "") + '" role="status">' + (msg ? esc(msg) : "") + "</p>"
      + '<button type="button" class="st-link" data-act="back">Back</button>';
    else if(mode === "sent") body = '<h3>Check your email</h3><p>We’ve sent a sign-in link to <b>' + esc(msg) + '</b>. Open it on this device to unlock Studio here. If it isn’t in your inbox within a minute, check your junk folder.</p><button type="button" class="st-link" data-act="back">Use a different email</button>';
    else if(mode === "signin") body = '<h3>Sign in</h3><p>Already unlocked Studio? Enter the email you paid with and we’ll send you a link to sign in on this device.</p>'
      + '<form data-form="signin"><input class="st-field" type="email" name="email" required autocomplete="email" placeholder="Email address" aria-label="Email address"><button class="st-buy" type="submit">Email me a sign-in link</button></form>'
      + '<p class="st-msg' + (err ? " err" : "") + '" role="status">' + (msg ? esc(msg) : "") + "</p>"
      + '<button type="button" class="st-link" data-act="back">Back</button>';
    else body = "<h3>Every chart, your way</h3><p>Every chart on Channel Crossings, and new ones, drawn the way you want to see them.</p>"
      + '<p class="st-free"><b>The figures are free, and always will be.</b> Studio is the same Home Office figures in more depth, in forms that are easier to understand.</p>'
      + '<ul class="st-list"><li>' + tick + "<span><b>New:</b> ask for any chart in your own words</span></li><li>" + tick + "<span>Every graph in six styles</span></li><li>" + tick + "<span>Lines, rings, roses, calendars and more</span></li><li>"
      + tick + "<span>People, boats or people a boat</span></li><li>" + tick + "<span>Save charts as pictures or tables</span></li><li>" + tick + "<span>Live updates without reloading</span></li></ul>"
      + (signedIn ? '<button type="button" class="st-buy" data-act="buy"' + (API ? "" : " disabled") + ">Unlock for " + PRICE + "</button>"
        : '<form data-form="buy"><input class="st-field" type="email" name="email" required autocomplete="email" placeholder="Email address" aria-label="Email address, for your account and receipt"><button class="st-buy" type="submit"' + (API ? "" : " disabled") + ">Unlock for " + PRICE + "</button></form>")
      + '<p class="st-msg' + (err ? " err" : "") + '" role="status">' + (msg ? esc(msg) : API ? "" : "Payments open soon.") + "</p>"
      + (signedIn ? '<p class="st-fine">Signed in as ' + esc(acct.email) + ' · <button type="button" class="st-link" style="padding:0;font-size:inherit" data-act="out">Sign out</button></p>'
        : '<button type="button" class="st-link" data-act="signin">Already paid? Sign in</button>')
      + '<p class="st-fine">One payment, no subscription, paid securely through Stripe. Your email unlocks Studio on any device. Figures: Home Office, Open Government Licence v3.0.</p>';
    offer.innerHTML = body;
  }
  let keyFor = "";   // the email of an account that signs in with a password
  offer.addEventListener("submit", e => {
    e.preventDefault(); const f = e.target, btn = f.querySelector("button");
    btn.disabled = true;
    if(f.dataset.form === "key"){ api("/login", {email:keyFor, key:f.key.value}).then(signIn).catch(x => renderOffer("key", x.message, true)); return; }
    const email = f.email.value.trim();
    const fail = mode => x => { renderOffer(mode, x.message, true); const i = offer.querySelector("input"); if(i) i.value = email; };   // keep what they typed
    if(f.dataset.form === "signin") api("/login", {email}).then(j => { if(j.key){ keyFor = email; renderOffer("key"); } else renderOffer("sent", email); }).catch(fail("signin"));
    else checkout({email}).catch(fail("offer"));
  });
  offer.addEventListener("click", e => {
    const a = e.target.closest("[data-act]"); if(!a) return;
    if(a.dataset.act === "signin") renderOffer("signin");
    if(a.dataset.act === "back") renderOffer("offer");
    if(a.dataset.act === "out"){ store.del("acct"); acct = null; renderOffer("offer"); if(window.ccLive) window.ccLive(false); }
    if(a.dataset.act === "buy"){ a.disabled = true; checkout({}).catch(x => renderOffer("offer", x.message, true)); }
  });
  function checkout(body){
    return api("/checkout", body, acct && acct.token).then(j => {
      if(j.url){ location.href = j.url; return; }
      if(j.paid && j.sent) renderOffer("sent", body.email || (acct && acct.email));   // already paid: the worker emailed a sign-in link instead
      else if(j.paid && j.token) signIn(j);
    });
  }
  function signIn(j){ acct = {token:j.token, email:j.email, studio:!!j.studio}; store.set("acct", acct); setLocked(!acct.studio); }

  const lockBox = document.createElement("div"); lockBox.className = "st-lock";
  // behind the offer, a blurred picture of Studio: never the charts themselves, which only an unlocked account gets
  const peek = document.createElement("div"); peek.className = "st-peek"; peek.setAttribute("aria-hidden", "true");
  const peekPic = () => '<img src="studio-peek-' + (isDark() ? "dark" : "light") + '.webp" alt="" width="464" height="550" decoding="async">';
  const acctLine = document.createElement("p"); acctLine.className = "st-acct";
  // the offer starts just under the bar at the top, wherever the site notice above it leaves that bar
  function placeLock(){ const r = document.querySelector(".top-row"); if(r && lockBox.isConnected) lockBox.style.paddingTop = Math.round(r.getBoundingClientRect().bottom + (innerWidth < 720 ? 10 : 18)) + "px"; }
  addEventListener("resize", placeLock);
  const busy = document.getElementById("busyNote"); if(busy) busy.addEventListener("toggle", placeLock);
  new MutationObserver(() => requestAnimationFrame(placeLock)).observe(document.documentElement, {attributes:true, attributeFilter:["data-tab"]});
  function setLocked(on){
    locked = on;
    if(!on && window.ccLive) window.ccLive(true);   // live updates across the site come with Studio
    const pg = document.getElementById("pg-studio"); if(pg) pg.classList.toggle("st-locked", on);   // the page's own title steps aside for the offer
    // the offer covers the whole window, so it hangs off the body, clear of the page's own box; it shows only while Studio is the open tab
    if(on){ renderOffer("offer"); lockBox.append(offer); host.replaceChildren(); document.body.append(lockBox); placeLock(); showOut(); return; }
    else { lockBox.remove(); host.replaceChildren(acctLine, wrap); acctLine.innerHTML = window.CC_STUDIO_PREVIEW && !(acct && acct.email) ? 'Preview: only devices with the preview link see Studio until payments are switched on · <button type="button">Show the offer</button>' : ""; }
    showOut();
    requestAnimationFrame(drawAll);
  }
  // signing out lives in the round door button at the top of the page, beside Appearance and Share (index.html draws it and asks first)
  function signOut(){ store.del("acct"); acct = null; setLocked(true); if(window.ccLive) window.ccLive(false); }
  function showOut(){
    const b = document.getElementById("outBtn"), who = document.getElementById("outWho"), on = !locked && !!(acct && acct.email);
    if(b) b.hidden = !on; if(who) who.textContent = on ? "You’re signed in as " + acct.email + ". You can sign back in any time with the same email." : "";
  }
  window.ccSignOut = signOut;
  acctLine.addEventListener("click", e => { if(e.target.closest("button")) signOut(); });

  // coming back from Stripe, or from the sign-in link in an email
  function arrivals(){
    const q = new URLSearchParams(location.search), cs = q.get("cs"), link = q.get("signin");
    const demo = window.CC_STUDIO_PREVIEW || (q.get("studio") === "demo" && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname));   // the preview, or trying the page out locally
    if(cs || link || q.has("studio")){ ["cs", "signin", "studio"].forEach(k => q.delete(k)); history.replaceState(null, "", location.pathname + (q.toString() ? "?" + q : "") + "#studio"); }
    if(demo){ acct = {token:"", email:"", studio:true}; setLocked(false); return; }
    if(acct) acct.studio = false;   // what this device remembers never unlocks anything; only the worker's answer below does
    if(!API) return;
    if(cs){ renderOffer("offer", "Confirming your payment…"); api("/claim", {session_id:cs}).then(signIn).catch(x => renderOffer("offer", x.message, true)); return; }
    if(link){ renderOffer("offer", "Signing you in…"); api("/session", {link}).then(signIn).catch(x => renderOffer("offer", x.message, true)); return; }
    if(acct && acct.token){ renderOffer("offer", "Checking your account…"); api("/me", null, acct.token).then(j => { acct.studio = !!j.studio; store.set("acct", acct); if(j.studio) setLocked(false); else renderOffer("offer"); })
      .catch(x => {
        if(x.status === 401){ store.del("acct"); acct = null; }   // a sign-in that has run out: ask for a new one rather than keep a dead token
        renderOffer("offer", x.offline ? "Studio couldn’t check your account. Check your connection and reload." : x.message, true); }); return; }
    acct = null;
  }

  // Ask for a chart: typing, the examples, and switching the answer's form
  wrap.addEventListener("submit", e => { if(!e.target.matches(".st-ask-f")) return; e.preventDefault(); const i = e.target.q; i.blur(); ask(i.value); });
  wrap.addEventListener("click", e => {
    const eg = e.target.closest("[data-ask]"); if(eg){ ask(eg.dataset.ask); return; }
    const f = e.target.closest("[data-ask-form]"); if(f){ askQ.form = f.dataset.askForm; drawAsk(); play(ASK); }
  });
  // the words-to-chart reader, studio-ask.js, fetched alongside
  const askScript = new Promise(res => { if(window.ccAsk) return res(); const sc = document.createElement("script"); sc.src = "studio-ask.js"; sc.onload = sc.onerror = () => res(); document.head.appendChild(sc); })
    .then(() => { const eg = wrap.querySelector(".st-ask-eg"); if(eg && window.ccAsk) eg.innerHTML = window.ccAsk.EXAMPLES.map(e => '<button type="button" data-ask="' + esc(e) + '">' + esc(e) + "</button>").join(""); fadeRows(); });

  /* ------------------------------------------------------------ start */
  wrap.innerHTML = shell();
  setLocked(locked);
  arrivals();
  Promise.resolve(window.__data || getJSON("data.json")).catch(() => getJSON("data.json")).then(j => {
    D = j.days || [];
    last = D.length ? D[D.length - 1].date : null; drawAll();
    if(askQ.text) ask(askQ.text);
  }).catch(() => { wrap.querySelectorAll("[data-chart]").forEach(c => c.innerHTML = '<p class="st-note">The figures couldn’t be loaded. Check your connection and try again.</p>'); });
  Promise.allSettled([getJSON("gender.json"), getJSON("nationalities.json"), getJSON("returns.json"), getJSON("perboat.json")]).then(([g, n, r, b]) => {
    gender = g.value || null; nats = n.value || null; rets = r.value || null; perBoat = b.value && b.value.years && b.value.years.length ? b.value : null; const T = theme(); if(D.length && !locked){ CARDS.filter(c => c.people).forEach(c => drawCard(c, T)); drawHero(); drawAsk(T); }
  });

  // redraw when the page changes width, or the visitor switches between day and night
  let rw = 0, rt = 0;
  addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { const w = host.clientWidth; if(w && w !== rw){ rw = w; drawAll(); } }, 120); });
  function retheme(){ if(locked) peek.innerHTML = peekPic(); wrap.querySelectorAll(".st-sw").forEach(b => { const s = STYLES.find(x => x.id === b.dataset.style); b.querySelectorAll("b").forEach((x, i) => x.style.background = (isDark() ? s.dark : s.light)[i]); }); drawAll(); }
  new MutationObserver(retheme).observe(docEl, {attributes:true, attributeFilter:["data-theme"]});
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", retheme);
})();
