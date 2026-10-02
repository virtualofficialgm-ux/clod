import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, normalize } from 'node:path';
import { pool, withRole } from './db.ts';
import { HttpError, type Req } from './http.ts';
import { sign, verify } from './jwt.ts';

/**
 * Подмножество Storage API (/storage/v1). Файлы лежат на диске, а строки storage.objects
 * вставляются/читаются от имени роли пользователя — политики RLS из миграций работают.
 */

const ROOT = process.env.DEVSTACK_STORAGE_DIR ?? '/tmp/parri-devstack-storage';

function filePath(bucket: string, name: string): string {
  const p = normalize(join(ROOT, bucket, name));
  if (!p.startsWith(normalize(join(ROOT, bucket)) + '/')) throw new HttpError(400, { error: 'InvalidKey', message: 'bad path' });
  return p;
}

function splitPath(rest: string): { bucket: string; name: string } {
  const decoded = decodeURIComponent(rest);
  const i = decoded.indexOf('/');
  if (i < 1) throw new HttpError(400, { error: 'InvalidKey', message: 'bad path' });
  return { bucket: decoded.slice(0, i), name: decoded.slice(i + 1) };
}

function guessMime(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif',
    pdf: 'application/pdf', txt: 'text/plain', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  };
  return map[ext ?? ''] ?? 'application/octet-stream';
}

async function extractFile(req: Req): Promise<{ data: Buffer; mime: string }> {
  const type = String(req.headers['content-type'] ?? '');
  if (type.startsWith('multipart/form-data')) {
    const form = await new Request('http://local', { method: 'POST', headers: { 'content-type': type }, body: new Uint8Array(req.raw) }).formData();
    for (const [, value] of form) {
      if (typeof value !== 'string') return { data: Buffer.from(await value.arrayBuffer()), mime: value.type || 'application/octet-stream' };
    }
    throw new HttpError(400, { error: 'InvalidRequest', message: 'no file in form' });
  }
  return { data: req.raw, mime: type || 'application/octet-stream' };
}

async function canRead(req: Req, bucket: string, name: string): Promise<boolean> {
  return withRole(req.claims, async (c) => {
    const r = await c.query(`select 1 from storage.objects where bucket_id = $1 and name = $2`, [bucket, name]);
    return r.rowCount === 1;
  });
}

async function serve(bucket: string, name: string) {
  const data = await readFile(filePath(bucket, name)).catch(() => null);
  if (!data) throw new HttpError(404, { error: 'not_found', message: 'Object not found', statusCode: '404' });
  const meta = await pool.query<{ mimetype: string }>(
    `select metadata ->> 'mimetype' as mimetype from storage.objects where bucket_id = $1 and name = $2`,
    [bucket, name],
  );
  return { status: 200, body: data, headers: { 'content-type': meta.rows[0]?.mimetype ?? guessMime(name) } };
}

