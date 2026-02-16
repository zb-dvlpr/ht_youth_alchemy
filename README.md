# Hattrick Alchemy

Hattrick Alchemy is a CHPP-approved web app that recommends a weekly two-training plan and a match lineup for your Hattrick youth squad, with space for future senior-squad tools. If you select a priority player, the recommendation weights that player more heavily while still maximizing total expected squad training.

## Features
- CHPP OAuth connection to your Hattrick account
- Youth player list with sorting, star-player selection, full refresh (players, details, ratings, matches), and synced ordering with matrices
- Multi youth-team switching when a manager owns multiple academies
- Player details with skills, promotion timing, last match info, and maxed-out indicators
- Tabbed matrices for ratings and skill current/max with maxed-out indicators
- Training selectors and optimized lineup generation
- Drag-and-drop lineup and bench builder with per-slot orientations, click-to-focus player details, captain selection, tactic selection, and submit/load match orders
- Match list with orders status, match type labels, refresh, and per-match actions
- Optimizer menu with multiple algorithm modes, including ratings-based optimization
- Modal confirmations and blockers for critical actions
- Settings menu with data export/import for local backups and algorithm controls
- General settings submenu with an `Enable app scaling` toggle (default off) and explanatory tooltip; when scaling is off, the app uses normal-size layout with page scrolling, keeps the top bar pinned, and preserves a clean top edge while scrolling
- Dev builds include a `Debug` settings submenu with a button to open dummy Club Chronicle Latest Updates data for currently tracked teams
- Localization, dark mode, notifications, and a guided help overlay with callouts
- Stale data auto-refresh with configurable threshold
- Help menu with an in-app changelog and pagination (10 rows per page)
- Collapsible sidebar for switching between tools
- Club Chronicle panels for league performance, latest press announcements, fan club name/size (from `teamdetails` v3.8), arena data (name, capacity, rebuild date, and seat breakdown from `arenadetails` v1.7) with robust CHPP date parsing (including `#text` node formats), estimated finances, transfer market activity, TSI totals, and wage totals (overall and top 11 from `players` v2.8), with cached updates, sortable columns, reusable panels, panel-specific refresh controls, drag-and-drop panel reordering from the entire panel header/title area with persisted order and corrected drop behavior (including pointer-drag fallback), highlighted own-team rows across Chronicle panel tables, a retained global refresh action, click-through press announcement modals with resolved player/match/team links plus direct article links (using `https://www.hattrick.org`), finance details shown on row click with rough-estimate marking, transfer drill-down modals for active listings and recent buys/sales history (from team player lists), row-click TSI drill-down showing all player TSI values with sortable sequential index/player/TSI columns, row-click wage drill-down showing all player wages for a team with reliable sortable index/player/wage columns, standardized currency rendering in EUR across Chronicle currency fields (CHPP SEK values converted by `/10`), including robust buy/sell type resolution, correctly applied wide transfer-history modal sizing, live use of the configured latest-transfer count, explicit team-name context in transfer modals, and deduplicated shared transfer API calls during global refresh
- Latest updates now tracks changes per attribute across all Club Chronicle panels, grouped by team and showing only changed fields in a responsive, scrollable team-card grid, with the comparison baseline fixed to the last global refresh and recalculated when opening the modal.

## Local setup
1) Install dependencies

```bash
npm install
```

2) Create `.env.local` with your CHPP keys

```bash
CHPP_CONSUMER_KEY=your_key_here
CHPP_CONSUMER_SECRET=your_secret_here
CHPP_CALLBACK_URL=http://localhost:3000/api/chpp/oauth/callback
```

3) Start the dev server

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

## OAuth test flow (local)
1) Visit `http://localhost:3000/api/chpp/oauth/start` in your browser.
2) You should be redirected to Hattrick for authorization.
3) After approving, CHPP redirects back to the app and you should land on the main page.
4) The app requests the `set_matchorder` scope so it can submit lineup orders.

## Youth player list (local)
After OAuth succeeds, call:

- Default list: `http://localhost:3000/api/chpp/youth/players`
- Detailed: `http://localhost:3000/api/chpp/youth/players?actionType=details`
- Include raw XML: `http://localhost:3000/api/chpp/youth/players?raw=1`

## Youth player details (local)
After OAuth succeeds, call:

- `http://localhost:3000/api/chpp/youth/player-details?youthPlayerID=YOUR_ID`
- Include raw XML: `http://localhost:3000/api/chpp/youth/player-details?youthPlayerID=YOUR_ID&raw=1`

## Matches (local)
After OAuth succeeds, call:

- Youth matches (default): `http://localhost:3000/api/chpp/matches?isYouth=true`
- Senior matches: `http://localhost:3000/api/chpp/matches?isYouth=false&teamID=YOUR_TEAM_ID`
- Include raw XML: `http://localhost:3000/api/chpp/matches?isYouth=true&raw=1`

## Match orders (local)
After OAuth succeeds and you have set a lineup in the UI, you can submit orders for an upcoming match via the UI. The API endpoint is:

- `POST http://localhost:3000/api/chpp/matchorders`

## Troubleshooting OAuth
- Check env presence (no secrets returned): `http://localhost:3000/api/chpp/oauth/debug`
- Inspect the current OAuth token/scopes: `http://localhost:3000/api/chpp/oauth/check-token`
- Invalidate the current token (clears cookies): `POST http://localhost:3000/api/chpp/oauth/invalidate-token` (GET also supported for convenience)
- If you rotate secrets, restart the dev server.
- Include debug payload (no secrets): `http://localhost:3000/api/chpp/oauth/start?debug=1`

## Testing
- Lint: `npm run lint`
- Build: `npm run build`
- Version guardrail (pre-rebase sanity check): `npm run check:version`

## Git hooks
This repo uses a pre-rebase hook to prevent version regressions. If hooks are not active, run:

```bash
git config core.hooksPath .githooks
```

## Notes
- Match orders are submitted only after explicit confirmation.
- OAuth access tokens are stored in httpOnly cookies.
- If authorization expires, the app prompts you to reconnect while keeping cached data visible.

## License
Proprietary. All rights reserved.
