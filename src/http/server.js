import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../app.js';
import { PayError } from '../money.js';
import { createRouter } from './routes.js';

const PUBLIC_DIR = fileURLToPath(new URL('../../public/', import.meta.url));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };
const MAX_BODY = 64 * 1024;

export function createHttpServer({ level = process.env.PARRI_PAY_LEVEL ?? 'connect', baseUrl = '' } = {}) {
  const app = createApp({ level, baseUrl, autoProcessMs: 1500 });
  const dispatch = createRouter(app);

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (req.method === 'GET' && !url.pathname.startsWith('/api/') && !url.pathname.startsWith('/sandbox-partner/')) {
        return await serveStatic(url.pathname, res);
      }
      const raw = req.method === 'POST' ? await readBody(req) : '';
      const result = await dispatch({ method: req.method, url, headers: req.headers, raw });
      if (result?.redirect) {
        res.writeHead(303, { location: result.redirect });
        return res.end();
      }
      if (result?.page) {
        res.writeHead(200, { 'content-type': MIME['.html'], 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'" });
        return res.end(result.page);
      }
      send(res, 200, result ?? { ok: true });
    } catch (err) {
      if (err instanceof PayError) return send(res, err.status, { error: { code: err.code, message: err.message, details: err.details } });
      if (err instanceof SyntaxError) return send(res, 400, { error: { code: 'invalid_json', message: 'Некорректный JSON' } });
      console.error(err);
      send(res, 500, { error: { code: 'internal', message: 'Внутренняя ошибка' } });
    }
  });
  return { server, app };
}

function send(res, status, data) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new PayError('body_too_large', 'Слишком большой запрос', 413));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function serveStatic(pathname, res) {
  const rel = pathname === '/' ? 'index.html' : pathname.slice(1);
  const file = normalize(join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR)) throw new PayError('not_found', 'Не найдено', 404);
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(data);
  } catch {
    throw new PayError('not_found', 'Не найдено', 404);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 3000);
  const { server, app } = createHttpServer();
  server.listen(port, () => {
    console.log(`Parri Pay (${app.service.capabilities().levels.find((l) => l.id === app.service.level).title}) — http://localhost:${port}`);
  });
}
