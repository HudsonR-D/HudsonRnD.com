import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { ReactNode } from 'react';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Admin nav */}
      <nav className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/admin" className="font-semibold text-teal-400 tracking-tight">
            Proofly Admin
          </Link>
          <div className="flex items-center gap-4 text-sm text-slate-400">
            <Link href="/admin" className="hover:text-white transition">Overview</Link>
            <Link href="/admin/requests" className="hover:text-white transition">Failed Requests</Link>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-xs text-slate-500 hover:text-slate-300 transition">
            ← Back to site
          </Link>
          <UserButton afterSignOutUrl="/" />
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-6 py-10">
        {children}
      </main>
    </div>
  );
}
