/**
 * Row planning and the cutting-stock packer.
 *
 * Two separate passes, deliberately. First the geometry decides what lengths each
 * row needs; only then are those lengths packed onto stock planks. Interleaving
 * the two — deciding a length because an offcut happens to be lying around — was
 * the earlier approach and it produced worse packing and unpredictable staggers.
 */
import { stackBands, bandSpans, roomBounds, roomArea } from './geometry';
import type { Bin, DerivedRoom, Material, Piece, PlanEmpty, PlanFull, Plan, RoomLayout, Row } from './types';

export const DEFAULT_MATERIAL: Material = {
  plankLen: 1220, plankWid: 229, packArea: 2.73, packPrice: 24.41,
  gap: 8, kerf: 2, minPiece: 300, minStagger: 300,
};

/** Carries the previous row's closing piece length across `layoutRoom` calls. */
export interface LayoutState {
  lastEnd: number | null;
}

/**
 * Plan one room into rows of plank pieces.
 *
 * Row start offsets are chosen so that seams stay at least `minStagger` from the
 * row above *in the same run*, and so the row does not finish on an unusable
 * sliver — checking only the start leaves a 40 mm scrap at the far wall.
 *
 * `state.lastEnd` carries the previous row's closing piece across calls so the
 * next row can start with its offcut, which is what makes one plank serve two
 * rows with no waste.
 */
export function layoutRoom(room: DerivedRoom, m: Material, state: LayoutState): RoomLayout {
  const { plankLen: L, plankWid: W, gap, minPiece, minStagger } = m;
  const bands = stackBands(room, W, gap);
  const rows: Row[] = [];
  const segStarts: Record<number, number> = {}; // previous row's start offset, per run index

  bands.forEach((band) => {
    const spans = bandSpans(room, band.s0, band.s1, gap);
    if (!spans.length) return;
    const pieces: Piece[] = [];
    spans.forEach((sp, si) => {
      let remaining = sp.end - sp.start;
      let cursor = sp.start;
      let first = true;
      while (remaining > 0.5) {
        let len: number;
        if (first) {
          const tailOK = (s: number) => {
            if (s >= remaining - 0.5) return true;
            const tail = (remaining - s) % L;
            return tail < 0.5 || tail >= minPiece;
          };
          const above = segStarts[si] !== undefined ? segStarts[si] : -99999;
          const valid = (s: number) => s >= minPiece && s <= remaining + 0.5 && Math.abs(s - above) >= minStagger && tailOK(s);
          const chain = state.lastEnd !== null ? L - state.lastEnd - m.kerf : null;
          const ladder: number[] = [];
          for (let v = minPiece; v <= L; v += 10) ladder.push(v);
          const cands = [chain, ...ladder].filter((v): v is number => v !== null && v >= minPiece && v <= Math.min(L, remaining) + 0.5);
          len = cands.find(valid)
            ?? cands.find((s) => Math.abs(s - above) >= minStagger)
            ?? cands.slice().sort((a, b) => Math.abs(b - above) - Math.abs(a - above))[0]
            ?? Math.min(Math.max(minPiece, Math.round(L * 0.5)), remaining);
          len = Math.min(len, remaining);
          segStarts[si] = len;
          first = false;
        } else {
          len = Math.min(L, remaining);
        }
        const full = len >= L - 1;
        pieces.push({ x: cursor, len: Math.round(len), full });
        cursor += len;
        remaining -= len;
        if (remaining <= 0.5) state.lastEnd = full ? null : Math.round(len);
      }
    });
    rows.push({ ...band, pieces, segs: spans.length });
  });

  const b = roomBounds(room);
  return {
    rows,
    area: roomArea(room),
    runMax: (room.dir === 'x' ? b.mx : b.my) * 1000,
    stackMax: (room.dir === 'x' ? b.my : b.mx) * 1000,
  };
}

/**
 * One-dimensional cutting stock, best-fit decreasing.
 *
 * Best-fit rather than first-fit: it packs the piece into whichever open plank
 * leaves the least room left over, which is what turns offcuts into the next
 * piece instead of unusable scrap scattered across many planks.
 */
export function packCuts(pieces: Piece[], plankLen: number, kerf: number): Bin[] {
  const sorted = [...pieces].sort((a, b) => b.len - a.len);
  const bins: Bin[] = [];
  sorted.forEach((pc) => {
    let best: Bin | null = null, bestRemainder = Infinity;
    bins.forEach((bin) => {
      const need = bin.pieces.length ? pc.len + kerf : pc.len;
      const rem = bin.free - need;
      if (rem >= -0.001 && rem < bestRemainder) { best = bin; bestRemainder = rem; }
    });
    if (!best) { best = { id: bins.length + 1, free: plankLen, pieces: [], label: '', waste: 0, cuts: 0 }; bins.push(best); }
    best.free -= best.pieces.length ? pc.len + kerf : pc.len;
    best.pieces.push(pc);
  });
  bins.forEach((bin) => {
    const id = 'P' + String(bin.id).padStart(2, '0');
    bin.label = id;
    bin.pieces.forEach((p, i) => { p.pieceId = id + '·' + 'abcdefgh'[i]; });
    bin.waste = Math.round(bin.free);
    // a plank cut into two pieces with nothing left over needs only one cut
    bin.cuts = bin.waste > 2 ? bin.pieces.length : Math.max(bin.pieces.length - 1, 1);
  });
  return bins;
}

/**
 * The whole job: every room planned, every cut piece packed, totals derived.
 * One computation feeds both the screen and the printed manual so the two can
 * never disagree about what to cut.
 */
export function computePlan(rooms: DerivedRoom[], material: Partial<Material>): Plan {
  const m: Material = { ...DEFAULT_MATERIAL, ...material };
  const active = rooms.filter((r) => !r.skip && r.add.length);
  if (!active.length) return { empty: true, material: m } satisfies PlanEmpty;

  const state: LayoutState = { lastEnd: null };
  const layouts: PlanFull['layouts'] = [];
  const allCuts: Piece[] = [];
  let full = 0, area = 0;

  active.forEach((room) => {
    const L = layoutRoom(room, m, state);
    area += L.area;
    L.rows.forEach((row, ri) => row.pieces.forEach((p, pi) => {
      if (p.full) full++;
      else { p.room = room.code; p.row = ri + 1; p.pos = pi + 1; allCuts.push(p); }
    }));
    layouts.push({ room, layout: L });
  });

  const bins = packCuts(allCuts, m.plankLen, m.kerf);
  const totalPlanks = full + bins.length;
  const buyArea = (totalPlanks * m.plankLen * m.plankWid) / 1e6;
  const packs = Math.ceil(buyArea / m.packArea);

  return {
    empty: false, material: m, layouts, allCuts, bins,
    full, area, totalPlanks, buyArea, packs,
    cuts: bins.reduce((a, b) => a + b.cuts, 0),
    costExVat: (packs * m.packPrice).toFixed(2),
    costIncVat: (packs * m.packPrice * 1.21).toFixed(2),
    overPct: (((buyArea / area) - 1) * 100).toFixed(1),
    naivePlanks: full + allCuts.length,
  } satisfies PlanFull;
}
