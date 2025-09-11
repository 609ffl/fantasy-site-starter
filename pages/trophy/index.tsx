// pages/trophy/index.tsx
// Mobile-first Trophy Room page. Non-invasive: add-only route.
// Put cleaned JSON at /public/data/trophy_room_summary.json (2011 excluded from points-based stats).

import React, { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ownerSlug } from "../../lib/slug";

type ScoreRow = { owner: string; points: number; year: number };

type BlowoutRow = {
  owner: string;
  score: number;
  owner_1: string;
  score_1: number;
  year: number;
  margin: number;
};

type WorstRecordRow = {
  year: number;
  owner: string;
  team_name: string;
  wins: number;
  losses: number;
  ties: number;
  win_pct: number;
};

type PlayoffRow = {
  owner: string;
  seasons: number;
  playoff_apps: number;
  rings: number;
  playoff_rate: number;
};

type TrophySummary = {
  top_single_week_scores: ScoreRow[];
  biggest_blowouts: BlowoutRow[];
  worst_single_season_records: WorstRecordRow[];
  playoff_summary: PlayoffRow[];
  meta?: { notes?: string };
};

const Section = ({ title, children, subtitle }: { title: string; subtitle?: string; children: ReactNode }) => (
  <section className="mb-8">
    <div className="px-4">
      <h2 className="text-xl font-bold text-white">{title}</h2>
      {subtitle ? <p className="text-sm text-slate-300 mt-1">{subtitle}</p> : null}
    </div>
    <div className="mt-4">{children}</div>
  </section>
);

const Card = ({ children }: { children: ReactNode }) => (
  <div className="shrink-0 w-72 bg-slate-800/80 rounded-2xl p-4 mx-2 shadow-lg backdrop-blur-sm border border-slate-700">
    {children}
  </div>
);

const ScrollRow = ({ children }: { children: ReactNode }) => (
  <div className="flex overflow-x-auto snap-x snap-mandatory px-2" role="list">
    {children}
  </div>
);

