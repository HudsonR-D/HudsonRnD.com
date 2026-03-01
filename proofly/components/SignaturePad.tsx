'use client';

import { useRef, useState, useCallback } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from '@/components/ui/button';

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
  onClear?: () => void;
  existingDataUrl?: string | null;
}

export default function SignaturePad({ onSave, onClear, existingDataUrl }: SignaturePadProps) {
  const padRef = useRef<SignatureCanvas>(null);
  const [saved, setSaved] = useState(!!existingDataUrl);
  const [isEmpty, setIsEmpty] = useState(!existingDataUrl);

  const handleClear = useCallback(() => {
    padRef.current?.clear();
    setSaved(false);
    setIsEmpty(true);
    onClear?.();
  }, [onClear]);

  const handleSave = useCallback(() => {
    if (!padRef.current || padRef.current.isEmpty()) return;
    const dataUrl = padRef.current.getTrimmedCanvas().toDataURL('image/png');
    onSave(dataUrl);
    setSaved(true);
  }, [onSave]);

  const handleBegin = useCallback(() => {
    setIsEmpty(false);
    setSaved(false);
  }, []);

  return (
    <div className="space-y-3">
      {/* Canvas */}
      <div className="relative rounded-xl overflow-hidden border border-zinc-700 bg-white">
        <SignatureCanvas
          ref={padRef}
          penColor="#1a1a2e"
          canvasProps={{
            className: 'w-full',
            style: { height: '160px', display: 'block', touchAction: 'none' },
          }}
          onBegin={handleBegin}
        />
        {/* Hint overlay */}
        {isEmpty && !existingDataUrl && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-zinc-400 text-sm select-none">Sign here</p>
          </div>
        )}
      </div>

      {/* Saved indicator */}
      {saved && (
        <div className="flex items-center gap-2 text-sm text-emerald-400">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Signature saved
        </div>
      )}

      {/* Existing signature preview */}
      {existingDataUrl && !saved && (
        <div className="rounded-lg border border-zinc-700 bg-white p-2">
          <p className="text-xs text-zinc-500 mb-1">Previous signature:</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={existingDataUrl} alt="Previous signature" className="max-h-20 object-contain" />
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={handleClear}
          className="flex-1 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white"
        >
          Clear
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={isEmpty}
          className="flex-1 bg-teal-600 hover:bg-teal-500 text-white disabled:opacity-40"
        >
          Save Signature
        </Button>
      </div>
    </div>
  );
}
