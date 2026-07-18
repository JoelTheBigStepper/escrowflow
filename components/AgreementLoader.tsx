"use client";

import { useState } from "react";
import { FolderOpen, Users, Lock, ArrowRight, Trash2 } from "lucide-react";
import { isValidAddress, shortAddress } from "@/lib/utils";
import { useToast } from "@/components/Toast";
import { RecentAgreement } from "@/lib/useRecentAgreements";

export function AgreementLoader({
  recent,
  onLoad,
  onRemove,
}: {
  recent: RecentAgreement[];
  onLoad: (address: `0x${string}`) => void;
  onRemove: (address: string) => void;
}) {
  const [value, setValue] = useState("");
  const { push } = useToast();

  function handleLoad() {
    const trimmed = value.trim();
    if (!isValidAddress(trimmed)) {
      push("error", "Enter a valid contract address");
      return;
    }
    onLoad(trimmed);
  }

  return (
    <div className="card p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2 text-sm font-medium text-zinc-300">
        <FolderOpen className="h-4 w-4 text-[var(--color-accent)]" />
        Open an existing agreement
      </div>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLoad()}
          placeholder="Paste agreement address (0x...)"
          className="input font-mono-num text-xs"
        />
        <button
          onClick={handleLoad}
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-[var(--color-surface-2)] px-4 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800"
        >
          Open <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {recent.length > 0 && (
        <div className="mt-5 space-y-1.5">
          <p className="mb-2 text-xs font-medium text-zinc-500">Recent</p>
          {recent.map((r) => (
            <div
              key={r.address}
              className="group flex items-center justify-between gap-2 rounded-lg border border-transparent px-2.5 py-2 hover:border-[var(--color-border)] hover:bg-[var(--color-surface-2)]"
            >
              <button onClick={() => onLoad(r.address as `0x${string}`)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                {r.type === "Group" ? (
                  <Users className="h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]" />
                ) : (
                  <Lock className="h-3.5 w-3.5 shrink-0 text-[var(--color-warn)]" />
                )}
                <span className="min-w-0 flex-1 truncate text-sm text-zinc-300">{r.title}</span>
                <span className="font-mono-num shrink-0 text-xs text-zinc-600">{shortAddress(r.address)}</span>
              </button>
              <button
                onClick={() => onRemove(r.address)}
                className="shrink-0 text-zinc-600 opacity-0 transition hover:text-[var(--color-danger)] group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
