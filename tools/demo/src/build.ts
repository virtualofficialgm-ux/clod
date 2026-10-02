// Собирает демо Parri в одну HTML-страницу (лимит артефакта — 16 МБ):
// интерфейс (веб-экспорт Expo в демо-режиме) + Postgres (PGlite) + миграции/сиды + движок Supabase-API.
// Запуск: pnpm --filter @parri/demo build  →  tools/demo/dist/index.html
import { execSync } from 'node:child_process';
import { createHash, createHmac } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';
import { demoBootstrapSql } from './prepare-db.ts';

const here = fileURLToPath(new URL('..', import.meta.url));
const repo = join(here, '../..');
const out = join(here, '.out');
const dist = join(here, 'dist');
const require = createRequire(import.meta.url);
const pgliteDist = join(require.resolve('@electric-sql/pglite'), '..');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
mkdirSync(dist, { recursive: true });

// Тот же секрет и форма токена, что в engine.ts
const SECRET = 'parri-demo-secret-only-in-this-browser-tab';
const b64u = (b: Buffer | string) => Buffer.from(b).toString('base64url');
const head = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
const body = b64u(JSON.stringify({ iss: 'parri-demo', role: 'anon', exp: 1983812996 }));
const anonKey = `${head}.${body}.${createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url')}`;

console.log('1/4 веб-экспорт приложения в демо-режиме…');
execSync(`npx expo export --platform web --output-dir ${join(out, 'app')} --clear`, {
  cwd: join(repo, 'apps/mobile'),
  stdio: 'inherit',
  env: {
    ...process.env,
    EXPO_OFFLINE: '1',
    CI: '1',
    EXPO_PUBLIC_DEMO: '1',
    EXPO_PUBLIC_SUPABASE_URL: 'https://parri.demo',
    EXPO_PUBLIC_SUPABASE_ANON_KEY: anonKey,
  },
});
const jsDir = join(out, 'app/_expo/static/js/web');
const appJs = readFileSync(join(jsDir, readdirSync(jsDir).find((f) => f.endsWith('.js'))!), 'utf8');

console.log('2/4 движок…');
await build({
  entryPoints: [join(here, 'src/browser.ts')],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  outfile: join(out, 'engine.js'),
  define: { 'import.meta.url': '"https://parri.demo/"' },
  external: ['fs', 'fs/promises', 'zlib', 'stream', 'path', 'url', 'crypto', 'module', 'os', 'child_process', 'worker_threads', 'util'],
  logLevel: 'warning',
});
const engineJs = readFileSync(join(out, 'engine.js'), 'utf8');

console.log('3/4 Postgres и SQL…');
const gz64 = (buf: Buffer | string) => gzipSync(buf, { level: 9 }).toString('base64');
const blobs = {
  'pg-wasm': gz64(readFileSync(join(pgliteDist, 'pglite.wasm'))),
  'pg-initdb': gz64(readFileSync(join(pgliteDist, 'initdb.wasm'))),
  'pg-data': gz64(readFileSync(join(pgliteDist, 'pglite.data'))),
  'pg-sql': gz64(demoBootstrapSql()),
};

const fontDir = join(repo, 'node_modules/@expo-google-fonts/manrope');
const fonts = (['400Regular', '500Medium', '600SemiBold', '700Bold', '800ExtraBold'] as const)
  .map((w) => {
    const file = join(fontDir, w, `Manrope_${w}.ttf`);
    return `@font-face{font-family:'Manrope_${w}';src:url(data:font/ttf;base64,${readFileSync(file).toString('base64')}) format('truetype');font-display:block}`;
  })
  .join('\n');

console.log('4/4 страница…');
const safeScript = (js: string) => js.replace(/<\/script/gi, '<\\/script');
const template = readFileSync(join(here, 'src/shell.html'), 'utf8');
const html = template
  .replace('/*SCHEMA*/', createHash('sha256').update(demoBootstrapSql()).digest('hex').slice(0, 10))
  .replace('/*FONTS*/', fonts)
  .replace('<!--BLOBS-->', Object.entries(blobs).map(([id, b]) => `<script type="application/octet-stream" id="${id}">${b}</script>`).join('\n'))
  .replace('/*ENGINE*/', () => safeScript(engineJs))
  .replace('/*APP*/', () => safeScript(appJs));
writeFileSync(join(dist, 'index.html'), html);
const mb = (n: number) => (n / 1048576).toFixed(2);
console.log(
  `готово: dist/index.html ${mb(Buffer.byteLength(html))} МБ (приложение ${mb(appJs.length)}, движок ${mb(engineJs.length)}, ` +
    Object.entries(blobs).map(([k, v]) => `${k} ${mb(v.length)}`).join(', ') + ')',
);
