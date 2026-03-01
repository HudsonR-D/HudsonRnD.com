'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { upload } from '@vercel/blob/client';
import { getSession, saveSession } from '@/lib/session';
import { getState } from '@/lib/states';
import StepIndicator from '@/components/StepIndicator';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type UploadStatus = 'idle' | 'hashing' | 'uploading' | 'done' | 'error';

// Compute SHA-256 of a File entirely in the browser — secret never leaves device
async function sha256File(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [stateCode, setStateCode] = useState('CO');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Existing upload info from session (if user navigated back)
  const [existing, setExisting] = useState<{
    name: string | null;
    size: number | null;
    hash: string | null;
  }>({ name: null, size: null, hash: null });

  useEffect(() => {
    const session = getSession();
    if (session.stateCode) setStateCode(session.stateCode);
    if (!session.form?.fullName) {
      // Guard: if no form data, send back to step 1
      router.replace('/request');
      return;
    }
    if (session.uploads?.photoIdName) {
      setExisting({
        name: session.uploads.photoIdName,
        size: session.uploads.photoIdSize ?? null,
        hash: session.uploads.photoIdHash ?? null,
      });
      setStatus('done');
    }
  }, [router]);

  let stateConfig;
  try { stateConfig = getState(stateCode); } catch { stateConfig = null; }
  const docSpec = stateConfig?.requiredDocs.find(d => d.id === 'photoId');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setError(null);
    setStatus('idle');
    setProgress(0);

    // Validate size
    const maxBytes = (docSpec?.maxSizeMB ?? 10) * 1024 * 1024;
    if (selected.size > maxBytes) {
      setError(`File too large. Maximum size is ${docSpec?.maxSizeMB ?? 10}MB.`);
      return;
    }

    // Validate type
    const allowed = docSpec?.acceptedTypes ?? ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(selected.type)) {
      setError('File type not accepted. Please upload a JPEG, PNG, WebP, or PDF.');
      return;
    }

    setFile(selected);

    // Generate preview for images
    if (selected.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target?.result as string);
      reader.readAsDataURL(selected);
    } else {
      setPreview(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setError(null);

    try {
      // Step 1: Hash the file client-side before it goes anywhere
      setStatus('hashing');
      setProgress(10);
      const hash = await sha256File(file);

      // Step 2: Upload directly to Vercel Blob via client upload
      // File goes browser → Vercel Blob, never through our function body
      setStatus('uploading');
      setProgress(30);

      const blob = await upload(file.name, file, {
        access: 'public',
        handleUploadUrl: '/api/upload-temp',
      });

      setProgress(100);
      setStatus('done');

      // Save to session — only the URL, hash, and metadata (no file content)
      saveSession({
        uploads: {
          photoIdBlobUrl: blob.url,
          photoIdHash: hash,
          photoIdName: file.name,
          photoIdSize: file.size,
        },
      });

      setExisting({ name: file.name, size: file.size, hash });
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    }
  };

  const handleContinue = () => {
    router.push('/sign');
  };

  const handleReplace = () => {
    setFile(null);
    setPreview(null);
    setStatus('idle');
    setProgress(0);
    setError(null);
    setExisting({ name: null, size: null, hash: null });
    saveSession({
      uploads: {
        photoIdBlobUrl: null,
        photoIdHash: null,
        photoIdName: null,
        photoIdSize: null,
      },
    });
    fileInputRef.current?.click();
  };

  const formatSize = (bytes: number) =>
    bytes > 1024 * 1024
      ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
      : `${Math.round(bytes / 1024)} KB`;

  return (
    <div className="min-h-screen bg-slate-950 text-white py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <StepIndicator current={2} />

        <Card className="bg-zinc-900 border-zinc-700">
          <CardHeader>
            <CardTitle className="text-2xl text-white">Upload Your Photo ID</CardTitle>
            <p className="text-zinc-400 text-sm">
              {docSpec?.description ?? "Government-issued photo ID (front only). Required by CDPHE."}
            </p>
          </CardHeader>
          <CardContent className="space-y-6">

            {/* Privacy note */}
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 flex gap-3">
              <span className="text-xl shrink-0">🔒</span>
              <div>
                <p className="text-sm font-medium text-white">Your ID stays private</p>
                <p className="text-xs text-zinc-400 mt-0.5">
                  A SHA-256 fingerprint is computed in your browser before the file uploads.
                  Your ID is stored in temporary Vercel storage and deleted immediately after
                  we mail your packet to CDPHE — with on-chain proof of deletion.
                </p>
              </div>
            </div>

            {/* Already uploaded — show summary */}
            {status === 'done' && existing.name ? (
              <div className="space-y-4">
                <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-4 flex items-start gap-3">
                  <div className="w-8 h-8 bg-emerald-500/20 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-emerald-400">ID uploaded securely</p>
                    <p className="text-xs text-zinc-400 mt-0.5 truncate">{existing.name}</p>
                    {existing.size && (
                      <p className="text-xs text-zinc-500">{formatSize(existing.size)}</p>
                    )}
                    {existing.hash && (
                      <p className="text-xs text-zinc-600 mt-1 font-mono truncate">
                        SHA-256: {existing.hash.slice(0, 16)}…
                      </p>
                    )}
                  </div>
                </div>

                {/* Image preview */}
                {preview && (
                  <div className="rounded-xl overflow-hidden border border-zinc-700 bg-black max-h-48 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={preview}
                      alt="ID preview"
                      className="max-h-48 object-contain"
                    />
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleReplace}
                    className="flex-1 text-sm text-zinc-400 border border-zinc-700 hover:border-zinc-500 hover:text-white rounded-xl px-4 py-3 transition"
                  >
                    Replace file
                  </button>
                  <Button
                    onClick={handleContinue}
                    size="lg"
                    className="flex-2 bg-white text-slate-950 hover:bg-zinc-100 font-semibold px-8 py-3 rounded-xl"
                  >
                    Continue to Sign →
                  </Button>
                </div>
              </div>
            ) : (
              // Upload UI
              <div className="space-y-4">
                {/* Drop zone */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`
                    relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition
                    ${file && status === 'idle'
                      ? 'border-teal-500/60 bg-teal-950/20'
                      : 'border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/30'}
                    ${status === 'error' ? 'border-red-500/60 bg-red-950/10' : ''}
                  `}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={docSpec?.acceptedTypes.join(',') ?? 'image/jpeg,image/png,image/webp,application/pdf'}
                    onChange={handleFileSelect}
                    className="sr-only"
                  />

                  {file ? (
                    <div>
                      <p className="text-white font-medium truncate">{file.name}</p>
                      <p className="text-zinc-400 text-sm mt-1">{formatSize(file.size)}</p>
                      <p className="text-zinc-500 text-xs mt-2">Click to change file</p>
                    </div>
                  ) : (
                    <div>
                      <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-3">
                        <svg className="w-6 h-6 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                        </svg>
                      </div>
                      <p className="text-zinc-300 font-medium">Click to select your ID</p>
                      <p className="text-zinc-500 text-sm mt-1">
                        JPEG, PNG, WebP or PDF · Max {docSpec?.maxSizeMB ?? 10}MB
                      </p>
                    </div>
                  )}
                </div>

                {/* Preview */}
                {preview && (
                  <div className="rounded-xl overflow-hidden border border-zinc-700 bg-black max-h-48 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preview} alt="ID preview" className="max-h-48 object-contain" />
                  </div>
                )}

                {/* Progress bar */}
                {(status === 'hashing' || status === 'uploading') && (
                  <div className="space-y-2">
                    <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-teal-500 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-zinc-400 text-center">
                      {status === 'hashing' ? 'Computing file fingerprint…' : 'Uploading securely…'}
                    </p>
                  </div>
                )}

                {/* Error */}
                {error && (
                  <div className="bg-red-950/30 border border-red-500/40 rounded-xl p-3">
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                )}

                {/* Upload button */}
                <Button
                  onClick={handleUpload}
                  disabled={!file || status === 'hashing' || status === 'uploading'}
                  size="lg"
                  className="w-full text-lg py-7 rounded-full bg-white text-slate-950 hover:bg-zinc-100 font-semibold disabled:opacity-40"
                >
                  {status === 'hashing'
                    ? 'Computing fingerprint…'
                    : status === 'uploading'
                    ? 'Uploading…'
                    : 'Upload & Continue →'}
                </Button>
              </div>
            )}

            {/* CDPHE note */}
            <p className="text-xs text-zinc-600 text-center">
              CDPHE requires a clear, legible copy of a valid government-issued photo ID.
              Make sure your full name and photo are visible.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}