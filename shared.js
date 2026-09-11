// Shared engine used by every route page (index.html, tomes-collections.html, ...).
//
// Cache-busting: every route loads this file (and shared.css, theme-tactical.css)
// as `shared.js?v=1` etc. Vercel already sends max-age=0/must-revalidate, but
// some browsers (Safari especially) still hang on to a stale copy regardless.
// A `?v=N` query string is a different URL as far as the browser cache is
// concerned, so bumping N guarantees every visitor gets the new file on their
// very next load — no waiting on cache behavior we don't control. Whenever
// you change shared.js, shared.css, or theme-tactical.css, bump `?v=N` for
// that file in all 5 HTML pages (same pattern as SCHEMA_VERSION below, just
// for delivery instead of saved state).
//
// Each page must define, before loading this file:
//   RESOURCES     - array of resource keys, e.g. ["FC","AFC","Hyperalloy"]
//   RES_ACCENT    - {key: "#hexcolor"} per resource
//   STORAGE_KEY   - localStorage key for this route's progress (must be unique per route)
//   SCHEMA_VERSION- bump whenever this route's track data shape changes
//   I18N          - {en:{...}, fr:{...}} translation dictionaries (route-specific keys +
//                   the shared chrome keys listed below)
//   CATEGORIES    - [{key, labelKey, icon, grouped, dynamic, part, badge}] in display order.
//                   grouped:true folds tracks sharing a track.groupKey into a
//                   collapsible group (named by track.groupLabelKey); tracks
//                   without a groupKey stay flat and always visible.
//                   dynamic:{addLabelKey, makeTrack(index), max} starts with
//                   a default item and adds one more item per button press.
//                   Dynamic tracks need a numeric track.qtyIndex for ordering.
//                   part:"partKey" groups this category under a PARTS entry
//                   (see below) instead of rendering its own top-level title.
//                   badge:"#hexcolor" (optional, only meaningful with `part`)
//                   renders a compact colored pill instead of a title — for
//                   a handful of same-shape variants under one part (e.g. R/
//                   SR/SSR rarities under a "Satellites" part).
//   PARTS         - optional [{key, labelKey, icon}]. Groups CATEGORIES that
//                   share a `part` key under one bigger section header, for
//                   routes with multiple distinct areas (e.g. "Robots" vs
//                   "Satellites"). Omit entirely for routes with only one
//                   flat list of categories — they render exactly as before.
//   GROUP_ICONS   - {groupKey: "emoji"} used for each group of a grouped category
//   defaultData() - returns {schemaVersion, stock, counts, tracks}. `counts` is
//                   only needed if the page has any dynamic categories.
//   migrateState()- optional. Converts a saved state from an older
//                   SCHEMA_VERSION into the current shape, or returns null to
//                   let it be discarded (see load()).
//
// Per-track optional flags:
//   romanLevels: true         - numeric levelStyle renders as roman numerals (Level VII)
//   pairedTrackId + pairedLabelKey - shows a second track's own current/target
//                                controls in the same card (see trackHtml).
//                                The paired track needs no CATEGORIES entry
//                                of its own — it still lives in state.tracks
//                                and participates in cascade/breakdown.
//   level.targetCheckpoint:false - hides this level from the "Cible" select
//                                (still selectable in "Actuel") — for fine
//                                intermediate levels that only matter when
//                                setting real, already-in-progress state.
//   level.labelSuffixKey       - on a "_s<N>" sub-level, replaces the default
//                                "· palier N" suffix with t(key), for chains
//                                where the sub-level isn't one of several
//                                numbered stages (see Hero Equipment).
//   accent: "#hexcolor" or "var(--token)" - colors this track's card left
//                                border + name, to flag one specific track
//                                among many in the same category (e.g. the
//                                main building, or a research line's end goal)
//                                without giving it its own CATEGORIES entry.
//   paliersBar: true           - splits "Actuel" into a tier select plus a
//                                segmented bar for the position inside that
//                                tier. For tracks whose sub-levels are
//                                fractional progress toward the next tier
//                                (a building's paliers), not goals of their
//                                own (a Collection's stars).
//   newBadge: true             - shows a small "New" pill next to the track
//                                name, for calling out recently-added game
//                                data. Meant to be temporary — remove the
//                                flag once regular visitors have had time to
//                                notice, rather than leaving it forever.
//
// Shared chrome i18n keys every page's I18N must provide:
//   title, appBrand, pageTitle, subtitle, introTitle, introLead, introFeature1/2, introNote,
//   resetButton, resetConfirm, currentStock, whatMissing, needed, missing,
//   okSurplus, noTargetHint, colTarget, colFrom, colTo, autoAdded,
//   targetSet, noTarget, autoRequired, groupNoTargets, groupTargetsSet,
//   groupAutoRequired, savedHint, savedHintDismiss, loweredNote,
//   reportError, donate, current, target,
//   stageWord, levelWord, footer, navHome ... (nav labels as needed),
//   plus a res_<KEY> entry for every entry in RESOURCES.
//
// title      - browser tab title (route name + " - Lands of Jail"), also used as document.title
// appBrand   - the app-wide brand line shown above the h1 on every page, identical
//              text across all routes ("Resource Calculator - Lands of Jail")
// pageTitle  - this route's own name shown in the h1 (e.g. "Robots & Satellites"),
//              without the "- Lands of Jail" suffix

// Chrome text that's word-for-word identical across every route (nav links,
// generic buttons, table headers, ...) lives here once instead of being
// retyped in each page's own I18N block. A page's I18N always wins when a
// key exists in both (see t() below), so a route can still override any of
// these — e.g. Tomes overrides noTargetHint with wording specific to tomes.
const I18N_CHROME = {
  en: {
    navBuildings: "FC Buildings & T11 Research", navTomes: "Tomes & Collections", navRobots: "Robots & Satellites",
    navHeroEquipment: "Hero Equipment", navHeroStars: "Hero Stars & Exclusive Equipment",
    appBrand: "Resource Calculator - Lands of Jail",
    introTitle: "What this does",
    resetButton: "↺ Reset to default values", resetConfirm: "Click again to confirm ↺",
    currentStock: "Current stock", whatMissing: "What you're missing",
    needed: "needed", missing: "Missing", okSurplus: "OK (surplus {n})",
    colTarget: "Target", colFrom: "From", colTo: "To", colCost: "Cost",
    autoAdded: "(auto-added — prerequisite)",
    targetSet: "target set", noTarget: "no target",
    autoRequired: "required", groupAutoRequired: "{n} required",
    savedHint: "Your levels and targets stay saved on this device — close the page and come back to them as you left them. They don't follow you to another device or browser.",
    savedHintDismiss: "Got it, hide this",
    loweredNote: "↓ Brought down with it, they can't sit above it: {names}",
    reportError: "Report a wrong number", donate: "Buy me a coffee",
    current: "Current", target: "Target",
    stageWord: "stage", levelWord: "Level",
    footer: "Data is stored only in your browser (localStorage).",
    dataUpdated: "Data last updated: {date}",
    unofficialNote: "Unofficial fan tool, not affiliated with or endorsed by the game's developer or publisher.",
    estimatedNote: "Includes an estimated value, not yet confirmed — see the note above.",
    newBadge: "New",
  },
  fr: {
    navBuildings: "Bâtiments FC & Recherches T11", navTomes: "Tomes & Collections", navRobots: "Robots & Satellites",
    navHeroEquipment: "Équipement de Héros", navHeroStars: "Étoiles de Héros & Équipement Exclusif",
    appBrand: "Calculateur de ressources - Lands of Jail",
    introTitle: "Ce que fait l'outil",
    resetButton: "↺ Réinitialiser aux valeurs par défaut", resetConfirm: "Clique à nouveau pour confirmer ↺",
    currentStock: "Stock actuel", whatMissing: "Ce qu'il te manque",
    needed: "nécessaire", missing: "Manque", okSurplus: "OK (surplus {n})",
    colTarget: "Objectif", colFrom: "De", colTo: "À", colCost: "Coût",
    autoAdded: "(ajouté auto. — prérequis)",
    targetSet: "objectif défini", noTarget: "aucun objectif",
    autoRequired: "requis", groupAutoRequired: "{n} requis",
    savedHint: "Tes niveaux et tes objectifs restent enregistrés sur cet appareil — tu peux fermer la page et les retrouver tels quels. Ils ne te suivent pas sur un autre appareil ou un autre navigateur.",
    savedHintDismiss: "Compris, masquer",
    loweredNote: "↓ Redescendus avec lui, ils ne peuvent pas être plus hauts : {names}",
    reportError: "Signaler un chiffre erroné", donate: "Offrir un café",
    current: "Actuel", target: "Cible",
    stageWord: "palier", levelWord: "Niveau",
    footer: "Les données sont stockées uniquement dans ton navigateur (localStorage).",
    dataUpdated: "Données mises à jour le {date}",
    unofficialNote: "Outil non officiel, non affilié à l'éditeur ou au développeur du jeu.",
    estimatedNote: "Inclut une valeur estimée, pas encore confirmée — voir la note ci-dessus.",
    newBadge: "Nouveau",
  },
};

