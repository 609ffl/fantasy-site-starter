// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      // ensure the players page function includes the /data folder
      '/pages/players/[player]': ['./data/**'],
      // If other pages read CSVs too, you can widen the scope:
      // '/pages/(.*)': ['./data/**'],
    },
  },
};

module.exports = nextConfig;
