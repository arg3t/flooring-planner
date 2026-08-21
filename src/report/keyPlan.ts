/**
 * Key plan: every room in its true relative position.
 *
 * This is the sheet you hold to see which room is which and how they meet; the
 * per-room pages are for laying. It is drawn from the traced pixel coordinates,
 * so it reflects the actual plan rather than the per-room local origins.
 */
import { roomOutline, roomArea } from '../core/geometry';
import { globalExtent } from '../core/derive';
import type { RoomWithLayout } from '../core/types';

const AVAIL_W = 700;
const AVAIL_H = 250;
const MIN_LABELLED_EDGE_M = 1.0; // a key plan wants the shape at a glance, not every jog

export function keyPlan(layouts: RoomWithLayout[], pxPerM: number | null): string {
  if (!pxPerM) return '';
  const rooms = layouts.filter((l) => l.room.shapes.length);
  if (!rooms.length) return '';
  const ext = globalExtent(rooms.map((l) => l.room));
  if (!ext) return '';

  const wM = (ext.maxX - ext.minX) / pxPerM;
  const hM = (ext.maxY - ext.minY) / pxPerM;
  if (!(wM > 0 && hM > 0)) return '';

  const sc = Math.min(AVAIL_W / wM, AVAIL_H / hM);
  const pad = 22;
  const W = wM * sc + pad * 2;
  const H = hM * sc + pad * 2;
  let g = '';

  rooms.forEach(({ room }) => {
    // a global-coordinate twin, so the same outline code applies
    const twin = {
      id: room.id, name: room.name, code: room.code, skip: false,
      dir: 'x' as const, sub: [], shapes: [],
      add: room.shapes.map((s) => ({
        x: (s.x - ext.minX) / pxPerM, y: (s.y - ext.minY) / pxPerM,
        w: s.w / pxPerM, h: s.h / pxPerM,
      })),
    };
    twin.add.forEach((a) => {
      g += `<rect x="${pad + a.x * sc}" y="${pad + a.y * sc}" width="${a.w * sc}" height="${a.h * sc}" fill="#f2f2f2" stroke="none"/>`;
    });
    roomOutline(twin).forEach((sg) => {
      const a: [number, number] = sg.vertical ? [sg.x, sg.y1] : [sg.x1, sg.y];
      const b: [number, number] = sg.vertical ? [sg.x, sg.y2] : [sg.x2, sg.y];
      g += `<line x1="${pad + a[0] * sc}" y1="${pad + a[1] * sc}" x2="${pad + b[0] * sc}" y2="${pad + b[1] * sc}" stroke="#000" stroke-width="1.3"/>`;
      if (sg.len >= MIN_LABELLED_EDGE_M) {
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        const tx = pad + mx * sc + (sg.vertical ? sg.out * 7 : 0);
        const ty = pad + my * sc + (sg.vertical ? 0 : sg.out * 7 + (sg.out > 0 ? 4 : -1));
        g += `<text x="${tx}" y="${ty}" font-size="6" font-family="monospace" fill="#444" text-anchor="middle" ${sg.vertical ? `transform="rotate(-90 ${tx} ${ty})"` : ''}>${(sg.len * 1000).toFixed(0)}</text>`;
      }
    });
    // the label goes in the biggest rectangle: an area-weighted centroid falls
    // inside the notch of an L-shape and the label disappears off the fill
    const big = twin.add.reduce((a, q) => (q.w * q.h > a.w * a.h ? q : a), twin.add[0]);
    const tx = pad + (big.x + big.w / 2) * sc;
    const ty = pad + (big.y + big.h / 2) * sc;
    g += `<rect x="${tx - 15}" y="${ty - 8}" width="30" height="16" fill="#fff" fill-opacity=".82"/>`;
    g += `<text x="${tx}" y="${ty}" font-size="9" font-weight="700" text-anchor="middle">${room.code}</text>`;
    g += `<text x="${tx}" y="${ty + 7.5}" font-size="6" text-anchor="middle" fill="#555">${roomArea(room).toFixed(1)} m²</text>`;
  });

  const barM = Math.max(1, Math.round(wM / 5));
  const bx = pad, by = H - 6;
  g += `<line x1="${bx}" y1="${by}" x2="${bx + barM * sc}" y2="${by}" stroke="#000" stroke-width="1.4"/>
        <line x1="${bx}" y1="${by - 2.5}" x2="${bx}" y2="${by + 2.5}" stroke="#000" stroke-width="1.4"/>
        <line x1="${bx + barM * sc}" y1="${by - 2.5}" x2="${bx + barM * sc}" y2="${by + 2.5}" stroke="#000" stroke-width="1.4"/>
        <text x="${bx + barM * sc + 5}" y="${by + 2.2}" font-size="6.5" font-family="monospace">${barM} m</text>`;

  return `<div class="keyplan"><h3>Key plan — rooms in position, edges in mm</h3>
    <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${g}</svg></div>`;
}
