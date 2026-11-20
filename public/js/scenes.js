// Scene renderers. Each returns { enter(param), leave(), onKey(e) } and builds
// its DOM from content.json, so layout and text stay separate.

import { pixelSVG } from "./icons.js";
import { typeText } from "./dialogue.js";
import { pluck, STRINGS, chime } from "./audio.js";
import { reducedMotion } from "./fx.js";

const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const HEART = pixelSVG("heart", { scale: 2 });
const heartSlot = `<span class="heart-slot" aria-hidden="true">${HEART}</span>`;
const pick = (list, not) => {
  if (list.length < 2) return list[0];
  let item;
  do item = list[(Math.random() * list.length) | 0];
  while (item === not);
  return item;
};

const STATUS_CLASS = {
  SHIPPED: "shipped",
  "IN PROGRESS": "progress",
  "COMING SOON": "soon",
  HACKATHON: "hack",
  GAMEJAM: "hack",
};

function badge(p) {
  const note = p.statusNote ? ` <span class="badge-note">/ ${esc(p.statusNote)}</span>` : "";
  return `<span class="badge badge-${STATUS_CLASS[p.status] || "soon"}">${esc(p.status)}${note}</span>`;
}

// Image, or a labelled placeholder box until the real file exists.
function media(src, alt, hint, { fit = "cover", cls = "" } = {}) {
  if (src) {
    return `<img class="media-img ${cls} fit-${fit}" src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async">`;
  }
  return `<div class="placeholder ${cls}" role="img" aria-label="${esc(alt || "Image coming soon")}"><span>IMAGE TODO</span><code>${esc(hint || "")}</code></div>`;
}

// Move focus up/down within a list of elements with arrow keys.
function arrowFocus(e, items) {
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return false;
  const i = items.indexOf(document.activeElement);
  if (i === -1) return false;
  const next = items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length];
  next.focus();
  return true;
}

// ---------------------------------------------------------------- HOME ---
export function homeScene(el, data) {
  const { profile, home } = data;
  el.innerHTML = `
    <div class="home">
      <div class="home-title">
        <h1 id="h-home" class="title" tabindex="-1">${esc(profile.name.toUpperCase())}</h1>
        <p class="subtitle">SOFTWARE ENGINEERING STUDENT</p>
      </div>
      <div class="home-grid">
        <div class="avatar-stage">
          <div class="avatar" role="img" aria-label="Pixel art of Max: red hair, black t-shirt, blue jeans, blinking idly"></div>
          <div class="avatar-floor" aria-hidden="true"></div>
        </div>
        <div class="box dialogue home-dialogue" data-skippable>
          <p class="dialogue-text"></p>
        </div>
      </div>
      <section class="box status" aria-labelledby="status-title">
        <h2 id="status-title" class="box-title">STATUS</h2>
        <dl class="status-grid">
          <div><dt>NAME</dt><dd>${esc(profile.fullName.toUpperCase())}</dd></div>
          <div><dt>${esc(profile.level)}</dt><dd>${esc(profile.class)}</dd></div>
          <div class="hp"><dt>HP</dt><dd><span class="hp-bar" aria-hidden="true"><i></i></span> 20 / 20</dd></div>
          <div><dt>LOC</dt><dd>${esc(profile.location)}</dd></div>
          <div><dt>LANG</dt><dd>${esc(profile.languages)}</dd></div>
          <div class="quest-row"><dt>QUEST</dt><dd>${esc(profile.quest)}</dd></div>
        </dl>
      </section>
      <p class="hint">${esc(home.hint)}</p>
    </div>`;

  const text = el.querySelector(".dialogue-text");
  let last = null;
  return {
    enter() {
      last = pick(home.greetings, last);
      typeText(text, last);
    },
  };
}

