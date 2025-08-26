// pages/players/index.tsx
// @ts-nocheck
import Link from "next/link";
import { useMemo, useState } from "react";
import { loadPlayerHistory } from "../../lib/loadHistory";
import { useRouter } from "next/router";
// ...
const { query } = useRouter();
useEffect(() => {
  const q = typeof query.player === "string" ? query.player : "";
  // setSearch(q) or however you control the filter/search input
}, [query.player]);


export default function PlayersIndex({ players }: { players: string[] }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return players;
    return players.filter(p => p.toLowerCase().includes(n));
  }, [q, players]);

  return (
    <main style={{ maxWidth: 900, margin: "32px auto", padding: 16 }}>
      <h1>Players</h1>
      <input
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Search players…"
        style={{ width: "100%", padding: 8, margin: "12px 0" }}
      />
      <ul style={{ columns: 2, listStyle: "none", padding: 0, margin: 0 }}>
        {filtered.map(p => (
          <li key={p} style={{ margin: "6px 0" }}>
            <Link href={`/players/${encodeURIComponent(p)}`}>{p}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

export async function getServerSideProps() {
  const rows = loadPlayerHistory();
  const players = Array.from(new Set(rows.map(r => r.player))).sort((a,b) => a.localeCompare(b));
  return { props: { players } };
}
