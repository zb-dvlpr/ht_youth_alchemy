"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";

type TransferMarketActionBarSlotContextValue = {
  setSlot: (slot: ReactNode | null) => void;
};

const TransferMarketActionBarSlotContext =
  createContext<TransferMarketActionBarSlotContextValue | null>(null);

export function TransferMarketActionBarSlotProvider({
  setSlot,
  children,
}: {
  setSlot: (slot: ReactNode | null) => void;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ setSlot }), [setSlot]);

  return (
    <TransferMarketActionBarSlotContext.Provider value={value}>
      {children}
    </TransferMarketActionBarSlotContext.Provider>
  );
}

export function useTransferMarketActionBarSlot(slot: ReactNode | null) {
  const context = useContext(TransferMarketActionBarSlotContext);

  useEffect(() => {
    if (!context) return;
    context.setSlot(slot);
    return () => context.setSlot(null);
  }, [context, slot]);
}
