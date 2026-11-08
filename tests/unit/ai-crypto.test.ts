import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encryptApiKey, decryptApiKey, maskApiKey } from '@/services/ai-crypto';

describe('Unit Test: Kriptografi AI (AES-256-GCM & Masking)', () => {
  const originalSecret = process.env.AI_CONFIG_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.AI_CONFIG_ENCRYPTION_KEY = 'test-encryption-key-for-unit-testing-32-chars!!';
  });

  afterEach(() => {
    if (originalSecret !== undefined) {
      process.env.AI_CONFIG_ENCRYPTION_KEY = originalSecret;
    } else {
      delete process.env.AI_CONFIG_ENCRYPTION_KEY;
    }
  });

  describe('Enkripsi & Dekripsi AES-256-GCM', () => {
    it('harus menghasilkan ciphertext dengan 3 komponen base64url (iv.authTag.ciphertext)', () => {
      const rawKey = 'gsk_sample_secret_key_1234567890abcdef';
      const cipher = encryptApiKey(rawKey);

      const parts = cipher.split('.');
      expect(parts.length).toBe(3);
      expect(cipher).not.toContain(rawKey);
    });

    it('harus mendekripsi ciphertext kembali ke nilai plaintext asli secara identik', () => {
      const rawKey = 'nvapi-sample-nvidia-nim-token-secret-9999';
      const encrypted = encryptApiKey(rawKey);
      const decrypted = decryptApiKey(encrypted);

      expect(decrypted).toBe(rawKey);
    });

    it('harus mendeteksi dan menolak ciphertext yang dimanipulasi (integrity failure)', () => {
      const rawKey = 'gsk_valid_api_key_secure_123';
      const cipher = encryptApiKey(rawKey);

      // Rusak bagian auth tag (komponen ke-2) dengan nilai 16-byte yang salah
      // Buffer.alloc(16, 0xff) = 16 bytes semua 0xFF — ukuran benar tapi isinya salah
      const parts = cipher.split('.');
      parts[1] = Buffer.alloc(16, 0xff).toString('base64url');
      const tamperedCipher = parts.join('.');

      expect(() => decryptApiKey(tamperedCipher)).toThrowError(/Gagal mendekripsi API key/);
    });

    it('harus menolak input ciphertext yang tidak memiliki format 3 bagian', () => {
      expect(() => decryptApiKey('invalid-format-without-three-parts')).toThrow();
      expect(() => decryptApiKey('')).toThrow();
    });

    it('harus melempar error jika kunci enkripsi server belum diset', () => {
      delete process.env.AI_CONFIG_ENCRYPTION_KEY;
      delete process.env.NEXTAUTH_SECRET;

      expect(() => encryptApiKey('some-key')).toThrowError(/belum dikonfigurasi/);
    });
  });

  describe('Fungsi maskApiKey', () => {
    it('harus menyamarkan API key ber-prefix (misal Groq gsk_)', () => {
      const groqKey = 'gsk_abcdef1234567890wxyz';
      const masked = maskApiKey(groqKey);

      expect(masked.startsWith('gsk_')).toBe(true);
      expect(masked.endsWith('wxyz')).toBe(true);
      expect(masked).toContain('••••');
      expect(masked).not.toContain('abcdef1234567890');
    });

    it('harus menyamarkan API key tanpa prefix khusus', () => {
      const genericKey = 'sk-proj-1234567890abcdefghijklmnop';
      const masked = maskApiKey(genericKey);

      expect(masked.endsWith('mnop')).toBe(true);
      expect(masked).not.toContain('1234567890');
    });

    it('harus menangani string kosong atau input pendek secara aman', () => {
      expect(maskApiKey('')).toBe('');
      expect(maskApiKey('12345')).toBe('••••••••');
    });
  });
});

