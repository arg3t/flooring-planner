# Plank Planner

Trace rooms on a floor-plan image, pin one known length, and get a numbered
laying order plus a cut sheet that pairs offcuts onto stock planks.

    npm install
    npm run dev      # development server
    npm run build    # -> dist/index.html, one self-contained file
    npm test         # engine unit tests, no browser needed

## Layout

    src/core/        pure geometry, scale, layout and packing — no React, no DOM
      geometry.js      room outline, row bands, spans, connectivity
      layout.js        row planning, the cutting-stock packer, the whole-job plan
      scale.js         pixels-per-metre from pinned lengths
      snapping.js      snap candidates and the weld pass
      project.js       serialise / validate / restore a project document
      derive.js        traced pixels -> metric rectangles
    src/report/      the printed manual, built as its own document
    src/state/       one reducer holding the whole project
    src/components/  UI
    tests/           node:test suites over src/core and src/report

`src/core` is deliberately free of React and DOM so the engine can be tested
directly with `node --test`, which is where most of the risk lives.

