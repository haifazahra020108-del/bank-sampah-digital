'use client';

import React, { useCallback, useEffect, useState } from 'react';

import {
  createTelegramLinkCodeAction,
  disconnectTelegramAction,
  getTelegramStatusAction,
} from '@/app/actions/telegram';
import styles from './TelegramSettings.module.css';

interface Status {
  connected: boolean;
  botUsername: string | null;
  botConfigured: boolean;
}

interface LinkInfo {
  code: string;
  deepLink: string | null;
  expiresAt: string;
}

/**
 * Panel pengaturan Telegram untuk anggota.
 * Server sudah memverifikasi kepemilikan chat sebelum kode aktivasi dianggap sah; panel
 * ini hanya meminta kode dan menampilkan tautannya.
 */
export function TelegramSettings() {
  const [status, setStatus] = useState<Status | null>(null);
  const [linkInfo, setLinkInfo] = useState<LinkInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const result = await getTelegramStatusAction();
      if (result.success) {
        setStatus({
          connected: result.connected,
          botUsername: result.botUsername,
          botConfigured: result.botConfigured,
        });
        setLinkInfo(null);
      }
    } catch {
      setError('Gagal memuat status Telegram.');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleCreateLink = async () => {
    setIsBusy(true);
    setError(null);
    setNotice(null);

    const result = await createTelegramLinkCodeAction();
    setIsBusy(false);

    if (!result.success) {
      setError(result.message ?? 'Gagal membuat tautan aktivasi.');
      return;
    }

    if (result.code && result.expiresAt) {
      setLinkInfo({
        code: result.code,
        deepLink: result.deepLink ?? null,
        expiresAt: result.expiresAt,
      });
    }
  };

  const handleDisconnect = async () => {
    setIsBusy(true);
    setError(null);
    setNotice(null);

    const result = await disconnectTelegramAction();
    setIsBusy(false);

    if (!result.success) {
      setError(result.message ?? 'Gagal memutus sambungan.');
      return;
    }

    setNotice('Sambungan Telegram diputus.');
    await refresh();
  };

  return (
    <section className={styles.card} aria-labelledby="telegram-settings-title">
      <div className={styles.header}>
        <h2 className={styles.title} id="telegram-settings-title">
          <span aria-hidden="true">✈️</span> Notifikasi Telegram
        </h2>

        {status && (
          <span
            className={
              status.connected ? `${styles.statusBadge} ${styles.statusOn}` : `${styles.statusBadge} ${styles.statusOff}`
            }
          >
            {status.connected ? '✅ Terhubung' : '⚪ Belum terhubung'}
          </span>
        )}
      </div>

      {status?.connected ? (
        <>
          <p className={styles.description}>
            Semua notifikasi akun Anda — setoran, pengajuan penarikan, dan status akun — akan
            dikirim otomatis ke Telegram yang terhubung. Kirim <code>/stop</code> di Telegram bila
            ingin memutus sambungan.
          </p>
          <div className={styles.actions}>
            <button
              type="button"
              className={`${styles.button} ${styles.buttonGhost}`}
              onClick={handleDisconnect}
              disabled={isBusy}
            >
              Putuskan sambungan
            </button>
          </div>
        </>
      ) : (
        <>
          <p className={styles.description}>
            Hubungkan akun Telegram Anda untuk menerima notifikasi Bank Sampah Digital, mulai dari
            setoran sampah hingga status pengajuan penarikan.
          </p>

          {status?.botUsername && (
            <ol className={styles.steps}>
              <li>Klik &ldquo;Buat tautan aktivasi&rdquo; di bawah.</li>
              <li>
                Buka tautan yang muncul di dalam aplikasi Telegram (dari akun Telegram Anda
                sendiri).
              </li>
              <li>Telegram akan otomatis terhubung ke akun ini.</li>
            </ol>
          )}

          <div className={styles.actions}>
            <button
              type="button"
              className={`${styles.button} ${styles.buttonPrimary}`}
              onClick={handleCreateLink}
              disabled={isBusy || !status?.botUsername}
            >
              {isBusy ? 'Membuat tautan...' : 'Buat tautan aktivasi'}
            </button>
          </div>

          {!status?.botUsername && status !== null && (
            <div className={`${styles.alert} ${styles.alertInfo}`}>
              Fitur Telegram belum dikonfigurasi di server. Hubungi admin untuk bantuan.
            </div>
          )}

          {linkInfo && (
            <div className={styles.codeBox}>
              <p className={styles.codeLabel}>Kode aktivasi (berlaku sekali, 30 menit):</p>
              <p className={styles.codeValue}>{linkInfo.code}</p>
              {linkInfo.deepLink && (
                <a
                  className={styles.deepLink}
                  href={linkInfo.deepLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {linkInfo.deepLink}
                </a>
              )}
              <p className={styles.expiry}>
                Berlaku sampai{' '}
                {new Date(linkInfo.expiresAt).toLocaleString('id-ID', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
                .
              </p>
            </div>
          )}
        </>
      )}

      {notice && <div className={`${styles.alert} ${styles.alertInfo}`}>{notice}</div>}
      {error && <div className={`${styles.alert} ${styles.alertError}`}>{error}</div>}
    </section>
  );
}