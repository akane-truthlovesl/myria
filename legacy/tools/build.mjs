// Build a single self-contained HTML file: dist/myria.html (opens from file://, no server needed)
import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.join(root, 'dist');
fs.mkdirSync(out, { recursive: true });
const r = await esbuild.build({
  entryPoints: [path.join(root, 'src/main.js')], bundle: true, format: 'iife', minify: true, write: false,
  target: ['es2020'], legalComments: 'none', logLevel: 'warning',
});
const js = r.outputFiles[0].text;
const css = fs.readFileSync(path.join(root, 'src/ui/style.css'), 'utf8');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace(/<link rel="stylesheet"[^>]*>/, `<style>${css}</style>`);
html = html.replace(/<script type="module" src="[^"]*"><\/script>/, () => `<script>${js.replace(/<\/script/g, '<\\/script')}</script>`);
fs.writeFileSync(path.join(out, 'myria.html'), html);
console.log(`dist/myria.html  ${(html.length / 1024).toFixed(0)} KB`);
