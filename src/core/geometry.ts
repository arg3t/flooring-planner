/**
 * Geometry over rooms.
 *
 * A room is a union of axis-aligned rectangles (`add`) minus cut-outs (`sub`),
 * in metres. Planks run along one axis; the code calls that the "run" axis and
 * the perpendicular one the "stack" axis, so the same routines serve both plank
 * directions without duplication.
 */
import type { Band, Bounds, DerivedRoom, RectM, RunStack, Segment, Span } from './types';

/** Rectangle extents mapped from room x/y into run/stack terms, in millimetres. */
export function toRunStack(room: DerivedRoom, r: RectM): RunStack {
  return room.dir === 'x'
    ? { r0: r.x * 1000, r1: (r.x + r.w) * 1000, t0: r.y * 1000, t1: (r.y + r.h) * 1000 }
    : { r0: r.y * 1000, r1: (r.y + r.h) * 1000, t0: r.x * 1000, t1: (r.x + r.w) * 1000 };
}

export function roomBounds(room: DerivedRoom): Bounds {
  let mx = 0, my = 0;
  room.add.forEach((r) => { mx = Math.max(mx, r.x + r.w); my = Math.max(my, r.y + r.h); });
  return { mx, my };
}

export function roomArea(room: DerivedRoom): number {
  const add = room.add.reduce((a, r) => a + r.w * r.h, 0);
  const sub = (room.sub || []).reduce((a, r) => a + r.w * r.h, 0);
  return add - sub;
}

/**
 * The true boundary of a room.
 *
 * The input rectangles overlap and share internal borders that are not walls, so
 * their own edges cannot be used directly. Instead: build the grid of every
 * rectangle edge, mark which cells are floor, and keep every grid edge with floor
 * on exactly one side. Collinear neighbours merge into one run, so what comes out
 * is the wall a plank actually meets.
 *
 * @returns segments {vertical, x|y, y1/y2|x1/x2, out, len} — `out` is +1/-1, the
 *          side the floor is *not* on, which is where a dimension label belongs.
 */
export function roomOutline(room: DerivedRoom): Segment[] {
  const all = [...room.add, ...(room.sub || [])];
  if (!all.length) return [];
  const xs = [...new Set(all.flatMap((r) => [r.x, r.x + r.w]).map((v) => +v.toFixed(4)))].sort((a, b) => a - b);
  const ys = [...new Set(all.flatMap((r) => [r.y, r.y + r.h]).map((v) => +v.toFixed(4)))].sort((a, b) => a - b);

  const inside = (cx: number, cy: number) => {
    let on = false;
    room.add.forEach((r) => { if (cx > r.x && cx < r.x + r.w && cy > r.y && cy < r.y + r.h) on = true; });
    (room.sub || []).forEach((r) => { if (cx > r.x && cx < r.x + r.w && cy > r.y && cy < r.y + r.h) on = false; });
    return on;
  };

  const nx = xs.length - 1, ny = ys.length - 1;
  const occ: number[][] = [];
  for (let i = 0; i < ny; i++) {
    occ.push([]);
    for (let j = 0; j < nx; j++) occ[i].push(inside((xs[j] + xs[j + 1]) / 2, (ys[i] + ys[i + 1]) / 2) ? 1 : 0);
  }

  type VRun = { vertical: true; x: number; y1: number; y2: number; out: 1 | -1 };
  type HRun = { vertical: false; y: number; x1: number; x2: number; out: 1 | -1 };
  const segs: (VRun | HRun)[] = [];
  for (let j = 0; j <= nx; j++) {
    let run: VRun | null = null;
    for (let i = 0; i < ny; i++) {
      const left = j > 0 ? occ[i][j - 1] : 0;
      const right = j < nx ? occ[i][j] : 0;
      if (left !== right) {
        const out: 1 | -1 = right ? -1 : 1;
        if (run && run.out === out) run.y2 = ys[i + 1];
        else { if (run) segs.push(run); run = { vertical: true, x: xs[j], y1: ys[i], y2: ys[i + 1], out }; }
      } else if (run) { segs.push(run); run = null; }
    }
    if (run) segs.push(run);
  }
  for (let i = 0; i <= ny; i++) {
    let run: HRun | null = null;
    for (let j = 0; j < nx; j++) {
      const up = i > 0 ? occ[i - 1][j] : 0;
      const down = i < ny ? occ[i][j] : 0;
      if (up !== down) {
        const out: 1 | -1 = down ? -1 : 1;
        if (run && run.out === out) run.x2 = xs[j + 1];
        else { if (run) segs.push(run); run = { vertical: false, y: ys[i], x1: xs[j], x2: xs[j + 1], out }; }
      } else if (run) { segs.push(run); run = null; }
    }
    if (run) segs.push(run);
  }
  return segs.map((s): Segment => (s.vertical
    ? { ...s, len: s.y2 - s.y1 }
    : { ...s, len: s.x2 - s.x1 }));
}

