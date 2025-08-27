// components/PlayerBlurb.tsx
import { useEffect, useState } from "react";

export default function PlayerBlurb({ name }: { name: string }) {
  const [data, setData] = useState<{ blurb: string; bullets: string[] } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/player-blurb?name=${encodeURIComponent(name)}`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [name]);

  return (
    <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="mb-2 text-base font-semibold text-zinc-800">AI Career Blurb</h2>
      <p className="leading-relaxed text-zinc-800">{loading ? "Generating…" : (data?.blurb || "—")}</p>
      {!!data?.bullets?.length && (
        <div className="mt-3">
          <h3 className="mb-1 text-sm font-semibold text-zinc-700">Notable Facts</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-800">
            {data.bullets.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        </div>
      )}
    </section>
  );
}
