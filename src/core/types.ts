/**
 * Shared domain types.
 *
 * Pixels and metres are kept as distinct types (`ShapePx` vs `RectM`) even
 * though both are just `{x,y,w,h}` numbers, because the two must never be
 * mixed silently — see the note in `derive.ts`.
 */

export type Dir = 'x' | 'y';
export type Edge = 'top' | 'bottom' | 'left' | 'right';

/** A traced rectangle, in image pixels. Mutated in place during a drag. */
export interface ShapePx {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A rectangle in metres, local to its room's own origin. */
export interface RectM {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A room as held in the reducer: pixel shapes plus (empty until derived) metric rectangles. */
export interface Room {
  id: number;
  name: string;
  code: string;
  dir: Dir;
  skip: boolean;
  shapes: ShapePx[];
  add: RectM[];
  sub: RectM[];
}

/** A room after `deriveRoom`: `add` holds the metric rectangles (still empty `sub`). */
export type DerivedRoom = Room;

export interface Pin {
  id: number;
  roomId: number;
  shapeId: number;
  edge: Edge;
  metres: number;
}

export interface ScaleBar {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  metres: number;
}

export interface Material {
  plankLen: number;
  plankWid: number;
  packArea: number;
  packPrice: number;
  gap: number;
  kerf: number;
  minPiece: number;
  minStagger: number;
}

export interface ScaleObservation {
  px: number;
  m: number;
  weight: number;
  label?: string;
  pin?: Pin;
  impliedM?: number;
  errPct?: number;
}

export interface ScaleResult {
  pxPerM: number | null;
  residual: number | null;
  observations: ScaleObservation[];
}

/* ---- geometry ---- */

export interface RunStack {
  r0: number;
  r1: number;
  t0: number;
  t1: number;
}

export interface Bounds {
  mx: number;
  my: number;
}

export type Segment =
  | { vertical: true; x: number; y1: number; y2: number; out: 1 | -1; len: number }
  | { vertical: false; y: number; x1: number; x2: number; out: 1 | -1; len: number };

export interface Band {
  s0: number;
  s1: number;
  width: number;
  ripped: boolean;
}

export interface Span {
  start: number;
  end: number;
}

/* ---- layout ---- */

export interface Piece {
  x: number;
  len: number;
  full: boolean;
  pieceId?: string;
  room?: string;
  row?: number;
  pos?: number;
}

export interface Row extends Band {
  pieces: Piece[];
  segs: number;
}

export interface RoomLayout {
  rows: Row[];
  area: number;
  runMax: number;
  stackMax: number;
}

export interface Bin {
  id: number;
  free: number;
  pieces: Piece[];
  label: string;
  waste: number;
  cuts: number;
}

export interface RoomWithLayout {
  room: DerivedRoom;
  layout: RoomLayout;
}

export interface PlanEmpty {
  empty: true;
  material: Material;
}

export interface PlanFull {
  empty: false;
  material: Material;
  layouts: RoomWithLayout[];
  allCuts: Piece[];
  bins: Bin[];
  full: number;
  area: number;
  totalPlanks: number;
  buyArea: number;
  packs: number;
  cuts: number;
  costExVat: string;
  costIncVat: string;
  overPct: string;
  naivePlanks: number;
}

export type Plan = PlanEmpty | PlanFull;

/* ---- project document (persisted/exported JSON) ---- */

export interface ProjectDocShape {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ProjectDocRoom {
  name: string;
  code: string;
  dir: Dir;
  skip: boolean;
  shapes: ProjectDocShape[];
}

export interface ProjectDocPin {
  roomCode: string | undefined;
  shapeId: number;
  edge: Edge;
  metres: number;
}

export interface ProjectDoc {
  version: number;
  savedAt: string;
  image: string | null;
  imageName: string | null;
  /** Set only by the autosave fallback when the image had to be dropped to fit storage. */
  imageDropped?: boolean;
  scaleBar: ScaleBar | null;
  material: Material;
  pins: ProjectDocPin[];
  rooms: ProjectDocRoom[];
}

/** What a saved document rebuilds into: same shape the reducer's `loadProject` merges in. */
export interface DeserialisedData {
  rooms: Room[];
  pins: Pin[];
  scaleBar: ScaleBar | null;
  imageData: string | null;
  imageName: string | null;
  material: Material;
  imageDropped: boolean;
  nextRoomId: number;
  nextShapeId: number;
  nextPinId: number;
}

export interface SaveResult {
  ok: boolean;
  imageDropped?: boolean;
}

export type LoadLocalResult = DeserialisedData | { unavailable: true } | null;
