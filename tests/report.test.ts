import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReport } from '../src/report/buildReport';
import { deriveRooms } from '../src/core/derive';
import { solveScale } from '../src/core/scale';
import type { Room } from '../src/core/types';

function fixture() {
  const rooms: Room[] = [
    { id: 1, name: 'Living', code: 'LV', dir: 'x', skip: false,
      shapes: [{ id: 1, x: 0, y: 0, w: 600, h: 400 }, { id: 2, x: 600, y: 0, w: 300, h: 700 }], add: [], sub: [] },
    { id: 2, name: 'Bedroom', code: 'B1', dir: 'y', skip: false,
      shapes: [{ id: 3, x: 0, y: 400, w: 600, h: 300 }], add: [], sub: [] },
  ];
  const pins = [{ id: 1, roomId: 1, shapeId: 1, edge: 'top' as const, metres: 6 }];
  const { pxPerM } = solveScale(rooms, pins, null);
  return { rooms: deriveRooms(rooms, pxPerM), pxPerM };
}

test('manual builds and covers all three phases', () => {
  const { rooms, pxPerM } = fixture();
  const html = buildReport(rooms, {}, pxPerM) as string;
  assert.ok(html.length > 3000);
  assert.match(html, /job sheet/);
  assert.match(html, /Laying order/);
  assert.match(html, /Cut sheet/);
});

test('manual is greyscale only — nothing depends on hue', () => {
  const { rooms, pxPerM } = fixture();
  const html = buildReport(rooms, {}, pxPerM) as string;
  const coloured = [...html.matchAll(/#[0-9a-fA-F]{6}/g)].map((mm) => mm[0]).filter((h) => {
    const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
    return Math.max(r, g, b) - Math.min(r, g, b) > 12;
  });
  assert.deepEqual(coloured, []);
});

test('ripped rows are dots, not hatching', () => {
  const { rooms, pxPerM } = fixture();
  const html = buildReport(rooms, {}, pxPerM) as string;
  assert.match(html, /pattern id="rip"[\s\S]{0,140}circle/);
  assert.doesNotMatch(html, /pattern id="rip"[\s\S]{0,140}<line/);
});

test('every cut piece appears in both the lay order and the cut sheet', () => {
  const { rooms, pxPerM } = fixture();
  const html = buildReport(rooms, {}, pxPerM) as string;
  const ids = [...html.matchAll(/<b>(P\d{2,3})·([a-h])<\/b>/g)];
  assert.ok(ids.length > 0);
  ids.forEach(([, plank]) => {
    assert.ok(html.includes(`>${plank}<`), `${plank} missing from the cut sheet`);
  });
});

test('key plan is present, positioned and scaled', () => {
  const { rooms, pxPerM } = fixture();
  const html = buildReport(rooms, {}, pxPerM) as string;
  assert.match(html, /Key plan/);
  assert.match(html, /LV<\/text>/);
  assert.match(html, /B1<\/text>/);
  assert.match(html, /\d+ m<\/text>/); // scale bar
});

test('no key plan without a scale, and no crash either', () => {
  const rooms = [{ id: 1, name: 'A', code: 'A', dir: 'x' as const, skip: false, shapes: [], add: [{ x: 0, y: 0, w: 3, h: 3 }], sub: [] }];
  const html = buildReport(rooms, {}, null);
  assert.ok(html);
  assert.doesNotMatch(html as string, /Key plan/);
});

test('nothing to lay returns null rather than an empty document', () => {
  assert.equal(buildReport([], {}, 100), null);
});