// Paste a URL here to make that footer link appear; leave it empty and the
// link isn't rendered at all, so the site can never ship a dead one. They sit
// right under the "data last updated" line: that's the only place on the page
// already talking about the data, which is what a report is about, and the
// footer keeps the donation ask out of the way of someone doing their sums.
//
// The report link should point at a plain form (Tally, Google Forms). A link,
// never an embedded widget — an embed would drop a third-party script into an
// app that currently carries none, and drag a cookie banner along with it for
// the French and German visitors.
//
// One form per site language, since Tally can't translate a form or offer the
// visitor a language switch: whichever language they're reading the app in is
// the one the form is written in. A language with no entry here falls back to
// English rather than sending someone to a form they can't read, so adding a
// translation later is one more line. Neither form asks for an email, which is
// what keeps this a plain link with no consent banner behind it.
const REPORT_URLS = {
  en: "https://tally.so/r/yPBMdx",
  fr: "https://tally.so/r/44MQRb",
};
const DONATE_URL = "https://ko-fi.com/hephka";

function footerLinksHtml(){
  const links = [];
  const reportUrl = REPORT_URLS[lang] || REPORT_URLS.en || "";
  if(reportUrl) links.push(`<a href="${reportUrl}" target="_blank" rel="noopener noreferrer">${t("reportError")}</a>`);
  if(DONATE_URL) links.push(`<a href="${DONATE_URL}" target="_blank" rel="noopener noreferrer">${t("donate")}</a>`);
  return links.length ? `<br><span class="footer-links">${links.join(" · ")}</span>` : "";
}

const LANG_KEY = "resource-calc-lang";
let lang = localStorage.getItem(LANG_KEY) || (navigator.language && navigator.language.startsWith("fr") ? "fr" : "en");

// Bump this by hand whenever any route's game data (costs, requires) changes
// — shown in the footer so visitors can tell how fresh the numbers are.
const DATA_UPDATED = "2026-08-20";
function formattedDataUpdated(){
  return new Date(DATA_UPDATED+"T00:00:00").toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", { year:"numeric", month:"long", day:"numeric" });
}

function t(key, vars){
  const dict = I18N[lang] || {};
  const chrome = I18N_CHROME[lang] || {};
  let s = key in dict ? dict[key] : (key in chrome ? chrome[key] : key);
  if(vars) Object.keys(vars).forEach(k=> s = s.replace(`{${k}}`, vars[k]));
  return s;
}
// Read live rather than cached: the preference can be toggled in the OS while
// the page stays open, and matchMedia may be missing in an odd environment.
function prefersReducedMotion(){
  return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}

function resourceLabel(r){ return t("res_"+r); }
function fmt(n){ return Math.round(n).toLocaleString(lang === "fr" ? "fr-FR" : "en-US"); }
function zeroResources(){ return Object.fromEntries(RESOURCES.map(r=>[r,0])); }

const MAX_NUMBER_INPUT = 99999999;

// Sanitizes a raw <input> string into a non-negative integer capped at `max`
// (99,999,999 unless a tighter cap already applies). The field silently
// corrects itself as you type — no message needed, blocking the bad
// character is feedback enough.
function sanitizeIntInput(raw, max){
  max = max == null ? MAX_NUMBER_INPUT : max;
  const digits = raw.replace(/[^0-9]/g, "");
  let n = digits === "" ? 0 : parseInt(digits, 10);
  if(n > max) n = max;
  return n;
}

