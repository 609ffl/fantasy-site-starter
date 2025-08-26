// pages/players/index.tsx
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import type { GetServerSideProps } from "next";
import { loadPlayerHistory } from "../../lib/loadHistory";

type PlayersIndexProps = { players: string[] };

export default function PlayersIndex({ players }: PlayersIndexProps) {
  const [q, setQ] = useState("");
  const router = useRouter();

  // If ?player=... is in the URL, seed the search box
  useEffect(() => {
    const qp = router.query?.player;
    if (typeof qp === "string" && qp.trim()) {
      setQ(qp);
    }
  }, [router.query?.player]);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return players;
    return players.filter((p) => p.toLowerCase().includes(n));
  }, [q, players]);

  return (
    <main style={{ maxWidth: 900, margin: "32px auto", padding: 16 }}>
      <h1>Players</h1>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search players…"
        style={{ width: "100%", padding: 8, margin: "12px 0" }}
      />
      <ul style={{ columns: 2, listStyle: "none", padding: 0, margin: 0 }}>
        {filtered.map((p) => (
          <li key={p} style={{ margin: "6px 0" }}>
            <Link href={`/players/${encodeURIComponent(p)}`}>{p}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

export const getServerSideProps: GetServerSideProps<PlayersIndexProps> = async () => {
  const rows = loadPlayerHistory();
  const players = Array.from(new Set(rows.map((r) => r.player))).sort((a, b) =>
    a.localeCompare(b)
  );
  return { props: { players } };
};

