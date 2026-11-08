import { describe, it, expect } from 'vitest';
import { generateTemporaryPassword } from '@/utils/temporary-password';

describe('Unit Test: Pembuatan Password Sementara', () => {
  it('harus menghasilkan password dengan panjang default 12 karakter', () => {
    const password = generateTemporaryPassword();
    expect(password.length).toBe(12);
  });

  it('harus menghormati parameter panjang kustom', () => {
    const p16 = generateTemporaryPassword(16);
    expect(p16.length).toBe(16);

    const p8 = generateTemporaryPassword(8);
    expect(p8.length).toBe(8);
  });

  it('harus memuat huruf besar, huruf kecil, angka, dan simbol khusus', () => {
    // Uji pada beberapa sampel acak untuk menjamin konsistensi
    for (let i = 0; i < 20; i++) {
      const pwd = generateTemporaryPassword(12);

      const hasUpper = /[A-Z]/.test(pwd);
      const hasLower = /[a-z]/.test(pwd);
      const hasDigit = /[0-9]/.test(pwd);
      const hasSymbol = /[!@#$%*?]/.test(pwd);

      expect(hasUpper).toBe(true);
      expect(hasLower).toBe(true);
      expect(hasDigit).toBe(true);
      expect(hasSymbol).toBe(true);
    }
  });

  it('harus menghasilkan nilai yang unik dan acak pada setiap pemanggilan', () => {
    const set = new Set<string>();
    for (let i = 0; i < 50; i++) {
      set.add(generateTemporaryPassword());
    }
    // Seluruh 50 password harus unik (tidak ada kolisi)
    expect(set.size).toBe(50);
  });
});

