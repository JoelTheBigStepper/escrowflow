import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createPublicClient, http, defineChain } from "viem";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FACTORY_ADDRESS = process.env.NEXT_PUBLIC_FACTORY_ADDRESS;
if (!FACTORY_ADDRESS || FACTORY_ADDRESS === "0x0000000000000000000000000000000000000000") {
  console.error("❌ NEXT_PUBLIC_FACTORY_ADDRESS not set in .env.local");
  process.exit(1);
}

const artifactsPath = path.join(__dirname, "artifacts.json");
if (!fs.existsSync(artifactsPath)) {
  console.error("❌ scripts/artifacts.json not found. Run `node scripts/compile.mjs` first.");
  process.exit(1);
}
const { factory, agreement } = JSON.parse(fs.readFileSync(artifactsPath, "utf8"));

const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: ["https://testnet-rpc.monad.xyz"] } },
});

const client = createPublicClient({ chain: monadTestnet, transport: http() });

async function main() {
  console.log(`Checking factory: ${FACTORY_ADDRESS}\n`);

  const factoryCode = await client.getBytecode({ address: FACTORY_ADDRESS });
  if (!factoryCode || factoryCode === "0x") {
    console.error("❌ No contract deployed at this address on Monad Testnet. Check NEXT_PUBLIC_FACTORY_ADDRESS.");
    process.exit(1);
  }
  console.log(`✅ Factory has code (${(factoryCode.length - 2) / 2} bytes).\n`);

  // The implementation the factory clones from — check this has real code too.
  const implementation = await client.readContract({
    address: FACTORY_ADDRESS,
    abi: factory.abi,
    functionName: "implementation",
  });
  const implCode = await client.getBytecode({ address: implementation });
  console.log(`implementation() = ${implementation}`);
  console.log(
    implCode && implCode !== "0x"
      ? `✅ Implementation has code (${(implCode.length - 2) / 2} bytes).\n`
      : `❌ Implementation address has NO code — this is the bug. The factory's constructor deploy of the Agreement implementation failed or wasn't included.\n`
  );

  const count = await client.readContract({
    address: FACTORY_ADDRESS,
    abi: factory.abi,
    functionName: "agreementsCount",
  });
  console.log(`agreementsCount() = ${count}`);

  if (count === 0n) {
    console.log("\n⚠️  Zero agreements recorded. Your creates reverted or you're pointed at the wrong factory.");
    return;
  }

  const all = await client.readContract({
    address: FACTORY_ADDRESS,
    abi: factory.abi,
    functionName: "getAllAgreements",
  });

  console.log(`\nDeployed agreements:`);
  for (const addr of all) {
    const code = await client.getBytecode({ address: addr });
    const hasCode = code && code !== "0x";
    console.log(`  ${addr} — code: ${hasCode ? `${(code.length - 2) / 2} bytes` : "❌ EMPTY (no contract here)"}`);
    if (hasCode) {
      try {
        const title = await client.readContract({ address: addr, abi: agreement.abi, functionName: "title" });
        console.log(`    title: "${title}"`);
      } catch (e) {
        console.log(`    ❌ failed to read title: ${e.shortMessage || e.message}`);
      }
    }
  }
}

main().catch((err) => {
  console.error("❌", err.shortMessage || err.message);
  process.exit(1);
});