// ------------------------------------------------------------ PROJECTS ---
export function projectsScene(el, data, { go }) {
  const projects = data.projects;
  el.innerHTML = `
    <header class="scene-head">
      <h1 id="h-projects" class="title" tabindex="-1">PROJECTS</h1>
      <p class="scene-sub">* You open your inventory. ${projects.length} items.</p>
    </header>
    <div class="inv">
      <div class="box inv-list">
        <h2 class="box-title">ITEMS</h2>
        <ul class="item-list" role="list">
          ${projects
            .map(
              (p) => `
            <li>
              <a class="item" href="#projects/${esc(p.id)}" data-id="${esc(p.id)}">
                ${heartSlot}
                <span class="item-ico">${pixelSVG(p.icon, { scale: 3 })}</span>
                <span class="item-main">
                  <span class="item-top">
                    <span class="item-name">${esc(p.name)}${p.award ? ' <span class="item-star" aria-label="award winner">★</span>' : ""}</span>
                    ${badge(p)}
                  </span>
                  <span class="item-short">${esc(p.short)}</span>
                </span>
              </a>
            </li>`
            )
            .join("")}
        </ul>
      </div>
      <article id="project-detail" class="box detail" aria-live="polite">
        <p class="detail-empty">* Select an item to inspect it.</p>
      </article>
    </div>`;

  const detail = el.querySelector("#project-detail");
  const items = [...el.querySelectorAll(".item")];
  let current = null;

  function open(id) {
    const p = projects.find((x) => x.id === id);
    if (!p) return close();
    current = id;
    items.forEach((a) => a.toggleAttribute("aria-current", a.dataset.id === id));

    let mediaHTML;
    if (p.video) {
      const src = reducedMotion() ? p.video.replace("autoplay=1", "autoplay=0") : p.video;
      mediaHTML = `<div class="video"><iframe src="${esc(src)}" title="${esc(p.videoTitle || p.name)}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`;
    } else {
      mediaHTML = media(p.image, p.imageAlt, p.imageHint, { fit: p.imageFit || "cover" });
    }
    // Video projects show their main image below too, then any extra photos.
    const extras = [...(p.video && p.image ? [{ image: p.image, alt: p.imageAlt }] : []), ...(p.gallery || [])];
    const extraPhoto = extras
      .map((g) => `<figure class="extra-photo">${media(g.image, g.alt, g.hint, { fit: "natural" })}<figcaption>${esc(g.alt)}</figcaption></figure>`)
      .join("");
    const links = (p.links || []).filter((l) => l.url);

    detail.innerHTML = `
      <header class="detail-head">
        <h2 class="detail-title" tabindex="-1">${esc(p.name)}</h2>
        <div class="detail-meta">${badge(p)}<span class="detail-date">${esc(p.date || "")}</span></div>
        ${p.award ? `<p class="award">★ ${esc(p.award)}</p>` : ""}
      </header>
      <div class="detail-media">${mediaHTML}</div>
      <p class="dialogue-text detail-desc" data-skippable></p>
      <ul class="tags" aria-label="Tech stack">${(p.tags || []).map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
      ${links.length ? `<div class="links">${links.map((l) => `<a class="btn" href="${esc(l.url)}" target="_blank" rel="noopener">${heartSlot}${esc(l.label)} <span aria-hidden="true">↗</span><span class="sr-only">(opens in a new tab)</span></a>`).join("")}</div>` : ""}
      ${extraPhoto}
      <a class="btn btn-ghost detail-close" href="#projects">${heartSlot}CLOSE <kbd>X</kbd></a>`;

    typeText(detail.querySelector(".detail-desc"), p.description, { speed: 7, pitch: 1.2 });
    detail.classList.add("open");
    const title = detail.querySelector(".detail-title");
    title.focus({ preventScroll: true });
    if (window.matchMedia("(max-width: 899px)").matches) {
      detail.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
    }
  }

  function close(restoreFocus = true) {
    const prev = current;
    current = null;
    items.forEach((a) => a.removeAttribute("aria-current"));
    detail.classList.remove("open");
    detail.innerHTML = `<p class="detail-empty">* Select an item to inspect it.</p>`;
    const back = items.find((a) => a.dataset.id === prev);
    if (back && restoreFocus) back.focus();
  }

  return {
    enter(param) {
      if (param) open(param);
      else if (current) close();
    },
    leave() {
      // Also stops the video when leaving the scene.
      if (current) close(false);
    },
    onKey(e) {
      if (arrowFocus(e, items)) return true;
      if ((e.key === "Escape" || e.key.toLowerCase() === "x") && current) {
        go("projects");
        return true;
      }
      return false;
    },
  };
}