function toRoman(n){
  n = Number(n);
  if(!n || n<1) return String(n);
  const vals = [[1000,"M"],[900,"CM"],[500,"D"],[400,"CD"],[100,"C"],[90,"XC"],[50,"L"],[40,"XL"],[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"]];
  let res = "";
  for(const [v,s] of vals){ while(n>=v){ res+=s; n-=v; } }
  return res;
}

// A track's levels display in one of three styles, set via track.levelStyle:
//   "raw"     (default) - the level id itself, e.g. "FC5"
//   "numeric" - "<levelWord> <id>", e.g. "Level 7" (or "Level VII" if track.romanLevels)
//   "keyed"   - the id looked up via t(track.levelKeyPrefix + id), e.g. tier names
// Any id ending in "_s<N>" is a sub-level (stage/star/...): its base is styled
// per the rules above, suffixed with "· <stageWordKey or stageWord> <N>", or
// with t(level.labelSuffixKey) when the level overrides it.
function levelLabel(track, level){
  const id = level.id;
  const stageW = t(track.stageWordKey || "stageWord");
  const m = id.match(/^(.+)_s(\d)$/);
  const baseId = m ? m[1] : id;
  const base = track.levelStyle === "keyed" ? t(track.levelKeyPrefix+baseId)
    : track.levelStyle === "numeric" ? `${t("levelWord")} ${track.romanLevels ? toRoman(baseId) : baseId}`
    : baseId;
  if(!m) return base;
  return `${base} · ${level.labelSuffixKey ? t(level.labelSuffixKey) : `${stageW} ${m[2]}`}`;
}

// Every track carries `nameParts`: an array of i18n keys, or {key,vars} objects
// for parts that need substitution (e.g. "Tome {n}"). A single-part track (e.g.
// a building) shows that one name everywhere. A multi-part track (e.g. a
// research tree grouped by troop) shows only its last part on its own card,
// and the full "Troop — Item" chain wherever standalone context is needed.
function resolveNamePart(part){ return typeof part === "string" ? t(part) : t(part.key, part.vars); }
function trackShortName(track){ return resolveNamePart(track.nameParts[track.nameParts.length-1]); }
function trackDisplayName(track){ return track.nameParts.map(resolveNamePart).join(" — "); }

let state = load();

// Bump SCHEMA_VERSION whenever a route's track data shape changes (new/renamed
// fields, new levels inserted mid-chain, etc). Saved states from an older
// schema are discarded instead of loaded broken — unless the route defines
// `migrateState(old)`, which gets a chance to convert it first and returns
// null when it can't. Worth writing only when the old state maps onto the new
// shape exactly; a guess would silently corrupt someone's saved progress.
//
// Bump it for a corrected COST too, not just a changed shape: what's saved is
// a whole copy of the route's tracks, levels and costs, and this returns that
// copy as-is. The page's own defaultData() is therefore only consulted for a
// visitor who has no saved state, so a corrected number never reaches anyone
// who already used the route until the version forces the state out.
// What a visitor owns is their progress: stock, how many dynamic items they
// added, and where each track sits. The costs, levels and prerequisites are
// the app's, and the page file is what should decide them. So the saved copy
// of all that is dropped and rebuilt from defaultData(), keeping only the
// progress, matched by track id.
//
// That makes the file the single source of truth again: a corrected cost
// reaches everyone on their next load with no SCHEMA_VERSION bump, a track
// that no longer exists disappears, and a newly added one arrives at its
// defaults instead of being missing. SCHEMA_VERSION still matters when level
// indices shift, because these two indices are what point at them.
function adoptProgress(saved){
  if(!saved || typeof saved !== "object" || !Array.isArray(saved.tracks)) return null;
  const fresh = defaultData();
  RESOURCES.forEach(r=>{
    const n = Math.floor(Number((saved.stock || {})[r]));
    fresh.stock[r] = Number.isFinite(n) && n > 0 ? Math.min(n, MAX_NUMBER_INPUT) : 0;
  });
  // Dynamic routes have to grow back to the number of items the visitor added
  // before their tracks can be matched — defaultData() only ever builds one.
  // The counters that matter are the categories' own, which aren't necessarily
  // the keys defaultData() puts in `counts` (Hero Stars declares "Hero" while
  // its categories count "HeroStar" and "ExclusiveEquip"), so derive them from
  // CATEGORIES. A counter the saved state doesn't carry falls back to however
  // many tracks defaultData() just built, never to zero — otherwise the sync
  // below would delete the very tracks it starts with.
  const countKeys = new Set(CATEGORIES.filter(c=>c.dynamic).map(c=> c.dynamic.countKey || c.key));
  if(countKeys.size){
    fresh.counts = fresh.counts || {};
    countKeys.forEach(k=>{
      const defs = CATEGORIES.filter(c=> c.dynamic && (c.dynamic.countKey || c.key) === k);
      const built = Math.max(...defs.map(c=> fresh.tracks.filter(tr=>tr.category===c.key).length));
      const cap = Math.min(...defs.map(c=> c.dynamic.max || Infinity));
      const n = Math.floor(Number((saved.counts || {})[k]));
      fresh.counts[k] = Number.isFinite(n) && n > 0 ? Math.min(n, cap) : built;
    });
    CATEGORIES.forEach(c=> syncDynamicCategory(fresh, c));
  }
  const savedById = {};
  saved.tracks.forEach(tr=>{ if(tr && typeof tr.id === "string") savedById[tr.id] = tr; });
  fresh.tracks.forEach(tr=>{
    const was = savedById[tr.id];
    if(!was) return;
    const last = tr.levels.length - 1;
    const clamp = v=>{
      const n = Math.floor(Number(v));
      return Number.isFinite(n) ? Math.max(0, Math.min(n, last)) : 0;
    };
    tr.currentLevelIndex = clamp(was.currentLevelIndex);
    // "Cible" only lists checkpoints, so a saved target sitting on a palier
    // would match no option and the select would silently show the track's
    // first level instead — state and screen disagreeing, which is worse than
    // either being wrong. Snap it to the tier that target sits in, keeping the
    // intent as close as the select can actually render.
    const target = clamp(was.targetLevelIndex);
    tr.targetLevelIndex = tr.levels[target].targetCheckpoint === false
      ? tierStartFor(tr, target)
      : target;
  });
  return fresh;
}

function load(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw){
      const parsed = JSON.parse(raw);
      if(parsed.schemaVersion === SCHEMA_VERSION) return adoptProgress(parsed) || defaultData();
      if(typeof migrateState === "function"){
        // Migrated states go through the same path: a migration is new code
        // walking old data, which is exactly where a bad index is most likely
        // to come from, and it has no business deciding costs either.
        const migrated = migrateState(parsed);
        if(migrated) return adoptProgress(migrated) || defaultData();
      }
    }
  }catch(e){}
  return defaultData();
}
// Writes back only what adoptProgress() reads. Serializing the whole state
// would store another copy of every level and cost, which the next load throws
// away anyway — 79 KB of stale duplicate on index.html. Older, fatter states
// still load: the extra keys are simply ignored, so this needs no version bump.
function persist(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    schemaVersion: state.schemaVersion,
    stock: state.stock,
    counts: state.counts,
    tracks: state.tracks.map(tr=>({
      id: tr.id,
      currentLevelIndex: tr.currentLevelIndex,
      targetLevelIndex: tr.targetLevelIndex,
    })),
  }));
}
function save(){
  persist();
  render();
}
// What each resource was short by at the last render. The summary and the
// sticky bar flash exactly the figures that moved, so after changing a target
// the eye lands on the one that answers "what did that just cost me" instead
// of hunting a column of numbers that all silently jumped at once. Null until
// the first render, so opening the page doesn't light everything up.
let lastMissing = null;
function takeChangedResources(totals){
  const now = {};
  RESOURCES.forEach(r=> now[r] = (totals[r] || 0) - (state.stock[r] || 0));
  const changed = new Set();
  if(lastMissing) RESOURCES.forEach(r=>{ if(lastMissing[r] !== now[r]) changed.add(r); });
  lastMissing = now;
  return changed;
}

function refreshSummary(){
  const { totals, breakdown } = computeCascade();
  // Typing a stock figure moves these numbers on every keystroke, and the
  // person typing already knows what they typed — take the reading to keep the
  // baseline in step, but flash nothing.
  takeChangedResources(totals);
  renderSummary(totals, breakdown, new Set());
  renderBreakdown(breakdown);
  renderStickyBar(totals, breakdown, new Set());
}

// Both cascade loops cap their passes so they can't hang the tab. A cycle in
// the data is NOT what trips this: the loops only ever raise indices, and
// indices are capped by their track's level count, so they always settle —
// even on A-needs-B-needs-A. What could trip it is a requires graph that needs
// more passes than the cap, whose worst case (every pass advancing a single
// step) is bounded by the total level count across tracks, well past 200 on a
// page like index.html. Unreachable in practice, and a future change to how
// the loops advance is the likeliest way it ever fires — which is exactly when
// silence would cost the most, since everything downstream is then wrong.
function warnIfGuardTripped(stillChanging, where){
  if(!stillChanging) return;
  console.warn(`[resource-calculator] ${where} stopped at its 200-pass guard before settling, so the costs shown are incomplete. Check for a requires chain that needs more passes than the cap allows.`);
}

function trackById(id){ return state.tracks.find(t=>t.id===id); }
function levelIndexOf(track, levelId){ return track.levels.findIndex(l=>l.id===levelId); }

