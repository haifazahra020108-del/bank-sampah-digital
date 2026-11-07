'use client';

import React, { useState, useMemo, useRef } from 'react';
import styles from './setoran.module.css';
import { Button } from '@/components/Button/Button';
import { createTransactionAction } from '@/app/actions/transaction';
import type { ActiveMember, ActiveCategory } from '@/services/transaction';

// ─── Types ──────────────────────────────────────────────────────────────────

interface SetoranFormProps {
  members: ActiveMember[];
  categories: ActiveCategory[];
}

type Step = 1 | 2 | 3;

interface SuccessData {
  memberName: string;
  categoryName: string;
  weight: number;
  pricePerKgSnapshot: number;
  totalValue: number;
  transactionId: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(v: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(v);
}

// ─── Step Indicator ──────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  const steps = [
    { n: 1, label: 'Pilih Anggota' },
    { n: 2, label: 'Isi Setoran' },
    { n: 3, label: 'Konfirmasi' },
  ];

  return (
    <div className={styles.stepIndicator}>
      {steps.map((s, i) => (
        <React.Fragment key={s.n}>
          <div
            className={`${styles.step} ${current === s.n ? styles.active : ''} ${current > s.n ? styles.done : ''}`}
          >
            <div className={styles.stepCircle}>
              {current > s.n ? '✓' : s.n}
            </div>
            <span className={styles.stepLabel}>{s.label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`${styles.stepConnector} ${current > s.n ? styles.done : ''}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SetoranForm({ members, categories }: SetoranFormProps) {
  const [step, setStep] = useState<Step>(1);

  // Step 1 state
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedMember, setSelectedMember] = useState<ActiveMember | null>(null);

  // Step 2 state
  const [selectedCategory, setSelectedCategory] = useState<ActiveCategory | null>(null);
  const [weightStr, setWeightStr] = useState('');
  const weightInputRef = useRef<HTMLInputElement>(null);

  // Step 3 state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<SuccessData | null>(null);

  // ── Derived values ──────────────────────────────────────────────────────────

  const filteredMembers = useMemo(() => {
    const q = memberSearch.toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        (m.contact ?? '').includes(q)
    );
  }, [members, memberSearch]);

  const weight = parseFloat(weightStr);
  const weightValid = !isNaN(weight) && weight > 0;
  const liveTotal =
    selectedCategory && weightValid
      ? weight * selectedCategory.pricePerKg
      : null;

  // ── Navigation ──────────────────────────────────────────────────────────────

  function goToStep2() {
    if (!selectedMember) return;
    setStep(2);
    // Focus weight input after transition
    setTimeout(() => weightInputRef.current?.focus(), 100);
  }

  function goToStep3() {
    if (!selectedCategory || !weightValid) return;
    setStep(3);
    setSubmitError(null);
  }

  function goBack() {
    setStep((prev) => (prev - 1) as Step);
    setSubmitError(null);
  }

  function resetForm() {
    setStep(1);
    setMemberSearch('');
    setSelectedMember(null);
    setSelectedCategory(null);
    setWeightStr('');
    setSubmitError(null);
    setSuccessData(null);
    setIsSubmitting(false);
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  async function handleConfirm() {
    if (!selectedMember || !selectedCategory || !weightValid || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);

    const formData = new FormData();
    formData.append('memberId', selectedMember.id);
    formData.append('categoryId', selectedCategory.id);
    formData.append('weight', weight.toString());

    const result = await createTransactionAction(formData);

    if (result.success && result.preview && result.transactionId) {
      setSuccessData({
        ...result.preview,
        transactionId: result.transactionId,
      });
      // stay on step 3 but render success screen
    } else {
      setSubmitError(result.message);
      setIsSubmitting(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  // SUCCESS SCREEN
  if (successData) {
    return (
      <div className={styles.card}>
        <div className={styles.successScreen}>
          <div className={styles.successIcon}>✅</div>
          <h2 className={styles.successTitle}>Setoran Berhasil Dicatat!</h2>
          <p className={styles.successSubtitle}>
            Saldo anggota telah bertambah sesuai nilai transaksi.
          </p>

          <div className={styles.successDetails}>
            <div className={styles.successDetailRow}>
              <span className={styles.successDetailLabel}>Anggota</span>
              <span className={styles.successDetailValue}>{successData.memberName}</span>
            </div>
            <div className={styles.successDetailRow}>
              <span className={styles.successDetailLabel}>Jenis Sampah</span>
              <span className={styles.successDetailValue}>{successData.categoryName}</span>
            </div>
            <div className={styles.successDetailRow}>
              <span className={styles.successDetailLabel}>Berat</span>
              <span className={styles.successDetailValue}>{successData.weight} kg</span>
            </div>
            <div className={styles.successDetailRow}>
              <span className={styles.successDetailLabel}>Harga/kg</span>
              <span className={styles.successDetailValue}>
                {formatCurrency(successData.pricePerKgSnapshot)}
              </span>
            </div>
            <hr className={styles.divider} />
            <div className={styles.successDetailRow}>
              <span className={styles.successDetailLabel} style={{ fontWeight: 700 }}>
                Total Diterima
              </span>
              <span className={styles.successDetailValue} style={{ color: 'var(--primary)', fontSize: '1.05rem' }}>
                {formatCurrency(successData.totalValue)}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <Button variant="primary" onClick={resetForm} id="btn-setoran-baru">
              + Catat Setoran Baru
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <StepIndicator current={step} />

      {/* ─── STEP 1: Pilih Anggota ─────────────────────────────────── */}
      {step === 1 && (
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardHeaderIcon}>👤</span>
            <span className={styles.cardHeaderTitle}>Pilih Anggota</span>
          </div>
          <div className={styles.cardBody}>
            <input
              id="member-search"
              className={styles.searchInput}
              type="search"
              placeholder="🔍 Cari nama, email, atau nomor kontak..."
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              autoFocus
            />

            {filteredMembers.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyStateIcon}>🔍</div>
                <p>Tidak ada anggota aktif yang sesuai pencarian.</p>
              </div>
            ) : (
              <div className={styles.memberGrid}>
                {filteredMembers.map((m) => (
                  <button
                    key={m.id}
                    className={`${styles.memberCard} ${
                      selectedMember?.id === m.id ? styles.selected : ''
                    }`}
                    onClick={() => setSelectedMember(m)}
                    id={`member-option-${m.id}`}
                    type="button"
                  >
                    <div className={styles.memberName}>{m.name}</div>
                    <div className={styles.memberEmail}>{m.email}</div>
                    {m.contact && (
                      <div className={styles.memberEmail}>📞 {m.contact}</div>
                    )}
                  </button>
                ))}
              </div>
            )}

            <div className={styles.actionBar} style={{ justifyContent: 'flex-end' }}>
              <Button
                variant="primary"
                disabled={!selectedMember}
                onClick={goToStep2}
                id="btn-step1-next"
              >
                Lanjut →
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── STEP 2: Pilih Sampah & Berat ─────────────────────────── */}
      {step === 2 && (
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardHeaderIcon}>♻️</span>
            <span className={styles.cardHeaderTitle}>
              Isi Detail Setoran untuk{' '}
              <span style={{ color: 'var(--primary)' }}>{selectedMember?.name}</span>
            </span>
          </div>
          <div className={styles.cardBody}>
            {/* Pilih Kategori */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="category-select">
                Jenis Sampah <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <select
                id="category-select"
                className={styles.formSelect}
                value={selectedCategory?.id ?? ''}
                onChange={(e) => {
                  const cat = categories.find((c) => c.id === e.target.value) ?? null;
                  setSelectedCategory(cat);
                }}
              >
                <option value="">— Pilih jenis sampah —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {formatCurrency(c.pricePerKg)}/{c.unit}
                  </option>
                ))}
              </select>
            </div>

            {/* Input Berat */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="weight-input">
                Berat (kg) <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                ref={weightInputRef}
                id="weight-input"
                type="number"
                className={styles.formInput}
                value={weightStr}
                onChange={(e) => setWeightStr(e.target.value)}
                placeholder="Contoh: 2.5"
                min="0.01"
                step="0.01"
                max="10000"
              />
              <p className={styles.formHint}>Gunakan titik (.) untuk desimal. Maks: 10.000 kg.</p>
            </div>

            {/* Live preview kalkulasi */}
            {selectedCategory && weightValid && liveTotal !== null && (
              <div className={styles.calcBadge}>
                <span>🧮</span>
                <span>
                  {weight} kg × {formatCurrency(selectedCategory.pricePerKg)} ={' '}
                  <strong>{formatCurrency(liveTotal)}</strong>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      color: 'var(--text-muted)',
                      marginLeft: '0.4rem',
                      fontWeight: 400,
                    }}
                  >
                    (estimasi — total final dihitung server)
                  </span>
                </span>
              </div>
            )}

            <div className={styles.actionBar}>
              <Button variant="secondary" onClick={goBack} id="btn-step2-back">
                ← Kembali
              </Button>
              <Button
                variant="primary"
                disabled={!selectedCategory || !weightValid}
                onClick={goToStep3}
                id="btn-step2-next"
              >
                Lihat Preview →
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── STEP 3: Preview & Konfirmasi ──────────────────────────── */}
      {step === 3 && selectedMember && selectedCategory && weightValid && (
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardHeaderIcon}>📋</span>
            <span className={styles.cardHeaderTitle}>Preview & Konfirmasi Setoran</span>
          </div>
          <div className={styles.cardBody}>
            {submitError && (
              <div className={styles.alertError} role="alert">
                <span>⚠️</span>
                <span>{submitError}</span>
              </div>
            )}

            <div className={styles.previewGrid}>
              <div className={styles.previewItem}>
                <span className={styles.previewLabel}>Anggota</span>
                <span className={styles.previewValue}>{selectedMember.name}</span>
              </div>
              <div className={styles.previewItem}>
                <span className={styles.previewLabel}>Email</span>
                <span className={styles.previewValue} style={{ fontSize: '0.85rem' }}>
                  {selectedMember.email}
                </span>
              </div>
              <div className={styles.previewItem}>
                <span className={styles.previewLabel}>Jenis Sampah</span>
                <span className={styles.previewValue}>{selectedCategory.name}</span>
              </div>
              <div className={styles.previewItem}>
                <span className={styles.previewLabel}>Harga per {selectedCategory.unit}</span>
                <span className={styles.previewValue}>
                  {formatCurrency(selectedCategory.pricePerKg)}
                  <span
                    style={{
                      fontSize: '0.72rem',
                      color: 'var(--text-muted)',
                      fontWeight: 400,
                      marginLeft: '0.35rem',
                    }}
                  >
                    (estimasi)
                  </span>
                </span>
              </div>
              <div className={styles.previewItem}>
                <span className={styles.previewLabel}>Berat</span>
                <span className={styles.previewValue}>{weight} {selectedCategory.unit}</span>
              </div>
              <div className={styles.previewItem}>
                <span className={styles.previewLabel}>Tanggal</span>
                <span className={styles.previewValue}>
                  {new Date().toLocaleDateString('id-ID', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </div>

            <div className={styles.totalRow}>
              <span className={styles.totalLabel}>Estimasi Total</span>
              <span className={styles.totalValue}>
                {formatCurrency(weight * selectedCategory.pricePerKg)}
              </span>
            </div>

            <p
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                marginTop: '0.75rem',
                lineHeight: 1.6,
              }}
            >
              ⓘ Total final diverifikasi dan dihitung ulang di server menggunakan harga terkini
              dari database. Nilai di atas hanya estimasi berdasarkan data yang ditampilkan.
            </p>

            <div className={styles.actionBar}>
              <Button
                variant="secondary"
                onClick={goBack}
                disabled={isSubmitting}
                id="btn-step3-back"
              >
                ← Ubah
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirm}
                disabled={isSubmitting}
                id="btn-konfirmasi-setoran"
              >
                {isSubmitting ? '⏳ Menyimpan...' : '✅ Konfirmasi & Simpan'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
