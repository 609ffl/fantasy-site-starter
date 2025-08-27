// pages/owners/[owner].tsx
import { GetStaticPaths, GetStaticProps } from "next";
import OwnerTeamPage from "../../components/OwnerTeamPage";
import { Entry, getAllOwnerEntries, getOwnerEntryBySlug } from "../../lib/owners";

import fs from "fs";
import path from "path";
import Papa from "papaparse";

// ---- NEW: UI + utils for H2H ------------------------------------------------
import { useEffect, useState } from "react";
import Link from "next/link";
import { ownerSlug } from "../../lib/slug";

// ---------- Types ----------
type LooseEntry = Omit<Entry, "colors"> & { colors?: Entry["colors"] | null };

type OwnerPageProps = {
  entry: LooseEntry;
  // Map of year -> { team_name?, regular_season_rank? }
  seasonMetaByYear: Record<number, { team_name?: string; regular_season_rank?: number | string }>;
};

// ---- NEW: H2H row type ----
type H2HRow = {
  opponent: string;
  games: number;
  wins: number;
  losses: number;
  ties: number;
  pf: number; // total points scored
  pa: number; // total points allowed
  diff: number;
  winPct: number;
  lastYear: number;
};

// Normalize colors: null -> undefined (so <OwnerTeamPage> sees undefined, not null)
function normalizeEntry(e: LooseEntry): Entry {
  const { colors, ...rest } = e;
  return { ...rest, colors: colors ?? undefined } as Entry;
}

export const getStaticPaths: GetStaticPaths = async () => {
  const entries = getAllOwnerEntries();
  return {
    paths: entries.map((e) => ({ params: { owner: e.slug } })),
    fallback: false,
  };
};

// ---------- Helpers ----------
function norm(s?: string) {
  return (s ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[._]/g, " ");
}
function looseEq(a?: string, b?: string) {
  return norm(a) === norm(b);
}
function matchesOwnerCSV(csvOwner: string, entry: Entry) {
  const candidates = [entry.slug, entry.ownerDisplay, entry.teamName]
    .filter(Boolean)
    .map((x) => String(x));
  const withSlugged = candidates.concat(
    candidates.map((c) => c.toLowerCase().replace(/\s+/g, "-"))
  );
  return withSlugged.some((c) => looseEq(c, csvOwner));
}

// pick first non-empty value among possible header variants
function pick(row: Record<string, unknown>, names: string[]): string | undefined {
  for (const n of names) {
    const v = row[n];
    if (v == null) continue;
    const s = String(v).trim();
    if (s !== "") return s;
  }
  return undefined;
}

export const getStaticProps: GetStaticProps<OwnerPageProps> = async (ctx) => {
  const slug = String(ctx.params?.owner ?? "");
  const raw = getOwnerEntryBySlug(slug);
  if (!raw) return { notFound: true };

  // normalize for matching against CSV
  const entry = normalizeEntry(raw as LooseEntry);

  // ---- Load CSV from /data ----
  const csvPath = path.join(process.cwd(), "data", "regular_season_ranks.csv");
  let seasonMetaByYear: OwnerPageProps["seasonMetaByYear"] = {};

  try {
    const csv = fs.readFileSync(csvPath, "utf8");
    const parsed = Papa.parse(csv, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h: string) => h.trim().toLowerCase(),
    });

    (parsed.data as unknown as Record<string, unknown>[]).forEach((row: Record<string, unknown>) => {
      const yearStr = pick(row, ["year", "season", "yr"]) ?? "";
      const ownerStr =
        pick(row, ["owner", "owner_name", "owner name", "owner display", "ownerdisplay"]) ?? "";

      const yearNum = Number(yearStr);
      if (!yearNum || !ownerStr) return;
      if (!matchesOwnerCSV(ownerStr, entry)) return;

      const teamNameRaw = pick(row, ["team_name", "team", "team name", "teamname"]);
      const team_name = teamNameRaw && teamNameRaw.length ? teamNameRaw : undefined;

      const rankRaw = pick(row, [
        "regular_season_rank",
        "regular season rank",
        "reg_season_rank",
        "reg rank",
        "rank",
        "seed",
      ]);

      let regular_season_rank: number | string | undefined = undefined;
      if (typeof rankRaw !== "undefined") {
        const r = String(rankRaw).trim();
        if (/^na$/i.test(r) || /^n\/?a$/i.test(r)) {
          regular_season_rank = "N/A";
        } else if (!isNaN(Number(r))) {
          regular_season_rank = Number(r);
        } else {
          regular_season_rank = r;
        }
      }

      const meta: Record<string, string | number> = {};
      if (typeof team_name !== "undefined") meta.team_name = team_name;
      if (typeof regular_season_rank !== "undefined") meta.regular_season_rank = regular_season_rank;

      if (Object.keys(meta).length > 0) {
        seasonMetaByYear[yearNum] = meta as {
          team_name?: string;
          regular_season_rank?: number | string;
        };
      }
    });
  } catch {
    seasonMetaByYear = {};
  }

  return { props: { entry: raw as LooseEntry, seasonMetaByYear } };
};

// ---- NEW: Head-to-Head section component -----------------------------------
function fmtPct(p: number) {
  if (!isFinite(p)) return "—";
  return (p * 100).toFixed(1) + "%";
}
function fmt2(n: number) {
  if (n == null || !isFinite(n)) return "0.00";
  return Number(n).toFixed(2);
}

