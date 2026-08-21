/**
 * Print stylesheet. Written for paper, not derived from the screen: no colour,
 * no scrolling, no hover, and sheets cost money so density matters.
 */
export const PRINT_CSS = `
  @page{size:A4 portrait;margin:11mm 10mm 9mm;}
  *{box-sizing:border-box;}
  body{margin:0;font-family:-apple-system,"Helvetica Neue",Arial,sans-serif;color:#000;font-size:9pt;line-height:1.35;}
  h1{font-size:15pt;margin:0 0 1mm;letter-spacing:-.2px;}
  h2{font-size:11pt;margin:0;}
  h3{font-size:8pt;margin:0 0 1.5mm;text-transform:uppercase;letter-spacing:.6px;color:#444;}
  .page{page-break-after:always;break-after:page;}
  .page:last-child{page-break-after:auto;break-after:auto;}
  .hdr{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1.4pt solid #000;
       padding-bottom:1.5mm;margin-bottom:3mm;break-after:avoid;page-break-after:avoid;}
  .hdr .sub{font-size:8pt;color:#555;}

  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:2mm;margin-bottom:4mm;}
  .kpi{border:.8pt solid #000;padding:2mm;}
  .kpi .v{font-size:14pt;font-weight:700;line-height:1;}
  .kpi .l{font-size:6.8pt;text-transform:uppercase;letter-spacing:.5px;color:#555;margin-top:.8mm;}

  table.t{width:100%;border-collapse:collapse;font-size:8pt;}
  table.t th{text-align:left;border-bottom:.8pt solid #000;padding:1.2mm 1.5mm;font-size:7pt;
             text-transform:uppercase;letter-spacing:.4px;color:#444;}
  table.t td{padding:1.2mm 1.5mm;border-bottom:.4pt solid #bbb;}
  table.t td:nth-child(n+2){text-align:right;font-variant-numeric:tabular-nums;}
  table.t td:first-child{text-align:left;}

  .two{display:grid;grid-template-columns:1fr 1fr;gap:5mm;margin-top:4mm;}
  .spec{font-size:7.6pt;}
  .spec div{display:flex;justify-content:space-between;border-bottom:.4pt dotted #bbb;padding:.7mm 0;}
  ol.method{margin:0;padding-left:4.5mm;font-size:7.8pt;}
  ol.method li{margin-bottom:1.2mm;}

  .key{font-size:7.4pt;margin-top:3mm;border-top:.8pt solid #000;padding-top:1.5mm;}
  .key span{display:inline-block;margin-right:4mm;}
  .sw{display:inline-block;vertical-align:-1.5pt;margin-right:1.2mm;width:11pt;height:11pt;}
  .keyplan{margin-top:4mm;border-top:.8pt solid #000;padding-top:2mm;break-inside:avoid;}
  .keyplan svg{display:block;margin:1mm auto 0;max-width:100%;}

  /* rooms flow rather than claiming a sheet each, and never split across a fold */
  .rooms-block{margin-bottom:6mm;}
  section.room{break-inside:avoid;page-break-inside:avoid;margin-bottom:6mm;padding-bottom:4mm;border-bottom:.5pt solid #ccc;}
  section.room:last-child{border-bottom:none;margin-bottom:0;}
  .rh{border-bottom:.6pt solid #000;padding-bottom:1mm;margin-bottom:2mm;}
  .rmeta{font-size:7.4pt;color:#555;margin-top:.6mm;}
  .rbody{display:grid;grid-template-columns:auto 1fr;gap:4mm;align-items:start;}
  .rbody.stack{display:block;}
  .rbody.stack .ord{margin-top:2.5mm;}
  .dia svg{display:block;}
  .ord{min-width:0;}
  .lay{column-gap:3.5mm;column-rule:.4pt solid #ddd;font-size:7.2pt;}
  .lr{break-inside:avoid;padding:.45mm 0;border-bottom:.3pt dotted #ccc;}
  .rn{display:inline-block;min-width:4.5mm;color:#666;font-variant-numeric:tabular-nums;}
  .lr b{font-family:monospace;font-weight:700;}
  .fp{color:#666;}
  .rip{border:.5pt solid #000;padding:0 .8mm;font-size:6.4pt;white-space:nowrap;}
  .seg{color:#666;font-size:6.4pt;}

  /* the cut sheet is a separate work phase — it goes to the saw while the room
     sheets go to the floor — so it starts its own page */
  .cuts-block{break-before:page;page-break-before:always;}
  .cuts{column-count:3;column-gap:4mm;font-size:7.2pt;}
  .ck{break-inside:avoid;border:.5pt solid #000;margin-bottom:1.1mm;padding:.6mm 1mm;}
  .ckh{display:flex;justify-content:space-between;font-weight:700;font-family:monospace;
       border-bottom:.4pt solid #000;padding-bottom:.3mm;margin-bottom:.4mm;font-size:7.2pt;}
  .ckh span{font-weight:400;color:#555;font-size:6.6pt;}
  .cp{display:flex;justify-content:space-between;font-family:monospace;}
  .cp .dst{color:#666;}
`;
