// Shared engine used by every route page (index.html, tomes.html, ...).
// Each page must define, before loading this file:
//   RESOURCES     - array of resource keys, e.g. ["FC","AFC","Hyperalloy"]
//   RES_ACCENT    - {key: "#hexcolor"} per resource
//   STORAGE_KEY   - localStorage key for this route's progress (must be unique per route)
//   SCHEMA_VERSION- bump whenever this route's track data shape changes
//   I18N          - {en:{...}, fr:{...}} translation dictionaries (route-specific keys +
//                   the shared chrome keys listed below)
//   CATEGORIES    - [{key, labelKey, icon, grouped, dynamic, part, badge}] in display order.
//                   grouped:true renders tracks grouped by track.troopKey.
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
//   GROUP_ICONS   - {groupKey: "emoji"} used when a category has grouped:true
//   defaultData() - returns {schemaVersion, stock, counts, tracks}. `counts` is
//                   only needed if the page has any dynamic categories.
//
// Per-track optional flags:
//   romanLevels: true         - numeric levelStyle renders as roman numerals (Level VII)
//
// Shared chrome i18n keys every page's I18N must provide:
//   title, appBrand, pageTitle, subtitle, introTitle, introLead, introFeature1/2/3, introNote,
//   resetButton, resetConfirm, currentStock, whatMissing, needed, missing,
//   okSurplus, noTargetHint, colTarget, colFrom, colTo, autoAdded,
//   targetSet, noTarget, groupNoTargets, groupTargetsSet, current, target,
//   stageWord, levelWord, footer, navHome ... (nav labels as needed),
//   plus a res_<KEY> entry for every entry in RESOURCES.
//
// title      - browser tab title (route name + " - LoJ"), also used as document.title
// appBrand   - the app-wide brand line shown above the h1 on every page, identical
//              text across all routes ("Resource Calculator - LoJ")
// pageTitle  - this route's own name shown in the h1 (e.g. "Robots & Satellites"),
//              without the "- LoJ" suffix

const LANG_KEY = "resource-calc-lang";
let lang = localStorage.getItem(LANG_KEY) || (navigator.language && navigator.language.startsWith("fr") ? "fr" : "en");

