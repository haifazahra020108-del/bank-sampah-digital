import { randomInt } from 'node:crypto';

/** Alfabet tanpa karakter ambigu (tanpa 0/O, 1/I/l). */
const TEMP_PASSWORD_UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const TEMP_PASSWORD_LOWER = 'abcdefghijkmnopqrstuvwxyz';
const TEMP_PASSWORD_DIGITS = '23456789';
const TEMP_PASSWORD_SYMBOLS = '!@#$%*?';

/**
 * Generate password sementara yang kuat secara kriptografis.
 * Dipakai saat Admin tidak mengisi password sendiri atau saat Admin mereset password otomatis.
 */
export function generateTemporaryPassword(length = 12): string {
  const all = TEMP_PASSWORD_UPPER + TEMP_PASSWORD_LOWER + TEMP_PASSWORD_DIGITS + TEMP_PASSWORD_SYMBOLS;
  const pick = (set: string) => set[randomInt(0, set.length)];

  // Jamin setidaknya satu karakter dari tiap kelompok.
  const chars = [
    pick(TEMP_PASSWORD_UPPER),
    pick(TEMP_PASSWORD_LOWER),
    pick(TEMP_PASSWORD_DIGITS),
    pick(TEMP_PASSWORD_SYMBOLS),
  ];

  while (chars.length < length) {
    chars.push(pick(all));
  }

  // Acak urutannya (Fisher-Yates) agar posisi karakter wajib tidak dapat ditebak.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}
