/**
 * @file src/deviceFingerprint.ts
 * @description Anti-fraud support for the voting feature: a "fingerprint"
 * computed entirely in the browser from characteristics that don't identify
 * a person on their own, reduced to a single hash via the native Web Crypto
 * API -- no new dependency, no library. Only this short hash is ever sent
 * to the server; the raw signals it's built from never leave the device.
 * It's a soft signal only (see server.ts's Voting section): Module 3 uses
 * it to flag "same device, many phone numbers" patterns for a human to
 * review, never to block a vote outright -- a shared family device is not
 * automatically fraud.
 */

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** A stable per-browser random id, persisted in localStorage, used only when crypto.subtle is unavailable (requires a secure context). */
function fallbackDeviceId(): string {
  try {
    const key = 'aq_device_id';
    let id = localStorage.getItem(key);
    if (!id) {
      id = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return 'unknown-device-fallback';
  }
}

export async function computeDeviceFingerprint(): Promise<string> {
  const signals = [
    navigator.userAgent,
    navigator.language,
    String(navigator.hardwareConcurrency || ''),
    String(screen.width),
    String(screen.height),
    String(screen.colorDepth),
    Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    String(new Date().getTimezoneOffset())
  ].join('|');

  try {
    return await sha256Hex(signals);
  } catch {
    return fallbackDeviceId();
  }
}
