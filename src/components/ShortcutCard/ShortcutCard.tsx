import React from 'react';
import Link from 'next/link';
import styles from './ShortcutCard.module.css';

interface ShortcutCardProps {
  href: string;
  icon: string;
  label: string;
  description?: string;
  accent?: 'green' | 'blue' | 'orange';
  disabled?: boolean;
}

export function ShortcutCard({
  href,
  icon,
  label,
  description,
  accent = 'green',
  disabled = false,
}: ShortcutCardProps) {
  if (disabled) {
    return (
      <div className={`${styles.card} ${styles[accent]} ${styles.disabled}`} title="Segera hadir">
        <span className={styles.icon}>{icon}</span>
        <p className={styles.label}>{label}</p>
        {description && <p className={styles.desc}>{description}</p>}
        <span className={styles.comingSoon}>Segera Hadir</span>
      </div>
    );
  }

  return (
    <Link href={href} className={`${styles.card} ${styles[accent]}`}>
      <span className={styles.icon}>{icon}</span>
      <p className={styles.label}>{label}</p>
      {description && <p className={styles.desc}>{description}</p>}
    </Link>
  );
}