export default function TrophyRoomPage() {
  const [data, setData] = useState<TrophySummary | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const url = "/data/trophy_room_summary.json"; // put file in public/data/
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j) => setData(j))
      .catch((e) => setErr(String(e)));
  }, []);

  if (err) return <div className="p-6 text-red-400">Failed to load Trophy Room: {err}</div>;
  if (!data) return <div className="p-6 text-slate-200">Loading Trophy Room…</div>;

  const { top_single_week_scores, biggest_blowouts, worst_single_season_records, playoff_summary, meta } = data;

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 text-white pb-16">
      <header className="px-4 pt-6 pb-4">
        <h1 className="text-2xl font-extrabold">🏆 League Trophy Room</h1>
        {meta?.notes ? <p className="text-xs text-slate-400 mt-1">{meta.notes}</p> : null}
      </header>

      {/* Playoff Résumés */}
      <Section title="Playoff Résumés" subtitle="Rings • Appearances • Rate (2011 included for playoffs only)">
        <ScrollRow>
          {playoff_summary.map((p) => (
            <Card key={p.owner}>
              <div className="flex items-center gap-3">
                <div className="relative w-12 h-12">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-yellow-300 to-yellow-500 animate-pulse" />
                  <div className="absolute inset-1 rounded-full bg-slate-900 flex items-center justify-center text-2xl">💍</div>
                </div>
                <div>
                  <Link href={`/owners/${ownerSlug(p.owner)}`} className="text-lg font-bold hover:underline">{p.owner}</Link>
                  <div className="text-xs text-slate-300">Seasons: {p.seasons}</div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 text-center text-sm">
                <div>
                  <div className="text-xl font-extrabold">{p.rings}</div>
                  <div className="text-slate-400">Rings</div>
                </div>
                <div>
                  <div className="text-xl font-extrabold">{p.playoff_apps}</div>
                  <div className="text-slate-400">Apps</div>
                </div>
                <div>
                  <div className="text-xl font-extrabold">{(p.playoff_rate * 100).toFixed(0)}%</div>
                  <div className="text-slate-400">Rate</div>
                </div>
              </div>
            </Card>
          ))}
        </ScrollRow>
      </Section>

      {/* Highest Scores Ever (2012+) */}
      <Section title="Highest Scores Ever" subtitle="Post-2011 to avoid jacked scoring">
        <ScrollRow>
          {top_single_week_scores.map((r, i) => (
            <Card key={`${r.owner}-${Number(r.points).toFixed(2)}-${i}`}>
              <div className="text-sm text-slate-400">Year {r.year}</div>
              <div className="mt-1 text-2xl font-extrabold">{Number(r.points).toFixed(2)}</div>
              <Link href={`/owners/${ownerSlug(r.owner)}`} className="text-emerald-300 font-semibold hover:underline">{r.owner}</Link>
              <div className="mt-2 text-xs text-slate-400">Single-week points</div>
            </Card>
          ))}
        </ScrollRow>
      </Section>

      {/* Biggest Blowouts (2012+) */}
      <Section title="Biggest Blowouts" subtitle="Margin of victory, post-2011">
        <ScrollRow>
          {biggest_blowouts.map((b, i) => (
            <Card key={`${b.owner}-${b.owner_1}-${i}`}>
              <div className="text-sm text-slate-400">Year {b.year}</div>
              <div className="mt-1 text-2xl font-extrabold">+{Number(b.margin).toFixed(2)}</div>
              <Link href={`/owners/${ownerSlug(b.owner)}`} className="text-emerald-300 font-semibold hover:underline">{b.owner}</Link>
              <div className="text-xs text-slate-400">over</div>
              <Link href={`/owners/${ownerSlug(b.owner_1)}`} className="text-pink-300 font-semibold hover:underline">{b.owner_1}</Link>
              <div className="mt-2 text-xs text-slate-400">{Number(b.score).toFixed(2)} - {Number(b.score_1).toFixed(2)}</div>
            </Card>
          ))}
        </ScrollRow>
      </Section>

      {/* Hall of Infamy: Worst Seasons (2012+) */}
      <Section title="Hall of Infamy" subtitle="Worst single-season records (reg. season)">
        <div className="px-3">
          <div className="overflow-hidden rounded-2xl border border-slate-700">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-800/80 text-slate-300">
                <tr>
                  <th className="py-2 px-2 text-left">Year</th>
                  <th className="py-2 px-2 text-left">Owner</th>
                  <th className="py-2 px-2 text-left">Team</th>
                  <th className="py-2 px-2 text-right">W</th>
                  <th className="py-2 px-2 text-right">L</th>
                  <th className="py-2 px-2 text-right">T</th>
                  <th className="py-2 px-2 text-right">Win%</th>
                </tr>
              </thead>
              <tbody>
                {worst_single_season_records.map((w, i) => (
                  <tr key={`${w.owner}-${w.year}-${i}`} className={i % 2 ? "bg-slate-900/50" : "bg-slate-900/20"}>
                    <td className="py-2 px-2">{w.year}</td>
                    <td className="py-2 px-2"><Link href={`/owners/${ownerSlug(w.owner)}`} className="hover:underline">{w.owner}</Link></td>
                    <td className="py-2 px-2">{w.team_name}</td>
                    <td className="py-2 px-2 text-right">{w.wins}</td>
                    <td className="py-2 px-2 text-right">{w.losses}</td>
                    <td className="py-2 px-2 text-right">{w.ties}</td>
                    <td className="py-2 px-2 text-right">{(w.win_pct * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      {/* Season PF Leaders (2012+) */}
      

      <footer className="px-4 pt-4 pb-10 text-center text-xs text-slate-400">
        Built for mobile • swipe the rows ➡️
      </footer>
    </main>
  );
}
