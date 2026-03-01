import { dlqList } from '@/lib/deadLetter';
import { DLQClient } from './DLQClient';

export const dynamic = 'force-dynamic';

export default async function RequestsPage() {
  let jobs: Awaited<ReturnType<typeof dlqList>> = [];
  try {
    jobs = await dlqList();
  } catch {
    // KV not available in dev
  }

  const unresolved = jobs.filter(j => !j.resolved).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Failed Requests</h1>
          <p className="text-slate-400 text-sm">
            Dead-letter queue — requests that failed during processing
          </p>
        </div>
        {unresolved > 0 && (
          <span className="text-xs font-semibold bg-red-900/40 border border-red-500/40 text-red-400 px-3 py-1 rounded-full">
            {unresolved} unresolved
          </span>
        )}
      </div>

      <DLQClient initialJobs={jobs} />
    </div>
  );
}
