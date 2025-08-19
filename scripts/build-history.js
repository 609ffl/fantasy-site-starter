// scripts/build-history.js
const fs = require("fs");
const path = require("path");
const Papa = require("papaparse");

const dataDir = path.join(process.cwd(), "data");
const csvPath = path.join(dataDir, "history.csv");
const outPath = path.join(dataDir, "player_year_owner_points.json");

if (!fs.existsSync(csvPath)) {
  console.error(`Missing ${csvPath}. Put history.csv in /data first.`);
  process.exit(1);
}
const csv = fs.readFileSync(csvPath, "utf-8");
const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });

/** @typedef {{player:string, year:number, owner:string, fantasy_points:number}} Row */
const raw = parsed.data.map(r => ({
  player: String(r.player ?? "").trim(),
  year: Number(r.year),
  owner: String(r.owner ?? "").trim(),
  fantasy_points: Number(r.fantasy_points),
})).filter(r =>
  r.player && Number.isFinite(r.year) && r.owner && Number.isFinite(r.fantasy_points)
);

// group by (player,year,owner)
const key = r => `${r.player.toLowerCase()}|${r.year}|${r.owner.toLowerCase()}`;
const map = new Map();
for (const r of raw) {
  const k = key(r);
  if (!map.has(k)) map.set(k, { ...r });
  else map.get(k).fantasy_points += r.fantasy_points;
}
const rows = Array.from(map.values());

// write pretty JSON
fs.writeFileSync(outPath, JSON.stringify(rows, null, 2));
console.log(`Wrote ${rows.length} rows → ${outPath}`);
