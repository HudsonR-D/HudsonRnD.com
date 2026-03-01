'use client';

import { useState } from 'react';
import type { DLQJob } from '@/lib/deadLetter';

interface DLQClientProps {
  initialJobs: DLQJob[];
}

export function DLQClient({ initialJobs }: DLQClientProps) {
  const [jobs, setJobs] = useState<DLQJob[]>(initialJobs);
  const [resolving, setResolving] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unresolved' | 'resolved'>('unresolved');

  const displayed = jobs.filter(j => {
    if (filter === 'unresolved') return !j.resolved;
    if (filter === 'resolved')   return j.resolved;
    return true;
  });

  async function handleResolve(id: string) {
    setResolving(id);
    try {
      const res = await fetch(`/api/dead-letter?id=${id}`, { method: 'PATCH' });
      if (!res.ok) {
        const body = await res.json();
        alert(`Failed to resolve: ${body.error ?? res.status}`);
        return;
      }
      setJobs(prev =>
        prev.map(j =>
          j.id === id
            ? { ...j, resolved: true, resolvedAt: new Date().toISOString(), resolvedBy: 'admin' }
            : j,
        ),
      );
    } catch (err) {
      alert(`Network error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setResolving(null);
    }
  }

  if (jobs.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-700 bg-slate-900 p-12 text-center">
        <p className="text-teal-400 text-4xl mb-3">✓</p>
        <p className="text-slate-300 font-medium">Queue is empty</p>
        <p className="text-slate-500 text-sm mt-1">No failed requests to review</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-2 text-xs">
        {(['unresolved', 'resolved', 'all'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg border font-medium transition capitalize ${
              filter === f
                ? 'bg-teal-500/10 border-teal-500/50 text-teal-400'
                : 'border-slate-700 text-slate-400 hover:border-slate-600'
            }`}
          >
            {f === 'all' ? `All (${jobs.length})` :
             f === 'unresolved' ? `Unresolved (${jobs.filter(j => !j.resolved).length})` :
             `Resolved (${jobs.filter(j => j.resolved).length})`}
          </button>
        ))}
      </div>

      {/* Jobs list */}
      {displayed.length === 0 ? (
        <div className="rounded-2xl border border-slate-700 bg-slate-900 p-8 text-center text-slate-400 text-sm">
          No {filter} jobs
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map(job => (
            <div
              key={job.id}
              className={`rounded-2xl border p-5 space-y-3 transition ${
                job.resolved
                  ? 'border-slate-700/50 bg-slate-900/50'
                  : 'border-red-500/30 bg-red-950/10'
              }`}
            >
              {/* Header row */}
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-white">{job.requestRef}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                      {job.stateCode}
                    </span>
                    {job.resolved ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-teal-900/40 border border-teal-500/30 text-teal-400">
                        Resolved
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/40 border border-red-500/30 text-red-400">
                        Open
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{job.email}</p>
                </div>

                {!job.resolved && (
                  <button
                    onClick={() => handleResolve(job.id)}
                    disabled={resolving === job.id}
                    className="text-xs px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition shrink-0"
                  >
                    {resolving === job.id ? 'Resolving…' : 'Mark Resolved'}
                  </button>
                )}
              </div>

              {/* Error message */}
              <div className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2">
                <p className="text-xs text-red-300 font-mono break-all">{job.error}</p>
              </div>

              {/* Meta row */}
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
                <span>
                  Failed: <span className="text-slate-400">{new Date(job.failedAt).toLocaleString()}</span>
                </span>
                <span>
                  Attempt: <span className="text-slate-400">#{job.attempt}</span>
                </span>
                <span>
                  Stripe: <span className="text-slate-400 font-mono">{job.stripeSessionId.slice(0, 20)}…</span>
                </span>
                {job.resolved && job.resolvedAt && (
                  <span>
                    Resolved: <span className="text-slate-400">{new Date(job.resolvedAt).toLocaleString()}</span>
                    {job.resolvedBy && <span> by <span className="text-slate-400">{job.resolvedBy}</span></span>}
                  </span>
                )}
              </div>

              {/* Payload details (collapsed) */}
              <details className="group">
                <summary className="text-xs text-slate-600 cursor-pointer hover:text-slate-400 transition select-none">
                  Raw payload ▸
                </summary>
                <pre className="mt-2 text-xs text-slate-400 bg-slate-800 border border-slate-700 rounded-lg p-3 overflow-x-auto">
                  {JSON.stringify(job.payload, null, 2)}
                </pre>
              </details>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
