# Resource Calculator

A multi-page tool to calculate how many resources you're missing to reach a target — buildings, research, tomes, collections, and more routes to come.

🔗 **Live:** https://resource-calculator-sigma.vercel.app

## Routes

- **`index.html`** — Buildings & Research: Warden's Office and its 6 support buildings (Level 30 → FC8), plus each troop's FC Lab research tree (Shooter/Bomber/Shieldbearer). Resources: FC, AFC, Hyperalloy.
- **`tomes.html`** — Tomes & Collections: all 6 tomes per troop type (Level 0 → 12), and the Trove Collection sequence (Uncommon → Exotic T3). Resources: Seal of Wisdom, Seal of Knowledge, Common/Rare/Precious/Legendary Trove Coin.
- **`robots.html`** — Robots & Satellites: Prisoner Armor upgrades (Level 0 → 100, in steps of 10) for up to 12 robots (Prisoner Armor Data, Power Module, Advanced Power Module), plus each named Satellite's own progress, also in steps of 10 — R: Laser/Observer/Radiance (Level 0 → 50), SR: Arbiter/Sentinel (Level 0 → 70), SSR: Omniscient Domain/Celestial Nexus/Argus/Polaris (Level 0 → 90) — using Data Disk and Planet Coin.
- **`heroequipment.html`** — Hero Equipment: Gloves/Helmet/Jacket/Boots for each of the 3 troop types (12 pieces total). Each piece has two linked progressions shown on the same card — Level (Equipment Parts, 0 → 200, Common through Exotic T3/Master T3) and Mastery (Precision Equipment, 0 → 20). Level and Mastery are independent up to Level 100; beyond that, each promotion (Legendary T1 at 101 through Exotic T3 at 200) requires Mastery at an increasing threshold (10 through 15), resolved automatically. Resources: Equipment Parts, Magnet, Potential Coil, Precision Equipment.
- More routes planned: Hero Stars & Exclusive Equipment.

Every route works the same way: set a current level and a target level for each item, prerequisites resolve automatically, and the app totals up exactly what you're missing per resource.

## How it works

- Static HTML files, no build step, no backend, no dependencies.
- `shared.css` and `shared.js` hold the common engine (cascade calculation, EN/FR i18n, rendering) reused by every route page. Each route page only defines its own resources, game data, and translations, then calls `initApp()`.
- Game data (costs and prerequisites) is hardcoded in each page's `defaultData()`.
- Progress and stock are saved in the browser's `localStorage`, one key per route, per device/browser. Nothing is synced or shared between visitors — each person who opens the app has their own independent, local progress. Language choice is shared across routes.
- Responsive layout: same code works on desktop and mobile.
- Bump the page's `SCHEMA_VERSION` whenever you change that route's track data shape (added/removed levels, renamed fields) — mismatched saved state is discarded automatically instead of rendering broken.

## Running locally

No install needed — these are static files. Either open `index.html` directly, or serve them (recommended, avoids some browser `file://` quirks):

```bash
python3 -m http.server 8834
```

then open `http://localhost:8834`.

## Deployment

Connected to Vercel. Work happens on the `dev` branch and deploys to a private preview (`resource-calculator-dev.vercel.app`, gated behind Vercel login) — only pushes to `main` go to the public production URL that clients use.

## Known gaps

- FC Lab's own level costs aren't modeled yet (treated as already maxed).
- Per-troop-type research cost differences aren't confirmed — all three trees (Shooter/Bomber/Shieldbearer) currently share the same placeholder numbers.
- Building/research/tome names shown in French are best-effort translations, not yet verified against in-game text.
- Hero Stars & Exclusive Equipment route is not built yet.
- The R Satellite's Level 40 → 50 Data Disk cost is an estimate (~11,230), not confirmed data — see the in-app note on that route.
- Hero Equipment's Common Level 0 → 10 Equipment Parts cost is an estimate (~970), not confirmed data — see the in-app note on that route.
