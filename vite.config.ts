import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The deliverable is one self-contained HTML file that has to open straight from
 * a phone's downloads folder — no server, no network.
 *
 * That rules out an ES-module script tag: browsers apply CORS to module scripts
 * even over file://, so `<script type="module">` refuses to run from disk. The
 * bundle is emitted as an IIFE and the module attribute stripped, which is also
 * why `inlineDynamicImports` is on — a code-split chunk could not be inlined.
 */
function classicScript(outFile: string): Plugin {
  return {
    name: 'classic-script',
    // Runs on the written file, after every other plugin. The only edit is the
    // script type: nothing rewrites the bundle body, because it contains string
    // literals that look like markup and any regex over it eventually corrupts it.
    closeBundle() {
      const path = resolve(outFile);
      const html = readFileSync(path, 'utf8');
      writeFileSync(path, html.replace(/<script([^>]*)\stype="module"([^>]*)>/g, '<script$1$2>'));
    },
  };
}

export default defineConfig({
  // Relative, so the same file works from a Pages project subpath
  // (user.github.io/repo/) and from disk. Nothing is fetched at runtime anyway,
  // but an absolute base would still break the odd inline reference.
  base: './',
  plugins: [react(), viteSingleFile(), classicScript('dist/index.html')],
  build: {
    target: 'es2019',
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    reportCompressedSize: false,
    rollupOptions: {
      output: { format: 'iife', inlineDynamicImports: true, entryFileNames: 'app.js' },
    },
  },
});
