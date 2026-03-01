import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getState } from '@/lib/states';
import { fillCDPHEForm } from '@/lib/pdf/fillForm';
import { generateConsentLetter } from '@/lib/pdf/generateConsentLetter';
import { buildPacket } from '@/lib/packet';
import { mailPacketToVitalRecords, mailFeeCheck } from '@/lib/lob';
import { runDeletionPipeline, verifyFileHash } from '@/lib/deletion';
import { emitAttestations } from '@/lib/eas';
import { sendConfirmationEmail } from '@/lib/email';

// Generate a human-readable request reference
function generateRequestRef(): string {
  const year = new Date().getFullYear();
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1
  const random = Array.from({ length: 4 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
  return `PRF-${year}-${random}`;
}

function todaysDateFormatted(): string {
  return new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  }); // MM/DD/YYYY — matches CDPHE form format
}

function todaysDateLong(): string {
  return new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  }); // "February 25, 2026" — for consent letter
}

export interface ProcessInput {
  stripeSessionId: string;
  stateCode: string;
  copies: number;
  blobUrl: string;
  fileHash: string;
  signatureDataUrl: string;
  formData: {
    fullName: string;
    dateOfBirth: string;
    placeOfBirth: string;
    motherNameAtBirth: string;
    fatherName: string;
    relationship: string;
    purpose: string;
    purposeOther: string;
    copies: number;
    mailingAddress1: string;
    mailingAddress2: string;
    city: string;
    state: string;
    zip: string;
    email: string;
  };
}

export interface ProcessResult {
  requestRef: string;
  lobLetterId: string;
  lobCheckId: string;
  trackingNumber: string | null;
  mailedAt: string;
  deletionReceiptHash: string;
  attestationUIDs: {
    authorization: string | null;
    fulfillment: string | null;
    deletion: string | null;
  };
}

/**
 * The core Proofly pipeline — called by the Stripe webhook after payment confirmed.
 * All operations are in-memory. No database writes at any point.
 *
 * Step 1:  Load state config
 * Step 2:  Fetch blob into memory
 * Step 3:  Verify file hash (tamper check)
 * Step 4:  Fill CDPHE PDF form
 * Step 5:  Generate consent/authorization letter
 * Step 6:  Build master packet (consent + form + ID)
 * Step 7:  Mail packet via Lob
 * Step 8:  Mail fee check via Lob (stubbed if no bank account)
 * Step 9:  Delete blob + zeroize all buffers
 * Step 10: Emit 3 EAS attestations on Base
 * Step 11: Send confirmation email
 */
