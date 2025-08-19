// pages/owners/index.tsx
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

export default function OwnersIndex() {
  const [owners, setOwners] = useState<Career[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const data = await fetch("/api/history?summary=1").then((r) => r.json());
      setOwners(Array.isArray(data.career) ? data.career : []);
      setLoading(false);
    })();
  }, []);

  const fmt2 = (n: unknown) =>
    typeof n === "number" && Number.isFinite(n) ? n.toFixed(2) : "—";

  return (
    <main
      style={{
        maxWidth: 1000,
        margin: "40px auto",
        padding: 16,
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
      }}
    >
      <h1 style={{ marginBottom: 8 }}>All Owners</h1>
      {loading && <p>Loading…</p>}
      {!loading && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
                <th style={{ padding: 8 }}>Owner</th>
                <th style={{ padding: 8 }}>Seasons</th>
                <th style={{ padding: 8 }}>Total Points</th>
                <th style={{ padding: 8 }}>PF/G</th>
                <th style={{ padding: 8 }}>Years</th>
              </tr>
            </thead>
            <tbody>
              {owners.map((o) => (
                <tr key={o.owner} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: 8 }}>
                    <Link
                      href={{ pathname: "/owners/[owner]", query: { owner: o.owner } }}
                    >
                      {o.owner}
                    </Link>
                  </td>
                  <td style={{ padding: 8 }}>{o.seasons ?? "—"}</td>
                  <td style={{ padding: 8, fontWeight: 700 }}>{fmt2(o.total_points)}</td>
                  <td style={{ padding: 8 }}>{fmt2(o.pf_per_game)}</td>
                  <td style={{ padding: 8 }}>
                    {o.first_year && o.last_year
                      ? `${o.first_year}–${o.last_year}`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
