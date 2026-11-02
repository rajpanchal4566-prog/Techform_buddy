'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { useAppHeader } from '@/components/AppShellContext';
import styles from './arena.module.css';

const GameClient = dynamic(() => import('./GameClient'), {
  ssr: false,
  loading: () => <div className={styles.loading} aria-live="polite">Loading Buddy Defender…</div>,
});

export default function ArenaPage() {
  useAppHeader({ title: 'Buddy Defender', subtitle: 'A quick safety arcade challenge' });

  useEffect(() => {
    document.body.classList.add('tfb-arena-active');
    return () => document.body.classList.remove('tfb-arena-active');
  }, []);

  return (
    <section className={styles.page}>
      <GameClient />
    </section>
  );
}
