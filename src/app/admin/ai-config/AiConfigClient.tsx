'use client';

import React, { useState, useTransition } from 'react';
import styles from './ai-config.module.css';
import {
  activateAiConfigAction,
  fetchProviderModelsAction,
  getAiConfigDataAction,
  saveAiConfigAction,
  testAiConnectionAction,
  type AiConfigPageData,
} from '@/app/actions/ai-config';
import type { ConnectionTestResult, ModelOption } from '@/services/ai-providers';

interface AiConfigClientProps {
  initialData: AiConfigPageData;
}

export function AiConfigClient({ initialData }: AiConfigClientProps) {
  const [data, setData] = useState<AiConfigPageData>(initialData);
  const [isPending, startTransition] = useTransition();

  // Form State
  const [selectedProvider, setSelectedProvider] = useState<'groq' | 'nvidia' | 'gemini'>('groq');
  const [configName, setConfigName] = useState<string>(
    initialData.active.name || 'Konfigurasi Utama'
  );
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [useExistingKey, setUseExistingKey] = useState<boolean>(
    Boolean(initialData.active.maskedKey)
  );

  const [modelPrimary, setModelPrimary] = useState<string>(
    initialData.active.modelPrimary
  );
  const [modelFallback, setModelFallback] = useState<string>(
    initialData.active.modelFallback || ''
  );
  const [baseUrl, setBaseUrl] = useState<string>(initialData.active.baseUrl);
  const [isCustomModel, setIsCustomModel] = useState<boolean>(false);

  const [temperature, setTemperature] = useState<number>(
    initialData.active.temperature ?? 0.7
  );
  const [maxTokens, setMaxTokens] = useState<number>(
    initialData.active.maxTokens ?? 2048
  );
  const [timeoutSeconds, setTimeoutSeconds] = useState<number>(
    Math.round((initialData.active.timeoutMs ?? 45000) / 1000)
  );

  // Live models cache per provider
  const [modelsByProvider, setModelsByProvider] = useState<Record<string, ModelOption[]>>({
    groq: initialData.supportedProviders.find((p) => p.id === 'groq')?.curatedModels || [],
  });
  const [isFetchingModels, setIsFetchingModels] = useState<boolean>(false);

  // Test Connection State
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [isTesting, setIsTesting] = useState<boolean>(false);

  // Alert Feedback
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const currentProviderDef = data.supportedProviders.find((p) => p.id === selectedProvider);
  const availableModels = modelsByProvider[selectedProvider] || currentProviderDef?.curatedModels || [];

  const handleProviderChange = (providerId: 'groq' | 'nvidia' | 'gemini') => {
    setSelectedProvider(providerId);
    setTestResult(null);

    const providerDef = data.supportedProviders.find((p) => p.id === providerId);
    if (providerDef) {
      setModelPrimary(providerDef.defaultPrimary);
      setModelFallback(providerDef.defaultFallback || '');
      setBaseUrl(providerDef.baseUrl);
      setIsCustomModel(false);
    }

    // Cek apakah ada record aktif untuk provider ini di daftar yang tersimpan atau di bootstrap env
    const hasExistingForProvider = data.allConfigs.some(
      (c) => c.provider === providerId && Boolean(c.maskedKey)
    );
    const hasBootstrapForProvider =
      providerId === data.active.provider &&
      data.active.source === 'BOOTSTRAP_ENV' &&
      Boolean(data.active.maskedKey);

    setUseExistingKey(hasExistingForProvider || hasBootstrapForProvider);
    setApiKeyInput('');
  };

  const existingDbRecordForProvider = data.allConfigs.find(
    (c) => c.provider === selectedProvider && Boolean(c.maskedKey)
  );
  const hasDatabaseRecordForProvider = Boolean(existingDbRecordForProvider);
  const isBootstrapForProvider =
    !hasDatabaseRecordForProvider &&
    selectedProvider === data.active.provider &&
    data.active.source === 'BOOTSTRAP_ENV' &&
    Boolean(data.active.maskedKey);


  const handleFetchModels = async () => {
    setIsFetchingModels(true);
    setFeedback(null);

    try {
      const res = await fetchProviderModelsAction({
        provider: selectedProvider,
        apiKeyInput: apiKeyInput.trim() || undefined,
        useExistingKey,
        configId: data.active.id || undefined,
      });

      if (res.success && res.models && res.models.length > 0) {
        setModelsByProvider((prev) => ({
          ...prev,
          [selectedProvider]: res.models!,
        }));
        setFeedback({
          type: 'success',
          message: res.isLive
            ? `Berhasil memuat ${res.models.length} model langsung dari API ${currentProviderDef?.name}.`
            : `Daftar model kurasi siap digunakan (${res.error || 'mode kurasi'}).`,
        });
      } else {
        setFeedback({
          type: 'error',
          message: res.error || 'Gagal memuat daftar model dari provider.',
        });
      }
    } catch {
      setFeedback({
        type: 'error',
        message: 'Gagal terhubung saat memuat model.',
      });
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    setFeedback(null);

    try {
      const res = await testAiConnectionAction({
        provider: selectedProvider,
        apiKeyInput: apiKeyInput.trim() || undefined,
        useExistingKey,
        configId: data.active.id || undefined,
        baseUrl,
        modelPrimary,
        modelFallback: modelFallback.trim() || null,
        timeoutMs: timeoutSeconds * 1000,
      });

      if (res.success && res.result) {
        setTestResult(res.result);
      } else {
        setFeedback({
          type: 'error',
          message: res.error || 'Pengujian koneksi gagal dijalankan.',
        });
      }
    } catch {
      setFeedback({
        type: 'error',
        message: 'Terjadi kesalahan sistem saat menguji koneksi.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const reloadData = async () => {
    const res = await getAiConfigDataAction();
    if (res.success && res.data) {
      setData(res.data);
    }
  };

  const handleSave = async (activateImmediately: boolean) => {
    setFeedback(null);

    if (!modelPrimary || modelPrimary.trim().length === 0) {
      setFeedback({ type: 'error', message: 'Model utama wajib dipilih.' });
      return;
    }

    if (!useExistingKey && (!apiKeyInput || apiKeyInput.trim().length === 0)) {
      setFeedback({ type: 'error', message: 'API Key wajib diisi untuk konfigurasi baru.' });
      return;
    }

    startTransition(async () => {
      try {
        const res = await saveAiConfigAction({
          name: configName.trim() || `Konfigurasi ${selectedProvider.toUpperCase()}`,
          provider: selectedProvider,
          rawApiKey: apiKeyInput.trim() || undefined,
          useExistingKey,
          modelPrimary: modelPrimary.trim(),
           modelFallback: modelFallback.trim() || null,
           baseUrl,
           temperature,
          maxTokens,
          timeoutMs: timeoutSeconds * 1000,
          activateImmediately,
        });

        if (res.success && res.data) {
          setFeedback({
            type: 'success',
            message: res.message || 'Konfigurasi berhasil disimpan.',
          });
          setApiKeyInput('');
          setUseExistingKey(true);
          await reloadData();
        } else {
          setFeedback({
            type: 'error',
            message: res.error || 'Gagal menyimpan konfigurasi.',
          });
        }
      } catch {
        setFeedback({
          type: 'error',
          message: 'Terjadi kesalahan sistem saat menyimpan konfigurasi.',
        });
      }
    });
  };

  const handleActivateSaved = async (configId: string) => {
    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await activateAiConfigAction(configId);
        if (res.success) {
          setFeedback({
            type: 'success',
            message: res.message || 'Konfigurasi aktif berhasil diganti.',
          });
          await reloadData();
        } else {
          setFeedback({
            type: 'error',
            message: res.error || 'Gagal mengaktifkan konfigurasi.',
          });
        }
      } catch {
        setFeedback({
          type: 'error',
          message: 'Terjadi kesalahan sistem saat mengaktifkan konfigurasi.',
        });
      }
    });
  };

  const handleResetToActive = () => {
    setSelectedProvider('groq');
    setConfigName(data.active.name || 'Konfigurasi Utama');
    setModelPrimary(data.active.modelPrimary);
     setModelFallback(data.active.modelFallback || '');
     setBaseUrl(data.active.baseUrl);
    setTemperature(data.active.temperature ?? 0.7);
    setMaxTokens(data.active.maxTokens ?? 2048);
    setTimeoutSeconds(Math.round((data.active.timeoutMs ?? 45000) / 1000));
    setUseExistingKey(Boolean(data.active.maskedKey));
    setApiKeyInput('');
    setTestResult(null);
    setFeedback({
      type: 'success',
      message: 'Formulir dikembalikan ke konfigurasi aktif saat ini.',
    });
  };

  return (
    <div>
      {/* Alert Banner */}
      {feedback && (
        <div
          className={`${styles.feedbackBanner} ${
            feedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError
          }`}
        >
          <span>{feedback.message}</span>
          <button
            onClick={() => setFeedback(null)}
            style={{ fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Grid: Active Overview */}
      <div className={styles.gridContainer}>
        <section className={styles.card} aria-label="Status Konfigurasi Aktif">
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>
                <span>🤖</span> Status Konfigurasi AI Aktif
              </h2>
              <p className={styles.cardDescription}>
                Konfigurasi yang sedang digunakan secara live oleh seluruh permintaan AI Assistant aplikasi.
              </p>
            </div>
            <div className={styles.statusPill}>
              <span className={`${styles.statusDot} ${styles.statusDotActive}`} />
              <span>
                {data.active.source === 'DATABASE' ? 'Aktif (Database)' : 'Aktif (Bootstrap .env)'}
              </span>
            </div>
          </div>

          <div className={styles.overviewGrid}>
            <div className={styles.overviewItem}>
              <div className={styles.overviewLabel}>Provider Aktif</div>
              <div className={styles.overviewValue}>
                {data.active.provider.toUpperCase()}
              </div>
            </div>
            <div className={styles.overviewItem}>
              <div className={styles.overviewLabel}>Model Utama (Primary)</div>
              <div className={styles.overviewValue}>
                <span className={styles.codePill}>{data.active.modelPrimary}</span>
              </div>
            </div>
            <div className={styles.overviewItem}>
              <div className={styles.overviewLabel}>Model Cadangan (Fallback)</div>
              <div className={styles.overviewValue}>
                {data.active.modelFallback ? (
                  <span className={styles.codePill}>{data.active.modelFallback}</span>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>Tidak ada</span>
                )}
              </div>
            </div>
            <div className={styles.overviewItem}>
              <div className={styles.overviewLabel}>Kredensial API Key</div>
              <div className={styles.overviewValue}>
                {data.active.maskedKey ? (
                  <span className={styles.codePill}>{data.active.maskedKey}</span>
                ) : (
                  <span style={{ color: '#ef4444' }}>Belum diset</span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Card: Configuration Center Form */}
        <section className={styles.card} aria-label="Pusat Konfigurasi AI">
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>
                <span>⚙️</span> Kelola Provider & Kredensial AI
              </h2>
              <p className={styles.cardDescription}>
                Pilih provider, atur model, uji koneksi, dan terapkan perubahan secara langsung tanpa restart server.
              </p>
            </div>
          </div>

          {/* Provider Selection Tabs */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Pilih Provider AI</label>
            <div className={styles.providerTabs}>
              {data.supportedProviders.map((prov) => {
                const isSelected = selectedProvider === prov.id;
                return (
                  <button
                    type="button"
                    key={prov.id}
                    className={`${styles.providerTab} ${isSelected ? styles.providerTabActive : ''}`}
                    onClick={() => handleProviderChange(prov.id)}
                  >
                    <div className={styles.providerTabTitle}>
                      <span>{prov.name}</span>
                      {isSelected && <span style={{ color: 'var(--primary)', fontSize: '0.9rem' }}>✓ Dipilih</span>}
                    </div>
                    <p className={styles.providerTabDesc}>{prov.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Configuration Name */}
          <div className={styles.formGroup}>
            <label htmlFor="config-name-input" className={styles.formLabel}>
              Label Konfigurasi
            </label>
            <input
              id="config-name-input"
              type="text"
              className={styles.input}
              value={configName}
              onChange={(e) => setConfigName(e.target.value)}
              placeholder="Contoh: Produksi Groq Llama 3.3"
            />
          </div>

          {/* API Key Input */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>API Key Provider</label>

            {/* Mode Selector jika key lama sudah ada */}
            <div className={styles.keyModeSelector}>
              <label className={styles.radioOption}>
                <input
                  type="radio"
                  name="keyMode"
                  checked={useExistingKey}
                  onChange={() => setUseExistingKey(true)}
                />
                <span>Pertahankan API Key yang tersimpan</span>
              </label>

              <label className={styles.radioOption}>
                <input
                  type="radio"
                  name="keyMode"
                  checked={!useExistingKey}
                  onChange={() => setUseExistingKey(false)}
                />
                <span>Ganti / Masukkan API Key baru</span>
              </label>
            </div>

            {useExistingKey ? (
              hasDatabaseRecordForProvider ? (
                <div className={styles.savedKeyBadge}>
                  <span>🔒</span>
                  <div>
                    <strong>Sumber Kredensial: Tersimpan di Database</strong>
                    <div style={{ fontSize: '0.8rem', marginTop: '0.2rem', color: 'var(--foreground)' }}>
                      API Key tersimpan aman dengan enkripsi AES-256-GCM (topeng: <code className={styles.codePill}>{existingDbRecordForProvider?.maskedKey}</code>). Tidak perlu memasukkan ulang.
                    </div>
                  </div>
                </div>
              ) : isBootstrapForProvider ? (
                <div
                  className={styles.savedKeyBadge}
                  style={{
                    backgroundColor: 'rgba(245, 158, 11, 0.08)',
                    borderColor: 'rgba(245, 158, 11, 0.3)',
                    color: '#d97706',
                  }}
                >
                  <span>⚡</span>
                  <div>
                    <strong>Sumber Kredensial: Bootstrap Environment (.env.local)</strong>
                    <div style={{ fontSize: '0.8rem', marginTop: '0.2rem', color: 'var(--foreground)' }}>
                      Key aktif saat ini bertopeng <code className={styles.codePill}>{data.active.maskedKey}</code>.
                      Penyimpanan pertama akan mengenkripsi (AES-256-GCM) dan menyimpan kredensial ini ke database tanpa mengekspos kunci asli.
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className={styles.savedKeyBadge}
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    borderColor: 'rgba(239, 68, 68, 0.3)',
                    color: '#dc2626',
                  }}
                >
                  <span>⚠️</span>
                  <span>
                    Belum ada API Key tersimpan untuk provider {currentProviderDef?.name}. Silakan pilih &quot;Ganti / Masukkan API Key baru&quot;.
                  </span>
                </div>
              )
            ) : (
              <div className={styles.inputWrapper}>
                <input
                  type={showApiKey ? 'text' : 'password'}
                  className={`${styles.input} ${styles.inputPassword}`}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder={`Masukkan API key ${currentProviderDef?.name || ''}...`}
                  autoComplete="off"
                />
                <button
                  type="button"
                  className={styles.eyeButton}
                  onClick={() => setShowApiKey(!showApiKey)}
                  title={showApiKey ? 'Sembunyikan' : 'Tampilkan'}
                  aria-label="Toggle tampilkan API Key"
                >
                  {showApiKey ? '👁️' : '🔒'}
                </button>
              </div>
            )}

            <div className={styles.securityNotice}>
              <span style={{ fontSize: '1.1rem' }}>🛡️</span>
              <div>
                <strong>Keamanan Terjamin:</strong> API Key disimpan secara authenticated menggunakan enkripsi{' '}
                <strong>AES-256-GCM</strong> dengan kunci server terpisah. Key rahasia tidak pernah dikirim ke frontend, tidak
                disimpan di log, dan tidak dicatat di riwayat percakapan.
              </div>
            </div>
          </div>

          {/* Base URL Selection */}
          <div className={styles.formGroup}>
            <label htmlFor="base-url-select" className={styles.formLabel}>
              Base URL Provider
            </label>
            <input
              id="base-url-input"
              type="text"
              className={styles.input}
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://..."
            />
            <p className={styles.formHint}>
              Hanya endpoint resmi provider yang diizinkan.
            </p>
          </div>

          {/* Model Selection */}
          <div className={styles.formGroup}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0.45rem',
              }}
            >
              <label htmlFor="model-select" className={styles.formLabel} style={{ marginBottom: 0 }}>
                Model Utama (Primary Model)
              </label>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={handleFetchModels}
                disabled={isFetchingModels}
                title="Muat daftar model dari endpoint provider"
              >
                {isFetchingModels ? <span className={styles.spinner} /> : '🔄'}
                <span>{isFetchingModels ? 'Memuat Model...' : 'Muat Model dari Provider'}</span>
              </button>
            </div>

            {!isCustomModel ? (
              <div className={styles.modelSelectorRow}>
                <select
                  id="model-select"
                  className={styles.select}
                  value={modelPrimary}
                  onChange={(e) => {
                    if (e.target.value === '__custom__') {
                      setIsCustomModel(true);
                      setModelPrimary('');
                    } else {
                      setModelPrimary(e.target.value);
                    }
                  }}
                >
                  {availableModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label} {m.isRecommended ? '⭐' : ''}
                    </option>
                  ))}
                  <option value="__custom__">➕ Masukkan Model Kustom...</option>
                </select>
              </div>
            ) : (
              <div className={styles.modelSelectorRow}>
                <input
                  type="text"
                  className={styles.input}
                  value={modelPrimary}
                  onChange={(e) => setModelPrimary(e.target.value)}
                  placeholder="Ketik ID model kustom (contoh: meta/llama-3.3-70b-instruct)..."
                />
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => setIsCustomModel(false)}
                >
                  Pilih dari Daftar
                </button>
              </div>
            )}
            <p className={styles.formHint}>
              Model yang dipilih akan memproses percakapan edukasi, pemilahan, dan pertanyaan analitis Bank Sampah.
            </p>
          </div>

          {/* Fallback Model */}
          <div className={styles.formGroup}>
            <label htmlFor="fallback-model-select" className={styles.formLabel}>
              Model Cadangan / Fallback (Opsional)
            </label>
            <select
              id="fallback-model-select"
              className={styles.select}
              value={modelFallback}
              onChange={(e) => setModelFallback(e.target.value)}
            >
              <option value="">(Tanpa Model Cadangan)</option>
              {availableModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            <p className={styles.formHint}>
              Digunakan otomatis jika model utama mengalami transient error (timeout atau rate limit).
            </p>
          </div>

          {/* Advanced Parameters Accordion */}
          <details className={styles.accordion}>
            <summary className={styles.accordionSummary}>
              <span>⚙️ Parameter Inferensi Tingkat Lanjut</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Klik untuk membuka</span>
            </summary>
            <div className={styles.accordionBody}>
              <div>
                <label className={styles.formLabel}>Temperature: {temperature}</label>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  style={{ width: '100%' }}
                />
                <span className={styles.formHint}>0.1 = Presisi, 0.7 = Seimbang, 1.0 = Kreatif</span>
              </div>
              <div>
                <label htmlFor="max-tokens-input" className={styles.formLabel}>
                  Maksimum Token Output
                </label>
                <input
                  id="max-tokens-input"
                  type="number"
                  className={styles.input}
                  min={256}
                  max={8192}
                  step={256}
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(parseInt(e.target.value, 10) || 2048)}
                />
                <span className={styles.formHint}>Standar: 2048 token</span>
              </div>
              <div>
                <label htmlFor="timeout-seconds-input" className={styles.formLabel}>
                  Batas Waktu (Timeout Detik)
                </label>
                <input
                  id="timeout-seconds-input"
                  type="number"
                  className={styles.input}
                  min={5}
                  max={120}
                  step={5}
                  value={timeoutSeconds}
                  onChange={(e) => setTimeoutSeconds(parseInt(e.target.value, 10) || 45)}
                />
                <span className={styles.formHint}>Standar: 45 detik</span>
              </div>
            </div>
          </details>

          {/* Test Connection Section */}
          <div className={styles.testSection}>
            <div className={styles.testRow}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                  🧪 Uji Koneksi & Model
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Kirim probe ringan ke provider untuk memastikan kredensial dan model valid sebelum diterapkan.
                </p>
              </div>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={handleTestConnection}
                disabled={isTesting}
                style={{ padding: '0.65rem 1.25rem', borderColor: '#3b82f6', color: '#2563eb' }}
              >
                {isTesting ? <span className={styles.spinner} /> : '🚀'}
                <span>{isTesting ? 'Menguji Koneksi...' : 'Uji Koneksi Sekarang'}</span>
              </button>
            </div>

            {testResult && (
              <div
                className={`${styles.testResultBox} ${
                  testResult.success ? styles.testResultSuccess : styles.testResultError
                }`}
              >
                <span style={{ fontSize: '1.25rem' }}>{testResult.success ? '✅' : '❌'}</span>
                <div>
                  <div style={{ fontWeight: 700 }}>
                    {testResult.success ? 'Koneksi Berhasil' : 'Pengujian Gagal'} (
                    {testResult.status}) — {testResult.latencyMs}ms
                  </div>
                  <div>{testResult.message}</div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons Footer */}
          <div className={styles.actionFooter}>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={handleResetToActive}
              disabled={isPending}
            >
              🔄 Batalkan Perubahan
            </button>

            <button
              type="button"
              className={styles.draftBtn}
              onClick={() => handleSave(false)}
              disabled={isPending || isTesting}
            >
              📝 Simpan sebagai Draft
            </button>

            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => handleSave(true)}
              disabled={isPending || isTesting}
            >
              {isPending ? <span className={styles.spinner} /> : '💾'}
              <span>{isPending ? 'Menyimpan...' : 'Simpan & Terapkan Langsung'}</span>
            </button>
          </div>
        </section>

        {/* Card: Configuration History / Rollback Presets */}
        <section className={styles.card} aria-label="Riwayat Konfigurasi & Rollback">
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>
                <span>📜</span> Riwayat & Preset Konfigurasi
              </h2>
              <p className={styles.cardDescription}>
                Daftar konfigurasi yang tersimpan di database. Anda dapat mengaktifkan konfigurasi lama sewaktu-waktu
                (fitur rollback instan).
              </p>
            </div>
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nama / Label</th>
                  <th>Provider</th>
                  <th>Model Utama</th>
                  <th>Kredensial</th>
                  <th>Status Tes</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {data.allConfigs.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      Belum ada konfigurasi tersimpan di database. Sistem saat ini berjalan dengan Bootstrap Environment.
                    </td>
                  </tr>
                ) : (
                  data.allConfigs.map((cfg) => (
                    <tr key={cfg.id} className={cfg.isActive ? styles.tableRowActive : ''}>
                      <td style={{ fontWeight: 600 }}>{cfg.name}</td>
                      <td>
                        <span className={styles.codePill}>{cfg.provider.toUpperCase()}</span>
                      </td>
                      <td>
                        <span className={styles.codePill}>{cfg.modelPrimary}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {cfg.maskedKey || 'Belum diset'}
                        </span>
                      </td>
                      <td>
                        {cfg.testStatus === 'SUCCESS' ? (
                          <span className={`${styles.badge} ${styles.badgeSuccess}`}>
                            ✓ {cfg.testLatencyMs}ms
                          </span>
                        ) : cfg.testStatus === 'FAILED' ? (
                          <span className={`${styles.badge} ${styles.badgeDanger}`}>Gagal</span>
                        ) : (
                          <span className={`${styles.badge} ${styles.badgeNeutral}`}>Belum Dites</span>
                        )}
                      </td>
                      <td>
                        {cfg.isActive ? (
                          <span className={`${styles.badge} ${styles.badgeSuccess}`}>● Aktif</span>
                        ) : (
                          <span className={`${styles.badge} ${styles.badgeNeutral}`}>Draft</span>
                        )}
                      </td>
                      <td>
                        {!cfg.isActive && (
                          <button
                            type="button"
                            className={styles.activateBtn}
                            onClick={() => handleActivateSaved(cfg.id)}
                            disabled={isPending}
                            title="Aktifkan konfigurasi ini sekarang tanpa restart"
                          >
                            ⚡ Aktifkan
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
