/**
 * EAS attestation via direct ethers contract call.
 *
 * We intentionally bypass the EAS SDK's Transaction wrapper (eas.attest())
 * because SDK versions disagree on whether .wait() returns a UID string or
 * a TransactionResponse. Calling the contract directly with ethers v6 is
 * unambiguous: txResponse.wait(1) always returns a TransactionReceipt.
 */

import { SchemaEncoder } from '@ethereum-attestation-service/eas-sdk';
import { ethers } from 'ethers';
import { DeletionReceipt } from './deletion';

const EAS_CONTRACT_ADDRESS = '0x4200000000000000000000000000000000000021';
const BASE_RPC = 'https://mainnet.base.org';

// Minimal ABI — attest() + Attested event only
const EAS_ABI = [
  'function attest((bytes32 schema, (address recipient, uint64 expirationTime, bool revocable, bytes32 refUID, bytes data, uint256 value) data) request) payable returns (bytes32)',
  'event Attested(address indexed recipient, address indexed attester, bytes32 uid, bytes32 indexed schemaUID)',
];

export interface AttestationUIDs {
  authorization: string | null;
  fulfillment:   string | null;
  deletion:      string | null;
}

export async function emitAttestations(params: {
  stateCode:       string;
  signatureHash:   string;
  requestRef:      string;
  lobLetterId:     string;
  trackingNumber:  string | null;
  mailedToName:    string;
  deletionReceipt: DeletionReceipt;
}): Promise<AttestationUIDs> {
  const privateKey          = process.env.EAS_SIGNER_PRIVATE_KEY;
  const schemaAuthorization = process.env.EAS_SCHEMA_AUTHORIZATION;
  const schemaFulfillment   = process.env.EAS_SCHEMA_FULFILLMENT;
  const schemaDeletion      = process.env.EAS_SCHEMA_DELETION;

  if (!privateKey || !schemaAuthorization || !schemaFulfillment || !schemaDeletion) {
    console.warn('[EAS] Missing env vars — skipping attestations');
    return { authorization: null, fulfillment: null, deletion: null };
  }

  try {
    const provider = new ethers.JsonRpcProvider(BASE_RPC);
    const signer   = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(EAS_CONTRACT_ADDRESS, EAS_ABI, signer);
    const iface    = new ethers.Interface(EAS_ABI);
    const now      = BigInt(Math.floor(Date.now() / 1000));

    // ── Schema A: Authorization ──────────────────────────────────────────────
    const authEncoder = new SchemaEncoder(
      'address requestor,string stateCode,string requestType,bytes32 signatureHash,uint256 authorizedAt,bool agentAuthorized'
    );
    const authEncoded = authEncoder.encodeData([
      { name: 'requestor',       value: ethers.ZeroAddress,               type: 'address' },
      { name: 'stateCode',       value: params.stateCode,                 type: 'string'  },
      { name: 'requestType',     value: 'birth_certificate',              type: 'string'  },
      { name: 'signatureHash',   value: toBytes32(params.signatureHash),  type: 'bytes32' },
      { name: 'authorizedAt',    value: now,                              type: 'uint256' },
      { name: 'agentAuthorized', value: true,                             type: 'bool'    },
    ]);
    const authUID = await attest(contract, iface, schemaAuthorization, authEncoded, true);

    // ── Schema B: Fulfillment ────────────────────────────────────────────────
    const fulfillEncoder = new SchemaEncoder(
      'string stateCode,string requestType,string lobLetterId,string trackingNumber,string mailedToName,uint256 mailedAt,string requestRef'
    );
    const fulfillEncoded = fulfillEncoder.encodeData([
      { name: 'stateCode',      value: params.stateCode,            type: 'string'  },
      { name: 'requestType',    value: 'birth_certificate',         type: 'string'  },
      { name: 'lobLetterId',    value: params.lobLetterId,          type: 'string'  },
      { name: 'trackingNumber', value: params.trackingNumber ?? '', type: 'string'  },
      { name: 'mailedToName',   value: params.mailedToName,         type: 'string'  },
      { name: 'mailedAt',       value: now,                         type: 'uint256' },
      { name: 'requestRef',     value: params.requestRef,           type: 'string'  },
    ]);
    const fulfillUID = await attest(contract, iface, schemaFulfillment, fulfillEncoded, false);

    // ── Schema C: Data Destruction ───────────────────────────────────────────
    const { deletionReceipt } = params;
    const deletionEncoder = new SchemaEncoder(
      'bytes32[] fileHashes,uint256 deletedAt,string deletionMethod,bool allFilesDeleted,bytes32 receiptHash,string requestRef'
    );
    const deletionEncoded = deletionEncoder.encodeData([
      { name: 'fileHashes',      value: deletionReceipt.fileHashes.map(h => toBytes32(h.sha256)), type: 'bytes32[]' },
      { name: 'deletedAt',       value: BigInt(deletionReceipt.deletedAt),                        type: 'uint256'   },
      { name: 'deletionMethod',  value: deletionReceipt.deletionMethod,                           type: 'string'    },
      { name: 'allFilesDeleted', value: deletionReceipt.allFilesDeleted,                          type: 'bool'      },
      { name: 'receiptHash',     value: toBytes32(deletionReceipt.receiptHash),                   type: 'bytes32'   },
      { name: 'requestRef',      value: params.requestRef,                                        type: 'string'    },
    ]);
    const deletionUID = await attest(contract, iface, schemaDeletion, deletionEncoded, false);

    console.log('[EAS] ✅ All 3 attestations emitted:', { authUID, fulfillUID, deletionUID });
    return { authorization: authUID, fulfillment: fulfillUID, deletion: deletionUID };

  } catch (err) {
    console.error('[EAS] Attestation failed:', err);
    return { authorization: null, fulfillment: null, deletion: null };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Send one attestation directly via the EAS contract.
 * Uses ethers v6 TransactionResponse.wait() — no SDK wrapper involved.
 */
async function attest(
  contract: ethers.Contract,
  iface: ethers.Interface,
  schemaUID: string,
  encodedData: string,
  revocable: boolean,
): Promise<string | null> {
  const request = {
    schema: schemaUID,
    data: {
      recipient:      ethers.ZeroAddress,
      expirationTime: BigInt(0),
      revocable,
      refUID:         ethers.ZeroHash,
      data:           encodedData,
      value:          BigInt(0),
    },
  };

  // This is a plain ethers v6 TransactionResponse — always has .wait()
  const tx: ethers.TransactionResponse = await contract.attest(request);
  const receipt = await tx.wait(1);

  if (!receipt) {
    console.warn('[EAS] No receipt for tx:', tx.hash);
    return tx.hash; // fallback — at least return something linkable
  }

  // Parse Attested(address,address,bytes32,bytes32) event
  // uid is NOT indexed — it lives in log.data, parsed via interface
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
      if (parsed?.name === 'Attested') {
        return parsed.args['uid'] as string;
      }
    } catch {
      // Not our event — skip
    }
  }

  console.warn('[EAS] Attested event not found in receipt logs — returning tx hash');
  return tx.hash;
}

/** Convert any hex hash string to a padded 0x-prefixed bytes32 string */
function toBytes32(hex: string): string {
  return '0x' + hex.replace(/^0x/, '').slice(0, 64).padEnd(64, '0');
}
