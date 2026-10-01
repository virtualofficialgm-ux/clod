import { KEY_MODELS, KEY_STAGES, MARKETS } from '../config.js';
import { Store } from '../store.js';
import { PayError } from '../money.js';
import { ecVerify, randomNonce, sha256Hex, keyFingerprint } from '../crypto.js';
import { attestationMessage, linkMessage, confirmMessage, sourceMessage, ownershipMessage } from '../devices/protocol.js';

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const CONFIRMATION_TTL_MS = 10 * 60 * 1000;

// Parri Key: linking the device, payment source selection, physical confirmation of
// actions and the self-custody wallet.
//
// Financial contours stay separate:
//  - fiat balance: an account at the financial partner, mirrored in the Parri ledger;
//  - digital assets: self-custody, controlled by the owner's key in the Secure Element.
// Parri stores only public keys and verifies signatures; it never holds private keys.
export class KeyService {
  // trustAnchor: the manufacturer's public key (JWK), or a promise of it.
  constructor({ pay, trustAnchor }) {
    this.pay = pay;
    this.store = pay.store;
    this.trustAnchor = trustAnchor;
    pay.keys = this;
  }

  // --- Models ---------------------------------------------------------------

  models(userId) {
    const user = this.#user(userId);
    const issuer = MARKETS[user.market].regulated.cardIssuing;
    return Object.entries(KEY_MODELS).map(([id, m]) => ({
      id,
      title: m.title,
      summary: m.summary,
      stage: m.stage,
      stageText: KEY_STAGES[m.stage],
      features: m.features,
      presence: m.presence,
      contactlessPayments: m.features.contactless && issuer
        ? { available: true }
        : { available: false, reason: m.features.contactless ? 'Оплата касанием появится после договора с банком-эмитентом на вашем рынке' : 'В этой версии нет платёжной функции' },
    }));
  }

  // --- Linking --------------------------------------------------------------

  // Step 1: the phone reads the key's identity over NFC and sends it here.
  async beginLink(userId, identity) {
    this.#user(userId);
    const { serial, model, paymentKey, assetsKey, attestation } = identity ?? {};
    if (!serial || !KEY_MODELS[model] || !paymentKey || !assetsKey || !attestation) {
      throw new PayError('invalid_identity', 'Не удалось прочитать ключ. Поднесите его к телефону ещё раз.');
    }
    // Only genuine devices: the identity must be signed by the manufacturer.
    const anchor = await this.trustAnchor;
    if (!anchor || !(await ecVerify(anchor, attestationMessage(identity), attestation))) {
      throw new PayError('attestation_failed', 'Устройство не прошло проверку подлинности', 422);
    }
    let device = null;
    for (const d of this.store.devices.values()) {
      if (d.serial !== serial || !['active', 'pending_activation', 'blocked'].includes(d.status)) continue;
      if (d.userId !== userId) throw new PayError('key_taken', 'Этот ключ привязан к другому аккаунту', 409);
      if (d.status !== 'pending_activation') throw new PayError('already_linked', 'Этот ключ уже привязан к вашему аккаунту', 409);
      device = d;
    }
    if (!device) {
      const address = `0x${(await sha256Hex(`${assetsKey.x}.${assetsKey.y}`)).slice(-40)}`;
      device = {
        id: Store.id('key'),
        userId,
        serial,
        model,
        status: 'pending_activation',
        paymentKey,
        assetsKey,
        fingerprint: await keyFingerprint(paymentKey),
        assetsFingerprint: await keyFingerprint(assetsKey),
        walletAddress: address,
        selectedSource: 'balance',
        counter: 0,
        createdAt: this.pay.now().toISOString(),
      };
      this.store.devices.set(device.id, device);
    }
    const challenge = this.#challenge(device.id, 'link');
    return {
      device: this.view(device),
      challenge: { id: challenge.id, message: linkMessage(device.id, challenge.nonce), presence: KEY_MODELS[model].presence },
    };
  }

  // Step 2: the owner confirms presence on the device, which signs the challenge.
  async activate(userId, deviceId, signature) {
    const device = this.#device(userId, deviceId);
    if (device.status !== 'pending_activation') throw new PayError('invalid_state', 'Ключ уже активирован или отключён', 409);
    const challenge = this.#takeChallenge(device.id, 'link');
    if (!(await ecVerify(device.paymentKey, linkMessage(device.id, challenge.nonce), signature))) {
      throw new PayError('bad_signature', 'Подпись ключа не прошла проверку. Попробуйте привязать ещё раз.', 401);
    }
    // One active key per account: a new key replaces the previous one.
    for (const d of this.store.devices.values()) {
      if (d.userId === userId && d.status === 'active' && d.id !== device.id) {
        d.status = 'replaced';
        this.#cancelConfirmations(d.id);
      }
    }
    device.status = 'active';
    device.activatedAt = this.pay.now().toISOString();
    this.pay.notify(userId, `${KEY_MODELS[device.model].title} привязан к аккаунту`, device.id);
    return this.view(device);
  }

