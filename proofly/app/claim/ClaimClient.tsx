'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';
import { getSession } from '@/lib/session';
import type { SignedMintPayload } from '@/lib/credential';

const EAS_EXPLORER = 'https://base.easscan.org/attestation/view';
const BASESCAN     = 'https://basescan.org/tx';

// Minimal ABI — only the mint function
const PROOFLY_ABI = [
  {
    name: 'mint',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to',            type: 'address' },
      { name: 'stateCode',     type: 'string'  },
      { name: 'isAgeOver18',   type: 'bool'    },
      { name: 'isAgeOver21',   type: 'bool'    },
      { name: 'isStateResident', type: 'bool'  },
      { name: 'certObtained',  type: 'bool'    },
      { name: 'requestRef',    type: 'string'  },
      { name: 'expiry',        type: 'uint256' },
      { name: 'signature',     type: 'bytes'   },
    ],
    outputs: [{ name: 'tokenId', type: 'uint256' }],
  },
] as const;

type AttestationData = {
  authorization:       string | null;
  fulfillment:         string | null;
  deletion:            string | null;
  requestRef:          string | null;
  deletionReceiptHash: string | null;
  stripeSessionId:     string | null;
};

type MintStep = 'idle' | 'fetching' | 'ready' | 'minting' | 'confirming' | 'done' | 'error';

