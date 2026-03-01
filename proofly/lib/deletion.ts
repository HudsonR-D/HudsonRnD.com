import { createHash } from 'crypto';
import { del } from '@vercel/blob';

export interface DeletionInput {
  blobUrl: string;
  fileBuffers: {
    label: string;   // e.g. "photoId", "filledForm", "consentLetter"
    buffer: Buffer;
  }[];
  requestRef: string;
  lobLetterId: string;
  lobCheckId: string;
}

export interface DeletionReceipt {
  requestRef: string;
  fileHashes: { label: string; sha256: string }[];
  deletedAt: number;         // unix ms
  lobLetterId: string;
  lobCheckId: string;
  deletionMethod: string;
  allFilesDeleted: boolean;
  receiptHash: string;       // sha256 of the receipt itself
}

/**
 * The deletion pipeline:
 * 1. Hash all file buffers (before deletion — so hashes are committed)
 * 2. Delete the Vercel Blob (the only persistent copy)
 * 3. Zeroize all in-memory buffers
 * 4. Generate and return a signed deletion receipt
 *
 * This is called AFTER Lob mailing is confirmed.
 * If anything fails, we still attempt blob deletion.
 */
export async function runDeletionPipeline(input: DeletionInput): Promise<DeletionReceipt> {
  const { blobUrl, fileBuffers, requestRef, lobLetterId, lobCheckId } = input;

  // Step 1: Hash all buffers before we destroy them
  const fileHashes = fileBuffers.map(({ label, buffer }) => ({
    label,
    sha256: sha256Hex(buffer),
  }));

  let blobDeleted = false;

  // Step 2: Delete Vercel Blob — the only persistent file store
  try {
    await del(blobUrl);
    blobDeleted = true;
  } catch (err) {
    // Log but continue — we still zeroize and generate receipt
    // The blob will expire naturally; we flag it as not deleted in receipt
    console.error(`[deletion] Failed to delete blob ${blobUrl}:`, err);
  }

  // Step 3: Zeroize all in-memory buffers
  // This overwrites the buffer contents with zeros so GC'd memory doesn't contain PII
  for (const { buffer } of fileBuffers) {
    zeroize(buffer);
  }

  // Step 4: Build deletion receipt
  const receipt: Omit<DeletionReceipt, 'receiptHash'> = {
    requestRef,
    fileHashes,
    deletedAt:       Date.now(),
    lobLetterId,
    lobCheckId,
    deletionMethod:  'vercel_blob_delete_plus_buffer_zeroize',
    allFilesDeleted: blobDeleted,
  };

  const receiptHash = sha256Hex(Buffer.from(JSON.stringify(receipt)));

  return { ...receipt, receiptHash };
}

/**
 * Compute SHA-256 of a file buffer that was fetched from Vercel Blob.
 * Used to verify the blob hasn't been tampered with since upload.
 */
export function computeFileHash(buffer: Buffer): string {
  return sha256Hex(buffer);
}

/**
 * Verify that the re-hashed file matches the hash committed at upload time.
 * Called in /api/process before we use any file data.
 */
export function verifyFileHash(buffer: Buffer, expectedHash: string): boolean {
  const actual = sha256Hex(buffer);
  if (actual !== expectedHash) {
    console.error(`[deletion] Hash mismatch — expected ${expectedHash}, got ${actual}`);
    return false;
  }
  return true;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sha256Hex(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

function zeroize(buffer: Buffer): void {
  try {
    buffer.fill(0);
  } catch {
    // Buffer may already be detached — ignore
  }
}
