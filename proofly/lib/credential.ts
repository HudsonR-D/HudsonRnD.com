/**
 * lib/credential.ts
 *
 * Server-side claim derivation and mint-authorization signing.
 *
 * Privacy model (signed-attestation MVP):
 *   - The server already processed the request and deleted all PII.
 *   - Derived boolean claims (age ≥ 18, age ≥ 21, state resident, cert obtained)
 *     were computed from the original data before deletion.
 *   - Those booleans are stored in Stripe session metadata — NOT raw DOB/address.
 *   - The server signs {recipient, claims, requestRef, expiry} so the contract
 *     can verify the signature without ever seeing PII.
 *
 * ZK upgrade path:
 *   In a future phase, this signing step will be replaced by a ZK proof generated
 *   from the deleted data's cryptographic commitments. The on-chain verification
 *   logic stays identical — only the proof format changes. See contracts/README.md.
 */

import { ethers } from 'ethers';
import Stripe from 'stripe';

export interface MintClaims {
  isAgeOver18:    boolean;
  isAgeOver21:    boolean;
  isStateResident: boolean;
  certObtained:   boolean;
  stateCode:      string;
  requestRef:     string;
}

export interface SignedMintPayload {
  claims:     MintClaims;
  recipient:  string;   // wallet address
  expiry:     number;   // unix timestamp — 15 min window
  signature:  string;   // EIP-712 sig from PROOFLY_SIGNER_ADDRESS
  contractAddress: string;
}

const DOMAIN_NAME    = 'ProoflyCredential';
const DOMAIN_VERSION = '1';

const CLAIM_TYPES = {
  MintAuthorization: [
    { name: 'recipient',       type: 'address' },
    { name: 'stateCode',       type: 'string'  },
    { name: 'isAgeOver18',     type: 'bool'    },
    { name: 'isAgeOver21',     type: 'bool'    },
    { name: 'isStateResident', type: 'bool'    },
    { name: 'certObtained',    type: 'bool'    },
    { name: 'requestRef',      type: 'string'  },
    { name: 'expiry',          type: 'uint256' },
  ],
};

/**
 * Derive boolean claims from Stripe session metadata.
 * The process route writes these after computing them from the (now-deleted) raw data.
 */
export function deriveClaimsFromMetadata(
  metadata: Stripe.Metadata,
): Omit<MintClaims, 'requestRef'> {
  return {
    stateCode:       metadata.stateCode      ?? 'CO',
    isAgeOver18:     metadata.isAgeOver18    === 'true',
    isAgeOver21:     metadata.isAgeOver21    === 'true',
    isStateResident: metadata.isStateResident === 'true',
    certObtained:    true, // always true if request completed successfully
  };
}

/**
 * Sign a mint authorization using EIP-712.
 * The contract verifies this signature in mint() to prevent unauthorized mints.
 */
export async function signMintAuthorization(params: {
  recipient:  string;
  claims:     MintClaims;
  chainId:    number;
  contractAddress: string;
}): Promise<string> {
  const privateKey = process.env.EAS_SIGNER_PRIVATE_KEY;
  if (!privateKey) throw new Error('EAS_SIGNER_PRIVATE_KEY not configured');

  const signer = new ethers.Wallet(privateKey);
  const expiry = Math.floor(Date.now() / 1000) + 60 * 15; // 15-minute window

  const domain = {
    name:              DOMAIN_NAME,
    version:           DOMAIN_VERSION,
    chainId:           params.chainId,
    verifyingContract: params.contractAddress,
  };

  const value = {
    recipient:       params.recipient,
    stateCode:       params.claims.stateCode,
    isAgeOver18:     params.claims.isAgeOver18,
    isAgeOver21:     params.claims.isAgeOver21,
    isStateResident: params.claims.isStateResident,
    certObtained:    params.claims.certObtained,
    requestRef:      params.claims.requestRef,
    expiry,
  };

  const signature = await signer.signTypedData(domain, CLAIM_TYPES, value);
  return signature;
}

/**
 * Verify a mint authorization signature (used in tests / admin verification).
 */
export function verifyMintSignature(payload: SignedMintPayload, expectedSigner: string): boolean {
  try {
    const expiry = Math.floor(Date.now() / 1000);
    if (payload.expiry < expiry) return false; // expired

    const domain = {
      name:              DOMAIN_NAME,
      version:           DOMAIN_VERSION,
      chainId:           8453, // Base mainnet
      verifyingContract: payload.contractAddress,
    };

    const value = {
      recipient:       payload.recipient,
      stateCode:       payload.claims.stateCode,
      isAgeOver18:     payload.claims.isAgeOver18,
      isAgeOver21:     payload.claims.isAgeOver21,
      isStateResident: payload.claims.isStateResident,
      certObtained:    payload.claims.certObtained,
      requestRef:      payload.claims.requestRef,
      expiry:          payload.expiry,
    };

    const recovered = ethers.verifyTypedData(domain, CLAIM_TYPES, value, payload.signature);
    return recovered.toLowerCase() === expectedSigner.toLowerCase();
  } catch {
    return false;
  }
}
