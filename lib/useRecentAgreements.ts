"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "TrustSplit:recent";
const MAX_RECENT = 12;

export type RecentAgreement = {
  address: string;
  title: string;
  type: "Group" | "Escrow";
  savedAt: number;
};

export function useRecentAgreements() {
  const [recent, setRecent] = useState<RecentAgreement[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setRecent(JSON.parse(raw));
    } catch {
      // ignore corrupt storage
    }
  }, []);

  const add = useCallback((entry: Omit<RecentAgreement, "savedAt">) => {
    setRecent((prev) => {
      const next = [{ ...entry, savedAt: Date.now() }, ...prev.filter((r) => r.address !== entry.address)].slice(
        0,
        MAX_RECENT
      );
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore quota errors
      }
      return next;
    });
  }, []);

  const remove = useCallback((address: string) => {
    setRecent((prev) => {
      const next = prev.filter((r) => r.address !== address);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  return { recent, add, remove };
}
