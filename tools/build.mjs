// Build the single self-contained page: ./index.html (opens straight from disk — no server, no install).
// Development page: dev.html (ES modules; needs to be served).
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const r = await esbuild.build({ entryPoints: [path.join(root, 'src/main.js')], bundle: true, format: 'iife', minify: true, write: false, target: ['es2020'], legalComments: 'none', logLevel: 'warning' });
const js = r.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
const css = fs.readFileSync(path.join(root, 'src/ui/style.css'), 'utf8');
const icon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cdefs%3E%3CradialGradient id='g' cx='.45' cy='.42' r='.6'%3E%3Cstop offset='0' stop-color='%23fff3e2'/%3E%3Cstop offset='.5' stop-color='%23ff9a74'/%3E%3Cstop offset='1' stop-color='%23b8432f'/%3E%3C/radialGradient%3E%3C/defs%3E%3Crect width='64' height='64' rx='14' fill='%2302070b'/%3E%3Cg stroke='%23ff9a74' stroke-width='3' stroke-linecap='round'%3E%3Cpath d='M32 8v10M32 46v10M8 32h10M46 32h10M15 15l7 7M42 42l7 7M49 15l-7 7M22 42l-7 7'/%3E%3C/g%3E%3Ccircle cx='32' cy='32' r='13' fill='url(%23g)'/%3E%3C/svg%3E";
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="#02070b">
<title>MYRIA</title>
<link rel="icon" href="${icon}">
<style>${css}</style>
</head>
<body>
<canvas id="c"></canvas>
<div id="ui"></div>
<script>${js}</script>
</body>
</html>
`;
fs.writeFileSync(path.join(root, 'index.html'), html);
console.log(`index.html  ${(html.length / 1024).toFixed(0)} KB`);
