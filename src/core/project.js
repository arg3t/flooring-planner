/**
 * The project document: one JSON shape used by both autosave and file export.
 *
 * Shapes are persisted in image pixels rather than metres. Pixels are what was
 * drawn; metres regenerate from the scale, so a reload reproduces the work
 * exactly and a later correction to the scale simply flows through.
 */
import { DEFAULT_MATERIAL } from './layout.js';

export const PROJECT_VERSION = 1;
export const STORAGE_KEY = 'plankPlanner.project.v1';

export function serialise(state) {
  return {
    version: PROJECT_VERSION,
    savedAt: new Date().toISOString(),
    image: state.imageData || null,
    imageName: state.imageName || null,
    scaleBar: state.scaleBar || null,
    material: { ...state.material },
    pins: state.pins.map((p) => ({
      roomCode: (state.rooms.find((r) => r.id === p.roomId) || {}).code,
      shapeId: p.shapeId, edge: p.edge, metres: p.metres,
    })),
    rooms: state.rooms.map((r) => ({
      name: r.name, code: r.code, dir: r.dir, skip: r.skip,
      shapes: r.shapes.map((s) => ({ id: s.id, x: s.x, y: s.y, w: s.w, h: s.h })),
    })),
  };
}

/** Reject a bad document loudly rather than half-loading it. */
export function validate(doc) {
  const problems = [];
  if (typeof doc !== 'object' || doc === null) return ['not an object'];
  if (doc.version === undefined) problems.push('no version field — not a planner project');
  else if (doc.version > PROJECT_VERSION) problems.push(`saved by a newer version (${doc.version}); this build understands ${PROJECT_VERSION}`);
  if (!Array.isArray(doc.rooms)) problems.push('no rooms array');
  else doc.rooms.forEach((r, i) => {
    if (typeof r.name !== 'string') problems.push(`room ${i + 1}: missing name`);
    if (r.shapes && !Array.isArray(r.shapes)) problems.push(`room ${i + 1}: shapes is not a list`);
    (r.shapes || []).forEach((s, j) => {
      if (![s.x, s.y, s.w, s.h].every((v) => typeof v === 'number' && Number.isFinite(v)))
        problems.push(`room ${i + 1} shape ${j + 1}: non-numeric geometry`);
    });
  });
  if (doc.pins && !Array.isArray(doc.pins)) problems.push('pins is not a list');
  return problems;
}

/**
 * Rebuild state from a document. Ids are reassigned, and pins — which reference
 * rooms by code and shapes by their saved id — are re-bound to the new ids, so
 * the numbering scheme is free to change between versions.
 */
export function deserialise(doc) {
  let nextRoomId = 1, nextShapeId = 1, nextPinId = 1;
  const byCode = new Map();
  const rooms = (doc.rooms || []).map((r) => {
    const room = {
      id: nextRoomId++, name: r.name, code: r.code || `R${nextRoomId}`,
      dir: r.dir === 'y' ? 'y' : 'x', skip: !!r.skip,
      shapes: (r.shapes || []).map((s) => ({ id: nextShapeId++, x: +s.x, y: +s.y, w: +s.w, h: +s.h, srcId: s.id })),
      add: [], sub: [],
    };
    byCode.set(room.code, room);
    return room;
  });
  const pins = [];
  (doc.pins || []).forEach((p) => {
    const room = byCode.get(p.roomCode);
    if (!room) return;
    const shape = room.shapes.find((s) => s.srcId === p.shapeId);
    if (!shape) return;
    pins.push({ id: nextPinId++, roomId: room.id, shapeId: shape.id, edge: p.edge, metres: +p.metres });
  });
  rooms.forEach((r) => r.shapes.forEach((s) => { delete s.srcId; }));
  return {
    rooms, pins,
    scaleBar: doc.scaleBar || null,
    imageData: doc.image || null,
    imageName: doc.imageName || null,
    material: { ...DEFAULT_MATERIAL, ...(doc.material || {}) },
    imageDropped: !!doc.imageDropped,
    nextRoomId, nextShapeId, nextPinId,
  };
}

/**
 * Local storage, guarded at every step.
 *
 * Storage can be disabled, full, or throw on read. The plan image is usually
 * what overflows the quota, so the fallback drops it and keeps the geometry —
 * the part that took work — instead of losing the save entirely.
 */
export function saveLocal(state) {
  const write = (doc) => window.localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
  try { write(serialise(state)); return { ok: true }; }
  catch (e) {
    try { write({ ...serialise(state), image: null, imageDropped: true }); return { ok: true, imageDropped: true }; }
    catch (e2) { return { ok: false }; }
  }
}

export function loadLocal() {
  let raw;
  try { raw = window.localStorage.getItem(STORAGE_KEY); }
  catch (e) { return { unavailable: true }; }
  if (!raw) return null;
  let doc;
  try { doc = JSON.parse(raw); } catch (e) { return null; }
  if (validate(doc).length) return null;
  return deserialise(doc);
}

export function clearLocal() {
  try { window.localStorage.removeItem(STORAGE_KEY); } catch (e) { /* nothing to clear */ }
}
