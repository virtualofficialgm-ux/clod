// Messages signed by Parri Key. Shared by the service (verification) and the device
// firmware, so both sides sign and check exactly the same bytes.
export function attestationMessage({ serial, model, paymentKey, assetsKey }) {
  return `parri-key-attestation|${serial}|${model}|${paymentKey.x}.${paymentKey.y}|${assetsKey.x}.${assetsKey.y}`;
}

export function linkMessage(deviceId, nonce) {
  return `parri-key-link|${deviceId}|${nonce}`;
}

// The confirmed action is part of the signed bytes, so a signature cannot be reused
// for another amount or destination.
export function confirmMessage({ id, deviceId, type, ref, text, nonce }) {
  return `parri-key-confirm|${id}|${deviceId}|${type}|${ref}|${text}|${nonce}`;
}

// Monotonic counter protects against replaying an old ring selection.
export function sourceMessage(deviceId, sourceId, counter) {
  return `parri-key-source|${deviceId}|${sourceId}|${counter}`;
}

export function ownershipMessage(address, nonce) {
  return `parri-wallet-ownership|${address}|${nonce}`;
}
