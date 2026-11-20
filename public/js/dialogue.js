// RPG dialogue: typewriter text with a blip per character.
// Screen readers get the full line immediately via a visually hidden copy.

import { blip } from "./audio.js";
import { reducedMotion } from "./fx.js";

let active = null;

// Finish whatever is currently typing. Returns true if something was skipped.
export function skipTyping() {
  if (!active) return false;
  active.finish();
  return true;
}

export function isTyping() {
  return Boolean(active);
}

/**
 * Types `text` into `el`. Options: speed (ms/char), pitch (blip pitch).
 * Resolves when the text is fully shown (typed or skipped).
 */
export function typeText(el, text, { speed = 32, pitch = 1 } = {}) {
  if (active) active.finish();
  el.textContent = "";
  const sr = document.createElement("span");
  sr.className = "sr-only";
  sr.textContent = text;
  const shown = document.createElement("span");
  shown.setAttribute("aria-hidden", "true");
  const caret = document.createElement("span");
  caret.className = "caret";
  caret.setAttribute("aria-hidden", "true");
  el.append(sr, shown, caret);

  if (reducedMotion()) {
    shown.textContent = text;
    el.classList.add("typed");
    return Promise.resolve();
  }

  el.classList.remove("typed");
  return new Promise((resolve) => {
    let i = 0;
    let timer = 0;
    const job = {
      finish() {
        clearTimeout(timer);
        shown.textContent = text;
        el.classList.add("typed");
        if (active === job) active = null;
        resolve();
      },
    };
    const step = () => {
      if (!el.isConnected) return job.finish();
      const ch = text[i++];
      shown.textContent += ch;
      if (/[\w]/.test(ch) && i % 2) blip(pitch);
      if (i >= text.length) return job.finish();
      const pause = /[.!?]/.test(ch) ? speed * 8 : ch === "," ? speed * 4 : speed;
      timer = setTimeout(step, pause);
    };
    active = job;
    timer = setTimeout(step, speed);
  });
}
