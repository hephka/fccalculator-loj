# Resource Calculator

A multi-page tool to calculate how many resources you're missing to reach a target — buildings, research, tomes, collections, and more routes to come.

🔗 **Live:** https://www.lojcalc.com

## Routes

- **`index.html`** — Buildings & Research: Warden's Office and 5 of its 6 support buildings (Level 30 → FC10 — Medical Station stops at FC8, not confirmed past that), the FC Lab building itself (not built → FC1 → FC6, each tier gated by Warden's Office reaching the same FC tier), plus each troop's T11 research tree (Shooter/Bomber/Shieldbearer) — gated by a mix of internal prerequisites and FC Lab's own tier. Warden's Office and FC Lab sit flat and always visible; the 6 support buildings fold into one collapsible "Support buildings" group, since the prerequisite cascade already works out how far each has to climb. Paliers are offered as a current level only — a target is always a whole FC tier. Buildings carry `paliersBar`, which splits their "Actuel" into an 11-entry tier select plus a 5-segment bar for the position inside that tier, mirroring the bar the game draws between two FC levels: the last segment lands on the next tier, and tapping the segment already reached steps back one. Tracks whose sub-levels are goals in their own right (a Collection's stars) keep the plain select. Resources: FC, AFC, Hyperalloy.
- **`tomes-collections.html`** — Tomes & Collections: all 6 tomes per troop type (Level 0 → 12), and the Trove Collection sequence (Uncommon → Exotic T3). Resources: Seal of Wisdom, Seal of Knowledge, Common/Rare/Precious/Legendary Trove Coin.
- **`robots-satellites.html`** — Robots & Satellites: Prisoner Armor upgrades (Level 1 → 100, in steps of 10) for up to 12 robots (Prisoner Armor Data, Power Module, Advanced Power Module), plus each named Satellite's own progress, also in steps of 10 — R: Laser/Observer/Radiance (Level 1 → 50), SR: Arbiter/Sentinel (Level 1 → 70), SSR: Omniscient Domain/Celestial Nexus/Argus/Polaris (Level 1 → 90) — using Data Disk and Planet Coin. Level 1 is the baseline (Level 0 is reserved for a future robot-discovery/unlock mechanic, not yet modeled).
- **`hero-equipment.html`** — Hero Equipment: Gloves/Helm/Outerwear/Boots for each of the 3 troop types (12 pieces total). Each piece has two linked progressions shown on the same card — Rarity (Equipment EXP, Common through Exotic T3 — Common itself is free, each tier's cost is what it takes to reach the next one) and Mastery (Precision Equipment, Level 0 → 20). Rarity and Mastery are independent through Legendary; beyond that, each promotion (Legendary T1 through Exotic T3) requires Mastery at an increasing threshold (10 through 15), resolved automatically. Each rarity is split into two levels, so a piece can sit between them: a "· levels maxed" step carrying the Equipment EXP spent levelling inside that rarity, then the promotion itself carrying only Magnet/Potential Coil. That way a piece whose levels are already maxed is quoted the promotion alone instead of EXP it has already spent. Only whole rarities are offered as targets. Resources: Equipment EXP, Magnet, Potential Coil, Precision Equipment.
- **`hero-stars-exclusive-equipment.html`** — Hero Stars & Exclusive Equipment: up to 6 heroes independently on each side — a Star-progress track (recruit for 10 Hero Fragments at 0 stars, then 5 stars costing 10/40/115/300/600 Fragments — 1,075 total to max) and an Exclusive Equipment track (Level 0 → 10, 550 Exclusive Equipment Pieces total). "Actuel" breaks each star down palier by palier; "Cible" only offers whole completed stars.

Every route works the same way: set a current level and a target level for each item, prerequisites resolve automatically, and the app totals up exactly what you're missing per resource.

## How it works

- Static HTML files, no build step, no backend, no dependencies.
- `shared.css` and `shared.js` hold the common engine (cascade calculation, EN/FR i18n, rendering) reused by every route page. Each route page only defines its own resources, game data, and translations, then calls `initApp()`.
- Game data (costs and prerequisites) is hardcoded in each page's `defaultData()`.
- `REPORT_URLS` and `DONATE_URL` at the top of `shared.js` add a "report a wrong number" and a "buy me a coffee" link under the footer's data-freshness line. Each renders only when its URL is filled in, so the site can't ship a dead one. Plain links to an external form or donation page, never an embedded widget: an embed would put a third-party script into a site that carries none and drag a cookie banner along with it. `REPORT_URLS` is keyed by site language, since Tally can neither translate a form nor offer the visitor a language switch — there's one Tally form per language, matching the language the app is being read in, and `setLang` re-renders the footer so the link swaps with it. A language with no entry falls back to English rather than sending someone to a form they can't read. Neither form asks for an email, which is what keeps this a plain link with no consent banner behind it.
- Setting a track's current level settles prerequisites in both directions: anything it now demands is raised (`propagateImpliedCurrent`), and anything that can no longer stand where it is comes down (`clampDependentsDown`). Lowering only ever raised before, so a support building left above the Warden's Office shoved it straight back up and the change looked like it did nothing. A level above what its prerequisite allows isn't a state the game can produce, so the track the user just set wins and the rest follows; the card names what it moved, since the support group is usually collapsed.
- A nav link carries a dot when that route still has an unfinished target, so the page you're on can tell you work is waiting on another one. `shared.js` reads the other routes' saved state directly (same origin) via `ROUTE_STORAGE_KEYS`; `verify.js` pins that map against each route's real `STORAGE_KEY`, since a drift would silently stop the dot ever lighting up.
- Progress and stock are saved in the browser's `localStorage`, one key per route, per device/browser. Nothing is synced or shared between visitors — each person who opens the app has their own independent, local progress. Language choice is shared across routes.
- Responsive layout: same code works on desktop and mobile.
- Right-to-left ready, though no RTL language ships yet. `RTL_LANGS` in `shared.js` decides which languages are right-to-left, and `applyDocumentLang` sets `dir` on `<html>` from it; the stylesheet keys off `dir`, not off the language. The layout uses logical properties (`margin-inline-*`, `border-inline-start`, `text-align:start`, `inset-inline-*`) so it flips on its own, and `verify.js` fails on any physical `left`/`right` that creeps back in — that's a mistake nobody can catch by reading a page in a script they don't know. Only what has direction in its geometry rather than in a box edge needs a `[dir="rtl"]` rule: the paliers' slant, and the `▸` carets, which bidi doesn't mirror. The two nav fades stay on fixed physical edges; which one shows inverts in `initNavFade`.
- The "What this does" card opens on a visitor's first visit to a route and folds away on later ones, remembering an explicit reopen. It's stored per route under its own `<STORAGE_KEY>-intro-open` key, deliberately outside the page state, so a `SCHEMA_VERSION` bump or a reset never re-onboards anyone. The ⚠ note under it is reference material rather than onboarding (untracked resources, estimated values, gameplay caveats), so it sits outside the collapsible part and is always visible.
- Bump the page's `SCHEMA_VERSION` whenever you change that route's track data shape (added/removed levels, renamed fields) — mismatched saved state is discarded automatically instead of rendering broken.
- Once a route has something in its breakdown, a one-time line under it says progress is kept on this device (and only this one). It appears at the moment there's something worth keeping rather than on arrival, and dismissing it silences it across every route via a single site-wide key, since the sentence is the same everywhere.
- A saved state holds only progress: stock, dynamic item counts, and each track's current/target index by id. `load()` rebuilds everything else from the page's `defaultData()`, so the file is the single source of truth for costs, levels and prerequisites — a corrected number reaches everyone on their next load, and a track you add or remove appears or disappears without a version bump. `SCHEMA_VERSION` still matters when level indices shift, since that's what the saved indices point at.
- `shared.js`, `shared.css`, and `theme-tactical.css` are loaded with a `?v=1` query string on all 5 pages. Bump that number (on every page, for the file(s) you touched) whenever you change one of them — some browsers cache these past what Vercel's headers intend, and a version bump forces every visitor's next load to fetch the new file instead of an old cached copy.
- Visual identity: a dark "Tactical Telemetry" terminal theme (`theme-tactical.css`, loaded after `shared.css` on every route) — IBM Plex Mono, a single hazard-red accent, hard 90° corners, ASCII-bracket card headers, CRT scanline and blueprint-grid textures. Color/radius variables live in `shared.css`'s `:root`; `theme-tactical.css` holds everything that isn't a plain variable swap.
- Each resource has its own hand-drawn SVG icon, defined once in `shared.css` as a `mask-image` and applied via `data-res="<resourceKey>"` attributes set in `shared.js` — icons render in `currentColor`, so they automatically pick up that resource's existing accent color.

## Verifying

`node verify.js` checks every route in one pass: syntax, translation parity (keys and `{placeholder}` variables), that every resource has a color and a label, that every `requires` reference resolves to a real track/level, nav consistency across pages, unique `STORAGE_KEY`s, and known-good total costs for the routes with a confirmed source (regression protection — a silently wrong number in `defaultData()` fails the run instead of shipping). No dependencies; run it before pushing whenever route data changes.

The translation checks are language-agnostic: the set of languages is read from `I18N_CHROME` in `shared.js`, so declaring a new one there is what brings it into existence and every page is then required to have a block for it, a `res_<Resource>` label for each resource, the nav keys, and a `<button data-lang>` in its static HTML. English is the reference the others are compared against. This matters more than it looks: `t()` has no fallback chain, so a key missing in the active language puts the bare identifier (`savedHint`) in front of the visitor rather than the English string — and for a language nobody here can proofread by eye, this script is the only thing that catches it.

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
- The R Satellite's Level 40 → 50 Data Disk cost is an estimate (~11,230), not confirmed data — see the in-app note on that route.
- Part of Hero Equipment's "Common · levels maxed" step cost (~970 of its 2,620 total Equipment EXP, inherited from the untracked Common Level 0→10 range) is an estimate, not confirmed data — see the in-app note on that route.
