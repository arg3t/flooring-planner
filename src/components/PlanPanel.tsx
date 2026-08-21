import { useRef } from 'react';
import { useProject, serialise, clearLocal } from '../state/store';
import { validate, deserialise } from '../core/project';
import Tooltip from './Tooltip';

/** Upload, a preview of the plan, the scale readout, and project file I/O. */
export default function PlanPanel() {
  const { state, dispatch, scale } = useProject();
  const fileRef = useRef<HTMLInputElement>(null);
  const projRef = useRef<HTMLInputElement>(null);

  const loadImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      const dataUrl = reader.result as string;
      img.onload = () => dispatch({ type: 'setImage', image: img, dataUrl, name: file.name });
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const saveFile = () => {
    const doc = serialise(state);
    const blob = new Blob([JSON.stringify(doc, null, 1)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'plank-planner-project.json';
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1500);
    dispatch({ type: 'note', note: { kind: 'ok', text: `Saved ${doc.rooms.length} room(s)${doc.image ? ' and the plan image' : ''}.` } });
  };

  const loadFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      let doc: unknown;
      try { doc = JSON.parse(reader.result as string); }
      catch { dispatch({ type: 'note', note: { kind: 'bad', text: 'That file is not valid JSON.' } }); return; }
      const problems = validate(doc);
      if (problems.length) {
        dispatch({ type: 'note', note: { kind: 'bad', text: `Cannot load this file: ${problems.join('; ')}` } });
        return;
      }
      const data = deserialise(doc);
      dispatch({ type: 'loadProject', data, note: { kind: 'ok', text: `Loaded ${data.rooms.length} room(s).` } });
      if (data.imageData) {
        const imageData = data.imageData;
        const img = new Image();
        img.onload = () => dispatch({ type: 'setImage', image: img, dataUrl: imageData, name: data.imageName || 'plan' });
        img.src = imageData;
      }
    };
    reader.readAsText(file);
  };

  const reset = () => {
    if (!window.confirm('Delete the plan, all rooms and all pinned lengths? This cannot be undone.')) return;
    clearLocal();
    dispatch({ type: 'reset' });
  };

  return (
    <section className="panel">
      <h2><span className="n">01</span> Floor plan
        <Tooltip>Upload the plan drawing, then trace each room on top of it. Shapes are stored as pixels; the metres come from the scale.</Tooltip>
      </h2>

      {state.image ? (
        <div className="plan-preview">
          <img src={state.imageData ?? undefined} alt="Uploaded floor plan" />
          <div className="plan-meta">
            <span>{state.imageName}</span>
            <span className="dim">{state.image.width} × {state.image.height} px</span>
            <button className="btn sm" onClick={() => fileRef.current?.click()}>Replace</button>
          </div>
        </div>
      ) : (
        <div
          className="dropzone"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files[0]) loadImage(e.dataTransfer.files[0]); }}
        >
          Tap to upload a floor plan image
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" hidden
        onChange={(e) => { if (e.target.files?.[0]) loadImage(e.target.files[0]); e.target.value = ''; }} />

      <div className={`scalestate ${scale.pxPerM ? 'ok' : 'none'}`}>
        {scale.pxPerM
          ? <>Scale <b>{scale.pxPerM.toFixed(1)} px/m</b> from {scale.observations.length} known length{scale.observations.length > 1 ? 's' : ''}
              {scale.observations.length > 1 && ` · worst disagreement ${(scale.residual as number).toFixed(1)}%`}</>
          : 'No scale yet — tap one edge and type its real length.'}
      </div>

      {scale.pxPerM && (
        <div className="pinlist">
          {scale.observations.map((o, i) => {
            const errPct = o.errPct as number;
            const cls = Math.abs(errPct) < 0.8 ? 'good' : Math.abs(errPct) < 2.5 ? 'warn' : 'bad';
            const room = o.pin && state.rooms.find((r) => r.id === o.pin?.roomId);
            return (
              <div className="pinrow" key={o.pin ? o.pin.id : `bar-${i}`}>
                <span>{o.label || `${room ? room.name : '?'} · ${o.pin?.edge}`}</span>
                <span>{o.m} m <span className={`resid ${cls}`}>{errPct >= 0 ? '+' : ''}{errPct.toFixed(1)}%</span>
                  {o.pin && <button className="x-btn tiny" onClick={() => dispatch({ type: 'dropPin', id: o.pin!.id })}>✕</button>}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="btnrow" style={{ marginTop: 10 }}>
        <button className="btn sm" onClick={saveFile}>Save file</button>
        <button className="btn sm" onClick={() => projRef.current?.click()}>Load file</button>
        <button className="btn sm danger" onClick={reset}>Reset</button>
        <input ref={projRef} type="file" accept="application/json,.json" hidden
          onChange={(e) => { if (e.target.files?.[0]) loadFile(e.target.files[0]); e.target.value = ''; }} />
      </div>

      {state.ioNote && <div className={state.ioNote.kind === 'bad' ? 'warn-box' : 'note-box'}>{state.ioNote.text}</div>}
    </section>
  );
}
