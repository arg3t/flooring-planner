/**
 * Room diagram for print.
 *
 * Greyscale by construction: no hue carries meaning, because the manual will be
 * photocopied and read next to a saw. A full plank is outline only, a cut piece a
 * light tint with its ID printed on it, a ripped row a dot fill, a cut-out a
 * cross-hatch. The shapes are distinguishable with the colour thrown away.
 */
import { roomOutline } from '../core/geometry.js';
import { toRunStack } from '../core/geometry.js';

const TARGET_W = 470;
const TARGET_H = 225;

export function printSvg(layout, room) {
  const sc = Math.min(TARGET_W / layout.runMax, TARGET_H / layout.stackMax, 0.26);
  const w = layout.runMax * sc;
  const h = layout.stackMax * sc;
  const padL = 40, padT = 26;

  let g = `<defs>
    <pattern id="rip" width="4.2" height="4.2" patternUnits="userSpaceOnUse">
      <circle cx="1.05" cy="1.05" r=".85" fill="#000"/><circle cx="3.15" cy="3.15" r=".85" fill="#000"/></pattern>
    <pattern id="void" width="7" height="7" patternUnits="userSpaceOnUse">
      <path d="M0,7 L7,0 M-1,1 L1,-1 M6,8 L8,6" stroke="#000" stroke-width=".7" stroke-opacity=".45"/></pattern>
  </defs>`;
  g += `<rect x="${padL}" y="${padT}" width="${w}" height="${h}" fill="none" stroke="#999" stroke-dasharray="3 3" stroke-width=".8"/>`;

  (room.sub || []).forEach((sq) => {
    const m = toRunStack(room, sq);
    g += `<rect x="${padL + m.r0 * sc}" y="${padT + m.t0 * sc}" width="${(m.r1 - m.r0) * sc}" height="${(m.t1 - m.t0) * sc}"
      fill="url(#void)" stroke="#666" stroke-dasharray="3 2" stroke-width=".8"/>`;
  });

  layout.rows.forEach((row, ri) => {
    row.pieces.forEach((p) => {
      const pw = p.len * sc, ph = row.width * sc;
      const x = padL + p.x * sc, y = padT + row.s0 * sc;
      g += `<rect x="${x}" y="${y}" width="${Math.max(pw - 0.8, 0)}" height="${Math.max(ph - 0.8, 0)}"
             fill="${p.full ? '#fff' : '#dcdcdc'}" stroke="#000" stroke-width=".7"/>`;
      if (row.ripped) g += `<rect x="${x}" y="${y}" width="${Math.max(pw - 0.8, 0)}" height="${Math.max(ph - 0.8, 0)}" fill="url(#rip)" stroke="none"/>`;
      if (!p.full && p.pieceId && pw > 26 && ph > 8) {
        g += `<text x="${x + pw / 2}" y="${y + ph / 2 + 2.6}" font-size="7" font-family="monospace" text-anchor="middle">${p.pieceId.replace('P', '').replace('·', '')}</text>`;
      }
    });
    if (ri % 5 === 0 || ri === layout.rows.length - 1) {
      g += `<text x="${padL - 5}" y="${padT + row.s0 * sc + row.width * sc / 2 + 2.5}" font-size="6.5" font-family="monospace" text-anchor="end" fill="#666">${ri + 1}</text>`;
    }
  });

  g += dimensions(room, sc, padL, padT);
  const totalW = w + padL + 34;
  return { svg: `<svg width="${totalW}" height="${h + padT + 30}" viewBox="0 0 ${totalW} ${h + padT + 30}">${g}</svg>`, width: totalW };
}

/** Edge lengths in mm, pushed clear of one another so nothing overlaps. */
function dimensions(room, sc, padL, padT) {
  const map = (x, y) => (room.dir === 'x' ? [x * 1000, y * 1000] : [y * 1000, x * 1000]);
  const placed = [];
  let g = '';
  roomOutline(room).slice().sort((a, b) => b.len - a.len).forEach((sg) => {
    if (sg.len < 0.3) return;
    const a = sg.vertical ? map(sg.x, sg.y1) : map(sg.x1, sg.y);
    const b = sg.vertical ? map(sg.x, sg.y2) : map(sg.x2, sg.y);
    const horizontalOnScreen = Math.abs(a[1] - b[1]) < 0.001;
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    let nx = 0, ny = 0;
    if (sg.vertical) { if (room.dir === 'x') nx = sg.out; else ny = sg.out; }
    else { if (room.dir === 'x') ny = sg.out; else nx = sg.out; }
    let off = 9, tx, ty, tries = 0, clash;
    do {
      tx = padL + mx * sc + nx * off;
      ty = padT + my * sc + ny * off + (horizontalOnScreen ? (ny > 0 ? 6 : -2.5) : 2.5);
      clash = placed.some((q) => Math.abs(q.x - tx) < 20 && Math.abs(q.y - ty) < 9);
      if (clash) off += 10;
      tries++;
    } while (clash && tries < 4);
    placed.push({ x: tx, y: ty });
    g += `<line x1="${padL + a[0] * sc}" y1="${padT + a[1] * sc}" x2="${padL + b[0] * sc}" y2="${padT + b[1] * sc}" stroke="#000" stroke-width="1.1"/>`;
    g += `<text x="${tx}" y="${ty}" font-size="7" font-family="monospace" text-anchor="middle" ${horizontalOnScreen ? '' : `transform="rotate(-90 ${tx} ${ty})"`}>${(sg.len * 1000).toFixed(0)}</text>`;
  });
  return g;
}

/** Legend swatches. A CSS gradient does not survive every print path; SVG does. */
export function swatch(kind) {
  const fill = kind === 'cut' ? '#dcdcdc' : '#fff';
  let inner = '';
  if (kind === 'rip') inner = '<circle cx="3.2" cy="3.2" r="1.35"/><circle cx="6.8" cy="6.8" r="1.35"/>';
  if (kind === 'void') inner = '<path d="M1,9 L9,1 M1,1 L9,9" stroke="#000" stroke-width=".7" fill="none"/>';
  return `<svg class="sw" width="10" height="10" viewBox="0 0 10 10"><rect x=".5" y=".5" width="9" height="9" fill="${fill}" stroke="#000" stroke-width=".8"/>${inner}</svg>`;
}
