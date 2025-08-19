// lib/loadOwnerStandings.ts
import fs from "fs";
import path from "path";
import Papa from "papaparse";

export type OwnerStanding = {
  year: number;
  owner: string;
  record: string;
  finish?: string;   // <-- plain text from Column D
  ppg: number;
  seed?: number;
};

function toNum(v: any): number {
  if (typeof v === "number") return v;
  if (v == null) return NaN;
  const m = String(v).match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : NaN;
}

export function loadOwnerStandings(): OwnerStanding[] {
  const csvPath = path.join(process.cwd(), "data", "owner_year_standings.csv");
  const raw = fs.readFileSync(csvPath, "utf-8");
  const parsed = Papa.parse(raw, { header: true, skipEmptyLines: true });

  // Column-D fallback (0-based index 3)
  const fields: string[] = (parsed.meta as any).fields || [];
  const colDKey = fields[3];

  const rows = (parsed.data as any[]).map((r) => {
    // Try common header variants; otherwise grab whatever is actually in column D
    const finishRaw =
      r["Finish"] ??
      r["finish"] ??
      r["How they finished"] ??
      r["How They Finished"] ??
      (colDKey ? r[colDKey] : undefined);

    return {
      year: toNum(r["Year"] ?? r["year"] ?? r["Season"]),
      owner: String(r["Owner"] ?? r["owner"] ?? r["Manager"] ?? "").trim(),
      record: String(r["Record"] ?? r["record"] ?? "").trim(),
      finish: finishRaw != null ? String(finishRaw).trim() : undefined, // <-- text only
      ppg: toNum(r["PPG"] ?? r["ppg"] ?? r["Points Per Game"]),
      seed: (() => {
        const n = toNum(r["Seed"] ?? r["seed"] ?? r["Playoff Seed"]);
        return Number.isFinite(n) ? n : undefined;
      })(),
    } as OwnerStanding;
  });

  return rows
    .filter((x) => x.owner && Number.isFinite(x.year))
    .sort((a, b) => a.year - b.year);
}
