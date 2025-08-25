// lib/LOGOS.ts
export type LogoPalette = { primary: string; accent: string; dark: string };
export type LogoOverride = { teamName?: string; logoSrc?: string; colors?: LogoPalette };

export const LOGOS: Record<string, LogoOverride> = {
  "g-nulty": {
    teamName: "Marshall Ave Goon Squad",
    logoSrc: "/logos/goon-squad.png",
    colors: { primary: "#9e2f2f", accent: "#e5d5a5", dark: "#1f3e6b" },
  },

  "s-dickson": {
    teamName: "Dixon's Doghouse",
    logoSrc: "/logos/dickson.png",
    colors: { primary: "#2e86ab", accent: "#f6c90e", dark: "#1b1b1b" },
  },

  "a-parra": {
    teamName: "Angry Bananas",
    logoSrc: "/logos/a-parra.png",
    colors: { primary: "#2e86ab", accent: "#f6c90e", dark: "#1b1b1b" },
  },

  "b-newell": {
    teamName: "Beady Juice Inc",
    logoSrc: "/logos/b-newell.png",
    colors: { primary: "#2e86ab", accent: "#f6c90e", dark: "#1b1b1b" },
  },

  "c-baylo": {
    teamName: "Vendome Rodeo",
    logoSrc: "/logos/c-baylo.png",
    colors: { primary: "#2e86ab", accent: "#f6c90e", dark: "#1b1b1b" },
  },

  "c-upperman": {
    teamName: "Suck My Balls",
    logoSrc: "/logos/c-upperman.png",
    colors: { primary: "#2e86ab", accent: "#f6c90e", dark: "#1b1b1b" },
  },

  "d-daniel": {
    teamName: "Jew-ru",
    logoSrc: "/logos/d-daniel.png",
    colors: { primary: "#8a54d6", accent: "#f6c90e", dark: "#1b1b1b" },
  },

  "kramer-fader": {
    teamName: "Booze Hounds",
    logoSrc: "/logos/kramer-fader.png",
    colors: { primary: "#2e86ab", accent: "#f6c90e", dark: "#1b1b1b" },
  },

  "m-dicerbo": {
    teamName: "Team Slapper",
    logoSrc: "/logos/m-dicerbo.png",
    colors: { primary: "#2e86ab", accent: "#f6c90e", dark: "#1b1b1b" },
  },

  "m-spiers": {
    teamName: "RIP Rome",
    logoSrc: "/logos/m-spiers.png",
    colors: { primary: "#2e86ab", accent: "#f6c90e", dark: "#1b1b1b" },
  },

  "r-kelly": {
    teamName: "Riverboat Rob",
    logoSrc: "/logos/r-kelly.png",
    colors: { primary: "#2e86ab", accent: "#f6c90e", dark: "#1b1b1b" },
  },

  "t-flynn": {
    teamName: "Irish Brigade",
    logoSrc: "/logos/t-flynn.png",
    colors: { primary: "#2e86ab", accent: "#f6c90e", dark: "#1b1b1b" },
  },
};