/**
 * Rows across the stack axis. Band edges are placed at every shape boundary
 * first, so a row never straddles a change in the room's width; within each zone
 * rows are one plank wide until the remainder, which gets ripped narrower.
 */
export function stackBands(room: DerivedRoom, plankWidth: number, gap: number): Band[] {
  const b = roomBounds(room);
  const stackMax = (room.dir === 'x' ? b.my : b.mx) * 1000;
  const edges = new Set<number>([0, stackMax]);
  [...room.add, ...(room.sub || [])].forEach((r) => {
    const m = toRunStack(room, r); edges.add(m.t0); edges.add(m.t1);
  });
  const sorted = [...edges].filter((v) => v >= -0.01 && v <= stackMax + 0.01).sort((a, b2) => a - b2);
  const bands: Band[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i], z = sorted[i + 1];
    if (z - a < 30) continue;
    let y = a + (i === 0 ? gap : 0);
    const zb = z - (i === sorted.length - 2 ? gap : 0);
    while (zb - y > 1) {
      const h = Math.min(plankWidth, zb - y);
      bands.push({ s0: y, s1: y + h, width: h, ripped: h < plankWidth - 1 });
      y += h;
    }
  }
  return bands;
}

/**
 * The stretches of floor a given row crosses, inset by the expansion gap.
 * A row over an L-shape can be split into several separate runs.
 */
export function bandSpans(room: DerivedRoom, s0: number, s1: number, gap: number): Span[] {
  const spans: Span[] = [];
  room.add.forEach((r) => {
    const m = toRunStack(room, r);
    if (s0 >= m.t0 - 0.01 && s1 <= m.t1 + 0.01) spans.push({ start: m.r0 + gap, end: m.r1 - gap });
  });
  if (!spans.length) return [];
  spans.sort((a, b) => a.start - b.start);
  const merged = [spans[0]];
  for (let i = 1; i < spans.length; i++) {
    const last = merged[merged.length - 1];
    if (spans[i].start <= last.end + 2 * gap + 1) last.end = Math.max(last.end, spans[i].end);
    else merged.push(spans[i]);
  }
  let out = merged;
  (room.sub || []).forEach((r) => {
    const m = toRunStack(room, r);
    if (m.t1 <= s0 + 0.01 || m.t0 >= s1 - 0.01) return;
    const a = m.r0 - gap, b = m.r1 + gap, next: Span[] = [];
    out.forEach((sp) => {
      if (b <= sp.start || a >= sp.end) { next.push(sp); return; }
      if (a > sp.start) next.push({ start: sp.start, end: Math.min(a, sp.end) });
      if (b < sp.end) next.push({ start: Math.max(b, sp.start), end: sp.end });
    });
    out = next;
  });
  return out.filter((s) => s.end - s.start > 20);
}

/**
 * Connected groups of traced shapes.
 *
 * Snapping guarantees that shapes meant to touch touch exactly, but nothing stops
 * someone dragging one away. A floor is a single continuous surface, so a room in
 * more than one piece is a modelling mistake worth reporting rather than planning
 * as though it were fine.
 */
export function islands<T extends { x: number; y: number; w: number; h: number }>(
  room: { shapes?: T[] },
): T[][] {
  const S = room.shapes || [];
  if (!S.length) return [];
  const parent = S.map((_, i) => i);
  const find = (a: number): number => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  const union = (a: number, b: number) => { a = find(a); b = find(b); if (a !== b) parent[b] = a; };
  const touch = (p: T, q: T, eps = 0.6) => {
    const ox = Math.min(p.x + p.w, q.x + q.w) - Math.max(p.x, q.x);
    const oy = Math.min(p.y + p.h, q.y + q.h) - Math.max(p.y, q.y);
    return ox >= -eps && oy >= -eps && (ox > eps || oy > eps); // an edge, not just a corner
  };
  for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) if (touch(S[i], S[j])) union(i, j);
  const groups = new Map<number, T[]>();
  S.forEach((s, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r)!.push(s); });
  return [...groups.values()];
}
