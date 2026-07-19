// Deploys TrustSplitFactory to Monad Testnet.
// Usage:
//   1. node scripts/compile.mjs        (produces scripts/artifacts.json)
//   2. PRIVATE_KEY=0xyourkey node scripts/deploy.mjs
//
// Requires: npm install viem  (already a project dependency)
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createPublicClient, createWalletClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PRIVATE_KEY = process.env.PRIVATE_KEY;
if (!PRIVATE_KEY) {
  console.error("❌ Set PRIVATE_KEY env var (the deployer wallet's private key, funded with testnet MON).");
  process.exit(1);
}

const artifactsPath = path.join(__dirname, "artifacts.json");
if (!fs.existsSync(artifactsPath)) {
  console.error("❌ scripts/artifacts.json not found. Run `node scripts/compile.mjs` first.");
  process.exit(1);
}
const artifacts = JSON.parse(fs.readFileSync(artifactsPath, "utf8"));

const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: ["https://testnet-rpc.monad.xyz"] } },
  blockExplorers: { default: { name: "Monad Explorer", url: "https://testnet.monadexplorer.com" } },
  testnet: true,
});

const account = privateKeyToAccount(PRIVATE_KEY.startsWith("0x") ? PRIVATE_KEY : `0x${PRIVATE_KEY}`);

const publicClient = createPublicClient({ chain: monadTestnet, transport: http() });
const walletClient = createWalletClient({ account, chain: monadTestnet, transport: http() });

async function main() {
  console.log(`Deploying from ${account.address} on Monad Testnet...`);

  const balance = await publicClient.getBalance({ address: account.address });
  if (balance === 0n) {
    console.error("❌ Deployer wallet has 0 MON. Fund it from a Monad testnet faucet first.");
    process.exit(1);
  }

  const hash = await walletClient.deployContract({
    abi: artifacts.factory.abi,
    bytecode: artifacts.factory.bytecode,
    args: [],
  });
  console.log(`Tx sent: ${hash}`);
  console.log("Waiting for confirmation...");

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`\n✅ TrustSplitFactory deployed at: ${receipt.contractAddress}`);
  console.log(`   Explorer: https://testnet.monadexplorer.com/address/${receipt.contractAddress}`);
  console.log(`\nAdd this to your .env.local:`);
  console.log(`NEXT_PUBLIC_FACTORY_ADDRESS=${receipt.contractAddress}`);
}

main().catch((err) => {
  console.error("❌ Deployment failed:", err.shortMessage || err.message);
  process.exit(1);
});
