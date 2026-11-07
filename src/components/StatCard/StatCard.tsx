import React from 'react';
import styles from './StatCard.module.css';

interface StatCardProps {
  icon: string;
  label: string;
  value: string;
  subValue?: string;
  accent?: 'green' | 'blue' | 'orange' | 'red';
}

export function StatCard({ icon, label, value, subValue, accent = 'green' }: StatCardProps) {
  return (
    <div className={`${styles.card} ${styles[accent]}`}>
      <div className={styles.iconWrapper}>
        <span className={styles.icon}>{icon}</span>
      </div>
      <div className={styles.body}>
        <p className={styles.label}>{label}</p>
        <p className={styles.value}>{value}</p>
        {subValue && <p className={styles.subValue}>{subValue}</p>}
      </div>
    </div>
  );
}
