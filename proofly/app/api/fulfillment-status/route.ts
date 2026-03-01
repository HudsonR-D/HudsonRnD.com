import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

/**
 * Polled by the confirmation page after Stripe redirect.
 * Returns the fulfillment status for a given Stripe session ID.
 *
 * In Phase 2 MVP, fulfillment results are stored in a Vercel KV
 * cache keyed by stripe session ID. The webhook writes the result
 * here; the confirmation page reads it.
 *
 * This keeps us database-free — KV is just a short-lived cache,
 * not a persistent store of PII.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-02-25.clover',
  });

  const sessionId = request.nextUrl.searchParams.get('session_id');

  if (!sessionId) {
    return NextResponse.json({ error: 'Missing session_id' }, { status: 400 });
  }

  try {
    // Verify the Stripe session is real and paid
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return NextResponse.json({ status: 'pending_payment' });
    }

    // Try to get fulfillment result from KV cache
    // If KV is not configured, return processing status
    try {
      const { kv } = await import('@vercel/kv');
      const result = await kv.get<FulfillmentCacheEntry>(`fulfillment:${sessionId}`);

      if (result) {
        return NextResponse.json({ status: 'complete', ...result });
      }
    } catch {
      // KV not configured — that's OK for local dev
      // The confirmation page will show "processing" until email arrives
    }

    // Payment confirmed but processing not yet complete (or KV not set up)
    return NextResponse.json({
      status: 'processing',
      paymentConfirmed: true,
      email: session.customer_email,
    });
  } catch (err) {
    console.error('[fulfillment-status] Error:', err);
    return NextResponse.json({ error: 'Could not retrieve status' }, { status: 500 });
  }
}

export interface FulfillmentCacheEntry {
  requestRef: string;
  trackingNumber: string | null;
  mailedAt: string;
  deletionReceiptHash: string;
  attestationUIDs: {
    authorization: string | null;
    fulfillment: string | null;
    deletion: string | null;
  };
}
