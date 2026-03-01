/**
 * GET  /api/dead-letter          — list all DLQ jobs (Clerk-protected)
 * POST /api/dead-letter          — push a job manually (internal only)
 * PATCH /api/dead-letter?id=...  — resolve a job
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { dlqList, dlqResolve, dlqPush } from '@/lib/deadLetter';

function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowed = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim().toLowerCase());
  return allowed.includes(email.toLowerCase());
}

export async function GET(): Promise<NextResponse> {
  const { userId, sessionClaims } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const email = sessionClaims?.email as string | undefined;
  if (!isAdminEmail(email)) {
    return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 });
  }

  const jobs = await dlqList();
  return NextResponse.json({ jobs, total: jobs.length, unresolved: jobs.filter(j => !j.resolved).length });
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const { userId, sessionClaims } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const email = sessionClaims?.email as string | undefined;
  if (!isAdminEmail(email)) {
    return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 });
  }

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing job id' }, { status: 400 });

  const ok = await dlqResolve(id, email ?? 'admin');
  if (!ok) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  return NextResponse.json({ success: true });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Internal-only: requires PROOFLY_INTERNAL_SECRET
  const secret = request.headers.get('x-proofly-secret');
  if (secret !== process.env.PROOFLY_INTERNAL_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const id = await dlqPush(body);
  return NextResponse.json({ id }, { status: 201 });
}
