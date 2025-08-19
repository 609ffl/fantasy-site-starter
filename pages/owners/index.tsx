// pages/owners/index.tsx
// @ts-nocheck
import Link from "next/link";
import { useMemo, useState } from "react";
import { loadPlayerHistory } from "../../lib/loadHistory";

type OwnerRow = { name: string; seasons: number; totalPoints: number };

export default function OwnersIndex({ owners }: { owners: OwnerRow[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return owners;
    return owners.filter((o) => o.name.toLowerCase().includes(n));
  }, [q, owners]);

  return (
    <main style={{ maxWidth: 900, margin: "32px auto", padding: 16 }}>
      <Link href="/history">← Back to History</Link>
      <h1 style={{ margin: "12px 0 8px" }}>Owners</h1>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search owners…"
        style={{ width: "100%", padding: 8, margin: "12px 0", border: "1px solid #ddd", borderRadius: 6 }}
      />

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #ddd" }}>
            <th style={{ textAlign: "left", padding: "8px 6px" }}>Owner</th>
            <th style={{ textAlign: "right", padding: "8px 6px" }}>Seasons</th>
            <th style={{ textAlign: "right", padding: "8px 6px" }}>Total Points</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((o) => (
            <tr key={o.name} style={{ borderBottom: "1px solid #f3f3f3" }}>
              <td style={{ padding: "8px 6px" }}>
                <Link href={`/owners/${encodeURIComponent(o.name)}`}>{o.name}</Link>
              </td>
              <td style={{ padding: "8px 6px", textAlign: "right" }}>{o.seasons}</td>
              <td style={{ padding: "8px 6px", textAlign: "right" }}>{o.totalPoints.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {!filtered.length && <p style={{ marginTop: 16, color: "#666" }}>No owners match your search.</p>}
    </main>
  );
}

// Server-side: derive owners from your data (JSON or CSV via loadPlayerHistory)
export async function getServerSideProps() {
  const rows = loadPlayerHistory(); // uses data/player_year_owner_points.json OR data/history.csv
  const map = new Map<string, { seasons: Set<number>; points: number }>();

  for (const r of rows) {
    if (!map.has(r.owner)) map.set(r.owner, { seasons: new Set<number>(), points: 0 });
    const entry = map.get(r.owner)!;
    entry.seasons.add(r.year);
    entry.points += Number(r.fantasy_points || 0);
  }

  const owners: OwnerRow[] = Array.from(map.entries())
    .map(([name, v]) => ({ name, seasons: v.seasons.size, totalPoints: v.points }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { props: { owners } };
}
