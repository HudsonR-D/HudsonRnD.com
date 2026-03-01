/**
 * POST /api/mint-credential
 *
 * Verifies payment completion, derives claims from Stripe metadata,
 * and returns a signed EIP-712 payload the client uses to call mint() on-chain.
 *
 * Flow:
 *   1. Validate request (wallet address + requestRef + stripeSessionId)
 *   2. Retrieve Stripe session — confirm payment_status = 'paid'
 *   3. Check session hasn't already been minted (KV idempotency key)
 *   4. Derive boolean claims from Stripe metadata (written by process route)
 *   5. Sign {recipient, claims, expiry} with EIP-712
 *   6. Return signed payload — client calls contract.mint(payload)
 *   7. Mark minted in KV to prevent replay
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { deriveClaimsFromMetadata, signMintAuthorization } from '@/lib/credential';

const BASE_CHAIN_ID = 8453; // Base mainnet

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as {
      stripeSessionId: string;
      requestRef: string;
      recipient: string; // wallet address
    };

    const { stripeSessionId, requestRef, recipient } = body;

    // ── 1. Validate inputs ────────────────────────────────────────────────────
    if (!stripeSessionId || !requestRef || !recipient) {
      return NextResponse.json(
        { error: 'Missing required fields: stripeSessionId, requestRef, recipient' },
        { status: 400 },
      );
    }

    if (!/^0x[0-9a-fA-F]{40}$/.test(recipient)) {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }

    const contractAddress = process.env.PROOFLY_CONTRACT_ADDRESS;
    if (!contractAddress) {
      return NextResponse.json(
        { error: 'Contract not deployed yet — credential minting coming soon' },
        { status: 503 },
      );
    }

    // ── 2. Verify payment via Stripe ──────────────────────────────────────────
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
    }

    const stripe = new Stripe(stripeKey);
    const session = await stripe.checkout.sessions.retrieve(stripeSessionId);

    if (session.payment_status !== 'paid') {
      return NextResponse.json(
        { error: 'Payment not confirmed — cannot issue credential' },
        { status: 402 },
      );
    }

    // Verify the requestRef matches what was stored in Stripe metadata
    if (session.metadata?.requestRef && session.metadata.requestRef !== requestRef) {
      return NextResponse.json(
        { error: 'Request reference mismatch' },
        { status: 403 },
      );
    }

    // ── 3. Idempotency check — prevent double minting ─────────────────────────
    try {
      const { kv } = await import('@vercel/kv');
      const mintKey = `minted:${stripeSessionId}`;
      const alreadyMinted = await kv.get(mintKey);

      if (alreadyMinted) {
        return NextResponse.json(
          { error: 'Credential already minted for this payment' },
          { status: 409 },
        );
      }
    } catch {
      // KV not configured — skip idempotency check (dev mode)
      console.warn('[mint-credential] KV not configured — skipping idempotency check');
    }

    // ── 4. Derive claims from Stripe metadata ─────────────────────────────────
    const metadata = session.metadata ?? {};
    const baseClaims = deriveClaimsFromMetadata(metadata);
    const claims = { ...baseClaims, requestRef };

    // ── 5. Sign the mint authorization ────────────────────────────────────────
    const signature = await signMintAuthorization({
      recipient,
      claims,
      chainId: BASE_CHAIN_ID,
      contractAddress,
    });

    const expiry = Math.floor(Date.now() / 1000) + 60 * 15;

    // ── 6. Mark as minted in KV (after signing, before returning) ─────────────
    try {
      const { kv } = await import('@vercel/kv');
      await kv.set(
        `minted:${stripeSessionId}`,
        { recipient, requestRef, mintedAt: new Date().toISOString() },
        { ex: 60 * 60 * 24 * 365 }, // 1 year TTL
      );
    } catch {
      // KV not available — log but continue
      console.warn('[mint-credential] KV set failed — minted flag not persisted');
    }

    console.log(`[mint-credential] ✅ Signed for ${recipient} ref=${requestRef}`);

    return NextResponse.json({
      claims,
      recipient,
      expiry,
      signature,
      contractAddress,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Mint authorization failed';
    console.error('[mint-credential]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
