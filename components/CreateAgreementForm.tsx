"use client";

import { useEffect, useState } from "react";
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { decodeEventLog, parseEther } from "viem";
import { Users, Lock, Loader2, Rocket } from "lucide-react";
import { AGREEMENT_ABI, AgreementType, FACTORY_ABI, FACTORY_ADDRESS } from "@/lib/contracts";
import { isValidAddress } from "@/lib/utils";
import { useToast } from "@/components/Toast";

export function CreateAgreementForm({ onCreated }: { onCreated: (address: `0x${string}`) => void }) {
  const { isConnected } = useAccount();
  const { push, update } = useToast();

  const [type, setType] = useState<AgreementType>(AgreementType.Group);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadlineDays, setDeadlineDays] = useState("7");
  const [initialDeposit, setInitialDeposit] = useState("");
  const [recipient, setRecipient] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [toastId, setToastId] = useState<number | null>(null);

  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { data: receipt, isLoading: isConfirming } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (!error) return;
    const message = error.message.includes("User rejected") ? "Transaction rejected" : "Transaction failed";
    if (toastId) update(toastId, "error", message);
    else push("error", message);
  }, [error]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!receipt) return;
    let created: `0x${string}` | undefined;
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({ abi: FACTORY_ABI, data: log.data, topics: log.topics });
        if (decoded.eventName === "AgreementCreated") {
          created = (decoded.args as unknown as { agreementAddress: `0x${string}` }).agreementAddress;
          break;
        }
      } catch {
        // not the event we're looking for, skip
      }
    }
    if (toastId) {
      update(
        toastId,
        "success",
        type === AgreementType.Group ? "Pot created! Taking you there..." : "Escrow created — deposit funds to get started.",
        receipt.transactionHash
      );
    }
    if (created) onCreated(created);
    reset();
  }, [receipt]); // eslint-disable-line react-hooks/exhaustive-deps

  const isGroup = type === AgreementType.Group;
  const canSubmit =
    isConnected &&
    title.trim().length > 0 &&
    Number(deadlineDays) > 0 &&
    (isGroup ? true : isValidAddress(recipient.trim()) && Number(targetAmount) > 0 && description.trim().length > 0);

  function handleSubmit() {
    if (!canSubmit) return;
    if (FACTORY_ADDRESS === "0x0000000000000000000000000000000000000000") {
      push("error", "Factory not deployed yet — set NEXT_PUBLIC_FACTORY_ADDRESS");
      return;
    }

    const id = push("pending", "Confirm in wallet...");
    setToastId(id);

    const deposit = isGroup && Number(initialDeposit) > 0 ? parseEther(initialDeposit) : 0n;

    writeContract(
      {
        address: FACTORY_ADDRESS,
        abi: FACTORY_ABI,
        functionName: "createAgreement",
        args: [
          type,
          title.trim(),
          description.trim(),
          BigInt(deadlineDays),
          [] as `0x${string}`[], // participants are added after creation, from inside the pot
          (isGroup ? "0x0000000000000000000000000000000000000000" : recipient.trim()) as `0x${string}`,
          isGroup ? 0n : parseEther(targetAmount || "0"),
        ],
        value: deposit,
      },
      {
        onSuccess: () => update(id, "pending", "Deploying agreement..."),
      }
    );
  }

  const busy = isPending || isConfirming;

  return (
    <div className="card p-5 sm:p-6">
      <div className="mb-5 grid grid-cols-2 gap-2">
        <TypeButton
          active={type === AgreementType.Group}
          icon={<Users className="h-4 w-4" />}
          label="Group Pot"
          onClick={() => setType(AgreementType.Group)}
        />
        <TypeButton
          active={type === AgreementType.Escrow}
          icon={<Lock className="h-4 w-4" />}
          label="Service Escrow"
          onClick={() => setType(AgreementType.Escrow)}
        />
      </div>

      <div className="space-y-4">
        <Field label="Title">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={isGroup ? "Lagos trip, June" : "Landing page redesign"}
            maxLength={80}
            className="input"
          />
        </Field>

        <Field label={isGroup ? "Description (optional)" : "Service description"}>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={isGroup ? "What's this pot for?" : "What's being delivered?"}
            maxLength={200}
            className="input"
          />
        </Field>

        <Field label="Deadline (days)">
          <input
            value={deadlineDays}
            onChange={(e) => setDeadlineDays(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="7"
            className="input"
          />
        </Field>

        {isGroup ? (
          <Field label="Initial deposit (optional, MON)">
            <input
              value={initialDeposit}
              onChange={(e) => setInitialDeposit(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="0.0"
              className="input"
            />
            <p className="mt-1.5 text-xs text-zinc-600">
              Logged as an expense you paid, split across whoever's in the pot when others join.
            </p>
          </Field>
        ) : (
          <>
            <Field label="Recipient address (who gets paid)">
              <input
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="0x..."
                className="input font-mono-num text-xs"
              />
            </Field>
            <Field label="Amount to lock (MON)">
              <input
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0.0"
                className="input"
              />
              <p className="mt-1.5 text-xs text-zinc-600">
                This just sets the suggested deposit amount — you'll deposit it as a separate step next.
              </p>
            </Field>
          </>
        )}

        <button
          onClick={handleSubmit}
          disabled={!canSubmit || busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] py-3 text-sm font-semibold text-white transition hover:bg-[var(--color-accent-dim)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> {isPending ? "Confirm in wallet..." : "Deploying..."}
            </>
          ) : (
            <>
              <Rocket className="h-4 w-4" /> {isGroup ? "Create New Group Pot" : "Create New Escrow"}
            </>
          )}
        </button>
        {!isConnected && <p className="text-center text-xs text-zinc-500">Connect your wallet to create an agreement.</p>}
      </div>
    </div>
  );
}

function TypeButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-medium transition ${
        active
          ? "border-[var(--color-accent)]/50 bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
          : "border-[var(--color-border)] text-zinc-400 hover:text-zinc-200"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-zinc-500">{label}</span>
      {children}
    </label>
  );
}