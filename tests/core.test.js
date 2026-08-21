import test from 'node:test';
import assert from 'node:assert/strict';
import { roomOutline, islands, roomArea, bandSpans, stackBands } from '../src/core/geometry.js';
import { layoutRoom, packCuts, computePlan, DEFAULT_MATERIAL } from '../src/core/layout.js';
import { solveScale } from '../src/core/scale.js';
import { deriveRoom, deriveRooms } from '../src/core/derive.js';
import { weld, snapValue, snapCandidates } from '../src/core/snapping.js';
import { serialise, validate, deserialise } from '../src/core/project.js';

const rect = (x, y, w, h) => ({ x, y, w, h });
const room = (add, dir = 'x') => ({ id: 1, code: 'R', dir, add, sub: [], shapes: [] });

test('outline of a plain rectangle is four edges of the right lengths', () => {
  const segs = roomOutline(room([rect(0, 0, 5, 3)]));
  assert.equal(segs.length, 4);
  const lens = segs.map((s) => +s.len.toFixed(2)).sort((a, b) => a - b);
  assert.deepEqual(lens, [3, 3, 5, 5]);
});

test('outline of an L reports the step, not the internal seam', () => {
  // 6x4 with a 2x2 bite out of one corner. Tracing it: 6, 4, 4, 2, 2, 2 — six
  // edges. The seam where the two input rectangles meet must not appear.
  const segs = roomOutline(room([rect(0, 0, 6, 2), rect(2, 2, 4, 2)]));
  assert.equal(segs.length, 6);
  assert.equal(+segs.reduce((a, s) => a + s.len, 0).toFixed(2), 20);
  const lens = segs.map((s) => +s.len.toFixed(2)).sort((a, b) => a - b);
  assert.deepEqual(lens, [2, 2, 2, 4, 4, 6]);
});

test('a row splits into separate runs where the shape breaks', () => {
  const r = room([rect(0, 0, 2, 3), rect(5, 0, 2, 3)]);
  const spans = bandSpans(r, 0, 229, 8);
  assert.equal(spans.length, 2);
});

test('rows tile the coverable run exactly, with no sliver at the far wall', () => {
  const r = room([rect(0, 0, 5.86, 3.06)]);
  const state = { lastEnd: null };
  const L = layoutRoom(r, DEFAULT_MATERIAL, state);
  L.rows.forEach((row) => {
    const spans = bandSpans(r, row.s0, row.s1, DEFAULT_MATERIAL.gap);
    const spanTotal = spans.reduce((a, s) => a + (s.end - s.start), 0);
    const pieceTotal = row.pieces.reduce((a, p) => a + p.len, 0);
    assert.ok(Math.abs(spanTotal - pieceTotal) < 2, 'row must fill its run');
    row.pieces.forEach((p) => assert.ok(p.len >= 250, `no sliver, got ${p.len}`));
  });
});

test('adjacent rows keep the seam stagger', () => {
  const r = room([rect(0, 0, 5.86, 3.06)]);
  const L = layoutRoom(r, DEFAULT_MATERIAL, { lastEnd: null });
  for (let i = 1; i < L.rows.length; i++) {
    const a = L.rows[i - 1].pieces[0].len;
    const b = L.rows[i].pieces[0].len;
    assert.ok(Math.abs(a - b) >= DEFAULT_MATERIAL.minStagger, `rows ${i} and ${i + 1} start too close`);
  }
});

test('packing never over-fills a plank and charges kerf per extra cut', () => {
  const pieces = [610, 610, 400, 300, 900, 250].map((len, i) => ({ len, id: i }));
  const bins = packCuts(pieces, 1220, 2);
  bins.forEach((b) => {
    const used = b.pieces.reduce((a, p) => a + p.len, 0) + 2 * (b.pieces.length - 1);
    assert.ok(used <= 1220.001, `bin ${b.label} over-filled: ${used}`);
  });
  // 610+610 needs 1222 with kerf, so they cannot share a plank
  const shared = bins.find((b) => b.pieces.filter((p) => p.len === 610).length === 2);
  assert.equal(shared, undefined);
});

test('packing beats one-plank-per-piece', () => {
  const pieces = Array.from({ length: 40 }, (_, i) => ({ len: 300 + (i % 5) * 100 }));
  const bins = packCuts(pieces, 1220, 2);
  assert.ok(bins.length < pieces.length, 'pairing must save planks');
});

test('scale: no known length means no measurement', () => {
  const s = solveScale([], [], null);
  assert.equal(s.pxPerM, null);
});

test('scale: one pin determines everything', () => {
  const rooms = [{ id: 1, shapes: [{ id: 1, x: 0, y: 0, w: 500, h: 300 }] }];
  const pins = [{ id: 1, roomId: 1, shapeId: 1, edge: 'top', metres: 5 }];
  const { pxPerM } = solveScale(rooms, pins, null);
  assert.equal(pxPerM, 100);
  const d = deriveRoom({ ...rooms[0], code: 'R', dir: 'x' }, pxPerM);
  assert.equal(d.add[0].w, 5);
  assert.equal(d.add[0].h, 3);
});

test('scale: conflicting pins resolve toward the longer, more reliable edge', () => {
  const rooms = [{ id: 1, shapes: [{ id: 1, x: 0, y: 0, w: 500, h: 300 }] }];
  const pins = [
    { id: 1, roomId: 1, shapeId: 1, edge: 'top', metres: 5.0 },
    { id: 2, roomId: 1, shapeId: 1, edge: 'left', metres: 3.3 },
  ];
  const { pxPerM, residual } = solveScale(rooms, pins, null);
  const expected = (500 * (500 / 5) + 300 * (300 / 3.3)) / 800;
  assert.ok(Math.abs(pxPerM - expected) < 0.01);
  assert.ok(residual > 5, 'the disagreement must be reported');
});

