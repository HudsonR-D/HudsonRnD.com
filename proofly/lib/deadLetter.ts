/**
 * lib/deadLetter.ts
 *
 * Dead-letter queue for failed Proofly webhook processing jobs.
 * Backed by Vercel KV (Upstash Redis). Jobs are stored with a 30-day TTL
 * and can be resolved (marked done) or re-enqueued for reprocessing.
 */

export interface DLQJob {
  id:          string;       // unique job ID — "dlq:{requestRef}:{timestamp}"
  requestRef:  string;
  stripeSessionId: string;
  stateCode:   string;
  email:       string;       // for manual follow-up
  failedAt:    string;       // ISO timestamp
  error:       string;       // error message
  attempt:     number;       // how many times this has been attempted
  resolved:    boolean;
  resolvedAt:  string | null;
  resolvedBy:  string | null; // admin email
  payload:     Record<string, unknown>; // serialized ProcessInput (no PII — blob already deleted on failure)
}

const DLQ_INDEX_KEY = 'dlq:index';       // sorted set of job IDs by failedAt
const DLQ_TTL       = 60 * 60 * 24 * 30; // 30 days

/** Push a failed job onto the DLQ */
export async function dlqPush(job: Omit<DLQJob, 'id' | 'resolved' | 'resolvedAt' | 'resolvedBy'>): Promise<string> {
  const { kv } = await import('@vercel/kv');

  const id: string = `dlq:${job.requestRef}:${Date.now()}`;
  const full: DLQJob = { ...job, id, resolved: false, resolvedAt: null, resolvedBy: null };

  await kv.set(id, full, { ex: DLQ_TTL });

  // Add to index (list of IDs, most recent last)
  try {
    const index = (await kv.get<string[]>(DLQ_INDEX_KEY)) ?? [];
    index.push(id);
    await kv.set(DLQ_INDEX_KEY, index, { ex: DLQ_TTL });
  } catch {
    // Index failure is non-fatal — job is still saved
    console.warn('[dlq] Failed to update index for job', id);
  }

  console.log(`[dlq] ⚠️  Job pushed: ${id}`);
  return id;
}

/** Fetch all DLQ jobs (newest first) */
export async function dlqList(): Promise<DLQJob[]> {
  const { kv } = await import('@vercel/kv');

  const index = (await kv.get<string[]>(DLQ_INDEX_KEY)) ?? [];
  if (index.length === 0) return [];

  const jobs = await Promise.all(
    index.map(id => kv.get<DLQJob>(id).catch(() => null))
  );

  return (jobs.filter(Boolean) as DLQJob[]).reverse(); // newest first
}

/** Fetch a single job by ID */
export async function dlqGet(id: string): Promise<DLQJob | null> {
  const { kv } = await import('@vercel/kv');
  return kv.get<DLQJob>(id);
}

/** Mark a job as resolved (admin manually confirmed OK) */
export async function dlqResolve(id: string, resolvedBy: string): Promise<boolean> {
  const { kv } = await import('@vercel/kv');

  const job = await kv.get<DLQJob>(id);
  if (!job) return false;

  const updated: DLQJob = {
    ...job,
    resolved:   true,
    resolvedAt: new Date().toISOString(),
    resolvedBy,
  };

  await kv.set(id, updated, { ex: DLQ_TTL });
  console.log(`[dlq] ✅ Job resolved: ${id} by ${resolvedBy}`);
  return true;
}

/** Count unresolved jobs */
export async function dlqUnresolvedCount(): Promise<number> {
  const jobs = await dlqList().catch(() => []);
  return jobs.filter(j => !j.resolved).length;
}
