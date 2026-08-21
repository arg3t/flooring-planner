import React from 'react';
import { useProject } from '../state/store.jsx';
import { roomOutline, toRunStack } from '../core/geometry.js';
import { islands } from '../core/geometry.js';
import Tooltip from './Tooltip.jsx';

/** Screen diagram. Shares its geometry with the printed one but keeps colour,
 *  which is free on a screen and faster to read. */
function RoomDiagram({ layout, room }) {
  const sc = Math.min(570 / layout.runMax, 290 / layout.stackMax, 0.3);
  const w = layout.runMax * sc, h = layout.stackMax * sc, pl = 46, pt = 46;
  const parts = [];
  parts.push(<rect key="wall" x={pl} y={pt} width={w} height={h} fill="none" stroke="var(--grid)" strokeDasharray="3 3" />);
  (room.sub || []).forEach((sq, i) => {
    const m = toRunStack(room, sq);
    parts.push(<rect key={`v${i}`} x={pl + m.r0 * sc} y={pt + m.t0 * sc} width={(m.r1 - m.r0) * sc} height={(m.t1 - m.t0) * sc}
      fill="var(--violet)" fillOpacity=".14" stroke="var(--violet)" strokeDasharray="3 2" />);
  });
  layout.rows.forEach((row, ri) => row.pieces.forEach((p, pi) => {
    const fill = p.full ? (pi % 2 ? 'var(--oak2)' : 'var(--oak)') : 'var(--amber)';
    const pw = p.len * sc, ph = row.width * sc;
    parts.push(<rect key={`p${ri}-${pi}`} x={pl + p.x * sc} y={pt + row.s0 * sc}
      width={Math.max(pw - 1, 0)} height={Math.max(ph - 1, 0)} fill={fill}
      fillOpacity={row.ripped ? 0.55 : 0.9} stroke="#0E2235" strokeWidth="1" />);
    if (!p.full && p.pieceId && pw > 30 && ph > 11) {
      parts.push(<text key={`t${ri}-${pi}`} x={pl + p.x * sc + pw / 2} y={pt + row.s0 * sc + ph / 2 + 3}
        fontSize="8.5" fontFamily="IBM Plex Mono" fill="#241207" textAnchor="middle">{p.pieceId}</text>);
    }
  }));
  const map = (x, y) => (room.dir === 'x' ? [x * 1000, y * 1000] : [y * 1000, x * 1000]);
  const placed = [];
  roomOutline(room).slice().sort((a, b) => b.len - a.len).forEach((sg, i) => {
    if (sg.len < 0.3) return;
    const a = sg.vertical ? map(sg.x, sg.y1) : map(sg.x1, sg.y);
    const b = sg.vertical ? map(sg.x, sg.y2) : map(sg.x2, sg.y);
    const onH = Math.abs(a[1] - b[1]) < 0.001;
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    let nx = 0, ny = 0;
    if (sg.vertical) { if (room.dir === 'x') nx = sg.out; else ny = sg.out; }
    else if (room.dir === 'x') ny = sg.out; else nx = sg.out;
    let off = 12, tx, ty, tries = 0, clash;
    do {
      tx = pl + mx * sc + nx * off;
      ty = pt + my * sc + ny * off + (onH ? (ny > 0 ? 7 : -3) : 3);
      clash = placed.some((q) => Math.abs(q.x - tx) < 22 && Math.abs(q.y - ty) < 11);
      if (clash) off += 13;
      tries++;
    } while (clash && tries < 4);
    placed.push({ x: tx, y: ty });
    parts.push(<line key={`l${i}`} x1={pl + a[0] * sc} y1={pt + a[1] * sc} x2={pl + b[0] * sc} y2={pt + b[1] * sc}
      stroke="var(--blue)" strokeWidth="1.4" strokeOpacity=".8" />);
    parts.push(<text key={`d${i}`} x={tx} y={ty} fontSize="8" fontFamily="IBM Plex Mono" fill="var(--blue)" textAnchor="middle"
      transform={onH ? undefined : `rotate(-90 ${tx} ${ty})`}>{(sg.len * 1000).toFixed(0)}</text>);
  });
  return <svg width={w + pl + 40} height={h + pt + 40} style={{ display: 'block', minWidth: w + pl + 40 }}>{parts}</svg>;
}

