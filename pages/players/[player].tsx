// pages/players/[player].tsx
// @ts-nocheck
import Link from "next/link";
import { ownerSlug } from "../../lib/slug"; // browser-safe
import { loadPlayerHistory } from "../../lib/loadHistory";

// tolerant name normalization (handles "C.J.", "Jr.", stray team fragments like "Jay Cutler Ch")
function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\./g, "")
    .replace(/['_-]/g, "")
    .replace(/\s+(jr|sr|ii|iii|iv)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
function trimTrailingTeamFragment(s: string) {
  const m = s.match(/^(.*?)(?:\s+[A-Za-z]{1,3})$/);
  if (!m) return s;
  const parts = s.trim().split(/\s+/);
  if (parts.length >= 2 && parts[parts.length - 1].length <= 3) return m[1];
  return s;
}

type Row = { player: string; year: number; owner: string; fantasy_points: number };

export default function PlayerPage({
  player,
  rows,
  suggestions,
}: {
  player: string;
  rows: Row[];
  suggestions: string[];
}) {
  // group rows by year
  const byYear: Record<number, Row[]> = {};
  rows.forEach((r) => {
    if (!byYear[r.year]) byYear[r.year] = [];
    byYear[r.year].push(r);
  });
  const years = Object.keys(byYear)
    .map((y) => Number(y))
    .sort((a, b) => a - b);

  return (
    <div style={{ maxWidth: 900, margin: "32px auto", padding: "0 16px" }}>
      <Link href="/history">← Back to History</Link>
      <h1 style={{ marginTop: 12 }}>{player}</h1>
      <p>Owners and points by season</p>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #ddd" }}>
            <th style={{ textAlign: "left", padding: "8px 6px" }}>Season</th>
            <th style={{ textAlign: "left", padding: "8px 6px" }}>Owner</th>
            <th style={{ textAlign: "right", padding: "8px 6px" }}>Points</th>
          </tr>
        </thead>
        <tbody>
          {years.flatMap((y) => {
            const seasonRows = byYear[y].sort((a, b) => b.fantasy_points - a.fantasy_points);
            return seasonRows.map((r, i) => (
              <tr key={`${y}-${r.owner}-${i}`} style={{ borderBottom: "1px solid #f1f1f1" }}>
                <td style={{ padding: "8px 6px" }}>{i === 0 ? y : ""}</td>
                <td style={{ padding: "8px 6px" }}>
                  <Link href={`/owners/${ownerSlug(r.owner)}`}>{r.owner}</Link>
                </td>
                <td style={{ padding: "8px 6px", textAlign: "right" }}>
                  {Number(r.fantasy_points ?? 0).toFixed(2)}
                </td>
              </tr>
            ));
          })}
        </tbody>
      </table>

      {!rows.length && (
        <div style={{ marginTop: 16, color: "#444" }}>
          <p>No rows found for this player.</p>
          {suggestions?.length > 0 && (
            <>
              <p>Did you mean:</p>
              <ul>
                {suggestions.map((s) => (
                  <li key={s}>
                    <Link href={`/players/${encodeURIComponent(s)}`}>{s}</Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Server-side render so /players/<any name> works with no API route
export async function getServerSideProps(ctx: any) {
  const param = ctx.params?.player || "";
  const qRaw = decodeURIComponent(Array.isArray(param) ? param[0] : param);
  const qMain = trimTrailingTeamFragment(qRaw);
  const qNorm = normalize(qMain);

  const all = loadPlayerHistory(); // reads data/player_year_owner_points.json OR data/history.csv
  const withNorm = all.map((r) => ({
    ...r,
    _norm: normalize(trimTrailingTeamFragment(r.player || "")),
  }));

  // exact normalized match
  let hits = withNorm.filter((r) => r._norm === qNorm);

  // contains match
  if (hits.length === 0) {
    hits = withNorm.filter((r) => r._norm.includes(qNorm) || qNorm.includes(r._norm));
  }

  // token overlap
  if (hits.length === 0) {
    const qtoks = qNorm.split(" ").filter(Boolean);
    hits = withNorm.filter((r) => {
      const rtoks = r._norm.split(" ").filter(Boolean);
      const overlap = rtoks.filter((t) => qtoks.includes(t)).length;
      return overlap >= Math.min(2, qtoks.length);
    });
  }

  hits.sort((a, b) => a.year - b.year || a.owner.localeCompare(b.owner));
  const rows = hits.map(({ player, year, owner, fantasy_points }) => ({
    player,
    year,
    owner,
    fantasy_points,
  }));

  let suggestions: string[] = [];
  if (rows.length === 0) {
    suggestions = Array.from(
      new Set(
        withNorm
          .filter((r) => r._norm.includes(qNorm.split(" ")[0] || ""))
          .map((r) => r.player)
      )
    )
      .sort((a, b) => a.localeCompare(b))
      .slice(0, 10);
  }

  return { props: { player: qMain, rows, suggestions } };
}
