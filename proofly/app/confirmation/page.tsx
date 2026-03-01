'use client';

import { Suspense } from 'react';
import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getSession, saveSession, clearSession } from '@/lib/session';

// ─── Types ────────────────────────────────────────────────────────────────────

type PageState =
  | { status: 'loading' }
  | { status: 'polling'; email: string; pollCount: number }
  | { status: 'complete'; data: CompletedData }
  | { status: 'error'; message: string };

interface CompletedData {
  requestRef: string;
  trackingNumber: string | null;
  mailedAt: string | null;
  deletionReceiptHash: string | null;
  attestationUIDs: {
    authorization: string | null;
    fulfillment: string | null;
    deletion: string | null;
  };
  email: string;
  fullName: string;
  stateCode: string;
}

const EAS_EXPLORER = 'https://base.easscan.org/attestation/view';
const POLL_INTERVAL_MS = 4000;
const MAX_POLLS = 60; // 4 min max — after that tell them to check email

// ─── Page wrapper (required for useSearchParams + Suspense) ──────────────────

export default function ConfirmationPage() {
  return (
    <Suspense fallback={<FullScreenSpinner />}>
      <ConfirmationInner />
    </Suspense>
  );
}

// ─── Inner component ─────────────────────────────────────────────────────────

function ConfirmationInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const stripeSessionId = searchParams.get('session_id');

  const [pageState, setPageState] = useState<PageState>({ status: 'loading' });
  const [pollCount, setPollCount]  = useState(0);

  // ── Check for fulfillment result ─────────────────────────────────────────
  const checkFulfillment = useCallback(async (sessionId: string) => {
    try {
      const res = await fetch(`/api/fulfillment-status?session_id=${sessionId}`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }, []);

  // ── On mount ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const session = getSession();

    // Already completed (user refreshed page)
    if (session.fulfillment?.requestRef) {
      setPageState({ status: 'complete', data: buildData(session) });
      return;
    }

    // No stripe session ID and no local fulfillment — lost state
    if (!stripeSessionId) {
      if (!session.form?.fullName) {
        router.replace('/');
        return;
      }
      setPageState({ status: 'error', message: 'Payment session not found. Check your email for confirmation.' });
      return;
    }

    // Save stripe session ID
    saveSession({ payment: { stripeSessionId, status: 'pending', method: 'stripe' } });

    // Start with loading, first poll will transition to polling or complete
    setPageState({ status: 'loading' });
  }, [stripeSessionId, router]);

  // ── Polling loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!stripeSessionId) return;

    const session = getSession();
    if (session.fulfillment?.requestRef) return; // already done

    let cancelled = false;
    let count = 0;

    const poll = async () => {
      if (cancelled) return;

      count++;
      setPollCount(count);

      const result = await checkFulfillment(stripeSessionId);

      if (cancelled) return;

      if (!result) {
        // Network error — keep polling
        setPageState(s => s.status === 'loading'
          ? { status: 'polling', email: '', pollCount: count }
          : s.status === 'polling' ? { ...s, pollCount: count } : s
        );
      } else if (result.status === 'complete') {
        // Success — write to session and display
        saveSession({
          fulfillment: {
            requestRef:          result.requestRef,
            trackingNumber:      result.trackingNumber,
            mailedAt:            result.mailedAt,
            deletionReceiptHash: result.deletionReceiptHash,
            attestationUIDs:     result.attestationUIDs,
            lobLetterId:         null,
            lobCheckId:          null,
          },
        });
        const updated = getSession();
        setPageState({ status: 'complete', data: buildData(updated) });
        return; // stop polling
      } else if (result.status === 'processing' || result.status === 'pending_payment') {
        const email = result.email ?? '';
        setPageState({ status: 'polling', email, pollCount: count });

        if (count >= MAX_POLLS) {
          // Timed out — tell user to check email
          setPageState({
            status: 'error',
            message: `Processing is taking longer than expected. Your request is being processed — check ${email || 'your email'} for confirmation.`,
          });
          return;
        }
      }

      // Schedule next poll
      setTimeout(poll, POLL_INTERVAL_MS);
    };

    // Start after a short delay (give the webhook time to fire)
    const timer = setTimeout(poll, 1500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [stripeSessionId, checkFulfillment]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (pageState.status === 'loading') return <FullScreenSpinner />;

  if (pageState.status === 'error') {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-5">
          <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto text-3xl">⏳</div>
          <h1 className="text-2xl font-bold">Check your email</h1>
          <p className="text-zinc-400 leading-relaxed">{pageState.message}</p>
          <button
            onClick={() => router.push('/')}
            className="bg-white text-slate-950 font-semibold px-6 py-3 rounded-xl hover:bg-zinc-100 transition"
          >
            Back to home
          </button>
        </div>
      </div>
    );
  }

  if (pageState.status === 'polling') {
    const steps = [
      { label: 'Payment verified',               done: true },
      { label: 'Filling CDPHE application',      done: pollCount > 3,  active: pollCount <= 3 },
      { label: 'Building document packet',       done: pollCount > 6,  active: pollCount > 3 && pollCount <= 6 },
      { label: 'Mailing to vital records office', done: pollCount > 10, active: pollCount > 6 && pollCount <= 10 },
      { label: 'Deleting all documents',         done: pollCount > 13, active: pollCount > 10 && pollCount <= 13 },
      { label: 'Issuing on-chain deletion proof', done: false,          active: pollCount > 13 },
    ];

    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="max-w-lg w-full text-center space-y-6">

          <div className="relative w-20 h-20 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-teal-500/20" />
            <div className="absolute inset-0 rounded-full border-4 border-teal-500 border-t-transparent animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center text-2xl">📦</div>
          </div>

          <div>
            <h1 className="text-3xl font-bold mb-2">Processing your request</h1>
            <p className="text-zinc-400">
              Payment confirmed. Filing your application now.
            </p>
          </div>

          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 text-left space-y-4">
            {steps.map(({ label, done, active }) => (
              <div key={label} className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                  done
                    ? 'bg-teal-500'
                    : active
                    ? 'border-2 border-teal-500 border-t-transparent animate-spin'
                    : 'border-2 border-zinc-700'
                }`}>
                  {done && (
                    <svg className="w-3 h-3 text-slate-950" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className={`text-sm ${done ? 'text-white' : active ? 'text-teal-400' : 'text-zinc-600'}`}>
                  {label}
                </span>
              </div>
            ))}
          </div>

          <p className="text-xs text-zinc-500">
            {pageState.email
              ? `A confirmation will be sent to ${pageState.email}`
              : 'A confirmation email is on its way.'
            }
            {' '}You can safely close this tab.
          </p>
        </div>
      </div>
    );
  }

  // ── Complete ────────────────────────────────────────────────────────────────
  const { data } = pageState;
  const hasAttestations =
    data.attestationUIDs.authorization ||
    data.attestationUIDs.fulfillment ||
    data.attestationUIDs.deletion;

  return (
    <div className="min-h-screen bg-slate-950 text-white py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Hero */}
        <div className="text-center space-y-4 py-6">
          <div className="w-20 h-20 bg-teal-500/20 border-2 border-teal-500/40 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-10 h-10 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold">Request submitted</h1>
          <p className="text-zinc-400 text-lg">
            Your birth certificate request has been mailed to{' '}
            {data.stateCode === 'CO' ? 'CDPHE' : 'the vital records office'}.
          </p>
          {data.requestRef && (
            <p className="text-sm font-mono bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 inline-block text-teal-400">
              Ref: {data.requestRef}
            </p>
          )}
        </div>

        {/* Tracking */}
        {data.trackingNumber && (
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
              Mailing Tracking
            </p>
            <p className="font-mono text-white text-lg">{data.trackingNumber}</p>
            {data.mailedAt && (
              <p className="text-xs text-zinc-500 mt-1">
                Mailed {new Date(data.mailedAt).toLocaleDateString('en-US', {
                  year: 'numeric', month: 'long', day: 'numeric',
                })}
              </p>
            )}
            <p className="text-xs text-zinc-500 mt-3">
              Allow 10 business days for CDPHE to process and mail your certificate.
            </p>
          </div>
        )}

        {/* Privacy proof */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔒</span>
            <p className="font-semibold text-white">Privacy Proof</p>
          </div>
          <div className="space-y-3">
            <PrivacyRow icon="✅" title="Documents deleted"
              desc="All uploaded files were permanently deleted immediately after mailing." />
            {data.deletionReceiptHash ? (
              <PrivacyRow icon="⛓️" title="On-chain deletion receipt"
                desc={
                  <span className="font-mono text-xs text-teal-400 break-all">
                    {data.deletionReceiptHash}
                  </span>
                } />
            ) : (
              <PrivacyRow icon="⛓️" title="On-chain deletion receipt"
                desc="Will be issued within a few minutes and sent to your email." />
            )}
            <PrivacyRow icon="📭" title="No copies retained"
              desc="Proofly holds no records of your documents, name, or personal details." />
          </div>
        </div>

        {/* EAS Attestations */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 space-y-4">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            On-Chain Attestations (Base)
          </p>
          {hasAttestations ? (
            <div className="space-y-2">
              {[
                { label: 'Authorization',    uid: data.attestationUIDs.authorization },
                { label: 'Fulfillment',      uid: data.attestationUIDs.fulfillment   },
                { label: 'Data Destruction', uid: data.attestationUIDs.deletion      },
              ].map(({ label, uid }) => uid ? (
                <div key={label} className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-zinc-400">{label}</span>
                  <a
                    href={`${EAS_EXPLORER}/${uid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs text-teal-400 hover:text-teal-300 underline truncate max-w-[200px]"
                  >
                    {uid.slice(0, 12)}…
                  </a>
                </div>
              ) : null)}
            </div>
          ) : (
            <p className="text-sm text-zinc-400">
              Three EAS attestations (authorization, fulfillment, data destruction) will be
              issued on Base and linked in your confirmation email.
            </p>
          )}
        </div>

        {/* Claim credential */}
        <div className="bg-gradient-to-br from-slate-900 to-zinc-900 border border-teal-500/20 rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎖️</span>
            <p className="font-semibold text-white">Claim your soulbound credential</p>
            <span className="text-xs bg-teal-500/10 text-teal-400 border border-teal-500/20 px-2 py-0.5 rounded-full ml-auto">
              Optional
            </span>
          </div>
          <p className="text-sm text-zinc-400">
            Mint a privacy-preserving credential proving you obtained your birth certificate —
            ZK-proven age and residency claims, no PII on-chain.
          </p>
          <Link
            href={`/claim${data.requestRef ? `?ref=${data.requestRef}` : ''}`}
            className="inline-flex items-center gap-2 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 text-teal-400 text-sm font-medium px-4 py-2.5 rounded-xl transition"
          >
            Claim credential →
          </Link>
        </div>

        {/* Email note */}
        <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 text-center">
          <p className="text-sm text-zinc-400">
            Confirmation sent to <span className="text-white">{data.email}</span>
          </p>
        </div>

        <button
          onClick={() => { clearSession(); router.push('/'); }}
          className="w-full text-sm text-zinc-500 hover:text-zinc-300 transition py-3"
        >
          Start a new request →
        </button>

      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildData(session: ReturnType<typeof getSession>): CompletedData {
  return {
    requestRef:          session.fulfillment?.requestRef      ?? '',
    trackingNumber:      session.fulfillment?.trackingNumber  ?? null,
    mailedAt:            session.fulfillment?.mailedAt        ?? null,
    deletionReceiptHash: session.fulfillment?.deletionReceiptHash ?? null,
    attestationUIDs:     session.fulfillment?.attestationUIDs ?? {
      authorization: null, fulfillment: null, deletion: null,
    },
    email:     session.form?.email    ?? '',
    fullName:  session.form?.fullName ?? '',
    stateCode: session.stateCode      ?? 'CO',
  };
}

function FullScreenSpinner() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function PrivacyRow({
  icon, title, desc,
}: { icon: string; title: string; desc: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="text-base shrink-0 mt-0.5">{icon}</span>
      <div>
        <p className="text-sm font-medium text-white">{title}</p>
        <div className="text-xs text-zinc-400 mt-0.5">{desc}</div>
      </div>
    </div>
  );
}
