import type { Abi } from "viem";
import factoryAbiJson from "./abis/factory.json";
import agreementAbiJson from "./abis/agreement.json";

export const FACTORY_ABI = factoryAbiJson as Abi;
export const AGREEMENT_ABI = agreementAbiJson as Abi;

// Set after running the deployment script — see README "Deployment notes".
export const FACTORY_ADDRESS = (process.env.NEXT_PUBLIC_FACTORY_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

export enum AgreementType {
  Group = 0,
  Escrow = 1,
}

export enum EscrowStatus {
  AwaitingDeposit = 0,
  Locked = 1,
  Released = 2,
  Expired = 3,
}

export type Expense = {
  payer: `0x${string}`;
  amount: bigint;
  description: string;
  splitAmong: `0x${string}`[];
  timestamp: bigint;
};

export type AgreementSummary = {
  address: `0x${string}`;
  title: string;
  agreementType: AgreementType;
  creator: `0x${string}`;
  deadline: bigint;
};