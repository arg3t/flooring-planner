/**
 * The printed manual.
 *
 * Its own document, not a restyled screen. Three phases matching how the work
 * actually happens: a job sheet with what to buy and a key plan, room sheets for
 * the floor, and a cut sheet for the saw.
 */
import { computePlan } from '../core/layout.js';
import { roomOutline } from '../core/geometry.js';
import { printSvg, swatch } from './printSvg.js';
import { keyPlan } from './keyPlan.js';
import { PRINT_CSS } from './styles.js';

const CONTENT_PX = 718; // A4 content width at 96dpi, ~190mm

export function buildReport(rooms, material, pxPerM) {
  const plan = computePlan(rooms, material);
  if (plan.empty) return null;
  const { layouts, bins, full, area, totalPlanks, packs, cuts, overPct, costIncVat, costExVat, allCuts } = plan;
  const m = plan.material;
  const date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const roomIndex = layouts.map(({ room, layout }) => {
    const planks = layout.rows.reduce((a, r) => a + r.pieces.length, 0);
    const cut = layout.rows.reduce((a, r) => a + r.pieces.filter((p) => !p.full).length, 0);
    return `<tr><td><b>${room.code}</b> ${room.name}</td><td>${layout.area.toFixed(2)}</td>
      <td>${layout.rows.length}</td><td>${planks}</td><td>${cut}</td>
      <td>${room.dir === 'x' ? 'horizontal' : 'vertical'}</td></tr>`;
  }).join('');

  const roomPages = layouts.map(({ room, layout }) => {
    const edges = roomOutline(room).filter((s) => s.len >= 0.3).length;
    const diagram = printSvg(layout, room);
    const beside = CONTENT_PX - diagram.width - 16;
    // if the diagram leaves too little beside it, the order list goes underneath
    // at full width rather than into a column that wraps every line
    const stacked = beside < 210;
    const columns = stacked ? 4 : beside > 340 ? 2 : 1;
    return `<section class="room">
      <div class="rh"><h2 style="font-size:10pt">${room.code} · ${room.name}</h2>
        <div class="rmeta">${layout.area.toFixed(2)} m² &middot; ${layout.rows.length} rows &middot; ${edges} edges &middot;
          planks run ${room.dir === 'x' ? 'horizontally' : 'vertically'} &middot; start bottom-left of row 1</div></div>
      <div class="rbody ${stacked ? 'stack' : ''}">
        <div class="dia">${diagram.svg}</div>
        <div class="ord"><h3>Lay order</h3>${layOrder(layout, columns)}</div>
      </div>
    </section>`;
  }).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Flooring manual</title>
<style>${PRINT_CSS}</style></head><body>

<section class="page">
  <div class="hdr"><div><h1>Flooring manual</h1>
    <div class="sub">${layouts.length} rooms · ${area.toFixed(2)} m² · generated ${date}</div></div>
    <div class="sub">sheet 1 — job sheet</div></div>

  <div class="kpis">
    <div class="kpi"><div class="v">${packs}</div><div class="l">packs to buy</div></div>
    <div class="kpi"><div class="v">${totalPlanks}</div><div class="l">planks used</div></div>
    <div class="kpi"><div class="v">${cuts}</div><div class="l">saw cuts</div></div>
    <div class="kpi"><div class="v">${m.packPrice ? '€' + costIncVat : '—'}</div><div class="l">cost inc. VAT</div></div>
  </div>

  <table class="t"><thead><tr><th>Room</th><th>m²</th><th>Rows</th><th>Planks</th><th>Cut</th><th>Direction</th></tr></thead>
    <tbody>${roomIndex}
      <tr style="font-weight:700"><td>Total</td><td>${area.toFixed(2)}</td><td></td><td>${totalPlanks}</td><td>${allCuts.length}</td><td></td></tr>
    </tbody></table>

  <div class="two">
    <div><h3>Specification</h3><div class="spec">
      <div><span>Plank</span><span>${m.plankLen}×${m.plankWid} mm</span></div>
      <div><span>Pack</span><span>${m.packArea} m²${m.packPrice ? ` · €${(+m.packPrice).toFixed(2)} ex VAT` : ''}</span></div>
      <div><span>Buy</span><span>${packs} packs = ${(packs * m.packArea).toFixed(2)} m²</span></div>
      <div><span>Floor area</span><span>${area.toFixed(2)} m²</span></div>
      <div><span>Overage</span><span>${overPct}%</span></div>
      <div><span>Expansion gap</span><span>${m.gap} mm all walls</span></div>
      <div><span>Saw kerf</span><span>${m.kerf} mm</span></div>
      <div><span>Shortest piece</span><span>${m.minPiece} mm</span></div>
      <div><span>Seam stagger</span><span>≥ ${m.minStagger} mm</span></div>
      <div><span>Planks cut / whole</span><span>${bins.length} / ${full}</span></div>
      ${m.packPrice ? `<div><span>Cost ex VAT</span><span>€${costExVat}</span></div>` : ''}
    </div></div>
    <div><h3>Before you start</h3>
      <ol class="method">
        <li>Let the planks sit in the room 48 h before laying.</li>
        <li>Check the subfloor is clean, dry and level.</li>
        <li>Work the cut sheet first: cut every plank, write its ID on the back in pencil.</li>
        <li>Lay room by room in the order of the sheets that follow.</li>
        <li>Keep the ${m.gap} mm gap at every wall — spacers stay in until the room is finished.</li>
        <li>Rows run left to right; row 1 is at the top of each diagram.</li>
      </ol>
    </div>
  </div>

  <div class="key"><b>Diagram key</b>
    <span>${swatch('full')}full plank, uncut</span>
    <span>${swatch('cut')}cut piece — ID printed on it</span>
    <span>${swatch('rip')}row ripped narrower</span>
    <span>${swatch('void')}no floor</span>
    <span><b>P07·b</b> = second piece cut from plank 7; diagrams shorten it to 07b</span>
  </div>

  ${keyPlan(layouts, pxPerM)}
</section>

<section class="rooms-block">
  <div class="hdr"><div><h2>Laying order</h2>
    <div class="sub">one block per room · rows run left to right · row 1 at the top of each diagram</div></div>
    <div class="sub">sheet 2 — rooms</div></div>
  ${roomPages}
</section>

<section class="cuts-block">
  <div class="hdr"><div><h2>Cut sheet</h2>
    <div class="sub">${bins.length} planks to cut · ${cuts} saw cuts · ${full} more planks used whole, no cutting</div></div>
    <div class="sub">work this before laying</div></div>
  ${cutSheet(bins, m.plankLen)}
</section>

<script>window.onload=function(){setTimeout(function(){window.print();},300);}<\/script>
</body></html>`;
}

function layOrder(layout, columns) {
  const rows = layout.rows.map((r, i) => {
    const parts = r.pieces.map((p) => (p.full ? '<span class="fp">full</span>' : `<b>${p.pieceId}</b>`)).join(' ');
    const rip = r.ripped ? ` <span class="rip">rip ${Math.round(r.width)}</span>` : '';
    const seg = r.segs > 1 ? ` <span class="seg">${r.segs} runs</span>` : '';
    return `<div class="lr"><span class="rn">${i + 1}</span>${parts}${rip}${seg}</div>`;
  }).join('');
  return `<div class="lay" style="column-count:${columns}">${rows}</div>`;
}

/** A card per plank would run to eight pages; three dense columns fit on one. */
function cutSheet(bins) {
  return `<div class="cuts">${bins.map((b) => {
    const pieces = b.pieces.map((p) => `<div class="cp"><b>${p.pieceId.split('·')[1]}</b> ${p.len}<span class="dst">${p.room}·r${p.row}</span></div>`).join('');
    return `<div class="ck"><div class="ckh">${b.label}<span>${b.waste > 2 ? b.waste + ' scrap' : '0 scrap'}</span></div>${pieces}</div>`;
  }).join('')}</div>`;
}
