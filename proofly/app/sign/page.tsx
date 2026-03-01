'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { getSession, saveSession } from '@/lib/session';
import { getState } from '@/lib/states';
import StepIndicator from '@/components/StepIndicator';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// SignaturePad uses canvas — must be client-only
const SignaturePad = dynamic(() => import('@/components/SignaturePad'), {
  ssr: false,
  loading: () => (
    <div className="h-[200px] rounded-xl border border-zinc-700 bg-zinc-950 flex items-center justify-center">
      <p className="text-zinc-500 text-sm">Loading signature pad…</p>
    </div>
  ),
});

// Fill template placeholders with session data
function buildLetterPreview(template: string, data: {
  requestorName: string;
  registrantName: string;
  dateOfBirth: string;
  placeOfBirth: string;
  requestRef: string;
  date: string;
}): string {
  return template
    .replace(/{{requestorName}}/g, data.requestorName || '[Your Name]')
    .replace(/{{registrantName}}/g, data.registrantName || '[Registrant Name]')
    .replace(/{{dateOfBirth}}/g, data.dateOfBirth || '[Date of Birth]')
    .replace(/{{placeOfBirth}}/g, data.placeOfBirth || '[Place of Birth]')
    .replace(/{{requestRef}}/g, data.requestRef || 'PENDING')
    .replace(/{{date}}/g, data.date)
    .replace(/{{signatureImage}}/g, '[SIGNATURE WILL BE EMBEDDED HERE]');
}

export default function SignPage() {
  const router = useRouter();
  const [stateCode, setStateCode] = useState('CO');
  const [letterText, setLetterText] = useState('');
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [signedAt, setSignedAt] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const session = getSession();

    // Guards: must have completed steps 1 and 2
    if (!session.form?.fullName) {
      router.replace('/request');
      return;
    }
    if (!session.uploads?.photoIdBlobUrl) {
      router.replace('/upload');
      return;
    }

    if (session.stateCode) setStateCode(session.stateCode);

    // Restore existing signature if user navigated back
    if (session.signature?.dataUrl) {
      setSignatureDataUrl(session.signature.dataUrl);
      setSignedAt(session.signature.signedAt ?? null);
      setAgreed(true);
    }

    // Build letter preview
    try {
      const config = getState(session.stateCode ?? 'CO');
      const today = new Date().toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
      });

      const preview = buildLetterPreview(config.authorizationLetterTemplate, {
        requestorName: session.form.fullName ?? '',
        registrantName: session.form.fullName ?? '',
        dateOfBirth: session.form.dateOfBirth ?? '',
        placeOfBirth: session.form.placeOfBirth ?? '',
        requestRef: 'PENDING',
        date: today,
      });
      setLetterText(preview);
    } catch {
      setLetterText('Authorization letter will be generated based on your submission details.');
    }
  }, [router]);

  const handleSignatureSave = (dataUrl: string) => {
    setSignatureDataUrl(dataUrl);
    setSignedAt(new Date().toISOString());
    setError(null);
  };

  const handleSignatureClear = () => {
    setSignatureDataUrl(null);
    setSignedAt(null);
  };

  const handleContinue = () => {
    if (!signatureDataUrl) {
      setError('Please draw and save your signature before continuing.');
      return;
    }
    if (!agreed) {
      setError('Please check the authorization checkbox before continuing.');
      return;
    }

    saveSession({
      signature: {
        dataUrl: signatureDataUrl,
        signedAt: signedAt ?? new Date().toISOString(),
      },
    });

    router.push('/review');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <StepIndicator current={3} />

        <Card className="bg-zinc-900 border-zinc-700">
          <CardHeader>
            <CardTitle className="text-2xl text-white">Sign Authorization</CardTitle>
            <p className="text-zinc-400 text-sm">
              Review the authorization letter below, then sign to authorize Proofly to file on your behalf.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">

            {/* Authorization letter preview */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-zinc-300">Authorization Letter</p>
                <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded">Preview</span>
              </div>
              <div className="bg-slate-950 border border-zinc-700 rounded-xl p-5 max-h-72 overflow-y-auto">
                <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-mono leading-relaxed">
                  {letterText}
                </pre>
              </div>
            </div>

            {/* Agreement checkbox */}
            <label className="flex items-start gap-3 cursor-pointer group">
              <div className="mt-0.5 shrink-0">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={e => {
                    setAgreed(e.target.checked);
                    setError(null);
                  }}
                  className="w-4 h-4 accent-teal-500 cursor-pointer"
                />
              </div>
              <p className="text-sm text-zinc-300 group-hover:text-white transition leading-relaxed">
                I have read and agree to the authorization letter above. I authorize Proofly to
                act as my agent to file this birth certificate request, and I understand that
                all my documents will be permanently deleted after filing with on-chain proof of deletion.
              </p>
            </label>

            {/* Signature pad */}
            <div>
              <p className="text-sm font-medium text-zinc-300 mb-2">
                Your Signature
                <span className="text-red-400 ml-0.5">*</span>
              </p>
              <p className="text-xs text-zinc-500 mb-3">
                Draw your signature below using your mouse or finger. This will be embedded in the authorization letter sent to {stateCode === 'CO' ? 'CDPHE' : 'the vital records office'}.
              </p>
              <SignaturePad
                onSave={handleSignatureSave}
                onClear={handleSignatureClear}
                existingDataUrl={signatureDataUrl}
              />
            </div>

            {/* Signed indicator */}
            {signatureDataUrl && signedAt && (
              <div className="flex items-center gap-2 text-xs text-zinc-500 bg-zinc-800/50 rounded-lg px-3 py-2">
                <svg className="w-3.5 h-3.5 text-teal-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>
                  Signed {new Date(signedAt).toLocaleString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric',
                    hour: 'numeric', minute: '2-digit',
                  })}
                </span>
              </div>
            )}

            {/* Legal note */}
            <div className="bg-amber-950/20 border border-amber-500/20 rounded-xl p-4">
              <p className="text-xs text-amber-200/70 leading-relaxed">
                <strong className="text-amber-300">Legal notice:</strong> By signing, you are executing
                a legally binding authorization. This e-signature has the same legal effect as a
                handwritten signature under the Electronic Signatures in Global and National Commerce
                Act (E-SIGN Act) and applicable state law.
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-950/30 border border-red-500/40 rounded-xl p-3">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Continue */}
            <Button
              onClick={handleContinue}
              disabled={!signatureDataUrl || !agreed}
              size="lg"
              className="w-full text-lg py-7 rounded-full bg-white text-slate-950 hover:bg-zinc-100 font-semibold disabled:opacity-40"
            >
              Continue to Review & Pay →
            </Button>

            {/* Back link */}
            <button
              type="button"
              onClick={() => router.push('/upload')}
              className="w-full text-sm text-zinc-500 hover:text-zinc-300 transition py-2"
            >
              ← Back to upload
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
