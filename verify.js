#!/usr/bin/env node
// Verifies every route page in one pass: syntax, translation parity across
// every language the site defines, resource config completeness,
// requires-chain integrity, nav consistency, and known-good total costs
// (regression protection — this is exactly the kind of check that would have
// caught the Hero Equipment tier-shift bug before it shipped).
// Run with: node verify.js
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const DIR = __dirname;
const ROUTE_FILES = ["index.html", "tomes-collections.html", "robots-satellites.html", "hero-equipment.html", "hero-stars-exclusive-equipment.html"];

let failures = 0;
function fail(msg) { failures++; console.log(`  \x1b[31m✗\x1b[0m ${msg}`); }
function pass(msg) { console.log(`  \x1b[32m✓\x1b[0m ${msg}`); }

// ---------------------------------------------------------------------------
// Load a page's config script + shared.js into an isolated VM context, just
// like a real page load: page script first (defines RESOURCES, I18N,
// defaultData, ...), then shared.js (defines the engine, runs `state =
// load()` which falls back to defaultData() since localStorage is stubbed
// empty). No DOM is touched by any of this — only data/logic.
function loadPage(file) {
  const html = fs.readFileSync(path.join(DIR, file), "utf8");
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const pageScript = scripts.find((s) => s.includes("const RESOURCES"));
  if (!pageScript) throw new Error(`${file}: no script defining RESOURCES found`);

  const sandbox = {
    console,
    localStorage: { getItem: () => null, setItem: () => {} },
    navigator: { language: "en" },
  };
  vm.createContext(sandbox);
  vm.runInContext(pageScript, sandbox, { filename: file });
  const sharedSrc = fs.readFileSync(path.join(DIR, "shared.js"), "utf8");
  vm.runInContext(sharedSrc, sandbox, { filename: "shared.js" });
  // Top-level `const`/`let` in the page/shared scripts create lexical
  // bindings in this VM context, not properties on the sandbox object — so
  // pull out what we need via one more run in the *same* context, where
  // those bindings are still visible.
  const exported = vm.runInContext(
    `({ RESOURCES, RES_ACCENT, I18N, I18N_CHROME, CATEGORIES, PARTS: (typeof PARTS!=="undefined"?PARTS:null), defaultData, STORAGE_KEY, SCHEMA_VERSION, ROUTE_STORAGE_KEYS })`,
    sandbox
  );
  return exported;
}

function zeroLike(RESOURCES) {
  return Object.fromEntries(RESOURCES.map((r) => [r, 0]));
}
function sumTrack(RESOURCES, track) {
  const total = zeroLike(RESOURCES);
  track.levels.forEach((l) => RESOURCES.forEach((r) => (total[r] += l.cost[r] || 0)));
  return total;
}

// ---------------------------------------------------------------------------
// Translation checks, for however many languages the site has.
//
// The language set is whatever I18N_CHROME in shared.js declares: adding a
// language there is what brings it into existence, so everything below derives
// its list from that rather than from a copy kept in step by hand. A page that
// never gained a block for a newly added language then fails here instead of
// shipping half-translated.
//
// English is the reference the others are compared against — it's the language
// the app is authored in, and what `lang` falls back to for any browser that
// isn't French.
const REF_LANG = "en";

function languagesOf(sb) {
  return Object.keys((sb && sb.I18N_CHROME) || {}).sort();
}

function preview(list, n = 6) {
  return list.slice(0, n).join(", ") + (list.length > n ? ", …" : "");
}

