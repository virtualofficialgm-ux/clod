import { randomUUID } from 'node:crypto';

const COLLECTIONS = [
  'users', 'merchants', 'orders', 'payments', 'refunds', 'payouts', 'subscriptions',
  'documents', 'notifications', 'ledgerTx', 'balances', 'processedEvents', 'idempotency',
  'topups', 'devices', 'keyChallenges', 'confirmations', 'transfers',
];

// In-memory storage. The interface is intentionally small (named Maps) so that it
// can be replaced by a transactional database without touching the services.
export class Store {
  constructor() {
    for (const name of COLLECTIONS) this[name] = new Map();
  }

  static id(prefix) {
    return `${prefix}_${randomUUID().replaceAll('-', '').slice(0, 20)}`;
  }
}