function t(key, vars){
  let s = (I18N[lang] && I18N[lang][key]) || key;
  if(vars) Object.keys(vars).forEach(k=> s = s.replace(`{${k}}`, vars[k]));
  return s;
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
// per the rules above, suffixed with "· <stageWordKey or stageWord> <N>".
function levelLabel(track, level){
  const id = level.id;
  const stageW = t(track.stageWordKey || "stageWord");
  const m = id.match(/^(.+)_s(\d)$/);
  const baseId = m ? m[1] : id;
  const base = track.levelStyle === "keyed" ? t(track.levelKeyPrefix+baseId)
    : track.levelStyle === "numeric" ? `${t("levelWord")} ${track.romanLevels ? toRoman(baseId) : baseId}`
    : baseId;
  return m ? `${base} · ${stageW} ${m[2]}` : base;
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
// schema are discarded instead of loaded broken.
function load(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw){
      const parsed = JSON.parse(raw);
      if(parsed.schemaVersion === SCHEMA_VERSION) return parsed;
    }
  }catch(e){}
  return defaultData();
}
function persist(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
function save(){
  persist();
  render();
}
function refreshSummary(){
  const { totals, breakdown } = computeCascade();
  renderSummary(totals, breakdown);
  renderBreakdown(breakdown);
}

function trackById(id){ return state.tracks.find(t=>t.id===id); }
function levelIndexOf(track, levelId){ return track.levels.findIndex(l=>l.id===levelId); }

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
  const totals = zeroResources();
  const breakdown = [];
  state.tracks.forEach(t=>{
    const reqIdx = required[t.id];
    if(reqIdx > t.currentLevelIndex){
      const rowCost = zeroResources();
      for(let i=t.currentLevelIndex+1;i<=reqIdx;i++){
        const lvl = t.levels[i];
        if(!lvl) continue;
        RESOURCES.forEach(r=> rowCost[r]+= (lvl.cost[r]||0));
      }
      RESOURCES.forEach(r=> totals[r]+=rowCost[r]);
      breakdown.push({
        track:t, from:t.currentLevelIndex, to:reqIdx, cost:rowCost,
        auto: autoBumped[t.id] && reqIdx > (t.targetLevelIndex||0)
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
  document.getElementById("introFeatures").innerHTML = ["introFeature1","introFeature2","introFeature3"]
    .map((key,i)=>`<div class="intro-feature"><span class="ico">${["🎯","🔗","📊"][i]}</span><span>${t(key)}</span></div>`).join("");
  document.getElementById("introNote").innerHTML = `<span class="warn-icon">⚠</span>${t("introNote")}`;
  document.getElementById("stockHeading").textContent = t("currentStock");
  document.getElementById("missingHeading").textContent = t("whatMissing");
  document.getElementById("footerText").textContent = t("footer");
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

function render(){
  renderStock();
  const { totals, breakdown } = computeCascade();
  renderSummary(totals, breakdown);
  renderBreakdown(breakdown);
  renderCategories();
}

function renderStock(){
  const grid = document.getElementById("stockGrid");
  grid.innerHTML = RESOURCES.map(r=>`
    <div class="stock-item">
      <label style="color:${RES_ACCENT[r]}">${resourceLabel(r)}</label>
      <input type="text" inputmode="numeric" data-stock="${r}" value="${state.stock[r]}">
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

function renderSummary(totals, breakdown){
  const grid = document.getElementById("summaryGrid");
  const visibleResources = typeof summaryResourceKeys === "function"
    ? summaryResourceKeys(totals, breakdown)
    : RESOURCES;
  grid.innerHTML = visibleResources.map(r=>{
    const need = totals[r], stock = state.stock[r]||0, missing = need - stock;
    return `<div class="res-card" style="--accent-color:${RES_ACCENT[r]}">
      <div class="name"><span class="res-dot" style="color:${RES_ACCENT[r]}"></span>${resourceLabel(r)}</div>
      <div class="need">${fmt(need)} ${t("needed")}</div>
      <div class="missing ${missing>0?"bad":"good"}">${missing>0 ? t("missing")+" "+fmt(missing) : t("okSurplus",{n:fmt(-missing)})}</div>
    </div>`;
  }).join("");
}

// Only lists resources this specific row actually costs (>0) instead of a
// fixed column per RESOURCES entry — tomes and collections don't use the
// same resources, so a shared fixed-column table would show a lot of zeros.
function renderBreakdown(breakdown){
  const el = document.getElementById("breakdown");
  if(!breakdown.length){ el.innerHTML = `<p class="empty-hint">${t("noTargetHint")}</p>`; return; }
  el.innerHTML = `<table><thead><tr><th>${t("colTarget")}</th><th>${t("colFrom")}</th><th>${t("colTo")}</th><th>${t("colCost")}</th></tr></thead><tbody>
    ${breakdown.map(b=>{
      const cost = RESOURCES.filter(r=> b.cost[r] > 0).map(r=> `${fmt(b.cost[r])} ${resourceLabel(r)}`).join(", ");
      return `<tr>
      <td>${trackDisplayName(b.track)} ${b.auto?'<span class="auto-tag">'+t("autoAdded")+'</span>':''}</td>
      <td>${levelLabel(b.track, b.track.levels[b.from])}</td>
      <td>${levelLabel(b.track, b.track.levels[b.to])}</td>
      <td class="cost-cell">${cost}</td>
    </tr>`;
    }).join("")}
  </tbody></table>`;
}

const uiOpen = { groups:new Set() };

function groupedTracksHtml(tracks){
  const order = [];
  tracks.forEach(tr=>{ if(!order.includes(tr.troopKey)) order.push(tr.troopKey); });
  return order.map(troopKey=>{
    const gTracks = tracks.filter(tr=>tr.troopKey===troopKey);
    const activeCount = gTracks.filter(tr=>tr.targetLevelIndex>tr.currentLevelIndex).length;
    const isOpen = uiOpen.groups.has(troopKey);
    const icon = (GROUP_ICONS && GROUP_ICONS[troopKey]) || "🧬";
    const badgeText = activeCount ? t("groupTargetsSet",{n:activeCount}) : t("groupNoTargets");
    return `<div class="research-group">
      <div class="group-head" data-group="${troopKey}">
        <span class="group-icon">${icon}</span>
        <span class="group-name">${t("troop_"+troopKey)}</span>
        <span class="group-badge ${activeCount?'active':''}">${badgeText}</span>
        <span class="group-chevron ${isOpen?'open':''}">▸</span>
      </div>
      <div class="group-body ${isOpen?'open':''}">
        ${gTracks.map(tr=> trackHtml(tr)).join("")}
      </div>
    </div>`;
  }).join("");
}

// A "dynamic" category starts with one item and adds tracks on demand.
function syncDynamicCategory(catDef){
  if(!catDef || !catDef.dynamic) return;
  const want = Math.max(0, state.counts[catDef.key] || 0);
  let existing = state.tracks.filter(tr=>tr.category===catDef.key).sort((a,b)=>a.qtyIndex-b.qtyIndex);
  while(existing.length > want){
    const removed = existing.pop();
    state.tracks = state.tracks.filter(tr=>tr!==removed);
  }
  while(existing.length < want){
    const nt = catDef.dynamic.makeTrack(existing.length+1);
    state.tracks.push(nt);
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
      if(nowOpen) uiOpen.groups.add(g); else uiOpen.groups.delete(g);
    });
  });
  cont.querySelectorAll("button[data-add-item]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const key = btn.dataset.addItem;
      const catDef = CATEGORIES.find(c=>c.key===key);
      const max = catDef.dynamic.max;
      const nextCount = (state.counts[key] || 0) + 1;
      state.counts[key] = max ? Math.min(nextCount, max) : nextCount;
      syncDynamicCategory(catDef);
      save();
    });
  });
  cont.querySelectorAll("select[data-cur]").forEach(s=> s.addEventListener("change", e=>{
    trackById(s.dataset.cur).currentLevelIndex = Number(e.target.value); save();
  }));
  cont.querySelectorAll("select[data-tgt]").forEach(s=> s.addEventListener("change", e=>{
    trackById(s.dataset.tgt).targetLevelIndex = Number(e.target.value); save();
  }));
}

function trackHtml(tr){
  const active = tr.targetLevelIndex > tr.currentLevelIndex;
  return `<div class="track">
    <div class="track-head">
      <span class="track-name">${trackShortName(tr)}</span>
      <span class="track-badge ${active?'active':''}">${active? t("targetSet") : t("noTarget")}</span>
      <div class="track-controls">
        <span class="field">${t("current")}: <select data-cur="${tr.id}">${optionsWithSelected(tr,tr.currentLevelIndex)}</select></span>
        <span class="field">${t("target")}: <select data-tgt="${tr.id}">${optionsWithSelected(tr,tr.targetLevelIndex)}</select></span>
      </div>
    </div>
  </div>`;
}
function optionsWithSelected(track, idx){
  return track.levels.map((l,i)=>`<option value="${i}" ${i===idx?"selected":""}>${levelLabel(track,l)}</option>`).join("");
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

function initApp(){
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
  document.documentElement.lang = lang;
  renderChrome();
  render();
}
