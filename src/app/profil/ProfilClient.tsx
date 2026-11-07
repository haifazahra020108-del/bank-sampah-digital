'use client';

import React, { useEffect, useState, useActionState } from 'react';
import { useRouter } from 'next/navigation';

import { updateProfileAction } from '@/app/actions/profile';
import { changePasswordAction } from '@/app/actions/password';
import styles from './profil.module.css';

interface ProfilClientProps {
  initialName: string;
  initialEmail: string;
  role: string;
}

function roleLabel(role: string) {
  if (role === 'ADMIN') return 'Admin';
  if (role === 'MANAGER') return 'Pengelola';
  return 'Anggota';
}

export default function ProfilClient({ initialName, initialEmail, role }: ProfilClientProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [profileState, profileAction, profilePending] = useActionState(updateProfileAction, null);
  const [passwordState, passwordAction, passwordPending] = useActionState(changePasswordAction, null);

  useEffect(() => {
    if (profileState?.success) {
      setIsEditing(false);
      router.refresh();
    }
  }, [profileState, router]);

  const handleCancel = () => {
    setName(initialName);
    setEmail(initialEmail);
    setIsEditing(false);
  };

  return (
    <div className={styles.container}>
      {/* Informasi Profil */}
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>Profil Saya</h1>
          <p className={styles.subtitle}>Lihat dan ubah informasi profil Anda.</p>
        </div>

        {profileState?.error && <div className={styles.errorAlert}>{profileState.error}</div>}
        {profileState?.success && <div className={styles.notice}>Profil berhasil diperbarui.</div>}

        {!isEditing ? (
          <>
            <div className={styles.form}>
              <div className={styles.field}>
                <label className={styles.label}>Nama lengkap</label>
                <div className={styles.readonlyValue}>{name}</div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Email</label>
                <div className={styles.readonlyValue}>{email}</div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Role</label>
                <div>
                  <span className={styles.roleBadge}>{roleLabel(role)}</span>
                </div>
                <p className={styles.hint}>Role tidak dapat diubah melalui profil.</p>
              </div>
            </div>

            <div className={styles.buttonRow}>
              <button type="button" className={styles.editButton} onClick={() => setIsEditing(true)}>
                Edit Profil
              </button>
            </div>
          </>
        ) : (
          <form action={profileAction} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="name">Nama lengkap</label>
              <input
                id="name"
                name="name"
                type="text"
                className={styles.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={profilePending}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                className={styles.input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={profilePending}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Role</label>
              <div>
                <span className={styles.roleBadge}>{roleLabel(role)}</span>
              </div>
              <p className={styles.hint}>Role tidak dapat diubah melalui profil.</p>
            </div>

            <div className={styles.buttonRow}>
              <button type="submit" className={styles.submitButton} disabled={profilePending}>
                {profilePending ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
              <button type="button" className={styles.secondaryButton} onClick={handleCancel} disabled={profilePending}>
                Batal
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Ganti Password */}
      <div className={styles.card}>
        <div className={styles.header}>
          <h2 className={styles.sectionTitle}>Ganti Password</h2>
        </div>

        {passwordState?.error && <div className={styles.errorAlert}>{passwordState.error}</div>}
        {passwordState?.success && <div className={styles.notice}>Password berhasil diubah.</div>}

        <form action={passwordAction} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="currentPassword">Password saat ini</label>
            <div className={styles.passwordWrapper}>
              <input
                id="currentPassword"
                name="currentPassword"
                type={showCurrent ? 'text' : 'password'}
                className={styles.input}
                autoComplete="current-password"
                required
                disabled={passwordPending}
              />
              <button
                type="button"
                className={styles.togglePassword}
                onClick={() => setShowCurrent((v) => !v)}
                aria-label={showCurrent ? 'Sembunyikan password' : 'Tampilkan password'}
              >
                {showCurrent ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="newPassword">Password baru</label>
            <div className={styles.passwordWrapper}>
              <input
                id="newPassword"
                name="newPassword"
                type={showNew ? 'text' : 'password'}
                className={styles.input}
                autoComplete="new-password"
                required
                minLength={8}
                disabled={passwordPending}
              />
              <button
                type="button"
                className={styles.togglePassword}
                onClick={() => setShowNew((v) => !v)}
                aria-label={showNew ? 'Sembunyikan password' : 'Tampilkan password'}
              >
                {showNew ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
            <p className={styles.hint}>Minimal 8 karakter, dan harus memuat huruf besar, huruf kecil, angka, serta simbol.</p>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="confirmPassword">Konfirmasi password baru</label>
            <div className={styles.passwordWrapper}>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirm ? 'text' : 'password'}
                className={styles.input}
                autoComplete="new-password"
                required
                minLength={8}
                disabled={passwordPending}
              />
              <button
                type="button"
                className={styles.togglePassword}
                onClick={() => setShowConfirm((v) => !v)}
                aria-label={showConfirm ? 'Sembunyikan password' : 'Tampilkan password'}
              >
                {showConfirm ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button type="submit" className={styles.submitButton} disabled={passwordPending}>
            {passwordPending ? 'Menyimpan...' : 'Ganti Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
