import type { Action, State } from './state/store';

/**
 * The testing seam described in `state/store.tsx`: the tracing canvas paints
 * imperatively, so tests drive it through these deliberately-exposed handles
 * instead of asserting on rendered output.
 */
export interface PlankPlannerTestHandle {
  getState: () => State;
  dispatch: (action: Action) => void;
  setImage: (img: HTMLImageElement) => void;
}

export interface EditorViewHandle {
  setView: (v: { s: number; tx: number; ty: number }) => void;
}

declare global {
  interface Window {
    __plankPlanner?: PlankPlannerTestHandle;
    __plankPlannerEditors?: Map<number, EditorViewHandle>;
  }
}
