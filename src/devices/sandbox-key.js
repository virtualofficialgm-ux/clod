import { KEY_MODELS } from '../config.js';
import { ecGenerate, ecPublicJwk, ecSign } from '../crypto.js';
import { attestationMessage } from './protocol.js';

// Sandbox model of the Parri Key hardware. Everything here happens "on the device":
// key pairs are generated inside the Secure Element and the private keys never leave
// this object. Parri only ever receives public keys, the manufacturer attestation and
// signatures produced after the owner's physical confirmation.
//
// The payment key and the digital-asset key are separate key pairs (logical separation;
// physically separate chips are a hardware option).
export class SandboxKeyFactory {
  constructor() {
    this.devices = new Map(); // serial -> SandboxKey
    this.ready = this.#init();
  }

  async #init() {
    this.manufacturer = await ecGenerate();
    this.trustAnchor = await ecPublicJwk(this.manufacturer.publicKey);
  }

  // A device coming off the line: keys generated on-chip, identity signed by the manufacturer.
  async manufacture(model = 'signature') {
    await this.ready;
    if (!KEY_MODELS[model]) throw new Error(`unknown model ${model}`);
    const serial = `PK-${model.slice(0, 3).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const payment = await ecGenerate();
    const assets = await ecGenerate();
    const identity = {
      serial,
      model,
      paymentKey: await ecPublicJwk(payment.publicKey),
      assetsKey: await ecPublicJwk(assets.publicKey),
    };
    identity.attestation = await ecSign(this.manufacturer.privateKey, attestationMessage(identity));
    const device = new SandboxKey(identity, { payment: payment.privateKey, assets: assets.privateKey });
    this.devices.set(serial, device);
    return device;
  }

  get(serial) {
    return this.devices.get(serial);
  }
}

class SandboxKey {
  #keys;

  constructor(identity, keys) {
    this.identity = identity;
    this.#keys = keys;
    this.features = KEY_MODELS[identity.model].features;
    this.screen = null; // what the E-Ink display currently shows
    this.locked = false;
  }

  // Read over NFC when the owner taps the key to the phone.
  readIdentity() {
    return structuredClone(this.identity);
  }

  // Signs only after physical presence: a fingerprint on Signature/Pay, a button press on Core.
  async sign(purpose, message, { presence }) {
    if (this.locked) throw Object.assign(new Error('Ключ заблокирован'), { code: 'device_locked' });
    if (!presence) {
      const what = this.features.biometric ? 'Приложите палец к сенсору' : 'Нажмите кнопку на ключе';
      throw Object.assign(new Error(`${what}, чтобы подтвердить действие`), { code: 'presence_required' });
    }
    const key = this.#keys[purpose];
    if (!key) throw Object.assign(new Error('Неизвестный ключ'), { code: 'unknown_key' });
    return ecSign(key, message);
  }

  showOnDisplay(screen) {
    if (this.features.display) this.screen = { ...screen };
  }
}
