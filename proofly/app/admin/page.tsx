import { dlqUnresolvedCount } from '@/lib/deadLetter';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  let unresolvedCount = 0;
  try {
    unresolvedCount = await dlqUnresolvedCount();
  } catch {
    // KV not available in dev
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold mb-1">Overview</h1>
        <p className="text-slate-400 text-sm">Proofly operations dashboard</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        {/* Failed requests card */}
        <Link href="/admin/requests"
          className={`rounded-2xl border p-6 hover:border-teal-500/40 transition block
            ${unresolvedCount > 0 ? 'border-red-500/40 bg-red-950/10' : 'border-slate-700 bg-slate-900'}`}>
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-2">Failed Requests</p>
          <p className={`text-4xl font-bold ${unresolvedCount > 0 ? 'text-red-400' : 'text-teal-400'}`}>
            {unresolvedCount}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {unresolvedCount > 0 ? 'Needs attention →' : 'All clear'}
          </p>
        </Link>

        <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-2">Active States</p>
          <p className="text-4xl font-bold text-teal-400">1</p>
          <p className="text-xs text-slate-500 mt-1">CO live · TX, NY, FL, CA coming soon</p>
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-2">Environment</p>
          <p className="text-sm font-semibold text-white mt-2">
            {process.env.VERCEL_ENV ?? 'development'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local'}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6 space-y-3">
        <h2 className="font-semibold text-sm">Quick links</h2>
        <div className="flex flex-wrap gap-3 text-xs">
          <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer"
            className="text-teal-400 hover:text-teal-300 underline">Stripe dashboard ↗</a>
          <a href="https://dashboard.lob.com" target="_blank" rel="noopener noreferrer"
            className="text-teal-400 hover:text-teal-300 underline">Lob dashboard ↗</a>
          <a href="https://base.easscan.org" target="_blank" rel="noopener noreferrer"
            className="text-teal-400 hover:text-teal-300 underline">EAS Explorer (Base) ↗</a>
          <a href="https://vercel.com/dashboard" target="_blank" rel="noopener noreferrer"
            className="text-teal-400 hover:text-teal-300 underline">Vercel dashboard ↗</a>
        </div>
      </div>
    </div>
  );
}
