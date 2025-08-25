// lib/getBrand.ts
import { LOGOS } from "./LOGOS";

export function getBrand(slug: string, ownerDisplay: string) {
  const entry = LOGOS[slug];
  return {
    teamName: entry?.teamName ?? ownerDisplay,
    logoSrc: entry?.logoSrc ?? "/logos/default.png",
    colors: entry?.colors ?? { primary: "#333", accent: "#aaa", dark: "#000" },
  };
}
