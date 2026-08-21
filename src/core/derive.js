/**
 * Traced pixels to metric rectangles.
 *
 * Pixels are the single source of truth: they are what the user drew. Metres are
 * always derived, never stored, so there is no second representation to drift out
 * of step. Each room is placed at its own local origin because the layout engine
 * works per room; global positions are recovered separately for the key plan.
 */
export function deriveRoom(room, pxPerM) {
  if (!pxPerM || !room.shapes.length) return { ...room, add: [], sub: [] };
  const minX = Math.min(...room.shapes.map((s) => s.x));
  const minY = Math.min(...room.shapes.map((s) => s.y));
  const add = room.shapes.map((s) => ({
    x: +((s.x - minX) / pxPerM).toFixed(3),
    y: +((s.y - minY) / pxPerM).toFixed(3),
    w: +(s.w / pxPerM).toFixed(3),
    h: +(s.h / pxPerM).toFixed(3),
  }));
  return { ...room, add, sub: [] };
}

export function deriveRooms(rooms, pxPerM) {
  return rooms.map((r) => deriveRoom(r, pxPerM));
}

/** Every room in true relative position, for the key plan. */
export function globalExtent(rooms) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  rooms.forEach((r) => r.shapes.forEach((s) => {
    minX = Math.min(minX, s.x); minY = Math.min(minY, s.y);
    maxX = Math.max(maxX, s.x + s.w); maxY = Math.max(maxY, s.y + s.h);
  }));
  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null;
}
