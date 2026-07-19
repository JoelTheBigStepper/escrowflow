"use client";

import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { Receipt, HandCoins } from "lucide-react";
import { AGREEMENT_ABI, Expense } from "@/lib/contracts";
import { formatMon, shortAddress } from "@/lib/utils";

type SettleEvent = {
  from: `0x${string}`;
  amountDistributed: bigint;
  refunded: bigint;
  blockNumber: bigint;
};

export function HistoryLog({ address, expenses }: { address: `0x${string}`; expenses: Expense[] }) {
  const publicClient = usePublicClient();
  const [settlements, setSettlements] = useState<SettleEvent[]>([]);

  useEffect(() => {
    if (!publicClient) return;
    let cancelled = false;

    (async () => {
      try {
        // Monad testnet's RPC caps eth_getLogs at a 100-block window per
        // call, so we page backward from the latest block in 100-block
        // chunks, run in parallel batches. Capped at a few thousand blocks
        // of lookback so this stays fast — recent settlements are what
        // matter most, and the expense list itself (read straight from
        // contract storage, not events) is always complete regardless of
        // this cap.
        const CHUNK = 100n;
        const TOTAL_CHUNKS = 30; // ~3,000 blocks of lookback
        const BATCH_SIZE = 10; // concurrent requests per round

        const latest = await publicClient.getBlockNumber();
        const ranges: { from: bigint; to: bigint }[] = [];
        let to = latest;
        for (let i = 0; i < TOTAL_CHUNKS && to >= 0n; i++) {
          const from = to > CHUNK ? to - CHUNK + 1n : 0n;
          ranges.push({ from, to });
          if (from === 0n) break;
          to = from - 1n;
        }

        const allLogs: any[] = [];
        for (let i = 0; i < ranges.length; i += BATCH_SIZE) {
          const batch = ranges.slice(i, i + BATCH_SIZE);
          const results = await Promise.allSettled(
            batch.map(({ from, to: rangeTo }) =>
              publicClient.getContractEvents({
                address,
                abi: AGREEMENT_ABI,
                eventName: "Settled",
                fromBlock: from,
                toBlock: rangeTo,
              })
            )
          );
          for (const r of results) {
            if (r.status === "fulfilled") allLogs.push(...r.value);
          }
        }

        if (cancelled) return;
        setSettlements(
          allLogs.map((log: any) => ({
            from: log.args.from,
            amountDistributed: log.args.amountDistributed,
            refunded: log.args.refunded,
            blockNumber: log.blockNumber,
          }))
        );
      } catch {
        // event fetching is best-effort — history still shows expenses if this fails
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [publicClient, address, expenses.length]);

  type Entry =
    | { kind: "expense"; timestamp: bigint; expense: Expense }
    | { kind: "settlement"; timestamp: bigint; settlement: SettleEvent };

  const entries: Entry[] = [
    ...expenses.map((e) => ({ kind: "expense" as const, timestamp: e.timestamp, expense: e })),
    ...settlements.map((s) => ({ kind: "settlement" as const, timestamp: s.blockNumber, settlement: s })),
  ].sort((a, b) => Number(b.timestamp - a.timestamp));

  return (
    <div className="card p-5 sm:p-6">
      <p className="mb-4 flex items-center gap-2 text-sm font-medium text-zinc-300">
        <Receipt className="h-4 w-4 text-zinc-500" /> Transaction history
      </p>
      {entries.length === 0 ? (
        <p className="text-sm text-zinc-500">No activity yet.</p>
      ) : (
        <div className="scrollbar-thin max-h-80 space-y-2 overflow-y-auto">
          {entries.map((entry, i) =>
            entry.kind === "expense" ? (
              <div key={`e-${i}`} className="flex items-center justify-between rounded-lg bg-[var(--color-surface-2)] px-3.5 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-zinc-200">{entry.expense.description}</p>
                  <p className="font-mono-num text-xs text-zinc-600">
                    paid by {shortAddress(entry.expense.payer)} · split {entry.expense.splitAmong.length} ways ·{" "}
                    {new Date(Number(entry.expense.timestamp) * 1000).toLocaleDateString()}
                  </p>
                </div>
                <p className="font-mono-num shrink-0 pl-3 text-sm font-medium text-zinc-300">{formatMon(entry.expense.amount)} MON</p>
              </div>
            ) : (
              <div key={`s-${i}`} className="flex items-center justify-between rounded-lg bg-[var(--color-surface-2)] px-3.5 py-2.5">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <HandCoins className="h-3.5 w-3.5 shrink-0 text-[var(--color-warn)]" />
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-200">Settled up</p>
                    <p className="font-mono-num text-xs text-zinc-600">{shortAddress(entry.settlement.from)} distributed to the pot</p>
                  </div>
                </div>
                <p className="font-mono-num shrink-0 pl-3 text-sm font-medium text-[var(--color-warn)]">
                  {formatMon(entry.settlement.amountDistributed)} MON
                </p>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}