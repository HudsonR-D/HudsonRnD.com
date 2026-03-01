'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';
import { getSession } from '@/lib/session';

const EAS_EXPLORER = 'https://base.easscan.org/attestation/view';

type AttestationData = {
  authorization: string | null;
  fulfillment: string | null;
  deletion: string | null;
  requestRef: string | null;
  deletionReceiptHash: string | null;
};

export default function ClaimClient() {
  const searchParams = useSearchParams();
  const ref = searchParams.get('ref');
  const { address, isConnected } = useAccount();

  const [attestations, setAttestations] = useState<AttestationData>({
    authorization: null,
    fulfillment: null,
    deletion: null,
    requestRef: null,
    deletionReceiptHash: null,
  });
  const [minting, setMinting] = useState(false);
  const [minted, setMinted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const session = getSession();
    if (session.fulfillment) {
      setAttestations({
        authorization: session.fulfillment.attestationUIDs?.authorization ?? null,
        fulfillment: session.fulfillment.attestationUIDs?.fulfillment ?? null,
        deletion: session.fulfillment.attestationUIDs?.deletion ?? null,
        requestRef: session.fulfillment.requestRef ?? ref ?? null,
        deletionReceiptHash: session.fulfillment.deletionReceiptHash ?? null,
      });
    }
  }, [ref]);

  const handleMintCredential = async () => {
    if (!address) return;
    setMinting(true);
    setError(null);

    try {
      // Phase 3: this will call /api/mint-credential which issues a soulbound EAS token
      // For now, show the Phase 3 coming-soon state
      await new Promise(r => setTimeout(r, 1500)); // simulate
      throw new Error('PHASE_3_PENDING');
    } catch (err) {
      if (err instanceof Error && err.message === 'PHASE_3_PENDING') {
        setError('Soulbound credential minting is coming in Phase 3. Your attestations above are already verifiable on-chain.');
      } else {
        setError(err instanceof Error ? err.message : 'Minting failed');
      }
    } finally {
      setMinting(false);
    }
  };

  const hasAttestations = attestations.authorization || attestations.fulfillment || attestations.deletion;

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

        {/* Wallet connect */}
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
                No account required for the main Proofly service — this step is purely optional.
                A wallet lets you receive verifiable on-chain credentials.
              </p>
              <ConnectButton />
            </div>
          )}
        </div>

        {/* Existing attestations */}
        {hasAttestations && (
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 space-y-4">
            <p className="text-sm font-semibold text-zinc-300">
              Step 2 — Your on-chain attestations
            </p>
            <p className="text-xs text-zinc-500">
              These are already live on Base mainnet. Anyone can verify them without you sharing any personal information.
            </p>

            <div className="space-y-3">
              {[
                {
                  label: 'Authorization',
                  uid: attestations.authorization,
                  desc: 'Proves you authorized Proofly to file on your behalf',
                  icon: '✍️',
                },
                {
                  label: 'Fulfillment',
                  uid: attestations.fulfillment,
                  desc: 'Proves your packet was mailed to the vital records office',
                  icon: '📬',
                },
                {
                  label: 'Data Destruction',
                  uid: attestations.deletion,
                  desc: 'Cryptographic proof that all your documents were deleted',
                  icon: '🔒',
                },
              ].map(({ label, uid, desc, icon }) => (
                <div
                  key={label}
                  className={`rounded-xl border p-4 ${uid
                    ? 'border-teal-500/30 bg-teal-950/20'
                    : 'border-zinc-800 bg-zinc-800/30 opacity-50'
                  }`}
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
                      <a
                        href={`${EAS_EXPLORER}/${uid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-teal-400 hover:text-teal-300 underline font-mono shrink-0"
                      >
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
                <p className="text-xs font-mono text-zinc-400 break-all">
                  {attestations.deletionReceiptHash}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Soulbound credential mint */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-zinc-300">Step 3 — Mint soulbound credential</p>
            <span className="text-xs bg-teal-500/10 text-teal-400 border border-teal-500/20 px-2 py-0.5 rounded-full">
              Phase 3
            </span>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed">
            A non-transferable ERC-5192 token will be issued to your wallet containing
            only ZK-proven claims — no dates, no addresses, no PII:
          </p>

          <div className="grid grid-cols-2 gap-2">
            {[
              { claim: 'Age ≥ 18', desc: 'ZK proven, DOB never stored' },
              { claim: 'Age ≥ 21', desc: 'ZK proven, DOB never stored' },
              { claim: 'CO Resident', desc: 'ZK proven, address never stored' },
              { claim: 'Birth cert obtained', desc: 'Via authorized agent filing' },
            ].map(({ claim, desc }) => (
              <div key={claim} className="bg-slate-950 border border-zinc-800 rounded-xl p-3">
                <p className="text-sm font-semibold text-white">{claim}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{desc}</p>
              </div>
            ))}
          </div>

          {error && (
            <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-3">
              <p className="text-xs text-amber-300">{error}</p>
            </div>
          )}

          <button
            onClick={handleMintCredential}
            disabled={!isConnected || minting || minted}
            className={`
              w-full py-4 rounded-xl font-semibold text-sm transition
              ${isConnected && !minted
                ? 'bg-teal-500 hover:bg-teal-400 text-slate-950'
                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'}
              disabled:opacity-60
            `}
          >
            {minting
              ? 'Minting…'
              : minted
              ? '✅ Credential minted'
              : !isConnected
              ? 'Connect wallet first'
              : 'Mint Soulbound Credential'}
          </button>

          {!isConnected && (
            <p className="text-xs text-center text-zinc-600">
              Connect your wallet above to enable minting
            </p>
          )}
        </div>

        {/* Skip / back */}
        <div className="text-center space-y-3">
          <Link
            href="/confirmation"
            className="block text-sm text-zinc-500 hover:text-zinc-300 transition py-2"
          >
            ← Back to confirmation
          </Link>
          <Link
            href="/"
            className="block text-xs text-zinc-600 hover:text-zinc-400 transition"
          >
            Start a new request
          </Link>
        </div>
      </div>
    </div>
  );
}
