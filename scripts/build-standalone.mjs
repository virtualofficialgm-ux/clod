// Builds a single self-contained HTML page that runs Parri Pay entirely in the
// browser: the service, sandbox partners and API router are bundled into the
// page, and fetch() calls to /api/* are dispatched to them locally.
//
//   node scripts/build-standalone.mjs [output.html]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const out = process.argv[2] ?? join(root, 'dist/parri-pay.html');

// Dependency order.
const MODULES = [
  'src/config.js', 'src/money.js', 'src/store.js', 'src/ledger.js', 'src/fees.js', 'src/idempotency.js',
  'src/services/antifraud.js', 'src/services/reconciliation.js', 'src/services/pay.js',
  'src/partners/sandbox.js', 'src/app.js', 'src/http/pages.js', 'src/http/routes.js',
];

const stripModule = (src) => src
  .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];[ \t]*\n/gm, '')
  .replace(/^export (?=(const|function|class|async)\b)/gm, '');

// Browser stand-ins for the node:crypto helpers used by the sandbox.
const shims = `
const randomUUID = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
  const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
}));
const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16).padStart(8, '0'); };
const createHash = () => ({ s: '', update(v) { this.s += v; return this; }, digest() { return this.s; } });
const createHmac = (_alg, key) => ({ s: String(key), update(v) { this.s += '|' + v; return this; }, digest() { return fnv(this.s) + fnv(this.s.split('').reverse().join('')); } });
const timingSafeEqual = (a, b) => a === b;
const Buffer = { from: (v) => String(v) };
`;

const backend = `(() => {
${shims}
${MODULES.map((m) => `// ---- ${m}\n${stripModule(read(m))}`).join('\n')}
const app = createApp({ level: 'platform', autoProcessMs: 1500 });
const dispatch = createRouter(app);
const nativeFetch = window.fetch.bind(window);
window.PARRI_EMBEDDED = true;
window.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url, 'https://parri.local');
  if (!url.pathname.startsWith('/api/') && !url.pathname.startsWith('/sandbox-partner/')) return nativeFetch(input, init);
  const headers = Object.fromEntries(Object.entries(init.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  let status = 200;
  let data;
  try {
    data = (await dispatch({ method: init.method ?? 'GET', url, headers, raw: init.body ?? '' })) ?? { ok: true };
  } catch (err) {
    status = err instanceof PayError ? err.status : 500;
    data = { error: { code: err.code ?? 'internal', message: err instanceof PayError ? err.message : 'Внутренняя ошибка' } };
    if (!(err instanceof PayError)) console.error(err);
  }
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
};
})();`;

const index = read('public/index.html');
const body = index.slice(index.indexOf('<body>') + 6, index.indexOf('</body>'))
  .replace(/\s*<script type="module" src="\/app.js"><\/script>/, '');

const html = `<title>Parri Pay</title>
<style>
${read('public/styles.css')}
.standalone-note { max-width: 960px; margin: 0 auto; padding: 12px 16px 0; font-size: 12px; color: var(--muted); }
</style>
${body}
<p class="standalone-note">Демо-версия: сервис и банки-партнёры работают в браузере, данные сбрасываются при перезагрузке страницы. Карты и банки тестовые.</p>
<script>
${backend.replaceAll('</script', '<\\/script')}
</script>
<script type="module">
${read('public/app.js').replaceAll('</script', '<\\/script')}
</script>
`;

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`Wrote ${out} (${(html.length / 1024).toFixed(0)} KB)`);
