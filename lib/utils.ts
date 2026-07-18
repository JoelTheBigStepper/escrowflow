import { formatEther } from "viem";

export function formatMon(value: bigint | undefined, digits = 4): string {
  if (value === undefined) return "0";
  const asNumber = Number(formatEther(value));
  return asNumber.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

export function shortAddress(address?: string): string {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatDeadline(deadline: bigint): string {
  const date = new Date(Number(deadline) * 1000);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function timeUntil(deadline: bigint): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = Number(deadline) - now;
  if (diff <= 0) return "Deadline passed";

  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);

  if (days > 0) return `${days}d ${hours}h left`;
  const minutes = Math.floor((diff % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

export function isValidAddress(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

export function explorerTxUrl(hash: string): string {
  return `https://testnet.monadexplorer.com/tx/${hash}`;
}

export function explorerAddressUrl(address: string): string {
  return `https://testnet.monadexplorer.com/address/${address}`;
}
