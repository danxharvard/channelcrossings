/* Studio's "Ask for a chart": turns what a visitor types ("boats each month in 2022", "top nationalities since 2018",
   "busiest days ever") into a plan for one chart, which studio.js then draws from the site's own figures.
   No AI service is involved: the words are matched against what the site has figures for (people, boats, people per
   boat, nationalities, sex and age, the UK–France returns deal, asylum decisions and small boat returns), the times
   it covers (every day since records began on 1 January 2018) and the kinds of chart Studio draws. Anything it can't
   place is reported back, so the visitor can see what was understood.
   Loaded by studio.js; also runs under Node for its tests (scripts/test-ask.js). */
(function(root){
  "use strict";

  const MONTHS = ["january","february","march","april","may","june","july","august","september","october","november","december"];
  const MON3 = MONTHS.map(m => m.slice(0, 3));
  const NUMW = {one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10, eleven:11, twelve:12, fifteen:15, twenty:20, thirty:30, fifty:50, hundred:100};
  // what people call each other, matched to the start of the country's name in the Home Office's list
  const DEMONYM = {afghan:"afghan", afghans:"afghan", afghani:"afghan", iranian:"iran", iranians:"iran", persian:"iran", iraqi:"iraq", iraqis:"iraq",
    eritrean:"eritrea", eritreans:"eritrea", sudanese:"sudan", syrian:"syria", syrians:"syria", albanian:"albania", albanians:"albania",
    vietnamese:"viet", somali:"somalia", somalis:"somalia", egyptian:"egypt", egyptians:"egypt", ethiopian:"ethiopia", ethiopians:"ethiopia",
    turkish:"turk", turks:"turk", indian:"india", indians:"india", pakistani:"pakistan", pakistanis:"pakistan", kuwaiti:"kuwait", kuwaitis:"kuwait",
    yemeni:"yemen", yemenis:"yemen", libyan:"libya", libyans:"libya", chadian:"chad", chadians:"chad", bangladeshi:"bangladesh", bangladeshis:"bangladesh",
    palestinian:"palestin", palestinians:"palestin", georgian:"georgia", georgians:"georgia", nigerian:"nigeria", nigerians:"nigeria",
    salvadoran:"el salvador", guinean:"guinea", guineans:"guinea", malian:"mali", senegalese:"senegal", gambian:"gambia", moroccan:"morocco", algerian:"algeria"};
  const STOP = new Set(("a an the of in on at by for to from and or with into over across during within per each every all any some " +
    "show me give get make draw plot chart charts graph graphs picture visual visualise visualize view see let i want would like could can you please " +
    "how many much what which who where when was were is are be been has have had did do does there their they them it its this that these those " +
    "number numbers figure figures total totals count amount stats statistics data info about come came coming arrive arrived arriving arrivals arrival " +
    "cross crossed crossing crossings crosses channel english small uk britain england detected recorded landed reached made journey journeys " +
    "people persons migrants migrant individuals refugees boat boats dinghy dinghies vessels vessel year years month months week weeks day days quarter quarters " +
    "time times so far up down vs versus against compare compared comparison than between since until till before after last past previous next ago " +
    "breakdown broken split shown showing just only also like as well please thanks thank most more least common top pattern patterns busiest biggest highest largest quietest lowest fewest record").split(" "));

  const pad = n => String(n).padStart(2, "0");
  const iso = d => d.toISOString().slice(0, 10);
  const day = s => new Date(s + "T12:00:00Z");
  const addDays = (s, n) => iso(new Date(day(s).getTime() + n * 864e5));
  const monthEnd = (y, m) => y + "-" + pad(m) + "-" + pad(new Date(Date.UTC(y, m, 0)).getUTCDate());
  const cap = s => s[0].toUpperCase() + s.slice(1);
  const num = w => /^\d+$/.test(w) ? +w : NUMW[w];

  function parse(text, ctx){
    ctx = ctx || {};
    const last = ctx.last || iso(new Date()), first = ctx.first || "2018-01-01", Y0 = +first.slice(0, 4), YN = +last.slice(0, 4);
    const raw = String(text || "").trim();
    // work on a lower-case copy; each phrase that is understood is blanked out, so whatever is left is what wasn't
    let t = " " + raw.toLowerCase().replace(/[’']/g, "'").replace(/[–—]/g, "-").replace(/[^a-z0-9'\- ]+/g, " ").replace(/\s+/g, " ") + " ";
    const heard = [], notes = [];
    const take = re => { const m = t.match(re); if(m){ t = t.replace(re, " "); } return m; };
    const has = re => re.test(t);
    const S = {topic:"crossings", measure:"people", shape:null, group:null, from:null, to:null, years:null, month:null, pattern:null,
      n:null, order:"desc", unit:null, form:null, country:null, outcome:null, rangeLabel:"", heard, notes, unknown:[], text:raw};
    if(!raw) return Object.assign(S, {empty:true});

    /* ---------------- the chart form they asked for */
    if(take(/\b(pie|donut|doughnut|ring)( chart| graph)?s?\b/)) S.form = "donut";
    else if(take(/\b(table|list|spreadsheet)s?\b/)) S.form = "table";
    else if(take(/\barea( chart| graph)?\b/)) S.form = "area";
    else if(take(/\b(line|lines|trend|trends)( chart| graph)?\b/)) S.form = "line";
    else if(take(/\b(bar|bars|column|columns|histogram)( chart| graph)?\b/)) S.form = "bars";
    if(take(/\b(calendar|heat ?map)\b/)) notes.push("For a day-by-day calendar, see “A year, day by day” further down.");

    /* ---------------- what about */
    const peopleWord = /\b(people|persons|migrants?|individuals|refugees|passengers|men|women)\b/;
    if(take(/\b(people|persons|migrants|passengers)? ?(per|a|an|each|on each|in each|on a|in a|on every) (small )?(boat|dinghy|vessel)\b|\bboat ?(size|load)s?\b|\bsize of (the )?boats\b|\baverage (boat|load)\b|\bhow (full|crowded|packed)\b|\b(crowded|overcrowded|packed)\b/)){
      S.measure = "perboat"; heard.push("people per boat"); }
    else if(has(/\b(boats?|dinghies|dinghy|vessels?)\b/) && !has(peopleWord)){ S.measure = "boats"; heard.push("boats"); }

    // a country, by name or by what its people are called
    const countries = ctx.countries || [];
    const words = t.trim().split(" ");
    for(const w of words){
      const stem = DEMONYM[w] || (w.length > 3 ? w : null); if(!stem) continue;
      const hit = countries.find(c => c.toLowerCase().startsWith(stem) || (stem.length > 4 && c.toLowerCase().startsWith(stem.replace(/s$/, ""))));
      if(hit && (DEMONYM[w] || hit.toLowerCase().startsWith(w.replace(/s$/, "")))){ S.topic = "nat"; S.country = hit; t = t.replace(new RegExp("\\b" + w + "\\b"), " "); heard.push(hit); break; }
      if(!countries.length && DEMONYM[w]){ S.topic = "nat"; S.countryWord = w; t = t.replace(new RegExp("\\b" + w + "\\b"), " "); heard.push(cap(w)); break; }
    }
    if(take(/\b(nationalit(y|ies)|countr(y|ies)( of origin)?|origins?|where (are |were |do |did )?(most )?(they|people|migrants|the migrants)( come| came| are| were)? from|citizens?hip)\b/)){ S.topic = "nat"; heard.push("nationalities"); }
    else if(take(/\b(one in,? one out|returns? deal|uk ?- ?france|uk and france|france deal|the deal|transfer(s|red)?|returned to france)\b/)){ S.topic = "deal"; heard.push("the UK–France returns deal"); }
    else if(has(/\b(asylum|granted|refus\w*|claims?|protection|refugee status|decisions?|grant rate|withdrawn)\b/)){
      S.topic = "asylum"; heard.push("asylum decisions");
      const g = take(/\b(granted|grants?|grant rate|accepted|approved|successful)\b/g), r = take(/\b(refused|refusals?|rejected|turned down)\b/g);
      S.outcome = g && !r ? "granted" : r && !g ? "refused" : null;
      take(/\b(asylum|claims?|protection|refugee status|decisions?|withdrawn|outcomes?|results?)\b/g);
    }
    else if(take(/\b(removed|removals?|deport\w*|sent back|returns|returned|enforced)\b/)){ S.topic = "removed"; heard.push("small boat arrivals returned"); }
    else if(has(/\b(women|woman|girls?|boys?|men|man|male|female|sex|gender|children|child|kids|minors|ages?|aged|adults?|under 18|under-18s?|young|old|older)\b/)){
      S.topic = "who"; heard.push("sex and age");
      take(/\b(women|woman|girls?|boys?|men|man|male|female|sex|gender|children|child|kids|minors|ages?|aged|adults?|under 18|under-18s?|young|old|older|and)\b/g);
    }

    /* ---------------- when */
    const yr = s => { let y = +s; if(s.length === 2) y = 2000 + y; return y; };
    let y1 = null, y2 = null, m;
    const relUnit = {day:1, days:1, week:7, weeks:7, month:30.4, months:30.4, year:365, years:365};
    if((m = take(/\bbetween (20\d\d) and (20\d\d)\b/)) || (m = take(/\b(?:from )?(20\d\d) ?(?:-|to|until|till|through) ?(20\d\d|\d\d)\b/))){ y1 = yr(m[1]); y2 = yr(m[2]); }
    if(!y1 && (m = take(/\b(since|from|after|starting( in)?) (20\d\d)\b/))){ y1 = +m[3] + (m[1] === "after" ? 1 : 0); y2 = YN; S.since = true; }
    if(!y1 && (m = take(/\b(before|until|till|up to|to) (20\d\d)\b/))){ y1 = Y0; y2 = +m[2] - (m[1] === "before" ? 1 : 0); }
    if(y1){ heard.push(y1 === y2 ? String(y1) : S.since ? "since " + y1 : y1 + " to " + y2); }

    // a month of a particular year, or a month in every year
    const monRe = new RegExp("\\b(" + MONTHS.join("|") + "|" + MON3.filter(x => x !== "may" && x !== "mar").join("|") + "|sept)\\b(?: of)? ?(20\\d\\d)?");
    if(!y1 && (m = take(monRe))){
      const mi = (m[1] === "sept" ? 8 : MON3.indexOf(m[1].slice(0, 3))) + 1;
      if(m[2]){ const y = +m[2]; S.from = y + "-" + pad(mi) + "-01"; S.to = monthEnd(y, mi); S.rangeLabel = cap(MONTHS[mi - 1]) + " " + y; heard.push(S.rangeLabel); }
      else { S.month = mi; heard.push("every " + cap(MONTHS[mi - 1])); }
    }

    // last / past / this ...
    if(!y1 && !S.from){
      const rel = /\b(?:the )?(?:last|past|previous) (\d+|[a-z]+) (days?|weeks?|months?|years?)\b/, rm = t.match(rel);
      if(rm && num(rm[1])){
        take(rel); const n = num(rm[1]), u = rm[2]; S.from = addDays(last, -Math.round(n * relUnit[u]) + 1); S.to = last;
        S.rangeLabel = "the last " + (n === 1 ? u.replace(/s$/, "") : n + " " + u.replace(/([^s])$/, "$1s")); heard.push(S.rangeLabel);
      }
      else if(take(/\b(?:the )?(?:last|past) (12|twelve) months\b|\b(?:the )?past year\b/)){ S.from = addDays(last, -364); S.to = last; S.rangeLabel = "the last 12 months"; heard.push(S.rangeLabel); }
      else if(take(/\b(this year and last( year)?|last year and this( year)?|this year (vs|versus|against|compared (to|with)) last( year)?)\b/)){ S.years = [YN - 1, YN]; heard.push("this year and last"); }
      else if(take(/\b(this year|so far this year|year to date|ytd|current year)( so far)?\b/)){ y1 = y2 = YN; heard.push("this year"); }
      else if(take(/\b(last year|previous year)\b/)){ y1 = y2 = YN - 1; heard.push(String(YN - 1)); }
      else if(take(/\b(this month)\b/)){ S.from = last.slice(0, 8) + "01"; S.to = last; S.rangeLabel = "this month"; heard.push("this month"); }
      else if(take(/\b(last month)\b/)){ const d = day(last.slice(0, 8) + "01"); d.setUTCMonth(d.getUTCMonth() - 1); const y = d.getUTCFullYear(), mo = d.getUTCMonth() + 1; S.from = y + "-" + pad(mo) + "-01"; S.to = monthEnd(y, mo); S.rangeLabel = cap(MONTHS[mo - 1]) + " " + y; heard.push(S.rangeLabel); }
      else if(take(/\b(this week)\b/)){ S.from = addDays(last, -6); S.to = last; S.rangeLabel = "the last 7 days"; heard.push(S.rangeLabel); }
    }
    if(take(/\b(all time|of all time|ever|since records began|since records started|records began|since the (start|beginning)|from the (start|beginning)|all (the )?years|every year on record|in history|history|overall|on record|to date|altogether|in total)\b/)){
      if(!y1 && !S.from && !S.years){ y1 = Y0; y2 = YN; S.allTime = true; } heard.push("since records began");
    }
    // any years left: one is that year, two or more are a comparison
    const rest = [];
    t = t.replace(/\b(20\d\d)\b/g, (x, y) => { rest.push(+y); return " "; });
    if(rest.length === 1 && !y1){ y1 = y2 = rest[0]; heard.push(String(y1)); }
    else if(rest.length > 1){ S.years = [...new Set(rest)].sort(); heard.push(S.years.join(", ").replace(/, (\d+)$/, " and $1")); }
    else if(rest.length && y1){ S.years = [...new Set(rest.concat(y1 === y2 ? [y1] : []))].sort(); }
    if(take(/\b(compare|comparing|compared|comparison|vs|versus|against)\b/) && !S.years && y1 && y1 !== y2){ S.years = []; for(let y = y1; y <= y2; y++) S.years.push(y); }

    // years the figures don't cover
    const clampY = y => Math.max(Y0, Math.min(YN, y));
    const out = [y1, y2].concat(S.years || []).filter(y => y && (y < Y0 || y > YN));
    if(out.some(y => y < Y0)) notes.push("Records of small boat crossings began in " + Y0 + ", so the chart starts there.");
    if(out.some(y => y > YN)) notes.push("There are no figures after " + YN + " yet.");
    if(S.years){ S.years = [...new Set(S.years.map(clampY))]; if(S.years.length < 2){ y1 = y2 = S.years[0]; S.years = null; } }
    if(y1){ y1 = clampY(y1); y2 = clampY(y2); if(y2 < y1) [y1, y2] = [y2, y1]; }

    /* ---------------- what shape of chart */
    if(take(/\b(day of (the )?week|days of (the )?week|weekdays?|which day|what day|weekends?)\b/)){ S.shape = "pattern"; S.pattern = "dow"; heard.push("by day of the week"); }
    else if(take(/\b(time of (the )?year|months? of (the )?year|seasons?|seasonal|which month|what month|by season)\b/)){ S.shape = "pattern"; S.pattern = "month"; heard.push("by time of year"); }
    let m2;
    if(!S.shape && (m2 = take(/\b(running total|cumulative(ly)?|add(s|ed)? up|adding up|tally|build(s|ing)? up|by this (date|point|time)|on track|ahead|behind|pace)\b/))){ S.shape = "cum"; heard.push("running total"); }
    if(!S.shape && (m2 = take(/\b(?:the )?(top|busiest|biggest|highest|largest|most|record|records|worst|peak|heaviest|quietest|lowest|least|fewest|calmest|smallest) ?(\d+|[a-z]+)?\b/))){
      S.shape = "rank"; S.order = /quiet|low|least|few|calm|small/.test(m2[1]) ? "asc" : "desc";
      const n = m2[2] && num(m2[2]); if(n) S.n = Math.min(25, n); else if(m2[2] && !NUMW[m2[2]]) t = " " + m2[2] + " " + t;
    }

    // grouping: each day / week / month / quarter / year
    const GRP = [["day", /\b(daily|each day|per day|by day|a day|every day|day by day|days?)\b/], ["week", /\b(weekly|each week|per week|by week|a week|every week|week by week|weeks?)\b/],
      ["quarter", /\b(quarterly|each quarter|per quarter|by quarter|quarters?)\b/], ["month", /\b(monthly|each month|per month|by month|a month|every month|month by month|months?)\b/],
      ["year", /\b(yearly|annual(ly)?|each year|per year|by year|a year|every year|year by year|years?|year on year)\b/]];
    for(const [g, re] of GRP) if(take(re)){ S.group = g; heard.push(g === "day" ? "each day" : "each " + g); break; }
    if(take(/\b(over time|through time|trend|history|since then|change|changed|changing|growth|grown|rise|risen|fall|fallen)\b/) && !S.group && !S.shape) S.trend = true;

    /* ---------------- settle what's missing, with defaults chosen for a clear picture */
    if(y1){ S.from = S.from || y1 + "-01-01"; S.to = S.to || (y2 === YN ? last : y2 + "-12-31"); }
    const span = () => S.from ? (day(S.to) - day(S.from)) / 864e5 + 1 : Infinity;
    const allYears = !S.from && !S.years;
    if(!S.rangeLabel){
      if(S.years) S.rangeLabel = S.years.join(", ").replace(/, (\d+)$/, " and $1");
      else if(y1 && y1 === y2) S.rangeLabel = y1 === YN ? y1 + " so far" : String(y1);
      else if(y1 && (S.allTime || y1 === Y0) && y2 === YN) S.rangeLabel = "since records began in " + Y0;
      else if(y1 && y2 === YN) S.rangeLabel = "since " + y1;
      else if(y1) S.rangeLabel = y1 + " to " + y2;
    }

    if(S.topic === "crossings"){
      if(S.month && !S.shape){ S.shape = "series"; S.group = "year"; }
      if(S.years && !S.shape) S.shape = S.group === "year" ? "series" : "compare";
      if(S.years && S.shape === "series" && S.group === "year"){ S.from = S.years[0] + "-01-01"; S.to = S.years[S.years.length - 1] === YN ? last : S.years[S.years.length - 1] + "-12-31"; }
      if(S.shape === "compare" && !S.group) S.group = "date";   // a running total by the same date, the fairest comparison of whole and part years
      if(S.shape === "cum" && !S.years) S.years = y1 && y1 !== y2 ? range(y1, y2) : y1 ? [y1] : S.allTime ? range(Y0, YN) : [YN, YN - 1];
      if(S.shape === "cum") S.years.sort();
      if(S.shape === "rank"){ S.unit = S.group || "day"; S.n = S.n || (S.unit === "year" ? null : 10); if(allYears){ S.from = first; S.to = last; S.rangeLabel = "since records began in " + Y0; } }
      if(S.shape === "pattern" && allYears){ S.from = "2020-01-01"; S.to = last; S.rangeLabel = "since 2020"; notes.push("Patterns start in 2020: before then there were too few crossings for a fair average."); }
      if(!S.shape){
        S.shape = "series";
        if(allYears){ S.from = first; S.to = last; S.rangeLabel = "since records began in " + Y0; S.group = S.group || "year"; }
        if(!S.group){ const n = span(); S.group = n <= 62 ? "day" : n <= 190 ? "week" : n <= 366 * 3 + 1 ? "month" : "year"; }
      }
      if(S.shape === "series" && S.group === "day" && span() > 400){ notes.push("That’s a lot of days for one chart, so it’s shown week by week."); S.group = "week"; }
      if(S.form === "donut"){ S.form = null; notes.push("A ring shows parts of a whole, not change over time, so this is drawn as " + (S.shape === "cum" || S.shape === "compare" ? "lines" : "bars") + "."); }
    }
    if(S.topic === "nat"){
      if(S.country) S.shape = "natOne";
      else if((S.group === "year" || S.trend) && !S.shape) S.shape = "natTrend";
      else S.shape = "natShare";
      if(S.shape === "natShare" && S.order === "asc"){ notes.push("Showing the largest groups: the smallest are a few people each."); }
      S.n = S.n || 8;
    }
    if(S.topic === "who"){ S.shape = "share"; }
    if(S.topic === "deal" || S.topic === "asylum" || S.topic === "removed") S.shape = S.shape === "rank" ? "rank" : "series";
    if(S.form === "area" && !/series|cum|compare|natOne|natTrend/.test(S.shape)) S.form = null;

    // the words nobody understood
    S.unknown = t.trim().split(" ").filter(w => w && w.length > 1 && !STOP.has(w) && !/^\d+$/.test(w) && !DEMONYM[w] && !NUMW[w]);
    S.understood = heard.length > 0 || S.form != null;
    return S;
  }
  function range(a, b){ const o = []; for(let y = a; y <= b; y++) o.push(y); return o; }

  // the plain-English name of the chart a plan will draw
  function title(S){
    const M = {people:"People crossing", boats:"Boats", perboat:"People per boat"}[S.measure];
    const r = S.rangeLabel ? ", " + S.rangeLabel : "", per = g => g === "day" ? "each day" : "each " + g;
    switch(S.shape){
      case "series":
        if(S.topic === "deal") return "UK–France returns deal, each month";
        if(S.topic === "asylum") return (S.outcome ? "Asylum " + S.outcome : "Asylum decisions") + ", by year of arrival" + r;
        if(S.topic === "removed") return "Small boat arrivals returned, " + per(S.group === "year" ? "year" : "quarter") + r;
        if(S.month) return M + " in " + cap(MONTHS[S.month - 1]) + ", each year";
        return M + " " + per(S.group) + r;
      case "compare": return S.group === "date" ? M + ", running total: " + S.rangeLabel : M + " " + per(S.group) + ": " + S.rangeLabel;
      case "cum": return M + ", running total" + (S.years.length === 1 ? ", " + S.years[0] : S.years.length === 2 ? ": " + S.years[1] + " and " + S.years[0] : " by year");
      case "rank": return (S.order === "asc" ? "Quietest " : "Busiest ") + (S.n ? S.n + " " : "") + (S.unit === "day" ? "days" : S.unit + "s") + (S.measure === "people" ? "" : " for " + M.toLowerCase()) + r;
      case "pattern": return M + " by " + (S.pattern === "dow" ? "day of the week" : "time of year") + r;
      case "natOne": return "People from " + S.country + ", each year" + r;
      case "natTrend": return "Largest nationalities, each year";
      case "natShare": return "Nationalities" + r;
      case "share": return "Sex and age";
    }
    return M;
  }

  // examples to offer, all ones the parser handles
  const EXAMPLES = ["Boats each month in 2022", "Top nationalities since 2018", "Busiest days ever", "This year vs last", "People per boat each year",
    "Which day of the week is busiest", "Afghans each year", "People each week, last 6 months", "Compare 2022 and 2024 by month", "Asylum granted by year"];

  const api = {parse, title, EXAMPLES};
  if(typeof module === "object" && module.exports) module.exports = api; else root.ccAsk = api;
})(typeof window !== "undefined" ? window : this);
