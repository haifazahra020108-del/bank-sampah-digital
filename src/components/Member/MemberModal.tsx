'use client';

import React, { useState } from 'react';
import styles from './member.module.css';
import { Button } from '@/components/Button/Button';
import { createMemberAction, updateMemberAction, type CreateMemberResult } from '@/app/actions/member';

export interface MemberData {
  id?: string;
  name: string;
  email: string;
  contact: string | null;
  address: string | null;
  status: string;
}

interface MemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: MemberData | null;
}

interface CreatedMemberInfo {
  name: string;
  email: string;
  activationLink: string | null;
  temporaryPassword: string | null;
  detail: string;
}

export function MemberModal({ isOpen, onClose, initialData }: MemberModalProps) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Informasi waktu txn setelah pendaftaran (tautan aktivasi + password sementara).
  const [createdInfo, setCreatedInfo] = useState<CreatedMemberInfo | null>(null);
  const [copied, setCopied] = useState(false);

  // Form state
  const [name, setName] = useState(initialData?.name ?? '');
  const [email, setEmail] = useState(initialData?.email ?? '');
  const [contact, setContact] = useState(initialData?.contact ?? '');
  const [address, setAddress] = useState(initialData?.address ?? '');
  const [password, setPassword] = useState('');

  const isEdit = !!initialData?.id;

  const handleCopyCredentials = () => {
    if (!createdInfo) return;
    const text = `Kredensial Login Bank Sampah Digital:\nNama: ${createdInfo.name}\nEmail: ${createdInfo.email}\nPassword: ${createdInfo.temporaryPassword || '(Password yang ditentukan Admin)'}\n\nSilakan login di: ${window.location.origin}/login`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsPending(true);

    const formData = new FormData();
    formData.append('name', name);
    formData.append('email', email);
    formData.append('contact', contact);
    formData.append('address', address);

    let result: CreateMemberResult | Awaited<ReturnType<typeof updateMemberAction>>;
    if (isEdit && initialData?.id) {
      result = await updateMemberAction(initialData.id, formData);
    } else {
      formData.append('password', password);
      result = await createMemberAction(formData);
    }

    setIsPending(false);

    if (!result.success) {
      setError(result.message);
      return;
    }

    // Kalau ada tautan aktivasi Telegram atau password sementara, tampilkan agar
    // Admin bisa meneruskannya. Jangan tutup modal diam-diam.
    const telegram = (result as CreateMemberResult).telegram;
    if (!isEdit && (telegram?.activationLink || telegram?.temporaryPassword)) {
      setCreatedInfo({
        name: name.trim(),
        email: email.trim(),
        activationLink: telegram?.activationLink ?? null,
        temporaryPassword: telegram?.temporaryPassword ?? null,
        detail: telegram?.detail ?? '',
      });
      return;
    }

    onClose();
  }

  if (createdInfo) {
    return (
      <div className={styles.modalOverlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className={styles.modalContent}>
          <div className={styles.modalHeader}>
            <h3 className={styles.modalTitle}>Anggota Berhasil Ditambahkan</h3>
            <button
              className={styles.closeButton}
              onClick={onClose}
              aria-label="Tutup modal"
            >
              ✕
            </button>
          </div>

          <div className={styles.modalBody}>
            <p className={styles.formHint}>
              <strong>{createdInfo.name}</strong> ({createdInfo.email})
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>📋 Kredensial Akun Anggota</span>
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
                  id="btn-copy-new-member"
                >
                  {copied ? '✓ Kredensial Disalin!' : '📋 Salin Kredensial'}
                </button>
              </div>

              <div style={{ fontSize: '0.875rem', lineHeight: '1.6' }}>
                <div><strong>Nama:</strong> {createdInfo.name}</div>
                <div><strong>Email:</strong> {createdInfo.email}</div>
                {createdInfo.temporaryPassword ? (
                  <div>
                    <strong>Password Sementara:</strong>{' '}
                    <code style={{ backgroundColor: 'rgba(0,0,0,0.06)', padding: '0.15rem 0.4rem', borderRadius: '4px', fontWeight: 'bold' }}>
                      {createdInfo.temporaryPassword}
                    </code>
                    <span style={{ color: '#d97706', fontSize: '0.8rem', marginLeft: '0.5rem' }}>
                      (Wajib ganti saat login pertama)
                    </span>
                  </div>
                ) : (
                  <div><strong>Password:</strong> (Ditentukan manual oleh Admin)</div>
                )}
              </div>

              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                ⚠️ <em>Simpan atau salin kredensial di atas sekarang. Password tidak dapat dilihat kembali setelah dialog ini ditutup.</em>
              </div>
            </div>

            {createdInfo.activationLink ? (
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Tautan aktivasi Telegram</label>
                <p className={styles.formHint}>{createdInfo.detail}</p>
                <p className={styles.formHint}>
                  <code>{createdInfo.activationLink}</code>
                </p>
                <p className={styles.formHint}>
                  Teruskan tautan tersebut ke anggota (mis. lewat WhatsApp). Setelah dibuka di
                  dalam Telegram, akun anggota otomatis terhubung dan kredensial akses awal dikirim
                  ke chat-nya.
                </p>
              </div>
            ) : (
              <p className={styles.formHint}>{createdInfo.detail}</p>
            )}
          </div>

          <div className={styles.modalFooter}>
            <Button type="button" variant="primary" onClick={onClose} id="btn-close-created-modal">
              Selesai
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.modalOverlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>
            {isEdit ? 'Ubah Data Anggota' : 'Tambah Anggota Baru'}
          </h3>
          <button
            className={styles.closeButton}
            onClick={onClose}
            disabled={isPending}
            aria-label="Tutup modal"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.modalBody}>
            {error && <p className={styles.errorText}>{error}</p>}

            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="member-name">
                Nama Lengkap <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                id="member-name"
                type="text"
                className={styles.formInput}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Budi Santoso"
                required
                disabled={isPending}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="member-email">
                Email / Username <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                id="member-email"
                type="email"
                className={styles.formInput}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Contoh: budi@email.com"
                required
                disabled={isPending}
              />
            </div>

            {!isEdit && (
              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="member-password">
                  Password
                </label>
                <input
                  id="member-password"
                  type="password"
                  className={styles.formInput}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Kosongkan untuk membuat password sementara otomatis"
                  disabled={isPending}
                />
                <p className={styles.formHint}>
                  Jika dikosongkan, sistem membuat <strong>password sementara</strong> yang kuat
                  dan wajib diganti saat anggota login pertama kali.
                </p>
              </div>
            )}

            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="member-contact">
                Nomor Kontak
              </label>
              <input
                id="member-contact"
                type="tel"
                className={styles.formInput}
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="Contoh: 08123456789"
                disabled={isPending}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="member-address">
                Alamat
              </label>
              <textarea
                id="member-address"
                className={styles.formInput}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Contoh: Jl. Merdeka No. 10, RT 03/RW 05"
                rows={3}
                disabled={isPending}
                style={{ resize: 'vertical' }}
              />
            </div>
          </div>

          <div className={styles.modalFooter}>
            <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
              Batal
            </Button>
            <Button type="submit" variant="primary" disabled={isPending} id="btn-simpan-member">
              {isPending ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
