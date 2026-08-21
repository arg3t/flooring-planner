# Tests

    npm test

Four suites; the last two need a build first:

- `core.test.ts` — geometry, row planning, cutting-stock packing, the scale
  solver, snapping and the project document. This is where the risk is: a wrong
  outline or an over-filled plank produces a wrong cut list, and none of it is
  visible by looking at the screen.
- `report.test.ts` — the printed manual. Asserts the document is greyscale only
  (nothing may depend on hue, since it gets photocopied), that ripped rows are
  dotted, and that every cut piece appears in both the lay order and the cut
  sheet.
- `editor.test.ts` — pushes real pointer events through the tracing canvas. The
  canvas has no declarative output, so a broken drag looks exactly like a working
  one from the outside; this is the only suite that would have caught the draft
  shape being discarded mid-drag.
- `spa.test.ts` — drives the *built* `dist/index.html` under jsdom with real DOM
  events. Requires `npm run build` first; `npm run test:core` skips it. This suite is what catches wiring mistakes
  between components, and it caught the bug where an ES-module script tag meant
  the file would not run from `file://` at all.