  activeKeyFor(userId) {
    for (const d of this.store.devices.values()) if (d.userId === userId && d.status === 'active') return d;
    return null;
  }

  devicesOf(userId) {
    return [...this.store.devices.values()]
      .filter((d) => d.userId === userId && ['active', 'pending_activation', 'blocked'].includes(d.status))
      .map((d) => this.view(d));
  }

  view(d) {
    const m = KEY_MODELS[d.model];
    return {
      id: d.id, serial: d.serial, model: d.model, title: m.title, stageText: KEY_STAGES[m.stage], features: m.features, presence: m.presence,
      status: d.status, fingerprint: d.fingerprint, assetsFingerprint: d.assetsFingerprint, walletAddress: d.walletAddress,
      selectedSource: d.selectedSource, counter: d.counter, activatedAt: d.activatedAt ?? null,
    };
  }

  // --- Payment sources and the E-Ink display -------------------------------------

  sources(device) {
    const user = this.#user(device.userId);
    const currency = MARKETS[user.market].settlementCurrency;
    return [
      {
        id: 'balance', kind: 'fiat', title: 'Баланс Parri', short: 'PARRI',
        amount: this.pay.ledger.balance(this.pay.acct(user.id, 'available'), currency), currency,
        custody: 'Счёт у финансового партнёра',
      },
      {
        id: 'assets', kind: 'assets', title: 'Цифровой кошелёк', short: 'WALLET',
        amount: null, currency: null, address: device.walletAddress,
        custody: 'Самостоятельное хранение: ключ только в вашем Parri Key',
      },
    ];
  }

  // What the E-Ink screen shows: selected account, available amount, time of the update.
  display(userId, deviceId) {
    const device = this.#device(userId, deviceId);
    const sources = this.sources(device);
    const selected = sources.find((s) => s.id === device.selectedSource) ?? sources[0];
    const next = device.counter + 1;
    return {
      device: this.view(device),
      screen: { sourceId: selected.id, title: selected.title, short: selected.short, amount: selected.amount, currency: selected.currency, address: selected.address ?? null, updatedAt: this.pay.now().toISOString() },
      sources: sources.map((s) => ({ ...s, counter: next, selectMessage: sourceMessage(device.id, s.id, next) })),
    };
  }

  // The ring turns on the device; the device signs the new selection with a counter.
  async selectSource(userId, deviceId, { sourceId, counter, signature }) {
    const device = this.#device(userId, deviceId);
    this.#assertActive(device);
    if (!this.sources(device).some((s) => s.id === sourceId)) throw new PayError('unknown_source', 'Такого источника нет');
    if (!Number.isInteger(counter) || counter <= device.counter) throw new PayError('stale_selection', 'Устаревшая команда ключа', 409);
    if (!(await ecVerify(device.paymentKey, sourceMessage(device.id, sourceId, counter), signature))) {
      throw new PayError('bad_signature', 'Подпись ключа не прошла проверку', 401);
    }
    device.counter = counter;
    device.selectedSource = sourceId;
    return this.display(userId, deviceId);
  }

  // --- Physical confirmation of actions -------------------------------------------

  requestConfirmation(userId, device, { type, ref, text }) {
    const conf = {
      id: Store.id('cnf'), userId, deviceId: device.id, type, ref, text, nonce: randomNonce(),
      status: 'pending', createdAt: this.pay.now().toISOString(),
      expiresAt: new Date(this.pay.now().getTime() + CONFIRMATION_TTL_MS).toISOString(),
    };
    this.store.confirmations.set(conf.id, conf);
    return this.#confView(conf);
  }