test('scale: a degenerate edge is not accepted as calibration', () => {
  const rooms = [{ id: 1, shapes: [{ id: 1, x: 0, y: 0, w: 3, h: 3 }] }];
  const pins = [{ id: 1, roomId: 1, shapeId: 1, edge: 'top', metres: 4 }];
  assert.equal(solveScale(rooms, pins, null).pxPerM, null);
});

test('weld closes a sliver, preserves a real gap, and is idempotent', () => {
  const r = { shapes: [{ id: 1, x: 0, y: 0, w: 200, h: 100 }, { id: 2, x: 203, y: 0, w: 150, h: 100 }] };
  weld(r, 4);
  assert.ok(Math.abs(r.shapes[1].x - 200.5) < 1e-9 || r.shapes[1].x === r.shapes[0].x + r.shapes[0].w);
  assert.equal(r.shapes[1].x, r.shapes[0].x + r.shapes[0].w);
  const snapshot = JSON.stringify(r.shapes);
  weld(r, 4);
  assert.equal(JSON.stringify(r.shapes), snapshot, 'weld must be idempotent');

  const far = { shapes: [{ id: 1, x: 0, y: 0, w: 200, h: 100 }, { id: 2, x: 260, y: 0, w: 150, h: 100 }] };
  weld(far, 4);
  assert.equal(far.shapes[1].x - (far.shapes[0].x + far.shapes[0].w), 60, 'a deliberate gap survives');
});

test('snapValue only snaps inside tolerance', () => {
  assert.equal(snapValue(103, [100, 200], 5), 100);
  assert.equal(snapValue(108, [100, 200], 5), 108);
});

test('snap candidates span rooms so rooms can abut', () => {
  const rooms = [
    { shapes: [{ id: 1, x: 0, y: 0, w: 100, h: 100 }] },
    { shapes: [{ id: 2, x: 300, y: 0, w: 100, h: 100 }] },
  ];
  const { xs } = snapCandidates(rooms, null);
  assert.deepEqual(xs.sort((a, b) => a - b), [0, 100, 300, 400]);
});

test('islands detects a room drawn in disconnected pieces', () => {
  const joined = { shapes: [{ id: 1, x: 0, y: 0, w: 10, h: 10 }, { id: 2, x: 10, y: 0, w: 10, h: 10 }] };
  assert.equal(islands(joined).length, 1);
  const split = { shapes: [{ id: 1, x: 0, y: 0, w: 10, h: 10 }, { id: 2, x: 50, y: 0, w: 10, h: 10 }] };
  assert.equal(islands(split).length, 2);
  const corner = { shapes: [{ id: 1, x: 0, y: 0, w: 10, h: 10 }, { id: 2, x: 10, y: 10, w: 10, h: 10 }] };
  assert.equal(islands(corner).length, 2, 'touching at a corner only is not connected');
});

test('computePlan on an empty set says so instead of returning zeros', () => {
  assert.equal(computePlan([], {}).empty, true);
  assert.equal(computePlan([{ skip: false, add: [] }], {}).empty, true);
});

test('computePlan buys enough material to cover the floor', () => {
  const rooms = [{ id: 1, code: 'A', name: 'A', dir: 'x', skip: false, shapes: [], sub: [], add: [rect(0, 0, 5.86, 3.06)] }];
  const plan = computePlan(rooms, {});
  assert.ok(plan.buyArea >= plan.area, 'must not buy less than the floor');
  assert.ok(plan.packs * plan.material.packArea >= plan.buyArea, 'packs must cover the planks');
  assert.ok(plan.bins.length < plan.allCuts.length, 'offcuts must be paired');
});

test('project round-trip reproduces geometry and scale exactly', () => {
  const state = {
    imageData: 'data:image/png;base64,AA', imageName: 'plan.png', scaleBar: null,
    material: { ...DEFAULT_MATERIAL },
    rooms: [{ id: 7, name: 'Hall', code: 'HA', dir: 'y', skip: false, shapes: [{ id: 3, x: 10, y: 20, w: 400, h: 300 }], add: [], sub: [] }],
    pins: [{ id: 1, roomId: 7, shapeId: 3, edge: 'top', metres: 4 }],
  };
  const doc = serialise(state);
  assert.equal(validate(doc).length, 0);
  const back = deserialise(doc);
  assert.equal(back.rooms.length, 1);
  assert.equal(back.rooms[0].dir, 'y');
  assert.equal(back.pins.length, 1, 'the pin must re-bind to the new shape id');
  assert.equal(back.pins[0].shapeId, back.rooms[0].shapes[0].id);
  const before = solveScale(state.rooms, state.pins, null).pxPerM;
  const after = solveScale(back.rooms, back.pins, null).pxPerM;
  assert.equal(after, before);
});

test('validate rejects junk with a reason', () => {
  assert.ok(validate({ hello: 1 }).length);
  assert.ok(validate({ version: 99, rooms: [] }).some((m) => /newer/.test(m)));
  assert.ok(validate({ version: 1, rooms: [{ name: 'x', shapes: [{ x: 'a', y: 0, w: 1, h: 1 }] }] }).some((m) => /non-numeric/.test(m)));
  assert.equal(validate({ version: 1, rooms: [{ name: 'x', shapes: [] }] }).length, 0);
});

test('derived rooms place each room at its own origin', () => {
  const rooms = [{ id: 1, code: 'A', dir: 'x', shapes: [{ id: 1, x: 500, y: 500, w: 100, h: 100 }] }];
  const [d] = deriveRooms(rooms, 100);
  assert.equal(d.add[0].x, 0);
  assert.equal(d.add[0].y, 0);
  assert.equal(d.add[0].w, 1);
});
