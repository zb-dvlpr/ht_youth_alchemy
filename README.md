# Youth Alchemy

Youth Alchemy is a CHPP-approved web app that recommends a weekly two-training plan and a match lineup for your Hattrick youth squad. If you select a priority player, the recommendation weights that player more heavily while still maximizing total expected squad training.

## Features (scaffold)
- Next.js + TypeScript single-app setup (UI + API routes)
- CHPP OAuth endpoints for request token + callback handling
- CHPP youthplayerlist endpoint (XML parsed to JSON)
- CHPP youthplayerdetails endpoint (XML parsed to JSON)
- CHPP matches endpoint (youth by default)
- Three-column layout: players list, player details, lineup + matches (stacked in column 3)
- Compact player list spacing
- Player list shows specialty emoji when available (including resilient/support)
- Lineup slots show specialty emoji when available
- Updated document title/description metadata
- Favicon uses a football emoji icon
- Click-to-load player details in a dedicated panel
- Language switcher (English, German, French, Spanish, Swedish, Italian, Portuguese)
- Localization rule: new UI text must be i18n-backed
- Ratings matrix using last 10 finished match lineups (max RatingStars per cell)
- Ratings matrix uses MatchRoleID labels instead of numeric codes
- Ratings matrix collapses left/right positions into single columns
- Player details show last match position and rating (showLastMatch=true)
- player-details API passes through showLastMatch/showScoutCall flags
- Last match summary formatted as dd.mm.yyyy: rating (expanded position)
- Promotable badge treats negative values as promotable now
- Lineup slots show drag cursor + tooltip
- Drag preview snaps to lineup slot size, with the grab area covering the full slot
- Header auto-shrinks to reduce vertical scrolling (logo scales by height)
- Header uses a sleek typographic wordmark (Hattrick Youth Alchemy)
- Ratings matrix rendered in the middle column; player list column tightened
- Match lineup API for last finished youth match
- Connect button shown when CHPP access token is missing
- In-session details cache with manual refresh and a structured details panel (current/potential skill bars with numeric values or ?)
- Upcoming youth match list (handles team-level match list; falls back to recent matches if none UPCOMING)
- Submit lineup orders for upcoming youth matches (requires set_matchorder scope); load lineup appears first
- Match orders use Lineup_30 with numeric values, with left/right slots flipped to match Hattrick's ordering
- Match submission responses can be expanded inline for debugging
- Submit success is verified from the response (OrdersSet=True), otherwise errors prompt a report
- Submit confirmations use an in-app dialog aligned with the site style
- Load saved match orders into the lineup graphic per match (on demand)
- Loaded match is highlighted until the lineup is changed
- Orders status uses the `OrdersGiven` flag from the matches feed
- Load lineup is enabled only when `OrdersGiven` is true
- Match list auto-refreshes after order submission and shows last updated time
- Match order submission requires at least 9 players assigned
- Match order submission requires no more than 11 players assigned
- Disabled submit explains why (too few or too many players)
- Random lineup sets a keeper and fills any 10 other positions
- Reset lineup button clears all assigned slots
- Match orders are posted as form-encoded `lineup` JSON for CHPP compatibility
- Submit errors now surface CHPP response details in the match list
- Lineup pitch layout scaffold (no position labels, uniform slot sizing)
- Brand header with version number next to the title
- Drag-and-drop lineup assignment (list → field slots, slot → slot with swap)
- Placeholder for the optimizer module

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
3) After approving, CHPP redirects to the callback and you should see a JSON response with `status: "ok"`.
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

## Notes
- Match orders will only be submitted after explicit user confirmation.
- OAuth access tokens are stored in httpOnly cookies for now (replace with a real store later).
- The optimization engine is intentionally a placeholder in this scaffold.