// Any track's `requires` chain can gate some of its levels behind another
// track being at a certain level — e.g. an equipment piece's "Legendary T2"
// needs Mastery Lv11, or Warden Office's FC5 needs Bomber Barrack and
// Communication Center at FC4. Being AT a gated level already implies the
// referenced track's own current level must be at least that high too —
// but currentLevelIndex is set independently per track, so nothing enforced
// that on its own. Without this, setting one track's "Actuel" past a gate
// (without also manually raising every track it depends on) left those
// dependencies at their default, and any later cascade calculation would
// wrongly count the full climb from scratch instead of from where they
// implicitly already are.
//
// This scans every track's requires up to its own current level and floors
// the referenced track's current level accordingly (never lowers it — the
// user may have leveled it further already), repeating to a fixed point
// since one floor can itself imply another (mirrors computeCascade()'s own
// propagation, but for "current" instead of "target"). Called whenever any
// track's "Actuel" changes, and once at load to repair state saved before
// this existed.
function propagateImpliedCurrent(){
  let changed = true, guard = 0;
  while(changed && guard++ < 200){
    changed = false;
    for(const t of state.tracks){
      for(let i=0;i<=t.currentLevelIndex;i++){
        const lvl = t.levels[i];
        if(!lvl) continue;
        (lvl.requires||[]).forEach(r=>{
          const other = trackById(r.trackId);
          if(!other) return;
          const idx = levelIndexOf(other, r.levelId);
          if(idx > other.currentLevelIndex){
            other.currentLevelIndex = idx;
            // Same rule as the direct data-cur handler in initApp: bring
            // target along when it isn't already ahead, so a track bumped
            // only as someone else's prerequisite doesn't get left with its
            // target select still parked at level 1 while current jumps far
            // past it.
            // Same snapping rule as setCurrentLevel: land on a level "Cible"
            // can actually display. Prerequisites happen to point at
            // checkpoints today, so this changes nothing now and stops the
            // day one points at a palier from breaking the select.
            if(other.targetLevelIndex <= idx) other.targetLevelIndex = tierStartIndex(other);
            changed = true;
          }
        });
      }
    }
  }
  warnIfGuardTripped(changed, "propagateImpliedCurrent");
}

function computeCascade(){
  const required = {};
  state.tracks.forEach(t=> required[t.id] = Math.max(t.currentLevelIndex, t.targetLevelIndex||0));
  let changed = true, guard=0;
  const autoBumped = {};
  while(changed && guard++ < 200){
    changed = false;
    for(const t of state.tracks){
      const reqIdx = required[t.id];
      for(let i=t.currentLevelIndex+1; i<=reqIdx; i++){
        const lvl = t.levels[i];
        if(!lvl) continue;
        (lvl.requires||[]).forEach(r=>{
          const rt = trackById(r.trackId);
          if(!rt) return;
          const needIdx = levelIndexOf(rt, r.levelId);
          if(needIdx > required[rt.id]){
            required[rt.id] = needIdx;
            autoBumped[rt.id] = true;
            changed = true;
          }
        });
      }
    }
  }
  warnIfGuardTripped(changed, "computeCascade");
  const totals = zeroResources();
  const breakdown = [];
  state.tracks.forEach(t=>{
    const reqIdx = required[t.id];
    if(reqIdx > t.currentLevelIndex){
      const rowCost = zeroResources();
      let estimated = false;
      for(let i=t.currentLevelIndex+1;i<=reqIdx;i++){
        const lvl = t.levels[i];
        if(!lvl) continue;
        RESOURCES.forEach(r=> rowCost[r]+= (lvl.cost[r]||0));
        if(lvl.estimated) estimated = true;
      }
      RESOURCES.forEach(r=> totals[r]+=rowCost[r]);
      breakdown.push({
        track:t, from:t.currentLevelIndex, to:reqIdx, cost:rowCost,
        auto: autoBumped[t.id] && reqIdx > (t.targetLevelIndex||0),
        estimated
      });
    }
  });
  return { totals, breakdown };
}

function renderChrome(){
  document.title = t("title");
  document.getElementById("brandTitle").textContent = t("appBrand");
  document.getElementById("appTitle").textContent = t("pageTitle");
  document.getElementById("appSubtitle").textContent = t("subtitle");
  document.getElementById("introTitle").textContent = t("introTitle");
  document.getElementById("introLead").textContent = t("introLead");
  document.getElementById("introFeatures").innerHTML = ["introFeature1","introFeature2"]
    .map((key,i)=>`<div class="intro-feature"><span class="ico">${["🎯","🔗"][i]}</span><span>${t(key)}</span></div>`).join("");
  document.getElementById("introNote").innerHTML = `<span class="warn-icon">⚠</span>${t("introNote")}`;
  document.getElementById("stockHeading").textContent = t("currentStock");
  document.getElementById("missingHeading").textContent = t("whatMissing");
  document.getElementById("footerText").innerHTML = `${t("unofficialNote")}<br>${t("footer")}<br>${t("dataUpdated",{date:formattedDataUpdated()})}${footerLinksHtml()}<img src="images/logo-loj.png" alt="S241 [AoW]" width="600" height="337" class="footer-logo">`;
  const resetBtn = document.getElementById("btnReset");
  if(resetBtn.dataset.armed !== "1") resetBtn.textContent = t("resetButton");
  document.querySelectorAll(".lang-btn").forEach(b=>{
    b.classList.toggle("active", b.dataset.lang === lang);
  });
  document.querySelectorAll(".nav-link[data-navkey]").forEach(a=>{
    a.textContent = t(a.dataset.navkey);
  });
}

function setLang(l){
  lang = l;
  localStorage.setItem(LANG_KEY, l);
  document.documentElement.lang = l;
  renderChrome();
  render();
}

// Every route saves its progress under its own key, so a page has no way of
// knowing from its own state that you left an unfinished target on another
// one. They share an origin, so it can read theirs and put a dot on that nav
// link. Only currentLevelIndex/targetLevelIndex are read, fields every route's
// saved shape has, so this still answers correctly against a state written by
// an older SCHEMA_VERSION. verify.js checks this map against the real keys.
const ROUTE_STORAGE_KEYS = {
  "index.html": "resource-calc-state-v1",
  "tomes-collections.html": "resource-calc-tomes-state-v1",
  "robots-satellites.html": "resource-calc-robots-state-v1",
  "hero-equipment.html": "resource-calc-heroequipment-state-v1",
  "hero-stars-exclusive-equipment.html": "resource-calc-herostars-state-v1",
};

function routeHasTargets(storageKey){
  try{
    const raw = localStorage.getItem(storageKey);
    if(!raw) return false;
    const tracks = JSON.parse(raw).tracks;
    return Array.isArray(tracks) && tracks.some(tr=> tr.targetLevelIndex > tr.currentLevelIndex);
  }catch(e){ return false; }
}

function refreshNavTargets(){
  document.querySelectorAll(".nav-link[data-navkey]").forEach(a=>{
    const key = ROUTE_STORAGE_KEYS[a.getAttribute("href")];
    const marked = !!key && routeHasTargets(key);
    a.classList.toggle("has-targets", marked);
    // The dot is decorative, so spell the state out for screen readers too.
    if(marked) a.setAttribute("aria-label", `${t(a.dataset.navkey)} — ${t("targetSet")}`);
    else a.removeAttribute("aria-label");
  });
}

function render(){
  renderStock();
  const { totals, breakdown } = computeCascade();
  const changed = takeChangedResources(totals);
  renderSummary(totals, breakdown, changed);
  renderBreakdown(breakdown);
  renderStickyBar(totals, breakdown, changed);
  cascadeAuto.clear();
  breakdown.forEach(b=>{ if(b.auto) cascadeAuto.add(b.track.id); });
  renderCategories();
  refreshNavTargets();
}

