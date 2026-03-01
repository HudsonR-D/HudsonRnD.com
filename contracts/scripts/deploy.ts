import hre, { ethers } from 'hardhat';
import * as dotenv from 'dotenv';

dotenv.config();

// EAS SchemaRegistry — same predeploy address on Base and Base Sepolia
const SCHEMA_REGISTRY = '0x4200000000000000000000000000000000000020';

const SCHEMA_REGISTRY_ABI = [
  'function register(string calldata schema, address resolver, bool revocable) external returns (bytes32 uid)',
  'function getSchema(bytes32 uid) external view returns (tuple(bytes32 uid, address resolver, bool revocable, string schema))',
  'event Registered(bytes32 indexed uid, address indexed registrant, tuple(bytes32 uid, address resolver, bool revocable, string schema) schema)',
];

// The 3 schemas that eas.ts expects as env vars
const SCHEMAS = [
  {
    envKey: 'EAS_SCHEMA_AUTHORIZATION',
    schema:
      'address requestor,string stateCode,string requestType,bytes32 signatureHash,uint256 authorizedAt,bool agentAuthorized',
    revocable: true,
  },
  {
    envKey: 'EAS_SCHEMA_FULFILLMENT',
    schema:
      'string stateCode,string requestType,string lobLetterId,string trackingNumber,string mailedToName,uint256 mailedAt,string requestRef',
    revocable: false,
  },
  {
    envKey: 'EAS_SCHEMA_DELETION',
    schema:
      'bytes32[] fileHashes,uint256 deletedAt,string deletionMethod,bool allFilesDeleted,bytes32 receiptHash,string requestRef',
    revocable: false,
  },
];

/**
 * Mirrors EAS SchemaRegistry._getUID() — deterministic UID from schema params.
 * Used as a fallback when register() reverts (e.g. schema already exists).
 */
function computeSchemaUID(schema: string, resolver: string, revocable: boolean): string {
  return ethers.keccak256(
    ethers.solidityPacked(['string', 'address', 'bool'], [schema, resolver, revocable]),
  );
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = hre.network.name;
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log('Network:  ', network);
  console.log('Deployer: ', deployer.address);
  console.log('Balance:  ', ethers.formatEther(balance), 'ETH\n');

  const appBaseUrl = process.env.APP_BASE_URL;
  if (!appBaseUrl) throw new Error('APP_BASE_URL not set in .env');

  // ── Deploy ProoflyCredential (skip if already deployed) ──────────────────
  let contractAddress = process.env.PROOFLY_CONTRACT_ADDRESS;

  if (contractAddress) {
    console.log('ProoflyCredential already deployed:', contractAddress, '(skipping)\n');
  } else {
    console.log('Deploying ProoflyCredential...');
    const ProoflyCredential = await ethers.getContractFactory('ProoflyCredential');
    const contract = await ProoflyCredential.deploy(deployer.address, appBaseUrl);
    await contract.waitForDeployment();
    contractAddress = await contract.getAddress();
    console.log('ProoflyCredential:', contractAddress, '\n');
  }

  // ── Register EAS Schemas ─────────────────────────────────────────────────
  const registry = new ethers.Contract(SCHEMA_REGISTRY, SCHEMA_REGISTRY_ABI, deployer);
  const schemaUIDs: Record<string, string> = {};

  for (const s of SCHEMAS) {
    const expectedUID = computeSchemaUID(s.schema, ethers.ZeroAddress, s.revocable);

    // Check if already registered before attempting to register
    try {
      const existing = await registry.getSchema(expectedUID);
      if (existing.uid !== ethers.ZeroHash) {
        console.log(`${s.envKey}: already registered`);
        console.log(`  UID: ${expectedUID}`);
        schemaUIDs[s.envKey] = expectedUID;
        continue;
      }
    } catch {
      // getSchema call failed — fall through to register attempt
    }

    // Attempt registration
    console.log(`Registering ${s.envKey}...`);
    try {
      const tx = await registry.register(s.schema, ethers.ZeroAddress, s.revocable);
      const receipt = await tx.wait(1);

      let uid = expectedUID; // default to computed UID
      for (const log of receipt.logs) {
        try {
          const parsed = registry.interface.parseLog({ topics: [...log.topics], data: log.data });
          if (parsed?.name === 'Registered') {
            uid = parsed.args.uid as string;
            break;
          }
        } catch {
          // not our event
        }
      }

      console.log(`  UID: ${uid}`);
      schemaUIDs[s.envKey] = uid;
    } catch (err: unknown) {
      // Registration failed — schema likely already exists on this network.
      // The UID is deterministic so we can use the computed value safely.
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  Registration reverted (${msg.split('\n')[0]})`);
      console.log(`  Using computed UID: ${expectedUID}`);
      schemaUIDs[s.envKey] = expectedUID;
    }
  }

  // ── Print env vars ────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════════════');
  console.log('Add these to proofly/.env.local:');
  console.log('════════════════════════════════════════════════');
  console.log(`PROOFLY_CONTRACT_ADDRESS="${contractAddress}"`);
  for (const [key, uid] of Object.entries(schemaUIDs)) {
    console.log(`${key}="${uid}"`);
  }
  console.log('════════════════════════════════════════════════\n');

  // ── Verify on Basescan ────────────────────────────────────────────────────
  if (network !== 'hardhat' && network !== 'localhost') {
    console.log('Waiting 15s for Basescan to index the contract...');
    await new Promise((r) => setTimeout(r, 15_000));

    try {
      await hre.run('verify:verify', {
        address: contractAddress,
        constructorArguments: [deployer.address, appBaseUrl],
      });
      console.log('Verified on Basescan ✅');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Already Verified')) {
        console.log('Already verified ✅');
      } else {
        console.warn('Verification failed (retry with: npm run verify --', contractAddress, '):', msg);
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
