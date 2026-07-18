"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useReadContract, useReadContracts, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { parseEther } from "viem";
import { Plus, HandCoins, Users, Copy, Check, ExternalLink, Loader2, UserPlus } from "lucide-react";
import { AGREEMENT_ABI, Expense } from "@/lib/contracts";
import { explorerAddressUrl, formatMon, isValidAddress, shortAddress, timeUntil } from "@/lib/utils";
import { useToast } from "@/components/Toast";
import { HistoryLog } from "@/components/HistoryLog";

export function GroupDashboard({
  address,
  title,
  description,
  deadline,
}: {
  address: `0x${string}`;
  title: string;
  description: string;
  deadline: bigint;
}) {
  const { address: me } = useAccount();
  const { push, update } = useToast();
  const [copied, setCopied] = useState(false);

  const { data: participantsData, refetch: refetchParticipants } = useReadContract({
    address,
    abi: AGREEMENT_ABI,
    functionName: "getParticipants",
  });
  const participants = (participantsData as `0x${string}`[] | undefined) ?? [];

  const { data: balanceResults, refetch: refetchBalances } = useReadContracts({
    contracts: participants.map((p) => ({
      address,
      abi: AGREEMENT_ABI,
      functionName: "getBalance",
      args: [p],
    })) as any,
    query: { enabled: participants.length > 0 },
  });

  const balances = useMemo(() => {
    const map = new Map<string, bigint>();
    participants.forEach((p, i) => {
      const result = balanceResults?.[i]?.result as bigint | undefined;
      map.set(p.toLowerCase(), result ?? 0n);
    });
    return map;
  }, [participants, balanceResults]);

  const { data: expensesData, refetch: refetchExpenses } = useReadContract({
    address,
    abi: AGREEMENT_ABI,
    functionName: "getExpenses",
  });
  const expenses = (expensesData as Expense[] | undefined) ?? [];

  const { paidMap, owedMap } = useMemo(() => {
    const paid = new Map<string, bigint>();
    const owed = new Map<string, bigint>();
    for (const e of expenses) {
      paid.set(e.payer.toLowerCase(), (paid.get(e.payer.toLowerCase()) ?? 0n) + e.amount);
      const share = e.amount / BigInt(e.splitAmong.length || 1);
      for (const p of e.splitAmong) {
        owed.set(p.toLowerCase(), (owed.get(p.toLowerCase()) ?? 0n) + share);
      }
    }
    return { paidMap: paid, owedMap: owed };
  }, [expenses]);

  const myBalance = me ? balances.get(me.toLowerCase()) ?? 0n : 0n;

  function refetchAll() {
    refetchParticipants();
    refetchBalances();
    refetchExpenses();
  }

  // --- Add participant ---
  const [newParticipant, setNewParticipant] = useState("");
  const {
    writeContract: writeAddParticipant,
    data: addParticipantHash,
    isPending: addParticipantPending,
    error: addParticipantError,
    reset: resetAddParticipant,
  } = useWriteContract();
  const { data: addParticipantReceipt, isLoading: addParticipantConfirming } = useWaitForTransactionReceipt({ hash: addParticipantHash });
  const [addParticipantToastId, setAddParticipantToastId] = useState<number | null>(null);

  useEffect(() => {
    if (!addParticipantError) return;
    const msg = addParticipantError.message.includes("User rejected") ? "Transaction rejected" : "Failed to add participant";
    if (addParticipantToastId) update(addParticipantToastId, "error", msg);
  }, [addParticipantError]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!addParticipantReceipt) return;
    if (addParticipantToastId) update(addParticipantToastId, "success", "Participant added", addParticipantReceipt.transactionHash);
    setNewParticipant("");
    refetchParticipants();
    resetAddParticipant();
  }, [addParticipantReceipt]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleAddParticipant() {
    const trimmed = newParticipant.trim();
    if (!isValidAddress(trimmed)) {
      push("error", "Enter a valid wallet address");
      return;
    }
    const id = push("pending", "Confirm in wallet...");
    setAddParticipantToastId(id);
    writeAddParticipant(
      { address, abi: AGREEMENT_ABI, functionName: "addParticipant", args: [trimmed as `0x${string}`] },
      { onSuccess: () => update(id, "pending", "Adding participant...") }
    );
  }

  // --- Add expense ---
  const [amount, setAmount] = useState("");
  const [expenseDesc, setExpenseDesc] = useState("");
  const [payer, setPayer] = useState<string>("");
  const [splitAmong, setSplitAmong] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (me && !payer) setPayer(me);
  }, [me]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // default: everyone currently in the pot is included in the split
    setSplitAmong(new Set(participants.map((p) => p.toLowerCase())));
  }, [participants.length]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleSplit(p: string) {
    setSplitAmong((prev) => {
      const next = new Set(prev);
      const key = p.toLowerCase();
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const {
    writeContract: writeExpense,
    data: expenseHash,
    isPending: expensePending,
    error: expenseError,
    reset: resetExpense,
  } = useWriteContract();
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
    setExpenseDesc("");
    refetchAll();
    resetExpense();
  }, [expenseReceipt]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleAddExpense() {
    const parsed = Number(amount);
    const splitList = participants.filter((p) => splitAmong.has(p.toLowerCase()));
    if (!parsed || parsed <= 0 || !expenseDesc.trim()) {
      push("error", "Enter an amount and description");
      return;
    }
    if (!payer) {
      push("error", "Pick who paid");
      return;
    }
    if (splitList.length === 0) {
      push("error", "Select at least one participant to split among");
      return;
    }
    const id = push("pending", "Confirm in wallet...");
    setExpenseToastId(id);
    writeExpense(
      {
        address,
        abi: AGREEMENT_ABI,
        functionName: "addExpense",
        args: [parseEther(amount), expenseDesc.trim(), payer as `0x${string}`, splitList],
      },
      { onSuccess: () => update(id, "pending", "Recording expense...") }
    );
  }

  // --- Settle all ---
  const [settleAmount, setSettleAmount] = useState("");
  const {
    writeContract: writeSettle,
    data: settleHash,
    isPending: settlePending,
    error: settleError,
    reset: resetSettle,
  } = useWriteContract();
  const { data: settleReceipt, isLoading: settleConfirming } = useWaitForTransactionReceipt({ hash: settleHash });
  const [settleToastId, setSettleToastId] = useState<number | null>(null);

  useEffect(() => {
    if (myBalance < 0n) setSettleAmount(formatMon(-myBalance, 6));
  }, [myBalance]);

  useEffect(() => {
    if (!settleError) return;
    const msg = settleError.message.includes("User rejected") ? "Transaction rejected" : "Settlement failed";
    if (settleToastId) update(settleToastId, "error", msg);
  }, [settleError]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!settleReceipt) return;
    if (settleToastId) update(settleToastId, "success", "Settled up!", settleReceipt.transactionHash);
    setSettleAmount("");
    refetchAll();
    resetSettle();
  }, [settleReceipt]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSettleAll() {
    const parsed = Number(settleAmount);
    if (!parsed || parsed <= 0) {
      push("error", "Enter an amount to settle");
      return;
    }
    const id = push("pending", "Confirm in wallet...");
    setSettleToastId(id);
    writeSettle(
      { address, abi: AGREEMENT_ABI, functionName: "settleAll", args: [], value: parseEther(settleAmount) },
      { onSuccess: () => update(id, "pending", "Distributing payment...") }
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
              <Users className="h-3.5 w-3.5" /> Group Pot
            </div>
            <h2 className="text-xl font-semibold text-white sm:text-2xl">{title}</h2>
            {description && <p className="mt-1 text-sm text-zinc-400">{description}</p>}
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
          <span>{participants.length} participants</span>
          <span>{timeUntil(deadline)}</span>
        </div>
      </div>

      {/* Participants */}
      <div className="card p-5 sm:p-6">
        <p className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-300">
          <UserPlus className="h-4 w-4 text-[var(--color-accent)]" /> Participants
        </p>
        <div className="mb-3 flex flex-wrap gap-2">
          {participants.map((p) => (
            <span key={p} className="rounded-full bg-[var(--color-surface-2)] px-3 py-1 font-mono-num text-xs text-zinc-300">
              {shortAddress(p)} {p.toLowerCase() === me?.toLowerCase() && <span className="text-zinc-600">(you)</span>}
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newParticipant}
            onChange={(e) => setNewParticipant(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddParticipant()}
            placeholder="0x... wallet address to invite"
            className="input font-mono-num text-xs"
          />
          <button
            onClick={handleAddParticipant}
            disabled={addParticipantPending || addParticipantConfirming}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-[var(--color-surface-2)] px-4 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800 disabled:opacity-50"
          >
            {addParticipantPending || addParticipantConfirming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Add
          </button>
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

      {/* Live balances table */}
      <div className="card overflow-hidden p-5 sm:p-6">
        <p className="mb-3 text-sm font-medium text-zinc-300">Balances</p>
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs text-zinc-500">
                <th className="pb-2 font-medium">Address</th>
                <th className="pb-2 font-medium">Paid</th>
                <th className="pb-2 font-medium">Owed</th>
                <th className="pb-2 font-medium">Net</th>
              </tr>
            </thead>
            <tbody>
              {participants.map((p) => {
                const key = p.toLowerCase();
                const net = balances.get(key) ?? 0n;
                const isMe = key === me?.toLowerCase();
                return (
                  <tr key={p} className="border-b border-[var(--color-border)]/50 last:border-0">
                    <td className="py-2.5 font-mono-num text-zinc-300">
                      {shortAddress(p)} {isMe && <span className="text-zinc-600">(you)</span>}
                    </td>
                    <td className="py-2.5 font-mono-num text-zinc-400">{formatMon(paidMap.get(key) ?? 0n)} MON</td>
                    <td className="py-2.5 font-mono-num text-zinc-400">{formatMon(owedMap.get(key) ?? 0n)} MON</td>
                    <td className={`py-2.5 font-mono-num font-medium ${net > 0n ? "text-[var(--color-accent)]" : net < 0n ? "text-[var(--color-danger)]" : "text-zinc-500"}`}>
                      {net > 0n ? "+" : net < 0n ? "-" : ""}
                      {formatMon(net < 0n ? -net : net)} MON
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
            <input value={expenseDesc} onChange={(e) => setExpenseDesc(e.target.value)} placeholder="What was it for?" maxLength={100} className="input" />
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-zinc-500">Who paid</span>
              <select value={payer} onChange={(e) => setPayer(e.target.value)} className="input">
                {participants.map((p) => (
                  <option key={p} value={p}>
                    {shortAddress(p)} {p.toLowerCase() === me?.toLowerCase() ? "(you)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <span className="mb-1.5 block text-xs font-medium text-zinc-500">Split among</span>
              <div className="flex flex-wrap gap-2">
                {participants.map((p) => {
                  const checked = splitAmong.has(p.toLowerCase());
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => toggleSplit(p)}
                      className={`rounded-full border px-3 py-1.5 font-mono-num text-xs transition ${
                        checked
                          ? "border-[var(--color-accent)]/50 bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
                          : "border-[var(--color-border)] text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {shortAddress(p)}
                    </button>
                  );
                })}
              </div>
            </div>
            <button
              onClick={handleAddExpense}
              disabled={expensePending || expenseConfirming}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--color-accent-dim)] disabled:opacity-50"
            >
              {expensePending || expenseConfirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add expense
            </button>
          </div>
        </div>

        {/* Settle all */}
        <div className="card p-5 sm:p-6">
          <p className="mb-4 flex items-center gap-2 text-sm font-medium text-zinc-300">
            <HandCoins className="h-4 w-4 text-[var(--color-warn)]" /> Settle up
          </p>
          {myBalance >= 0n ? (
            <p className="text-sm text-zinc-500">You don't owe anything right now.</p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-zinc-500">
                Send a payment and it's automatically split across everyone you owe, proportional to what each is owed.
              </p>
              <input value={settleAmount} onChange={(e) => setSettleAmount(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="Amount (MON)" className="input" />
              <button
                onClick={handleSettleAll}
                disabled={settlePending || settleConfirming}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-warn)] py-2.5 text-sm font-semibold text-[#0e091c] transition hover:brightness-95 disabled:opacity-50"
              >
                {settlePending || settleConfirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <HandCoins className="h-4 w-4" />}
                Settle All
              </button>
            </div>
          )}
        </div>
      </div>

      <HistoryLog address={address} expenses={expenses} />
    </div>
  );
}