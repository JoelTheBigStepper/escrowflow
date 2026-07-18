"use client";

import { useEffect } from "react";
import { useReadContracts } from "wagmi";
import { ArrowLeft, Loader2 } from "lucide-react";
import { AGREEMENT_ABI, AgreementType } from "@/lib/contracts";
import { GroupDashboard } from "@/components/GroupDashboard";
import { EscrowDashboard } from "@/components/EscrowDashboard";
import { useRecentAgreements } from "@/lib/useRecentAgreements";

export function AgreementView({ address, onBack }: { address: `0x${string}`; onBack: () => void }) {
  const { add } = useRecentAgreements();

  const { data, isLoading, isError } = useReadContracts({
    contracts: [
      { address, abi: AGREEMENT_ABI, functionName: "agreementType" },
      { address, abi: AGREEMENT_ABI, functionName: "title" },
      { address, abi: AGREEMENT_ABI, functionName: "description" },
      { address, abi: AGREEMENT_ABI, functionName: "deadline" },
      { address, abi: AGREEMENT_ABI, functionName: "initialized" },
    ],
  });

  const agreementType = data?.[0]?.result as AgreementType | undefined;
  const title = data?.[1]?.result as string | undefined;
  const description = data?.[2]?.result as string | undefined;
  const deadline = data?.[3]?.result as bigint | undefined;
  const initialized = data?.[4]?.result as boolean | undefined;

  useEffect(() => {
    if (title && agreementType !== undefined) {
      add({ address, title, type: agreementType === AgreementType.Group ? "Group" : "Escrow" });
    }
  }, [title, agreementType]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      {isLoading && (
        <div className="card flex items-center justify-center gap-2 p-12 text-zinc-500">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading agreement...
        </div>
      )}

      {(isError || (!isLoading && !initialized)) && (
        <div className="card p-8 text-center">
          <p className="text-sm text-[var(--color-danger)]">
            Couldn't load an EscrowFlow agreement at this address. Double-check it was created by the factory.
          </p>
        </div>
      )}

      {!isLoading && initialized && title !== undefined && description !== undefined && deadline !== undefined && agreementType !== undefined && (
        agreementType === AgreementType.Group ? (
          <GroupDashboard address={address} title={title} description={description} deadline={deadline} />
        ) : (
          <EscrowDashboard address={address} title={title} description={description} deadline={deadline} />
        )
      )}
    </div>
  );
}