function HeadToHeadSection({ owner }: { owner: string }) {
  const [rows, setRows] = useState<H2HRow[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/headtohead/${encodeURIComponent(owner)}`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d?.rows)) {
          const sorted = [...d.rows].sort((a, b) => {
            if (b.wins !== a.wins) return b.wins - a.wins;
            if (b.games !== a.games) return b.games - a.games;
            if (b.winPct !== a.winPct) return b.winPct - a.winPct;
            return a.opponent.localeCompare(b.opponent);
          });
          setRows(sorted);
        }
        if (d?.summary) setSummary(d.summary);
      })
      .finally(() => setLoading(false));
  }, [owner]);

  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 24, marginBottom: 12 }}>Head-to-Head vs. Other Owners</h2>

      {summary && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            padding: 16,
            borderRadius: 12,
            background: "#f8fafc",
            border: "1px solid #e5e7eb",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 16, marginRight: 8 }}>Overall</div>
          <div style={{ padding: "4px 10px", borderRadius: 999, background: "#eef2ff", border: "1px solid #c7d2fe" }}>
            Record: <strong>{summary.wins}-{summary.losses}{summary.ties ? `-${summary.ties}` : ""}</strong>
          </div>
          <div style={{ padding: "4px 10px", borderRadius: 999, background: "#ecfeff", border: "1px solid #a5f3fc" }}>
            Win%: <strong>{fmtPct(summary.winPct)}</strong>
          </div>
          <div style={{ padding: "4px 10px", borderRadius: 999, background: "#f1f5f9", border: "1px solid #e2e8f0" }}>
            PF/G: <strong>{fmt2(summary.games ? summary.pf / summary.games : 0)}</strong>
          </div>
          <div style={{ padding: "4px 10px", borderRadius: 999, background: "#f1f5f9", border: "1px solid #e2e8f0" }}>
            PA/G: <strong>{fmt2(summary.games ? summary.pa / summary.games : 0)}</strong>
          </div>
          <div style={{ padding: "4px 10px", borderRadius: 999, background: "#f1f5f9", border: "1px solid #e2e8f0" }}>
            Diff/G: <strong>{fmt2(summary.games ? (summary.pf - summary.pa) / summary.games : 0)}</strong>
          </div>
        </div>
      )}

      {loading ? (
        <div>Loading…</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "separate",
              borderSpacing: 0,
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ padding: "10px 8px", textAlign: "left", fontWeight: 700 }}>Opponent</th>
                <th style={{ padding: "10px 8px", textAlign: "left", fontWeight: 700 }}>Record</th>
                <th style={{ padding: "10px 8px", textAlign: "left", fontWeight: 700 }}>Wins</th>
                <th style={{ padding: "10px 8px", textAlign: "left", fontWeight: 700 }}>Games</th>
                <th style={{ padding: "10px 8px", textAlign: "left", fontWeight: 700 }}>PF/G</th>
                <th style={{ padding: "10px 8px", textAlign: "left", fontWeight: 700 }}>PA/G</th>
                <th style={{ padding: "10px 8px", textAlign: "left", fontWeight: 700 }}>Diff/G</th>
                <th style={{ padding: "10px 8px", textAlign: "left", fontWeight: 700 }}>Win%</th>
                <th style={{ padding: "10px 8px", textAlign: "left", fontWeight: 700 }}>Last Met</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const pfpg = r.games ? r.pf / r.games : 0;
                const papg = r.games ? r.pa / r.games : 0;
                const diffpg = r.games ? (r.pf - r.pa) / r.games : 0;
                return (
                  <tr
                    key={r.opponent}
                    style={{
                      background: i % 2 === 0 ? "#ffffff" : "#fcfcfd",
                      borderTop: "1px solid #f1f5f9",
                    }}
                  >
                    <td style={{ padding: "10px 8px" }}>
                      <Link href={`/owners/${ownerSlug(r.opponent)}`} style={{ color: "#3b82f6", textDecoration: "underline" }}>
                        {r.opponent}
                      </Link>
                    </td>
                    <td style={{ padding: "10px 8px" }}>
                      {r.wins}-{r.losses}
                      {r.ties ? `-${r.ties}` : ""}
                    </td>
                    <td style={{ padding: "10px 8px" }}>{r.wins}</td>
                    <td style={{ padding: "10px 8px" }}>{r.games}</td>
                    <td style={{ padding: "10px 8px" }}>{fmt2(pfpg)}</td>
                    <td style={{ padding: "10px 8px" }}>{fmt2(papg)}</td>
                    <td style={{ padding: "10px 8px" }}>{fmt2(diffpg)}</td>
                    <td style={{ padding: "10px 8px" }}>{fmtPct(r.winPct)}</td>
                    <td style={{ padding: "10px 8px" }}>{r.lastYear || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ---- Page -------------------------------------------------------------------
export default function OwnerPage(props: OwnerPageProps) {
  const safe: Entry = normalizeEntry(props.entry);

  return (
    <>
      <OwnerTeamPage {...safe} seasonMetaByYear={props.seasonMetaByYear} />
      <div style={{ maxWidth: 1000, margin: "24px auto", padding: "0 16px" }}>
        <HeadToHeadSection owner={safe.ownerDisplay} />
      </div>
    </>
  );
}
