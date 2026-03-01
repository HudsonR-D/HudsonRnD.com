import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

// Minimal ABI — only what we need for metadata reads
const ABI = [
  'function getCredential(uint256 tokenId) view returns (tuple(string stateCode, bool isAgeOver18, bool isAgeOver21, bool isStateResident, bool certObtained, string requestRef, uint256 attestedAt))',
  'function ownerOf(uint256 tokenId) view returns (address)',
];

const BASE_RPC           = 'https://mainnet.base.org';
const CONTRACT_ADDRESS   = process.env.PROOFLY_CONTRACT_ADDRESS;

const STATE_NAMES: Record<string, string> = {
  CO: 'Colorado', TX: 'Texas', NY: 'New York',
  FL: 'Florida',  CA: 'California',
};

/**
 * ERC-721 metadata endpoint.
 * Called by wallets, OpenSea, and any dApp reading token metadata.
 * URL: /api/credential-metadata/[tokenId]
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { tokenId: string } },
): Promise<NextResponse> {
  const tokenId = parseInt(params.tokenId, 10);
  if (isNaN(tokenId) || tokenId < 1) {
    return NextResponse.json({ error: 'Invalid token ID' }, { status: 400 });
  }

  if (!CONTRACT_ADDRESS) {
    return NextResponse.json({ error: 'Contract not deployed yet' }, { status: 503 });
  }

  try {
    const provider = new ethers.JsonRpcProvider(BASE_RPC);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

    const [cred, owner] = await Promise.all([
      contract.getCredential(tokenId),
      contract.ownerOf(tokenId),
    ]);

    const stateName = STATE_NAMES[cred.stateCode] ?? cred.stateCode;
    const attestedDate = new Date(Number(cred.attestedAt) * 1000).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });

    // Build attributes array — only truthy claims included
    const attributes = [
      { trait_type: 'State',                  value: stateName             },
      { trait_type: 'Certificate Obtained',   value: 'Yes'                 },
      { trait_type: 'Issued By',              value: 'Proofly'             },
      { trait_type: 'Attested',               value: attestedDate          },
      { trait_type: 'Request Reference',      value: cred.requestRef       },
      ...(cred.isAgeOver18     ? [{ trait_type: 'Age Verified',     value: '18+' }] : []),
      ...(cred.isAgeOver21     ? [{ trait_type: 'Age Verified',     value: '21+' }] : []),
      ...(cred.isStateResident ? [{ trait_type: 'State Residency',  value: `${stateName} Resident` }] : []),
    ];

    const metadata = {
      name:        `Proofly Credential #${tokenId}`,
      description: [
        `A soulbound credential proving ${owner.slice(0, 8)}… obtained a ${stateName} birth certificate via Proofly.`,
        '',
        `Claims are derived from data that was immediately deleted after processing.`,
        `No personally identifiable information is stored on-chain.`,
        '',
        `⚠️ Note: Claims are currently verified via server signature. Zero-knowledge proof verification is planned for a future contract upgrade.`,
      ].join('\n'),
      image:       `${process.env.NEXT_PUBLIC_APP_URL}/api/credential-image/${tokenId}`,
      external_url: `${process.env.NEXT_PUBLIC_APP_URL}/claim`,
      attributes,
    };

    return NextResponse.json(metadata, {
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (err: unknown) {
    // Token doesn't exist — ERC-721 throws on non-existent tokenId
    if (err instanceof Error && err.message.includes('ERC721NonexistentToken')) {
      return NextResponse.json({ error: 'Token not found' }, { status: 404 });
    }
    console.error('[credential-metadata]', err);
    return NextResponse.json({ error: 'Failed to fetch credential' }, { status: 500 });
  }
}