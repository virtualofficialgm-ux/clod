#!/usr/bin/env node
// Сборка в один HTML-файл (стили и скрипты встроены): dist/nulevoy-protokol.html
// --fragment — без <!doctype>/<head>/<body>, для публикации в среду, которая добавляет каркас сама.
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const fragment = process.argv.includes('--fragment');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace(/<link rel="stylesheet" href="(css\/[^"]+)">/g, (m, f) => '<style>\n' + fs.readFileSync(path.join(root, f), 'utf8') + '</style>');
html = html.replace(/<script src="(js\/[^"]+)"><\/script>/g, (m, f) => '<script>\n' + fs.readFileSync(path.join(root, f), 'utf8') + '</script>');
if (fragment) {
  html = html.replace(/<!doctype html>\s*<html[^>]*>\s*<head>/i, '').replace(/<meta[^>]*>\s*/g, '')
    .replace(/<\/head>\s*<body>/i, '').replace(/<\/body>\s*<\/html>\s*$/i, '');
}
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist', fragment ? 'nulevoy-protokol.fragment.html' : 'nulevoy-protokol.html');
fs.writeFileSync(out, html);
console.log('Собрано: ' + path.relative(root, out) + ' (' + Math.round(html.length / 1024) + ' КБ)');
