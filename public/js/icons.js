// Original pixel icons, drawn as character grids and rendered to crisp SVG.
// "X" = filled pixel (currentColor), "o" = secondary pixel (--icon-2), "." = empty.

const GRIDS = {
  heart: [
    ".XX...XX.",
    "XXXX.XXXX",
    "XXXXXXXXX",
    "XXXXXXXXX",
    ".XXXXXXX.",
    "..XXXXX..",
    "...XXX...",
    "....X....",
  ],
  star: [
    "....X....",
    "....X....",
    "...XXX...",
    "XXXXXXXXX",
    ".XXXXXXX.",
    "..XXXXX..",
    "..XX.XX..",
    ".XX...XX.",
    ".X.....X.",
  ],
  chest: [
    ".XXXXXXXX.",
    "XooooooooX",
    "XXXXXXXXXX",
    "Xooo..oooX",
    "XoooXXoooX",
    "XooooooooX",
    "XooooooooX",
    "XXXXXXXXXX",
  ],
  map: [
    "XXXXXXXXX.",
    "Xo.....oXX",
    "X.XX.X..X.",
    "X.......X.",
    "X.X.XXX.X.",
    "X.......X.",
    "XXo....oX.",
    ".XXXXXXXXX",
  ],
  person: [
    "...XX...",
    "..XXXX..",
    "..XXXX..",
    "...XX...",
    ".XXXXXX.",
    "X.XXXX.X",
    "..X..X..",
    "..X..X..",
  ],
  mail: [
    "XXXXXXXXXX",
    "XX......XX",
    "X.X....X.X",
    "X..X..X..X",
    "X...XX...X",
    "X........X",
    "XXXXXXXXXX",
  ],
  book: [
    "XXXXXXX.",
    "Xooooo.X",
    "Xo.XX.oX",
    "Xooooo.X",
    "Xo.XX.oX",
    "Xooooo.X",
    "XXXXXXXX",
    ".XXXXXXX",
  ],
  trophy: [
    "XXXXXXXX",
    "XoXXXXoX",
    "XoXXXXoX",
    ".XXXXXX.",
    "..XXXX..",
    "...XX...",
    "..XXXX..",
    ".XXXXXX.",
  ],
  robot: [
    "...X....",
    ".XXXXXX.",
    ".X.XX.X.",
    ".XXXXXX.",
    ".XoooXX.",
    "XXXXXXXX",
    "X.XXXX.X",
    "..X..X..",
  ],
  scroll: [
    "XXXXXXX.",
    "X.....XX",
    "X.ooo.X.",
    "X.....X.",
    "X.ooo.X.",
    "X.....X.",
    "XX....X.",
    ".XXXXXXX",
  ],
  mug: [
    ".o.o....",
    "XXXXXX..",
    "XooooXXX",
    "XooooX.X",
    "XooooXXX",
    "XooooX..",
    ".XXXX...",
    "XXXXXX..",
  ],
  calendar: [
    ".X...X..",
    "XXXXXXXX",
    "X......X",
    "XXXXXXXX",
    "X.o.o.oX",
    "XXXXXXXX",
    "X.o.o.oX",
    "XXXXXXXX",
  ],
  ticket: [
    "XXXXXXXXX",
    "X...o...X",
    ".X..o..X.",
    ".X..o..X.",
    "X...o...X",
    "XXXXXXXXX",
  ],
  handshake: [
    "XX......XX",
    "XXXX..XXXX",
    "X.XXXXXX.X",
    "...XXXX...",
    "....XX....",
  ],
  bug: [
    "X......X",
    ".X.XX.X.",
    "..XXXX..",
    "XXXooXXX",
    "..XooX..",
    "XXXooXXX",
    "..XXXX..",
    ".X....X.",
  ],
  flag: [
    "XXXXXXX.",
    "XoooooXX",
    "XooooXX.",
    "XXXXXX..",
    "X.......",
    "X.......",
    "X.......",
    "X.......",
  ],
  wave: [
    "..XX.....",
    ".X..X..X.",
    "X....XX..",
    "..XX.....",
    ".X..X..X.",
    "X....XX..",
  ],
  gear: [
    "..X..X..",
    ".XXXXXX.",
    "XXX..XXX",
    ".X....X.",
    ".X....X.",
    "XXX..XXX",
    ".XXXXXX.",
    "..X..X..",
  ],
};

export function pixelSVG(name, { scale = 3, label } = {}) {
  const grid = GRIDS[name] || GRIDS.star;
  const w = grid[0].length;
  const h = grid.length;
  let main = "";
  let alt = "";
  grid.forEach((row, y) => {
    [...row].forEach((c, x) => {
      if (c === "X") main += `M${x} ${y}h1v1h-1z`;
      else if (c === "o") alt += `M${x} ${y}h1v1h-1z`;
    });
  });
  const a11y = label ? `role="img" aria-label="${label}"` : `aria-hidden="true" focusable="false"`;
  return `<svg class="px-icon" ${a11y} viewBox="0 0 ${w} ${h}" width="${w * scale}" height="${h * scale}" shape-rendering="crispEdges"><path fill="currentColor" d="${main}"/>${alt ? `<path fill="currentColor" opacity=".5" d="${alt}"/>` : ""}</svg>`;
}

// Fill every [data-icon] placeholder inside root.
export function hydrateIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((el) => {
    if (el.firstElementChild) return;
    el.innerHTML = pixelSVG(el.dataset.icon, { scale: Number(el.dataset.scale) || 3 });
  });
}
