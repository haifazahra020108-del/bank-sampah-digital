import { describe, it, expect } from 'vitest';
import {
  SUPPORTED_PROVIDERS,
  isValidProvider,
  getProviderDefinition,
  normalizeAndValidateBaseUrl,
} from '@/services/ai-providers';

describe('Unit Test: Registry AI Provider & Adapter', () => {
  it('harus memuat ketiga provider yang didukung (groq, nvidia, gemini)', () => {
    expect(SUPPORTED_PROVIDERS.groq).toBeDefined();
    expect(SUPPORTED_PROVIDERS.nvidia).toBeDefined();
    expect(SUPPORTED_PROVIDERS.gemini).toBeDefined();
  });

  it('isValidProvider harus mengembalikan true untuk provider resmi dan false untuk lainnya', () => {
    expect(isValidProvider('groq')).toBe(true);
    expect(isValidProvider('nvidia')).toBe(true);
    expect(isValidProvider('gemini')).toBe(true);

    expect(isValidProvider('unsupported-provider')).toBe(false);
    expect(isValidProvider('')).toBe(false);
    expect(isValidProvider('openai_fake')).toBe(false);
  });

  it('getProviderDefinition harus mengembalikan metadata lengkap provider', () => {
    const groq = getProviderDefinition('groq');
    expect(groq.name).toBe('Groq');
    expect(groq.defaultPrimary).toBe('openai/gpt-oss-120b');
    expect(groq.allowedBaseUrls).toContain('https://api.groq.com/openai/v1');
    expect(groq.curatedModels.length).toBeGreaterThan(0);
  });

  it('getProviderDefinition harus melempar error untuk provider yang tidak dikenal', () => {
    expect(() => getProviderDefinition('claude-unknown')).toThrowError(/tidak didukung/);
  });

  it('normalizeAndValidateBaseUrl harus memvalidasi URL resmi dan menolak URL manipulasi', () => {
    // URL default resmi
    const validUrl = normalizeAndValidateBaseUrl('groq', 'https://api.groq.com/openai/v1');
    expect(validUrl).toBe('https://api.groq.com/openai/v1');

    // URL dengan trailing slash harus dinormalisasi
    const trailingSlashUrl = normalizeAndValidateBaseUrl('groq', 'https://api.groq.com/openai/v1///');
    expect(trailingSlashUrl).toBe('https://api.groq.com/openai/v1');

    // URL berbahaya atau tidak terdaftar harus ditolak
    expect(() =>
      normalizeAndValidateBaseUrl('groq', 'https://malicious-fake-groq-api.com/v1')
    ).toThrowError(/tidak diizinkan/);

    // URL non-HTTPS harus ditolak
    expect(() =>
      normalizeAndValidateBaseUrl('groq', 'http://api.groq.com/openai/v1')
    ).toThrow();
  });
});