export async function handleStorage(req: Req, sub: string): Promise<{ status: number; body?: unknown; headers?: Record<string, string> }> {
  // Публичное чтение
  if (req.method === 'GET' && sub.startsWith('/object/public/')) {
    const { bucket, name } = splitPath(sub.slice('/object/public/'.length));
    const b = await pool.query(`select public from storage.buckets where id = $1`, [bucket]);
    if (!b.rows[0]?.public) throw new HttpError(400, { error: 'not_found', message: 'Bucket not public' });
    return serve(bucket, name);
  }

  // Подписанные ссылки
  if (sub.startsWith('/object/sign/')) {
    const { bucket, name } = splitPath(sub.slice('/object/sign/'.length));
    if (req.method === 'POST') {
      if (!(await canRead(req, bucket, name))) throw new HttpError(400, { error: 'not_found', message: 'Object not found', statusCode: '404' });
      const expiresIn = Number(req.json<{ expiresIn?: number }>().expiresIn ?? 3600);
      const token = sign({ url: `${bucket}/${name}`, exp: Math.floor(Date.now() / 1000) + expiresIn });
      return { status: 200, body: { signedURL: `/object/sign/${bucket}/${encodeURI(name)}?token=${token}` } };
    }
    const payload = verify(req.query.get('token') ?? '');
    if (!payload || payload.url !== `${bucket}/${name}`) throw new HttpError(400, { error: 'InvalidJWT', message: 'invalid signature' });
    return serve(bucket, name);
  }

  if (sub.startsWith('/object/authenticated/') && req.method === 'GET') {
    const { bucket, name } = splitPath(sub.slice('/object/authenticated/'.length));
    if (!(await canRead(req, bucket, name))) throw new HttpError(400, { error: 'not_found', message: 'Object not found', statusCode: '404' });
    return serve(bucket, name);
  }

  if (sub.startsWith('/object/')) {
    const rest = sub.slice('/object/'.length);
    // Удаление пачкой: DELETE /object/<bucket> { prefixes }
    if (req.method === 'DELETE' && !rest.includes('/')) {
      const bucket = decodeURIComponent(rest);
      const { prefixes = [] } = req.json<{ prefixes?: string[] }>();
      const deleted = await withRole(req.claims, async (c) =>
        (await c.query(`delete from storage.objects where bucket_id = $1 and name = any($2) returning name, bucket_id`, [bucket, prefixes])).rows,
      );
      for (const d of deleted) await rm(filePath(bucket, d.name), { force: true });
      return { status: 200, body: deleted };
    }

    const { bucket, name } = splitPath(rest);
    if (req.method === 'GET') {
      if (!(await canRead(req, bucket, name))) throw new HttpError(400, { error: 'not_found', message: 'Object not found', statusCode: '404' });
      return serve(bucket, name);
    }
    if (req.method === 'POST' || req.method === 'PUT') {
      const { data, mime } = await extractFile(req);
      const bucketRow = await pool.query<{ file_size_limit: string | null }>(`select file_size_limit from storage.buckets where id = $1`, [bucket]);
      if (!bucketRow.rows[0]) throw new HttpError(400, { error: 'Bucket not found', message: 'Bucket not found', statusCode: '404' });
      const limit = Number(bucketRow.rows[0].file_size_limit ?? Infinity);
      if (data.length > limit) throw new HttpError(413, { error: 'Payload too large', message: 'The object exceeded the maximum allowed size', statusCode: '413' });
      const upsert = req.headers['x-upsert'] === 'true' || req.method === 'PUT';
      const metadata = JSON.stringify({ size: data.length, mimetype: mime });
      try {
        const row = await withRole(req.claims, async (c) => {
          const sql = upsert
            ? `insert into storage.objects (bucket_id, name, metadata) values ($1, $2, $3)
               on conflict (bucket_id, name) do update set metadata = excluded.metadata, updated_at = now() returning id`
            : `insert into storage.objects (bucket_id, name, metadata) values ($1, $2, $3) returning id`;
          return (await c.query(sql, [bucket, name, metadata])).rows[0];
        });
        await mkdir(dirname(filePath(bucket, name)), { recursive: true });
        await writeFile(filePath(bucket, name), data);
        return { status: 200, body: { Key: `${bucket}/${name}`, Id: row.id, path: name, id: row.id, fullPath: `${bucket}/${name}` } };
      } catch (e) {
        const err = e as { code?: string; message?: string };
        if (err.code === '23505') throw new HttpError(409, { error: 'Duplicate', message: 'The resource already exists', statusCode: '409' });
        if (err.code === '42501') throw new HttpError(403, { error: 'Unauthorized', message: 'new row violates row-level security policy', statusCode: '403' });
        throw e;
      }
    }
  }

  throw new HttpError(404, { error: 'not_found', message: `devstack: ${req.method} /storage/v1${sub} не поддерживается` });
}