export default function ClaimClient() {
  const searchParams   = useSearchParams();
  const ref            = searchParams.get('ref');
  const sessionId      = searchParams.get('session_id');
  const { address, isConnected } = useAccount();

  const [attestations, setAttestations] = useState<AttestationData>({
    authorization: null, fulfillment: null, deletion: null,
    requestRef: null, deletionReceiptHash: null, stripeSessionId: null,
  });
  const [mintPayload, setMintPayload] = useState<SignedMintPayload | null>(null);
  const [step, setStep]   = useState<MintStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const { writeContractAsync } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash as `0x${string}` | undefined,
  });

  // Load attestation UIDs from client-side session storage
  useEffect(() => {
    const session = getSession();
    if (session.fulfillment) {
      setAttestations({
        authorization:       session.fulfillment.attestationUIDs?.authorization ?? null,
        fulfillment:         session.fulfillment.attestationUIDs?.fulfillment   ?? null,
        deletion:            session.fulfillment.attestationUIDs?.deletion       ?? null,
        requestRef:          session.fulfillment.requestRef        ?? ref        ?? null,
        deletionReceiptHash: session.fulfillment.deletionReceiptHash             ?? null,
        stripeSessionId:     session.payment?.stripeSessionId      ?? sessionId  ?? null,
      });
    } else if (ref) {
      setAttestations(prev => ({ ...prev, requestRef: ref, stripeSessionId: sessionId }));
    }
  }, [ref, sessionId]);

  // Update confirming state
  useEffect(() => {
    if (isConfirming) setStep('confirming');
    if (isConfirmed)  setStep('done');
  }, [isConfirming, isConfirmed]);

  // Step A: fetch signed payload from server
  const fetchMintPayload = useCallback(async () => {
    if (!address || !attestations.requestRef || !attestations.stripeSessionId) return;
    setStep('fetching');
    setError(null);

    try {
      const res = await fetch('/api/mint-credential', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stripeSessionId: attestations.stripeSessionId,
          requestRef:      attestations.requestRef,
          recipient:       address,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Server error');
      setMintPayload(data as SignedMintPayload);
      setStep('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch mint authorization');
      setStep('error');
    }
  }, [address, attestations.requestRef, attestations.stripeSessionId]);

  // Step B: call contract.mint() with the signed payload
  const executeMint = useCallback(async () => {
    if (!mintPayload || !address) return;
    setStep('minting');
    setError(null);

    try {
      const hash = await writeContractAsync({
        address:      mintPayload.contractAddress as `0x${string}`,
        abi:          PROOFLY_ABI,
        functionName: 'mint',
        args: [
          address as `0x${string}`,
          mintPayload.claims.stateCode,
          mintPayload.claims.isAgeOver18,
          mintPayload.claims.isAgeOver21,
          mintPayload.claims.isStateResident,
          mintPayload.claims.certObtained,
          mintPayload.claims.requestRef,
          BigInt(mintPayload.expiry),
          mintPayload.signature as `0x${string}`,
        ],
      });
      setTxHash(hash);
      setStep('confirming');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Transaction failed';
      setError(msg.includes('User rejected') ? 'Transaction rejected in wallet' : msg);
      setStep('error');
    }
  }, [mintPayload, address, writeContractAsync]);

  const hasAttestations = attestations.authorization || attestations.fulfillment || attestations.deletion;
  const canFetch        = isConnected && !!attestations.requestRef && !!attestations.stripeSessionId && step === 'idle';

  return (
    <div className="min-h-screen bg-slate-950 text-white py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center space-y-3 py-4">
          <div className="text-5xl mb-2">🎖️</div>
          <h1 className="text-3xl font-bold">Claim Your Credential</h1>
          <p className="text-zinc-400">
            Connect your wallet to receive a soulbound credential proving you obtained
            your birth certificate — with zero PII on-chain.
          </p>
          {attestations.requestRef && (
            <p className="text-xs font-mono text-zinc-600">Ref: {attestations.requestRef}</p>
          )}
        </div>

        {/* ZK Disclaimer */}
        <div className="bg-amber-950/20 border border-amber-500/20 rounded-2xl p-4">
          <div className="flex gap-3 items-start">
            <span className="text-amber-400 text-sm mt-0.5">⚠️</span>
            <div>
              <p className="text-xs font-semibold text-amber-300 mb-1">
                Signed attestation model — ZK proofs planned
              </p>
              <p className="text-xs text-amber-200/70 leading-relaxed">
                Your claims (age, residency, cert obtained) are derived server-side from data
                that was immediately deleted after processing. No PII is stored or transmitted.
                The server signs these boolean claims with an EIP-712 signature — your raw
                DOB and address are never stored anywhere. We plan to replace this with true
                zero-knowledge proofs in a future upgrade, which will make the verification
                fully trustless. The current approach is safe and private.
              </p>
            </div>
          </div>
        </div>

        {/* Step 1 — Wallet */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 space-y-4">
          <p className="text-sm font-semibold text-zinc-300">Step 1 — Connect your wallet</p>
          {isConnected ? (
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-teal-400 rounded-full" />
              <p className="text-sm text-zinc-300 font-mono truncate">{address}</p>
              <ConnectButton accountStatus="avatar" showBalance={false} chainStatus="none" />
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-zinc-500">
                No wallet required for the main Proofly service — this is optional.
                A wallet lets you receive verifiable on-chain credentials.
              </p>
              <ConnectButton />
            </div>
          )}
        </div>

        {/* Step 2 — Existing attestations */}
        {hasAttestations && (
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 space-y-4">
            <p className="text-sm font-semibold text-zinc-300">Step 2 — Your on-chain attestations</p>
            <p className="text-xs text-zinc-500">
              Already live on Base mainnet. Anyone can verify without you sharing any personal information.
            </p>
            <div className="space-y-3">
              {[
                { label: 'Authorization',    uid: attestations.authorization, desc: 'Proves you authorized Proofly to file on your behalf',               icon: '✍️' },
                { label: 'Fulfillment',      uid: attestations.fulfillment,   desc: 'Proves your packet was mailed to the vital records office',           icon: '📬' },
                { label: 'Data Destruction', uid: attestations.deletion,      desc: 'Cryptographic proof that all your documents were permanently deleted', icon: '🔒' },
              ].map(({ label, uid, desc, icon }) => (
                <div
                  key={label}
                  className={`rounded-xl border p-4 ${uid ? 'border-teal-500/30 bg-teal-950/20' : 'border-zinc-800 bg-zinc-800/30 opacity-50'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex gap-2.5 items-start">
                      <span className="text-base mt-0.5">{icon}</span>
                      <div>
                        <p className="text-sm font-medium text-white">{label}</p>
                        <p className="text-xs text-zinc-400 mt-0.5">{desc}</p>
                      </div>
                    </div>
                    {uid ? (
                      <a href={`${EAS_EXPLORER}/${uid}`} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-teal-400 hover:text-teal-300 underline font-mono shrink-0">
                        {uid.slice(0, 8)}…
                      </a>
                    ) : (
                      <span className="text-xs text-zinc-600">Pending</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {attestations.deletionReceiptHash && (
              <div className="bg-slate-950 border border-zinc-800 rounded-xl p-3">
                <p className="text-xs text-zinc-500 mb-1">Deletion receipt hash</p>
                <p className="text-xs font-mono text-zinc-400 break-all">{attestations.deletionReceiptHash}</p>
              </div>
            )}
          </div>
        )}

        {/* Step 3 — Mint */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 space-y-4">
          <p className="text-sm font-semibold text-zinc-300">Step 3 — Mint soulbound credential</p>

          <p className="text-xs text-zinc-400 leading-relaxed">
            A non-transferable ERC-5192 token issued to your wallet containing only
            proven boolean claims — no dates, no addresses, no PII:
          </p>

          {/* Claims grid */}
          {mintPayload && (
            <div className="grid grid-cols-2 gap-2">
              {[
                { claim: 'Age ≥ 18',        val: mintPayload.claims.isAgeOver18,     desc: 'Server-derived, DOB deleted' },
                { claim: 'Age ≥ 21',        val: mintPayload.claims.isAgeOver21,     desc: 'Server-derived, DOB deleted' },
                { claim: `${mintPayload.claims.stateCode} Resident`, val: mintPayload.claims.isStateResident, desc: 'Server-derived, address deleted' },
                { claim: 'Birth cert obtained', val: mintPayload.claims.certObtained, desc: 'Via authorized agent filing' },
              ].map(({ claim, val, desc }) => (
                <div key={claim} className={`border rounded-xl p-3 ${val ? 'border-teal-500/30 bg-teal-950/20' : 'border-zinc-800 bg-zinc-800/30 opacity-50'}`}>
                  <p className="text-sm font-semibold text-white">{val ? '✓ ' : '✗ '}{claim}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{desc}</p>
                </div>
              ))}
            </div>
          )}

          {!mintPayload && (
            <div className="grid grid-cols-2 gap-2 opacity-40">
              {['Age ≥ 18', 'Age ≥ 21', 'State Resident', 'Birth cert obtained'].map(c => (
                <div key={c} className="border border-zinc-800 rounded-xl p-3">
                  <p className="text-sm font-semibold text-white">{c}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">Verified after payment check</p>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-950/30 border border-red-500/30 rounded-xl p-3">
              <p className="text-xs text-red-300">{error}</p>
              <button onClick={() => { setStep('idle'); setError(null); }}
                className="text-xs text-red-400 underline mt-1">Try again</button>
            </div>
          )}

          {/* Done state */}
          {step === 'done' && txHash && (
            <div className="bg-teal-950/30 border border-teal-500/30 rounded-xl p-4 text-center space-y-2">
              <p className="text-teal-400 font-semibold">✅ Credential minted!</p>
              <a href={`${BASESCAN}/${txHash}`} target="_blank" rel="noopener noreferrer"
                className="text-xs text-teal-300 underline font-mono">
                View on Basescan →
              </a>
            </div>
          )}

          {/* Action buttons */}
          {step !== 'done' && (
            <>
              {/* Fetch claims button */}
              {(step === 'idle' || step === 'error') && (
                <button
                  onClick={fetchMintPayload}
                  disabled={!canFetch}
                  className={`w-full py-4 rounded-xl font-semibold text-sm transition
                    ${canFetch ? 'bg-zinc-700 hover:bg-zinc-600 text-white' : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'}`}
                >
                  {!isConnected ? 'Connect wallet first' : !attestations.stripeSessionId ? 'Session ID missing — check your confirmation email' : 'Verify payment & get claims'}
                </button>
              )}

              {step === 'fetching' && (
                <div className="w-full py-4 rounded-xl bg-zinc-800 text-zinc-400 text-sm text-center animate-pulse">
                  Verifying payment…
                </div>
              )}

              {/* Mint button */}
              {step === 'ready' && mintPayload && (
                <button
                  onClick={executeMint}
                  className="w-full py-4 rounded-xl font-semibold text-sm transition bg-teal-500 hover:bg-teal-400 text-slate-950"
                >
                  Mint Soulbound Credential (~$0.01 gas)
                </button>
              )}

              {(step === 'minting' || step === 'confirming') && (
                <div className="w-full py-4 rounded-xl bg-teal-900/40 border border-teal-500/30 text-teal-300 text-sm text-center animate-pulse">
                  {step === 'minting' ? 'Waiting for wallet approval…' : 'Confirming on Base…'}
                </div>
              )}
            </>
          )}
        </div>

        {/* Back / skip */}
        <div className="text-center space-y-3">
          <Link href="/confirmation" className="block text-sm text-zinc-500 hover:text-zinc-300 transition py-2">
            ← Back to confirmation
          </Link>
          <Link href="/" className="block text-xs text-zinc-600 hover:text-zinc-400 transition">
            Start a new request
          </Link>
        </div>

      </div>
    </div>
  );
}
