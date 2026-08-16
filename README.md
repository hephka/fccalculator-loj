# Resource Calculator

A single-page tool to calculate how many **FC**, **AFC**, and **Hyperalloy** you're missing to reach a building or research target.

🔗 **Live:** https://resource-calculator-sigma.vercel.app

## What it does

- Track your current level and set a target level for each building (Warden Office and its 6 support buildings) and each troop research tree (Shooter, Bomber, Shieldbearer).
- Enter your current resource stock (FC / AFC / Hyperalloy).
- The app automatically resolves prerequisites — e.g. targeting Warden Office F8 pulls in the support buildings it requires, targeting a troop's T11 unlock pulls in maxing Rally Troop Capacity and every other stat it depends on — and adds up the total cost.
- Shows exactly what's missing per resource, with a full breakdown of every objective contributing to the total.
- Available in English and French, switchable in the UI.
- **Scope right now:** only Warden Office progression **from FC5 to FC8** is modeled. **Food, Wood, Steel, and Gold Card** are not tracked — only FC, AFC, and Hyperalloy.

## How it works

- Single static `index.html` file — no build step, no backend, no dependencies.
- All game data (building/research costs and prerequisites) is hardcoded in `defaultData()`.
- Your progress and stock are saved in the browser's `localStorage`, per device/browser. Nothing is synced or shared between visitors — each person who opens the app has their own independent, local progress.
- Responsive layout: same code works on desktop and mobile.

## Running locally

No install needed — it's a static file. Either:

```bash
open index.html
```

or serve it (recommended, avoids some browser file:// quirks):

```bash
python3 -m http.server 8834
```

then open `http://localhost:8834`.

## Deployment

Connected to Vercel: every push to `main` auto-deploys to production.

## Known gaps

- FC Lab's own level costs aren't modeled yet (treated as already maxed).
- Building levels before F5 aren't in the data yet.
- Per-troop-type cost differences aren't confirmed — all three trees (Shooter/Bomber/Shieldbearer) currently share the same placeholder numbers.
