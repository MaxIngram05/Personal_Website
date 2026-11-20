# maxingram.dev

My personal portfolio: an Undertale-inspired retro RPG, served as static assets from a Cloudflare Worker. Plain HTML/CSS/vanilla JS, no framework and no build step. All art, sounds and fonts are original or openly licensed.

## Run it

```sh
npm install
npm run dev        # wrangler dev → http://localhost:8787
npm run deploy     # wrangler deploy (maxingram.dev + www)
```

## Editing content

All text lives in [`public/data/content.json`](public/data/content.json): projects, journey, hobbies, greetings, flavour text. An image set to `null` renders a labelled placeholder until you add the file.

## Images

Originals go in `Resources/`. Then run:

```sh
pip install pillow
npm run images     # python scripts/build-images.py
```

This writes optimized files into `public/images/`, copies the résumé to `public/resume.pdf`, and redraws the pixel heart cursor, favicon and OG card. It also crops `Savepoint Star.mp4` into the small silent loop in `public/media/` (needs ffmpeg on PATH, or `pip install imageio-ffmpeg`).

Projects can list extra photos under `"gallery"`; they show uncropped below the description.

## Layout

```
wrangler.toml           assets-only Worker, routes for maxingram.dev / www
public/index.html       shell + start gate
public/data/            content.json
public/js/main.js       gate, hash router, keyboard, Konami code
public/js/scenes.js     Home / Projects / Journey / About / Contact
public/js/audio.js      Web Audio blips + Karplus-Strong guitar
public/js/fx.js         starfield + pixel dissolve
public/js/dialogue.js   typewriter text
public/js/icons.js      pixel icons as character grids → SVG
public/css/style.css
```

Controls: arrow keys move, Enter / Z select, Esc / X go back, 1–6 play the guitar on the About page. ↑↑↓↓←→←→BA toggles hard mode.
