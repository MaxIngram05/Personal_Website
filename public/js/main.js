// Boot: start gate, hash router, keyboard controls, sound toggle, Konami code.

import { pixelSVG } from "./icons.js";
import { setMuted, isMuted, unlock, chime } from "./audio.js";
import { starfield, dissolve, reducedMotion } from "./fx.js";
import { skipTyping, isTyping } from "./dialogue.js";
import { homeScene, projectsScene, journeyScene, aboutScene, contactScene } from "./scenes.js";

const SCENES = ["home", "projects", "journey", "about", "contact"];
const $ = (s, r = document) => r.querySelector(s);

const app = $("#app");
const gate = $("#gate");
const stars = starfield($("#stars"));
const dissolveCanvas = $("#dissolve");
const menuLinks = [...document.querySelectorAll(".battle-btn")];

const dataReady = fetch("/data/content.json").then((r) => r.json());
const controllers = {};
let currentScene = null;
let queue = Promise.resolve();

// ---------------------------------------------------------------- toast ---
let toastTimer = 0;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}

// --------------------------------------------------------------- router ---
function parse(hash) {
  const [scene, param] = hash.replace(/^#\/?/, "").split("/");
  if (!scene) return { scene: "home" };
  return SCENES.includes(scene) ? { scene, param: param ? decodeURIComponent(param) : undefined } : null;
}

function go(scene) {
  location.hash = scene;
}

function show(scene, param) {
  controllers[currentScene]?.leave?.();
  document.querySelectorAll(".scene").forEach((s) => (s.hidden = s.dataset.scene !== scene));
  currentScene = scene;
  document.body.dataset.scene = scene;
  menuLinks.forEach((a) => (a.dataset.route === scene ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
  stars.setScene(scene);
  window.scrollTo(0, 0);
  controllers[scene]?.enter?.(param);
  const heading = $(`#h-${scene}`);
  // Projects focuses its own detail panel when a project is deep-linked.
  if (heading && !(scene === "projects" && param)) heading.focus({ preventScroll: true });
}

function route() {
  queue = queue.then(async () => {
    const r = parse(location.hash);
    if (!r) return; // e.g. a stray in-page anchor
    if (r.scene === currentScene) {
      controllers[r.scene]?.enter?.(r.param);
      return;
    }
    const bg = getComputedStyle(document.body).getPropertyValue("--bg").trim() || "#000";
    if (currentScene === null) show(r.scene, r.param);
    else await dissolve(dissolveCanvas, () => show(r.scene, r.param), bg);
  });
}

// ----------------------------------------------------------- start gate ---
function setupGate() {
  const heart = $("#gate-heart");
  heart.innerHTML = pixelSVG("heart", { scale: 12 }) + heart.innerHTML;
  heart.focus();

  let started = false;
  heart.addEventListener("click", async (e) => {
    if (started) return;
    started = true;
    unlock();
    const rect = heart.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    // Keyboard "clicks" have no pointer position: shrink in place.
    const x = e.detail ? e.clientX : cx;
    const y = e.detail ? e.clientY : cy;

    if (!reducedMotion()) {
      heart.style.setProperty("--tx", `${x - cx}px`);
      heart.style.setProperty("--ty", `${y - cy}px`);
      heart.style.setProperty("--s", String(22 / rect.width));
      gate.classList.add("opening");
      await new Promise((r) => setTimeout(r, 700));
    }
    document.documentElement.classList.add("soul");
    await dataReady;
    app.inert = false;
    gate.remove();
    // A shared deep link (#projects/jumpshrek) opens where it points, but a
    // reload or back/forward restart always begins at home, not on the last page.
    const nav = performance.getEntriesByType("navigation")[0];
    if (location.hash && nav && nav.type !== "navigate") history.replaceState(null, "", location.pathname);
    route();
  });
}

// ------------------------------------------------------------- keyboard ---
const KONAMI = ["arrowup", "arrowup", "arrowdown", "arrowdown", "arrowleft", "arrowright", "arrowleft", "arrowright", "b", "a"];
let konamiPos = 0;

function toggleHard(data) {
  const on = document.documentElement.classList.toggle("hard");
  $("#hard-badge").hidden = !on;
  stars.setHard(on);
  chime();
  toast(on ? data.hardMode.on : data.hardMode.off);
}

function moveMenu(dir) {
  let i = menuLinks.indexOf(document.activeElement);
  if (i === -1) i = menuLinks.findIndex((a) => a.dataset.route === currentScene);
  if (i === -1) i = dir > 0 ? -1 : 0;
  menuLinks[(i + dir + menuLinks.length) % menuLinks.length].focus();
}

function onKey(e, data) {
  if (gate.isConnected) return; // the heart button handles its own Enter
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const key = e.key.toLowerCase();

  konamiPos = key === KONAMI[konamiPos] ? konamiPos + 1 : key === KONAMI[0] ? 1 : 0;
  if (konamiPos === KONAMI.length) {
    konamiPos = 0;
    toggleHard(data);
    return;
  }

  // Any key finishes typing dialogue; confirm keys are consumed doing so.
  if (isTyping() && !["tab", "shift", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
    skipTyping();
    if (key === "enter" || key === "z" || key === " ") {
      e.preventDefault();
      return;
    }
  }

  const target = e.target;
  if (target.closest?.("input, textarea, select, [contenteditable]")) return;

  if (controllers[currentScene]?.onKey?.(e)) {
    e.preventDefault();
    return;
  }
  if (key === "arrowleft" || key === "arrowright") {
    e.preventDefault();
    moveMenu(key === "arrowright" ? 1 : -1);
  } else if (key === "z") {
    const el = document.activeElement;
    if (el?.matches("a[href], button")) {
      e.preventDefault();
      el.click();
    }
  } else if ((key === "escape" || key === "x") && currentScene !== "home") {
    e.preventDefault();
    go("home");
  }
}

// ----------------------------------------------------------------- boot ---
function setupChrome() {
  menuLinks.forEach((a) => {
    const ico = a.querySelector(".battle-ico");
    ico.innerHTML = `<span class="ico-main">${pixelSVG(ico.dataset.icon, { scale: 3 })}</span><span class="ico-heart">${pixelSVG("heart", { scale: 3 })}</span>`;
  });

  const sound = $("#sound-toggle");
  const paint = () => {
    sound.textContent = isMuted() ? "SOUND: OFF" : "SOUND: ON";
    sound.setAttribute("aria-pressed", String(!isMuted()));
  };
  paint();
  sound.addEventListener("click", () => {
    setMuted(!isMuted());
    paint();
    chime();
  });

  $("[data-skip]").addEventListener("click", (e) => {
    e.preventDefault();
    $(`#h-${currentScene}`)?.focus();
  });

  // Click a dialogue box to finish its text.
  document.addEventListener("click", (e) => {
    if (e.target.closest(".dialogue, [data-skippable]")) skipTyping();
  });
}

async function boot() {
  setupGate();
  setupChrome();
  let data;
  try {
    data = await dataReady;
  } catch (err) {
    $("#scene-home").innerHTML = `<p class="box dialogue">* The content file failed to load. (${String(err.message || err)})</p>`;
    return;
  }
  const api = { go, toast };
  controllers.home = homeScene($("#scene-home"), data, api);
  controllers.projects = projectsScene($("#scene-projects"), data, api);
  controllers.journey = journeyScene($("#scene-journey"), data, api);
  controllers.about = aboutScene($("#scene-about"), data, api);
  controllers.contact = contactScene($("#scene-contact"), data, api);

  window.addEventListener("hashchange", route);
  document.addEventListener("keydown", (e) => onKey(e, data));
}

boot();
