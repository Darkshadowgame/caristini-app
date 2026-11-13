// Small ASCII base64 helpers. The BLE library passes characteristic values as
// base64 strings, and the adapter only ever speaks ASCII.
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function asciiToBase64(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i += 3) {
    const a = text.charCodeAt(i) & 0xff;
    const b = i + 1 < text.length ? text.charCodeAt(i + 1) & 0xff : NaN;
    const c = i + 2 < text.length ? text.charCodeAt(i + 2) & 0xff : NaN;
    const n = (a << 16) | ((b || 0) << 8) | (c || 0);
    out += ALPHABET[(n >> 18) & 63] + ALPHABET[(n >> 12) & 63];
    out += Number.isNaN(b) ? '=' : ALPHABET[(n >> 6) & 63];
    out += Number.isNaN(c) ? '=' : ALPHABET[n & 63];
  }
  return out;
}

export function base64ToAscii(data: string): string {
  const clean = data.replace(/[^A-Za-z0-9+/]/g, '');
  let out = '';
  for (let i = 0; i < clean.length; i += 4) {
    const n =
      (ALPHABET.indexOf(clean[i]) << 18) |
      (ALPHABET.indexOf(clean[i + 1]) << 12) |
      ((i + 2 < clean.length ? ALPHABET.indexOf(clean[i + 2]) : 0) << 6) |
      (i + 3 < clean.length ? ALPHABET.indexOf(clean[i + 3]) : 0);
    out += String.fromCharCode((n >> 16) & 0xff);
    if (i + 2 < clean.length) out += String.fromCharCode((n >> 8) & 0xff);
    if (i + 3 < clean.length) out += String.fromCharCode(n & 0xff);
  }
  return out;
}