// t() has no fallback chain: `key in dict ? dict[key] : (key in chrome ? ... :
// key)` ends at the key itself, so a missing translation puts the bare
// identifier ("savedHint") in front of the visitor rather than the English
// string. Parity is the only thing standing between a forgotten key and that,
// which matters most for a language nobody here can proofread by eye.
function dictParity(dict, langs) {
  const refKeys = Object.keys((dict && dict[REF_LANG]) || {}).sort();
  const issues = [];
  langs.forEach((lang) => {
    if (!dict || !dict[lang]) { issues.push(`${lang}: no block at all`); return; }
    if (lang === REF_LANG) return;
    const keys = Object.keys(dict[lang]);
    const missing = refKeys.filter((k) => !keys.includes(k));
    const extra = keys.filter((k) => !refKeys.includes(k)).sort();
    if (missing.length) issues.push(`${lang} is missing ${missing.length} key(s): ${preview(missing)}`);
    if (extra.length) issues.push(`${lang} has ${extra.length} key(s) ${REF_LANG} doesn't: ${preview(extra)}`);
  });
  return { refKeys, issues };
}

// {n}-style variables have to survive translation intact: a string that drops
// one renders a literal "{n}" where a number belongs, and one that invents a
// name nothing supplies leaves it on screen unreplaced.
function placeholderParity(dict, langs) {
  const vars = (s) => (typeof s === "string" ? (s.match(/\{\w+\}/g) || []).sort().join(",") : null);
  const issues = [];
  Object.keys((dict && dict[REF_LANG]) || {}).forEach((k) => {
    const ref = vars(dict[REF_LANG][k]);
    if (ref === null) return;
    langs.forEach((lang) => {
      if (lang === REF_LANG || !dict[lang]) return;
      const other = vars(dict[lang][k]);
      if (other !== null && other !== ref) issues.push(`${lang}.${k}`);
    });
  });
  return issues;
}

// ---------------------------------------------------------------------------
// Known-good grand totals (full climb, every track at max), confirmed either
// directly against in-game data during development or as a locked-in
// snapshot of current behavior. Update deliberately when game data changes
// — a silent diff here means a cost got corrupted, not that the app is wrong.
const EXPECTED_TOTALS = {
  "index.html": {
    fc_lab: { FC: 7050, AFC: 50 },
    warden_office: { FC: 23700, AFC: 1740 },
  },
  "robots-satellites.html": {
    equip_robot_1: { PrisonerArmorData: 141050, PowerModule: 1040, AdvancedPowerModule: 425 },
    equip_satR_1: { DataDisk: 27845, PlanetCoin: 210 },
    equip_satSR_1: { DataDisk: 72035, PlanetCoin: 830 },
    equip_satSSR_1: { DataDisk: 135040, PlanetCoin: 2140 },
  },
  "hero-equipment.html": {
    "equip_shieldbearer_gloves": { EquipmentParts: 1214040, Magnet: 7380, PotentialCoil: 300 },
    "mastery_shieldbearer_gloves": { PrecisionEquipment: 4260, Magnet: 11220 },
  },
  "hero-stars-exclusive-equipment.html": {
    herostar_1: { HeroFragment: 1075 },
    exclusiveequip_1: { ExclusiveEquipPart: 550 },
  },
};

// robots-satellites.html builds satellite ids as sat_r_laser etc, not equip_satR_1 — the
// EXPECTED_TOTALS keys above are logical aliases resolved against real track
// ids via this map, so the table above stays readable without needing every
// route's exact internal id scheme memorized.
const TRACK_ALIASES = {
  "robots-satellites.html": {
    equip_robot_1: "robot_1",
    equip_satR_1: "sat_r_laser",
    equip_satSR_1: "sat_sr_arbitre",
    equip_satSSR_1: "sat_ssr_argus",
  },
};

function resolveTrackId(file, alias) {
  const map = TRACK_ALIASES[file];
  return (map && map[alias]) || alias;
}

// ---------------------------------------------------------------------------
console.log("Resource Calculator — verify.js\n");

