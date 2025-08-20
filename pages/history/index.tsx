// pages/history/index.tsx
import { useEffect, useState } from "react";
import Link from "next/link";

type Career = {
  owner: string;
  seasons?: number;
  total_points: number;
  pf_per_game?: number;
  first_year?: number;
  last_year?: number;
};

type OwnerSeason = {
  year: number;
  owner: string;
  team_name: string;
  total_points: number; // from career_pf.csv
};

export default function HistoryIndex() {
  const [career, setCareer] = useState<Career[]>([]);
  const [topSeasons, setTopSeasons] = useState<OwnerSeason[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [summary, topSeasonsResp] = await Promise.all([
          fetch("/api/history?summary=1").then((r) => r.json()),
          fetch("/api/top-team-seasons").then((r) => r.json()),
        ]);

        setCareer(Array.isArray(summary.career) ? summary.career : []);
        setYears(Array.isArray(summary.years) ? summary.years : []);

        const ts = Array.isArray(topSeasonsResp.topTeamSeasons)
          ? (topSeasonsResp.topTeamSeasons as OwnerSeason[])
          : [];
        setTopSeasons(ts);
      } catch (e: any) {
        setErr(e?.message || "Failed to load history");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const fmt2 = (n: unknown) =>
    typeof n === "number" && Number.isFinite(n) ? n.toFixed(2) : "—";

  return (
    <main
      style={{
        maxWidth: 1100,
        margin: "40px auto",
        padding: 16,
        fontFamily:
          "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
      }}
    >
      <h1 style={{ marginBottom: 8 }}>League History</h1>
      <p style={{ marginTop: 0, color: "#666" }}>
        Based on your roster CSV (2012–2024).
      </p>

      {loading && <p>Loading…</p>}
      {err && <p style={{ color: "#b00" }}>{err}</p>}

      {!loading && !err && (
        <>
          {/* Career leaderboard */}
          <section style={{ margin: "24px 0" }}>
            <h2>Career Points (All-Time)</h2>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr
                    style={{
                      textAlign: "left",
                      borderBottom: "1px solid #ddd",
                    }}
                  >
                    <th style={{ padding: 8 }}>#</th>
                    <th style={{ padding: 8 }}>Owner</th>
                    <th style={{ padding: 8 }}>Seasons</th>
                    <th style={{ padding: 8 }}>Total</th>
                    <th style={{ padding: 8 }}>PF/G</th>
                    <th style={{ padding: 8 }}>Years</th>
                  </tr>
                </thead>
                <tbody>
                  {career.map((c, i) => (
                    <tr
                      key={c.owner}
                      style={{ borderBottom: "1px solid #eee" }}
                    >
                      <td style={{ padding: 8 }}>{i + 1}</td>
                      <td style={{ padding: 8 }}>
                        <Link
                          href={{
                            pathname: "/owners/[owner]",
                            query: { owner: c.owner },
                          }}
                        >
                          {c.owner}
                        </Link>
                      </td>
                      <td style={{ padding: 8 }}>{c.seasons ?? "—"}</td>
                      <td style={{ padding: 8, fontWeight: 700 }}>
                        {fmt2(c.total_points)}
                      </td>
                      <td style={{ padding: 8 }}>{fmt2(c.pf_per_game)}</td>
                      <td style={{ padding: 8 }}>
                        {c.first_year && c.last_year
                          ? `${c.first_year}–${c.last_year}`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Best single seasons */}
          <section style={{ margin: "24px 0" }}>
            <h2>Top Team Seasons (by total points)</h2>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr
                    style={{
                      textAlign: "left",
                      borderBottom: "1px solid #ddd",
                    }}
                  >
                    <th style={{ padding: 8 }}>#</th>
                    <th style={{ padding: 8 }}>Year</th>
                    <th style={{ padding: 8 }}>Owner</th>
                    <th style={{ padding: 8 }}>Team Name</th>
                    <th style={{ padding: 8, textAlign: "right" }}>
                      Total Points
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {topSeasons.map((s, i) => (
                    <tr
                      key={`${s.owner}-${s.year}-${i}`}
                      style={{ borderBottom: "1px solid #eee" }}
                    >
                      <td style={{ padding: 8 }}>{i + 1}</td>
                      <td style={{ padding: 8 }}>
                        <Link href={`/history/${s.year}`}>{s.year}</Link>
                      </td>
                      <td style={{ padding: 8 }}>
                        <Link
                          href={{
                            pathname: "/owners/[owner]",
                            query: { owner: s.owner },
                          }}
                        >
                          {s.owner}
                        </Link>
                      </td>
                      <td style={{ padding: 8 }}>{s.team_name}</td>
                      <td style={{ padding: 8, textAlign: "right", fontWeight: 700 }}>
                        {fmt2(s.total_points)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Quick jump by year */}
          <section style={{ margin: "24px 0" }}>
            <h2>Seasons</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {years.map((y) => (
                <Link
                  key={y}
                  href={`/history/${y}`}
                  style={{
                    padding: "6px 10px",
                    border: "1px solid #ccc",
                    borderRadius: 8,
                  }}
                >
                  {y}
                </Link>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
