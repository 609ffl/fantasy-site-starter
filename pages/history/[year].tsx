// pages/history/[year].tsx
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Link from "next/link";

type OwnerSeason = {
  year: number;
  owner: string;
  team_name: string;
  total_points: number;
  players: Array<{
    player: string;
    nfl_team: string;
    position: string;
    fantasy_points: number;
  }>;
};

// Helper to render a player link safely (handles spaces, apostrophes, etc)
function PlayerLink({ name }: { name: string }) {
  return (
    <Link href={`/players/${encodeURIComponent(name)}`}>{name}</Link>
  );
}

export default function YearPage() {
  const router = useRouter();
  const yearParam = router.query.year;
  const year =
    typeof yearParam === "string" ? Number(yearParam) : Array.isArray(yearParam) ? Number(yearParam[0]) : NaN;

  const [rows, setRows] = useState<OwnerSeason[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!router.isReady || !year) return;
    (async () => {
      const data = await fetch(`/api/history?year=${year}`).then((r) => r.json());
      setRows(data.seasons || []);
      setLoading(false);
    })();
  }, [router.isReady, year]);

  return (
    <main
      style={{
        maxWidth: 1100,
        margin: "40px auto",
        padding: 16,
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
      }}
    >
      <h1 style={{ marginBottom: 8 }}>Season {year}</h1>
      <p style={{ marginTop: 0 }}>
        <Link href="/history">← Back to History</Link>
      </p>

      {loading && <p>Loading…</p>}

      {!loading && (
        <div style={{ display: "grid", gap: 16 }}>
          {rows.map((s, i) => (
            <div key={`${s.owner}-${s.year}`} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <div>
                  <strong>#{i + 1}</strong>{" "}
                  <Link href={`/owners/${encodeURIComponent(s.owner)}`}>{s.owner}</Link>{" "}
                  <span style={{ color: "#666" }}>— {s.team_name}</span>
                </div>
                <div style={{ fontWeight: 700 }}>{s.total_points.toFixed(2)}</div>
              </div>

              <div style={{ fontWeight: 600, margin: "6px 0" }}>Top Players</div>

              {s.players.slice(0, 10).map((p, idx) => (
                <div
                  key={idx}
                  style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}
                >
                  {/* LEFT: position — PlayerName (team)  with PlayerName as a Link */}
                  <span>
                    {p.position.toLowerCase()} — <PlayerLink name={p.player} />
                    {p.nfl_team ? ` (${p.nfl_team})` : ""}
                  </span>

                  {/* RIGHT: points */}
                  <span>{Number(p.fantasy_points).toFixed(2)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
