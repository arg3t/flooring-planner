/**
 * Pixels to metres.
 *
 * A traced rectangle has a size in pixels and needs one in metres. Exactly one
 * number bridges them, so "which edges can't be calculated?" collapses to a
 * single question — what is the scale? — asked once. Before any known length
 * exists nothing can be measured and the UI must say so rather than invent a
 * number; after the first, every edge in every room is determined.
 */

export function pinPixelLength(rooms, pin) {
  const room = rooms.find((r) => r.id === pin.roomId);
  if (!room) return null;
  const shape = room.shapes.find((s) => s.id === pin.shapeId);
  if (!shape) return null;
  return pin.edge === 'top' || pin.edge === 'bottom' ? Math.abs(shape.w) : Math.abs(shape.h);
}

const MIN_USABLE_PX = 4; // a shorter edge is a mis-drag, not a measurement

/**
 * Weighted least squares over every known length. Weight is pixel length,
 * because a 500 px edge read to a couple of pixels is far more trustworthy than
 * a 40 px one. Residuals come back per observation so a mistyped pin is visible
 * instead of quietly dragging the scale.
 */
export function solveScale(rooms, pins, scaleBar) {
  const obs = [];
  if (scaleBar && scaleBar.metres > 0) {
    const len = Math.hypot(scaleBar.x2 - scaleBar.x1, scaleBar.y2 - scaleBar.y1);
    if (len > MIN_USABLE_PX) obs.push({ px: len, m: scaleBar.metres, weight: len * 1.5, label: 'scale bar' });
  }
  pins.forEach((pin) => {
    const px = pinPixelLength(rooms, pin);
    if (px && px > MIN_USABLE_PX && pin.metres > 0) obs.push({ px, m: pin.metres, weight: px, pin });
  });
  if (!obs.length) return { pxPerM: null, residual: null, observations: [] };

  let num = 0, den = 0;
  obs.forEach((o) => { num += o.weight * (o.px / o.m); den += o.weight; });
  const pxPerM = num / den;
  obs.forEach((o) => { o.impliedM = o.px / pxPerM; o.errPct = ((o.impliedM - o.m) / o.m) * 100; });
  return { pxPerM, residual: Math.max(...obs.map((o) => Math.abs(o.errPct))), observations: obs };
}
