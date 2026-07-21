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
import {
  DEBUG_SUPPORTER_TIER_OVERRIDE_EVENT,
  readDebugSupporterTierOverride,
} from "@/lib/settings";
import {
  hasGoldOrHigherSupporterTier,
  isAnyHattrickSupporter,
  normalizeHattrickSupporterTier,
  type HattrickSupporterTier,
} from "@/lib/supporterTier";

export type SupporterStatus = "unknown" | "loading" | "supporter" | "nonSupporter";

type SupporterStatusContextValue = {
  status: SupporterStatus;
  tier: HattrickSupporterTier | null;
  isSupporter: boolean;
  hasGoldOrHigherSupporter: boolean;
};

const SupporterStatusContext =
  createContext<SupporterStatusContextValue | null>(null);

type SupporterStatusProviderProps = {
  isConnected: boolean;
  children: ReactNode;
};

export function SupporterStatusProvider({
  isConnected,
  children,
}: SupporterStatusProviderProps) {
  const [status, setStatus] = useState<SupporterStatus>("unknown");
  const [tier, setTier] = useState<HattrickSupporterTier | null>(null);
  const [debugSupporterTier, setDebugSupporterTier] =
    useState<HattrickSupporterTier>("none");
  const fetchedRef = useRef(false);
  const isDev = process.env.NODE_ENV !== "production";

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
        await Promise.resolve();
        if (cancelled) return;
        setStatus("loading");
        setTier(null);
        const { response, payload } = await fetchChppJson<{
          data?: {
            HattrickData?: {
              User?: {
                SupporterTier?: unknown;
              };
            };
          };
          error?: string;
        }>("/api/chpp/teamdetails", { cache: "no-store" });
        if (cancelled) return;
        if (!response.ok || payload?.error) {
          setStatus("unknown");
          setTier(null);
          return;
        }
        const user = payload?.data?.HattrickData?.User;
        if (!user || typeof user !== "object") {
          setStatus("unknown");
          setTier(null);
          return;
        }
        const normalizedTier = normalizeHattrickSupporterTier(user.SupporterTier);
        if (!normalizedTier) {
          setStatus("unknown");
          setTier(null);
          return;
        }
        setTier(normalizedTier);
        setStatus(
          isAnyHattrickSupporter(normalizedTier) ? "supporter" : "nonSupporter"
        );
      } catch (error) {
        if (!cancelled) {
          setStatus("unknown");
          setTier(null);
          if (error instanceof ChppAuthRequiredError) return;
        }
      }
    };

    void fetchSupporterStatus();
    return () => {
      cancelled = true;
    };
  }, [isConnected]);

  useEffect(() => {
    if (!isDev || typeof window === "undefined") return;
    const syncDebugSupporterTierOverride = () => {
      setDebugSupporterTier(readDebugSupporterTierOverride());
    };
    syncDebugSupporterTierOverride();
    window.addEventListener(
      DEBUG_SUPPORTER_TIER_OVERRIDE_EVENT,
      syncDebugSupporterTierOverride
    );
    return () => {
      window.removeEventListener(
        DEBUG_SUPPORTER_TIER_OVERRIDE_EVENT,
        syncDebugSupporterTierOverride
      );
    };
  }, [isDev]);

  const effectiveTier = !isConnected ? null : isDev ? debugSupporterTier : tier;
  const effectiveStatus: SupporterStatus =
    !isConnected || !effectiveTier
      ? "unknown"
      : isAnyHattrickSupporter(effectiveTier)
        ? "supporter"
        : "nonSupporter";
  const visibleStatus: SupporterStatus = !isConnected
    ? "unknown"
    : isDev
      ? effectiveStatus
      : status;
  const value = useMemo(
    () => ({
      status: visibleStatus,
      tier: effectiveTier,
      isSupporter: effectiveTier ? isAnyHattrickSupporter(effectiveTier) : false,
      hasGoldOrHigherSupporter: effectiveTier
        ? hasGoldOrHigherSupporterTier(effectiveTier)
        : false,
    }),
    [effectiveTier, visibleStatus]
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
