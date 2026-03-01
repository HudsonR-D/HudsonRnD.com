import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getState } from '@/lib/states';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-02-25.clover',
  });

  try {
    const body = await request.json();
    const {
      stateCode,
      copies,
      email,
      blobUrl,
      fileHash,
      signatureDataUrl,
      formData,
    } = body;

    // Validate required fields
    if (!stateCode || !copies || !email || !blobUrl || !fileHash || !signatureDataUrl || !formData) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const stateConfig = getState(stateCode);

    // Compute line items from StateConfig — no hardcoded prices
    const { firstCopy, additionalCopy, prooflyService } = stateConfig.fees;
    const copiesCount = Math.max(1, Math.min(10, Number(copies)));

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${stateConfig.name} Birth Certificate — First Copy`,
            description: `Official certified copy from ${stateConfig.vitalRecords.agencyName}`,
          },
          unit_amount: firstCopy,
        },
        quantity: 1,
      },
    ];

    if (copiesCount > 1) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${stateConfig.name} Birth Certificate — Additional Copies`,
            description: `${copiesCount - 1} additional certified ${copiesCount - 1 === 1 ? 'copy' : 'copies'}`,
          },
          unit_amount: additionalCopy,
        },
        quantity: copiesCount - 1,
      });
    }

    if (prooflyService > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Proofly Filing Service',
            description: 'Secure document handling, filing, and on-chain deletion proof',
          },
          unit_amount: prooflyService,
        },
        quantity: 1,
      });
    }

    // Stripe metadata: all strings, max 500 chars each, max 50 keys
    // This is what /api/process reads after webhook fires
    // We store formData as JSON string — it's small (names, dates, address)
    const formDataStr = JSON.stringify(formData);
    if (formDataStr.length > 480) {
      return NextResponse.json(
        { error: 'Form data too large for metadata' },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      customer_email: email,
      success_url: `${appUrl}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/review?cancelled=true`,
      metadata: {
        stateCode,
        copies: String(copiesCount),
        blobUrl,
        fileHash,
        // signatureDataUrl can be large — truncate check
        signatureDataUrl: signatureDataUrl.slice(0, 480),
        formData: formDataStr,
      },
      payment_intent_data: {
        metadata: {
          stateCode,
          requestType: 'birth_certificate',
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    const message = error instanceof Error ? error.message : 'Checkout failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
