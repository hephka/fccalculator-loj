# Resource Calculator

A multi-page tool to calculate how many resources you're missing to reach a target — buildings, research, tomes, collections, and more routes to come.

🔗 **Live:** https://resource-calculator-sigma.vercel.app

## Routes

- **`index.html`** — Buildings & Research: Warden's Office and its 6 support buildings (Level 30 → FC8), the FC Lab building itself (Level 1 → 6, gated by Warden's Office), plus each troop's T11 research tree (Shooter/Bomber/Shieldbearer) — gated by a mix of internal prerequisites and FC Lab's own level. Resources: FC, AFC, Hyperalloy.
- **`tomes-collections.html`** — Tomes & Collections: all 6 tomes per troop type (Level 0 → 12), and the Trove Collection sequence (Uncommon → Exotic T3). Resources: Seal of Wisdom, Seal of Knowledge, Common/Rare/Precious/Legendary Trove Coin.
- **`robots-satellites.html`** — Robots & Satellites: Prisoner Armor upgrades (Level 0 → 100, in steps of 10) for up to 12 robots (Prisoner Armor Data, Power Module, Advanced Power Module), plus each named Satellite's own progress, also in steps of 10 — R: Laser/Observer/Radiance (Level 0 → 50), SR: Arbiter/Sentinel (Level 0 → 70), SSR: Omniscient Domain/Celestial Nexus/Argus/Polaris (Level 0 → 90) — using Data Disk and Planet Coin.
- **`hero-equipment.html`** — Hero Equipment: Gloves/Helm/Outerwear/Boots for each of the 3 troop types (12 pieces total). Each piece has two linked progressions shown on the same card — Rarity (Equipment EXP, Common through Exotic T3 — Common itself is free, each tier's cost is what it takes to reach the next one) and Mastery (Precision Equipment, Level 0 → 20). Rarity and Mastery are independent through Legendary; beyond that, each promotion (Legendary T1 through Exotic T3) requires Mastery at an increasing threshold (10 through 15), resolved automatically. Resources: Equipment EXP, Magnet, Potential Coil, Precision Equipment.
- **`hero-stars-exclusive-equipment.html`** — Hero Stars & Exclusive Equipment: up to 6 heroes independently on each side — a Star-progress track (recruit for 10 Hero Fragments at 0 stars, then 5 stars costing 10/40/115/300/600 Fragments — 1,075 total to max) and an Exclusive Equipment track (Level 0 → 10, 550 Exclusive Equipment Pieces total). "Actuel" breaks each star down palier by palier; "Cible" only offers whole completed stars.

Every route works the same way: set a current level and a target level for each item, prerequisites resolve automatically, and the app totals up exactly what you're missing per resource.

## How it works

- Static HTML files, no build step, no backend, no dependencies.
- `shared.css` and `shared.js` hold the common engine (cascade calculation, EN/FR i18n, rendering) reused by every route page. Each route page only defines its own resources, game data, and translations, then calls `initApp()`.
- Game data (costs and prerequisites) is hardcoded in each page's `defaultData()`.
- Progress and stock are saved in the browser's `localStorage`, one key per route, per device/browser. Nothing is synced or shared between visitors — each person who opens the app has their own independent, local progress. Language choice is shared across routes.
- Responsive layout: same code works on desktop and mobile.
- Bump the page's `SCHEMA_VERSION` whenever you change that route's track data shape (added/removed levels, renamed fields) — mismatched saved state is discarded automatically instead of rendering broken.

## Verifying

`node verify.js` checks every route in one pass: syntax, EN/FR translation parity (keys and `{placeholder}` variables), that every resource has a color and a label in both languages, that every `requires` reference resolves to a real track/level, nav consistency across pages, unique `STORAGE_KEY`s, and known-good total costs for the routes with a confirmed source (regression protection — a silently wrong number in `defaultData()` fails the run instead of shipping). No dependencies; run it before pushing whenever route data changes.

## Running locally

No install needed — these are static files. Either open `index.html` directly, or serve them (recommended, avoids some browser `file://` quirks):

```bash
python3 -m http.server 8834
```

then open `http://localhost:8834`.

## Deployment

Connected to Vercel. Work happens on the `dev` branch and deploys to a private preview (`resource-calculator-dev.vercel.app`, gated behind Vercel login) — only pushes to `main` go to the public production URL that clients use.

## Known gaps

- FC Lab is modeled through Level 6 (confirmed source data); Levels 7-8 aren't modeled yet.
- FC9 and FC10 (Warden's Office) aren't modeled yet.
- The R Satellite's Level 40 → 50 Data Disk cost is an estimate (~11,230), not confirmed data — see the in-app note on that route.
- Part of Hero Equipment's Uncommon step cost (~970 of its 2,620 total Equipment EXP, inherited from the untracked Common Level 0→10 range) is an estimate, not confirmed data — see the in-app note on that route.