let sandboxes = {};
for (const file of ROUTE_FILES) {
  console.log(`\x1b[1m${file}\x1b[0m`);
  let sb;
  try {
    sb = loadPage(file);
    sandboxes[file] = sb;
    pass("loads without error");
  } catch (e) {
    fail(`failed to load: ${e.message}`);
    console.log("");
    continue;
  }

  const { RESOURCES, RES_ACCENT, I18N, CATEGORIES, defaultData } = sb;
  const PARTS = sb.PARTS; // optional

  // --- translation key parity, every language against the reference ---
  const langs = languagesOf(sb);
  const { refKeys, issues: parityIssues } = dictParity(I18N, langs);
  if (parityIssues.length) {
    parityIssues.forEach((m) => fail(`I18N ${m}`));
  } else {
    pass(`I18N parity across ${langs.join("/")} (${refKeys.length} keys each)`);
  }

  // --- placeholder ({n} etc) parity for keys shared with the reference ---
  const placeholderMismatch = placeholderParity(I18N, langs);
  if (placeholderMismatch.length) {
    fail(`{placeholder} mismatch vs ${REF_LANG}: ${placeholderMismatch.join(", ")}`);
  } else {
    pass("placeholder consistency across languages");
  }

  // --- every resource has a color and a label in every language ---
  const hexRe = /^#[0-9a-f]{6}$/i;
  let resourceIssues = [];
  RESOURCES.forEach((r) => {
    if (!RES_ACCENT || !hexRe.test(RES_ACCENT[r] || "")) resourceIssues.push(`${r}: missing/invalid RES_ACCENT`);
    langs.forEach((lang) => {
      if (!(I18N[lang] && I18N[lang][`res_${r}`])) resourceIssues.push(`${r}: missing ${lang.toUpperCase()} res_${r}`);
    });
  });
  if (resourceIssues.length) {
    resourceIssues.forEach((m) => fail(m));
  } else {
    pass(`all ${RESOURCES.length} resources have a color + a label in ${langs.length} language(s)`);
  }

  // --- CATEGORIES.part references a real PARTS entry ---
  if (PARTS) {
    const partKeys = new Set(PARTS.map((p) => p.key));
    const badParts = CATEGORIES.filter((c) => c.part && !partKeys.has(c.part));
    if (badParts.length) {
      fail(`CATEGORIES reference unknown part: ${badParts.map((c) => c.key).join(", ")}`);
    } else {
      pass(`all CATEGORIES.part values resolve to a PARTS entry`);
    }
  }

  // --- requires chains resolve to real tracks/levels ---
  const data = defaultData();
  const trackById = (id) => data.tracks.find((t) => t.id === id);
  let requiresIssues = [];
  data.tracks.forEach((t) => {
    t.levels.forEach((lvl) => {
      (lvl.requires || []).forEach((r) => {
        const other = trackById(r.trackId);
        if (!other) { requiresIssues.push(`${t.id}[${lvl.id}] requires unknown track "${r.trackId}"`); return; }
        if (!other.levels.some((l) => l.id === r.levelId)) {
          requiresIssues.push(`${t.id}[${lvl.id}] requires ${r.trackId}[${r.levelId}] — no such level`);
        }
      });
    });
  });
  if (requiresIssues.length) {
    requiresIssues.forEach((m) => fail(m));
  } else {
    pass(`requires chains resolve correctly (${data.tracks.length} default tracks)`);
  }

  // --- level 0 must be a target checkpoint ---
  // Every track starts with targetLevelIndex 0 and holds it while no goal is
  // set. "Cible" only lists levels where targetCheckpoint isn't false, so if
  // level 0 is excluded the select can't display the state it's in — and
  // adoptProgress, which snaps a non-checkpoint target to tierStartFor(), then
  // rewrites that 0 into a real goal one level up and persists it. Hero Star
  // shipped exactly that: every returning visitor was quoted 10 Hero Fragments
  // per hero for a target they never chose.
  const badZero = data.tracks.filter((t) => t.levels[0] && t.levels[0].targetCheckpoint === false);
  if (badZero.length) {
    badZero.forEach((t) => fail(`${t.id}: level 0 ("${t.levels[0].id}") is targetCheckpoint:false, so an unset target can't be displayed or cleared`));
  } else {
    pass(`every track's level 0 is selectable as a target`);
  }

  // --- known-good totals (regression check) ---
  const expected = EXPECTED_TOTALS[file];
  if (expected) {
    Object.entries(expected).forEach(([alias, expectedCost]) => {
      const realId = resolveTrackId(file, alias);
      const track = trackById(realId);
      if (!track) { fail(`expected track "${realId}" (${alias}) not found in defaultData()`); return; }
      const actual = sumTrack(RESOURCES, track);
      const mismatches = Object.entries(expectedCost).filter(([res, val]) => actual[res] !== val);
      if (mismatches.length) {
        mismatches.forEach(([res, val]) => fail(`${realId}.${res}: expected ${val}, got ${actual[res]}`));
      } else {
        pass(`${realId} total cost matches known-good snapshot`);
      }
    });
  }

  console.log("");
}

