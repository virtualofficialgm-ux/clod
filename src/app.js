import { PARTNERS } from './config.js';
import { Store } from './store.js';
import { PayService } from './services/pay.js';
import { SandboxPartner, verifySignature } from './partners/sandbox.js';
import { PayError } from './money.js';

// Builds the Pay service together with sandbox partners.
// The sandbox clock can be shifted to demonstrate settlement delays and renewals.
export function createApp({ level = 'connect', baseUrl = '', duplicateWebhooks = true, autoProcessMs = null } = {}) {
  const clock = { offsetMs: 0 };
  const now = () => new Date(Date.now() + clock.offsetMs);
  const partners = {};
  const service = new PayService({ store: new Store(), level, partners, now });

  // Entry point for partner notifications: signature first, then idempotent processing.
  async function receiveWebhook(partnerId, rawBody, signature) {
    const cfg = PARTNERS[partnerId];
    if (!cfg) throw new PayError('unknown_partner', 'Неизвестный партнёр', 404);
    if (!verifySignature(cfg.webhookSecret, rawBody, signature)) {
      throw new PayError('invalid_signature', 'Подпись уведомления не прошла проверку', 401);
    }
    return service.handlePartnerEvent(partnerId, JSON.parse(rawBody));
  }

  for (const [id, cfg] of Object.entries(PARTNERS)) {
    partners[id] = new SandboxPartner({
      id,
      secret: cfg.webhookSecret,
      baseUrl,
      deliver: receiveWebhook,
      duplicateWebhooks,
      autoProcessMs,
    });
  }

  return { service, partners, receiveWebhook, clock };
}
