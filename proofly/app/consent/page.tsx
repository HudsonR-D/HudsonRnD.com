'use client';

import dynamic from 'next/dynamic';

const ConsentClient = dynamic(() => import('./ConsentClient'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950">
      <p className="text-zinc-500 text-sm">Loading wallet...</p>
    </div>
  ),
});

export default function ConsentPage() {
  return <ConsentClient />;
}