// pages/owners/[owner].tsx
import { GetStaticPaths, GetStaticProps } from "next";
import OwnerTeamPage from "../../components/OwnerTeamPage";
import { Entry, getAllOwnerEntries, getOwnerEntryBySlug } from "../../lib/owners";

import fs from "fs";
import path from "path";
import Papa from "papaparse";

// ---------- Types ----------
type LooseEntry = Omit<Entry, "colors"> & { colors?: Entry["colors"] | null };

type OwnerPageProps = {
  entry: LooseEntry;
  // Map of year -> { team_name?, regular_season_rank? }
  seasonMetaByYear: Record<number, { team_name?: string; regular_season_rank?: number | string }>;
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
      // allow common variants for each column
      const yearStr = pick(row, ["year", "season", "yr"]) ?? "";
      const ownerStr =
        pick(row, ["owner", "owner_name", "owner name", "owner display", "ownerdisplay"]) ?? "";

      const yearNum = Number(yearStr);
      if (!yearNum || !ownerStr) return;
      if (!matchesOwnerCSV(ownerStr, entry)) return;

      // Team name variants
      const teamNameRaw = pick(row, ["team_name", "team", "team name", "teamname"]);
      const team_name = teamNameRaw && teamNameRaw.length ? teamNameRaw : undefined;

      // Rank variants
      const rankRaw = pick(row, [
        "regular_season_rank",
        "regular season rank",
        "reg_season_rank",
        "reg rank",
        "rank",
        "seed",
      ]);

      // parse rank
      let regular_season_rank: number | string | undefined = undefined;
      if (typeof rankRaw !== "undefined") {
        const r = rankRaw.trim();
        if (/^na$/i.test(r) || /^n\/?a$/i.test(r)) {
          regular_season_rank = "N/A";
        } else if (!isNaN(Number(r))) {
          regular_season_rank = Number(r);
        } else {
          // keep as-is (e.g., "T-3")
          regular_season_rank = r;
        }
      }

      // ---- Avoid undefined in getStaticProps result ----
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

export default function OwnerPage(props: OwnerPageProps) {
  const safe: Entry = normalizeEntry(props.entry);
  return <OwnerTeamPage {...safe} seasonMetaByYear={props.seasonMetaByYear} />;
}
