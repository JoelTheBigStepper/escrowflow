"use client";

import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { Wallet, LogOut, AlertTriangle } from "lucide-react";
import { monadTestnet } from "@/lib/wagmi";
import { shortAddress } from "@/lib/utils";

export function ConnectButton() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  const wrongNetwork = isConnected && chainId !== monadTestnet.id;

  if (!isConnected) {
    return (
      <button
        onClick={() => connect({ connector: connectors[0] })}
        disabled={isPending}
        className="flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-[var(--color-accent-dim)] disabled:opacity-60"
      >
        <Wallet className="h-4 w-4" />
        {isPending ? "Connecting..." : "Connect Wallet"}
      </button>
    );
  }

  if (wrongNetwork) {
    return (
      <button
        onClick={() => switchChain({ chainId: monadTestnet.id })}
        className="flex items-center gap-2 rounded-lg bg-[var(--color-danger)]/15 px-4 py-2 text-sm font-medium text-[var(--color-danger)] transition hover:bg-[var(--color-danger)]/25"
      >
        <AlertTriangle className="h-4 w-4" />
        Switch to Monad
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm">
        <span className="h-2 w-2 rounded-full bg-[var(--color-accent)]" />
        <span className="font-mono-num text-zinc-200">{shortAddress(address)}</span>
      </div>
      <button
        onClick={() => disconnect()}
        title="Disconnect"
        className="rounded-lg border border-[var(--color-border)] p-2 text-zinc-400 transition hover:border-[var(--color-danger)]/40 hover:text-[var(--color-danger)]"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}
