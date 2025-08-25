// pages/owners/index.tsx
import { GetStaticProps, InferGetStaticPropsType } from "next";
import Link from "next/link";
import type { Entry } from "../../lib/owners";
import { getAllOwnerEntries } from "../../lib/owners";

export const getStaticProps: GetStaticProps<{ owners: Entry[] }> = async () => {
  const owners = getAllOwnerEntries();
  return { props: { owners } };
};

export default function OwnersIndex(
  { owners }: InferGetStaticPropsType<typeof getStaticProps>
) {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="mb-6 text-3xl font-bold">Owners</h1>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {owners.map((e) => (
          <div
            key={e.slug}
            className="rounded-2xl border p-4 shadow-sm"
          >
            <div className="flex items-center gap-4">
              <img
                src={e.logoSrc}
                alt={e.teamName}
                className="h-14 w-14 rounded-lg object-contain ring-2 ring-offset-2"
              />
              <div>
                {/* Name stays clickable */}
                <Link href={`/owners/${e.slug}`} className="text-lg font-semibold underline">
                  {e.teamName}
                </Link>
                <div className="text-sm text-gray-600">
                  Owner:{" "}
                  <Link href={`/owners/${e.slug}`} className="underline">
                    {e.ownerDisplay}
                  </Link>
                </div>
              </div>
            </div>

            {/* Stats: NOT clickable */}
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-xl border p-3 text-center">
                <div className="text-xs uppercase tracking-wide text-gray-600">Record</div>
                <div className="mt-1 text-xl font-extrabold text-purple-700">
                  {e.record.wins}-{e.record.losses}
                  {e.record.ties ? `-${e.record.ties}` : ""}
                </div>
              </div>
              <div className="rounded-xl border p-3 text-center">
                <div className="text-xs uppercase tracking-wide text-gray-600">Playoffs</div>
                <div className="mt-1 text-xl font-extrabold text-purple-700">
                  {e.playoffs}
                </div>
              </div>
              <div className="rounded-xl border p-3 text-center">
                <div className="text-xs uppercase tracking-wide text-gray-600">Titles</div>
                <div className="mt-1 text-xl font-extrabold text-purple-700">
                  {e.championships}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
