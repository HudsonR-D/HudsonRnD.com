import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { processRequest, ProcessInput } from '@/app/api/process/route';

/**
 * Stripe requires a 200 response within 30 seconds or it retries.
 * We respond 200 immediately after verifying the signature, then
 * process asynchronously. Any processing errors are logged but
 * don't affect the 200 response.
 *
 * Stripe will retry failed webhooks — idempotency is handled by
 * checking if the request ref already exists (Phase 3 enhancement).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-02-25.clover',
  });
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err);
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 },
    );
  }

  // Only handle completed checkout sessions
  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  // Verify payment status
  if (session.payment_status !== 'paid') {
    console.warn(`[webhook] Session ${session.id} not paid — status: ${session.payment_status}`);
    return NextResponse.json({ received: true });
  }

  const metadata = session.metadata;
  if (!metadata) {
    console.error(`[webhook] Session ${session.id} has no metadata`);
    return NextResponse.json({ received: true });
  }

  // Parse and validate metadata
  const { stateCode, copies, blobUrl, fileHash, signatureDataUrl, formData } = metadata;

  if (!stateCode || !copies || !blobUrl || !fileHash || !signatureDataUrl || !formData) {
    console.error(`[webhook] Session ${session.id} missing required metadata fields:`, {
      hasStateCode: !!stateCode,
      hasCopies: !!copies,
      hasBlobUrl: !!blobUrl,
      hasFileHash: !!fileHash,
      hasSignatureDataUrl: !!signatureDataUrl,
      hasFormData: !!formData,
    });
    return NextResponse.json({ received: true });
  }

  let parsedFormData: ProcessInput['formData'];
  try {
    parsedFormData = JSON.parse(formData);
  } catch {
    console.error(`[webhook] Session ${session.id} — could not parse formData JSON`);
    return NextResponse.json({ received: true });
  }

  const processInput: ProcessInput = {
    stripeSessionId: session.id,
    stateCode,
    copies:          parseInt(copies, 10),
    blobUrl,
    fileHash,
    signatureDataUrl,
    formData:        parsedFormData,
  };

  // Fire and forget — respond 200 to Stripe immediately
  // Processing runs in the background
  processRequest(processInput)
    .then(result => {
      console.log(`[webhook] ✅ Processed ${result.requestRef} for session ${session.id}`);
    })
    .catch(err => {
      console.error(`[webhook] ❌ Processing failed for session ${session.id}:`, err);
      // TODO Phase 3: write to a dead-letter queue or alert system
      // For now: Stripe will NOT retry since we returned 200
      // Manual recovery: re-trigger processRequest with the same session ID
    });

  // Always return 200 to Stripe — never let processing errors cause retries
  return NextResponse.json({ received: true });
}
