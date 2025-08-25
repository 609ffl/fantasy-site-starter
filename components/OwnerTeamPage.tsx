import Image from "next/image";

export type Season = { year: number; wins: number; losses: number; finish?: string };

type Entry = {
  teamName: string;
  ownerDisplay: string;
  logoSrc: string;
  record: { wins: number; losses: number; ties?: number };
  playoffs: number;
  championships: number;
  seasons: Season[];
  colors?: { primary: string; accent: string; dark: string };
};

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}

export default function OwnerTeamPage(entry: Entry) {
  const { teamName, ownerDisplay, logoSrc, record, playoffs, championships, seasons, colors } = entry;
  const palette = colors ?? { primary: "#9e2f2f", accent: "#e5d5a5", dark: "#1f3e6b" };
  const maxWins = Math.max(1, ...seasons.map((s) => s.wins));

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      {/* HERO */}
      <div className="rounded-2xl border p-6 shadow-sm bg-white">
        <div className="flex flex-col items-center gap-6 text-center md:flex-row md:text-left">
          <Image
            src={logoSrc}
            alt={teamName}
            width={120}
            height={120}
            className="h-28 w-28 rounded-xl object-contain ring-2"
            style={{ ringColor: palette.accent }}
          />
          <div className="flex-1">
            <h1 className="text-3xl font-extrabold" style={{ color: palette.dark }}>
              {teamName}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Owner: <span className="font-medium">{ownerDisplay}</span>
            </p>
            <div className="mt-4 grid grid-cols-3 gap-3 md:max-w-md">
              <StatTile label="Record" value={`${record.wins}-${record.losses}${record.ties ? `-${record.ties}` : ""}`} />
              <StatTile label="Playoff Apps" value={playoffs} />
              <StatTile label="Titles" value={championships} />
            </div>
          </div>
        </div>
      </div>

      {/* BODY */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Seasons */}
        <section className="lg:col-span-3">
          <h2 className="mb-3 text-lg font-semibold">Seasons</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {seasons.map((s) => (
              <div key={s.year} className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">{s.year}</div>
                  {s.finish && (
                    <span className="rounded px-2 py-1 text-xs font-medium" style={{ background: `${palette.accent}33`, color: palette.dark }}>
                      {s.finish}
                    </span>
                  )}
                </div>
                <div className="mt-2 text-2xl font-semibold">
                  {s.wins}-{s.losses}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Wins per season */}
        <section className="lg:col-span-2">
          <h2 className="mb-3 text-lg font-semibold">Wins per Season</h2>
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="space-y-3">
              {seasons.map((s) => {
                const pct = Math.round((s.wins / maxWins) * 100);
                return (
                  <div key={`bar-${s.year}`}>
                    <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                      <span>{s.year}</span>
                      <span>{s.wins}W</span>
                    </div>
                    <div className="h-3 w-full rounded bg-slate-100">
                      <div className="h-3 rounded" style={{ width: `${pct}%`, background: palette.primary }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 text-xs text-slate-500">Bars scale to best season ({maxWins} wins).</div>
          </div>
        </section>
      </div>
    </div>
  );
}
