'use client';
// app/consent/ConsentClient.tsx
// This file uses wagmi hooks and only runs in the browser (never on the server).
// It is imported via dynamic({ ssr: false }) from consent/page.tsx.

import { useState, useEffect } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { EAS, SchemaEncoder } from '@ethereum-attestation-service/eas-sdk';
import { Badge } from '@/components/ui/badge';

const EAS_CONTRACT_ADDRESS = '0x4200000000000000000000000000000000000021';
const SCHEMA_UID = '0x6ac87b3f4c7a0678447856c42bc08b837ecfdc24c4b67862fd21f2150059607b';

export default function ConsentClient() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [fullName, setFullName] = useState('');
  const [attesting, setAttesting] = useState(false);
  const [attestationUID, setAttestationUID] = useState('');
  const [explorerLink, setExplorerLink] = useState('');

  // Pre-fill name if carried over from /request via localStorage
  useEffect(() => {
    const savedName = localStorage.getItem('prooflyFullName');
    if (savedName) setFullName(savedName);
  }, []);

  const consentText = `I, ${fullName || '[Your Full Name]'}, wallet ${address || '0x...'}, authorize Proofly to act as my agent for submitting a Colorado birth certificate request on my behalf. Privacy-first, data deleted after on-chain attestation.`;

  const handleSign = async () => {
    if (!address || !fullName.trim()) {
      alert('Connect your wallet and enter your full name first.');
      return;
    }
    if (!walletClient) {
      alert('Wallet not ready — try disconnecting and reconnecting.');
      return;
    }

    setAttesting(true);

    try {
      const eas = new EAS(EAS_CONTRACT_ADDRESS);
      // walletClient from wagmi is Viem-compatible — EAS SDK accepts it
      eas.connect(walletClient as any);

      const schemaEncoder = new SchemaEncoder(
        'string consentFor, address user, bytes32 idHash, uint256 issuedAt, bool reusable'
      );

      const encodedData = schemaEncoder.encodeData([
        { name: 'consentFor', value: 'Colorado birth certificate request', type: 'string' },
        { name: 'user', value: address, type: 'address' },
        {
          name: 'idHash',
          value: '0x0000000000000000000000000000000000000000000000000000000000000000',
          type: 'bytes32',
        },
        { name: 'issuedAt', value: BigInt(Math.floor(Date.now() / 1000)), type: 'uint256' },
        { name: 'reusable', value: true, type: 'bool' },
      ]);

      const tx = await eas.attest({
        schema: SCHEMA_UID,
        data: {
          recipient: address,
          expirationTime: BigInt(0),
          revocable: true,
          refUID: '0x0000000000000000000000000000000000000000000000000000000000000000',
          data: encodedData,
        },
      });

      // tx.wait() returns the attestation UID string — this is correct EAS SDK v2 usage
      const newUID = await tx.wait();
      setAttestationUID(newUID);
      setExplorerLink(`https://base.easscan.org/attestation/view/${newUID}`);

      // Save UID to localStorage so review/page.tsx can read it
      localStorage.setItem('prooflyAttestationUID', newUID);

    } catch (err: any) {
      console.error('EAS attest error:', err);
      alert('Attestation failed: ' + (err.shortMessage || err.message || 'Check console'));
    } finally {
      setAttesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 to-black text-white flex items-center justify-center p-6">
      <Card className="w-full max-w-2xl bg-zinc-900 border-white/20">
        <CardHeader>
          <CardTitle className="text-3xl text-center">Reusable Consent Authorization</CardTitle>
          <p className="text-center text-zinc-400">One-time on-chain signature • reusable forever</p>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Step indicator */}
          <p className="text-xs text-zinc-500 text-center">Step 3 of 5 — Consent</p>

          <div>
            <label className="text-zinc-300 block mb-2">Your Full Legal Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:border-teal-500"
              placeholder="Enter your full legal name"
            />
          </div>

          <div>
            <label className="text-zinc-300 block mb-2">Consent Letter Preview</label>
            <Textarea
              readOnly
              value={consentText}
              className="bg-zinc-950 border-zinc-700 text-zinc-300 min-h-[140px] font-mono text-sm resize-none"
            />
          </div>

          {!isConnected ? (
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm text-zinc-400">Connect your wallet to sign</p>
              <ConnectButton />
            </div>
          ) : (
            <Button
              onClick={handleSign}
              disabled={attesting || !fullName.trim()}
              size="lg"
              className="w-full text-lg py-7 rounded-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
            >
              {attesting ? 'Signing on Base...' : 'Sign with Wallet → Create EAS Attestation'}
            </Button>
          )}

          {attestationUID && explorerLink && (
            <div className="text-center pt-6 border-t border-white/10 space-y-4">
              <Badge className="text-base px-6 py-3 bg-emerald-500 hover:bg-emerald-500">
                ✅ Consent attested on Base
              </Badge>
              <p>
                <a
                  href={explorerLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 underline hover:text-emerald-300 text-sm"
                >
                  View on Base EAS Explorer →
                </a>
              </p>
              <Button
                onClick={() => window.location.href = '/review'}
                size="lg"
                className="w-full text-lg py-7 rounded-full bg-white text-black hover:bg-zinc-200"
              >
                Continue to Review & Pay →
              </Button>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
}