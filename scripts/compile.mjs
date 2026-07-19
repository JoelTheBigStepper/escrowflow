// Compiles contracts/*.sol with solc and writes artifacts to scripts/artifacts.json
// Usage: node scripts/compile.mjs
import solc from "solc";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contractsDir = path.join(__dirname, "..", "contracts");

function findImports(importPath) {
  try {
    const resolved = path.join(contractsDir, importPath.replace("./", ""));
    return { contents: fs.readFileSync(resolved, "utf8") };
  } catch {
    return { error: "File not found: " + importPath };
  }
}

const input = {
  language: "Solidity",
  sources: {
    "Agreement.sol": { content: fs.readFileSync(path.join(contractsDir, "Agreement.sol"), "utf8") },
    "TrustSplitFactory.sol": { content: fs.readFileSync(path.join(contractsDir, "TrustSplitFactory.sol"), "utf8") },
  },
  settings: {
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    optimizer: { enabled: true, runs: 200 },
    viaIR: true,
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

let hasError = false;
if (output.errors) {
  for (const err of output.errors) {
    if (err.severity === "error") hasError = true;
    console.log(err.formattedMessage);
  }
}
if (hasError) process.exit(1);

const factory = output.contracts["TrustSplitFactory.sol"]["TrustSplitFactory"];
const agreement = output.contracts["Agreement.sol"]["Agreement"];

const artifacts = {
  factory: { abi: factory.abi, bytecode: "0x" + factory.evm.bytecode.object },
  agreement: { abi: agreement.abi, bytecode: "0x" + agreement.evm.bytecode.object },
};

fs.writeFileSync(path.join(__dirname, "artifacts.json"), JSON.stringify(artifacts, null, 2));
fs.writeFileSync(path.join(__dirname, "..", "lib", "abis", "factory.json"), JSON.stringify(factory.abi, null, 2));
fs.writeFileSync(path.join(__dirname, "..", "lib", "abis", "agreement.json"), JSON.stringify(agreement.abi, null, 2));

console.log("✅ Compiled successfully → scripts/artifacts.json (ABIs also synced to lib/abis/)");