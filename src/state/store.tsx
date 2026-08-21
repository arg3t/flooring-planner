/**
 * One reducer holding the whole project.
 *
 * Everything the user can change lives here; everything else is derived on read.
 * Derived values (the scale, the metric rectangles, the plan) are recomputed with
 * useMemo rather than stored, so there is no cache to invalidate and no way for
 * pixels and metres to disagree.
 */
import React, { createContext, useContext, useMemo, useReducer, useEffect, useRef, type ReactNode } from 'react';
import { DEFAULT_MATERIAL, computePlan } from '../core/layout';
import { solveScale } from '../core/scale';
import { deriveRooms } from '../core/derive';
import { weld, WELD_TOL_PX } from '../core/snapping';
import { serialise, saveLocal, loadLocal, clearLocal } from '../core/project';
import type {
  DerivedRoom, DeserialisedData, Edge, Material, Pin, Plan, Room, ScaleBar, ScaleResult, ShapePx,
} from '../core/types';

export interface IoNote {
  kind: 'ok' | 'bad';
  text: string;
}

export interface State {
  image: HTMLImageElement | null;
  imageData: string | null;
  imageName: string | null;
  rooms: Room[];
  pins: Pin[];
  scaleBar: ScaleBar | null;
  material: Material;
  nextRoomId: number;
  nextShapeId: number;
  nextPinId: number;
  saveNote: string;
  ioNote: IoNote | null;
}

export type Action =
  | { type: 'setImage'; image: HTMLImageElement; dataUrl: string | null; name: string }
  | { type: 'addRoom' }
  | { type: 'removeRoom'; id: number }
  | { type: 'patchRoom'; id: number; patch: Partial<Room> }
  | { type: 'addShape'; roomId: number; shape: Omit<ShapePx, 'id'> }
  | { type: 'commitShapes'; roomId: number; shapes: ShapePx[]; zoom?: number }
  | { type: 'removeShape'; roomId: number; shapeId: number }
  | { type: 'setPin'; roomId: number; shapeId: number; edge: Edge; metres: number }
  | { type: 'clearPin'; roomId: number; shapeId: number; edge: Edge }
  | { type: 'dropPin'; id: number }
  | { type: 'setScaleBar'; bar: ScaleBar }
  | { type: 'setMaterial'; key: keyof Material; value: number }
  | { type: 'loadProject'; data: DeserialisedData; image?: HTMLImageElement | null; quiet?: boolean; note?: IoNote | null }
  | { type: 'reset' }
  | { type: 'note'; note: IoNote | null }
  | { type: 'saveNote'; note: string };

const blankRoom = (id: number, n: number): Room => (
  { id, name: `Room ${n}`, code: `R${n}`, dir: 'x', skip: false, shapes: [], add: [], sub: [] }
);

