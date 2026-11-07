'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import styles from './member.module.css';
import { Button } from '@/components/Button/Button';
import { MemberModal } from './MemberModal';
import { ResetPasswordModal } from './ResetPasswordModal';
import { toggleMemberStatusAction } from '@/app/actions/member';

interface Member {
  id: string;
  name: string;
  email: string;
  contact: string | null;
  address: string | null;
  status: string;
  createdAt: string;
  balance: number;
  totalWeight: number;
}

interface MemberListProps {
  members: Member[];
  isAdmin: boolean;
  basePath: string; // '/admin/anggota' or '/pengelola/anggota'
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function MemberList({ members, isAdmin, basePath }: MemberListProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [resetMember, setResetMember] = useState<{ id: string; name: string; email: string } | null>(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  function handleAdd() {
    setEditingMember(null);
    setIsModalOpen(true);
  }

  function handleEdit(member: Member) {
    setEditingMember(member);
    setIsModalOpen(true);
  }

  function handleResetPassword(member: Member) {
    setResetMember({ id: member.id, name: member.name, email: member.email });
    setIsResetModalOpen(true);
  }

  function handleViewDetail(id: string) {
    router.push(`${basePath}/${id}`);
  }

  async function handleToggleStatus(id: string, currentStatus: string) {
    const isActive = currentStatus === 'ACTIVE';
    const confirmMsg = isActive
      ? 'Nonaktifkan anggota ini? Anggota tidak dapat login dan melakukan transaksi baru.'
      : 'Aktifkan kembali anggota ini?';

    if (!confirm(confirmMsg)) return;

    setTogglingId(id);
    const result = await toggleMemberStatusAction(id, currentStatus);
    setTogglingId(null);

    if (!result.success) {
      alert(result.message);
    }
  }

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value);
    startTransition(() => {
      const params = new URLSearchParams(window.location.search);
      if (e.target.value) {
        params.set('search', e.target.value);
      } else {
        params.delete('search');
      }
      router.push(`${window.location.pathname}?${params.toString()}`);
    });
  }

  return (
    <div className={styles.container}>
      <div className={styles.searchBar}>
        <input
          className={styles.searchInput}
          type="search"
          placeholder="🔍 Cari nama atau email anggota..."
          value={search}
          onChange={handleSearch}
          id="member-search"
        />
        {isAdmin && (
          <Button variant="primary" onClick={handleAdd} id="btn-tambah-anggota">
            + Tambah Anggota
          </Button>
        )}
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Anggota</th>
              <th>Kontak</th>
              <th>Saldo</th>
              <th>Total Sampah</th>
              <th>Bergabung</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}
                >
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>👥</div>
                  <div>Belum ada anggota yang terdaftar.</div>
                </td>
              </tr>
            ) : (
              members.map((member) => (
                <tr
                  key={member.id}
                  className={member.status !== 'ACTIVE' ? styles.inactive : ''}
                >
                  <td>
                    <span className={styles.boldCell}>{member.name}</span>
                    <span className={styles.subText}>{member.email}</span>
                  </td>
                  <td>{member.contact ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                  <td className={styles.numericCell}>
                    <span
                      style={{
                        color: member.balance >= 0 ? 'var(--primary)' : 'var(--danger)',
                        fontWeight: 600,
                      }}
                    >
                      {formatCurrency(member.balance)}
                    </span>
                  </td>
                  <td className={styles.numericCell}>{member.totalWeight.toFixed(2)} kg</td>
                  <td>{formatDate(member.createdAt)}</td>
                  <td>
                    <span
                      className={`${styles.badge} ${
                        member.status === 'ACTIVE' ? styles.badgeActive : styles.badgeInactive
                      }`}
                    >
                      {member.status === 'ACTIVE' ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <Button
                        variant="secondary"
                        onClick={() => handleViewDetail(member.id)}
                        id={`btn-detail-${member.id}`}
                      >
                        Detail
                      </Button>
                      {isAdmin && (
                        <>
                          <Button
                            variant="secondary"
                            onClick={() => handleResetPassword(member)}
                            id={`btn-reset-${member.id}`}
                            title="Reset password anggota"
                          >
                            🔑 Reset
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => handleEdit(member)}
                            id={`btn-edit-${member.id}`}
                          >
                            Edit
                          </Button>
                          <Button
                            variant={member.status === 'ACTIVE' ? 'danger' : 'primary'}
                            onClick={() => handleToggleStatus(member.id, member.status)}
                            id={`btn-toggle-${member.id}`}
                            disabled={togglingId === member.id}
                          >
                            {togglingId === member.id
                              ? '...'
                              : member.status === 'ACTIVE'
                              ? 'Nonaktifkan'
                              : 'Aktifkan'}
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isAdmin && isModalOpen && (
        <MemberModal
          key={editingMember?.id ?? 'new'}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          initialData={editingMember}
        />
      )}
      {isAdmin && isResetModalOpen && (
        <ResetPasswordModal
          key={resetMember?.id}
          isOpen={isResetModalOpen}
          onClose={() => setIsResetModalOpen(false)}
          member={resetMember}
        />
      )}
    </div>
  );
}
