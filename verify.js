#!/usr/bin/env node
// Verifies every route page in one pass: syntax, EN/FR translation parity,
// resource config completeness, requires-chain integrity, nav consistency,
// and known-good total costs (regression protection — this is exactly the
// kind of check that would have caught the Hero Equipment tier-shift bug
// before it shipped). Run with: node verify.js
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
    `({ RESOURCES, RES_ACCENT, I18N, I18N_CHROME, CATEGORIES, PARTS: (typeof PARTS!=="undefined"?PARTS:null), defaultData, STORAGE_KEY, SCHEMA_VERSION })`,
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

  // --- EN/FR key parity ---
  const enKeys = Object.keys(I18N.en).sort();
  const frKeys = Object.keys(I18N.fr).sort();
  const onlyEn = enKeys.filter((k) => !frKeys.includes(k));
  const onlyFr = frKeys.filter((k) => !enKeys.includes(k));
  if (onlyEn.length || onlyFr.length) {
    fail(`I18N key mismatch — only in EN: ${JSON.stringify(onlyEn)}, only in FR: ${JSON.stringify(onlyFr)}`);
  } else {
    pass(`I18N EN/FR parity (${enKeys.length} keys each)`);
  }

  // --- placeholder ({n} etc) parity between EN and FR for shared keys ---
  let placeholderMismatch = [];
  enKeys.forEach((k) => {
    if (!I18N.fr[k] || typeof I18N.en[k] !== "string") return;
    const varsEn = (I18N.en[k].match(/\{\w+\}/g) || []).sort().join(",");
    const varsFr = (I18N.fr[k].match(/\{\w+\}/g) || []).sort().join(",");
    if (varsEn !== varsFr) placeholderMismatch.push(k);
  });
  if (placeholderMismatch.length) {
    fail(`{placeholder} mismatch between EN/FR: ${placeholderMismatch.join(", ")}`);
  } else {
    pass("EN/FR placeholder consistency");
  }

  // --- every resource has a color and a label in both languages ---
  const hexRe = /^#[0-9a-f]{6}$/i;
  let resourceIssues = [];
  RESOURCES.forEach((r) => {
    if (!RES_ACCENT || !hexRe.test(RES_ACCENT[r] || "")) resourceIssues.push(`${r}: missing/invalid RES_ACCENT`);
    if (!I18N.en[`res_${r}`]) resourceIssues.push(`${r}: missing EN res_${r}`);
    if (!I18N.fr[`res_${r}`]) resourceIssues.push(`${r}: missing FR res_${r}`);
  });
  if (resourceIssues.length) {
    resourceIssues.forEach((m) => fail(m));
  } else {
    pass(`all ${RESOURCES.length} resources have a color + EN/FR label`);
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

// --- I18N_CHROME itself: EN/FR key + {placeholder} parity ---
{
  const sb = Object.values(sandboxes)[0];
  const chrome = sb && sb.I18N_CHROME;
  if (chrome) {
    const enKeys = Object.keys(chrome.en).sort();
    const frKeys = Object.keys(chrome.fr).sort();
    const onlyEn = enKeys.filter((k) => !frKeys.includes(k));
    const onlyFr = frKeys.filter((k) => !enKeys.includes(k));
    if (onlyEn.length || onlyFr.length) {
      fail(`I18N_CHROME key mismatch — only in EN: ${JSON.stringify(onlyEn)}, only in FR: ${JSON.stringify(onlyFr)}`);
    } else {
      pass(`I18N_CHROME EN/FR parity (${enKeys.length} keys each)`);
    }
    const placeholderMismatch = enKeys.filter((k) => {
      if (!chrome.fr[k] || typeof chrome.en[k] !== "string") return false;
      const varsEn = (chrome.en[k].match(/\{\w+\}/g) || []).sort().join(",");
      const varsFr = (chrome.fr[k].match(/\{\w+\}/g) || []).sort().join(",");
      return varsEn !== varsFr;
    });
    if (placeholderMismatch.length) {
      fail(`I18N_CHROME {placeholder} mismatch between EN/FR: ${placeholderMismatch.join(", ")}`);
    } else {
      pass("I18N_CHROME EN/FR placeholder consistency");
    }
  }
}

const NAV_KEYS = ["navBuildings", "navTomes", "navRobots", "navHeroEquipment", "navHeroStars"];
let chromeMissing = [];
NAV_KEYS.forEach((k) => {
  ["en", "fr"].forEach((lang) => {
    const sb = Object.values(sandboxes)[0];
    if (sb && sb.I18N_CHROME && !(k in sb.I18N_CHROME[lang])) chromeMissing.push(`${lang}.${k}`);
  });
});
if (chromeMissing.length) {
  fail(`I18N_CHROME missing nav keys: ${chromeMissing.join(", ")}`);
} else {
  pass("I18N_CHROME defines all 5 nav keys in both languages");
}

let navResolveIssues = [];
ROUTE_FILES.forEach((f) => {
  const sb = sandboxes[f];
  if (!sb) return;
  NAV_KEYS.forEach((k) => {
    ["en", "fr"].forEach((lang) => {
      const resolved = (sb.I18N[lang] && sb.I18N[lang][k]) || (sb.I18N_CHROME[lang] && sb.I18N_CHROME[lang][k]);
      if (!resolved) navResolveIssues.push(`${f}: ${lang}.${k} does not resolve to any value`);
    });
  });
});
if (navResolveIssues.length) {
  navResolveIssues.forEach((m) => fail(m));
} else {
  pass("every page resolves all 5 nav keys in both languages");
}

const storageKeys = ROUTE_FILES.map((f) => sandboxes[f] && sandboxes[f].STORAGE_KEY).filter(Boolean);
const uniqueStorageKeys = new Set(storageKeys);
if (uniqueStorageKeys.size !== storageKeys.length) {
  fail(`duplicate STORAGE_KEY across routes: ${storageKeys.join(", ")}`);
} else {
  pass(`all ${storageKeys.length} routes have a unique STORAGE_KEY`);
}

console.log("");
if (failures) {
  console.log(`\x1b[31m${failures} check(s) failed.\x1b[0m`);
  process.exit(1);
} else {
  console.log("\x1b[32mAll checks passed.\x1b[0m");
  process.exit(0);
}
