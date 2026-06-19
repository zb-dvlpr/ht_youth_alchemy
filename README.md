# Hattrick Alchemy

Hattrick Alchemy is a CHPP-approved web app for Hattrick optimization workflows. It includes dedicated youth and senior team optimization tools for evaluating players, building lineups, and managing match orders, plus Club Chronicle insights for tracked teams.

## Core capabilities
- CHPP OAuth connection to Hattrick
- Multi-team youth and senior support for managers with multiple clubs/academies
- Youth player list, player details, ratings/skills matrices, and lineup optimization
- Youth transfer value estimates from revealed maximum potential
- Senior player list, player details with simulated HTMS/PsicoTSI metrics, ratings/skills matrices, and lineup workflow
- Senior staff-data persistence for Tactical Assistant availability in lineup workflows
- Transfer market search summaries with compact price distribution
- Senior AI lineup support for role-based man marking suggestions and match-order submission
- NEW markers in youth matrices for latest detected player/skill/rating changes
- Hidden youth specialty detection from past match events
- Match list with load/submit match orders
- Club Chronicle panels for league, press, fan club, arena, formations/tactics, likely training, last logins, coach details, transfers, TSI, wages, and ongoing matches with Hattrick Live cleanup
- Club Chronicle free/premium gating with resource-aware tracking limits, local license-key scaffolding, non-destructive cached watchlists/tabs, and IndexedDB-backed data payload storage
- Club Chronicle own-league watchlists with per-team selection inside each league
- Shared workflows with platform-aware UX evolution for distinct desktop and mobile ergonomics
- Localization (`en`, `de`, `fr`, `es`, `sv`, `it`, `pt`, `pl`, `nl`)
- Consent-gated Google Analytics and Vercel Analytics
- Global reminder framework with reminders settings, bell, snooze/dismiss state, and local export/import support
- Local settings export/import and persisted UI state
- Automatic deployed-version detection with a required refresh prompt

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
CHPP_COOKIE_SECRET=base64_32_byte_secret_here
```

Generate `CHPP_COOKIE_SECRET` with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
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
- Senior players: `GET /api/chpp/players`
- Senior ratings matrix: `GET /api/chpp/ratings`
- Match orders: `POST /api/chpp/matchorders`

## Development commands
- `npm run dev`
- `npm run lint`
- `npm run build`
- `npm run check:version`
- `npm run check:i18n`
- `npm run check:chpp-permissions`

## Notes
- CHPP access credentials are stored in one encrypted and authenticated HttpOnly cookie with a 16-week lifetime. No database is required.
- Rotating `CHPP_COOKIE_SECRET` invalidates existing CHPP sessions.
- A stolen encrypted cookie can still be replayed until it expires. This is stronger than storing raw token cookies, but it is not equivalent to a database-backed session with server-side revocation.

## License
Proprietary. All rights reserved.
