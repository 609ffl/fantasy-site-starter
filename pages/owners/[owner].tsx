// pages/owners/[owner].tsx
// @ts-nocheck
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";

type RosterSeason = {
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

type PivotYear = { year: number; points: number };

// ---- Chart (client-only) ----------------------------------------------------
type StandingRow = {
  year: number;
  owner: string;
  record: string;
  finish: string | number;
  ppg: number;
  seed: number;
};

// define inner component that uses recharts only on client
function OwnerPerfChartInner({ data }: { data: StandingRow[] }) {
  // import here so SSR never evaluates recharts
  const {
    ResponsiveContainer,
    ComposedChart,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    Line,
    Bar,
  } = require("recharts");

  const safe = (data || []).map((r: StandingRow) => ({
    ...r,
    ppg: Number(r.ppg),
    seed: Number(r.seed),
  }));

  return (
    <div style={{ width: "100%", height: 340, border: "1px solid #eee", borderRadius: 8, padding: 8 }}>
      {safe.length ? (
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={safe} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="year" />
            {/* Left axis = PPG */}
            <YAxis
              yAxisId="left"
              label={{ value: "PPG", angle: -90, position: "insideLeft" }}
            />
            {/* Right axis = Seed (1 is best) — reversed so 1 is at the top */}
            <YAxis
              yAxisId="right"
              orientation="right"
              reversed
              allowDecimals={false}
              label={{ value: "Seed (1=best)", angle: 90, position: "insideRight" }}
            />
            <Tooltip
              content={({ active, payload, label }: any) => {
                if (!active || !payload || !payload.length) return null;
                const r = payload[0].payload;
                return (
                  <div style={{ background: "#fff", border: "1px solid #ddd", padding: 8, borderRadius: 6 }}>
                    <div><strong>Season {label}</strong></div>
                    <div>Record: {r.record}</div>
                    <div>Finish: {r.finish}</div>
                    <div>PPG: {Number(r.ppg).toFixed(2)}</div>
                    <div>Seed: {r.seed}</div>
                  </div>
                );
              }}
            />
            <Legend />
            <Line
  yAxisId="left"
  type="monotone"
  dataKey="ppg"
  name="PPG"
  strokeWidth={2}
  dot={(props: any) => {
    const { cx, cy, payload } = props;
    const isChamp = String(payload.finish || "").toLowerCase().includes("champ");
    return (
      <circle
        cx={cx}
        cy={cy}
        r={isChamp ? 5 : 3}
        stroke="currentColor"
        fill={isChamp ? "currentColor" : "white"}
      />
    );
  }}
/>

            <Bar
              yAxisId="right"
              dataKey="seed"
              name="Playoff Seed"
              opacity={0.6}
            />
          </ComposedChart>
        </ResponsiveContainer>
      ) : (
        <p style={{ color: "#666", margin: 8 }}>No chart data found for this owner.</p>
      )}
    </div>
  );
}

const OwnerPerfChart = dynamic(() => Promise.resolve(OwnerPerfChartInner), { ssr: false });

// -----------------------------------------------------------------------------

export default function OwnerPage() {
  const router = useRouter();
  const owner = typeof router.query.owner === "string" ? router.query.owner : "";

  const [rosterSeasons, setRosterSeasons] = useState<RosterSeason[]>([]);
  const [pivot, setPivot] = useState<{
    owner: string;
    yearly: PivotYear[];
    total: number | null;
    games: number | null;
    pfg: number | null;
    span: string | null;
  } | null>(null);

  // chart state
  const [standings, setStandings] = useState<StandingRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!owner) return;
    (async () => {
      try {
        // roster + pivot
        const roster = await fetch(`/api/history?owner=${encodeURIComponent(owner)}`).then((r) => r.json());
        setRosterSeasons(Array.isArray(roster.seasons) ? roster.seasons : []);

        const piv = await fetch(`/api/history?ownerPivot=${encodeURIComponent(owner)}`).then((r) => r.json());
        if (!piv.error) setPivot(piv);

        // standings for chart
        const rows = await fetch(`/api/owners/${encodeURIComponent(owner)}/standings`).then((r) => r.json());
        setStandings(Array.isArray(rows) ? rows : []);
      } catch (e: any) {
        setErr(e?.message || "Failed to load owner history");
      } finally {
        setLoading(false);
      }
    })();
  }, [owner]);

  const fmt2 = (n: unknown) =>
    typeof n === "number" && Number.isFinite(n) ? n.toFixed(2) : "—";

  const totalRoster = useMemo(
    () => rosterSeasons.reduce((s, r) => s + r.total_points, 0),
    [rosterSeasons]
  );

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
      <h1 style={{ marginBottom: 8 }}>{owner || "Owner"}</h1>
      <p style={{ marginTop: 0 }}>
        <Link href="/history">← Back to History</Link>
      </p>

      {loading && <p>Loading…</p>}
      {err && <p style={{ color: "#b00" }}>{err}</p>}

      {!loading && !err && (
        <>
          {/* Pivot summary */}
          <section style={{ margin: "12px 0 20px" }}>
            <div
              style={{
                display: "flex",
                gap: 12,
                alignItems: "baseline",
                flexWrap: "wrap",
              }}
            >
              <div>
                Total (pivot): <strong>{fmt2(pivot?.total ?? null)}</strong>
              </div>
              <div>
                Games: <strong>{pivot?.games ?? "—"}</strong>
              </div>
              <div>
                PF/G: <strong>{fmt2(pivot?.pfg ?? null)}</strong>
              </div>
              <div>
                Span: <strong>{pivot?.span ?? "—"}</strong>
              </div>
              <div style={{ color: "#666" }}>
                Roster total (calc): <strong>{fmt2(totalRoster)}</strong>
              </div>
            </div>
          </section>

          {/* NEW: Performance chart */}
          <section style={{ margin: "16px 0 28px" }}>
            <h2>Performance by Year</h2>
            <OwnerPerfChart data={standings} />
          </section>

          {/* Pivot yearly table */}
          <section style={{ margin: "16px 0 28px" }}>
            <h2>Season Totals (career sheet)</h2>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr
                    style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}
                  >
                    <th style={{ padding: 8 }}>Year</th>
                    <th style={{ padding: 8 }}>Points</th>
                  </tr>
                </thead>
                <tbody>
                  {(pivot?.yearly ?? []).map((row) => (
                    <tr key={row.year} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: 8 }}>
                        <Link href={`/history/${row.year}`}>{row.year}</Link>
                      </td>
                      <td style={{ padding: 8, fontWeight: 700 }}>
                        {fmt2(row.points)}
                      </td>
                    </tr>
                  ))}
                  {(!pivot || (pivot.yearly ?? []).length === 0) && (
                    <tr>
                      <td style={{ padding: 8 }} colSpan={2}>
                        No seasons found in career sheet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Roster detail (players) */}
          <section style={{ margin: "16px 0" }}>
            <h2>Top Players by Season</h2>
            <div style={{ display: "grid", gap: 16 }}>
              {rosterSeasons.map((s) => (
                <div
                  key={s.year}
                  style={{
                    border: "1px solid #ddd",
                    borderRadius: 12,
                    padding: 12,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 6,
                    }}
                  >
                    <div>
                      <Link href={`/history/${s.year}`}>
                        <strong>{s.year}</strong>
                      </Link>{" "}
                      <span style={{ color: "#666" }}>— {s.team_name}</span>
                    </div>
                    <div style={{ fontWeight: 700 }}>
                      {fmt2(s.total_points)}
                    </div>
                  </div>

                  <div style={{ fontWeight: 600, margin: "6px 0" }}>
                    Top Players
                  </div>
                  {s.players.slice(0, 10).map((p, idx) => {
                    const label = `${(p.position || "").toUpperCase()} — ${p.player}`;
                    return (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          padding: "2px 0",
                        }}
                      >
                        <span>
                          {p.player ? (
                            <Link
                              href={`/players/${encodeURIComponent(p.player)}`}
                              title="View this player's full league history"
                              style={{ textDecoration: "underline", cursor: "pointer" }}
                            >
                              {label}
                            </Link>
                          ) : (
                            label
                          )}{" "}
                          {p.nfl_team ? `(${p.nfl_team})` : ""}
                        </span>
                        <span>{fmt2(p.fantasy_points)}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
              {rosterSeasons.length === 0 && (
                <div style={{ color: "#666" }}>
                  No roster detail available for this owner.
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
