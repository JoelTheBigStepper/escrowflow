"use client";

import { useState } from "react";
import { Workflow } from "lucide-react";
import { ConnectButton } from "@/components/ConnectButton";
import { CreateAgreementForm } from "@/components/CreateAgreementForm";
import { AgreementLoader } from "@/components/AgreementLoader";
import { AgreementView } from "@/components/AgreementView";
import { useRecentAgreements } from "@/lib/useRecentAgreements";

export default function Home() {
  const [activeAgreement, setActiveAgreement] = useState<`0x${string}` | null>(null);
  const { recent, remove } = useRecentAgreements();

  return (
    <main className="min-h-screen">
      <header className="border-b border-[var(--color-border)]">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-accent)]/15">
              <Workflow className="h-4.5 w-4.5 text-[var(--color-accent)]" />
            </div>
            <span className="text-base font-semibold tracking-tight text-zinc-50">TrustSplit</span>
          </div>
          <ConnectButton />
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        {activeAgreement ? (
          <AgreementView address={activeAgreement} onBack={() => setActiveAgreement(null)} />
        ) : (
          <div className="space-y-8">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
                Split expenses. Escrow payments. All onchain.
              </h1>
              <p className="mt-2 max-w-lg text-sm text-zinc-500">
                Create a shared pot for group expenses, or lock funds for a freelance job with a
                deadline-backed release. No backend, no middleman — just a contract on Monad.
              </p>
            </div>

            <div className="grid gap-5 lg:grid-cols-5">
              <div className="lg:col-span-3">
                <CreateAgreementForm onCreated={setActiveAgreement} />
              </div>
              <div className="lg:col-span-2">
                <AgreementLoader recent={recent} onLoad={setActiveAgreement} onRemove={remove} />
              </div>
            </div>
          </div>
        )}
      </div>

      <footer className="mx-auto max-w-4xl px-4 pb-10 pt-4 text-center text-xs text-zinc-600 sm:px-6">
        Built for the Monad Spark Hackathon · Contracts run entirely onchain
      </footer>
    </main>
  );
}
