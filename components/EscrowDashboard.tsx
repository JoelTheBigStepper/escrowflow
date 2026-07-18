"use client";

import { useEffect, useState } from "react";
import { useAccount, useReadContract, useReadContracts, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { parseEther } from "viem";
import { Lock, Unlock, Copy, Check, ExternalLink, Loader2, ShieldCheck, Clock } from "lucide-react";
import { AGREEMENT_ABI } from "@/lib/contracts";
import { explorerAddressUrl, formatMon, shortAddress, timeUntil, formatDeadline } from "@/lib/utils";
import { useToast } from "@/components/Toast";

export function EscrowDashboard({ address, title, deadline }: { address: `0x${string}`; title: string; deadline: bigint }) {
  const { address: me } = useAccount();
  const { push, update } = useToast();
  const [copied, setCopied] = useState(false);

  const { data, refetch } = useReadContracts({
    contracts: [
      { address, abi: AGREEMENT_ABI, functionName: "payer" },
      { address, abi: AGREEMENT_ABI, functionName: "provider" },
      { address, abi: AGREEMENT_ABI, functionName: "lockedAmount" },
      { address, abi: AGREEMENT_ABI, functionName: "released" },
      { address, abi: AGREEMENT_ABI, functionName: "escrowDescription" },
      { address, abi: AGREEMENT_ABI, functionName: "isClaimable" },
    ],
  });

  const [payer, provider, lockedAmount, released, escrowDescription, isClaimable] = [
    data?.[0]?.result as `0x${string}` | undefined,
    data?.[1]?.result as `0x${string}` | undefined,
    data?.[2]?.result as bigint | undefined,
    data?.[3]?.result as boolean | undefined,
    data?.[4]?.result as string | undefined,
    data?.[5]?.result as boolean | undefined,
  ];

  const isPayer = me && payer && me.toLowerCase() === payer.toLowerCase();
  const isProvider = me && provider && me.toLowerCase() === provider.toLowerCase();
  const deadlinePassed = Number(deadline) * 1000 < Date.now();

  // --- Lock funds ---
  const [lockAmount, setLockAmount] = useState("");
  const [lockDesc, setLockDesc] = useState("");
  const { writeContract: writeLock, data: lockHash, isPending: lockPending, error: lockError, reset: resetLock } = useWriteContract();
  const { data: lockReceipt, isLoading: lockConfirming } = useWaitForTransactionReceipt({ hash: lockHash });
  const [lockToastId, setLockToastId] = useState<number | null>(null);

  useEffect(() => {
    if (!lockError) return;
    const msg = lockError.message.includes("User rejected") ? "Transaction rejected" : "Failed to lock funds";
    if (lockToastId) update(lockToastId, "error", msg);
  }, [lockError]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!lockReceipt) return;
    if (lockToastId) update(lockToastId, "success", "Funds locked", lockReceipt.transactionHash);
    setLockAmount("");
    setLockDesc("");
    refetch();
    resetLock();
  }, [lockReceipt]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleLock() {
    const parsed = Number(lockAmount);
    if (!parsed || parsed <= 0) {
      push("error", "Enter an amount to lock");
      return;
    }
    const id = push("pending", "Confirm in wallet...");
    setLockToastId(id);
    writeLock(
      { address, abi: AGREEMENT_ABI, functionName: "lockFunds", args: [lockDesc.trim()], value: parseEther(lockAmount) },
      { onSuccess: () => update(id, "pending", "Locking funds...") }
    );
  }

  // --- Release / Claim (share the same write hook, different function names) ---
  const { writeContract: writeAction, data: actionHash, isPending: actionPending, error: actionError, reset: resetAction } = useWriteContract();
  const { data: actionReceipt, isLoading: actionConfirming } = useWaitForTransactionReceipt({ hash: actionHash });
  const [actionToastId, setActionToastId] = useState<number | null>(null);

  useEffect(() => {
    if (!actionError) return;
    const msg = actionError.message.includes("User rejected") ? "Transaction rejected" : "Transaction failed";
    if (actionToastId) update(actionToastId, "error", msg);
  }, [actionError]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!actionReceipt) return;
    if (actionToastId) update(actionToastId, "success", "Funds released to provider", actionReceipt.transactionHash);
    refetch();
    resetAction();
  }, [actionReceipt]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleRelease() {
    const id = push("pending", "Confirm in wallet...");
    setActionToastId(id);
    writeAction({ address, abi: AGREEMENT_ABI, functionName: "release" }, { onSuccess: () => update(id, "pending", "Releasing funds...") });
  }

  function handleClaim() {
    const id = push("pending", "Confirm in wallet...");
    setActionToastId(id);
    writeAction({ address, abi: AGREEMENT_ABI, functionName: "claim" }, { onSuccess: () => update(id, "pending", "Claiming funds...") });
  }

  function copyAddress() {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const busy = lockPending || lockConfirming || actionPending || actionConfirming;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs font-medium text-[var(--color-warn)]">
              <Lock className="h-3.5 w-3.5" /> Service Escrow
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
        <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-zinc-500 sm:grid-cols-4">
          <span>Payer: <span className="font-mono-num text-zinc-400">{shortAddress(payer)}</span> {isPayer && "(you)"}</span>
          <span>Provider: <span className="font-mono-num text-zinc-400">{shortAddress(provider)}</span> {isProvider && "(you)"}</span>
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {timeUntil(deadline)}</span>
          <span>{formatDeadline(deadline)}</span>
        </div>
      </div>

      {/* Status */}
      <div className="card p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="mb-1 text-xs font-medium text-zinc-500">Locked amount</p>
            <p className="font-mono-num text-3xl font-semibold text-zinc-50">{formatMon(lockedAmount)} MON</p>
          </div>
          <StatusBadge released={!!released} deadlinePassed={deadlinePassed} claimable={!!isClaimable} />
        </div>
        {escrowDescription && <p className="mt-3 text-sm text-zinc-400">"{escrowDescription}"</p>}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Lock funds — payer only, before release */}
        {isPayer && !released && (
          <div className="card p-5 sm:p-6">
            <p className="mb-4 flex items-center gap-2 text-sm font-medium text-zinc-300">
              <Lock className="h-4 w-4 text-[var(--color-warn)]" /> Lock funds
            </p>
            <div className="space-y-3">
              <input value={lockAmount} onChange={(e) => setLockAmount(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="Amount (MON)" className="input" />
              <input value={lockDesc} onChange={(e) => setLockDesc(e.target.value)} placeholder="Description (optional)" maxLength={100} className="input" />
              <button
                onClick={handleLock}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-warn)] py-2.5 text-sm font-semibold text-zinc-950 transition hover:brightness-95 disabled:opacity-50"
              >
                {lockPending || lockConfirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                Lock into escrow
              </button>
            </div>
          </div>
        )}

        {/* Release — payer only */}
        {isPayer && !released && (lockedAmount ?? 0n) > 0n && (
          <div className="card p-5 sm:p-6">
            <p className="mb-4 flex items-center gap-2 text-sm font-medium text-zinc-300">
              <ShieldCheck className="h-4 w-4 text-[var(--color-accent)]" /> Release to provider
            </p>
            <p className="mb-4 text-sm text-zinc-500">Satisfied with the work? Release the locked funds now — no need to wait for the deadline.</p>
            <button
              onClick={handleRelease}
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-[var(--color-accent-dim)] disabled:opacity-50"
            >
              {actionPending || actionConfirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlock className="h-4 w-4" />}
              Release funds
            </button>
          </div>
        )}

        {/* Claim — provider only, after deadline */}
        {isProvider && !released && (
          <div className="card p-5 sm:p-6">
            <p className="mb-4 flex items-center gap-2 text-sm font-medium text-zinc-300">
              <Unlock className="h-4 w-4 text-[var(--color-warn)]" /> Claim funds
            </p>
            {isClaimable ? (
              <>
                <p className="mb-4 text-sm text-zinc-500">The deadline has passed — you can claim the locked funds now.</p>
                <button
                  onClick={handleClaim}
                  disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-warn)] py-2.5 text-sm font-semibold text-zinc-950 transition hover:brightness-95 disabled:opacity-50"
                >
                  {actionPending || actionConfirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlock className="h-4 w-4" />}
                  Claim funds
                </button>
              </>
            ) : (
              <p className="text-sm text-zinc-500">
                {(lockedAmount ?? 0n) > 0n ? `Claimable once the deadline passes: ${timeUntil(deadline)}.` : "Waiting for the payer to lock funds."}
              </p>
            )}
          </div>
        )}

        {released && (
          <div className="card p-5 sm:p-6 lg:col-span-2">
            <p className="flex items-center gap-2 text-sm font-medium text-[var(--color-accent)]">
              <ShieldCheck className="h-4 w-4" /> Funds have been released to the provider.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ released, deadlinePassed, claimable }: { released: boolean; deadlinePassed: boolean; claimable: boolean }) {
  if (released) {
    return <span className="rounded-full bg-[var(--color-accent)]/15 px-3 py-1 text-xs font-medium text-[var(--color-accent)]">Released</span>;
  }
  if (claimable) {
    return <span className="rounded-full bg-[var(--color-warn)]/15 px-3 py-1 text-xs font-medium text-[var(--color-warn)]">Claimable</span>;
  }
  if (deadlinePassed) {
    return <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-400">Deadline passed</span>;
  }
  return <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-400">Active</span>;
}
