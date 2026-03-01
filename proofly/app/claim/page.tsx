'use client';

import dynamic from 'next/dynamic';

// ClaimClient uses wagmi hooks — must be client-only with ssr:false
const ClaimClient = dynamic(() => import('./ClaimClient'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

export default function ClaimPage() {
  return <ClaimClient />;
}
