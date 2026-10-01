import { createHash } from 'node:crypto';
import { PayError } from './money.js';

// Request-level idempotency: a repeated request with the same key returns the
// stored result and never performs the operation twice.
export class Idempotency {
  constructor(store) {
    this.store = store;
  }

  async run(scope, key, payload, fn) {
    if (!key) return fn();
    if (typeof key !== 'string' || key.length > 200) {
      throw new PayError('invalid_idempotency_key', 'Некорректный Idempotency-Key');
    }
    const id = `${scope}:${key}`;
    const hash = createHash('sha256').update(JSON.stringify(payload ?? null)).digest('hex');
    const existing = this.store.idempotency.get(id);
    if (existing) {
      if (existing.hash !== hash) {
        throw new PayError('idempotency_conflict', 'Ключ идемпотентности уже использован с другими параметрами', 409);
      }
      if (existing.state === 'in_progress') {
        throw new PayError('request_in_progress', 'Запрос с этим ключом ещё обрабатывается', 409);
      }
      if (existing.error) throw new PayError(existing.error.code, existing.error.message, existing.error.status);
      return existing.result;
    }
    this.store.idempotency.set(id, { hash, state: 'in_progress', createdAt: new Date().toISOString() });
    try {
      const result = await fn();
      this.store.idempotency.set(id, { hash, state: 'done', result, createdAt: new Date().toISOString() });
      return result;
    } catch (err) {
      if (err instanceof PayError && err.status < 500) {
        // Business rejections are final for this key.
        this.store.idempotency.set(id, { hash, state: 'done', error: { code: err.code, message: err.message, status: err.status } });
      } else {
        // Technical failures may be retried with the same key.
        this.store.idempotency.delete(id);
      }
      throw err;
    }
  }
}
