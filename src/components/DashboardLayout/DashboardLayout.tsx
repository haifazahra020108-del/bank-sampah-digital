'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import styles from './DashboardLayout.module.css';
import { Button } from '@/components/Button/Button';
import { logoutAction } from '@/app/actions/auth';
import { SessionPayload } from '@/utils/session';
import { FloatingChatWidget } from '@/components/FloatingChatWidget/FloatingChatWidget';
import { NotificationBell } from '@/components/NotificationBell/NotificationBell';

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

interface DashboardLayoutProps {
  session: SessionPayload;
  currentPath: string;
  children: React.ReactNode;
}

function getNavItems(role: string, mustChangePassword?: boolean): NavItem[] {
  if (mustChangePassword) {
    return [{ href: '/dashboard/ganti-password', label: 'Ganti Password', icon: '🔑' }];
  }
  if (role === 'ADMIN') {
    return [
      { href: '/admin', label: 'Dashboard', icon: '📊' },
      { href: '/admin/anggota', label: 'Manajemen Anggota', icon: '👥' },
      { href: '/admin/kategori', label: 'Jenis Sampah', icon: '♻️' },
      { href: '/admin/laporan', label: 'Laporan', icon: '📋' },
      { href: '/admin/ai-config', label: 'Konfigurasi AI', icon: '⚙️' },
    ];
  }
  if (role === 'MANAGER') {
    return [
      { href: '/pengelola', label: 'Dashboard', icon: '📊' },
      { href: '/pengelola/setoran', label: 'Catat Setoran', icon: '📝' },
      { href: '/pengelola/penarikan', label: 'Proses Penarikan', icon: '💸' },
      { href: '/pengelola/anggota', label: 'Data Anggota', icon: '👥' },
    ];
  }
  return [
    { href: '/dashboard', label: 'Dashboard', icon: '🏠' },
    { href: '/dashboard/transaksi', label: 'Riwayat Transaksi', icon: '📜' },
    { href: '/dashboard/penarikan', label: 'Ajukan Penarikan', icon: '💰' },
  ];
}

function getRoleLabel(role: string) {
  if (role === 'ADMIN') return 'Admin';
  if (role === 'MANAGER') return 'Pengelola';
  return 'Anggota';
}

function getRoleBadgeClass(role: string) {
  if (role === 'ADMIN') return styles.badgeAdmin;
  if (role === 'MANAGER') return styles.badgeManager;
  return styles.badgeMember;
}

export function DashboardLayout({ session, currentPath, children }: DashboardLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navItems = getNavItems(session.role, session.mustChangePassword);
  const roleLabel = getRoleLabel(session.role);
  const initials = session.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <div className={styles.layout}>
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div className={styles.mobileOverlay} onClick={closeMobileMenu} />
      )}

      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${isMobileMenuOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.brand}>
          <span className={styles.brandIcon}>♻️</span>
          <div>
            <h2 className={styles.brandName}>Bank Sampah</h2>
            <p className={styles.brandSub}>Digital</p>
          </div>
        </div>

        <nav className={styles.nav}>
          {navItems.map((item) => {
            const isActive =
              item.href === '/admin' || item.href === '/pengelola' || item.href === '/dashboard'
                ? currentPath === item.href
                : currentPath.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                onClick={closeMobileMenu}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.userInfo}>
            <div className={`${styles.avatar} ${styles.avatarSidebar}`}>{initials}</div>
            <div className={styles.userMeta}>
              <p className={styles.userName}>{session.name}</p>
              <span className={`${styles.badge} ${getRoleBadgeClass(session.role)}`}>
                {roleLabel}
              </span>
            </div>
          </div>
          <form action={logoutAction} className={styles.logoutForm}>
            <Button type="submit" variant="danger" fullWidth>
              🚪 Keluar
            </Button>
          </form>
        </div>
      </aside>

      {/* Main Content */}
      <div className={styles.mainWrapper}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <button className={styles.mobileToggleBtn} onClick={toggleMobileMenu} aria-label="Toggle Menu">
              ☰
            </button>
            <div className={styles.topbarTitle}>
              {navItems.find((i) => i.href === currentPath)?.icon ??
                (currentPath === '/dashboard/ai' ? '🤖' : '')}{' '}
              {navItems.find((i) => i.href === currentPath)?.label ??
                (currentPath === '/dashboard/ai' ? 'Tanya AI' : 'Dashboard')}
            </div>
          </div>
          <div className={styles.topbarRight}>
            <NotificationBell />
            <Link href="/profil" className={styles.topbarUser}>
              <div className={styles.avatar}>{initials}</div>
              <div>
                <p className={styles.topbarName}>{session.name}</p>
                <p className={styles.topbarRole}>{roleLabel}</p>
              </div>
            </Link>
          </div>
        </header>

        <main className={styles.content}>{children}</main>
      </div>

      {/* Floating Chat Widget for Member and Admin */}
      {!session.mustChangePassword && (session.role === 'MEMBER' || session.role === 'ADMIN') && (
        <FloatingChatWidget
          userName={session.name}
          userId={session.userId}
          userRole={session.role}
          initialOpen={currentPath === '/dashboard/ai'}
        />
      )}
    </div>
  );
}
