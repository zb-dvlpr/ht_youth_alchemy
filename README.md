# Hattrick Alchemy

Hattrick Alchemy is a CHPP-approved web app for Hattrick youth team workflows. It helps you evaluate youth players, optimize weekly training plans, build lineups, and manage match orders, with additional Club Chronicle insights for tracked teams.

## Core capabilities
- CHPP OAuth connection to Hattrick
- Multi-team youth support for managers with multiple academies
- Youth player list, player details, ratings/skills matrices, and lineup optimization
- Match list with load/submit match orders
- Club Chronicle panels for league, press, fan club, arena, formations/tactics, likely training, transfers, TSI, and wages
- Club Chronicle "No divulgo" masked team rows unmask and immediately refresh data when clicked
- Latest Updates diffing grouped by team
- Localization (`en`, `de`, `fr`, `es`, `sv`, `it`, `pt`)
- Local settings export/import and persisted UI state

## Tech stack
- Next.js (App Router)
- React + TypeScript
- CHPP OAuth 1.0 integration

## Local setup
1. Install dependencies:

```bash
npm install
```

2. Create `.env.local`:

```bash
CHPP_CONSUMER_KEY=your_key_here
CHPP_CONSUMER_SECRET=your_secret_here
CHPP_CALLBACK_URL=http://localhost:3000/api/chpp/oauth/callback
```

3. Start development server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## OAuth flow (local)
1. Visit `http://localhost:3000/api/chpp/oauth/start`
2. Authorize in Hattrick
3. Return to app root

Useful OAuth endpoints:
- `GET /api/chpp/oauth/debug`
- `GET /api/chpp/oauth/check-token`
- `POST /api/chpp/oauth/invalidate-token`

OAuth requests explicitly ask for CHPP extended permissions `set_matchorder,manage_youthplayers`, and runtime token checks require those permissions for permission-sensitive actions.
Runtime permission checks normalize CHPP check-token permission formats (for example comma/space/semicolon-delimited scope variants).

## Main API routes (local)
- Youth players: `GET /api/chpp/youth/players`
- Youth player details: `GET /api/chpp/youth/player-details?youthPlayerID=...`
- Matches: `GET /api/chpp/matches?isYouth=true`
- Match orders: `POST /api/chpp/matchorders`

## Development commands
- `npm run dev`
- `npm run lint`
- `npm run build`
- `npm run check:version`
- `npm run check:i18n`
- `npm run check:chpp-permissions`

## Notes
- OAuth access tokens are stored in httpOnly cookies.
- CHPP re-auth prompts are triggered only when responses include explicit auth-expired signals, reducing false "Session expired" states.
- Generic upstream `401 - Unauthorized` transport errors are not treated as token revocation by themselves.
- Youth player details automatically fall back from `unlockskills` to standard `details` when CHPP denies unlock at transport level.
- If CHPP authorization is invalid, the app prompts for reconnect and preserves cached UI data.
- Club Chronicle `No divulgo` unmask is one-time per browser storage (until local storage is cleared), and its post-click refresh targets only that team.

## License
Proprietary. All rights reserved.
