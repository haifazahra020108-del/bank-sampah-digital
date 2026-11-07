'use client';

import React, { useState } from 'react';
import styles from './member.module.css';
import { Button } from '@/components/Button/Button';
import {
  resetMemberPasswordAction,
  type ResetMemberPasswordResult,
} from '@/app/actions/member';

interface ResetPasswordTarget {
  id: string;
  name: string;
  email: string;
}

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: ResetPasswordTarget | null;
}

export function ResetPasswordModal({
  isOpen,
  onClose,
  member,
}: ResetPasswordModalProps) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'AUTO' | 'MANUAL'>('AUTO');
  const [manualPassword, setManualPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(true);
  const [result, setResult] = useState<ResetMemberPasswordResult | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen || !member) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!member) return;

    setError(null);
    setIsPending(true);

    const res = await resetMemberPasswordAction({
      memberId: member.id,
      mode,
      manualPassword: mode === 'MANUAL' ? manualPassword : undefined,
      mustChangePassword,
    });

    setIsPending(false);

    if (!res.success) {
      setError(res.message);
      return;
    }

    setResult(res);
  }

  function handleCopyCredentials() {
    if (!result) return;
    const text = `Kredensial Akun Bank Sampah Digital:\nNama: ${member?.name}\nEmail: ${result.email || member?.email}\nPassword Baru: ${result.temporaryPassword}\n\nSilakan login di: ${window.location.origin}/login`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  // Tampilan Berhasil: Kredensial baru ditampilkan sekali
  if (result) {
    return (
      <div
        className={styles.modalOverlay}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div className={styles.modalContent} style={{ maxWidth: '480px' }}>
          <div className={styles.modalHeader}>
            <h3 className={styles.modalTitle}>✓ Password Berhasil Direset</h3>
            <button
              className={styles.closeButton}
              onClick={onClose}
              aria-label="Tutup dialog"
              id="btn-close-reset-modal"
            >
              ✕
            </button>
          </div>

          <div className={styles.modalBody}>
            <p className={styles.formHint} style={{ marginBottom: '1rem' }}>
              Password untuk anggota <strong>{member.name}</strong> telah berhasil diperbarui di database.
            </p>

            <div
              style={{
                backgroundColor: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                borderRadius: '0.75rem',
                padding: '1rem',
                marginBottom: '1rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.75rem',
                }}
              >
                <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                  🔑 Kredensial Baru
                </span>
                <button
                  type="button"
                  onClick={handleCopyCredentials}
                  style={{
                    backgroundColor: copied ? '#10b981' : 'var(--primary)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '0.375rem',
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                  }}
                  id="btn-copy-reset-credentials"
                >
                  {copied ? '✓ Kredensial Disalin!' : '📋 Salin Kredensial'}
                </button>
              </div>

              <div style={{ fontSize: '0.875rem', lineHeight: '1.7' }}>
                <div>
                  <strong>Email:</strong> {result.email || member.email}
                </div>
                <div>
                  <strong>Password Baru:</strong>{' '}
                  <code
                    style={{
                      backgroundColor: 'rgba(0,0,0,0.06)',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      fontWeight: 'bold',
                      fontSize: '0.95rem',
                      color: 'var(--primary)',
                    }}
                  >
                    {result.temporaryPassword}
                  </code>
                </div>
                <div style={{ marginTop: '0.25rem', color: mustChangePassword ? '#d97706' : '#10b981' }}>
                  {mustChangePassword
                    ? '⚠️ Anggota wajib mengganti password saat login pertama kali.'
                    : '✓ Password ini langsung aktif permanen.'}
                </div>
              </div>

              <div
                style={{
                  fontSize: '0.78rem',
                  color: 'var(--text-muted)',
                  marginTop: '0.75rem',
                  borderTop: '1px solid rgba(59, 130, 246, 0.15)',
                  paddingTop: '0.5rem',
                }}
              >
                ⚠️ <em>Kredensial ini hanya ditampilkan sekarang demi privasi dan keamanan. Password tidak dapat dilihat kembali setelah Anda menutup dialog ini.</em>
              </div>
            </div>
          </div>

          <div className={styles.modalFooter}>
            <Button
              type="button"
              variant="primary"
              onClick={onClose}
              id="btn-done-reset"
            >
              Selesai
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Tampilan Form Reset Password
  return (
    <div
      className={styles.modalOverlay}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={styles.modalContent} style={{ maxWidth: '480px' }}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>🔑 Reset Password Anggota</h3>
          <button
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Tutup dialog"
            disabled={isPending}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.modalBody}>
            {error && <div className={styles.errorText}>{error}</div>}

            <div
              style={{
                backgroundColor: 'var(--background)',
                border: '1px solid var(--border)',
                borderRadius: '0.5rem',
                padding: '0.75rem 1rem',
                marginBottom: '1.25rem',
                fontSize: '0.875rem',
              }}
            >
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                Target Anggota
              </div>
              <div style={{ fontWeight: 600 }}>{member.name}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{member.email}</div>
            </div>

            {/* Pilihan Mode Reset */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Pilih Metode Password Baru</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.35rem' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.6rem',
                    padding: '0.65rem 0.75rem',
                    borderRadius: '0.5rem',
                    border: `1px solid ${mode === 'AUTO' ? 'var(--primary)' : 'var(--border)'}`,
                    backgroundColor: mode === 'AUTO' ? 'rgba(16, 185, 129, 0.05)' : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="resetMode"
                    value="AUTO"
                    checked={mode === 'AUTO'}
                    onChange={() => {
                      setMode('AUTO');
                      setMustChangePassword(true);
                    }}
                    style={{ marginTop: '0.2rem' }}
                    id="radio-mode-auto"
                  />
                  <div>
                    <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                      ⚡ Buat Password Sementara Acak (Disarankan)
                    </span>
                    <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Sistem akan membuat password kuat 12 karakter yang aman secara kriptografis.
                    </p>
                  </div>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.6rem',
                    padding: '0.65rem 0.75rem',
                    borderRadius: '0.5rem',
                    border: `1px solid ${mode === 'MANUAL' ? 'var(--primary)' : 'var(--border)'}`,
                    backgroundColor: mode === 'MANUAL' ? 'rgba(16, 185, 129, 0.05)' : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="resetMode"
                    value="MANUAL"
                    checked={mode === 'MANUAL'}
                    onChange={() => setMode('MANUAL')}
                    style={{ marginTop: '0.2rem' }}
                    id="radio-mode-manual"
                  />
                  <div>
                    <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                      ✍️ Tentukan Password Baru Secara Manual
                    </span>
                    <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Ketikkan password yang disepakati bersama anggota (minimal 6 karakter).
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Input Password Manual */}
            {mode === 'MANUAL' && (
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="input-manual-password">
                  Password Baru <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="input-manual-password"
                    type={showPassword ? 'text' : 'password'}
                    className={styles.formInput}
                    value={manualPassword}
                    onChange={(e) => setManualPassword(e.target.value)}
                    placeholder="Masukkan minimal 6 karakter"
                    required
                    disabled={isPending}
                    style={{ paddingRight: '2.5rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      padding: 0,
                      color: 'var(--text-muted)',
                    }}
                    title={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? '👁️' : '🔒'}
                  </button>
                </div>
              </div>
            )}

            {/* Checkbox Wajib Ganti Password */}
            <div className={styles.formGroup} style={{ marginTop: '0.75rem' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                <input
                  type="checkbox"
                  checked={mustChangePassword}
                  onChange={(e) => setMustChangePassword(e.target.checked)}
                  id="checkbox-must-change"
                />
                <span>Wajib ganti password saat login berikutnya</span>
              </label>
              <p className={styles.formHint}>
                Jika dicentang, anggota langsung diarahkan ke halaman ganti password begitu login berhasil.
              </p>
            </div>
          </div>

          <div className={styles.modalFooter}>
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isPending}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isPending}
              id="btn-submit-reset-password"
            >
              {isPending ? 'Memproses...' : 'Reset Password'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
