/**
 * The project document: one JSON shape used by both autosave and file export.
 *
 * Shapes are persisted in image pixels rather than metres. Pixels are what was
 * drawn; metres regenerate from the scale, so a reload reproduces the work
 * exactly and a later correction to the scale simply flows through.
 */
import { DEFAULT_MATERIAL } from './layout';
import type { DeserialisedData, Dir, Material, Pin, ProjectDoc, Room, ScaleBar, ShapePx } from './types';

export const PROJECT_VERSION = 1;
export const STORAGE_KEY = 'plankPlanner.project.v1';

/** The subset of app state a saved/exported document is built from. */
export interface SerialisableState {
  imageData: string | null;
  imageName: string | null;
  scaleBar: ScaleBar | null;
  material: Material;
  pins: Pin[];
  rooms: Room[];
}

export function serialise(state: SerialisableState): ProjectDoc {
  return {
    version: PROJECT_VERSION,
    savedAt: new Date().toISOString(),
    image: state.imageData || null,
    imageName: state.imageName || null,
    scaleBar: state.scaleBar || null,
    material: { ...state.material },
    pins: state.pins.map((p) => ({
      roomCode: state.rooms.find((r) => r.id === p.roomId)?.code,
      shapeId: p.shapeId, edge: p.edge, metres: p.metres,
    })),
    rooms: state.rooms.map((r) => ({
      name: r.name, code: r.code, dir: r.dir, skip: r.skip,
      shapes: r.shapes.map((s) => ({ id: s.id, x: s.x, y: s.y, w: s.w, h: s.h })),
    })),
  };
}

/** The document's shape once `validate` has vouched for it: fields the app trusts. */
export interface ValidatedDocShape {
  id?: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ValidatedDocRoom {
  name: string;
  code?: string;
  dir?: string;
  skip?: boolean;
  shapes?: ValidatedDocShape[];
}

export interface ValidatedDocPin {
  roomCode?: string;
  shapeId?: number;
  edge: string;
  metres: number;
}

export interface ValidatedDoc {
  version: number;
  image?: string | null;
  imageName?: string | null;
  imageDropped?: boolean;
  scaleBar?: ScaleBar | null;
  material?: Partial<Material>;
  pins?: ValidatedDocPin[];
  rooms?: ValidatedDocRoom[];
}

/** Loosely-typed shape of whatever JSON came off disk, before `validate` vouches for it. */
interface UncheckedShape {
  x?: unknown;
  y?: unknown;
  w?: unknown;
  h?: unknown;
}

interface UncheckedRoom {
  name?: unknown;
  shapes?: unknown;
}

interface UncheckedDoc {
  version?: unknown;
  rooms?: unknown;
  pins?: unknown;
}

/** Reject a bad document loudly rather than half-loading it. */
export function validate(doc: unknown): string[] {
  const problems: string[] = [];
  if (typeof doc !== 'object' || doc === null) return ['not an object'];
  const d = doc as UncheckedDoc;
  if (d.version === undefined) problems.push('no version field — not a planner project');
  else if (typeof d.version === 'number' && d.version > PROJECT_VERSION) {
    problems.push(`saved by a newer version (${d.version}); this build understands ${PROJECT_VERSION}`);
  }
  if (!Array.isArray(d.rooms)) problems.push('no rooms array');
  else (d.rooms as UncheckedRoom[]).forEach((r, i) => {
    if (typeof r.name !== 'string') problems.push(`room ${i + 1}: missing name`);
    if (r.shapes && !Array.isArray(r.shapes)) problems.push(`room ${i + 1}: shapes is not a list`);
    ((r.shapes as UncheckedShape[] | undefined) || []).forEach((s, j) => {
      if (![s.x, s.y, s.w, s.h].every((v) => typeof v === 'number' && Number.isFinite(v)))
        problems.push(`room ${i + 1} shape ${j + 1}: non-numeric geometry`);
    });
  });
  if (d.pins !== undefined && !Array.isArray(d.pins)) problems.push('pins is not a list');
  return problems;
}

/**
 * Rebuild state from a document. Ids are reassigned, and pins — which reference
 * rooms by code and shapes by their saved id — are re-bound to the new ids, so
 * the numbering scheme is free to change between versions.
 *
 * Callers MUST have run `validate(raw)` first and seen no problems: the cast
 * below is that validation's payoff, not a substitute for it.
 */
export function deserialise(raw: unknown): DeserialisedData {
  const doc = raw as ValidatedDoc;
  let nextRoomId = 1, nextShapeId = 1, nextPinId = 1;
  const byCode = new Map<string, { id: number; shapes: (ShapePx & { srcId: number | undefined })[] }>();
  const rooms: Room[] = (doc.rooms || []).map((r) => {
    const id = nextRoomId++;
    const shapes = (r.shapes || []).map((s) => ({ id: nextShapeId++, x: +s.x, y: +s.y, w: +s.w, h: +s.h, srcId: s.id }));
    const code = r.code || `R${id}`;
    byCode.set(code, { id, shapes });
    const room: Room = {
      id, name: r.name, code,
      dir: (r.dir === 'y' ? 'y' : 'x') as Dir, skip: !!r.skip,
      shapes: shapes.map(({ srcId: _srcId, ...shape }) => shape),
      add: [], sub: [],
    };
    return room;
  });
  const pins: Pin[] = [];
  (doc.pins || []).forEach((p) => {
    const room = p.roomCode !== undefined ? byCode.get(p.roomCode) : undefined;
    if (!room) return;
    const shape = room.shapes.find((s) => s.srcId === p.shapeId);
    if (!shape) return;
    pins.push({ id: nextPinId++, roomId: room.id, shapeId: shape.id, edge: p.edge as Pin['edge'], metres: +p.metres });
  });
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
export function saveLocal(state: SerialisableState): { ok: boolean; imageDropped?: boolean } {
  const write = (doc: ProjectDoc) => window.localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
  try { write(serialise(state)); return { ok: true }; }
  catch {
    try { write({ ...serialise(state), image: null, imageDropped: true }); return { ok: true, imageDropped: true }; }
    catch { return { ok: false }; }
  }
}

export function loadLocal(): DeserialisedData | { unavailable: true } | null {
  let raw: string | null;
  try { raw = window.localStorage.getItem(STORAGE_KEY); }
  catch { return { unavailable: true }; }
  if (!raw) return null;
  let doc: unknown;
  try { doc = JSON.parse(raw); } catch { return null; }
  if (validate(doc).length) return null;
  return deserialise(doc);
}

export function clearLocal(): void {
  try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* nothing to clear */ }
}
