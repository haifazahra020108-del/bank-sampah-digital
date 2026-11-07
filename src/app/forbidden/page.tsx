import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/Button/Button';

export default function ForbiddenPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
      textAlign: 'center',
      backgroundColor: 'var(--background)',
      color: 'var(--foreground)'
    }}>
      <h1 style={{ fontSize: '3rem', fontWeight: 'bold', color: 'var(--danger)', marginBottom: '1rem' }}>
        403 - Akses Ditolak
      </h1>
      <p style={{ marginBottom: '2rem', color: 'var(--text-muted)' }}>
        Maaf, Anda tidak memiliki izin untuk mengakses halaman ini.
      </p>
      <Link href="/dashboard">
        <Button variant="primary">Kembali ke Dashboard</Button>
      </Link>
    </div>
  );
}