// ------------------------------------------------------------- JOURNEY ---
export function journeyScene(el, data) {
  const entries = [...data.journey].sort((a, b) => (b.sort || "").localeCompare(a.sort || ""));
  el.innerHTML = `
    <header class="scene-head">
      <h1 id="h-journey" class="title" tabindex="-1">JOURNEY</h1>
      <p class="scene-sub">* You open the quest log. FILE 1, newest first.</p>
    </header>
    <ol class="quest-log">
      ${entries
        .map(
          (q, i) => `
        <li class="quest${q.major ? " major" : ""}" style="--i:${i}">
          <div class="quest-marker" aria-hidden="true">${pixelSVG(q.major ? "star" : q.icon, { scale: 3 })}</div>
          <div class="box quest-body">
            <div class="quest-text">
              ${q.date || q.major ? `<p class="quest-date">${esc(q.date || "")}${q.major ? ' <span class="major-tag">★ MAJOR WIN</span>' : ""}</p>` : ""}
              <h2 class="quest-title">${esc(q.title)}</h2>
              <p class="quest-org">${esc(q.org)}</p>
              <p class="quest-summary">${esc(q.summary)}</p>
              ${q.quip ? `<p class="quest-quip">${esc(q.quip)}</p>` : ""}
            </div>
            ${q.logo ? `<img class="quest-logo${q.logoWide ? " wide" : ""}" src="${esc(q.logo)}" alt="${esc(q.logoAlt || "")}" loading="lazy" decoding="async">` : q.logoHint ? media(null, `${q.title} logo`, q.logoHint, { cls: "quest-logo" }) : ""}
            ${q.photo ? `<img class="quest-photo${q.photoWide ? " wide" : ""}" src="${esc(q.photo)}" alt="${esc(q.photoAlt || "")}" loading="lazy" decoding="async">` : ""}
          </div>
        </li>`
        )
        .join("")}
    </ol>`;

  const log = el.querySelector(".quest-log");
  return {
    enter() {
      log.classList.remove("reveal");
      void log.offsetWidth; // restart the stagger animation
      log.classList.add("reveal");
    },
  };
}

// --------------------------------------------------------------- ABOUT ---

// Pixel parallax layers for the bike panel, drawn as tiny SVG tiles.
function layerTile(kind) {
  let rects = "";
  let w = 96;
  let h = 32;
  if (kind === "far") {
    // stepped mountains
    for (let x = 0; x < w; x += 2) {
      const y = Math.round(14 + 8 * Math.sin(x / 9) + 4 * Math.sin(x / 4.3));
      rects += `<rect x="${x}" y="${y}" width="2" height="${h - y}"/>`;
    }
    return svgTile(w, h, rects, "#1d2a5c");
  }
  if (kind === "mid") {
    // city blocks with lit windows
    let x = 0;
    let s = 7;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    while (x < w) {
      const bw = 6 + ((rnd() * 4) | 0) * 2;
      const bh = 8 + ((rnd() * 8) | 0) * 2;
      rects += `<rect x="${x}" y="${h - bh}" width="${bw - 2}" height="${bh}" fill="#2c2c44"/>`;
      for (let wy = h - bh + 2; wy < h - 2; wy += 3)
        for (let wx = x + 1; wx < x + bw - 3; wx += 2) if (rnd() > 0.6) rects += `<rect x="${wx}" y="${wy}" width="1" height="1" fill="#ffd600"/>`;
      x += bw;
    }
    return svgTile(w, h, rects);
  }
  // near: road with dashes
  h = 8;
  w = 32;
  rects = `<rect y="0" width="32" height="1" fill="#ffffff"/><rect y="1" width="32" height="7" fill="#26262e"/><rect x="2" y="4" width="10" height="1" fill="#ffd600"/>`;
  return svgTile(w, h, rects);
}

