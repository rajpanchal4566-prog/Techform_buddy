'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TrackerRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/applications');
  }, [router]);

  return (
    <div className="loading-screen">
      <div className="loading-spinner" />
      <p>Redirecting to Applications Tracker...</p>
    </div>
  );
}