function renderStock(){
  const grid = document.getElementById("stockGrid");
  grid.innerHTML = RESOURCES.map(r=>`
    <div class="stock-item">
      <label for="stock-${r}" style="color:${RES_ACCENT[r]}"><span class="res-dot" data-res="${r}" style="color:${RES_ACCENT[r]}"></span>${resourceLabel(r)}</label>
      <input type="text" inputmode="numeric" id="stock-${r}" data-stock="${r}" value="${state.stock[r]}">
    </div>`).join("");
  // type="text" (not "number") is deliberate: number inputs silently discard
  // whatever's typed while it's mid-invalid (e.g. just "-"), which fights
  // against sanitizing it ourselves.
  grid.querySelectorAll("input[data-stock]").forEach(inp=>{
    inp.addEventListener("input", e=>{
      const value = sanitizeIntInput(e.target.value);
      if(String(value) !== e.target.value) e.target.value = value;
      state.stock[inp.dataset.stock] = value;
      persist();
      refreshSummary();
    });
    inp.addEventListener("focus", e=> e.target.select());
  });
}

function renderSummary(totals, breakdown, changed){
  const grid = document.getElementById("summaryGrid");
  // A route can define its own summaryResourceKeys(totals, breakdown) to
  // override which resources appear; every route that hasn't gets the
  // sensible default of "only resources actually needed" instead of a
  // fixed-column list padded with "0 needed" cards.
  const visibleResources = typeof summaryResourceKeys === "function"
    ? summaryResourceKeys(totals, breakdown)
    : RESOURCES.filter(r=> totals[r] > 0);
  grid.innerHTML = visibleResources.map(r=>{
    const need = totals[r], stock = state.stock[r]||0, missing = need - stock;
    return `<div class="res-card${changed && changed.has(r) ? " value-updated" : ""}" style="--accent-color:${RES_ACCENT[r]}">
      <div class="name"><span class="res-dot" data-res="${r}" style="color:${RES_ACCENT[r]}"></span>${resourceLabel(r)}</div>
      <div class="need">${fmt(need)} ${t("needed")}</div>
      <div class="missing ${missing>0?"bad":"good"}">${missing>0 ? t("missing")+" "+fmt(missing) : t("okSurplus",{n:fmt(Math.abs(missing))})}</div>
    </div>`;
  }).join("");
}

// A fixed bottom bar mirroring the missing totals, so they stay visible while
// scrolling through tracks and adjusting targets far below the summary card
// — the full breakdown lives below the fold on any route with more than a
// couple of tracks, and re-scrolling up after every adjustment isn't a
// reasonable workflow. Tapping it jumps back to the full summary.
function renderStickyBar(totals, breakdown, changed){
  const bar = document.getElementById("stickyBar");
  if(!bar) return;
  const missingList = RESOURCES
    .map(r=>({ r, missing: totals[r] - (state.stock[r]||0) }))
    .filter(x=> x.missing > 0);
  if(!breakdown.length || !missingList.length){
    bar.hidden = true;
    bar.innerHTML = "";
    return;
  }
  bar.hidden = false;
  bar.setAttribute("role","button");
  bar.tabIndex = 0;
  bar.setAttribute("aria-label", t("whatMissing"));
  // scrollIntoView's own animation ignores the CSS reduced-motion block, so
  // ask for the preference here rather than gliding the whole page anyway.
  const jump = ()=> document.getElementById("missingHeading").scrollIntoView({
    behavior: prefersReducedMotion() ? "auto" : "smooth",
    block: "start",
  });
  bar.onclick = jump;
  bar.onkeydown = e=>{ if(e.key==="Enter" || e.key===" "){ e.preventDefault(); jump(); } };
  bar.innerHTML = `<div class="sticky-bar-inner">
    ${missingList.map(({r,missing})=>`<span class="sticky-chip${changed && changed.has(r) ? " value-updated" : ""}" style="--accent-color:${RES_ACCENT[r]}"><span class="res-dot" data-res="${r}" style="color:${RES_ACCENT[r]}"></span>${resourceLabel(r)} <b>${fmt(missing)}</b></span>`).join("")}
  </div>`;
}

// Only lists resources this specific row actually costs (>0) instead of a
// fixed column per RESOURCES entry — tomes and collections don't use the
// same resources, so a shared fixed-column table would show a lot of zeros.
function renderBreakdown(breakdown){
  const el = document.getElementById("breakdown");
  // Driven from here rather than from both render paths, since this is the one
  // function that already knows whether there's anything to show.
  renderSavedHint(breakdown.length > 0);
  if(!breakdown.length){ el.innerHTML = `<p class="empty-hint">${t("noTargetHint")}</p>`; return; }
  const colTarget = t("colTarget"), colFrom = t("colFrom"), colTo = t("colTo"), colCost = t("colCost");
  el.innerHTML = `<table><thead><tr><th>${colTarget}</th><th>${colFrom}</th><th>${colTo}</th><th>${colCost}</th></tr></thead><tbody>
    ${breakdown.map(b=>{
      const cost = RESOURCES.filter(r=> b.cost[r] > 0).map(r=> `${fmt(b.cost[r])} ${resourceLabel(r)}`).join(", ");
      return `<tr>
      <td data-label="${colTarget}">${trackDisplayName(b.track)} ${b.auto?'<span class="auto-tag">'+t("autoAdded")+'</span>':''}</td>
      <td data-label="${colFrom}">${levelLabel(b.track, b.track.levels[b.from])}</td>
      <td data-label="${colTo}">${levelLabel(b.track, b.track.levels[b.to])}</td>
      <td data-label="${colCost}" class="cost-cell">${cost} ${b.estimated?`<span class="estimated-wrap"><button type="button" class="estimated-tag" aria-expanded="false">≈</button><span class="estimated-note" hidden>${t("estimatedNote")}</span></span>`:''}</td>
    </tr>`;
    }).join("")}
  </tbody></table>`;
}

// The strongest reason to come back is that everything is already filled in,
// and nothing told a first-time visitor that. Only worth saying once there's a
// result on screen: before any target is set, there is no progress to keep and
// the sentence means nothing. It says "on this device" plainly, because a
// vaguer promise would send someone to their phone expecting to find the setup
// they just built on a laptop. Dismissed for good once read — a daily visitor
// has no use for it, and this app's whole habit is not repeating itself.
// One key for the whole site, not one per route like the intro card: that card
// explains something different on each page, this sentence is the same one
// everywhere, so dismissing it once has to silence it everywhere.
const SAVED_HINT_KEY = "resource-calc-saved-hint-seen";

function renderSavedHint(hasResults){
  const el = document.getElementById("savedHint");
  if(!el) return;
  let dismissed = false;
  try{ dismissed = localStorage.getItem(SAVED_HINT_KEY) === "1"; }catch(e){}
  if(!hasResults || dismissed){ el.hidden = true; el.innerHTML = ""; return; }
  // Rebuilt on every pass rather than only when first shown, so switching
  // language redraws it in the new one like everything else on the page.
  el.hidden = false;
  el.innerHTML = `<span>💾 ${t("savedHint")}</span>
    <button type="button" class="saved-hint-dismiss">${t("savedHintDismiss")}</button>`;
  el.querySelector(".saved-hint-dismiss").addEventListener("click", ()=>{
    try{ localStorage.setItem(SAVED_HINT_KEY, "1"); }catch(e){}
    el.hidden = true;
    el.innerHTML = "";
  });
}

const uiOpen = { groups:new Set() };

// Ids of tracks the cascade is pulling up past whatever target their owner set
// (or didn't set) — filled from the breakdown on every render, so a badge can
// say "required" instead of "no target" on a climb nobody asked for directly.
const cascadeAuto = new Set();