function svgTile(w, h, rects, fill = "") {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" shape-rendering="crispEdges"${fill ? ` fill="${fill}"` : ""}>${rects}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export function aboutScene(el, data) {
  const { about } = data;
  const members = Object.fromEntries(about.party.map((m) => [m.id, m]));
  const head = (m) => `
    <header class="member-head">
      <h2>${esc(m.name)}</h2><span class="member-lv">${esc(m.level)}</span>
    </header>
    <p class="member-text">${esc(m.text)}</p>`;

  const games = members.games;
  const bike = members.bike;
  const guitar = members.guitar;

  el.innerHTML = `
    <header class="scene-head">
      <h1 id="h-about" class="title" tabindex="-1">ABOUT</h1>
      <p class="scene-sub">* Your party gathers around.</p>
    </header>
    <div class="box dialogue bio">
      ${about.photo ? `<img class="portrait" src="${esc(about.photo)}" alt="${esc(about.photoAlt)}" width="120" height="158" loading="lazy" decoding="async">` : ""}
      <p class="dialogue-text bio-text" data-skippable></p>
    </div>
    <div class="party">
      ${
        games
          ? `<article class="box member member-games" aria-labelledby="m-games">
        ${head(games).replace("<h2>", '<h2 id="m-games">')}
        <button class="member-art flavour-btn" type="button" aria-describedby="flavour-line">
          <img src="${esc(games.image)}" alt="${esc(games.imageAlt)}" loading="lazy" decoding="async">
          <span class="sr-only">Show flavour text</span>
        </button>
        <p class="flavour" id="flavour-line" aria-live="polite">${esc(games.hint)}</p>
      </article>`
          : ""
      }
      ${
        bike
          ? `<article class="box member member-bike" aria-labelledby="m-bike">
        ${head(bike).replace("<h2>", '<h2 id="m-bike">')}
        <button class="ride-track" type="button" aria-label="Go for a ride">
          <span class="layer layer-far" style="background-image:${layerTile("far")}"></span>
          <span class="layer layer-mid" style="background-image:${layerTile("mid")}"></span>
          <span class="layer layer-near" style="background-image:${layerTile("near")}"></span>
          <img class="bike" src="${esc(bike.image)}" alt="${esc(bike.imageAlt)}" loading="lazy" decoding="async">
        </button>
        <p class="member-hint">${esc(bike.hint)}</p>
      </article>`
          : ""
      }
      ${
        guitar
          ? `<article class="box member member-guitar" aria-labelledby="m-guitar">
        ${head(guitar).replace("<h2>", '<h2 id="m-guitar">')}
        <div class="guitar">
          <img class="guitar-img" src="${esc(guitar.image)}" alt="${esc(guitar.imageAlt)}" loading="lazy" decoding="async">
          <div class="fretboard" role="group" aria-label="Guitar strings, keys 1 to 6">
            ${STRINGS.map(
              (s, i) => `<button class="string" type="button" data-string="${i}" style="--thick:${3 - Math.floor(i / 2)}px" aria-label="Pluck ${s.note === "e" ? "high E" : s.note} string (key ${i + 1})">
                <kbd aria-hidden="true">${i + 1}</kbd><span class="note" aria-hidden="true">${s.note}</span><span class="wire" aria-hidden="true"></span>
              </button>`
            ).join("")}
          </div>
        </div>
        <p class="member-hint">${esc(guitar.hint)}</p>
      </article>`
          : ""
      }
    </div>`;

  // Video games: random flavour text on hover / focus / click.
  const flavourBtn = el.querySelector(".flavour-btn");
  const flavourLine = el.querySelector(".flavour");
  let lastFlavour = null;
  const showFlavour = () => {
    lastFlavour = pick(games.flavour, lastFlavour);
    typeText(flavourLine, lastFlavour, { speed: 18, pitch: 0.8 });
  };
  if (flavourBtn) {
    flavourBtn.addEventListener("mouseenter", showFlavour);
    flavourBtn.addEventListener("click", showFlavour);
  }

  // Biking: ride across on hover / click.
  const track = el.querySelector(".ride-track");
  let riding = 0;
  const ride = () => {
    if (!track || reducedMotion() || riding) return;
    track.classList.add("riding");
    riding = setTimeout(() => {
      track.classList.remove("riding");
      riding = 0;
    }, 2600);
  };
  if (track) {
    track.addEventListener("mouseenter", ride);
    track.addEventListener("click", ride);
  }

  // Guitar: click strings or press 1–6.
  const strings = [...el.querySelectorAll(".string")];
  const strum = (i) => {
    const s = strings[i];
    if (!s) return;
    pluck(i);
    s.classList.remove("plucked");
    void s.offsetWidth;
    s.classList.add("plucked");
  };
  strings.forEach((s, i) => s.addEventListener("click", () => strum(i)));

  const bio = el.querySelector(".bio-text");
  return {
    enter() {
      typeText(bio, about.bio, { speed: 14 });
    },
    onKey(e) {
      if (/^[1-6]$/.test(e.key) && !e.repeat) {
        strum(Number(e.key) - 1);
        return true;
      }
      return arrowFocus(e, strings);
    },
  };
}

