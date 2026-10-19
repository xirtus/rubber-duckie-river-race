import "./ui/style.css";
import { Race, DUCK_TYPES } from "./sim/race.js";
import {
  STEP,
  LENGTH,
  center,
  width,
  ground,
  surface,
  landmarks,
  overlooks,
  wildlife,
  hash,
  clamp,
} from "./sim/course.js";
import { snapshot } from "./presentation/snapshot.js";
import {
  scorePhoto,
  spectatorResult,
  checkpointAt,
} from "./sim/photography.js";
import {
  loadProgress,
  saveProgress,
  savePhoto,
  allPhotos,
} from "./ui/storage.js";
import { World } from "./render3d/world.js";

const app = document.querySelector("#app"),
  canvas = document.querySelector("#world");
app.innerHTML =
  '<div class="loading"><div class="spinner"></div><h2>The river is waking up.</h2><p>Growing the forest. Gathering the ducks.</p></div>';
let race = new Race(1842),
  state = snapshot(race),
  world,
  progress = loadProgress(),
  page = "menu",
  modal = null,
  owned = 37,
  mode = "classic",
  photoMode = false,
  tracker = true,
  sound = true,
  debug = false,
  photos = [],
  discoveries = [],
  prediction = null,
  predictionCorrect = false,
  finishedSaved = false,
  countdown = 0,
  visibleTicks = 0,
  watchedTicks = 0,
  ghost = [],
  lastGhostSecond = -1,
  runId = "",
  lastPhoto = -10,
  toastTimer;
