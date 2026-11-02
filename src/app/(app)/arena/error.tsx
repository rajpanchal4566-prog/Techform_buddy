'use client';

import { useEffect } from 'react';

export default function ArenaError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[Buddy Defender] Game failed to load:', error);
  }, [error]);

  return (
    <section style={{ padding: 24 }}>
      <div role="alert" className="card" style={{ maxWidth: 560, margin: '48px auto', padding: 24 }}>
        <h2>Buddy Defender could not start</h2>
        <p style={{ margin: '12px 0 20px' }}>The rest of TechForm Buddy is still available. Try loading the game again.</p>
        <button type="button" className="btn btn-primary" onClick={reset}>Try again</button>
      </div>
    </section>
  );
}
