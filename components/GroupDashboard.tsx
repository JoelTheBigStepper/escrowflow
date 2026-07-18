"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useReadContract, useReadContracts, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { parseEther } from "viem";
import { Plus, HandCoins, Users, Copy, Check, ExternalLink, Loader2 } from "lucide-react";
import { AGREEMENT_ABI } from "@/lib/contracts";
import { explorerAddressUrl, formatMon, shortAddress, timeUntil } from "@/lib/utils";
import { useToast } from "@/components/Toast";
import { HistoryLog } from "@/components/HistoryLog";

export function GroupDashboard({ address, title, deadline }: { address: `0x${string}`; title: string; deadline: bigint }) {
  const { address: me } = useAccount();
  const { push, update } = useToast();
  const [copied, setCopied] = useState(false);

  const { data: participants, refetch: refetchParticipants } = useReadContract({
    address,
    abi: AGREEMENT_ABI,
    functionName: "getParticipants",
  });

  const list = (participants as `0x${string}`[] | undefined) ?? [];

  const { data: balanceResults, refetch: refetchBalances } = useReadContracts({
    contracts: list.map((p) => ({
      address,
      abi: AGREEMENT_ABI,
      functionName: "getBalance",
      args: [p],
    })) as any,
    query: { enabled: list.length > 0 },
  });

  const balances = useMemo(() => {
    const map = new Map<string, bigint>();
    list.forEach((p, i) => {
      const result = balanceResults?.[i]?.result as bigint | undefined;
      map.set(p.toLowerCase(), result ?? 0n);
    });
    return map;
  }, [list, balanceResults]);

  const myBalance = me ? balances.get(me.toLowerCase()) ?? 0n : 0n;
  const owedByOthers = list.filter((p) => (balances.get(p.toLowerCase()) ?? 0n) > 0n && p.toLowerCase() !== me?.toLowerCase());

  // --- Add expense ---
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const { writeContract: writeExpense, data: expenseHash, isPending: expensePending, error: expenseError, reset: resetExpense } = useWriteContract();
  const { data: expenseReceipt, isLoading: expenseConfirming } = useWaitForTransactionReceipt({ hash: expenseHash });
  const [expenseToastId, setExpenseToastId] = useState<number | null>(null);

  useEffect(() => {
    if (!expenseError) return;
    const msg = expenseError.message.includes("User rejected") ? "Transaction rejected" : "Failed to add expense";
    if (expenseToastId) update(expenseToastId, "error", msg);
  }, [expenseError]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!expenseReceipt) return;
    if (expenseToastId) update(expenseToastId, "success", "Expense added", expenseReceipt.transactionHash);
    setAmount("");
    setDescription("");
    refetchBalances();
    resetExpense();
  }, [expenseReceipt]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleAddExpense() {
    const parsed = Number(amount);
    if (!parsed || parsed <= 0 || !description.trim()) {
      push("error", "Enter an amount and description");
      return;
    }
    const id = push("pending", "Confirm in wallet...");
    setExpenseToastId(id);
    writeExpense(
      {
        address,
        abi: AGREEMENT_ABI,
        functionName: "addExpense",
        args: [parseEther(amount), description.trim()],
      },
      { onSuccess: () => update(id, "pending", "Recording expense...") }
    );
  }

  // --- Settle ---
  const [settleTo, setSettleTo] = useState("");
  const [settleAmount, setSettleAmount] = useState("");
  const { writeContract: writeSettle, data: settleHash, isPending: settlePending, error: settleError, reset: resetSettle } = useWriteContract();
  const { data: settleReceipt, isLoading: settleConfirming } = useWaitForTransactionReceipt({ hash: settleHash });
  const [settleToastId, setSettleToastId] = useState<number | null>(null);

  useEffect(() => {
    if (!settleError) return;
    const msg = settleError.message.includes("User rejected") ? "Transaction rejected" : "Settlement failed";
    if (settleToastId) update(settleToastId, "error", msg);
  }, [settleError]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!settleReceipt) return;
    if (settleToastId) update(settleToastId, "success", "Settled up!", settleReceipt.transactionHash);
    setSettleAmount("");
    refetchBalances();
    resetSettle();
  }, [settleReceipt]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSettle() {
    const parsed = Number(settleAmount);
    if (!settleTo || !parsed || parsed <= 0) {
      push("error", "Pick a recipient and amount");
      return;
    }
    const id = push("pending", "Confirm in wallet...");
    setSettleToastId(id);
    writeSettle(
      {
        address,
        abi: AGREEMENT_ABI,
        functionName: "settle",
        args: [settleTo as `0x${string}`],
        value: parseEther(settleAmount),
      },
      { onSuccess: () => update(id, "pending", "Sending payment...") }
    );
  }

  function copyAddress() {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs font-medium text-[var(--color-accent)]">
              <Users className="h-3.5 w-3.5" /> Group Splitter
            </div>
            <h2 className="text-xl font-semibold text-zinc-50 sm:text-2xl">{title}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={copyAddress} className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {shortAddress(address)}
            </button>
            <a href={explorerAddressUrl(address)} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-[var(--color-border)] p-2 text-zinc-400 hover:text-zinc-200">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-zinc-500">
          <span>{list.length} participants</span>
          <span>{timeUntil(deadline)}</span>
        </div>
      </div>

      {/* My balance */}
      <div className="card p-5 sm:p-6">
        <p className="mb-1 text-xs font-medium text-zinc-500">Your balance</p>
        <p className={`font-mono-num text-3xl font-semibold ${myBalance >= 0n ? "text-[var(--color-accent)]" : "text-[var(--color-danger)]"}`}>
          {myBalance >= 0n ? "+" : "-"}
          {formatMon(myBalance < 0n ? -myBalance : myBalance)} MON
        </p>
        <p className="mt-1 text-xs text-zinc-500">{myBalance >= 0n ? "You're owed this much overall" : "You owe this much overall"}</p>
      </div>

      {/* Balances grid */}
      <div className="card p-5 sm:p-6">
        <p className="mb-3 text-sm font-medium text-zinc-300">Balances</p>
        <div className="space-y-2">
          {list.map((p) => {
            const b = balances.get(p.toLowerCase()) ?? 0n;
            const isMe = p.toLowerCase() === me?.toLowerCase();
            return (
              <div key={p} className="flex items-center justify-between rounded-lg bg-[var(--color-surface-2)] px-3.5 py-2.5">
                <span className="font-mono-num text-sm text-zinc-300">
                  {shortAddress(p)} {isMe && <span className="text-zinc-600">(you)</span>}
                </span>
                <span className={`font-mono-num text-sm font-medium ${b > 0n ? "text-[var(--color-accent)]" : b < 0n ? "text-[var(--color-danger)]" : "text-zinc-500"}`}>
                  {b > 0n ? "+" : b < 0n ? "-" : ""}
                  {formatMon(b < 0n ? -b : b)} MON
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Add expense */}
        <div className="card p-5 sm:p-6">
          <p className="mb-4 flex items-center gap-2 text-sm font-medium text-zinc-300">
            <Plus className="h-4 w-4 text-[var(--color-accent)]" /> Add expense
          </p>
          <div className="space-y-3">
            <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="Amount (MON)" className="input" />
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What was it for?" maxLength={100} className="input" />
            <button
              onClick={handleAddExpense}
              disabled={expensePending || expenseConfirming}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-[var(--color-accent-dim)] disabled:opacity-50"
            >
              {expensePending || expenseConfirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Split equally among {list.length}
            </button>
          </div>
        </div>

        {/* Settle up */}
        <div className="card p-5 sm:p-6">
          <p className="mb-4 flex items-center gap-2 text-sm font-medium text-zinc-300">
            <HandCoins className="h-4 w-4 text-[var(--color-warn)]" /> Settle up
          </p>
          {myBalance >= 0n ? (
            <p className="text-sm text-zinc-500">You don't owe anything right now.</p>
          ) : (
            <div className="space-y-3">
              <select value={settleTo} onChange={(e) => setSettleTo(e.target.value)} className="input">
                <option value="">Pay who?</option>
                {owedByOthers.map((p) => (
                  <option key={p} value={p}>
                    {shortAddress(p)} — owed {formatMon(balances.get(p.toLowerCase()))} MON
                  </option>
                ))}
              </select>
              <input value={settleAmount} onChange={(e) => setSettleAmount(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="Amount (MON)" className="input" />
              <button
                onClick={handleSettle}
                disabled={settlePending || settleConfirming}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-warn)] py-2.5 text-sm font-semibold text-zinc-950 transition hover:brightness-95 disabled:opacity-50"
              >
                {settlePending || settleConfirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <HandCoins className="h-4 w-4" />}
                Send payment
              </button>
            </div>
          )}
        </div>
      </div>

      <HistoryLog address={address} />
    </div>
  );
}
