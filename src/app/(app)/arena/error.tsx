'use client';

import { useEffect } from 'react';
import { getDefaultLanguage } from '@/lib/speech';
import { getArenaCopy } from '@/game/i18n';

export default function ArenaError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  let language = 'en';
  try {
    language = getDefaultLanguage();
  } catch (preferenceError) {
    console.warn('[Buddy Defender] Could not read the selected language for the error screen:', preferenceError);
  }
  const copy = getArenaCopy(language);

  useEffect(() => {
    console.error('[Buddy Defender] Game failed to load:', error);
  }, [error]);

  return (
    <section style={{ padding: 24 }}>
      <div role="alert" className="card" style={{ maxWidth: 560, margin: '48px auto', padding: 24 }}>
        <h2>{copy.gameError}</h2>
        <p style={{ margin: '12px 0 20px' }}>{copy.gameErrorDescription}</p>
        <button type="button" className="btn btn-primary" onClick={reset}>{copy.tryAgain}</button>
      </div>
    </section>
  );
}