// A track needs work when its own target is ahead of its current level, when
// the cascade is pulling it up for someone else's prerequisite, or when its
// paired track is in either state (Mastery, on a Hero Equipment card). The
// card badge and its group's badge both go through these, so they agree.
function trackNeedsWork(tr){
  const paired = tr.pairedTrackId ? trackById(tr.pairedTrackId) : null;
  const needs = x => x.targetLevelIndex > x.currentLevelIndex || cascadeAuto.has(x.id);
  return needs(tr) || !!(paired && needs(paired));
}
function trackHasOwnTarget(tr){
  const paired = tr.pairedTrackId ? trackById(tr.pairedTrackId) : null;
  const set = x => x.targetLevelIndex > x.currentLevelIndex;
  return set(tr) || !!(paired && set(paired));
}

// Tracks carrying a `groupKey` are folded into one collapsible group, named by
// their `groupLabelKey`; tracks without one render flat, in place. That lets a
// category keep a couple of headline tracks visible while the long tail folds
// away (see the Warden's Office and FC Lab sitting above the support group).
function groupedTracksHtml(tracks){
  const out = [];
  const seen = new Set();
  tracks.forEach(tr=>{
    const key = tr.groupKey;
    if(!key){ out.push(trackHtml(tr)); return; }
    if(seen.has(key)) return;
    seen.add(key);
    const gTracks = tracks.filter(x=>x.groupKey===key);
    const needing = gTracks.filter(trackNeedsWork).length;
    const anyOwnTarget = gTracks.some(trackHasOwnTarget);
    const isOpen = uiOpen.groups.has(key);
    const icon = (GROUP_ICONS && GROUP_ICONS[key]) || "🧬";
    const badgeText = !needing ? t("groupNoTargets")
      : anyOwnTarget ? t("groupTargetsSet",{n:needing})
      : t("groupAutoRequired",{n:needing});
    out.push(`<div class="research-group">
      <button type="button" class="group-head" data-group="${key}" aria-expanded="${isOpen}">
        <span class="group-icon">${icon}</span>
        <span class="group-name">${t(gTracks[0].groupLabelKey)}</span>
        <span class="group-badge ${needing?(anyOwnTarget?'active':'auto'):''}">${badgeText}</span>
        <span class="group-chevron ${isOpen?'open':''}">▸</span>
      </button>
      <div class="group-body ${isOpen?'open':''}">
        ${gTracks.map(x=> trackHtml(x)).join("")}
      </div>
    </div>`);
  });
  return out.join("");
}

// A "dynamic" category starts with one item and adds tracks on demand.
// Two categories can share one counter via dynamic.countKey (e.g. a "Hero"
// count driving both a Star-progress category and an Exclusive-Equipment
// category in lockstep, one instance of each per hero) — defaults to the
// category's own key when unset, so unrelated categories don't collide.
// Takes the state to operate on rather than reaching for the global, because
// load() has to expand these before `state` itself exists.
function syncDynamicCategory(st, catDef){
  if(!catDef || !catDef.dynamic) return;
  const countKey = catDef.dynamic.countKey || catDef.key;
  const want = Math.max(0, (st.counts || {})[countKey] || 0);
  let existing = st.tracks.filter(tr=>tr.category===catDef.key).sort((a,b)=>a.qtyIndex-b.qtyIndex);
  while(existing.length > want){
    const removed = existing.pop();
    st.tracks = st.tracks.filter(tr=>tr!==removed);
  }
  while(existing.length < want){
    const nt = catDef.dynamic.makeTrack(existing.length+1);
    st.tracks.push(nt);
    existing.push(nt);
  }
}

// Renders one category: its title (full "cat-title", a compact colored
// "rarity-badge" if catDef.badge is a color, or nothing if it belongs to a
// PARTS group without a badge — the part header already names it), its
// add-button if dynamic, and its tracks.
function categoryHtml(catDef){
  const tracks = state.tracks.filter(tr=>tr.category===catDef.key);
  const qtyMax = catDef.dynamic && catDef.dynamic.max;
  const currentCount = tracks.length;
  const qtyControl = catDef.dynamic ? `
    <div class="qty-control">
      <button type="button" class="add-item" data-add-item="${catDef.key}" ${qtyMax && currentCount>=qtyMax ? "disabled" : ""}>${t(catDef.dynamic.addLabelKey)}</button>
    </div>` : "";
  if(!tracks.length && !catDef.dynamic) return "";
  const title = catDef.badge ? `<div class="rarity-badge" style="--badge-color:${catDef.badge}">${t(catDef.labelKey)}</div>`
    : catDef.part ? ""
    : `<div class="cat-title">${catDef.icon} ${t(catDef.labelKey)}</div>`;
  const body = catDef.grouped ? groupedTracksHtml(tracks) : tracks.map(tr=>trackHtml(tr)).join("");
  return `${title}${qtyControl}${body}`;
}

// A page can optionally group its CATEGORIES into named PARTS (e.g. "Robots"
// vs "Satellites") for a bigger visual separation than a plain cat-title —
// each part gets one header, and its categories render as normal underneath
// (or as compact badges, via categoryHtml above). Pages without PARTS render
// categories flat, exactly as before.
function renderCategories(){
  const cont = document.getElementById("categories");
  cont.innerHTML = (typeof PARTS !== "undefined" && PARTS)
    ? PARTS.map(part=>{
        const body = CATEGORIES.filter(c=>c.part===part.key).map(categoryHtml).join("");
        return `<div class="route-part"><div class="part-header">${part.icon} ${t(part.labelKey)}</div>${body}</div>`;
      }).join("")
    : CATEGORIES.map(categoryHtml).join("");

  cont.querySelectorAll(".group-head").forEach(h=>{
    h.addEventListener("click", ()=>{
      const g = h.dataset.group;
      const body = h.nextElementSibling;
      const chevron = h.querySelector(".group-chevron");
      const nowOpen = !body.classList.contains("open");
      body.classList.toggle("open", nowOpen);
      chevron.classList.toggle("open", nowOpen);
      h.setAttribute("aria-expanded", String(nowOpen));
      if(nowOpen) uiOpen.groups.add(g); else uiOpen.groups.delete(g);
    });
  });
  cont.querySelectorAll("button[data-add-item]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const key = btn.dataset.addItem;
      const catDef = CATEGORIES.find(c=>c.key===key);
      const countKey = catDef.dynamic.countKey || catDef.key;
      const max = catDef.dynamic.max;
      const nextCount = (state.counts[countKey] || 0) + 1;
      state.counts[countKey] = max ? Math.min(nextCount, max) : nextCount;
      // Sync every category sharing this counter, not just the one clicked —
      // keeps a "one instance per hero" pair of categories in lockstep.
      CATEGORIES.filter(c=>c.dynamic && (c.dynamic.countKey||c.key)===countKey).forEach(c=> syncDynamicCategory(state, c));
      save();
    });
  });
  cont.querySelectorAll("select[data-cur]").forEach(s=> s.addEventListener("change", e=>{
    setCurrentLevel(trackById(s.dataset.cur), Number(e.target.value));
  }));
  cont.querySelectorAll("button[data-palier]").forEach(b=> b.addEventListener("click", ()=>{
    const idx = Number(b.dataset.level);
    setCurrentLevel(trackById(b.dataset.palier), b.dataset.back === "1" ? idx - 1 : idx);
  }));
  cont.querySelectorAll("select[data-tgt]").forEach(s=> s.addEventListener("change", e=>{
    trackById(s.dataset.tgt).targetLevelIndex = Number(e.target.value); save();
  }));
}