// ------------------------------------------------------------- CONTACT ---
export function contactScene(el, data, { toast }) {
  const { profile, contact } = data;
  const options = [
    { label: "EMAIL", href: `mailto:${profile.email}`, sub: profile.email },
    { label: "LINKEDIN", href: profile.linkedin, sub: "maximilian-ingram", ext: true },
    { label: "GITHUB", href: profile.github, sub: "MaxIngram05", ext: true },
    { label: "RESUME", href: profile.resume, sub: "PDF", ext: true },
  ];
  el.innerHTML = `
    <header class="scene-head">
      <h1 id="h-contact" class="title" tabindex="-1">CONTACT</h1>
      <p class="scene-sub">* ${esc(contact.prompt)}</p>
    </header>
    <div class="save-area">
      <button class="save-star" type="button" aria-describedby="save-hint">
        <span class="save-sparkles" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
        <video class="save-video" width="120" height="120" muted loop playsinline preload="none" poster="/media/save-star-poster.webp" aria-hidden="true">
          <source src="/media/save-star.webm" type="video/webm">
          <source src="/media/save-star.mp4" type="video/mp4">
        </video>
        <span class="sr-only">Interact with the save point</span>
      </button>
      <p id="save-hint" class="hint">Click the star, or press Enter / Z.</p>
    </div>
    <div class="box dialogue save-dialogue" hidden>
      <p class="dialogue-text" data-skippable></p>
      <ul class="save-options" role="list" hidden>
        ${options
          .map(
            (o) => `<li><a class="save-option" href="${esc(o.href)}"${o.ext ? ' target="_blank" rel="noopener"' : ""}>${heartSlot}<span class="opt-label">${esc(o.label)}</span><span class="opt-sub">${esc(o.sub)}</span>${o.ext ? '<span class="sr-only">(opens in a new tab)</span>' : ""}</a></li>`
          )
          .join("")}
      </ul>
    </div>`;

  const star = el.querySelector(".save-star");
  const box = el.querySelector(".save-dialogue");
  const text = box.querySelector(".dialogue-text");
  const list = box.querySelector(".save-options");
  const opts = [...list.querySelectorAll(".save-option")];

  star.addEventListener("click", async () => {
    chime();
    star.classList.add("used");
    box.hidden = false;
    list.hidden = true;
    await typeText(text, contact.line, { speed: 34 });
    list.hidden = false;
    toast("* File saved.");
    opts[0].focus({ preventScroll: true });
  });

  // Only download and play the star loop while Contact is on screen.
  const video = star.querySelector(".save-video");
  return {
    enter() {
      if (!reducedMotion()) video.play().catch(() => {});
    },
    leave() {
      video.pause();
    },
    onKey(e) {
      return arrowFocus(e, opts);
    },
  };
}