export const initialState = (): State => ({
  image: null, imageData: null, imageName: '',
  rooms: [blankRoom(1, 1)],
  pins: [], scaleBar: null,
  material: { ...DEFAULT_MATERIAL },
  nextRoomId: 2, nextShapeId: 1, nextPinId: 1,
  saveNote: 'not saved yet',
  ioNote: null,
});

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'setImage':
      return { ...state, image: action.image, imageData: action.dataUrl, imageName: action.name };

    case 'addRoom': {
      const n = state.rooms.length + 1;
      return { ...state, rooms: [...state.rooms, blankRoom(state.nextRoomId, n)], nextRoomId: state.nextRoomId + 1 };
    }
    case 'removeRoom':
      return {
        ...state,
        rooms: state.rooms.filter((r) => r.id !== action.id),
        pins: state.pins.filter((p) => p.roomId !== action.id),
      };
    case 'patchRoom':
      return { ...state, rooms: state.rooms.map((r) => (r.id === action.id ? { ...r, ...action.patch } : r)) };

    case 'addShape': {
      const shape: ShapePx = { ...action.shape, id: state.nextShapeId };
      return {
        ...state,
        nextShapeId: state.nextShapeId + 1,
        rooms: state.rooms.map((r) => (r.id === action.roomId ? { ...r, shapes: [...r.shapes, shape] } : r)),
      };
    }
    /** Shapes are mutated in place during a drag for responsiveness, then committed
     *  here: welded to remove slivers and copied so React sees a new tree. */
    case 'commitShapes': {
      const rooms = state.rooms.map((r) => {
        if (r.id !== action.roomId) return r;
        const next = { ...r, shapes: action.shapes.map((s) => ({ ...s })) };
        weld(next, WELD_TOL_PX / (action.zoom || 1));
        return next;
      });
      return { ...state, rooms };
    }
    case 'removeShape':
      return {
        ...state,
        rooms: state.rooms.map((r) => (r.id === action.roomId ? { ...r, shapes: r.shapes.filter((s) => s.id !== action.shapeId) } : r)),
        pins: state.pins.filter((p) => !(p.roomId === action.roomId && p.shapeId === action.shapeId)),
      };

    case 'setPin': {
      const existing = state.pins.find((p) => p.roomId === action.roomId && p.shapeId === action.shapeId && p.edge === action.edge);
      if (existing) {
        return { ...state, pins: state.pins.map((p) => (p === existing ? { ...p, metres: action.metres } : p)) };
      }
      return {
        ...state,
        nextPinId: state.nextPinId + 1,
        pins: [...state.pins, { id: state.nextPinId, roomId: action.roomId, shapeId: action.shapeId, edge: action.edge, metres: action.metres }],
      };
    }
    case 'clearPin':
      return { ...state, pins: state.pins.filter((p) => !(p.roomId === action.roomId && p.shapeId === action.shapeId && p.edge === action.edge)) };
    case 'dropPin':
      return { ...state, pins: state.pins.filter((p) => p.id !== action.id) };
    case 'setScaleBar':
      return { ...state, scaleBar: action.bar };

    case 'setMaterial':
      return { ...state, material: { ...state.material, [action.key]: action.value } };

    case 'loadProject':
      return {
        ...initialState(), ...action.data,
        image: action.image || null,
        saveNote: action.quiet ? `restored from this browser${action.data.imageDropped ? ' — image not kept' : ''}` : 'loaded from file',
        ioNote: action.note || null,
      };
    case 'reset':
      return { ...initialState(), saveNote: 'reset' };
    case 'note':
      return { ...state, ioNote: action.note };
    case 'saveNote':
      return { ...state, saveNote: action.note };
    default:
      return state;
  }
}

export interface ProjectContextValue {
  state: State;
  dispatch: React.Dispatch<Action>;
  scale: ScaleResult;
  derivedRooms: DerivedRoom[];
  plan: Plan;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  // restore before first paint so the user never sees an empty app flash
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const saved = loadLocal();
    if (!saved) return;
    if ('unavailable' in saved) { dispatch({ type: 'saveNote', note: 'autosave unavailable — use Save file' }); return; }
    // geometry first: it is the part that took work and must not wait on an image
    dispatch({ type: 'loadProject', data: saved, quiet: true });
    if (saved.imageData) {
      const img = new Image();
      img.onload = () => dispatch({ type: 'setImage', image: img, dataUrl: saved.imageData, name: saved.imageName || 'plan' });
      img.src = saved.imageData;
    }
  }, []);

  const scale = useMemo(() => solveScale(state.rooms, state.pins, state.scaleBar), [state.rooms, state.pins, state.scaleBar]);
  const derivedRooms = useMemo(() => deriveRooms(state.rooms, scale.pxPerM), [state.rooms, scale.pxPerM]);
  const plan = useMemo(() => computePlan(derivedRooms, state.material), [derivedRooms, state.material]);

  // autosave, debounced so a drag does not write on every frame
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dead = useRef(false);
  useEffect(() => {
    if (dead.current || !restored.current) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const result = saveLocal(state);
      if (!result.ok) { dead.current = true; dispatch({ type: 'saveNote', note: 'autosave unavailable — use Save file' }); return; }
      const at = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      dispatch({ type: 'saveNote', note: result.imageDropped ? 'saved without the image — too large for this browser' : `saved ${at}` });
    }, 500);
    return () => clearTimeout(timer.current);
  }, [state.rooms, state.pins, state.scaleBar, state.material, state.imageData]);

  /**
   * Testing seam.
   *
   * The tracing canvas draws imperatively, so there is no rendered output a test
   * can assert on, and jsdom cannot decode an image — which makes the ordinary
   * upload path unusable from a test. Rather than leave the canvas untested, the
   * app exposes a deliberate handle for driving it. It reads and writes only what
   * the UI already can, so nothing here can reach a state a user could not.
   */
  useEffect(() => {
    window.__plankPlanner = {
      getState: () => state,
      dispatch,
      setImage: (img) => dispatch({ type: 'setImage', image: img, dataUrl: null, name: 'test' }),
    };
  }, [state, dispatch]);

  const value = useMemo(() => ({ state, dispatch, scale, derivedRooms, plan }), [state, scale, derivedRooms, plan]);
  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be used inside <ProjectProvider>');
  return ctx;
}

export { serialise, clearLocal };