  pendingConfirmations(userId) {
    return [...this.store.confirmations.values()].filter((c) => c.userId === userId && c.status === 'pending').map((c) => this.#confView(c));
  }

  async confirm(userId, confirmationId, { signature, decline = false }) {
    const conf = this.store.confirmations.get(confirmationId);
    if (!conf || conf.userId !== userId) throw new PayError('confirmation_not_found', 'Запрос подтверждения не найден', 404);
    if (conf.status !== 'pending') throw new PayError('invalid_state', 'Запрос уже обработан', 409);
    if (Date.parse(conf.expiresAt) < this.pay.now().getTime()) {
      conf.status = 'expired';
      await this.#resolve(conf, false);
      throw new PayError('confirmation_expired', 'Время подтверждения истекло, действие отменено', 410);
    }
    if (decline) {
      conf.status = 'declined';
      await this.#resolve(conf, false);
      return this.#confView(conf);
    }
    const device = this.store.devices.get(conf.deviceId);
    this.#assertActive(device);
    if (!(await ecVerify(device.paymentKey, confirmMessage(conf), signature))) {
      throw new PayError('bad_signature', 'Подпись ключа не прошла проверку', 401);
    }
    conf.status = 'confirmed';
    conf.confirmedAt = this.pay.now().toISOString();
    await this.#resolve(conf, true);
    return this.#confView(conf);
  }

  // --- Lost key, unlinking -------------------------------------------------------

  block(userId, deviceId) {
    const device = this.#device(userId, deviceId);
    if (device.status !== 'active') throw new PayError('invalid_state', 'Заблокировать можно только активный ключ', 409);
    device.status = 'blocked';
    this.#cancelConfirmations(device.id);
    this.pay.notify(userId, 'Parri Key заблокирован. Подтверждения с него не принимаются.', device.id);
    return this.view(device);
  }

  unlink(userId, deviceId) {
    const device = this.#device(userId, deviceId);
    if (!['active', 'blocked', 'pending_activation'].includes(device.status)) throw new PayError('invalid_state', 'Ключ уже отвязан', 409);
    device.status = 'unlinked';
    this.#cancelConfirmations(device.id);
    this.pay.notify(userId, 'Parri Key отвязан от аккаунта', device.id);
    return this.view(device);
  }

  // --- Self-custody wallet ---------------------------------------------------------

  // Proves the owner controls the wallet key without revealing it.
  beginOwnershipCheck(userId, deviceId) {
    const device = this.#device(userId, deviceId);
    this.#assertActive(device);
    const challenge = this.#challenge(device.id, 'ownership');
    return { message: ownershipMessage(device.walletAddress, challenge.nonce), address: device.walletAddress };
  }

  async verifyOwnership(userId, deviceId, signature) {
    const device = this.#device(userId, deviceId);
    const challenge = this.#takeChallenge(device.id, 'ownership');
    const valid = await ecVerify(device.assetsKey, ownershipMessage(device.walletAddress, challenge.nonce), signature);
    // The payment key must not be able to sign for the wallet: the keys are separate.
    return { valid, address: device.walletAddress, keyFingerprint: device.assetsFingerprint };
  }

  // --- Internals ---------------------------------------------------------------------

  #user(userId) {
    const user = this.store.users.get(userId);
    if (!user) throw new PayError('forbidden', 'Parri Key привязывается к личному аккаунту', 403);
    return user;
  }

  #device(userId, deviceId) {
    const d = this.store.devices.get(deviceId);
    if (!d || d.userId !== userId || d.status === 'unlinked' || d.status === 'replaced') throw new PayError('key_not_found', 'Ключ не найден', 404);
    return d;
  }

  #assertActive(device) {
    if (device?.status !== 'active') throw new PayError('key_inactive', device?.status === 'blocked' ? 'Ключ заблокирован' : 'Ключ не активен', 409);
  }

  #challenge(deviceId, purpose) {
    for (const [id, c] of this.store.keyChallenges) if (c.deviceId === deviceId && c.purpose === purpose) this.store.keyChallenges.delete(id);
    const c = { id: Store.id('chl'), deviceId, purpose, nonce: randomNonce(), expiresAt: new Date(this.pay.now().getTime() + CHALLENGE_TTL_MS).toISOString() };
    this.store.keyChallenges.set(c.id, c);
    return c;
  }

  // Challenges are single-use.
  #takeChallenge(deviceId, purpose) {
    for (const [id, c] of this.store.keyChallenges) {
      if (c.deviceId !== deviceId || c.purpose !== purpose) continue;
      this.store.keyChallenges.delete(id);
      if (Date.parse(c.expiresAt) < this.pay.now().getTime()) break;
      return c;
    }
    throw new PayError('challenge_expired', 'Запрос устарел. Начните заново.', 410);
  }

  #confView(c) {
    const device = this.store.devices.get(c.deviceId);
    return {
      id: c.id, type: c.type, ref: c.ref, text: c.text, status: c.status, expiresAt: c.expiresAt, deviceId: c.deviceId,
      presence: KEY_MODELS[device.model].presence, message: confirmMessage(c),
    };
  }

  async #resolve(conf, confirmed) {
    if (conf.type === 'payout') await this.pay.resolvePayoutConfirmation(conf.ref, confirmed);
    if (conf.type === 'transfer') await this.pay.resolveTransferConfirmation(conf.ref, confirmed);
  }

  #cancelConfirmations(deviceId) {
    for (const c of this.store.confirmations.values()) {
      if (c.deviceId === deviceId && c.status === 'pending') {
        c.status = 'canceled';
        this.#resolve(c, false).catch(() => {});
      }
    }
  }
}
