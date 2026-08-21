/**
 * Smoke tests against the built single-file bundle: the thing that actually
 * ships. Everything below drives real DOM events, so a wiring mistake between
 * the components shows up here even though the core suites pass.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const HTML = fs.readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');

function makeStorage(cap = 5e6) {
  const m = {};
  return {
    getItem: (k) => (k in m ? m[k] : null),
    setItem: (k, v) => { if (v.length > cap) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; } m[k] = v; },
    removeItem: (k) => { delete m[k]; },
  };
}

function ctxStub() {
  return new Proxy({}, {
    get: (t, k) => (k === 'canvas' ? { width: 0, height: 0 } : k === 'measureText' ? () => ({ width: 10 }) : () => {}),
    set: () => true,
  });
}

async function boot(storage = makeStorage()) {
  const dom = new JSDOM(HTML, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://local/',
    beforeParse(w) {
      w.HTMLCanvasElement.prototype.getContext = () => ctxStub();
      w.HTMLElement.prototype.setPointerCapture = () => {};
      Object.defineProperty(w.HTMLElement.prototype, 'clientWidth', { get() { return 600; }, configurable: true });
      Object.defineProperty(w, 'localStorage', { value: storage, configurable: true });
      w.confirm = () => true;
      w.prompt = () => '5';
      w.URL.createObjectURL = () => 'blob:x';
      w.URL.revokeObjectURL = () => {};
    },
  });
  await new Promise((r) => setTimeout(r, 350));
  return dom;
}

test('app mounts with panels in the right order', async () => {
  const dom = await boot();
  const d = dom.window.document;
  const headings = [...d.querySelectorAll('.panel h2')].map((h) => h.textContent.replace(/\?.*/, '').trim());
  assert.equal(headings[0], '01 Floor plan');
  assert.equal(headings[1], '02 Material', 'material must sit above the rooms list');
  assert.equal(headings[2], '03 Rooms');
});

test('starts empty: no plan, one blank room, no scale', async () => {
  const dom = await boot();
  const d = dom.window.document;
  assert.equal(d.querySelectorAll('.room-card').length, 1);
  assert.match(d.querySelector('.dropzone').textContent, /upload a floor plan/i);
  assert.match(d.querySelector('.scalestate').textContent, /No scale yet/);
  assert.match(d.body.textContent, /Nothing to lay yet/);
});

test('no seeded apartment geometry ships in the bundle', () => {
  assert.doesNotMatch(HTML, /Perronlaan/);
  assert.doesNotMatch(HTML, /Cartesius/);
});

test('help modal opens and closes', async () => {
  const dom = await boot();
  const d = dom.window.document;
  const btn = [...d.querySelectorAll('button')].find((b) => /How to use/.test(b.textContent));
  assert.ok(btn);
  btn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 40));
  assert.ok(d.querySelector('.modal'), 'modal should be open');
  [...d.querySelectorAll('.modal button')].pop().dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(d.querySelector('.modal'), null);
});

test('tooltips carry the explanations instead of body text', async () => {
  const dom = await boot();
  const tips = dom.window.document.querySelectorAll('.ti .tip');
  assert.ok(tips.length >= 2, `expected tooltips, got ${tips.length}`);
});

test('material inputs are wired to the reducer', async () => {
  const dom = await boot();
  const d = dom.window.document;
  const input = d.getElementById('mat-plankLen');
  assert.ok(input);
  assert.equal(input.value, '1220');
});

test('adding a room adds a card and an editor', async () => {
  const dom = await boot();
  const d = dom.window.document;
  const add = [...d.querySelectorAll('button')].find((b) => /Add room/.test(b.textContent));
  add.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(d.querySelectorAll('.room-card').length, 2);
  assert.equal(d.querySelectorAll('.editor canvas').length, 2);
});

test('autosave writes and a reload restores', async () => {
  const storage = makeStorage();
  const dom = await boot(storage);
  const d = dom.window.document;
  const add = [...d.querySelectorAll('button')].find((b) => /Add room/.test(b.textContent));
  add.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 900));
  const raw = storage.getItem('plankPlanner.project.v1');
  assert.ok(raw, 'nothing was autosaved');
  assert.equal(JSON.parse(raw).rooms.length, 2);

  const again = await boot(storage);
  assert.equal(again.window.document.querySelectorAll('.room-card').length, 2, 'rooms did not come back');
  assert.match(again.window.document.querySelector('.top .sub').textContent, /restored/);
});

test('the only per-room layout choice is plank direction', async () => {
  const dom = await boot();
  const d = dom.window.document;
  const labels = [...d.querySelectorAll('.dir-toggle button')].map((b) => b.textContent);
  assert.deepEqual(labels, ['planks ↔ horizontal', 'planks ↕ vertical']);
  assert.equal(d.getElementById('mat-hbLen'), null, 'herringbone settings should be gone');
});

test('storage failure degrades instead of throwing', async () => {
  const dom = await boot(makeStorage(10)); // quota so small nothing fits
  const d = dom.window.document;
  const add = [...d.querySelectorAll('button')].find((b) => /Add room/.test(b.textContent));
  add.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 900));
  assert.match(d.querySelector('.top .sub').textContent, /unavailable/);
});
