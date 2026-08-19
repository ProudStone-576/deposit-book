import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/** scrypt, per-user salt, constant-time compare. */
export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(pin, salt, 32);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  try {
    const [scheme, saltHex, keyHex] = stored.split("$");
    if (scheme !== "scrypt") return false;
    const key = scryptSync(pin, Buffer.from(saltHex, "hex"), 32);
    const expected = Buffer.from(keyHex, "hex");
    return key.length === expected.length && timingSafeEqual(key, expected);
  } catch {
    return false;
  }
}