// A track can optionally carry `pairedTrackId` + `pairedLabelKey` to show a
// second, related track's own current/target controls in the same card —
// for two progressions that are tracked separately (different cost curves)
// but always set together from the user's point of view (e.g. an equipment
// piece's Level and its Mastery, where Level's promotions require Mastery
// thresholds). The paired track still lives in state.tracks and still
// participates in cascade/breakdown normally; it just isn't given its own
// top-level category card.
function trackHtml(tr){
  const paired = tr.pairedTrackId ? trackById(tr.pairedTrackId) : null;
  const needsWork = trackNeedsWork(tr);
  const ownTarget = trackHasOwnTarget(tr);
  const badgeText = ownTarget ? t("targetSet") : needsWork ? t("autoRequired") : t("noTarget");
  return `<div class="track${tr.accent?' track-accent':''}" ${tr.accent?`style="--accent-color:${tr.accent}"`:''}>
    <div class="track-head">
      <span class="track-name">${trackShortName(tr)}</span>
      ${tr.newBadge ? `<span class="new-badge">${t("newBadge")}</span>` : ''}
      <span class="track-badge ${needsWork?(ownTarget?'active':'auto'):''}">${badgeText}</span>
      <div class="track-controls">
        <span class="field">${t("current")}: <select data-cur="${tr.id}" aria-label="${t("current")} — ${trackShortName(tr)}">${
          // With a bar alongside, the select carries the tier alone and shows
          // the one this track currently sits in, paliers included.
          tr.paliersBar
            ? optionsWithSelected(tr, tierStartIndex(tr), true)
            : optionsWithSelected(tr, tr.currentLevelIndex)
        }</select></span>
        <span class="field">${t("target")}: <select data-tgt="${tr.id}" aria-label="${t("target")} — ${trackShortName(tr)}">${optionsWithSelected(tr,tr.targetLevelIndex,true)}</select></span>
      </div>
      ${tr.paliersBar ? paliersBarHtml(tr) : ""}
      ${lastLowered && lastLowered.by === tr.id
        ? `<p class="lowered-note">${t("loweredNote",{names:lastLowered.names.join(", ")})}</p>` : ""}
      ${paired ? `
      <div class="track-controls paired-controls">
        <span class="paired-label">${t(tr.pairedLabelKey)}</span>
        <span class="field">${t("current")}: <select data-cur="${paired.id}" aria-label="${t("current")} — ${trackShortName(tr)} (${t(tr.pairedLabelKey)})">${optionsWithSelected(paired,paired.currentLevelIndex)}</select></span>
        <span class="field">${t("target")}: <select data-tgt="${paired.id}" aria-label="${t("target")} — ${trackShortName(tr)} (${t(tr.pairedLabelKey)})">${optionsWithSelected(paired,paired.targetLevelIndex)}</select></span>
      </div>` : ""}
    </div>
  </div>`;
}
// Where a track's real tiers sit: the levels "Cible" offers, which are also
// the two ends a paliers bar runs between.
// The mirror of propagateImpliedCurrent, which only ever raises. Lowering a
// track leaves anything gated behind it sitting at a level the game can't
// produce — a support building above the Warden's Office it needs — and the
// upward pass would then shove the track straight back up, so the user's
// change appeared to do nothing at all.
//
// This isn't discarding someone's input: a level above what its prerequisite
// allows is not a state that exists in game, so the only question is which
// end of the contradiction gives. The answer is the one they didn't just
// state. Returns what it moved so the card can say so.
// `stated` is the track the user just set, and it is never clamped: its own
// prerequisites are what propagateImpliedCurrent raises afterwards, so
// clamping it here would walk it straight back down to whatever its
// dependencies happen to be at and swallow the change entirely.
function clampDependentsDown(stated){
  const lowered = [];
  let changed = true, guard = 0;
  while(changed && guard++ < 200){
    changed = false;
    for(const t of state.tracks){
      if(t === stated) continue;
      let limit = t.currentLevelIndex;
      for(let i=1; i<=t.currentLevelIndex; i++){
        const lvl = t.levels[i];
        if(!lvl) continue;
        const met = (lvl.requires||[]).every(r=>{
          const other = trackById(r.trackId);
          return !other || other.currentLevelIndex >= levelIndexOf(other, r.levelId);
        });
        if(!met){ limit = i-1; break; }
      }
      if(limit < t.currentLevelIndex){
        t.currentLevelIndex = limit;
        if(!lowered.includes(t)) lowered.push(t);
        changed = true;
      }
    }
  }
  warnIfGuardTripped(changed, "clampDependentsDown");
  return lowered;
}

// What the last explicit change dragged down with it, so the card the user
// touched can name it. The support group is usually collapsed, so otherwise
// those buildings would move entirely out of sight.
let lastLowered = null;

// Single entry point for "the user just said where this track stands", shared
// by the tier select and the paliers bar so the two can't drift apart.
function setCurrentLevel(track, index){
  track.currentLevelIndex = index;
  // Bring target along with current when it isn't ahead of it (no target set
  // yet, or current just caught up to/passed an old target) — opening the
  // target dropdown next then starts near current instead of at the track's
  // very first level, which matters a lot on long tracks like Warden's
  // Office. A target the user already pushed further out is left alone.
  //
  // It lands on the tier current sits in, not on current itself: "Cible" only
  // lists checkpoints, so a palier index would match no option and the select
  // would silently fall back to displaying the track's first level. A target
  // below current simply means no goal — computeCascade already takes the max
  // of the two.
  if(track.targetLevelIndex <= track.currentLevelIndex) track.targetLevelIndex = tierStartIndex(track);
  // Down first, then up: clamping settles every contradiction this change
  // created, which leaves the upward pass nothing to undo. The other order
  // would just restore the level the user asked to leave.
  const lowered = clampDependentsDown(track);
  lastLowered = lowered.length ? { by: track.id, names: lowered.map(trackDisplayName) } : null;
  propagateImpliedCurrent();
  save();
}

function checkpointIndexes(track){
  const out = [];
  track.levels.forEach((l,i)=>{ if(l.targetCheckpoint !== false) out.push(i); });
  return out;
}

// Splits "Actuel" in two for tracks flagged `paliersBar`: a tier select, plus
// a segmented bar for the position inside that tier. A building's "Actuel"
// listed all 51 levels, so saying where you stand meant scrolling a native
// picker most of the way down; this is an 11-entry list and one tap, and it
// mirrors the bar the game itself draws between two FC levels.
//
// The last segment lands on the next tier, exactly like in game: filling the
// bar IS the promotion. Tapping the segment you already sit on steps back one,
// so the bar winds down as well as up — otherwise nothing but the select could
// take you back to the tier's own level.
// The checkpoint at or below `index` — the tier that level sits in, and the
// nearest level "Cible" is able to display.
function tierStartFor(track, index){
  const cps = checkpointIndexes(track);
  // Below the first checkpoint there is no tier to be inside of, so the answer
  // is the track's own beginning. Returning cps[0] instead would claim a level
  // the track hasn't reached: callers snap targets to this value, so it turned
  // "no goal" into a real goal one level up.
  if(!cps.length || index < cps[0]) return 0;
  let start = cps[0];
  cps.forEach(c=>{ if(c <= index) start = c; });
  return start;
}
function tierStartIndex(track){ return tierStartFor(track, track.currentLevelIndex); }

