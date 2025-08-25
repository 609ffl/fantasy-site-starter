// pages/owners/[owner].tsx
import { GetStaticPaths, GetStaticProps } from "next";
import OwnerTeamPage from "../../components/OwnerTeamPage";
import { Entry, getAllOwnerEntries, getOwnerEntryBySlug } from "../../lib/owners";

export const getStaticPaths: GetStaticPaths = async () => {
  const entries = getAllOwnerEntries();
  return {
    paths: entries.map((e) => ({ params: { owner: e.slug } })),
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps = async (ctx) => {
  const slug = String(ctx.params?.owner || "");
  const entry = getOwnerEntryBySlug(slug);
  if (!entry) return { notFound: true };

  return {
    props: {
      entry: { ...entry, colors: entry.colors ?? null }, // ✅ never undefined
    },
  };
};

export default function OwnerPage({ entry }: { entry: Entry }) {
  return <OwnerTeamPage {...entry} />;
}
