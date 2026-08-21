/**
 * Tracing canvas.
 *
 * Shapes are mutated in place while a pointer is down — a drag has to redraw at
 * frame rate and dispatching through the reducer per move would be wasteful — and
 * committed to the store on release, where they are welded and copied.
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useProject } from '../state/store.jsx';
import { snapCandidates, snapValue, SNAP_SCREEN_PX } from '../core/snapping.js';

const HANDLES = [[0, 0, 'nw'], [0.5, 0, 'n'], [1, 0, 'ne'], [1, 0.5, 'e'], [1, 1, 'se'], [0.5, 1, 's'], [0, 1, 'sw'], [0, 0.5, 'w']];
const MIN_DRAW_PX = 5;
const DRAFT_ID = -1;   // the shape being dragged out, not yet in the store

export default function ShapeEditor({ room }) {
  const { state, dispatch, scale } = useProject();
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const viewRef = useRef({ s: 1, tx: 0, ty: 0 });
  const dragRef = useRef(null);
  const pointersRef = useRef(new Map());
  const pinchRef = useRef(null);
  const shapesRef = useRef(room.shapes);
  const [tool, setTool] = useState('draw');
  const [selId, setSelId] = useState(null);
  const [edgeBox, setEdgeBox] = useState(null);
  const [, force] = useState(0);
  const redraw = useCallback(() => force((n) => n + 1), []);

  // Mirror the store between gestures, but never during one. This line used to
  // run unconditionally on every render, so the moment a drag began — which sets
  // selection state and therefore re-renders — the in-progress shape was thrown
  // away and the rest of the drag had nothing to resize.
  if (!dragRef.current) shapesRef.current = room.shapes;
  const sel = () => shapesRef.current.find((s) => s.id === selId) || null;

  /** Take a private copy for the duration of a gesture. */
  const beginGesture = () => { shapesRef.current = room.shapes.map((s) => ({ ...s })); };

  const size = () => {
    const w = wrapRef.current?.clientWidth || 600;
    return { w, h: Math.round(Math.min(420, Math.max(240, w * 0.7))) };
  };

  const fit = useCallback(() => {
    if (!state.image) return;
    const { w, h } = size();
    const s = Math.min(w / state.image.width, h / state.image.height) * 0.96;
    viewRef.current = { s, tx: (w - state.image.width * s) / 2, ty: (h - state.image.height * s) / 2 };
  }, [state.image]);

  useEffect(() => { fit(); redraw(); }, [fit, redraw]);

  // part of the testing seam described in store.jsx: lets a test pin the view
  // transform so client coordinates map straight onto image coordinates
  useEffect(() => {
    const registry = (window.__plankPlannerEditors ||= new Map());
    registry.set(room.id, { setView: (v) => { viewRef.current = { ...v }; redraw(); } });
    return () => registry.delete(room.id);
  }, [room.id, redraw]);

  /* ---- painting ---- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { w, h } = size();
    const dpr = window.devicePixelRatio || 1;
    canvas.style.height = `${h}px`;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const c = canvas.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const view = viewRef.current;
    const toScreen = (p) => ({ x: p.x * view.s + view.tx, y: p.y * view.s + view.ty });

    c.clearRect(0, 0, w, h);
    c.fillStyle = '#0a1b2a';
    c.fillRect(0, 0, w, h);
    if (!state.image) {
      c.fillStyle = '#5C7A93';
      c.font = '13px IBM Plex Sans';
      c.textAlign = 'center';
      c.fillText('Upload a floor plan above to start tracing', w / 2, h / 2);
      return;
    }
    c.save();
    c.translate(view.tx, view.ty);
    c.scale(view.s, view.s);
    c.drawImage(state.image, 0, 0);
    c.restore();

    // other rooms, ghosted, so shared walls are visible
    state.rooms.forEach((r) => {
      if (r.id === room.id) return;
      r.shapes.forEach((s) => {
        const a = toScreen(s);
        c.strokeStyle = 'rgba(143,170,194,.35)';
        c.lineWidth = 1;
        c.setLineDash([4, 3]);
        c.strokeRect(a.x, a.y, s.w * view.s, s.h * view.s);
        c.setLineDash([]);
      });
    });

    shapesRef.current.forEach((s) => {
      const a = toScreen(s);
      const sw = s.w * view.s, sh = s.h * view.s;
      const on = s.id === selId;
      c.fillStyle = on ? 'rgba(201,138,85,.32)' : 'rgba(201,138,85,.18)';
      c.fillRect(a.x, a.y, sw, sh);
      c.strokeStyle = on ? '#E3B23C' : '#C98A55';
      c.lineWidth = on ? 2 : 1.4;
      c.strokeRect(a.x, a.y, sw, sh);

      c.font = '10px IBM Plex Mono';
      c.textBaseline = 'middle';
      [['top', s.w, a.x + sw / 2, a.y - 6], ['bottom', s.w, a.x + sw / 2, a.y + sh + 13],
       ['left', s.h, a.x - 6, a.y + sh / 2], ['right', s.h, a.x + sw + 6, a.y + sh / 2]].forEach(([edge, px, tx, ty]) => {
        if ((edge === 'top' || edge === 'bottom') && sw < 44) return;
        if ((edge === 'left' || edge === 'right') && sh < 34) return;
        const pin = state.pins.find((p) => p.roomId === room.id && p.shapeId === s.id && p.edge === edge);
        if (!on && !pin) return;
        c.fillStyle = pin ? '#5FBF8F' : scale.pxPerM ? '#5FA8D3' : '#E0654C';
        c.textAlign = edge === 'left' ? 'right' : edge === 'right' ? 'left' : 'center';
        c.fillText(pin ? `${pin.metres.toFixed(3)} m` : scale.pxPerM ? `${(px / scale.pxPerM).toFixed(2)} m` : '?', tx, ty);
      });

      if (on) {
        c.fillStyle = '#E3B23C';
        HANDLES.forEach(([fx, fy]) => {
          const q = toScreen({ x: s.x + s.w * fx, y: s.y + s.h * fy });
          c.fillRect(q.x - 4, q.y - 4, 8, 8);
        });
      }
    });

    if (state.scaleBar) {
      const a = toScreen({ x: state.scaleBar.x1, y: state.scaleBar.y1 });
      const b = toScreen({ x: state.scaleBar.x2, y: state.scaleBar.y2 });
      c.strokeStyle = '#5FBF8F';
      c.lineWidth = 2.5;
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
      c.fillStyle = '#5FBF8F';
      c.textAlign = 'center';
      c.fillText(`${state.scaleBar.metres} m`, (a.x + b.x) / 2, (a.y + b.y) / 2 - 8);
    }
  });

  /* ---- pointer ---- */
  const evPt = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const toImage = (p) => ({ x: (p.x - viewRef.current.tx) / viewRef.current.s, y: (p.y - viewRef.current.ty) / viewRef.current.s });

  const zoomAt = (pt, f) => {
    const v = viewRef.current;
    const before = toImage(pt);
    v.s = Math.max(0.05, Math.min(40, v.s * f));
    const after = toImage(pt);
    v.tx += (after.x - before.x) * v.s;
    v.ty += (after.y - before.y) * v.s;
    redraw();
  };

  const hitHandle = (p) => {
    const s = sel();
    if (!s) return null;
    const tol = 11 / viewRef.current.s;
    for (const [fx, fy, k] of HANDLES) {
      if (Math.abs(s.x + s.w * fx - p.x) < tol && Math.abs(s.y + s.h * fy - p.y) < tol) return k;
    }
    return null;
  };
  const hitEdge = (p) => {
    const s = sel();
    if (!s) return null;
    const tol = 10 / viewRef.current.s;
    const inX = p.x >= s.x - tol && p.x <= s.x + s.w + tol;
    const inY = p.y >= s.y - tol && p.y <= s.y + s.h + tol;
    if (inX && Math.abs(p.y - s.y) < tol) return 'top';
    if (inX && Math.abs(p.y - (s.y + s.h)) < tol) return 'bottom';
    if (inY && Math.abs(p.x - s.x) < tol) return 'left';
    if (inY && Math.abs(p.x - (s.x + s.w)) < tol) return 'right';
    return null;
  };
  const hitShape = (p) => [...shapesRef.current].reverse().find((s) => p.x >= s.x && p.x <= s.x + s.w && p.y >= s.y && p.y <= s.y + s.h) || null;

  const onDown = (e) => {
    canvasRef.current.setPointerCapture?.(e.pointerId);
    pointersRef.current.set(e.pointerId, evPt(e));
    if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()];
      pinchRef.current = { d: Math.hypot(a.x - b.x, a.y - b.y), c: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
      dragRef.current = null;
      return;
    }
    const scr = evPt(e);
    const p = toImage(scr);
    setEdgeBox(null);
    if (!state.image) return;

    if (tool === 'bar') { dragRef.current = { mode: 'bar', x0: p.x, y0: p.y, x1: p.x, y1: p.y }; return; }
    if (tool === 'pan') { dragRef.current = { mode: 'pan', sx: scr.x, sy: scr.y, tx: viewRef.current.tx, ty: viewRef.current.ty }; return; }

    // In Draw mode the pointer always draws: otherwise a selected shape's corner
    // handle blocks starting a new shape at that corner, which is exactly what
    // tiling rooms together needs.
    if (tool !== 'draw') {
      const hk = hitHandle(p);
      if (hk) { const orig = { ...sel() }; beginGesture(); dragRef.current = { mode: 'resize', k: hk, orig }; return; }
      const ek = hitEdge(p);
      if (ek) { setEdgeBox({ edge: ek, x: scr.x, y: scr.y }); return; }
      const hs = hitShape(p);
      if (hs) { beginGesture(); setSelId(hs.id); dragRef.current = { mode: 'move', ox: p.x - hs.x, oy: p.y - hs.y, id: hs.id }; redraw(); return; }
      setSelId(null);
      dragRef.current = { mode: 'pan', sx: scr.x, sy: scr.y, tx: viewRef.current.tx, ty: viewRef.current.ty };
      redraw();
      return;
    }

    const cand = snapCandidates(state.rooms, null);
    const tol = SNAP_SCREEN_PX / viewRef.current.s;
    const shape = { id: DRAFT_ID, x: snapValue(p.x, cand.xs, tol), y: snapValue(p.y, cand.ys, tol), w: 1, h: 1 };
    beginGesture();
    shapesRef.current.push(shape);
    setSelId(DRAFT_ID);
    dragRef.current = { mode: 'draw', x0: shape.x, y0: shape.y };
    redraw();
  };

  const onMove = (e) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, evPt(e));
    if (pinchRef.current && pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (pinchRef.current.d > 0) zoomAt(c, d / pinchRef.current.d);
      viewRef.current.tx += c.x - pinchRef.current.c.x;
      viewRef.current.ty += c.y - pinchRef.current.c.y;
      pinchRef.current = { d, c };
      redraw();
      return;
    }
    const drag = dragRef.current;
    if (!drag) return;
    const scr = evPt(e);
    const p = toImage(scr);

    if (drag.mode === 'pan') {
      viewRef.current.tx = drag.tx + (scr.x - drag.sx);
      viewRef.current.ty = drag.ty + (scr.y - drag.sy);
      redraw(); return;
    }
    if (drag.mode === 'bar') { drag.x1 = p.x; drag.y1 = p.y; redraw(); return; }

    const s = sel();
    if (!s) return;
    const cand = snapCandidates(state.rooms, s.id);
    const tol = SNAP_SCREEN_PX / viewRef.current.s;

    if (drag.mode === 'draw') {
      const x1 = snapValue(p.x, cand.xs, tol);
      const y1 = snapValue(p.y, cand.ys, tol);
      s.x = Math.min(drag.x0, x1); s.y = Math.min(drag.y0, y1);
      s.w = Math.max(2, Math.abs(x1 - drag.x0)); s.h = Math.max(2, Math.abs(y1 - drag.y0));
    } else if (drag.mode === 'move') {
      let nx = p.x - drag.ox, ny = p.y - drag.oy;
      // snap whichever edge is closer, so the shape can abut on either side
      const l = snapValue(nx, cand.xs, tol);
      const r = snapValue(nx + s.w, cand.xs, tol) - s.w;
      nx = Math.abs(l - nx) <= Math.abs(r - nx) ? l : r;
      const t = snapValue(ny, cand.ys, tol);
      const b = snapValue(ny + s.h, cand.ys, tol) - s.h;
      ny = Math.abs(t - ny) <= Math.abs(b - ny) ? t : b;
      s.x = nx; s.y = ny;
    } else if (drag.mode === 'resize') {
      const o = drag.orig, k = drag.k;
      let L = o.x, T = o.y, R = o.x + o.w, B = o.y + o.h;
      if (k.includes('w')) L = snapValue(p.x, cand.xs, tol);
      if (k.includes('e')) R = snapValue(p.x, cand.xs, tol);
      if (k.includes('n')) T = snapValue(p.y, cand.ys, tol);
      if (k.includes('s')) B = snapValue(p.y, cand.ys, tol);
      if (R - L < 2) { if (k.includes('w')) L = R - 2; else R = L + 2; }
      if (B - T < 2) { if (k.includes('n')) T = B - 2; else B = T + 2; }
      s.x = L; s.y = T; s.w = R - L; s.h = B - T;
    }
    redraw();
  };

  const onUp = (e) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    const drag = dragRef.current;
    if (!drag) return;
    // the draw branch still needs `sel()` to find the draft, so the gesture flag
    // is cleared at the end of each branch rather than up front
    const endGesture = () => { dragRef.current = null; };

    if (drag.mode === 'bar') {
      const len = Math.hypot(drag.x1 - drag.x0, drag.y1 - drag.y0);
      if (len > 10) {
        const answer = window.prompt('How long is this line, in metres?', '5');
        const metres = parseFloat((answer || '').replace(',', '.'));
        if (metres > 0) dispatch({ type: 'setScaleBar', bar: { x1: drag.x0, y1: drag.y0, x2: drag.x1, y2: drag.y1, metres } });
      }
      endGesture(); redraw(); return;
    }
    if (drag.mode === 'draw') {
      const s = sel();
      const geometry = s ? { x: s.x, y: s.y, w: s.w, h: s.h } : null;
      const tooSmall = !geometry || geometry.w < MIN_DRAW_PX || geometry.h < MIN_DRAW_PX;
      endGesture();
      shapesRef.current = room.shapes;   // drop the draft either way
      if (tooSmall) { setSelId(null); redraw(); return; }
      dispatch({ type: 'addShape', roomId: room.id, shape: geometry });
      setSelId(state.nextShapeId);       // the id the reducer is about to assign
      return;
    }
    if (drag.mode === 'move' || drag.mode === 'resize') {
      const shapes = shapesRef.current;
      endGesture();
      dispatch({ type: 'commitShapes', roomId: room.id, shapes, zoom: viewRef.current.s });
      return;
    }
    endGesture();
  };

  const deleteSelected = () => {
    if (selId === null) return;
    dispatch({ type: 'removeShape', roomId: room.id, shapeId: selId });
    setSelId(null);
  };

  const commitEdge = (value) => {
    const metres = parseFloat(String(value).replace(',', '.'));
    const s = sel();
    if (!s || !(metres > 0)) { setEdgeBox(null); return; }
    dispatch({ type: 'setPin', roomId: room.id, shapeId: s.id, edge: edgeBox.edge, metres });
    setEdgeBox(null);
  };

  const pinFor = (edge) => {
    const s = sel();
    return s ? state.pins.find((p) => p.roomId === room.id && p.shapeId === s.id && p.edge === edge) : null;
  };

  const s = sel();
  const edgePx = edgeBox && s ? (edgeBox.edge === 'top' || edgeBox.edge === 'bottom' ? s.w : s.h) : 0;
  const pin = edgeBox ? pinFor(edgeBox.edge) : null;
  const derived = scale.pxPerM ? edgePx / scale.pxPerM : null;

  return (
    <div className="editor" ref={wrapRef}>
      <div className="etools">
        {['draw', 'select', 'pan', 'bar'].map((t) => (
          <button key={t} className={`btn sm${tool === t ? ' on' : ''}`} onClick={() => setTool(t)}>
            {t === 'bar' ? 'Scale bar' : t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <button className="btn sm" onClick={() => zoomAt({ x: size().w / 2, y: size().h / 2 }, 1.3)}>+</button>
        <button className="btn sm" onClick={() => zoomAt({ x: size().w / 2, y: size().h / 2 }, 1 / 1.3)}>−</button>
        <button className="btn sm" onClick={() => { fit(); redraw(); }}>Fit</button>
        <button className="btn sm danger" onClick={deleteSelected} disabled={selId === null}>Delete</button>
      </div>
      <canvas
        ref={canvasRef}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        onWheel={(e) => { e.preventDefault(); zoomAt(evPt(e), e.deltaY < 0 ? 1.12 : 1 / 1.12); }}
      />
      <div className="estatus">
        {!state.image ? 'No plan uploaded yet.'
          : !scale.pxPerM
            ? <><b>{room.shapes.length}</b> shape(s). No scale yet — switch to Select, tap an edge you can read off the plan, and type it. Everything else follows.</>
            : <><b>{room.shapes.length}</b> shape(s) · <b>{room.shapes.length ? '' : ''}</b>{tool === 'draw' ? 'drag on the plan to add a shape' : 'tap a shape to select, tap its edge to pin a length'}</>}
      </div>
      {edgeBox && s && (
        <div className="edge-input" style={{ display: 'block', left: Math.min(Math.max(6, edgeBox.x - 95), size().w - 196), top: Math.min(Math.max(6, edgeBox.y + 14), size().h - 96) }}>
          <div className="lbl">
            <b style={{ color: 'var(--blue)' }}>{edgeBox.edge} edge</b> — {Math.round(edgePx)} px<br />
            {pin ? `pinned at ${pin.metres} m` : derived !== null ? `derives to ${derived.toFixed(3)} m` : 'no scale yet — type this edge to set one'}
          </div>
          <div className="row">
            <input
              type="number" step="0.001" autoFocus
              defaultValue={pin ? pin.metres : derived !== null ? derived.toFixed(3) : ''}
              onKeyDown={(e) => { if (e.key === 'Enter') commitEdge(e.currentTarget.value); }}
              id="edge-value"
            />
            <button className="btn sm" onClick={() => commitEdge(document.getElementById('edge-value').value)}>Set</button>
            <button className="btn sm" onClick={() => { dispatch({ type: 'clearPin', roomId: room.id, shapeId: s.id, edge: edgeBox.edge }); setEdgeBox(null); }}>Clear</button>
          </div>
        </div>
      )}
    </div>
  );
}
