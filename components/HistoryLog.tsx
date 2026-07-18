"use client";

import { useReadContract } from "wagmi";
import { Receipt } from "lucide-react";
import { AGREEMENT_ABI, Expense } from "@/lib/contracts";
import { formatMon, shortAddress } from "@/lib/utils";

export function HistoryLog({ address }: { address: `0x${string}` }) {
  const { data } = useReadContract({
    address,
    abi: AGREEMENT_ABI,
    functionName: "getExpenses",
  });

  const expenses = ((data as Expense[] | undefined) ?? []).slice().reverse();

  return (
    <div className="card p-5 sm:p-6">
      <p className="mb-4 flex items-center gap-2 text-sm font-medium text-zinc-300">
        <Receipt className="h-4 w-4 text-zinc-500" /> History
      </p>
      {expenses.length === 0 ? (
        <p className="text-sm text-zinc-500">No expenses logged yet.</p>
      ) : (
        <div className="scrollbar-thin max-h-80 space-y-2 overflow-y-auto">
          {expenses.map((e, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg bg-[var(--color-surface-2)] px-3.5 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-zinc-200">{e.description}</p>
                <p className="font-mono-num text-xs text-zinc-600">
                  paid by {shortAddress(e.payer)} · {new Date(Number(e.timestamp) * 1000).toLocaleDateString()}
                </p>
              </div>
              <p className="font-mono-num shrink-0 pl-3 text-sm font-medium text-zinc-300">{formatMon(e.amount)} MON</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
