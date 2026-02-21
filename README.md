# Hattrick Alchemy

Hattrick Alchemy is a CHPP-approved web app for Hattrick youth team workflows. It helps you evaluate youth players, optimize weekly training plans, build lineups, and manage match orders, with additional Club Chronicle insights for tracked teams.

## Core capabilities
- CHPP OAuth connection to Hattrick
- Multi-team youth support for managers with multiple academies
- Youth player list, player details, ratings/skills matrices, and lineup optimization
- Hidden youth specialty detection from past match events
- Match list with load/submit match orders
- Club Chronicle panels for league, press, fan club, arena, formations/tactics, likely training, transfers, TSI, and wages
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

## License
Proprietary. All rights reserved.
