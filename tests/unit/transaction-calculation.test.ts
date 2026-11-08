import { describe, it, expect } from 'vitest';

/**
 * Formula bisnis perhitungan nilai transaksi:
 * totalValue = weight * pricePerKgSnapshot
 */
function calculateTransactionValue(weight: number, pricePerKg: number): number {
  if (weight <= 0 || pricePerKg < 0) {
    throw new Error('Berat dan harga per kg harus bernilai positif');
  }
  return Math.round(weight * pricePerKg * 100) / 100;
}

describe('Unit Test: Perhitungan Nilai Transaksi Sampah', () => {
  it('harus menghitung total nilai transaksi dengan benar untuk bilangan bulat', () => {
    // 5 kg kardus bekas @ Rp 1.500 = Rp 7.500
    const result = calculateTransactionValue(5, 1500);
    expect(result).toBe(7500);
  });

  it('harus menghitung total nilai transaksi dengan bobot desimal', () => {
    // 2.75 kg botol plastik @ Rp 2.400 = Rp 6.600
    const result = calculateTransactionValue(2.75, 2400);
    expect(result).toBe(6600);
  });

  it('harus menangani pembulatan desimal pecahan rupiah secara akurat', () => {
    // 3.33 kg besi @ Rp 3.500 = Rp 11.655
    const result = calculateTransactionValue(3.33, 3500);
    expect(result).toBe(11655);
  });

  it('harus melempar error jika berat nol atau negatif', () => {
    expect(() => calculateTransactionValue(0, 1500)).toThrow();
    expect(() => calculateTransactionValue(-1.5, 1500)).toThrow();
  });

  it('harus melempar error jika harga negatif', () => {
    expect(() => calculateTransactionValue(2, -500)).toThrow();
  });
});

