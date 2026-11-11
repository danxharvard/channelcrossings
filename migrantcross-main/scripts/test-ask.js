// Checks Studio's "Ask for a chart" (studio-ask.js) reads typical requests the right way: node scripts/test-ask.js
const assert = require("assert"), ask = require("../studio-ask.js");
const ctx = {first:"2018-01-01", last:"2026-10-15", countries:["Afghanistan", "Albania", "Eritrea", "Iran", "Iraq", "Sudan", "Syria", "Vietnam", "Somalia", "Egypt"]};
const cases = [
  ["boats per month in 2022", {measure:"boats", shape:"series", group:"month", from:"2022-01-01", to:"2022-12-31"}],
  ["top nationalities since 2018", {topic:"nat", shape:"natShare", from:"2018-01-01", to:"2026-10-15"}],
  ["busiest days ever", {shape:"rank", unit:"day", order:"desc", n:10}],
  ["this year vs last", {shape:"compare", group:"date", years:[2025, 2026]}],
  ["people per boat each year", {measure:"perboat", shape:"series", group:"year"}],
  ["which day of the week is busiest", {shape:"pattern", pattern:"dow"}],
  ["Afghans each year", {topic:"nat", shape:"natOne", country:"Afghanistan"}],
  ["people each week, last 6 months", {shape:"series", group:"week", to:"2026-10-15"}],
  ["compare 2022 and 2024 by month", {shape:"compare", group:"month", years:[2022, 2024]}],
  ["asylum granted by year", {topic:"asylum", outcome:"granted", shape:"series"}],
  ["asylum granted and refused", {topic:"asylum", outcome:null}],
  ["how many people crossed in August 2022", {shape:"series", group:"day", from:"2022-08-01", to:"2022-08-31"}],
  ["crossings from 2019 to 2021", {shape:"series", group:"month", from:"2019-01-01", to:"2021-12-31"}],
  ["running total this year", {shape:"cum", years:[2026]}],
  ["quietest months", {shape:"rank", unit:"month", order:"asc"}],
  ["top 5 weeks in 2024", {shape:"rank", unit:"week", n:5, from:"2024-01-01"}],
  ["boats in august", {shape:"series", group:"year", month:8}],
  ["women and children", {topic:"who", shape:"share"}],
  ["one in one out", {topic:"deal"}],
  ["people removed each year", {topic:"removed", group:"year"}],
  ["daily crossings last 30 days", {shape:"series", group:"day", from:"2026-09-16"}],
  ["boats pie chart 2023", {measure:"boats", form:null, from:"2023-01-01"}],
  ["line graph of people since records began", {form:"line", shape:"series", group:"year", from:"2018-01-01"}],
  ["how full are the boats", {measure:"perboat"}],
  ["crossings in 2015", {from:"2018-01-01", to:"2018-12-31"}],
  ["where do most people come from", {topic:"nat"}],
  ["Iranians since 2020", {topic:"nat", country:"Iran"}],
  ["small boats per month", {measure:"boats", group:"month"}],
  ["people on small boats each month this year", {measure:"people", group:"month", from:"2026-01-01"}],
  ["between 2020 and 2023 by year", {group:"year", from:"2020-01-01", to:"2023-12-31"}],
  ["seasonal pattern", {shape:"pattern", pattern:"month"}],
];
let bad = 0;
for(const [q, want] of cases){
  const s = ask.parse(q, ctx);
  const got = {}; for(const k in want) got[k] = s[k];
  try{ assert.deepStrictEqual(got, want); console.log("ok  ", q.padEnd(44), "→", ask.title(s), s.notes.length ? "| " + s.notes.join(" ") : "", s.unknown.length ? "| ?" + s.unknown : ""); }
  catch(e){ bad++; console.log("FAIL", q, "\n     want", JSON.stringify(want), "\n     got ", JSON.stringify(got), "\n     ", ask.title(s), s.unknown); }
}
// nonsense says what it didn't catch
const z = ask.parse("purple elephants", ctx); assert.deepStrictEqual(z.unknown, ["purple", "elephants"]); assert.strictEqual(z.understood, false);
if(bad){ console.log(bad + " failed"); process.exit(1); } else console.log("all " + cases.length + " passed");