const player = {
  x: center(18) + width(18) + 4.5,
  z: 18,
  y: ground(center(18) + width(18) + 4.5, 18) + 1.6,
  yaw: 0.8,
  pitch: -0.13,
  fov: 64,
  vy: 0,
  distance: 0,
};
const keys = new Set();
let drag = false,
  lookX = 0,
  lookY = 0,
  accumulator = 0,
  last = performance.now(),
  hudClock = 0;
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const clock = (t) =>
  `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
const unique = (a) => [...new Set(a)];
const duckIcon = (i = 0) =>
  `<span class="duckshape" style="--filter:${i === 0 ? "none" : i === 1 ? "hue-rotate(45deg)" : i === 2 ? "grayscale(1) brightness(.5)" : "hue-rotate(280deg)"}">🦆</span>`;

function shell() {
  return '<div id="screen"></div><div id="modal-root"></div><div class="toast" id="toast" role="status"></div><div class="flash" id="flash"></div>';
}
function menu() {
  if (page !== "menu") {
    race = new Race(1842);
    state = snapshot(race);
    world.setFlow(race.water);
    world.setWeather(race.weather);
  }
  page = "menu";
  modal = null;
  photoMode = false;
  document.exitPointerLock?.();
  app.innerHTML = shell();
  document.querySelector("#screen").innerHTML =
    `<div class="menu-shade"></div><header class="topbar"><div class="brand"><span class="brand-icon">♧</span> LITTLE WILD GAMES</div><nav class="nav"><button data-action="album">River Album</button><button data-action="book">Duck Book</button><button data-action="settings" class="outline">Settings ↗</button></nav></header><main class="menu-content"><div class="eyebrow park-label">An unhurried kind of adventure</div><h1>Rubber Duckie<br><em>River Race.</em></h1><p class="intro">One little duck. One wild river.<br>Choose your companion, follow the current, and collect the moments along the way.</p><div class="duck-pick" role="group" aria-label="Choose your duck">${[37, 91, 92, 93].map((id, i) => `<button class="duck-option ${owned === id ? "active" : ""}" data-duck="${id}" aria-label="Choose duck ${id}" aria-pressed="${owned === id}">${duckIcon(i)}<small>#${id}</small></button>`).join("")}<div class="duck-label">YOUR RIVER COMPANION<b id="duck-name">${owned === 37 ? "Good old #37" : owned === 91 ? "Explorer #91" : owned === 92 ? "Pirate #92" : "Rose #93"}</b></div></div><div class="start-row"><button class="primary" data-action="start">Let’s follow the river <span>↗</span></button><select id="mode" class="mode-select" aria-label="Race format"><option value="classic">Classic · 100 ducks</option><option value="daily">Today’s river · Daily</option><option value="mystery">Mystery Duck</option><option value="storm">Storm Run</option><option value="derby">Grand Derby · 150</option><option value="lantern" ${progress.races.length < 1 ? "disabled" : ""}>Lanterns ${progress.races.length < 1 ? "· 1 race to unlock" : ""}</option></select></div><p class="small-note" style="margin-top:15px">You run. You watch. The river decides. <button data-action="help" style="background:none;color:#e9d391;font-size:11px;padding:0 4px">How to play ↗</button></p></main><footer class="menu-bottom"><div class="edition"><span>EST. 2026</span><span class="line"></span><span>A SMALL ADVENTURE IN A VERY BIG WORLD</span></div><div class="course-card"><div class="eyebrow">YOUR FIRST WILDERNESS · 01</div><h3>Redwood River</h3><p>Through ancient giants and golden shallows.<br>Over the falls, into the unknown.</p><div class="course-facts"><span><i class="live-dot"></i> ${race.weather.name}</span><span>~ 5 min</span><span>8 overlooks</span></div></div></footer>`;
  document.querySelector("#mode").value = mode;
}
function hud() {
  document.querySelector("#screen").innerHTML =
    `<div class="hud-top"><div class="hud-duck"><div class="eyebrow">YOUR DUCK · #${owned}</div><div class="rank"><strong id="rank">—</strong><span id="rank-total">/ ${race.ducks.length}</span><span style="margin-left:auto">🦆</span></div><div class="progress"><i id="race-progress"></i></div><div class="small-note" id="duck-distance">The adventure begins</div></div><div class="hud-loc"><h3 id="location">Festival Pool</h3><p><span id="race-clock">0:00</span> · ${race.weather.name.toUpperCase()}</p><div id="checkpoint-window" style="font-size:10px;margin-top:9px;color:#f0d388"></div></div><div class="hud-tools"><button class="icon-button" data-action="map" title="Trail map [M]">Map</button><button class="icon-button" data-action="album" title="River Album">Album</button><button class="icon-button" data-action="settings" title="Settings">⚙</button></div></div><div class="reticle"></div><div class="viewfinder" id="viewfinder"><div class="viewfinder-label"><span>LIVE · THE RIVER KEEPS MOVING</span><span id="lens">35 mm</span></div></div><div class="hud-bottom"><div class="assignment"><div class="eyebrow">TODAY’S FIELD ASSIGNMENTS</div><div id="goals"></div><button data-action="predict" style="color:#e9d391;background:none;font-size:10px;padding:8px 0 0">Make a river prediction ↗</button></div><div class="controls"><span><kbd>W A S D</kbd> Walk</span><span><kbd>SHIFT</kbd> Run</span><span><kbd>C</kbd> Camera</span><span><kbd>SPACE</kbd> Jump</span><span>Drag to look</span></div><div><button class="photo-button" data-action="photo" aria-label="Take photograph [F]">◎</button><div class="photo-count" id="photo-count">0 photographs</div></div></div><div class="mobile-controls"><button class="touch-btn" data-key="KeyA">←</button><div class="vertical"><button class="touch-btn" data-key="KeyW">↑</button><button class="touch-btn" data-key="KeyS">↓</button></div><button class="touch-btn" data-key="KeyD">→</button><button class="touch-btn" data-key="ShiftLeft">⇧</button></div><div id="tracker-label" class="tracker-label" hidden>#${owned}</div><div id="countdown" class="countdown"></div><div id="debug"></div><div id="ghost-label" class="ghost-label"></div>`;
  updateHUD();
}
function start() {
  const seed =
    mode === "daily"
      ? hash(new Date().toISOString().slice(0, 10))
      : hash(`${Date.now()}-${progress.races.length}`);
  race = new Race(seed, mode);
  state = snapshot(race);
  page = "race";
  owned = Math.min(owned, race.ducks.length);
  tracker = mode !== "mystery";
  photos = [];
  discoveries = [];
  prediction = null;
  predictionCorrect = false;
  finishedSaved = false;
  visibleTicks = watchedTicks = 0;
  ghost = [];
  lastGhostSecond = -1;
  countdown = 3;
  accumulator = 0;
  lastPhoto = -10;
  runId = `${seed}-${Date.now()}`;
  Object.assign(player, {
    x: center(18) + width(18) + 4.5,
    z: 18,
    y: ground(center(18) + width(18) + 4.5, 18) + 1.6,
    yaw: 0.8,
    pitch: -0.13,
    fov: 64,
    vy: 0,
    distance: 0,
  });
  closeModal();
  hud();
  world.setWeather(race.weather);
  world.setFlow(race.water);
  audioStart();
  toast("Follow the bank. Drag to look. Press F to keep a moment.");
}
function toast(text) {
  clearTimeout(toastTimer);
  const e = document.querySelector("#toast");
  if (!e) return;
  e.textContent = text;
  toastTimer = setTimeout(() => (e.textContent = ""), 4300);
}
function updateHUD() {
  if (page !== "race") return;
  const d = state.ducks[owned - 1],
    distance = Math.hypot(d.x - player.x, d.z - player.z),
    loc = landmarks.reduce((a, b) =>
      Math.abs(b.z - player.z) < Math.abs(a.z - player.z) ? b : a,
    );
  document.querySelector("#rank").textContent = d.rank;
  document.querySelector("#race-progress").style.width =
    `${clamp((d.z / LENGTH) * 100, 0, 100)}%`;
  document.querySelector("#duck-distance").textContent =
    d.finish !== null
      ? `Finished in ${clock(d.finish)}`
      : `${Math.round(distance)} m ${d.z > player.z ? "downstream" : "upstream"} · ${d.falling ? "over the falls!" : "on the current"}`;
  document.querySelector("#location").textContent = loc.name;
  document.querySelector("#race-clock").textContent = clock(state.time);
  const pack = state.ducks.filter((d) => d.finish === null),
    nearPack = pack.some((d) => Math.abs(d.z - loc.z) < 20),
    passed = pack.length && pack.every((d) => d.z > loc.z + 20);
  document.querySelector("#checkpoint-window").textContent =
    Math.abs(player.z - loc.z) < 20
      ? nearPack
        ? "◎ Photo window open · the pack is passing"
        : passed
          ? "The pack has passed this photo point"
          : "◎ Get ready · the pack is approaching"
      : "";
  const checkpoints = new Set(
    photos.filter((p) => p.owned && p.checkpoint).map((p) => p.checkpoint),
  );
  const done = [
    checkpoints.size >= 3,
    photos.some((p) => p.owned && p.types.length > 1),
    discoveries.length > 0,
  ];
  document.querySelector("#goals").innerHTML = [
    `Your duck at 3 landmarks · ${checkpoints.size}/3`,
    "A classic & a curious duck together",
    "Discover a hidden overlook",
  ]
    .map(
      (s, i) =>
        `<div class="goal ${done[i] ? "done" : ""}">${done[i] ? "✓" : "○"} &nbsp;${s}</div>`,
    )
    .join("");
  document.querySelector("#photo-count").textContent =
    `${photos.length} photograph${photos.length === 1 ? "" : "s"}`;
  const p = world.project(d.x, d.y + 2.2, d.z),
    label = document.querySelector("#tracker-label");
  label.hidden = !tracker || !p.visible || !!modal;
  label.style.left = `${(p.x + 1) * 50}%`;
  label.style.top = `${(1 - p.y) * 50}%`;
  document.querySelector("#debug").innerHTML = debug
    ? `<div class="debug">Seed ${race.seed} · Tick ${race.tick}<br>Draw calls ${world.renderer.info.render.calls}<br>Triangles ${world.renderer.info.render.triangles.toLocaleString()}<br>Current ${Math.hypot(d.vx, d.vz).toFixed(2)} m/s<br>Depth ${race.water.sample(d.x, d.z, state.time).depth.toFixed(2)} m<br>Finished ${race.finished.length}/${race.ducks.length}<br>Duck force: water drag + gravity + collisions</div>`
    : "";
  const old = progress.ghosts[`${mode}:${race.seed}`];
  const past = old?.find((p) => p.t === Math.floor(state.time));
  world.setGhost(past, state.time);
  document.querySelector("#ghost-label").textContent = past
    ? `GHOST · ${Math.round(player.z - past.z)} m ${player.z >= past.z ? "ahead" : "behind"} your previous run`
    : "";
}
function modalOpen(name, title, body, eyebrow = "RUBBER DUCKIE · FIELD NOTES") {
  modal = name;
  keys.clear();
  document.exitPointerLock?.();
  document.querySelector("#modal-root").innerHTML =
    `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-head"><div><div class="eyebrow">${eyebrow}</div><h2>${title}</h2></div><button class="close" data-action="close" aria-label="Close">×</button></div>${body}${page === "race" ? '<p class="notice">● Live race — the ducks keep drifting while your field notes are open.</p>' : ""}</section></div>`;
  document.querySelector(".close")?.focus();
}
function closeModal() {
  modal = null;
  const el = document.querySelector("#modal-root");
  if (el) el.innerHTML = "";
}
function printCard(p) {
  return `<article class="print"><img src="${p.image}" alt="${esc(p.title)} — photograph taken at ${clock(p.time)}" loading="lazy"><h3>${esc(p.title)}</h3><p>${p.duckIds.length} ducks · ${clock(p.time)} · ${p.score} points</p><div class="print-actions"><button data-favorite="${p.id}">${p.favorite ? "★ Saved favorite" : "☆ Favorite"}</button><a href="${p.image}" download="river-${p.seed}-${p.tick}.jpg">Download ↗</a></div></article>`;
}
async function album(filter = "all") {
  modalOpen(
    "album",
    "Your River Album.",
    "<p>Opening the field archive…</p>",
    "LITTLE MOMENTS. KEPT FOREVER.",
  );
  try {
    const stored = await allPhotos();
    if (modal !== "album") return;
    const list =
      filter === "favorites" ? stored.filter((p) => p.favorite) : stored;
    modalOpen(
      "album",
      "Your River Album.",
      `<div class="tabs"><button data-album="all" class="${filter === "all" ? "active" : ""}">All photographs · ${stored.length}</button><button data-album="favorites" class="${filter === "favorites" ? "active" : ""}">Favorites</button><button data-action="history">Race scrapbooks · ${progress.races.length}</button></div>${list.length ? `<div class="photo-grid">${list.map(printCard).join("")}</div>` : '<div class="empty"><span style="font-size:34px">◎</span><h3>A story waiting to happen.</h3><p>Take your camera down to the river.<br>Your actual photographs will find a home here.</p></div>'}`,
      "LITTLE MOMENTS. KEPT FOREVER.",
    );
  } catch {
    toast(
      "The photo archive is unavailable in this browser. This race’s photos are still in memory.",
    );
  }
}
function book(tab = "ducks") {
  let content = "";
  if (tab === "ducks")
    content = DUCK_TYPES.map((t, i) => {
      const found = progress.book[t];
      return `<div class="collection ${found ? "" : "locked"}"><div class="emoji">${found ? duckIcon(i % 4) : "♧"}</div><h3>${t}</h3><p>${found ? `${found.shots} photographs · best finish ${found.best || "—"}` : "Not yet photographed"}</p></div>`;
    }).join("");
  if (tab === "wildlife")
    content = wildlife
      .map(
        (a) =>
          `<div class="collection ${progress.wildlife.includes(a.id) ? "" : "locked"}"><div class="emoji">${{ deer: "🦌", heron: "🪶", otter: "🦦", butterfly: "🦋" }[a.id]}</div><h3>${a.name}</h3><p>${progress.wildlife.includes(a.id) ? "Recorded in your journal" : "Look quietly. Look closely."}</p></div>`,
      )
      .join("");
  if (tab === "trails")
    content = overlooks
      .map(
        (o) =>
          `<div class="collection ${progress.trails.includes(o.id) ? "" : "locked"}"><div class="emoji">⌁</div><h3>${o.name}</h3><p>${progress.trails.includes(o.id) ? "Discovered" : "A little way off the trail"}</p></div>`,
      )
      .join("");
  modalOpen(
    "book",
    "The field collection.",
    `<div class="tabs">${["ducks", "wildlife", "trails"].map((t) => `<button data-book="${t}" class="${tab === t ? "active" : ""}">${t === "ducks" ? "Duck Book" : t === "wildlife" ? "Wildlife journal" : "Trail discoveries"}</button>`).join("")}</div><div class="collection-grid">${content}</div><div class="ribbons">${progress.ribbons.map((r) => `<span class="ribbon">✺ ${r}</span>`).join("")}</div><p>${progress.stamps} park stamps earned · ${progress.races.length} rivers witnessed</p>`,
  );
}
function map() {
  const path = Array.from({ length: 101 }, (_, i) => {
    const z = (i / 100) * LENGTH;
    return `${i ? "L" : "M"}${75 + z * 0.95},${130 + center(z) * 1.5}`;
  }).join(" ");
  modalOpen(
    "map",
    "Take the long way home.",
    `<svg class="map" viewBox="0 0 840 300" role="img" aria-label="River trail map with checkpoints and your location"><path d="${path}" fill="none" stroke="#c4c7a6" stroke-width="34"/><path d="${path}" fill="none" stroke="#7eaba0" stroke-width="18"/><path d="${path}" fill="none" stroke="#d4e5d8" stroke-width="2" stroke-dasharray="4 8"/>${landmarks.map((l, i) => `<circle cx="${75 + l.z * 0.95}" cy="${130 + center(l.z) * 1.5}" r="5" fill="#375e45"/><text x="${75 + l.z * 0.95}" y="${130 + center(l.z) * 1.5 + (i % 2 ? 40 : -25)}" font-size="10" fill="#3c5642" text-anchor="middle">${l.name}</text>`).join("")}<circle cx="${75 + player.z * 0.95}" cy="${130 + center(player.z) * 1.5 + 20}" r="7" fill="#d49b3b" stroke="#fff4cf" stroke-width="2"/></svg><div class="route-legend"><span>● You · gold marker</span><span>720 m of wild river · 8 photo points</span><span>North bank trail →</span></div><div class="help-list"><div><h3>Hidden in the redwoods</h3><p>Leave the marked path at Gold Bend or Three Sisters Fork. Old signs lead to forgotten overlooks.</p></div><div><h3>Beat them to the falls</h3><p>Sprint the bank while the current slows in deep pools. A photo point counts only while the pack is passing.</p></div></div>`,
  );
}
function predict() {
  if (prediction) {
    modalOpen(
      "predict",
      "The river has your answer.",
      `<p>You called the <b>${prediction}</b> channel at Three Sisters Fork. ${race.ducks[owned - 1].fork ? (predictionCorrect ? "A good eye. Your river stamp is earned." : "The river had another idea. There is always another race.") : "The ducks are still on their way."}</p>`,
    );
    return;
  }
  if (race.ducks[owned - 1].z >= 290) {
    toast("The fork prediction window has closed. Try next race.");
    return;
  }
  modalOpen(
    "predict",
    "Which way will your duck go?",
    `<p>At Three Sisters Fork, the current splits around a wooded island. Call your duck’s channel before it gets there. A correct prediction earns a stamp.</p><div class="prediction"><button data-predict="left">↖ Left channel<br><small>The quiet way</small></button><button data-predict="right">↗ Right channel<br><small>The outside current</small></button></div><p>Your prediction has no effect on the river.</p>`,
    "A LITTLE RIVER INTUITION",
  );
}
function settings() {
  modalOpen(
    "settings",
    "Make yourself at home.",
    `<div class="settings-row"><span>River & forest sound</span><input id="sound" type="checkbox" ${sound ? "checked" : ""} aria-label="Enable nature sound"></div><div class="settings-row"><span>Duck tracker ${mode === "mystery" ? "· disabled in Mystery Duck" : ""}</span><input id="tracker" type="checkbox" ${tracker ? "checked" : ""} ${mode === "mystery" ? "disabled" : ""} aria-label="Show duck tracker"></div><div class="settings-row"><span>Render quality</span><select id="quality"><option value="1">Balanced</option><option value="1.5" selected>High</option><option value=".75">Performance</option></select></div><div class="settings-row"><span>River witness diagnostics</span><input id="diagnostics" type="checkbox" ${debug ? "checked" : ""} aria-label="Show diagnostics"></div><p style="margin-top:20px">Mouse: drag to look, or double-click the landscape to lock the pointer. Escape releases it. The race continues while you read.</p>${page === "race" ? '<div class="finish-actions"><button class="secondary" data-action="help">Controls & field guide</button><button class="secondary" data-action="leave">Return to riverside</button></div>' : ""}`,
  );
}
function help() {
  modalOpen(
    "help",
    "You’re here for the journey.",
    `<p>Your duck is one of a hundred. Gravity, water, and a remarkable amount of bad luck decide where it finishes. Your adventure is everything happening beside it.</p><div class="help-list"><div><h3>01 · Follow the current</h3><p>WASD or arrow keys to walk. Shift to sprint. Space to jump. Drag anywhere on the landscape to look around; double-click for mouse capture. Stay on the banks or cross the timber bridges.</p></div><div><h3>02 · Keep a moment</h3><p>C raises the camera. Mouse wheel zooms. F or the round shutter takes a real photograph. The world never pauses. Frame your duck, rare companions, wildlife, or a passing waterfall moment.</p></div><div><h3>03 · Take a detour</h3><p>M opens the trail map. Named photo checkpoints only count while the ducks are passing. Wander beyond the trail to find hidden overlooks and earn exploration ribbons.</p></div><div><h3>04 · Bring a story home</h3><p>The last duck triggers your scrapbook. Photos save automatically to this browser’s River Album. Favorite or download them. Finish once to unlock the blue-hour Lantern Event.</p></div></div>`,
    "A FIELD GUIDE FOR FIRST-TIME SPECTATORS",
  );
}
async function takePhoto() {
  if (page !== "race" || countdown > 0) return;
  if (state.time - lastPhoto < 0.8) {
    toast("Let the shutter settle for a moment.");
    return;
  }
  lastPhoto = state.time;
  world.update(state, player, false, owned, false);
  const subjects = world.photoSubjects(state, true),
    wild = wildlife
      .filter((a) => {
        const p = world.project(a.x, ground(a.x, a.z) + 1, a.z);
        return (
          p.visible &&
          world.sightline(a.x, ground(a.x, a.z) + 1, a.z) &&
          Math.hypot(a.x - player.x, a.z - player.z) < 40
        );
      })
      .map((a) => a.id);
  const cp = checkpointAt({ ...player, riverX: center(player.z) }, state.ducks);
  const result = scorePhoto({
    subjects,
    ownedId: owned,
    checkpoint: cp,
    events: state.events,
    wildlife: wild,
    horizon: player.pitch,
  });
  const near = landmarks.reduce((a, b) =>
    Math.abs(b.z - player.z) < Math.abs(a.z - player.z) ? b : a,
  );
  const photo = {
    ...result,
    id: `${runId}-${state.tick}-${photos.length}`,
    seed: race.seed,
    tick: state.tick,
    time: state.time,
    created: Date.now(),
    runId,
    title: cp
      ? landmarks.find((l) => l.id === cp).name
      : wild.length
        ? wildlife.find((w) => w.id === wild[0]).name
        : near.name,
    image: world.capture(),
    favorite: false,
    camera: { ...player },
    weather: state.weather.name,
  };
  photos.push(photo);
  for (const type of result.types) {
    const e = (progress.book[type] ??= { shots: 0, best: null });
    e.shots++;
  }
  progress.wildlife = unique([...progress.wildlife, ...wild]);
  try {
    await savePhoto(photo);
    saveProgress(progress);
  } catch {
    toast(
      "Photo captured, but storage is full. Download it from this race’s scrapbook.",
    );
    return;
  }
  document.querySelector("#flash").classList.remove("shot");
  requestAnimationFrame(() =>
    document.querySelector("#flash").classList.add("shot"),
  );
  toast(
    `${photo.title} · ${result.score} points${result.owned ? " · your duck in frame" : ""}${cp && result.checkpoint ? " · checkpoint ✓" : ""}`,
  );
  updateHUD();
}
function finish() {
  if (finishedSaved) return;
  finishedSaved = true;
  const d = state.ducks[owned - 1],
    result = spectatorResult(
      photos,
      discoveries,
      predictionCorrect,
      visibleTicks / Math.max(1, watchedTicks),
    );
  const entry = {
    id: runId,
    seed: race.seed,
    date: new Date().toISOString(),
    duck: owned,
    count: race.ducks.length,
    rank: d.rank,
    time: d.finish,
    photoIds: photos.map((p) => p.id),
    result,
    weather: race.weather.name,
    bumps: d.bumps,
    falls: d.falls,
    spins: Math.round(d.spins),
    eddyTime: Math.round(d.eddyTime),
  };
  progress.races.push(entry);
  progress.ribbons = unique([...progress.ribbons, ...result.ribbons]);
  progress.stamps +=
    Math.max(1, result.checkpoints) + (predictionCorrect ? 1 : 0);
  for (const duck of state.ducks) {
    const b = progress.book[duck.type];
    if (b) b.best = b.best === null ? duck.rank : Math.min(b.best, duck.rank);
  }
  progress.ghosts[`${mode}:${race.seed}`] = ghost;
  const ghostKeys = Object.keys(progress.ghosts);
  if (ghostKeys.length > 10) delete progress.ghosts[ghostKeys[0]];
  try {
    saveProgress(progress);
  } catch {
    toast("Progress storage is full. Your photos remain in the River Album.");
  }
  showFinish(entry, photos);
}
function showFinish(e, shots) {
  modalOpen(
    "finish",
    "Every duck has a story.",
    `<p>${esc(e.weather)} · Duck #${e.duck} found its way home in ${e.rank}${e.rank === 1 ? "st" : e.rank === 2 ? "nd" : e.rank === 3 ? "rd" : "th"} place. Here’s the river as you saw it.</p><div class="stats"><div class="stat"><strong>${e.result.grade}</strong><span>YOUR SPECTATOR GRADE</span></div><div class="stat"><strong>${e.rank} / ${e.count || 100}</strong><span>YOUR DUCK’S VERY OWN RESULT</span></div><div class="stat"><strong>${shots.length}</strong><span>MOMENTS YOU KEPT</span></div><div class="stat"><strong>${e.result.checkpoints} / 8</strong><span>PHOTO CHECKPOINTS</span></div></div><div class="ribbons">${e.result.ribbons.map((r) => `<span class="ribbon">✺ ${r}</span>`).join("")}</div><p>${e.bumps} plastic collisions. ${e.falls} dramatic tumbles. ${e.spins} full turns of absolutely no purpose. ${e.eddyTime} seconds contemplating an eddy.</p><div class="finish-actions"><button class="primary" data-action="again">Another beautiful day ↗</button><button class="secondary" data-action="album">Open River Album</button></div>${shots.length ? `<div class="photo-grid">${shots.map(printCard).join("")}</div>` : '<div class="empty"><h3>Some days are just for watching.</h3><p>No photographs this time. Bring your camera on the next river walk.</p></div>'}<p style="margin-top:22px">✧ ${progress.races.length === 1 ? "Lantern Event unlocked. A whole new light on the river." : "Your scrapbook is saved in the River Album."}</p>`,
    "RIVER SCRAPBOOK · " + e.seed,
  );
}
function history() {
  modalOpen(
    "history",
    "Days by the river.",
    progress.races.length
      ? progress.races
          .slice()
          .reverse()
          .map(
            (r) =>
              `<button data-history="${r.id}" class="settings-row" style="width:100%;text-align:left;background:none;color:#33523c"><span>${new Date(r.date).toLocaleDateString()} · ${esc(r.weather)}<br><small>Duck #${r.duck} · ${r.photoIds.length} photographs</small></span><span>Grade ${r.result.grade} ↗</span></button>`,
          )
          .join("")
      : '<div class="empty"><h3>The first chapter is yours.</h3><p>Finish a race to start your scrapbook collection.</p></div>',
  );
}

