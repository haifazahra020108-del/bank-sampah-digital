'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { loadReportDataAction } from '@/app/actions/report';
import { Button } from '@/components/Button/Button';
import styles from './report.module.css';

interface ReportDashboardProps {
  filterOptions: {
    categories: { id: string; name: string }[];
    members: { id: string; name: string; email: string }[];
  };
}

type ReportData = NonNullable<Awaited<ReturnType<typeof loadReportDataAction>>['data']>;

function formatCurrency(v: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v);
}

export function ReportDashboard({ filterOptions }: ReportDashboardProps) {
  // Filters State
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [categoryId, setCategoryId] = useState('ALL');
  const [memberId, setMemberId] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState('');

  // Fetch Data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    const res = await loadReportDataAction({ startDate, endDate, categoryId, memberId, status }, page);
    if (res.success && res.data) {
      setData(res.data);
    } else {
      setError(res.error ?? 'Error loading data');
    }
    setLoading(false);
  }, [startDate, endDate, categoryId, memberId, status, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Export CSV
  const handleExportCSV = () => {
    if (!data || !data.transactions || data.transactions.length === 0) {
      alert('Tidak ada data untuk diekspor.');
      return;
    }

    const headers = ['ID', 'Tanggal', 'Anggota', 'Email', 'Jenis Sampah', 'Berat (kg)', 'Harga/kg (Rp)', 'Total (Rp)', 'Status', 'Dicatat Oleh'];
    
    // We only export the currently fetched page data, or ideally we should fetch all data for export,
    // but for simplicity and performance in this phase, we export the current view.
    // If we want full export, we'd need a separate server action without pagination limit.
    const csvRows = [];
    csvRows.push(headers.join(','));

    for (const row of data.transactions) {
      const date = new Date(row.date).toLocaleDateString('id-ID');
      const values = [
        row.id,
        `"${date}"`,
        `"${row.memberName}"`,
        `"${row.memberEmail}"`,
        `"${row.categoryName}"`,
        row.weight,
        row.pricePerKgSnapshot,
        row.totalValue,
        row.status,
        `"${row.createdByName}"`
      ];
      csvRows.push(values.join(','));
    }

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `laporan-transaksi-${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={styles.reportContainer} style={{ position: 'relative' }}>
      {loading && (
        <div className={styles.loadingOverlay}>
          Memuat Data...
        </div>
      )}

      {error && <div style={{ color: 'red', fontWeight: 'bold' }}>{error}</div>}

      {/* ─── FILTERS ─── */}
      <div className={styles.filterCard}>
        <div className={styles.filterHeader}>
          <h2 className={styles.filterTitle}>🔍 Filter Laporan</h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button variant="secondary" onClick={() => {
              setStartDate(''); setEndDate(''); setCategoryId('ALL'); setMemberId('ALL'); setStatus('ALL'); setPage(1);
            }}>Reset</Button>
          </div>
        </div>
        <div className={styles.filterGrid}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Mulai Tanggal</label>
            <input type="date" className={styles.formInput} value={startDate} onChange={e => {setStartDate(e.target.value); setPage(1);}} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Sampai Tanggal</label>
            <input type="date" className={styles.formInput} value={endDate} onChange={e => {setEndDate(e.target.value); setPage(1);}} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Jenis Sampah</label>
            <select className={styles.formSelect} value={categoryId} onChange={e => {setCategoryId(e.target.value); setPage(1);}}>
              <option value="ALL">Semua Kategori</option>
              {filterOptions.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Anggota</label>
            <select className={styles.formSelect} value={memberId} onChange={e => {setMemberId(e.target.value); setPage(1);}}>
              <option value="ALL">Semua Anggota</option>
              {filterOptions.members.map(m => <option key={m.id} value={m.id}>{m.name} ({m.email})</option>)}
            </select>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Status Transaksi</label>
            <select className={styles.formSelect} value={status} onChange={e => {setStatus(e.target.value); setPage(1);}}>
              <option value="ALL">Semua Status</option>
              <option value="COMPLETED">Selesai</option>
              <option value="CANCELLED">Dibatalkan</option>
            </select>
          </div>
        </div>
      </div>

      {/* ─── SUMMARY CARDS ─── */}
      <div className={styles.summaryGrid}>
        <div className={styles.statCard} style={{ borderTopColor: '#3b82f6' }}>
          <span className={styles.statCardTitle}>Total Transaksi</span>
          <span className={styles.statCardValue}>{data?.aggregates.totalTransactions ?? 0}</span>
        </div>
        <div className={styles.statCard} style={{ borderTopColor: '#10b981' }}>
          <span className={styles.statCardTitle}>Total Nilai Transaksi</span>
          <span className={styles.statCardValue}>{formatCurrency(data?.aggregates.totalValue ?? 0)}</span>
        </div>
        <div className={styles.statCard} style={{ borderTopColor: '#f59e0b' }}>
          <span className={styles.statCardTitle}>Total Berat Sampah</span>
          <span className={styles.statCardValue}>{(data?.aggregates.totalWeight ?? 0).toFixed(1)} kg</span>
        </div>
      </div>

      {/* ─── CATEGORY BREAKDOWN ─── */}
      <div className={styles.breakdownCard}>
        <h2 className={styles.breakdownTitle}>📊 Rekap per Jenis Sampah</h2>
        {data?.aggregates.categoryBreakdown.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>Tidak ada data pada periode ini.</p>
        ) : (
          <div className={styles.breakdownList}>
            {data?.aggregates.categoryBreakdown.map((c) => (
              <div key={c.categoryId} className={styles.breakdownItem}>
                <span className={styles.breakdownName}>{c.categoryName}</span>
                <div className={styles.breakdownStats}>
                  <span className={styles.breakdownWeight}>{c.totalWeight} {c.unit}</span>
                  <span className={styles.breakdownValue}>{formatCurrency(c.totalValue)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── TRANSACTIONS TABLE ─── */}
      <div className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <h2 className={styles.tableTitle}>📜 Detail Transaksi (Halaman {page})</h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button variant="secondary" onClick={handleExportCSV}>⬇️ Export CSV</Button>
            <Button variant="secondary" onClick={handlePrint}>🖨️ Cetak PDF</Button>
          </div>
        </div>
        <div className={styles.tableResponsive}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Anggota</th>
                <th>Jenis Sampah</th>
                <th>Berat</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data?.transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    Tidak ada transaksi yang cocok dengan filter.
                  </td>
                </tr>
              ) : (
                data?.transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td>{new Date(tx.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{tx.memberName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{tx.memberEmail}</div>
                    </td>
                    <td>{tx.categoryName}</td>
                    <td>{tx.weight} {tx.unit}</td>
                    <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{formatCurrency(tx.totalValue)}</td>
                    <td>{tx.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {data?.pagination && data.pagination.totalPages > 1 && (
          <div className={styles.pagination}>
            <span className={styles.pageInfo}>
              Menampilkan {data.transactions.length} data. Total halaman: {data.pagination.totalPages}
            </span>
            <div className={styles.pageControls}>
              <Button 
                variant="secondary" 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                ← Prev
              </Button>
              <Button 
                variant="secondary" 
                onClick={() => setPage(p => Math.min(data.pagination.totalPages, p + 1))}
                disabled={page === data.pagination.totalPages}
              >
                Next →
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
