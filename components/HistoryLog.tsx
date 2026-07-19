"use client";

import { useEffect, useState, useMemo } from "react";
import { usePublicClient } from "wagmi";
import { Receipt, HandCoins, UserPlus, Lock, Unlock } from "lucide-react";
import { AGREEMENT_ABI, Expense } from "@/lib/contracts";
import { formatMon, shortAddress } from "@/lib/utils";

type HistoryEntry = {
  timestamp: bigint;
  type: "expense" | "settled" | "participant" | "locked" | "released";
  data: any;
};

export function HistoryLog({ address, expenses }: { address: `0x${string}`; expenses: Expense[] }) {
  const publicClient = usePublicClient();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!publicClient) return;

    (async () => {
      const [expenseLogs, settledLogs, participantLogs, lockLogs, releaseLogs] = await Promise.all([
        publicClient.getContractEvents({ address, abi: AGREEMENT_ABI, eventName: "ExpenseAdded", fromBlock: 0n }),
        publicClient.getContractEvents({ address, abi: AGREEMENT_ABI, eventName: "Settled", fromBlock: 0n }),
        publicClient.getContractEvents({ address, abi: AGREEMENT_ABI, eventName: "ParticipantAdded", fromBlock: 0n }),
        publicClient.getContractEvents({ address, abi: AGREEMENT_ABI, eventName: "FundsLocked", fromBlock: 0n }),
        publicClient.getContractEvents({ address, abi: AGREEMENT_ABI, eventName: "FundsReleased", fromBlock: 0n }),
      ]);

      const all: HistoryEntry[] = [
        ...expenseLogs.map((log: any) => ({ timestamp: log.blockNumber, type: "expense" as const, data: log.args })),
        ...settledLogs.map((log: any) => ({ timestamp: log.blockNumber, type: "settled" as const, data: log.args })),
        ...participantLogs.map((log: any) => ({ timestamp: log.blockNumber, type: "participant" as const, data: log.args })),
        ...lockLogs.map((log: any) => ({ timestamp: log.blockNumber, type: "locked" as const, data: log.args })),
        ...releaseLogs.map((log: any) => ({ timestamp: log.blockNumber, type: "released" as const, data: log.args })),
      ].sort((a, b) => Number(b.timestamp - a.timestamp));

      setEntries(all);
    })();
  }, [publicClient, address]);

  const filteredEntries = useMemo(() => {
    if (!searchTerm) return entries;
    const term = searchTerm.toLowerCase();
    return entries.filter((e) => {
      if (e.type === "expense") return e.data.description?.toLowerCase().includes(term);
      if (e.type === "settled") return e.data.from.toLowerCase().includes(term);
      return false;
    });
  }, [entries, searchTerm]);

  return (
    <div className="card p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-medium text-zinc-300">
          <Receipt className="h-4 w-4 text-zinc-500" /> Transaction history
        </p>
        <input
          type="text"
          placeholder="Search history..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input w-48 text-xs"
        />
      </div>

      {filteredEntries.length === 0 ? (
        <p className="text-sm text-zinc-500">No activity yet.</p>
      ) : (
        <div className="scrollbar-thin max-h-80 space-y-2 overflow-y-auto">
          {filteredEntries.map((entry, i) => {
            if (entry.type === "expense") {
              const e = entry.data;
              return (
                <div key={`e-${i}`} className="flex items-center justify-between rounded-lg bg-[var(--color-surface-2)] px-3.5 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-zinc-200">{e.description}</p>
                    <p className="font-mono-num text-xs text-zinc-600">
                      paid by {shortAddress(e.payer)} · split {e.splitAmong.length} ways
                    </p>
                  </div>
                  <p className="font-mono-num shrink-0 pl-3 text-sm font-medium text-zinc-300">{formatMon(e.amount)} MON</p>
                </div>
              );
            } else if (entry.type === "settled") {
              return (
                <div key={`s-${i}`} className="flex items-center justify-between rounded-lg bg-[var(--color-surface-2)] px-3.5 py-2.5">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <HandCoins className="h-3.5 w-3.5 shrink-0 text-[var(--color-warn)]" />
                    <div className="min-w-0">
                      <p className="text-sm text-zinc-200">Settled up</p>
                      <p className="font-mono-num text-xs text-zinc-600">{shortAddress(entry.data.from)}</p>
                    </div>
                  </div>
                  <p className="font-mono-num shrink-0 pl-3 text-sm font-medium text-[var(--color-warn)]">
                    {formatMon(entry.data.amountDistributed)} MON
                  </p>
                </div>
              );
            } else if (entry.type === "participant") {
              return (
                <div key={`p-${i}`} className="flex items-center justify-between rounded-lg bg-[var(--color-surface-2)] px-3.5 py-2.5">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <UserPlus className="h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]" />
                    <p className="text-sm text-zinc-200">Participant added: {shortAddress(entry.data.participant)}</p>
                  </div>
                </div>
              );
            } else if (entry.type === "locked") {
              return (
                <div key={`l-${i}`} className="flex items-center justify-between rounded-lg bg-[var(--color-surface-2)] px-3.5 py-2.5">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <Lock className="h-3.5 w-3.5 shrink-0 text-[var(--color-warn)]" />
                    <p className="text-sm text-zinc-200">Funds locked by {shortAddress(entry.data.payer)}</p>
                  </div>
                  <p className="font-mono-num shrink-0 pl-3 text-sm font-medium text-[var(--color-warn)]">
                    {formatMon(entry.data.amount)} MON
                  </p>
                </div>
              );
            } else if (entry.type === "released") {
              return (
                <div key={`r-${i}`} className="flex items-center justify-between rounded-lg bg-[var(--color-surface-2)] px-3.5 py-2.5">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <Unlock className="h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]" />
                    <p className="text-sm text-zinc-200">Funds released to {shortAddress(entry.data.to)}</p>
                  </div>
                  <p className="font-mono-num shrink-0 pl-3 text-sm font-medium text-[var(--color-accent)]">
                    {formatMon(entry.data.amount)} MON
                  </p>
                </div>
              );
            }
            return null;
          })}
        </div>
      )}
    </div>
  );
}