export default function Results() {
  const { plan, state } = useProject();
  if (plan.empty) return null;
  const { layouts, bins, full, area, totalPlanks, packs, cuts, overPct, costIncVat, allCuts, material } = plan;
  const broken = layouts.map((l) => l.room).filter((r) => islands(r).length > 1);

  return (
    <>
      <section className="panel">
        <h2><span className="n">04</span> Totals</h2>
        <div className="summary-grid">
          {[[`${area.toFixed(1)} m²`, 'Floor to cover'], [totalPlanks, 'Planks total'], [full, 'Used whole'],
            [bins.length, 'Planks to cut'], [cuts, 'Saw cuts'], [packs, `Packs @ ${material.packArea} m²`],
            [`${overPct}%`, 'Over floor area'], [material.packPrice ? `€${costIncVat}` : '—', 'Total inc. VAT']].map(([v, l]) => (
            <div className="stat" key={l}><div className="v">{v}</div><div className="l">{l}</div></div>
          ))}
        </div>
        <div className="note-box">
          {bins.filter((b) => b.pieces.length > 1).length} of {bins.length} cut planks yield two or more usable pieces.
          Without that pairing you would need {full + allCuts.length} planks instead of {totalPlanks}.
        </div>
        {broken.length > 0 && (
          <div className="warn-box">
            {broken.map((r) => r.name).join(', ')} {broken.length > 1 ? 'are' : 'is'} traced as disconnected pieces.
            Each piece is planned separately, which is almost certainly not what you want.
          </div>
        )}
      </section>

      {layouts.map(({ room, layout }) => (
        <div className="room-out" key={room.id}>
          <div className="room-out-head">
            <h3>{room.name} <span className="code">{room.code}</span></h3>
            <div className="tag">
              {layout.area.toFixed(2)} m² · {room.add.length > 1 ? `${room.add.length} rectangles` : 'rectangular'} ·
              {' '}{layout.rows.length} rows · planks run {room.dir === 'x' ? 'horizontally' : 'vertically'}
            </div>
          </div>
          <div className="diagram-wrap"><RoomDiagram layout={layout} room={room} /></div>
          <div className="legend">
            <span><i style={{ background: 'var(--oak)' }} />full plank</span>
            <span><i style={{ background: 'var(--amber)' }} />cut piece, labelled</span>
          </div>
          <div className="cutlist">
            <table className="cl">
              <thead><tr><th>Row</th><th>Row width</th><th>Lay in this order, left → right</th></tr></thead>
              <tbody>
                {layout.rows.map((r, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>{Math.round(r.width)}mm{r.ripped && <><br /><span className="bad small">rip narrower</span></>}
                      {r.segs > 1 && <span className="seg-label"> · {r.segs} runs</span>}</td>
                    <td>{r.pieces.map((p, j) => p.full
                      ? <span className="pill full" key={j}>full plank</span>
                      : <span className="pill cut" key={j}><span className="id">{p.pieceId}</span> {p.len}mm</span>)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <section className="panel">
        <h2><span className="n">05</span> Cut sheet
          <Tooltip>One card per plank you cut. Write the piece ID on each piece as it leaves the saw — the room diagrams call for pieces by these IDs.</Tooltip>
        </h2>
        {bins.map((b) => (
          <div className="cut-card" key={b.label}>
            <div className="h"><b>{b.label}</b><span>{b.cuts} saw cut{b.cuts > 1 ? 's' : ''} · {b.waste > 2 ? `${b.waste}mm scrap` : 'no scrap'}</span></div>
            <div className="plank-strip">
              {b.pieces.map((p, i) => (
                <div key={p.pieceId} style={{ width: `${(p.len / material.plankLen) * 100}%`, background: i % 2 ? 'var(--oak2)' : 'var(--oak)' }}>
                  {p.pieceId.split('·')[1]} · {p.len}
                </div>
              ))}
              {b.waste > 2 && <div className="w" style={{ width: `${(b.waste / material.plankLen) * 100}%` }}>{b.waste}</div>}
            </div>
            <div className="dest">{b.pieces.map((p) => <div key={p.pieceId}>{p.pieceId} → {p.room} · row {p.row}, position {p.pos}</div>)}</div>
          </div>
        ))}
      </section>
    </>
  );
}