function paliersBarHtml(tr){
  const cps = checkpointIndexes(tr);
  const tierStart = tierStartIndex(tr);
  const next = cps[cps.indexOf(tierStart) + 1];
  if(next == null) return "";
  // A single step to the next checkpoint isn't progress worth drawing: one
  // full-width chunk says nothing the tier select doesn't already say, and a
  // lone segment stretched across the row reads as a broken bar rather than as
  // "one step left". Hero Star's "Non recruté → Recruté" is the case.
  if(next - tierStart < 2) return "";
  const done = tr.currentLevelIndex - tierStart;
  const segments = [];
  for(let k=1; k<=next-tierStart; k++){
    const idx = tierStart + k;
    segments.push(`<button type="button" class="palier-seg${k<=done?" filled":""}"
      data-palier="${tr.id}" data-level="${idx}" data-back="${k===done?"1":"0"}"
      ${k===done?'aria-current="true" ':''}aria-label="${levelLabel(tr, tr.levels[idx])}"></button>`);
  }
  return `<div class="palier-bar">
    <span class="palier-segs">${segments.join("")}</span>
    <span class="palier-to">▸ ${levelLabel(tr, tr.levels[next])}</span>
  </div>`;
}

// `targetOnly` restricts the option list to levels where `targetCheckpoint`
// isn't explicitly false — for tracks with fine-grained intermediate levels
// that only matter for "Actuel" (e.g. Hero Star's 5 in-between paliers per
// star): "Cible" only offers the meaningful whole-star checkpoints, while
// "Actuel" still shows every level so real, already-in-progress state can
// be set precisely. `value` stays the level's real index either way, so
// cascade math is unaffected — only the choices shown differ.
function optionsWithSelected(track, idx, targetOnly){
  return track.levels
    .map((l,i)=>({l,i}))
    .filter(({l})=> !targetOnly || l.targetCheckpoint!==false)
    .map(({l,i})=>`<option value="${i}" ${i===idx?"selected":""}>${levelLabel(track,l)}</option>`)
    .join("");
}

// Built-in double-click confirmation (instead of native confirm(), not reliable everywhere).
function armConfirm(btn, confirmLabel, action){
  if(btn.dataset.armed === "1"){
    clearTimeout(Number(btn.dataset.armTimer));
    btn.dataset.armed = "0";
    btn.textContent = btn.dataset.originalLabel;
    btn.classList.remove("confirming");
    action();
    return;
  }
  btn.dataset.originalLabel = btn.textContent;
  btn.dataset.armed = "1";
  btn.textContent = confirmLabel;
  btn.classList.add("confirming");
  const timerId = setTimeout(()=>{
    btn.dataset.armed = "0";
    btn.textContent = btn.dataset.originalLabel;
    btn.classList.remove("confirming");
  }, 4000);
  btn.dataset.armTimer = String(timerId);
}

// Wraps .nav-bar in a positioned container and adds fades on either edge
// that only show while there's more to scroll to in that direction — on
// mobile the nav is a single scrollable row (see shared.css) instead of
// wrapping onto 2-3 lines, and the fades are the visual cue that it's
// scrollable at all (a cut-off button otherwise looks the same whether
// it's the truncated last one or a rendering glitch). The active tab can
// land scrolled toward either side (see the scrollIntoView call below),
// so both edges need their own indicator, not just the trailing one.
// Self-regulating: on desktop .nav-bar wraps instead of overflowing, so
// there's nothing to scroll to and both fades just stay hidden — no
// separate breakpoint check needed here.
function initNavFade(){
  const navBar = document.querySelector(".nav-bar");
  if(!navBar) return;
  const wrap = document.createElement("div");
  wrap.className = "nav-bar-wrap";
  navBar.parentNode.insertBefore(wrap, navBar);
  wrap.appendChild(navBar);
  const fadeRight = document.createElement("div");
  fadeRight.className = "nav-fade";
  wrap.appendChild(fadeRight);
  const fadeLeft = document.createElement("div");
  fadeLeft.className = "nav-fade-left";
  wrap.appendChild(fadeLeft);
  const update = () => {
    fadeRight.classList.toggle("visible", navBar.scrollWidth - navBar.clientWidth - navBar.scrollLeft > 4);
    fadeLeft.classList.toggle("visible", navBar.scrollLeft > 4);
  };
  navBar.addEventListener("scroll", update);
  window.addEventListener("resize", update);
  update();
}

// The intro card is onboarding: worth reading once, then pure scroll cost for
// someone who opens the page every day. It starts open on a first visit and
// folds on later ones, unless the reader deliberately reopened it. Its own
// localStorage key, not the page state blob — otherwise a SCHEMA_VERSION bump
// or a "reset to defaults" would re-onboard everyone. Per route, since each
// page's intro explains something different.
const INTRO_KEY = STORAGE_KEY + "-intro-open";

function initIntroToggle(){
  const head = document.getElementById("introToggle");
  const body = document.getElementById("introBody");
  if(!head || !body) return;
  let open = true;
  try{
    const saved = localStorage.getItem(INTRO_KEY);
    if(saved === null) localStorage.setItem(INTRO_KEY, "0");
    else open = saved === "1";
  }catch(e){}
  const apply = ()=>{
    head.setAttribute("aria-expanded", String(open));
    body.classList.toggle("open", open);
    head.querySelector(".intro-chevron").classList.toggle("open", open);
  };
  apply();
  head.addEventListener("click", ()=>{
    open = !open;
    try{ localStorage.setItem(INTRO_KEY, open ? "1" : "0"); }catch(e){}
    apply();
  });
}

function initApp(){
  initNavFade();
  initIntroToggle();
  // Tap/click toggle instead of the old title="" tooltip: title never
  // shows on touch devices (no hover), so mobile users had no way to read
  // the estimated-value note at all. Delegated on the container since
  // renderBreakdown() replaces its innerHTML on every recalculation.
  document.getElementById("breakdown").addEventListener("click", e=>{
    const btn = e.target.closest(".estimated-tag");
    if(!btn) return;
    const note = btn.nextElementSibling;
    const opening = note.hidden;
    document.querySelectorAll(".estimated-tag[aria-expanded=true]").forEach(b=>{
      b.setAttribute("aria-expanded", "false");
      b.nextElementSibling.hidden = true;
    });
    note.hidden = !opening;
    btn.setAttribute("aria-expanded", String(opening));
  });
  document.getElementById("btnReset").addEventListener("click", ()=>{
    armConfirm(document.getElementById("btnReset"), t("resetConfirm"), ()=>{
      state = defaultData();
      save();
    });
  });
  document.querySelectorAll(".lang-btn").forEach(b=>{
    b.addEventListener("click", ()=> setLang(b.dataset.lang));
  });
  document.querySelectorAll(".nav-link").forEach(a=>{
    if(a.getAttribute("href") === location.pathname.split("/").pop() || (a.getAttribute("href")==="index.html" && location.pathname.endsWith("/"))){
      a.classList.add("active");
    }
  });
  // On the scrollable mobile nav (see initNavFade), landing directly on one
  // of the later routes would otherwise leave the active tab scrolled out
  // of view — the bar starts at scrollLeft 0 regardless of which page you
  // opened. block:"nearest" keeps this from also scrolling the page itself.
  const activeLink = document.querySelector(".nav-link.active");
  if(activeLink) activeLink.scrollIntoView({inline:"center", block:"nearest"});
  document.documentElement.lang = lang;
  // Repairs saved state from before propagateImpliedCurrent existed (or
  // from any direct state edit): a track's current level may imply a higher
  // current level on another track than what's actually stored.
  propagateImpliedCurrent();
  persist();
  renderChrome();
  render();
}
