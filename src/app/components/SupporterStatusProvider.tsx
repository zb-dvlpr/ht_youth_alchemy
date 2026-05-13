"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { ChppAuthRequiredError, fetchChppJson } from "@/lib/chpp/client";

export type SupporterStatus = "unknown" | "loading" | "supporter" | "nonSupporter";

type SupporterStatusContextValue = {
  status: SupporterStatus;
  isSupporter: boolean;
};

const SupporterStatusContext =
  createContext<SupporterStatusContextValue | null>(null);

const isSupporterTierValue = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) && value > 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return Boolean(
      normalized &&
        normalized !== "0" &&
        normalized !== "none" &&
        normalized !== "false" &&
        normalized !== "no"
    );
  }
  return false;
};

type SupporterStatusProviderProps = {
  isConnected: boolean;
  children: ReactNode;
};

export function SupporterStatusProvider({
  isConnected,
  children,
}: SupporterStatusProviderProps) {
  const [status, setStatus] = useState<SupporterStatus>("unknown");
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!isConnected) {
      fetchedRef.current = false;
      return;
    }
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    let cancelled = false;

    const fetchSupporterStatus = async () => {
      try {
        const { response, payload } = await fetchChppJson<{
          data?: {
            HattrickData?: {
              UserSupporterTier?: unknown;
            };
          };
          error?: string;
        }>("/api/chpp/training?actionType=view", { cache: "no-store" });
        if (cancelled) return;
        if (!response.ok || payload?.error) {
          setStatus("unknown");
          return;
        }
        setStatus(
          isSupporterTierValue(payload?.data?.HattrickData?.UserSupporterTier)
            ? "supporter"
            : "nonSupporter"
        );
      } catch (error) {
        if (!cancelled && !(error instanceof ChppAuthRequiredError)) {
          setStatus("unknown");
        }
      }
    };

    void fetchSupporterStatus();
    return () => {
      cancelled = true;
    };
  }, [isConnected]);

  const effectiveStatus = isConnected ? status : "unknown";
  const value = useMemo(
    () => ({
      status: effectiveStatus,
      isSupporter: effectiveStatus === "supporter",
    }),
    [effectiveStatus]
  );

  return (
    <SupporterStatusContext.Provider value={value}>
      {children}
    </SupporterStatusContext.Provider>
  );
}

export function useSupporterStatus() {
  const value = useContext(SupporterStatusContext);
  if (!value) {
    throw new Error("useSupporterStatus must be used within SupporterStatusProvider");
  }
  return value;
}