export async function processRequest(input: ProcessInput): Promise<ProcessResult> {
  const {
    stateCode, copies, blobUrl, fileHash,
    signatureDataUrl, formData,
  } = input;

  const requestRef = generateRequestRef();
  let idFileBuffer: Buffer | null = null;

  try {
    // ── Step 1: Load state config ────────────────────────────────────────────
    const stateConfig = getState(stateCode);

    // ── Step 2: Fetch ID file from Vercel Blob into memory ───────────────────
    const blobResponse = await fetch(blobUrl);
    if (!blobResponse.ok) {
      throw new Error(`Failed to fetch blob: ${blobResponse.status} ${blobResponse.statusText}`);
    }
    const idFileArrayBuffer = await blobResponse.arrayBuffer();
    idFileBuffer = Buffer.from(idFileArrayBuffer);
    const idFileType = blobResponse.headers.get('content-type') ?? 'image/jpeg';

    // ── Step 3: Verify file hash ─────────────────────────────────────────────
    const hashValid = verifyFileHash(idFileBuffer, fileHash);
    if (!hashValid) {
      throw new Error('File hash mismatch — possible tampering detected');
    }

    // ── Step 4: Fill CDPHE PDF form ──────────────────────────────────────────
    const filledFormBytes = await fillCDPHEForm({
      stateConfig,
      form: formData,
      signatureDataUrl,
      copies,
      todaysDate: todaysDateFormatted(),
    });
    const filledFormBuffer = Buffer.from(filledFormBytes);

    // ── Step 5: Generate consent letter ─────────────────────────────────────
    const consentLetterBytes = await generateConsentLetter({
      stateConfig,
      form: formData,
      signatureDataUrl,
      requestRef,
      todaysDate: todaysDateLong(),
    });
    const consentLetterBuffer = Buffer.from(consentLetterBytes);

    // ── Step 6: Build master packet ──────────────────────────────────────────
    const masterPacketBytes = await buildPacket({
      filledFormBytes,
      consentLetterBytes,
      idFileBuffer,
      idFileType,
    });

    // ── Step 7: Mail packet to vital records ─────────────────────────────────
    const fromAddress = {
      street: formData.mailingAddress1 + (formData.mailingAddress2 ? ` ${formData.mailingAddress2}` : ''),
      city:   formData.city,
      state:  formData.state,
      zip:    formData.zip,
    };

    const letterResult = await mailPacketToVitalRecords(
      masterPacketBytes,
      stateConfig,
      formData.fullName,
      fromAddress,
      requestRef,
    );

    // ── Step 8: Mail fee check ───────────────────────────────────────────────
    const checkResult = await mailFeeCheck(
      stateConfig,
      copies,
      formData.fullName,
      fromAddress,
      requestRef,
    );

    // ── Step 9: Delete blob + zeroize all buffers ─────────────────────────────
    const signatureHash = createHash('sha256')
      .update(Buffer.from(signatureDataUrl))
      .digest('hex');

    const deletionReceipt = await runDeletionPipeline({
      blobUrl,
      fileBuffers: [
        { label: 'photoId',       buffer: idFileBuffer },
        { label: 'filledForm',    buffer: filledFormBuffer },
        { label: 'consentLetter', buffer: consentLetterBuffer },
      ],
      requestRef,
      lobLetterId: letterResult.lobLetterId,
      lobCheckId:  checkResult.lobCheckId,
    });

    // Null out references so GC can reclaim
    idFileBuffer = null;

    // ── Step 10: Emit EAS attestations ───────────────────────────────────────
    const attestationUIDs = await emitAttestations({
      stateCode,
      signatureHash,
      requestRef,
      lobLetterId:   letterResult.lobLetterId,
      trackingNumber: letterResult.trackingNumber,
      mailedToName:  stateConfig.vitalRecords.mailingAddress.name,
      deletionReceipt,
    });

    // ── Step 11: Send confirmation email ─────────────────────────────────────
    try {
      await sendConfirmationEmail({
        to:               formData.email,
        requestRef,
        fullName:         formData.fullName,
        stateCode,
        stateName:        stateConfig.name,
        trackingNumber:   letterResult.trackingNumber,
        expectedDelivery: letterResult.expectedDeliveryDate,
        deletionReceipt,
        attestationUIDs,
      });
    } catch (emailErr) {
      // Email failure is non-fatal — everything else succeeded
      console.error('[process] Confirmation email failed:', emailErr);
    }

    const mailedAt = new Date().toISOString();

    console.log(`[process] ✅ Request ${requestRef} complete — mailed, deleted, attested`);

    // Write result to Vercel KV so confirmation page can poll it
    // KV is a short-lived cache — not a persistent store of PII
    try {
      const { kv } = await import('@vercel/kv');
      await kv.set(
        `fulfillment:${input.stripeSessionId}`,
        {
          requestRef,
          trackingNumber:      letterResult.trackingNumber,
          mailedAt,
          deletionReceiptHash: deletionReceipt.receiptHash,
          attestationUIDs,
        },
        { ex: 60 * 60 * 24 * 7 }, // 7 day TTL
      );
    } catch {
      // KV not configured — confirmation page falls back to email
    }


    return {
      requestRef,
      lobLetterId:          letterResult.lobLetterId,
      lobCheckId:           checkResult.lobCheckId,
      trackingNumber:       letterResult.trackingNumber,
      mailedAt,
      deletionReceiptHash:  deletionReceipt.receiptHash,
      attestationUIDs,
    };
  } catch (err) {
    // ── Error recovery: always attempt blob deletion on failure ───────────────
    if (idFileBuffer) {
      idFileBuffer.fill(0);
      idFileBuffer = null;
    }
    try {
      const { del } = await import('@vercel/blob');
      await del(blobUrl);
      console.log(`[process] Blob deleted during error recovery for ${requestRef}`);
    } catch (delErr) {
      console.error(`[process] Could not delete blob during error recovery:`, delErr);
    }

    throw err; // re-throw so webhook handler can log and return 500
  }
}

// ─── HTTP handler (called directly for testing, normally via webhook) ─────────
export async function POST(request: NextRequest): Promise<NextResponse> {
  // This route is not exposed publicly — it's called internally by the webhook.
  // In production it should verify a shared secret if called externally.
  const secret = request.headers.get('x-proofly-secret');
  if (secret !== process.env.PROOFLY_INTERNAL_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json() as ProcessInput;
    const result = await processRequest(body);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Processing failed';
    console.error('[/api/process] Error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