// ---------------------------------------------------------------------------
// Cross-page checks: every page's nav should offer the same routes, and
// storage keys must never collide (or one route's saved progress silently
// clobbers another's). Nav labels themselves live once in shared.js's
// I18N_CHROME (not per-page) — so consistency across pages is structural,
// but each page must still actually resolve every nav key to a real string
// (I18N page override, or falling back to I18N_CHROME) rather than silently
// rendering the bare key name.
console.log("\x1b[1mCross-page consistency\x1b[0m");

const FIRST_SB = Object.values(sandboxes)[0];
const ALL_LANGS = languagesOf(FIRST_SB);

// --- I18N_CHROME itself: key + {placeholder} parity across every language ---
{
  const chrome = FIRST_SB && FIRST_SB.I18N_CHROME;
  if (chrome) {
    const { refKeys, issues } = dictParity(chrome, ALL_LANGS);
    if (issues.length) {
      issues.forEach((m) => fail(`I18N_CHROME ${m}`));
    } else {
      pass(`I18N_CHROME parity across ${ALL_LANGS.join("/")} (${refKeys.length} keys each)`);
    }
    const placeholderMismatch = placeholderParity(chrome, ALL_LANGS);
    if (placeholderMismatch.length) {
      fail(`I18N_CHROME {placeholder} mismatch vs ${REF_LANG}: ${placeholderMismatch.join(", ")}`);
    } else {
      pass("I18N_CHROME placeholder consistency across languages");
    }
  }
}

const NAV_KEYS = ["navBuildings", "navTomes", "navRobots", "navHeroEquipment", "navHeroStars"];
let chromeMissing = [];
NAV_KEYS.forEach((k) => {
  ALL_LANGS.forEach((lang) => {
    if (FIRST_SB && FIRST_SB.I18N_CHROME && !(k in (FIRST_SB.I18N_CHROME[lang] || {}))) chromeMissing.push(`${lang}.${k}`);
  });
});
if (chromeMissing.length) {
  fail(`I18N_CHROME missing nav keys: ${chromeMissing.join(", ")}`);
} else {
  pass(`I18N_CHROME defines all ${NAV_KEYS.length} nav keys in ${ALL_LANGS.length} language(s)`);
}

let navResolveIssues = [];
ROUTE_FILES.forEach((f) => {
  const sb = sandboxes[f];
  if (!sb) return;
  NAV_KEYS.forEach((k) => {
    ALL_LANGS.forEach((lang) => {
      const resolved = (sb.I18N[lang] && sb.I18N[lang][k]) || (sb.I18N_CHROME[lang] && sb.I18N_CHROME[lang][k]);
      if (!resolved) navResolveIssues.push(`${f}: ${lang}.${k} does not resolve to any value`);
    });
  });
});
if (navResolveIssues.length) {
  navResolveIssues.forEach((m) => fail(m));
} else {
  pass(`every page resolves all ${NAV_KEYS.length} nav keys in every language`);
}

