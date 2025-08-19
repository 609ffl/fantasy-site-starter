
# Fantasy Site Starter (Next.js)

This starter renders a **Live Scoreboard** for your ESPN league and includes a server API that can use cookies if needed.

## Quick Start
```bash
npm install
cp .env.example .env.local
npm run dev
```

Visit http://localhost:3000

### If you see data
You're public — you're done. 🎉

### If you see an error
Add cookies to `.env.local`:
```
SWID={YOUR_SWID_WITH_BRACES}
ESPN_S2=YOUR_LONG_ESPN_S2_NO_BRACES
```
Save and refresh. The server API will include them in requests.

## Files
- `pages/index.tsx` – Live scoreboard page
- `pages/api/scoreboard.ts` – Serverless API that calls ESPN
- `lib/espn.ts` – URL builder
- `.env.local` – Your env vars (never commit)

## Notes
- No K/DST assumed in UI, TE premium handled on the stats layer later.
- Add pages for Teams and History next; schema from earlier message fits.
