# Youth Alchemy

Youth Alchemy is a CHPP-approved web app that recommends a weekly two-training plan and a match lineup for your Hattrick youth squad. If you select a priority player, the recommendation weights that player more heavily while still maximizing total expected squad training.

## Features (scaffold)
- Next.js + TypeScript single-app setup (UI + API routes)
- CHPP OAuth endpoints for request token + callback handling
- CHPP youthplayerlist endpoint (XML parsed to JSON)
- CHPP youthplayerdetails endpoint (XML parsed to JSON)
- CHPP matches endpoint (youth by default)
- Basic UI to display connected youth players, with click-to-load player details
- In-session details cache with manual refresh and a structured details panel (current/max skill bars)
- Upcoming youth match list (handles team-level match list; falls back to recent matches if none UPCOMING)
- Lineup pitch layout scaffold (KP / WB CD CD CD WB / W IM IM IM W / F F F, uniform slot sizing)
- Brand logo header with version number
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

## Troubleshooting OAuth
- Check env presence (no secrets returned): `http://localhost:3000/api/chpp/oauth/debug`
- If you rotate secrets, restart the dev server.
- Include debug payload (no secrets): `http://localhost:3000/api/chpp/oauth/start?debug=1`

## Testing
- Lint: `npm run lint`
- Build: `npm run build`

## Notes
- Match orders will only be submitted after explicit user confirmation.
- OAuth access tokens are stored in httpOnly cookies for now (replace with a real store later).
- The optimization engine is intentionally a placeholder in this scaffold.
