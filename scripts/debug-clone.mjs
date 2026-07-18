import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createPublicClient, http, defineChain } from "viem";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cloneAddress = process.argv[2];
if (!cloneAddress) {
  console.error("Usage: node scripts/debug-clone.mjs 0xCloneAddress");
  process.exit(1);
}

const FACTORY_ADDRESS = process.env.NEXT_PUBLIC_FACTORY_ADDRESS;
const { factory, agreement } = JSON.parse(fs.readFileSync(path.join(__dirname, "artifacts.json"), "utf8"));

const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: ["https://testnet-rpc.monad.xyz"] } },
});
const client = createPublicClient({ chain: monadTestnet, transport: http() });

async function tryRead(label, address, functionName) {
  try {
    const result = await client.readContract({ address, abi: agreement.abi, functionName });
    console.log(`  ${label}.${functionName}() = ${result}`);
  } catch (e) {
    console.log(`  ${label}.${functionName}() ❌ ${e.shortMessage || e.message}`);
  }
}

async function main() {
  const implementation = await client.readContract({
    address: FACTORY_ADDRESS,
    abi: factory.abi,
    functionName: "implementation",
  });

  console.log(`Implementation: ${implementation}`);
  console.log(`Clone:          ${cloneAddress}\n`);

  console.log("Reading from RAW IMPLEMENTATION (never initialized, expect defaults):");
  await tryRead("implementation", implementation, "initialized");
  await tryRead("implementation", implementation, "title");
  await tryRead("implementation", implementation, "agreementType");

  console.log("\nReading from CLONE (should have real data from your createAgreement call):");
  await tryRead("clone", cloneAddress, "initialized");
  await tryRead("clone", cloneAddress, "title");
  await tryRead("clone", cloneAddress, "agreementType");

  // Raw eth_call with zero calldata to see if the proxy forwards *anything* successfully
  console.log("\nRaw eth_call sanity check (no calldata, just probing the proxy fallback):");
  try {
    const raw = await client.call({ to: cloneAddress, data: "0x" });
    console.log(`  raw call to clone with empty calldata => data: ${raw.data ?? "(empty)"}`);
  } catch (e) {
    console.log(`  raw call ❌ ${e.shortMessage || e.message}`);
  }
}

main().catch((err) => {
  console.error("❌", err.shortMessage || err.message);
  process.exit(1);
});