app.addEventListener("click", async (e) => {
  const b = e.target.closest("button,a");
  if (!b) return;
  if (b.dataset.duck) {
    owned = +b.dataset.duck;
    menu();
    return;
  }
  if (b.dataset.book) {
    book(b.dataset.book);
    return;
  }
  if (b.dataset.album) {
    album(b.dataset.album);
    return;
  }
  if (b.dataset.predict) {
    if (race.ducks[owned - 1].z >= 290) {
      toast("The prediction window has closed.");
      closeModal();
      return;
    }
    prediction = b.dataset.predict;
    closeModal();
    toast(`Prediction sealed: ${prediction} channel. The river will decide.`);
    return;
  }
  if (b.dataset.favorite) {
    try {
      const p = (await allPhotos()).find((p) => p.id === b.dataset.favorite);
      if (p) {
        p.favorite = !p.favorite;
        await savePhoto(p);
        b.textContent = p.favorite ? "★ Saved favorite" : "☆ Favorite";
      }
    } catch {
      toast("Could not save this favorite.");
    }
    return;
  }
  if (b.dataset.history) {
    const r = progress.races.find((r) => r.id === b.dataset.history),
      ps = await allPhotos();
    showFinish(
      r,
      ps.filter((p) => r.photoIds.includes(p.id)),
    );
    return;
  }
  const action = b.dataset.action;
  ({
    start,
    album,
    book,
    map,
    predict,
    settings,
    help,
    close: closeModal,
    photo: takePhoto,
    history,
    again: () => {
      closeModal();
      menu();
    },
    leave: () => {
      closeModal();
      menu();
      toast("Back at the river. Your photographs have been saved.");
    },
  })[action]?.();
});
app.addEventListener("change", (e) => {
  if (e.target.id === "mode") mode = e.target.value;
  if (e.target.id === "sound") {
    sound = e.target.checked;
    if (audio) audio.gain.gain.value = sound ? 0.035 : 0;
  }
  if (e.target.id === "tracker") tracker = e.target.checked;
  if (e.target.id === "diagnostics") {
    debug = e.target.checked;
    world.debug = debug;
  }
  if (e.target.id === "quality") world.renderer.setPixelRatio(+e.target.value);
});
app.addEventListener("pointerdown", (e) => {
  const b = e.target.closest("[data-key]");
  if (b) {
    e.preventDefault();
    keys.add(b.dataset.key);
    b.setPointerCapture(e.pointerId);
  }
});
app.addEventListener("pointerup", (e) => {
  const b = e.target.closest("[data-key]");
  if (b) keys.delete(b.dataset.key);
});
app.addEventListener("pointercancel", () => keys.clear());
window.addEventListener("keydown", (e) => {
  if (e.target.matches("input,select")) return;
  if (page !== "race") return;
  if (
    ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
      e.code,
    )
  )
    e.preventDefault();
  if (e.code === "Escape") {
    closeModal();
    return;
  }
  if (modal) return;
  keys.add(e.code);
  if (e.repeat) return;
  if (e.code === "KeyF") takePhoto();
  if (e.code === "KeyC") {
    photoMode = !photoMode;
    player.fov = photoMode ? 45 : 64;
    document.querySelector("#viewfinder").classList.toggle("on", photoMode);
  }
  if (e.code === "KeyM") map();
  if (e.code === "KeyP") predict();
  if (e.code === "KeyH") {
    tracker = !tracker && mode !== "mystery";
    toast(tracker ? "Duck tracker on." : "Immersive walk · tracker off.");
  }
  if (e.code === "Space" && player.vy === 0) player.vy = 5;
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
window.addEventListener("blur", () => {
  keys.clear();
  drag = false;
});
canvas.addEventListener("pointerdown", (e) => {
  if (page !== "race" || modal) return;
  drag = true;
  lookX = e.clientX;
  lookY = e.clientY;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointerup", () => (drag = false));
canvas.addEventListener("pointercancel", () => (drag = false));
canvas.addEventListener("dblclick", () => {
  if (page === "race" && !modal) canvas.requestPointerLock?.();
});
window.addEventListener("pointermove", (e) => {
  if (page !== "race" || modal) return;
  if (document.pointerLockElement === canvas) {
    player.yaw -= e.movementX * 0.0025;
    player.pitch = clamp(player.pitch - e.movementY * 0.0025, -1.15, 1.15);
  } else if (drag) {
    player.yaw -= (e.clientX - lookX) * 0.004;
    player.pitch = clamp(
      player.pitch - (e.clientY - lookY) * 0.004,
      -1.15,
      1.15,
    );
    lookX = e.clientX;
    lookY = e.clientY;
  }
});
canvas.addEventListener(
  "wheel",
  (e) => {
    if (page === "race" && photoMode) {
      e.preventDefault();
      player.fov = clamp(player.fov + e.deltaY * 0.035, 20, 70);
      document.querySelector("#lens").textContent =
        `${Math.round((35 * 64) / player.fov)} mm`;
    }
  },
  { passive: false },
);

let audio;
function audioStart() {
  if (audio) return;
  try {
    const ctx = new AudioContext(),
      buffer = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate),
      data = buffer.getChannelData(0);
    let b = 0;
    for (let i = 0; i < data.length; i++) {
      b = (b + Math.random() * 0.08 - 0.04) / 1.02;
      data[i] = b * 3;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 950;
    const gain = ctx.createGain();
    gain.gain.value = sound ? 0.035 : 0;
    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start();
    audio = { ctx, gain, filter };
  } catch {}
}
function move(dt) {
  if (modal) return;
  const forward =
      (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) -
      (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0),
    strafe =
      (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) -
      (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0),
    speed = keys.has("ShiftLeft") || keys.has("ShiftRight") ? 7.8 : 3.8,
    normal = Math.max(1, Math.hypot(forward, strafe)),
    dx =
      ((-Math.sin(player.yaw) * forward + Math.cos(player.yaw) * strafe) *
        speed *
        dt) /
      normal,
    dz =
      ((-Math.cos(player.yaw) * forward - Math.sin(player.yaw) * strafe) *
        speed *
        dt) /
      normal;
  let nx = clamp(player.x + dx, -180, 180),
    nz = clamp(player.z + dz, -10, 750);
  const bridge = [24, 419].find((z) => Math.abs(z - nz) < 1.5),
    edge = width(nz) + 1.4;
  if (bridge === undefined && Math.abs(nx - center(nz)) < edge)
    nx = center(nz) + (player.x - center(player.z) >= 0 ? 1 : -1) * edge;
  if (
    !world.trees.some(
      (t) =>
        Math.abs(t.z - nz) < 3 &&
        Math.hypot(t.x - nx, t.z - nz) < Math.max(0.6, t.r),
    )
  ) {
    player.distance += Math.hypot(nx - player.x, nz - player.z);
    player.x = nx;
    player.z = nz;
  }
  const floor =
    bridge !== undefined &&
    Math.abs(player.x - center(player.z)) < width(player.z) + 4
      ? surface(bridge) + 3.3
      : ground(player.x, player.z);
  if (player.vy !== 0) {
    player.vy -= 9.81 * dt;
    player.y += player.vy * dt;
    if (player.y <= floor + 1.6) {
      player.y = floor + 1.6;
      player.vy = 0;
    }
  } else player.y += (floor + 1.6 - player.y) * Math.min(1, dt * 12);
  for (const o of overlooks)
    if (
      !discoveries.includes(o.id) &&
      Math.hypot(player.x - o.x, player.z - o.z) < 10
    ) {
      discoveries.push(o.id);
      progress.trails = unique([...progress.trails, o.id]);
      try {
        saveProgress(progress);
      } catch {}
      toast(`Hidden overlook discovered · ${o.name}`);
    }
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.15);
  last = now;
  if (!world) return;
  if (page === "race") {
    if (countdown > 0) {
      countdown -= dt;
      document.querySelector("#countdown").innerHTML =
        countdown > 0
          ? `<strong>${Math.ceil(countdown)}</strong><p>100 LITTLE LEAPS OF FAITH</p>`
          : "";
    } else {
      accumulator += dt;
      while (accumulator >= STEP) {
        if (!race.done) race.step();
        move(STEP);
        accumulator -= STEP;
      }
      state = snapshot(race);
      if (prediction && race.ducks[owned - 1].fork)
        predictionCorrect = prediction === race.ducks[owned - 1].fork;
      if (Math.floor(state.time) !== lastGhostSecond) {
        lastGhostSecond = Math.floor(state.time);
        ghost.push({
          t: lastGhostSecond,
          x: Math.round(player.x * 10) / 10,
          z: Math.round(player.z * 10) / 10,
        });
      }
      if (race.done) finish();
    }
    world.update(state, player, false, owned, tracker);
    const p = world.photoSubjects(state).find((d) => d.id === owned);
    if (countdown <= 0 && !race.done) {
      watchedTicks++;
      if (p.visible && p.distance < 100) visibleTicks++;
    }
    hudClock += dt;
    if (hudClock > 0.12) {
      updateHUD();
      hudClock = 0;
    }
    if (audio && sound) {
      const falls = Math.min(
        Math.abs(player.z - 242),
        Math.abs(player.z - 517),
      );
      audio.gain.gain.setTargetAtTime(
        0.028 + 0.07 * Math.exp(-falls / 35),
        audio.ctx.currentTime,
        0.3,
      );
    }
  } else world.update(state, player, true, owned, false);
}

// Explicit development harness; omitted by the production bundler. It exercises
// the same race and photograph paths without waiting several real-time minutes.
if (import.meta.env.DEV && new URLSearchParams(location.search).has("test"))
  window.riverTest = {
    getSnapshot: () => snapshot(race),
    getPlayer: () => ({ ...player }),
    getProgress: () => structuredClone(progress),
    advance(ticks) {
      countdown = 0;
      document.querySelector("#countdown").innerHTML = "";
      for (let i = 0; i < ticks && !race.done; i++) race.step();
      state = snapshot(race);
      world.update(state, player, false, owned, tracker);
      updateHUD();
      if (race.done) finish();
      return { tick: race.tick, finished: race.finished.length };
    },
    stand(z, yaw = 2.2, pitch = -0.13, offset = 4.5) {
      player.z = z;
      player.x = center(z) + width(z) + offset;
      player.y = ground(player.x, z) + 1.6;
      player.yaw = yaw;
      player.pitch = pitch;
      world.update(state, player, false, owned, tracker);
      updateHUD();
    },
    metrics: () => ({
      calls: world.renderer.info.render.calls,
      triangles: world.renderer.info.render.triangles,
      geometries: world.renderer.info.memory.geometries,
      textures: world.renderer.info.memory.textures,
    }),
  };
setTimeout(() => {
  try {
    world = new World(canvas, race.water);
    world.setFlow(race.water);
    menu();
    requestAnimationFrame(frame);
  } catch (e) {
    console.error(e);
    app.innerHTML = `<div class="loading"><h2>The river needs a little help.</h2><p>${esc(e.message)}</p><p>Use a browser with WebGL 2 enabled, then reload.</p></div>`;
  }
}, 50);
