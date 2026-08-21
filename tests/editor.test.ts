/**
 * Pointer-level tests for the tracing canvas, driven against the built bundle.
 *
 * These exist because the canvas is the one part of the app with no declarative
 * output to assert on — a broken drag looks identical to a working one from the
 * outside until you actually push pointer events through it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM, type DOMWindow } from 'jsdom';

const HTML = fs.readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');

function ctxStub(): unknown {
  return new Proxy({}, {
    get: (_t, k) => (k === 'canvas' ? { width: 0, height: 0 } : k === 'measureText' ? () => ({ width: 10 }) : () => {}),
    set: () => true,
  });
}

async function boot(): Promise<JSDOM> {
  const store: Record<string, string> = {};
  const dom = new JSDOM(HTML, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://local/',
    beforeParse(w) {
      w.HTMLCanvasElement.prototype.getContext = (() => ctxStub()) as HTMLCanvasElement['getContext'];
      w.HTMLElement.prototype.setPointerCapture = () => {};
      Object.defineProperty(w.HTMLElement.prototype, 'clientWidth', { get() { return 600; }, configurable: true });
      Object.defineProperty(w, 'localStorage', {
        value: { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; }, removeItem: (k: string) => { delete store[k]; } },
        configurable: true,
      });
      w.confirm = () => true;
      w.prompt = () => '5';
    },
  });
  await new Promise((r) => setTimeout(r, 350));
  return dom;
}

/** Attach an image and pin the view so client coords equal image coords. */
async function useImage(w: DOMWindow, img: HTMLImageElement): Promise<void> {
  w.__plankPlanner!.setImage(img);
  await new Promise((r) => setTimeout(r, 80));
  const roomId = w.__plankPlanner!.getState().rooms[0].id;
  w.__plankPlannerEditors!.get(roomId)!.setView({ s: 1, tx: 0, ty: 0 });
}

const rooms = (w: DOMWindow) => w.__plankPlanner!.getState().rooms;

async function readyCanvas() {
  const dom = await boot();
  const w = dom.window;
  const d = w.document;
  // an image is required before the editor accepts any drawing
  const img = new w.Image();
  Object.defineProperty(img, 'width', { value: 1000 });
  Object.defineProperty(img, 'height', { value: 800 });
  const canvas = d.querySelector('.editor canvas') as HTMLCanvasElement;
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 600, height: 400 }) as DOMRect;
  return { dom, w, d, canvas, img };
}

function pointer(w: DOMWindow, canvas: HTMLCanvasElement, type: string, x: number, y: number): void {
  const ev = new w.Event(type, { bubbles: true });
  Object.assign(ev, { pointerId: 1, clientX: x, clientY: y, button: 0 });
  canvas.dispatchEvent(ev);
}

async function drag(w: DOMWindow, canvas: HTMLCanvasElement, from: [number, number], to: [number, number]): Promise<void> {
  pointer(w, canvas, 'pointerdown', from[0], from[1]);
  await new Promise((r) => setTimeout(r, 20));
  pointer(w, canvas, 'pointermove', to[0], to[1]);
  await new Promise((r) => setTimeout(r, 20));
  pointer(w, canvas, 'pointerup', to[0], to[1]);
  await new Promise((r) => setTimeout(r, 60));
}

test('dragging in Draw mode creates a shape of the dragged size', async () => {
  const { w, canvas, img } = await readyCanvas();
  await useImage(w, img);

  await drag(w, canvas, [100, 100], [340, 260]);

  const shapes = rooms(w)[0].shapes;
  assert.equal(shapes.length, 1, 'the drag should have produced exactly one shape');
  const s = shapes[0];
  assert.ok(Math.abs(s.w - 240) < 2, `width ${s.w} should be ~240`);
  assert.ok(Math.abs(s.h - 160) < 2, `height ${s.h} should be ~160`);
  assert.ok(Math.abs(s.x - 100) < 2 && Math.abs(s.y - 100) < 2, 'origin should be the drag start');
});

test('a second shape snaps flush against the first, leaving no gap', async () => {
  const { w, canvas, img } = await readyCanvas();
  await useImage(w, img);

  await drag(w, canvas, [100, 100], [300, 260]);
  // start 4px past the first shape's right edge — inside the snap tolerance
  await drag(w, canvas, [304, 100], [420, 260]);

  const shapes = rooms(w)[0].shapes;
  assert.equal(shapes.length, 2);
  const [a, b] = shapes;
  assert.equal(b.x, a.x + a.w, 'the two shapes must abut exactly');
});

test('a stray click does not leave a speck behind', async () => {
  const { w, canvas, img } = await readyCanvas();
  await useImage(w, img);

  await drag(w, canvas, [200, 200], [202, 202]);
  assert.equal(rooms(w)[0].shapes.length, 0, 'a sub-threshold drag should be discarded');
});

test('drawing needs a plan image first', async () => {
  const { w, canvas } = await readyCanvas();
  await drag(w, canvas, [100, 100], [300, 260]);
  assert.equal(rooms(w)[0].shapes.length, 0);
});
