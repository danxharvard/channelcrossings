/* Builds towns.json: the extra town and city names for the homepage map, on top of the
   hand-picked list (TOWNS in index.html), so more names appear as you zoom in.

   Run by hand when the list needs changing; nothing runs it automatically:
     npm install --no-save all-the-cities@3.1.0 && node scripts/build-towns.js

   Source: GeoNames (CC BY 4.0) via the all-the-cities package, places of 1,000+ people.
   Output rows are [name, lat, lon, rank]. Rank 1 is a big city, shown at every zoom;
   rank 5 is a village, shown only when zoomed right in (placeTowns in index.html). */
const fs = require("fs"), path = require("path");
const cities = require("all-the-cities");
const root = path.join(__dirname, "..");

// The map can show 48.2 to 52.8 N and 2.8 W to 5.8 E (WIDE in index.html)
const inWide = (la, lo) => la >= 48.2 && la <= 52.8 && lo >= -2.8 && lo <= 5.8;
// Around the Dover Strait every village of 1,000+ counts; elsewhere 4,000+
const inStrait = (la, lo) => la >= 50.35 && la <= 51.45 && lo >= 0.6 && lo <= 2.7;
const KINDS = new Set(["PPL", "PPLA", "PPLA2", "PPLA3", "PPLA4", "PPLC", "PPLG", "PPLS"]);   // no districts (PPLX) or localities (PPLL)
const ENGLISH = {Antwerpen:"Antwerp", Gent:"Ghent", Brugge:"Bruges", Oostende:"Ostend", Dunkerque:"Dunkirk", Ieper:"Ypres", "Almere Stad":"Almere"};
const km = (a, b) => Math.hypot((a.la - b.la) * 111.2, (a.lo - b.lo) * 111.2 * Math.cos(a.la * Math.PI / 180));

// The hand-picked names already in the page
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const own = [...html.match(/const TOWNS = \[([\s\S]*?)\]\];/)[1].matchAll(/\["([^"]+)", ([\d.-]+), ([\d.-]+)/g)].map(m => ({name:m[1], la:+m[2], lo:+m[3]}));

let list = cities.filter(c => {
  const [lo, la] = c.loc.coordinates;
  return KINDS.has(c.featureCode) && inWide(la, lo) && c.population >= (inStrait(la, lo) ? 1000 : 4000) && !/^City of /.test(c.name);
}).map(c => ({name:ENGLISH[c.name] || c.name, la:c.loc.coordinates[1], lo:c.loc.coordinates[0], pop:c.population}))
  .sort((a, b) => b.pop - a.pop);

// Leave out anything the page already names, and repeats of the same place
const kept = [];
for(const c of list){
  if(own.some(o => o.name === c.name || km(o, c) < 1.5) || kept.some(k => k.name === c.name && km(k, c) < 15 || km(k, c) < 1)) continue;
  kept.push(c);
}
list = kept;

const rankOf = p => p >= 250000 ? 1 : p >= 70000 ? 2 : p >= 25000 ? 3 : p >= 9000 ? 4 : 5;
const near = (c, o) => km({la:c.loc.coordinates[1], lo:c.loc.coordinates[0]}, o) < 5;
const bigs = list.concat(own.map(o => ({...o, pop:Math.max(0, ...cities.filter(c => (ENGLISH[c.name] || c.name) === o.name && near(c, o)).map(c => c.population))})));
const rows = list.map(c => {
  let r = rankOf(c.pop);
  // a suburb of a much bigger city (Croydon, Saint-Denis, Schaerbeek) waits until you zoom in
  if(bigs.some(b => b.pop >= 3 * c.pop && km(b, c) < 3 + 9 * Math.sqrt(b.pop / 1e6))) r = Math.min(5, r + 2);
  return [c.name, +c.la.toFixed(3), +c.lo.toFixed(3), r];
});
rows.sort((a, b) => a[3] - b[3]);   // biggest first, so they win the space on the map

fs.writeFileSync(path.join(root, "towns.json"), "[\n" + rows.map(r => JSON.stringify(r)).join(",\n") + "\n]\n");
console.log(rows.length + " towns written; by rank:", [1, 2, 3, 4, 5].map(k => rows.filter(r => r[3] === k).length).join(" / "));
