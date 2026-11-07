'use client';

import React from 'react';
import styles from './ai-hub.module.css';

interface AiHubClientProps {
  userName: string;
}

const SAMPLE_QUESTIONS = [
  'Berapa saldo tabungan saya saat ini?',
  'Bagaimana cara memilah sampah di rumah?',
  'Bagaimana cara mengajukan penarikan saldo?',
  'Botol plastik termasuk jenis sampah apa?',
  'Menu apa saja yang tersedia untuk saya?',
  'Berapa batas maksimum berat sampah yang bisa disetor?',
];

export function AiHubClient({ userName }: AiHubClientProps) {
  const handleOpenChat = (question?: string) => {
    window.dispatchEvent(
      new CustomEvent('open-ai-chat', {
        detail: question ? { message: question } : undefined,
      })
    );
  };

  return (
    <div className={styles.container}>
      {/* Hero Banner */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.heroBadge}>
            <span>🤖</span>
            <span>Asisten Virtual Cerdas</span>
          </div>
          <h1 className={styles.heroTitle}>
            Halo, {userName}! Tanya Apa Saja ke Asisten AI
          </h1>
          <p className={styles.heroSubtitle}>
            Asisten AI Bank Sampah Digital kini hadir sebagai widget chat melayang di pojok kanan bawah
            layar Anda. Anda dapat berkonsultasi seputar pemilahan sampah, memeriksa data akun, atau
            mempelajari fitur aplikasi dari halaman mana saja.
          </p>

          <div className={styles.heroActionGroup}>
            <button
              type="button"
              className={styles.openChatBtn}
              onClick={() => handleOpenChat()}
            >
              <span>💬</span>
              <span>Buka Chat Asisten AI</span>
            </button>
            <div className={styles.floatingTip}>
              <span>💡</span>
              <span>Widget chat juga dapat dibuka langsung lewat tombol bulat di pojok kanan bawah</span>
            </div>
          </div>
        </div>

        <div className={styles.heroVisual} aria-hidden="true">
          🤖
        </div>
      </section>

      {/* Capabilities Overview */}
      <section>
        <h2 className={styles.sectionTitle}>🌟 Kemampuan Asisten AI Bank Sampah</h2>
        <div className={styles.capabilitiesGrid}>
          <div className={styles.capabilityCard}>
            <div className={styles.capabilityIcon}>🌱</div>
            <h3 className={styles.capabilityHeading}>Edukasi Pemilahan Sampah</h3>
            <p className={styles.capabilityDesc}>
              Panduan lengkap pemilahan sampah organik, anorganik, plastik, kertas, kardus, hingga logam
              agar memiliki nilai tabungan maksimal.
            </p>
          </div>

          <div className={styles.capabilityCard}>
            <div className={styles.capabilityIcon}>💳</div>
            <h3 className={styles.capabilityHeading}>Informasi Saldo & Akun</h3>
            <p className={styles.capabilityDesc}>
              Cek saldo tabungan sampah Anda, riwayat setoran, total berat sampah yang sudah disetor,
              serta status pengajuan penarikan aktif.
            </p>
          </div>

          <div className={styles.capabilityCard}>
            <div className={styles.capabilityIcon}>📖</div>
            <h3 className={styles.capabilityHeading}>Panduan Alur & Menu Aplikasi</h3>
            <p className={styles.capabilityDesc}>
              Pelajari langkah-langkah penggunaan fitur, batas validasi setoran, cara pencairan dana,
              serta penjelasan hak akses peran pengguna.
            </p>
          </div>
        </div>
      </section>

      {/* Quick Questions Interactive Triggers */}
      <section className={styles.quickQuestionsSection}>
        <h2 className={styles.sectionTitle}>⚡ Pertanyaan Populer yang Sering Diajukan</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
          Klik salah satu pertanyaan di bawah untuk langsung menanyakannya ke Asisten AI:
        </p>
        <div className={styles.quickQuestionsGrid}>
          {SAMPLE_QUESTIONS.map((q) => (
            <button
              type="button"
              key={q}
              className={styles.questionCard}
              onClick={() => handleOpenChat(q)}
            >
              <span>{q}</span>
              <span className={styles.questionArrow}>→</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
