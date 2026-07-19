# TrustSplit

Onchain group expense splitting + freelance/service escrow, built for the Monad Spark Hackathon.

Two modes, one contract pattern:

- **Group Splitter** — create a shared pot, log expenses, and the contract keeps a running
  net balance for every participant (equal-split MVP). Settle up by paying anyone who's owed,
  directly, peer-to-peer.
- **Service Escrow** — a payer locks MON for a job. They can release to the provider manually
  at any time, or the provider can auto-claim once the deadline passes — so freelancers aren't
  stuck waiting on a client who's gone quiet.

No backend, no database. All state lives onchain; the frontend just reads/writes the contract.

## Stack

- Next.js 14 (App Router) + TypeScript
- wagmi v2 + viem for wallet connection and contract calls
- Tailwind CSS v4, dark theme
- Solidity ^0.8.20, deployed as gas-cheap EIP-1167 minimal proxy clones

## Project structure

```
contracts/
  Agreement.sol            single contract handling both Group and Escrow logic
  TrustSplitFactory.sol    factory that deploys minimal-proxy clones + keeps a registry
app/
  layout.tsx, page.tsx, providers.tsx, globals.css
components/
  ConnectButton, CreateAgreementForm, AgreementLoader, AgreementView,
  GroupDashboard, EscrowDashboard, HistoryLog, Toast
lib/
  wagmi.ts (Monad chain config), contracts.ts (ABIs + addresses),
  utils.ts, useRecentAgreements.ts
scripts/
  compile.mjs   compiles the contracts with solc, syncs ABIs into lib/abis
  deploy.mjs    deploys TrustSplitFactory to Monad Testnet
```

## 1. Install dependencies

```bash
npm install
```

## 2. Deploy the contracts to Monad Testnet

Contracts are already compiled once (ABIs live in `lib/abis/`), but you need to deploy
`TrustSplitFactory` yourself and point the frontend at your instance.

**Get testnet MON** for your deployer wallet from a Monad faucet (search "Monad testnet faucet" —
faucet operators rotate, so use whichever is currently live).

```bash
node scripts/compile.mjs          # recompiles + syncs ABIs (only needed if you edit .sol files)
PRIVATE_KEY=0xyourdeployerkey node scripts/deploy.mjs
```

This prints the deployed factory address. Copy it into `.env.local`:

```bash
cp .env.local.example .env.local
# then edit .env.local:
NEXT_PUBLIC_FACTORY_ADDRESS=0xYourDeployedFactoryAddress
```

Never commit a private key. Use a throwaway hackathon wallet.

### Alternative: deploy via Remix

If you'd rather not touch the CLI, paste `contracts/Agreement.sol` and
`contracts/TrustSplitFactory.sol` into [Remix](https://remix.ethereum.org), compile with
Solidity 0.8.20+, connect MetaMask to Monad Testnet (chain ID `10143`, RPC
`https://testnet-rpc.monad.xyz`), and deploy `TrustSplitFactory` (no constructor args — it
deploys its own `Agreement` implementation internally). Copy the resulting address into
`.env.local` as above.

## 3. Add Monad Testnet to your wallet

| Field | Value |
|---|---|
| Network Name | Monad Testnet |
| RPC URL | `https://testnet-rpc.monad.xyz` |
| Chain ID | `10143` |
| Currency Symbol | `MON` |
| Explorer | `https://testnet.monadexplorer.com` |

## 4. Run locally

```bash
npm run dev
```

Open `http://localhost:3000`, connect your wallet, and create your first agreement.

## 5. Deploy the frontend

Vercel is the path of least resistance for a Next.js App Router project — it detects the
framework automatically and needs no rewrites/redirects config (unlike a static SPA export,
there's no refresh-404 issue here since routes are served by Next's own router, not client-side
history API faking a static host).

1. Push this repo to GitHub.
2. Import it in Vercel.
3. Add the `NEXT_PUBLIC_FACTORY_ADDRESS` environment variable in Vercel's project settings.
4. Deploy.

## How the contracts work

- `TrustSplitFactory.createAgreement(type, title, deadlineDays, participants, provider)`
  deploys a minimal-proxy clone of `Agreement` (cheap: ~45k gas vs. a full deploy) and calls
  `initialize()` on it once.
- **Group mode**: `addExpense(amount, description)` splits the amount equally across all
  participants and updates each one's signed `int256` balance (positive = owed, negative =
  owes). `settle(to)` lets a participant pay down their debt directly to whoever is owed,
  sending native MON with the call.
- **Escrow mode**: `lockFunds(description)` (payer only) deposits MON into the contract.
  `release()` (payer only, anytime) or `claim()` (provider only, after `deadline`) sends the
  full locked balance to the provider. This protects the provider from a payer who goes silent,
  while still letting a satisfied payer release early.

## Known simplifications (documented, not hidden)

- Group Splitter uses **equal splits only** — no custom weights per expense. A natural v2
  addition: pass per-participant share arrays into `addExpense`.
- Escrow has no dispute/refund path if a provider never delivers and the payer doesn't want to
  release — by design, since arbitrating "was the work done" onchain needs either a trusted
  arbiter role or an oracle, both out of scope for a 1-day build. Worth adding for a real
  product.
- Participant lists are fixed at agreement creation. Adding people later would need an
  `addParticipant` function gated to existing participants or the creator.
