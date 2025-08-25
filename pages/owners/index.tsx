import Link from "next/link";
import Image from "next/image";
import { GetStaticProps } from "next";
import { Entry, getAllOwnerEntries } from "../../lib/owners";

export const getStaticProps: GetStaticProps = async () => {
  const owners = getAllOwnerEntries()
    .sort((a, b) => a.ownerDisplay.localeCompare(b.ownerDisplay));
  return { props: { owners } };
};

export default function OwnersIndex({ owners }: { owners: Entry[] }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-bold">Owners</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {owners.map((o) => (
          <Link
            key={o.slug}
            href={`/owners/${o.slug}`}
            className="group rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              {/* Logo or fallback initials */}
              <LogoOrInitials name={o.teamName || o.ownerDisplay} src={o.logoSrc} />
              <div className="min-w-0">
                <div className="truncate text-base font-semibold">
                  {o.teamName || o.ownerDisplay}
                </div>
                <div className="text-xs text-slate-500">
                  Owner: {o.ownerDisplay}
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <Stat label="Record" value={`${o.record.wins}-${o.record.losses}${o.record.ties ? `-${o.record.ties}` : ""}`} />
              <Stat label="Playoffs" value={o.playoffs} />
              <Stat label="Titles" value={o.championships} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-slate-50 p-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function LogoOrInitials({ name, src }: { name: string; src?: string }) {
  if (src && src !== "/logos/default.png") {
    return (
      <Image
        src={src}
        alt={name}
        width={44}
        height={44}
        className="h-11 w-11 rounded-lg object-contain ring-1 ring-slate-200"
      />
    );
  }
  // Fallback: initials bubble using team/owner name
  const initials = name
    .split(/\s+/)
    .map((s) => s[0]?.toUpperCase())
    .slice(0, 2)
    .join("");
  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-200 font-semibold text-slate-700 ring-1 ring-slate-300">
      {initials || "?"}
    </div>
  );
}
