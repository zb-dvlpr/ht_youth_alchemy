"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { fetchChppJson } from "@/lib/chpp/client";
import {
  hasChppPermission,
  parseExtendedPermissionsFromCheckToken,
} from "@/lib/chpp/permissions";

type ChppPermissionsContextValue = {
  loading: boolean;
  permissions: string[];
  error: string | null;
  hasPermission: (permission: string) => boolean;
};

const ChppPermissionsContext =
  createContext<ChppPermissionsContextValue | null>(null);

export function ChppPermissionsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const { response, payload } = await fetchChppJson<{
          raw?: string;
          permissions?: string[];
          error?: string;
        }>("/api/chpp/oauth/check-token", { cache: "no-store" });
        if (!active) return;
        if (!response.ok) {
          setError(payload?.error ?? "Unable to check CHPP permissions.");
          return;
        }
        setPermissions(
          Array.isArray(payload?.permissions)
            ? payload.permissions
            : parseExtendedPermissionsFromCheckToken(payload?.raw ?? "")
        );
        setError(null);
      } catch (loadError) {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to check CHPP permissions."
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  const hasPermission = useCallback(
    (permission: string) => hasChppPermission(permissions, permission),
    [permissions]
  );
  const value = useMemo(
    () => ({ loading, permissions, error, hasPermission }),
    [error, hasPermission, loading, permissions]
  );

  return (
    <ChppPermissionsContext.Provider value={value}>
      {children}
    </ChppPermissionsContext.Provider>
  );
}

export function useChppPermissions() {
  const context = useContext(ChppPermissionsContext);
  if (!context) {
    throw new Error(
      "useChppPermissions must be used within ChppPermissionsProvider"
    );
  }
  return context;
}
