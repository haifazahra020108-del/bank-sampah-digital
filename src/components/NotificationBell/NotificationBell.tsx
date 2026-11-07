'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  getNotificationsAction,
  markAsReadAction,
  markAllAsReadAction,
  type NotificationItem,
} from '@/app/actions/notification';
import styles from './NotificationBell.module.css';

function formatRelativeTime(dateInput: Date | string): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 45) return 'Baru saja';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} menit lalu`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} jam lalu`;
  if (diffSec < 172800) return 'Kemarin';

  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getNotificationIcon(type: string): { icon: string; bgClass: string } {
  switch (type) {
    case 'TRANSACTION':
      return { icon: '♻️', bgClass: styles.iconTransaction };
    case 'WITHDRAWAL':
      return { icon: '💳', bgClass: styles.iconWithdrawal };
    case 'MEMBER':
      return { icon: '👤', bgClass: styles.iconMember };
    default:
      return { icon: '🔔', bgClass: styles.iconSystem };
  }
}

export function NotificationBell() {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch notifications from server
  const fetchNotifications = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    try {
      const res = await getNotificationsAction();
      if (res.success) {
        setNotifications(res.notifications);
        setUnreadCount(res.unreadCount);
        setError(null);
      } else if (res.message && res.message !== 'Unauthorized') {
        setError(res.message);
      }
    } catch (err) {
      console.error('[NotificationBell] fetch error:', err);
      setError('Gagal memuat notifikasi');
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, []);

  // Initial fetch and polling every 10 seconds
  useEffect(() => {
    fetchNotifications(true);

    const interval = setInterval(() => {
      fetchNotifications(false);
    }, 10000);

    const handleFocus = () => {
      fetchNotifications(false);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchNotifications(false);
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchNotifications]);

  const isInitialMount = useRef(true);

  // Refresh when route/pathname changes (after initial mount)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    fetchNotifications(false);
  }, [pathname, fetchNotifications]);

  // Click outside to close & Escape key
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Toggle open
  const handleToggle = () => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    if (nextOpen) {
      fetchNotifications(false);
    }
  };

  // Mark all as read
  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0 || isMarkingAll) return;
    setIsMarkingAll(true);

    // Optimistic UI update
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);

    try {
      await markAllAsReadAction();
    } catch (err) {
      console.error('[handleMarkAllAsRead] error:', err);
      fetchNotifications(false);
    } finally {
      setIsMarkingAll(false);
    }
  };

  // Mark single item as read and optionally navigate
  const handleItemClick = async (item: NotificationItem, e: React.MouseEvent) => {
    // If clicking the single checkmark button, do not navigate
    const isCheckBtn = (e.target as HTMLElement).closest(`.${styles.markOneBtn}`);

    if (!item.isRead) {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      // Server update
      try {
        await markAsReadAction(item.id);
      } catch (err) {
        console.error('[handleItemClick] error:', err);
      }
    }

    if (isCheckBtn) return;

    if (item.link) {
      setIsOpen(false);
      router.push(item.link);
    }
  };

  return (
    <div className={styles.wrapper} ref={containerRef}>
      {/* Bell Button */}
      <button
        type="button"
        className={`${styles.bellBtn} ${isOpen ? styles.bellBtnActive : ''}`}
        onClick={handleToggle}
        aria-label={`Notifikasi ${unreadCount > 0 ? `(${unreadCount} belum dibaca)` : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        title="Notifikasi"
      >
        <svg
          className={styles.bellIcon}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>

        {unreadCount > 0 && (
          <span className={styles.badge} aria-label={`${unreadCount} notifikasi baru`}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <section
          className={styles.dropdown}
          role="dialog"
          aria-label="Panel Notifikasi"
        >
          {/* Header */}
          <header className={styles.header}>
            <div className={styles.headerLeft}>
              <h3 className={styles.title}>Notifikasi</h3>
              {unreadCount > 0 && (
                <span className={styles.unreadChip}>
                  {unreadCount} baru
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                className={styles.markAllBtn}
                onClick={handleMarkAllAsRead}
                disabled={isMarkingAll}
                title="Tandai semua notifikasi sudah dibaca"
              >
                {isMarkingAll ? 'Memproses...' : 'Tandai semua dibaca'}
              </button>
            )}
          </header>

          {/* List Area */}
          <div className={styles.listArea}>
            {isLoading ? (
              <div className={styles.loadingState}>
                <div className={styles.spinner}></div>
                <p>Memuat notifikasi...</p>
              </div>
            ) : error ? (
              <div className={styles.errorState}>
                <p>{error}</p>
                <button
                  type="button"
                  className={styles.retryBtn}
                  onClick={() => fetchNotifications(true)}
                >
                  Coba lagi
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon} aria-hidden="true">
                  🔔
                </div>
                <p className={styles.emptyTitle}>Belum ada notifikasi</p>
                <p className={styles.emptyDesc}>
                  Pemberitahuan terkait setoran sampah, pengajuan penarikan, dan akun Anda akan muncul di sini.
                </p>
              </div>
            ) : (
              <ul className={styles.list}>
                {notifications.map((item) => {
                  const { icon, bgClass } = getNotificationIcon(item.type);
                  return (
                    <li
                      key={item.id}
                      className={`${styles.item} ${!item.isRead ? styles.itemUnread : ''} ${
                        item.link ? styles.itemClickable : ''
                      }`}
                      onClick={(e) => handleItemClick(item, e)}
                    >
                      <div className={`${styles.itemIconWrap} ${bgClass}`} aria-hidden="true">
                        <span>{icon}</span>
                      </div>

                      <div className={styles.itemBody}>
                        <div className={styles.itemHeader}>
                          <h4 className={styles.itemTitle}>{item.title}</h4>
                          <span className={styles.itemTime}>
                            {formatRelativeTime(item.createdAt)}
                          </span>
                        </div>

                        <p className={styles.itemMessage}>{item.message}</p>

                        <div className={styles.itemFooter}>
                          {item.link && (
                            <span className={styles.itemLinkText}>
                              Lihat detail →
                            </span>
                          )}

                          {!item.isRead && (
                            <button
                              type="button"
                              className={styles.markOneBtn}
                              title="Tandai sudah dibaca"
                              aria-label="Tandai sudah dibaca"
                            >
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="20 6 9 17 4 12"></polyline>
                              </svg>
                              <span>Tandai dibaca</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {!item.isRead && (
                        <span className={styles.unreadDot} aria-hidden="true"></span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
