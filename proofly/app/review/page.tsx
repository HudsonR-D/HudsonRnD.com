'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSession, saveSession, computeTotalCents, formatCents } from '@/lib/session';
import { getState } from '@/lib/states';
import StepIndicator from '@/components/StepIndicator';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type SessionSnapshot = {
  stateCode: string;
  fullName: string;
  dateOfBirth: string;
  placeOfBirth: string;
  copies: number;
  mailingAddress: string;
  email: string;
  photoIdName: string;
  photoIdHash: string;
  signedAt: string;
  firstCopy: number;
  additionalCopy: number;
  prooflyService: number;
  lobPostage: number;
  total: number;
};

export default function ReviewPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ReviewContent />
    </Suspense>
  );
}

function ReviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cancelled = searchParams.get('cancelled');

  const [snap, setSnap] = useState<SessionSnapshot | null>(null);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const session = getSession();

    // Guards: must have completed all prior steps
    if (!session.form?.fullName) { router.replace('/request'); return; }
    if (!session.uploads?.photoIdBlobUrl) { router.replace('/upload'); return; }
    if (!session.signature?.dataUrl) { router.replace('/sign'); return; }

    const stateCode = session.stateCode ?? 'CO';
    let fees = { firstCopy: 2500, additionalCopy: 2000, prooflyService: 500, lobPostage: 600 };
    try {
      const cfg = getState(stateCode);
      fees = cfg.fees;
    } catch { /* use defaults */ }

    const copies = session.form.copies ?? 1;
    const total = computeTotalCents(fees.firstCopy, fees.additionalCopy, fees.prooflyService, fees.lobPostage, copies);

    const addr = [
      session.form.mailingAddress1,
      session.form.mailingAddress2,
      `${session.form.city}, ${session.form.state} ${session.form.zip}`,
    ].filter(Boolean).join(', ');

    setSnap({
      stateCode,
      fullName: session.form.fullName,
      dateOfBirth: session.form.dateOfBirth,
      placeOfBirth: session.form.placeOfBirth,
      copies,
      mailingAddress: addr,
      email: session.form.email,
      photoIdName: session.uploads.photoIdName ?? 'ID uploaded',
      photoIdHash: session.uploads.photoIdHash ?? '',
      signedAt: session.signature.signedAt ?? '',
      ...fees,
      total,
    });
  }, [router]);

  const handleStripeCheckout = async () => {
    if (!snap) return;
    setPaying(true);
    setError(null);

    const session = getSession();

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stateCode: snap.stateCode,
          copies: snap.copies,
          email: snap.email,
          blobUrl: session.uploads?.photoIdBlobUrl,
          fileHash: session.uploads?.photoIdHash,
          signatureDataUrl: session.signature?.dataUrl,
          formData: session.form,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? 'Checkout failed');
      }

      // Save pending payment state before redirect
      saveSession({
        payment: {
          method: 'stripe',
          stripeSessionId: null, // set after webhook confirms
          status: 'pending',
        },
      });

      // Redirect to Stripe-hosted checkout page
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setPaying(false);
    }
  };

  if (!snap) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const additionalCopies = snap.copies - 1;

  return (
    <div className="min-h-screen bg-slate-950 text-white py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <StepIndicator current={4} />

        {/* Cancelled notice */}
        {cancelled && (
          <div className="mb-6 bg-amber-950/30 border border-amber-500/40 rounded-xl p-4">
            <p className="text-sm text-amber-300">
              Payment was cancelled. Your information is still saved — review below and try again when ready.
            </p>
          </div>
        )}

        <Card className="bg-zinc-900 border-zinc-700">
          <CardHeader>
            <CardTitle className="text-2xl text-white">Review & Pay</CardTitle>
            <p className="text-zinc-400 text-sm">
              Review your request before payment. Nothing is submitted until you pay.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">

            {/* Request summary */}
            <div className="bg-slate-950/60 border border-zinc-800 rounded-xl divide-y divide-zinc-800">
              <SummarySection title="Registrant">
                <Row label="Full name at birth" value={snap.fullName} />
                <Row label="Date of birth" value={formatDate(snap.dateOfBirth)} />
                <Row label="Place of birth" value={snap.placeOfBirth + ', CO'} />
              </SummarySection>

              <SummarySection title="Delivery">
                <Row label="Mailing address" value={snap.mailingAddress} />
                <Row label="Confirmation email" value={snap.email} />
                <Row label="Copies requested" value={String(snap.copies)} />
              </SummarySection>

              <SummarySection title="Documents">
                <Row label="Photo ID" value={snap.photoIdName} />
                <Row
                  label="File fingerprint"
                  value={snap.photoIdHash ? snap.photoIdHash.slice(0, 16) + '…' : '—'}
                  mono
                />
              </SummarySection>

              <SummarySection title="Authorization">
                <Row
                  label="E-signature"
                  value={snap.signedAt ? `Signed ${formatDate(snap.signedAt)}` : '—'}
                  valueClass="text-emerald-400"
                />
                <Row label="Agent authorization" value="Proofly / Hudson R&D" />
              </SummarySection>
            </div>

            {/* Price breakdown */}
            <div className="bg-slate-950/60 border border-zinc-800 rounded-xl p-5 space-y-3">
              <p className="text-sm font-semibold text-zinc-300 mb-3">Price Breakdown</p>

              <PriceRow label="First certified copy" amount={snap.firstCopy} />
              {additionalCopies > 0 && (
                <PriceRow
                  label={`${additionalCopies} additional ${additionalCopies === 1 ? 'copy' : 'copies'}`}
                  amount={snap.additionalCopy * additionalCopies}
                />
              )}
              {snap.prooflyService > 0 && (
                <PriceRow label="Proofly filing service" amount={snap.prooflyService} />
              )}
              {snap.lobPostage > 0 && (
                <PriceRow label="Postage & handling" amount={snap.lobPostage} />
              )}

              <div className="pt-3 border-t border-zinc-700 flex justify-between items-baseline">
                <span className="font-semibold text-white">Total</span>
                <span className="text-3xl font-bold text-teal-400">{formatCents(snap.total)}</span>
              </div>

              <p className="text-xs text-zinc-500">
                State fee paid directly to {snap.stateCode === 'CO' ? 'CDPHE' : 'vital records'} via check.
                Proofly service fee covers secure filing, handling, and on-chain deletion proof.
              </p>
            </div>

            {/* Privacy reminder */}
            <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 flex gap-3">
              <span className="text-lg shrink-0">🔒</span>
              <p className="text-xs text-zinc-400 leading-relaxed">
                After payment, we will file your request with {snap.stateCode === 'CO' ? 'CDPHE' : 'the vital records office'} and permanently delete all your documents. You'll receive a tracking number and an on-chain deletion proof via email.
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-950/30 border border-red-500/40 rounded-xl p-3">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Pay button */}
            <Button
              onClick={handleStripeCheckout}
              disabled={paying}
              size="lg"
              className="w-full text-xl py-8 rounded-full bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold disabled:opacity-50"
            >
              {paying ? (
                <span className="flex items-center gap-3">
                  <span className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  Redirecting to payment…
                </span>
              ) : (
                `Pay ${formatCents(snap.total)} & Submit Request →`
              )}
            </Button>

            {/* USDC coming soon note */}
            <p className="text-xs text-center text-zinc-600">
              USDC payment coming soon · Powered by Stripe · 256-bit encryption
            </p>

            {/* Back link */}
            <button
              type="button"
              onClick={() => router.push('/sign')}
              className="w-full text-sm text-zinc-500 hover:text-zinc-300 transition py-2"
            >
              ← Back to signature
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Sub-components

function SummarySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 space-y-2">
      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">{title}</p>
      {children}
    </div>
  );
}

function Row({
  label, value, mono, valueClass,
}: {
  label: string;
  value: string;
  mono?: boolean;
  valueClass?: string;
}) {
  return (
    <div className="flex justify-between items-start gap-4 text-sm">
      <span className="text-zinc-500 shrink-0">{label}</span>
      <span className={`text-right ${mono ? 'font-mono text-xs' : ''} ${valueClass ?? 'text-zinc-200'}`}>
        {value}
      </span>
    </div>
  );
}

function PriceRow({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-zinc-400">{label}</span>
      <span className="text-zinc-200">{formatCents(amount)}</span>
    </div>
  );
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  try {
    // Handle both ISO timestamps and YYYY-MM-DD date strings
    const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return dateStr;
  }
}
