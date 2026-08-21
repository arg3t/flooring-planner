/**
 * Snapping.
 *
 * "No gaps between rectangles" needs two mechanisms, because they fail
 * differently. Live snapping stops a gap being created; the weld pass removes
 * slivers that survive many small edits. Neither may fight a deliberate move:
 * dragging a shape well clear of another must leave it clear, and a room ending
 * up in disconnected pieces is caught by `islands` instead.
 */

export const SNAP_SCREEN_PX = 9; // felt in screen pixels, divided by zoom
export const WELD_TOL_PX = 3.0;

/** Candidates span every room, so rooms abut each other cleanly too. */
export function snapCandidates(rooms, exceptShapeId) {
  const xs = [], ys = [];
  rooms.forEach((r) => r.shapes.forEach((s) => {
    if (s.id === exceptShapeId) return;
    xs.push(s.x, s.x + s.w);
    ys.push(s.y, s.y + s.h);
  }));
  return { xs, ys };
}

export function snapValue(v, candidates, tolerance) {
  let best = v, bestDistance = tolerance;
  for (const c of candidates) {
    const d = Math.abs(c - v);
    if (d < bestDistance) { bestDistance = d; best = c; }
  }
  return best;
}

/**
 * Collapse near-coincident edges onto their mean.
 * Idempotent, and provably removes every gap below tolerance — which live
 * snapping alone does not, since each individual edit can land just inside it.
 */
export function weld(room, tolerance) {
  if (!room.shapes.length) return room;
  const cluster = (get) => {
    const vals = [];
    room.shapes.forEach((s) => { vals.push(get(s, 0)); vals.push(get(s, 1)); });
    vals.sort((a, b) => a - b);
    const groups = [];
    let cur = [vals[0]];
    for (let i = 1; i < vals.length; i++) {
      if (vals[i] - cur[cur.length - 1] <= tolerance) cur.push(vals[i]);
      else { groups.push(cur); cur = [vals[i]]; }
    }
    groups.push(cur);
    const map = new Map();
    groups.forEach((g) => { const mean = g.reduce((a, b) => a + b, 0) / g.length; g.forEach((v) => map.set(v, mean)); });
    return map;
  };
  const mx = cluster((s, i) => (i ? s.x + s.w : s.x));
  const my = cluster((s, i) => (i ? s.y + s.h : s.y));
  room.shapes.forEach((s) => {
    const x0 = mx.get(s.x) ?? s.x;
    const x1 = mx.get(s.x + s.w) ?? s.x + s.w;
    const y0 = my.get(s.y) ?? s.y;
    const y1 = my.get(s.y + s.h) ?? s.y + s.h;
    s.x = x0; s.w = Math.max(4, x1 - x0);
    s.y = y0; s.h = Math.max(4, y1 - y0);
  });
  return room;
}
