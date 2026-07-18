"use client";

import { createContext, useCallback, useContext, useState, ReactNode } from "react";
import { CheckCircle2, XCircle, Loader2, Info, X } from "lucide-react";
import { explorerTxUrl, shortAddress } from "@/lib/utils";

type ToastKind = "success" | "error" | "pending" | "info";

type Toast = {
  id: number;
  kind: ToastKind;
  message: string;
  txHash?: string;
};

type ToastContextValue = {
  push: (kind: ToastKind, message: string, txHash?: string) => number;
  update: (id: number, kind: ToastKind, message: string, txHash?: string) => void;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string, txHash?: string) => {
      const id = nextId++;
      setToasts((prev) => [...prev, { id, kind, message, txHash }]);
      if (kind !== "pending") {
        setTimeout(() => dismiss(id), 6000);
      }
      return id;
    },
    [dismiss]
  );

  const update = useCallback(
    (id: number, kind: ToastKind, message: string, txHash?: string) => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, kind, message, txHash } : t)));
      if (kind !== "pending") {
        setTimeout(() => dismiss(id), 6000);
      }
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ push, update, dismiss }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2 sm:bottom-6 sm:right-6">
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const icon = {
    success: <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--color-accent)]" />,
    error: <XCircle className="h-5 w-5 shrink-0 text-[var(--color-danger)]" />,
    pending: <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[var(--color-warn)]" />,
    info: <Info className="h-5 w-5 shrink-0 text-zinc-400" />,
  }[toast.kind];

  return (
    <div className="flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3.5 shadow-lg shadow-black/40 animate-in slide-in-from-bottom-2">
      {icon}
      <div className="min-w-0 flex-1">
        <p className="text-sm text-zinc-100">{toast.message}</p>
        {toast.txHash && (
          <a
            href={explorerTxUrl(toast.txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-xs text-[var(--color-accent)] hover:underline"
          >
            {shortAddress(toast.txHash)} ↗
          </a>
        )}
      </div>
      <button onClick={onDismiss} className="shrink-0 text-zinc-500 hover:text-zinc-300">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
