export interface ProoflySession {
  stateCode: string;

  form: {
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

  uploads: {
    photoIdBlobUrl: string | null;
    photoIdHash: string | null;
    photoIdName: string | null;
    photoIdSize: number | null;
  };

  signature: {
    dataUrl: string | null;
    signedAt: string | null;
  };

  payment: {
    method: 'stripe' | 'usdc' | null;
    stripeSessionId: string | null;
    status: 'pending' | 'paid' | null;
  };

  fulfillment: {
    lobLetterId: string | null;
    lobCheckId: string | null;
    trackingNumber: string | null;
    mailedAt: string | null;
    deletionReceiptHash: string | null;
    requestRef: string | null;
    attestationUIDs: {
      authorization: string | null;
      fulfillment: string | null;
      deletion: string | null;
    };
  };
}

const SESSION_KEY = 'prooflySession_v1';

export function getSession(): Partial<ProoflySession> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || '{}');
  } catch {
    return {};
  }
}

export function saveSession(patch: Partial<ProoflySession>): void {
  const current = getSession();
  const merged: Record<string, unknown> = { ...current };
  for (const key of Object.keys(patch) as (keyof ProoflySession)[]) {
    const patchVal = patch[key];
    const currentVal = current[key];
    if (
      patchVal !== null &&
      typeof patchVal === 'object' &&
      !Array.isArray(patchVal) &&
      currentVal !== null &&
      typeof currentVal === 'object'
    ) {
      merged[key] = { ...(currentVal as object), ...(patchVal as object) };
    } else {
      merged[key] = patchVal;
    }
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(merged));
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

/**
 * Compute total charge in cents.
 * firstCopy, additionalCopy, prooflyService, lobPostage are all in cents.
 */
export function computeTotalCents(
  firstCopy: number,
  additionalCopy: number,
  prooflyService: number,
  lobPostage: number,
  copies: number,
): number {
  const copyCost = firstCopy + Math.max(0, copies - 1) * additionalCopy;
  return copyCost + prooflyService + lobPostage;
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
