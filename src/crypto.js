// ECDSA P-256 helpers on the standard WebCrypto API, available both in Node (>= 20)
// and in browsers, so the same code runs in the server and in the standalone build.
const EC_ALG = { name: 'ECDSA', namedCurve: 'P-256' };
const EC_SIGN = { name: 'ECDSA', hash: 'SHA-256' };
const utf8 = new TextEncoder();
const subtle = () => globalThis.crypto.subtle;

export function b64u(buf) {
  let bin = '';
  for (const byte of new Uint8Array(buf)) bin += String.fromCharCode(byte);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromB64u(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

// The private key is created non-extractable: it can sign but never be exported.
export function ecGenerate() {
  return subtle().generateKey(EC_ALG, false, ['sign', 'verify']);
}

export async function ecPublicJwk(publicKey) {
  const { kty, crv, x, y } = await subtle().exportKey('jwk', publicKey);
  return { kty, crv, x, y };
}

export async function ecSign(privateKey, message) {
  return b64u(await subtle().sign(EC_SIGN, privateKey, utf8.encode(message)));
}

export async function ecVerify(jwk, message, signature) {
  try {
    const key = await subtle().importKey('jwk', jwk, EC_ALG, false, ['verify']);
    return await subtle().verify(EC_SIGN, key, fromB64u(String(signature)), utf8.encode(message));
  } catch {
    return false;
  }
}

export async function sha256Hex(message) {
  const digest = await subtle().digest('SHA-256', utf8.encode(message));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function randomNonce(bytes = 16) {
  return b64u(globalThis.crypto.getRandomValues(new Uint8Array(bytes)));
}

// Short human-checkable fingerprint of a public key.
export async function keyFingerprint(jwk) {
  const hex = await sha256Hex(`${jwk.x}.${jwk.y}`);
  return hex.slice(0, 16).toUpperCase().match(/.{4}/g).join(' ');
}
