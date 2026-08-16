// Shared engine used by every route page (index.html, tomes.html, ...).
// Each page must define, before loading this file:
//   RESOURCES     - array of resource keys, e.g. ["FC","AFC","Hyperalloy"]
//   RES_ACCENT    - {key: "#hexcolor"} per resource
//   STORAGE_KEY   - localStorage key for this route's progress (must be unique per route)
//   SCHEMA_VERSION- bump whenever this route's track data shape changes
//   I18N          - {en:{...}, fr:{...}} translation dictionaries (route-specific keys +
//                   the shared chrome keys listed below)
//   CATEGORIES    - [{key, labelKey, icon, grouped, dynamic}] in display order.
//                   grouped:true renders tracks grouped by track.troopKey.
//                   dynamic:{countLabelKey, makeTrack(index), max} renders a
//                   quantity input (capped at `max` if given) instead of a
//                   fixed track list: the user types how many items to track
//                   and makeTrack(i) builds each one on demand. Dynamic tracks
//                   need a numeric track.qtyIndex for ordering.
//   GROUP_ICONS   - {groupKey: "emoji"} used when a category has grouped:true
//   defaultData() - returns {schemaVersion, stock, counts, tracks}. `counts` is
//                   only needed if the page has any dynamic categories.
//
// Per-track optional flags:
//   romanLevels: true         - numeric levelStyle renders as roman numerals (Level VII)
//   tierColorFn(baseId)       - returns a hex color to lightly tint that level's
//                               label wherever it's shown (e.g. rarity tinting)
//
// Shared chrome i18n keys every page's I18N must provide:
//   title, subtitle, introTitle, introLead, introFeature1/2/3, introNote,
//   resetButton, resetConfirm, currentStock, whatMissing, needed, missing,
//   okSurplus, noTargetHint, colTarget, colFrom, colTo, autoAdded,
//   targetSet, noTarget, groupNoTargets, groupTargetsSet, current, target,
//   stageWord, levelWord, footer, navHome ... (nav labels as needed),
//   plus a res_<KEY> entry for every entry in RESOURCES.

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
// If the track's category defines tierColorFn(baseId), levelColor() exposes
// the color it returns so callers can tint that level's label (e.g. by
// rarity). Lives on the category (not the track) because tracks round-trip
// through JSON in localStorage, which would silently drop a function.
function levelColor(track, level){
  const catDef = CATEGORIES.find(c=>c.key===track.category);
  if(!catDef || !catDef.tierColorFn) return null;
  const m = level.id.match(/^(.+)_s(\d)$/);
  return catDef.tierColorFn(m ? m[1] : level.id) || null;
}
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
  renderSummary(totals);
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
  document.getElementById("appTitle").textContent = t("title");
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
  renderSummary(totals);
  renderBreakdown(breakdown);
  renderCategories();
}

function renderStock(){
  const grid = document.getElementById("stockGrid");
  grid.innerHTML = RESOURCES.map(r=>`
    <div class="stock-item">
      <label style="color:${RES_ACCENT[r]}">${resourceLabel(r)}</label>
      <input type="number" min="0" data-stock="${r}" value="${state.stock[r]}">
    </div>`).join("");
  grid.querySelectorAll("input[data-stock]").forEach(inp=>{
    inp.addEventListener("input", e=>{
      state.stock[inp.dataset.stock] = Number(e.target.value)||0;
      persist();
      refreshSummary();
    });
    inp.addEventListener("focus", e=> e.target.select());
  });
}

function renderSummary(totals){
  const grid = document.getElementById("summaryGrid");
  grid.innerHTML = RESOURCES.map(r=>{
    const need = totals[r], stock = state.stock[r]||0, missing = need - stock;
    return `<div class="res-card" style="--accent-color:${RES_ACCENT[r]}">
      <div class="name"><span class="res-dot" style="color:${RES_ACCENT[r]}"></span>${resourceLabel(r)}</div>
      <div class="need">${fmt(need)} ${t("needed")}</div>
      <div class="missing ${missing>0?"bad":"good"}">${missing>0 ? t("missing")+" "+fmt(missing) : t("okSurplus",{n:fmt(-missing)})}</div>
    </div>`;
  }).join("");
}

// HTML-safe level label: wraps in a light color span when the track defines
// a tierColorFn (e.g. rarity tinting), plain text otherwise.
function coloredLevelLabel(track, level){
  const label = levelLabel(track, level);
  const color = levelColor(track, level);
  return color ? `<span style="color:${color}">${label}</span>` : label;
}

function renderBreakdown(breakdown){
  const el = document.getElementById("breakdown");
  if(!breakdown.length){ el.innerHTML = `<p class="empty-hint">${t("noTargetHint")}</p>`; return; }
  el.innerHTML = `<table><thead><tr><th>${t("colTarget")}</th><th>${t("colFrom")}</th><th>${t("colTo")}</th>${RESOURCES.map(r=>`<th>${resourceLabel(r)}</th>`).join("")}</tr></thead><tbody>
    ${breakdown.map(b=>`<tr>
      <td>${trackDisplayName(b.track)} ${b.auto?'<span class="auto-tag">'+t("autoAdded")+'</span>':''}</td>
      <td>${coloredLevelLabel(b.track, b.track.levels[b.from])}</td>
      <td>${coloredLevelLabel(b.track, b.track.levels[b.to])}</td>
      ${RESOURCES.map(r=>`<td>${fmt(b.cost[r])}</td>`).join("")}
    </tr>`).join("")}
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

// A "dynamic" category has no fixed set of tracks: the user types how many
// items they want to track (state.counts[catKey]), and this adds/removes
// tracks (via catDef.dynamic.makeTrack(index)) to match. Existing tracks keep
// their progress; only the extras at the end are added or trimmed.
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

function renderCategories(){
  const cont = document.getElementById("categories");
  cont.innerHTML = CATEGORIES.map(catDef=>{
    const tracks = state.tracks.filter(tr=>tr.category===catDef.key);
    const qtyMax = catDef.dynamic && catDef.dynamic.max;
    const qtyControl = catDef.dynamic ? `
      <div class="qty-control">
        <label for="qty_${catDef.key}">${t(catDef.dynamic.countLabelKey)}</label>
        <input type="number" min="0" ${qtyMax?`max="${qtyMax}"`:""} data-qty="${catDef.key}" id="qty_${catDef.key}" value="${state.counts[catDef.key]||0}">
      </div>` : "";
    if(!tracks.length && !catDef.dynamic) return "";
    const body = catDef.grouped ? groupedTracksHtml(tracks) : tracks.map(tr=>trackHtml(tr)).join("");
    return `<div class="cat-title">${catDef.icon} ${t(catDef.labelKey)}</div>${qtyControl}${body}`;
  }).join("");

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
  cont.querySelectorAll("input[data-qty]").forEach(inp=>{
    inp.addEventListener("change", e=>{
      const key = inp.dataset.qty;
      const catDef = CATEGORIES.find(c=>c.key===key);
      const max = catDef.dynamic.max;
      let n = Math.max(0, Number(e.target.value)||0);
      if(max) n = Math.min(n, max);
      state.counts[key] = n;
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
  return track.levels.map((l,i)=>{
    const color = levelColor(track, l);
    return `<option value="${i}" ${i===idx?"selected":""} ${color?`style="color:${color}"`:""}>${levelLabel(track,l)}</option>`;
  }).join("");
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
