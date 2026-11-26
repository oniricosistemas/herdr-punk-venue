// Original Argentine DIY gig art. Run: node punk-venue/mods/punk-venue/tools/generate.mjs
// No dependencies, randomness, fonts, CSS, URLs, or raster data.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { layoutBanner } from './banner-layout.mjs';

const out = fileURLToPath(new URL('../art/', import.meta.url));
const P = {
  black: '#151412', cream: '#eee3c5', red: '#b93b36',
  mustard: '#c4a34f', green: '#385947', denim: '#627b88',
};
const rect = (x, y, w, h, color) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${P[color]}"/>`;
const path = (d, color, stroke, width = 1) =>
  `<path d="${d}" fill="${color === 'none' ? 'none' : P[color]}"${stroke ? ` stroke="${P[stroke]}" stroke-width="${width}"` : ''}/>`;
const circle = (cx, cy, r, color) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${P[color]}"/>`;

// Hand-cut 3x5 stencil alphabet. Gaps remain paper, never font glyphs.
const glyphs = {
  A: ['010', '101', '111', '101', '101'], B: ['110', '101', '110', '101', '110'],
  D: ['110', '101', '101', '101', '110'], I: ['111', '010', '010', '010', '111'],
  O: ['111', '101', '101', '101', '111'], R: ['110', '101', '110', '101', '101'],
  S: ['111', '100', '111', '001', '111'], T: ['111', '010', '010', '010', '010'],
  U: ['101', '101', '101', '101', '111'],
  C: ['111', '100', '100', '100', '111'], E: ['111', '100', '110', '100', '111'],
  F: ['111', '100', '110', '100', '100'], G: ['111', '100', '101', '101', '111'],
  H: ['101', '101', '111', '101', '101'], J: ['001', '001', '001', '101', '111'],
  K: ['101', '101', '110', '101', '101'], L: ['100', '100', '100', '100', '111'],
  M: ['101', '111', '111', '101', '101'], N: ['101', '111', '111', '111', '101'],
  P: ['110', '101', '110', '100', '100'], Q: ['111', '101', '101', '111', '001'],
  V: ['101', '101', '101', '101', '010'], W: ['101', '101', '111', '111', '101'],
  X: ['101', '101', '010', '101', '101'], Y: ['101', '101', '010', '010', '010'],
  Z: ['111', '001', '010', '100', '111'],
  0: ['111', '101', '101', '101', '111'], 1: ['010', '110', '010', '010', '111'],
  2: ['111', '001', '111', '100', '111'], 3: ['111', '001', '111', '001', '111'],
  4: ['101', '101', '111', '001', '001'], 5: ['111', '100', '111', '001', '111'],
  6: ['111', '100', '111', '101', '111'], 7: ['111', '001', '010', '010', '010'],
  8: ['111', '101', '111', '101', '111'], 9: ['111', '101', '111', '001', '111'],
  '-': ['000', '000', '111', '000', '000'],
};
function stencil(label, x, y, scale = 1, color = 'black') {
  let result = '';
  for (const [i, letter] of [...label].entries()) {
    if (letter === ' ') continue;
    if (!glyphs[letter]) throw new Error(`Missing stencil: ${letter}`);
    const cuts = [];
    glyphs[letter].forEach((row, yy) => {
      // One rectangle per contiguous stencil cut, rather than per pixel.
      for (const run of row.matchAll(/1+/g)) {
        const width = run[0].length * scale;
        cuts.push(`M${x + (i * 4 + run.index) * scale} ${y + yy * scale}h${width}v${scale}h-${width}Z`);
      }
    });
    result += path(cuts.join(' '), color);
  }
  return result;
}
function svg(title, pieces, width = 64) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="64" viewBox="0 0 ${width} 64" shape-rendering="crispEdges" stroke-linejoin="miter" stroke-linecap="square">\n  <title>${title}</title>\n${pieces.filter(Boolean).map(s => `  ${s}`).join('\n')}\n</svg>\n`;
}
function save(name, title, pieces, width = 64) {
  writeFileSync(`${out}/${name}.svg`, svg(title, pieces, width), 'utf8');
}
function amp(x, y, color = 'green') {
  return [rect(x, y, 14, 18, 'cream'), rect(x + 1, y + 1, 12, 16, 'black'),
    rect(x + 2, y + 5, 10, 10, color), rect(x + 3, y + 7, 8, 1, 'black'),
    rect(x + 3, y + 10, 8, 1, 'black'), rect(x + 3, y + 13, 8, 1, 'black'),
    rect(x + 3, y + 2, 2, 1, 'red'), rect(x + 8, y + 2, 2, 1, 'mustard')].join('\n  ');
}
function mic(x = 44) {
  return path(`M${x} 28 V57 M${x - 7} 58 L${x} 55 L${x + 7} 58`, 'none', 'cream', 2)
    + path(`M${x - 5} 26 L${x + 3} 23`, 'none', 'black', 5)
    + path(`M${x - 5} 25 L${x + 3} 22`, 'none', 'denim', 3)
    + path(`M${x + 3} 24 Q${x + 10} 45 ${x + 6} 60`, 'none', 'black');
}
function strings(kind, resting = false) {
  const bass = kind === 'bass';
  const color = bass ? 'mustard' : kind === 'guitar2' ? 'green' : 'red';
  const instrument = path('M23 33 L29 31 L34 36 L39 34 L42 40 L37 48 L28 50 L22 44 Z', color, 'cream')
    + path('M32 38 L47 20 L51 22 L36 41 Z', 'mustard', 'black')
    + path('M47 20 L49 15 L54 17 L52 23 Z', 'cream', 'black')
    + path('M29 43 L51 19', 'none', 'black')
    + rect(27, 42, 6, 3, 'black')
    + (bass ? rect(30, 38, 2, 3, 'cream') : rect(29, 37, 3, 3, 'cream'));
  return resting ? `<g transform="rotate(-22 32 40)">${instrument}</g>` : instrument;
}
function kit() {
  return [path('M13 32 V56 M6 57 L13 53 L20 57 M51 29 V56 M45 57 L51 53 L57 57', 'none', 'cream', 2),
    path('M4 31 L21 29 L23 32 L5 34 Z M43 27 L59 29 L58 31 L42 30 Z', 'mustard', 'black'),
    rect(15, 35, 12, 9, 'red'), rect(38, 34, 12, 10, 'red'),
    rect(15, 35, 12, 2, 'cream'), rect(38, 34, 12, 2, 'cream'),
    circle(32, 48, 12, 'cream'), circle(32, 48, 10, 'red'), circle(32, 48, 6, 'black'),
    // Torn tape cross, not a real band's mark.
    path('M28 45 L36 51 M29 52 L35 44', 'none', 'cream', 2),
    path('M22 55 L19 60 M42 55 L45 60', 'none', 'cream', 2)].join('\n  ');
}
function keyboard() {
  return [path('M19 43 L44 59 M45 43 L21 59', 'none', 'cream', 2),
    path('M13 36 L51 36 L53 44 L11 44 Z', 'denim', 'black'),
    rect(14, 39, 36, 4, 'cream'),
    ...[18, 22, 28, 32, 36, 42, 46].map(x => rect(x, 39, 2, 3, 'black')),
    rect(15, 37, 5, 1, 'red'), rect(45, 37, 4, 1, 'mustard')].join('\n  ');
}
function sax() {
  return path('M35 23 L40 25 L37 44 Q40 49 43 43 L44 36 L53 34 L50 45 Q48 55 38 52 L31 47 Z', 'mustard', 'black')
    + path('M34 24 L29 23', 'none', 'cream', 2)
    + path('M37 31 L35 41 M39 46 L43 47', 'none', 'cream')
    + rect(35, 32, 3, 2, 'black') + rect(34, 37, 3, 2, 'black')
    + path('M43 36 L52 34 L50 38 L44 40 Z', 'black', 'cream');
}

function person(kind, state) {
  const done = state === 'done';
  const seated = kind === 'drums' || kind === 'keys';
  const shirt = { guitar: 'denim', bass: 'green', drums: 'black', singer: 'red', guitar2: 'red', keys: 'green', sax: 'denim' }[kind];
  const pieces = [];
  // An outlined silhouette stays visible against the venue's near-black wall.
  pieces.push(path(seated ? 'M24 38 L39 38 L43 55 L38 57 L32 45 L27 57 L21 55 Z'
    : 'M24 37 L39 37 L42 57 L36 58 L31 44 L27 58 L21 57 Z', 'black', 'denim', 2));
  pieces.push(rect(19, 57, 10, 4, 'cream'), rect(35, 57, 10, 4, 'cream'));
  pieces.push(path('M25 21 L37 21 L41 39 L22 39 Z', shirt, 'cream'));
  pieces.push(path('M25 22 L29 29 L26 38 M37 22 L33 29 L37 38', 'none', 'black', 2));
  pieces.push(rect(28, 32, 6, 4, 'cream'), rect(29, 33, 4, 1, 'red'));
  pieces.push(rect(28, 18, 7, 5, 'cream'));
  pieces.push(path('M25 9 L36 9 L38 14 L35 21 L28 21 L24 16 Z', 'cream', 'black'));
  if (kind === 'singer' || kind === 'guitar2') {
    pieces.push(path('M25 13 L23 8 L28 9 L29 3 L32 7 L35 4 L36 10 L39 12 Z', 'red', 'black'));
  } else if (kind === 'bass') {
    pieces.push(path('M23 10 L28 6 L36 7 L39 13 L37 24 L34 20 L35 12 L26 14 L25 22 L22 20 Z', 'black', 'mustard'));
  } else {
    pieces.push(path('M24 13 L24 8 L28 6 L36 7 L39 13 L33 11 L28 13 Z', kind === 'keys' ? 'mustard' : 'black', 'denim'));
  }
  pieces.push(rect(27, 14, 2, 2, 'black'), rect(34, 14, 2, 2, 'black'), rect(30, 19, 3, 1, 'black'));
  // Gear stays present in every state; only idle strings hang vertically.
  if (['guitar', 'bass', 'guitar2'].includes(kind)) {
    pieces.push(path('M25 23 L36 41', 'none', 'mustard', 2), strings(kind, state === 'idle'));
  }
  if (kind === 'drums') pieces.push(kit());
  if (kind === 'keys') pieces.push(keyboard());
  if (kind === 'sax') pieces.push(sax());
  if (kind === 'singer') pieces.push(mic());

  let arms;
  if (done) arms = [[25, 24, 16, 17, 12, 5], [38, 24, 47, 17, 51, 5]];
  else if (state === 'blocked') arms = [[25, 24, 17, 29, 12, 21], [38, 24, 46, 24, 55, 23]];
  else if (state === 'idle') arms = [[25, 24, 20, 32, 20, 42], [38, 24, 43, 32, 43, 43]];
  else {
    arms = {
      guitar: [[25, 24, 19, 34, 31, 41], [38, 24, 43, 28, 45, 27]],
      guitar2: [[25, 24, 18, 32, 30, 40], [38, 24, 44, 28, 47, 24]],
      bass: [[25, 24, 21, 34, 29, 40], [38, 24, 42, 29, 45, 26]],
      drums: [[25, 24, 17, 19, 13, 24], [38, 24, 45, 18, 49, 22]],
      singer: [[25, 24, 17, 30, 10, 23], [38, 24, 44, 31, 40, 24]],
      keys: [[25, 24, 19, 30, 24, 37], [38, 24, 46, 30, 42, 37]],
      sax: [[25, 24, 23, 33, 34, 37], [38, 24, 43, 31, 38, 43]],
    }[kind];
  }
  for (const [sx, sy, ex, ey, hx, hy] of arms) {
    pieces.push(path(`M${sx} ${sy} L${ex} ${ey} L${hx} ${hy}`, 'none', 'black', 7));
    pieces.push(path(`M${sx} ${sy} L${ex} ${ey} L${hx} ${hy}`, 'none', shirt, 5));
    pieces.push(rect(hx - 2, hy - 2, 5, 5, 'cream'));
  }
  if (state === 'blocked') {
    pieces.push(rect(55, 21, 6, 2, 'cream'), rect(9, 16, 2, 6, 'cream'), rect(12, 16, 2, 6, 'cream'));
  }
  if (done) pieces.push(rect(10, 1, 2, 5, 'cream'), rect(51, 1, 2, 5, 'cream'));
  if (kind === 'drums' && state === 'working') {
    pieces.push(path('M13 24 L8 14 M49 22 L55 12', 'none', 'mustard', 2));
  }
  if (kind === 'singer' && state === 'working') {
    pieces.push(path('M38 24 L43 20', 'none', 'black', 5), path('M38 23 L43 19', 'none', 'cream', 3));
  }
  return pieces;
}

// Scene-only helpers: local shape reuse keeps wide strips below 8 KiB.
const use = (id, x, y) => `<use href="#${id}" x="${x}" y="${y}"/>`;
function wall() {
  const joints = [];
  for (let y = 15; y < 53; y += 7) {
    joints.push(`M0 ${y} H256`);
    for (let x = y % 14 === 1 ? 0 : 10; x < 256; x += 20) joints.push(`M${x} ${y} v7`);
  }
  return [rect(0, 0, 256, 64, 'black'), path(joints.join(' '), 'none', 'green'),
    path('M0 0 H256 V10 L221 8 L185 11 L151 8 L112 10 L77 8 L36 11 L0 9 Z', 'denim', 'cream'),
    path(Array.from({ length: 42 }, (_, i) => `M${i * 6 + 3} 1 v6`).join(' '), 'none', 'black')];
}
function bill(x, y) {
  return `<g transform="translate(${x} ${y})">${path('M0 1 L12 0 L14 16 L1 18 Z', 'cream')}${rect(3, 4, 8, 2, 'black')}${rect(4, 8, 5, 5, 'red')}${rect(3, 15, 9, 1, 'black')}${rect(0, 0, 4, 2, 'mustard')}</g>`;
}
function backdrop() {
  return [...wall(), `<defs><g id="stack">${amp(0, 0)}${amp(0, 19)}</g></defs>`,
    // Cloth is broad, but leaves the lower center clear for live musicians.
    path('M55 14 L199 12 L196 30 L58 31 Z', 'cream', 'red'),
    stencil('BARRO SUR', 68, 18, 1.5), stencil('RUIDO ROTO', 135, 19),
    path('M55 14 L48 11 M199 12 L207 10 M58 31 L54 35 M196 30 L201 34', 'none', 'cream'),
    bill(37, 31), bill(205, 29), use('stack', 12, 16), use('stack', 29, 16),
    use('stack', 218, 16), use('stack', 235, 16),
    rect(0, 55, 256, 9, 'denim'), rect(0, 57, 256, 3, 'black'),
    path('M0 55 H256 M6 62 H37 M61 62 H95 M119 62 H151 M177 62 H209 M232 62 H252', 'none', 'cream'),
    path('M43 54 Q70 49 85 54 T130 54 M177 54 Q190 48 213 54', 'none', 'mustard')];
}

const names = {
  club: ['Los Violadores', 'Flema', 'Argies'],
  galpon: ['Todos Tus Muertos', 'Attaque 77', '2 Minutos'],
  plaza: ['Boom Boom Kid', 'Fun People', 'Loquero'],
  salon: ['Embajada Boliviana', 'Sin Ley', 'Bulldog'],
  entrance: ['ENTRADA', 'Alerta Roja'],
};
const letterId = c => `b${c === '-' ? 'dash' : c}`;
const number = value => Number(value.toFixed(3));
function bannerAlphabet(labels) {
  const letters = [...new Set(labels.join('').toUpperCase().replaceAll(' ', ''))].sort();
  return `<defs>${letters.map(c => `<g id="${letterId(c)}">${stencil(c, 0, 0)}</g>`).join('')}</defs>`;
}
function banner(name, x, y, w, h) {
  const { lines, condensed } = layoutBanner(name);
  const longest = Math.max(...lines.map(line => line.length * 4 - 1));
  const sx = number(Math.min(condensed ? 1.1 : 1.4, (w - 6) / longest));
  const sy = 1.4;
  const lineHeight = 5 * sy;
  const top = (h - (lines.length * lineHeight + lines.length - 1)) / 2;
  if (sx < 1 || top < 2) throw new Error(`Banner too small for readable lettering: ${name}`);
  const lettering = lines.map((line, row) => {
    const left = number((w - (line.length * 4 - 1) * sx) / 2);
    const baseline = number(top + row * (lineHeight + 1));
    const cuts = [...line].map((c, i) => c === ' ' ? '' : use(letterId(c), i * 4, 0)).join('');
    return `<g transform="translate(${left} ${baseline}) scale(${sx} ${sy})">${cuts}</g>`;
  }).join('\n    ');
  // Exact source casing stays in the accessible label; visual shapes are caps.
  return `<g role="img" aria-label="${name}" data-lines="${lines.length}" data-condensed="${condensed}" transform="translate(${x} ${y})">\n    ${path(`M0 1 L${w} 0 L${w - 1} ${h} L1 ${h - 1} Z`, 'cream', 'black')}\n    ${lettering}\n  </g>`;
}

// Variant-only compositions. Original fallback/crowd/figure functions stay untouched.
// The final two masks reserve x=56..200, y=22..56 for musicians and the
// entire bottom eighth for crowd overlay. No props can obscure those zones.
function stageVariant(pieces) {
  return [...pieces, rect(56, 22, 144, 34, 'black'), rect(0, 56, 256, 8, 'black')];
}
function club() {
  const bricks = [];
  for (let y = 15; y < 55; y += 7) {
    bricks.push(`M0 ${y} H56 M200 ${y} H256`);
    for (const x of [8, 28, 48, 208, 228, 248]) bricks.push(`M${x} ${y} v7`);
  }
  return stageVariant([
    rect(0, 0, 256, 64, 'black'), rect(0, 10, 256, 45, 'red'),
    // Amber wall wash is solid stencil geometry, not a gradient or new hue.
    path('M16 10 H74 L54 55 H0 Z M182 10 H240 L256 55 H202 Z', 'mustard'),
    path(bricks.join(' '), 'none', 'black'),
    rect(0, 0, 256, 9, 'black'), rect(0, 9, 256, 3, 'mustard'),
    path('M5 0 V8 M62 0 V8 M194 0 V8 M250 0 V8', 'none', 'red', 4),
    bannerAlphabet(names.club), banner(names.club[0], 87, 1, 82, 20),
    banner(names.club[1], 3, 22, 50, 12), banner(names.club[2], 203, 22, 50, 12),
    path('M87 3 L81 1 M169 2 L176 0', 'none', 'cream'),
    amp(15, 35, 'mustard'), amp(31, 35, 'red'), amp(210, 35, 'red'), amp(226, 35, 'mustard'),
    rect(0, 54, 256, 2, 'green'),
  ]);
}
function galpon() {
  const seams = [];
  for (let x = 5; x < 256; x += 9) seams.push(`M${x} 2 V54`);
  const crate = (x, y) => `<g transform="translate(${x} ${y})">${rect(0, 0, 21, 12, 'green')}${path('M1 1 H20 V11 H1 Z M1 1 L20 11 M20 1 L1 11', 'none', 'denim')}${rect(8, 4, 5, 3, 'black')}</g>`;
  return stageVariant([
    rect(0, 0, 256, 64, 'black'), rect(0, 0, 256, 55, 'denim'),
    path(seams.join(' '), 'none', 'black'),
    path('M0 6 L64 0 L128 6 L192 0 L256 6 M0 7 H256', 'none', 'cream'),
    rect(21, 3, 29, 2, 'cream'), rect(205, 3, 29, 2, 'cream'),
    bannerAlphabet(names.galpon),
    `<g transform="rotate(2 128 11)">${banner(names.galpon[0], 86, 1, 84, 19)}</g>`,
    banner(names.galpon[1], 3, 17, 50, 12),
    path('M86 2 L79 0 M170 3 L177 0', 'none', 'cream'),
    crate(4, 42), crate(27, 42), crate(15, 29), crate(213, 42), crate(228, 29),
    amp(232, 10, 'denim'), banner(names.galpon[2], 203, 30, 50, 12),
    rect(0, 54, 256, 2, 'green'),
  ]);
}
function plaza() {
  const p = [rect(0, 0, 256, 64, 'black'), rect(0, 0, 256, 19, 'denim'),
    // Sky, not a ceiling: interrupted distant tree/horizon silhouettes.
    rect(0, 14, 256, 6, 'cream'),
    path('M0 20 V16 H8 V12 H15 V17 H29 V14 H39 V19 H62 V16 H75 V20 H182 V17 H194 V13 H206 V18 H221 V15 H235 V19 H256 V22 H0 Z', 'green'),
    path('M0 2 Q64 16 128 7 Q192 16 256 2', 'none', 'black', 2)];
  for (const [x, y] of [[13, 5], [42, 9], [72, 10], [101, 9], [130, 8], [161, 10], [191, 10], [222, 7], [246, 4]]) {
    p.push(rect(x, y, 1, 3, 'black'), rect(x - 1, y + 3, 3, 4, 'mustard'));
  }
  p.push(path('M5 28 V54 M48 28 V54 M208 28 V54 M251 28 V54 M5 37 H48 M208 37 H251', 'none', 'green', 2),
    amp(13, 35, 'green'), amp(228, 35, 'denim'),
    bannerAlphabet(names.plaza), banner(names.plaza[0], 85, 1, 86, 20),
    path('M3 20 V40 M253 20 V40', 'none', 'mustard', 2),
    banner(names.plaza[1], 3, 21, 50, 12), banner(names.plaza[2], 203, 21, 50, 12),
    rect(0, 54, 256, 2, 'green'));
  return stageVariant(p);
}
function salon() {
  const p = [rect(0, 0, 256, 64, 'black'), rect(0, 0, 256, 55, 'green'),
    rect(0, 0, 256, 3, 'cream'), rect(0, 19, 256, 2, 'denim'),
    path('M0 4 Q64 17 128 5 Q192 17 256 4', 'none', 'cream')];
  for (const [i, x] of [12, 38, 64, 90, 116, 142, 168, 194, 220, 246].entries()) {
    const y = (i % 5 === 0 || i % 5 === 4) ? 6 : 9;
    p.push(path(`M${x - 5} ${y} h10 l-5 8 Z`, ['red', 'mustard', 'cream'][i % 3]));
  }
  // Hand-lettered community gig poster is kept outside the musician area.
  p.push(bannerAlphabet(names.salon), banner(names.salon[0], 83, 1, 90, 20),
    banner(names.salon[1], 3, 20, 50, 12), banner(names.salon[2], 203, 20, 50, 12),
    rect(3, 19, 6, 2, 'mustard'), rect(247, 31, 6, 2, 'mustard'));
  for (const x of [15, 222]) {
    p.push(path(`M${x} 42 v-9 h12 v9 h2 v4 h-16 v-4 Z`, 'cream', 'black'),
      rect(x + 3, 35, 6, 5, 'green'),
      path(`M${x + 1} 46 l-2 8 M${x + 11} 46 l2 8`, 'none', 'cream', 2));
  }
  p.push(rect(0, 54, 256, 2, 'green'));
  return stageVariant(p);
}

// Crowd scale is deliberately smaller than the musicians. Two stencilled
// shirts carry initials of the invented banner bands, not existing logos.
function fan(x, y, punk = false, seated = false, shirt = 'denim', marked = false, gesture = 'rest') {
  const p = [rect(x + 2, y, 5, 6, 'cream')];
  p.push(punk ? path(`M${x + 1} ${y + 2} L${x + 1} ${y - 2} L${x + 4} ${y} L${x + 5} ${y - 4} L${x + 7} ${y - 1} L${x + 8} ${y + 3} Z`, 'red')
    : rect(x + 1, y - 1, 7, 3, 'black'));
  p.push(path(`M${x + 1} ${y + 6} H${x + 8} L${x + 10} ${y + 16} H${x - 1} Z`, shirt, 'black'));
  if (marked) p.push(stencil('BS', x + 1, y + 8, 0.75, 'cream'));
  p.push(path(seated ? `M${x + 2} ${y + 17} H${x + 12} V${y + 24} M${x + 7} ${y + 17} L${x + 15} ${y + 20}`
    : `M${x + 2} ${y + 17} L${x + 1} ${y + 25} M${x + 7} ${y + 17} L${x + 9} ${y + 25}`, 'none', 'denim', 3));
  const rightArm = gesture === 'fist' ? `L${x + 13} ${y + 2} V${y - 6}`
    : gesture === 'bottle' ? `L${x + 13} ${y + 12} L${x + 15} ${y + 6}`
    : `L${x + 12} ${y + 11}`;
  p.push(path(`M${x} ${y + 8} L${x - 2} ${y + 14} M${x + 8} ${y + 8} ${rightArm}`, 'none', 'cream', 2));
  if (gesture === 'fist') p.push(rect(x + 11, y - 9, 5, 4, 'cream'));
  if (gesture === 'bottle') p.push(path(`M${x + 14} ${y + 6} v-6 h1 v-3 h2 v3 h1 v6 Z`, 'mustard', 'black'));
  return p.join('\n  ');
}
function neighbors() {
  return `<defs>\n    <g id="punk">${fan(0, 0, true, false, 'black', true, 'fist')}</g>\n    <g id="drinker">${fan(0, 0, false, false, 'green', false, 'bottle')}</g>\n    <g id="neighbor">${fan(0, 0, false, false, 'denim')}</g>\n    <g id="seated">${fan(0, 0, false, true, 'red')}</g>\n  </defs>`;
}
function crowd() {
  // Larger heads/gestures survive the 0.78125 scale at 400x50. These
  // definitions are crowd-only: the entrance's neighbors remain unchanged.
  const p = [`<defs>\n    <g id="punk" transform="scale(1.5)">${fan(0, 0, true, false, 'black', true, 'fist')}</g>\n    <g id="drinker" transform="scale(1.5)">${fan(0, 0, false, false, 'green', false, 'bottle')}</g>\n    <g id="neighbor" transform="scale(1.5)">${fan(0, 0, false, false, 'denim')}</g>\n  </defs>`,
    path('M0 60 L85 58 L166 61 L251 58 L340 60 L424 58 L512 60 V64 H0 Z', 'black'),
    path('M80 7 V39 M388 8 V40', 'none', 'mustard', 2),
    path('M81 4 L145 7 L141 23 L81 20 Z', 'cream', 'red'), stencil('BARRO SUR', 86, 10, 1.5),
    path('M389 5 L454 8 L450 24 L389 22 Z', 'red', 'cream'), stencil('RUIDO ROTO', 393, 11, 1.5, 'cream')];
  // Two irregular rows span the full panel. Closer heads enter the bottom
  // half; their bodies crop at the hem like a front row, not a lineup.
  for (const [id, x, y] of [
    ['neighbor', 5, 20], ['punk', 33, 22], ['drinker', 61, 19], ['neighbor', 91, 23],
    ['punk', 117, 20], ['neighbor', 146, 18], ['drinker', 174, 22], ['punk', 203, 21],
    ['neighbor', 231, 19], ['drinker', 261, 23], ['punk', 289, 20], ['neighbor', 317, 22],
    ['drinker', 345, 18], ['punk', 373, 23], ['neighbor', 401, 20], ['drinker', 430, 22],
    ['punk', 459, 19], ['neighbor', 487, 23],
    ['drinker', 18, 35], ['neighbor', 53, 34], ['punk', 87, 37], ['neighbor', 125, 35],
    ['drinker', 162, 36], ['punk', 199, 34], ['neighbor', 236, 37], ['drinker', 273, 35],
    ['neighbor', 311, 36], ['punk', 348, 34], ['drinker', 386, 37], ['neighbor', 424, 35], ['punk', 473, 36],
  ]) p.push(use(id, x, y));
  return p;
}
function entrance() {
  const p = [...wall(), neighbors(), rect(0, 54, 256, 10, 'green'),
    // Off-center doorway anchors the queue; left side is a social pavement.
    rect(83, 11, 46, 43, 'cream'), rect(86, 23, 40, 31, 'red'), rect(89, 25, 29, 29, 'black'),
    path('M118 25 L125 28 V54 H118 Z', 'mustard'), rect(120, 39, 2, 3, 'black'),
    bannerAlphabet(names.entrance), banner(names.entrance[0], 75, 10, 61, 13),
    path('M75 11 L68 9 M136 10 L143 8 M76 23 L70 27', 'none', 'cream'),
    bill(63, 30), rect(82, 54, 50, 3, 'denim'),
    // Waist-high barrier and the line to the entrance.
    path('M145 37 V57 M243 37 V57 M145 39 H243', 'none', 'mustard', 2),
    use('neighbor', 103, 30), use('punk', 145, 33), use('neighbor', 169, 32),
    use('drinker', 193, 33), use('neighbor', 220, 32),
    // Separate standing conversation and seated neighbors with drinks.
    use('drinker', 9, 28), use('punk', 38, 29), rect(4, 49, 58, 3, 'mustard'),
    use('seated', 6, 37), use('seated', 42, 37), rect(22, 46, 3, 5, 'mustard'),
    // Shared neutral entrance; only the small pasted gig poster names a band.
    banner(names.entrance[1], 146, 12, 60, 12),
    rect(146, 11, 5, 2, 'mustard'), rect(201, 23, 5, 2, 'mustard')];
  return p;
}

mkdirSync(out, { recursive: true });
for (const kind of ['guitar', 'bass', 'drums', 'singer', 'guitar2', 'keys', 'sax']) {
  for (const state of ['working', 'idle', 'blocked', 'done']) {
    save(`${kind}-${state}`, `${kind}: ${state}; original DIY gig musician`, person(kind, state));
  }
}
save('backdrop', 'Barro Sur: wide brick and corrugated-tin DIY stage', backdrop(), 256);
save('crowd', 'Ultra-wide front row; invented bands Barro Sur and Ruido Roto', crowd(), 512);
save('entrance', 'Shared venue entrance: ENTRADA, queue and neighbors drinking beer', entrance(), 256);
save('empty-guitar', 'Unoccupied guitar and amplifier; no person', [amp(7, 40), strings('guitar', true), path('M30 50 L26 59 H39 L35 50', 'none', 'denim', 2)]);
save('empty-bass', 'Unoccupied bass and amplifier; no person', [amp(7, 40), strings('bass', true), path('M30 50 L26 59 H39 L35 50', 'none', 'denim', 2)]);
save('empty-drums', 'Unoccupied drum kit and stool; no person', [rect(27, 24, 10, 3, 'denim'), path('M30 27 V33 M35 27 V33', 'none', 'denim', 2), kit()]);
save('empty-mic', 'Unoccupied microphone stand; no person', [mic(32)]);
save('empty-keys', 'Unoccupied keyboard and stool; no person', [rect(26, 26, 12, 3, 'denim'), path('M28 29 V34 M36 29 V34', 'none', 'denim', 2), keyboard()]);
save('empty-sax', 'Unoccupied saxophone on stand; no person', [sax(), path('M38 53 V58 M31 60 L38 57 L46 60', 'none', 'denim', 2)]);
save('backdrop-club', 'Cramped brick club; real-band gig banners under an amber wash', club(), 256);
save('backdrop-galpon', 'Cold corrugated warehouse; real-band banners and stacked road crates', galpon(), 256);
save('backdrop-plaza', 'Open-air plaza stage; real-band flags, horizon and suspended bulbs', plaza(), 256);
save('backdrop-salon', 'Community hall; bunting, real-band posters and plastic chairs', salon(), 256);
console.log('Generated 41 SVGs in punk-venue/mods/punk-venue/art/');
