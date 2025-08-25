import { useEffect, useState } from "react";

type Game = {
  id: number;
  homeTeamId: number | null;
  homePoints: number;
  awayTeamId: number | null;
  awayPoints: number;
  periodId: number | null;
};

type Team = { id: number; name: string; abbrev?: string };

export default function Home() {
  const [games, setGames] = useState<Game[]>([]);
  const [teams, setTeams] = useState<Record<number, Team>>({});
  const [week, setWeek] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const [gRes, tRes] = await Promise.all([
          fetch(`/api/scoreboard?summary=1&week=${week}`).then((r) => r.json()),
          fetch(`/api/league`).then((r) => r.json()),
        ]);
        const map: Record<number, Team> = {};
        (tRes.teams || []).forEach((t: Team) => {
          map[t.id] = t;
        });
        setTeams(map);
        setGames(gRes.games || []);
      } catch (e: any) {
        setErr(e?.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [week]);

  const name = (id: number | null) =>
    id && teams[id] ? teams[id].name : id ? `Team ${id}` : "—";

  return (
    <>
    
    
    
      <main
        style={{
          maxWidth: 960,
          margin: "40px auto",
          padding: 16,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <h1 style={{ marginBottom: 8 }}>Live Scoreboard</h1>

        <label
          style={{
            display: "inline-flex",
            gap: 8,
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <span>Week:</span>
          <select value={week} onChange={(e) => setWeek(Number(e.target.value))}>
            {Array.from({ length: 18 }, (_, i) => i + 1).map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </label>

        {loading && <p>Loading…</p>}
        {err && (
          <pre
            style={{
              background: "#fee",
              padding: 12,
              border: "1px solid #f99",
              whiteSpace: "pre-wrap",
            }}
          >
            {err}
          </pre>
        )}
        {!loading && !err && games.length === 0 && (
          <p>No games for week {week}.</p>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 12,
          }}
        >
          {games.map((m) => (
            <div
              key={m.id}
              style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div>{name(m.homeTeamId)}</div>
                <div style={{ fontWeight: 700 }}>{m.homePoints.toFixed(2)}</div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div>{name(m.awayTeamId)}</div>
                <div style={{ fontWeight: 700 }}>{m.awayPoints.toFixed(2)}</div>
              </div>
              <div style={{ color: "#666", fontSize: 12, marginTop: 6 }}>
                Matchup Period: {m.periodId ?? "—"}
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