// A language exists in I18N_CHROME, but the only way a visitor can *reach* it
// is the EN/FR pair of <button data-lang> in each page's static HTML. Those
// buttons are the one part of the language set that isn't derived from
// shared.js, so adding a translation without adding its button would ship a
// language nobody can select — invisible, and nothing at runtime would say so.
const langBtnIssues = [];
ROUTE_FILES.forEach((f) => {
  const html = fs.readFileSync(path.join(DIR, f), "utf8");
  const offered = [...html.matchAll(/data-lang="([a-z-]+)"/g)].map((m) => m[1]).sort();
  const missing = ALL_LANGS.filter((l) => !offered.includes(l));
  const unknown = offered.filter((l) => !ALL_LANGS.includes(l));
  if (missing.length) langBtnIssues.push(`${f} has no language button for: ${missing.join(", ")}`);
  if (unknown.length) langBtnIssues.push(`${f} offers a button for "${unknown.join(", ")}", which I18N_CHROME doesn't define`);
});
if (langBtnIssues.length) langBtnIssues.forEach((m) => fail(m));
else pass(`every route offers a language button for all ${ALL_LANGS.length} language(s)`);

const storageKeys = ROUTE_FILES.map((f) => sandboxes[f] && sandboxes[f].STORAGE_KEY).filter(Boolean);
const uniqueStorageKeys = new Set(storageKeys);
if (uniqueStorageKeys.size !== storageKeys.length) {
  fail(`duplicate STORAGE_KEY across routes: ${storageKeys.join(", ")}`);
} else {
  pass(`all ${storageKeys.length} routes have a unique STORAGE_KEY`);
}

// Every route has to request the same ?v= for each shared asset. A bump that
// missed one page leaves that route pinned to whatever shared.js its visitors
// already have cached, while the other four look perfectly fine — silent, and
// exactly the stale-cache complaint the convention exists to prevent.
const SHARED_ASSETS = ["shared.js", "shared.css", "theme-tactical.css"];
const assetIssues = [];
SHARED_ASSETS.forEach((asset) => {
  const pattern = new RegExp(asset.replace(/\./g, "\\.") + "\\?v=(\\d+)");
  const byVersion = {};
  ROUTE_FILES.forEach((f) => {
    const match = fs.readFileSync(path.join(DIR, f), "utf8").match(pattern);
    if (!match) {
      assetIssues.push(`${f} loads ${asset} without a ?v= cache-busting version`);
      return;
    }
    (byVersion[match[1]] = byVersion[match[1]] || []).push(f);
  });
  const versions = Object.keys(byVersion);
  if (versions.length > 1) {
    const detail = versions.map((v) => `v=${v} (${byVersion[v].join(", ")})`).join(" vs ");
    assetIssues.push(`${asset} is requested at different versions across routes: ${detail}`);
  }
});
if (assetIssues.length) assetIssues.forEach((m) => fail(m));
else pass(`all 5 routes request each shared asset at the same ?v= version`);

// The nav's "unfinished target" dot needs shared.js to know every route's
// storage key. Nothing at runtime would complain if one drifted — the dot
// would just silently never light up for that page — so pin it here.
const navMap = (sandboxes[ROUTE_FILES[0]] || {}).ROUTE_STORAGE_KEYS || {};
const navMapIssues = [];
ROUTE_FILES.forEach((f) => {
  const real = sandboxes[f] && sandboxes[f].STORAGE_KEY;
  if (!real) return;
  if (!(f in navMap)) navMapIssues.push(`${f} is missing from ROUTE_STORAGE_KEYS in shared.js`);
  else if (navMap[f] !== real) navMapIssues.push(`ROUTE_STORAGE_KEYS["${f}"] is "${navMap[f]}" but the route uses "${real}"`);
});
Object.keys(navMap).forEach((f) => {
  if (!ROUTE_FILES.includes(f)) navMapIssues.push(`ROUTE_STORAGE_KEYS has "${f}", which is not a route`);
});
if (navMapIssues.length) navMapIssues.forEach((m) => fail(m));
else pass("ROUTE_STORAGE_KEYS matches every route's real STORAGE_KEY");

console.log("");
if (failures) {
  console.log(`\x1b[31m${failures} check(s) failed.\x1b[0m`);
  process.exit(1);
} else {
  console.log("\x1b[32mAll checks passed.\x1b[0m");
  process.exit(0);
}
