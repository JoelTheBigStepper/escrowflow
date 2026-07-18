"use client";

import { useEffect, useState } from "react";
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { decodeEventLog } from "viem";
import { Users, Lock, Plus, X, Loader2, Rocket } from "lucide-react";
import { AGREEMENT_ABI, AgreementType, FACTORY_ABI, FACTORY_ADDRESS } from "@/lib/contracts";
import { isValidAddress } from "@/lib/utils";
import { useToast } from "@/components/Toast";

export function CreateAgreementForm({ onCreated }: { onCreated: (address: `0x${string}`) => void }) {
  const { address, isConnected } = useAccount();
  const { push, update } = useToast();

  const [type, setType] = useState<AgreementType>(AgreementType.Group);
  const [title, setTitle] = useState("");
  const [deadlineDays, setDeadlineDays] = useState("7");
  const [participants, setParticipants] = useState<string[]>([""]);
  const [provider, setProvider] = useState("");
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
    if (toastId) update(toastId, "success", "Agreement created!", receipt.transactionHash);
    if (created) onCreated(created);
    reset();
  }, [receipt]); // eslint-disable-line react-hooks/exhaustive-deps

  const validParticipants = participants.map((p) => p.trim()).filter((p) => p.length > 0);
  const badParticipant = validParticipants.find((p) => !isValidAddress(p));

  const canSubmit =
    isConnected &&
    title.trim().length > 0 &&
    Number(deadlineDays) > 0 &&
    (type === AgreementType.Group ? true : isValidAddress(provider.trim()));

  function handleSubmit() {
    if (!canSubmit) return;
    if (type === AgreementType.Group && badParticipant) {
      push("error", `Invalid address: ${badParticipant}`);
      return;
    }
    if (FACTORY_ADDRESS === "0x0000000000000000000000000000000000000000") {
      push("error", "Factory not deployed yet — set NEXT_PUBLIC_FACTORY_ADDRESS");
      return;
    }

    const id = push("pending", "Confirm in wallet...");
    setToastId(id);

    writeContract(
      {
        address: FACTORY_ADDRESS,
        abi: FACTORY_ABI,
        functionName: "createAgreement",
        args: [
          type,
          title.trim(),
          BigInt(deadlineDays),
          (type === AgreementType.Group ? validParticipants : []) as `0x${string}`[],
          (type === AgreementType.Escrow ? provider.trim() : "0x0000000000000000000000000000000000000000") as `0x${string}`,
        ],
      },
      {
        onSuccess: () => update(id, "pending", "Deploying agreement..."),
      }
    );
  }

  const busy = isPending || isConfirming;

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6">
      <div className="mb-5 grid grid-cols-2 gap-2">
        <TypeButton
          active={type === AgreementType.Group}
          icon={<Users className="h-4 w-4" />}
          label="Group Splitter"
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
            placeholder={type === AgreementType.Group ? "Lagos trip, June" : "Landing page redesign"}
            maxLength={80}
            className="input"
          />
        </Field>

        <Field label={type === AgreementType.Group ? "Deadline (informational, days)" : "Auto-release deadline (days)"}>
          <input
            value={deadlineDays}
            onChange={(e) => setDeadlineDays(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="7"
            className="input"
          />
        </Field>

        {type === AgreementType.Group ? (
          <Field label="Participants (wallet addresses, you're added automatically)">
            <div className="space-y-2">
              {participants.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={p}
                    onChange={(e) => {
                      const next = [...participants];
                      next[i] = e.target.value;
                      setParticipants(next);
                    }}
                    placeholder="0x..."
                    className="input font-mono-num text-xs"
                  />
                  {participants.length > 1 && (
                    <button
                      onClick={() => setParticipants(participants.filter((_, idx) => idx !== i))}
                      className="shrink-0 rounded-lg border border-[var(--color-border)] p-2 text-zinc-500 hover:text-[var(--color-danger)]"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setParticipants([...participants, ""])}
                className="flex items-center gap-1.5 text-sm text-[var(--color-accent)] hover:underline"
              >
                <Plus className="h-3.5 w-3.5" /> Add participant
              </button>
            </div>
          </Field>
        ) : (
          <Field label="Service provider address (who gets paid)">
            <input
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              placeholder="0x..."
              className="input font-mono-num text-xs"
            />
          </Field>
        )}

        <button
          onClick={handleSubmit}
          disabled={!canSubmit || busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] py-3 text-sm font-semibold text-zinc-950 transition hover:bg-[var(--color-accent-dim)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> {isPending ? "Confirm in wallet..." : "Deploying..."}
            </>
          ) : (
            <>
              <Rocket className="h-4 w-4" /> Create agreement
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
