"use client";

import { createContext, type ReactNode, useContext } from "react";

const ReminderBellSlotContext = createContext<ReactNode>(null);

export function ReminderBellSlotProvider({
  bell,
  children,
}: {
  bell: ReactNode;
  children: ReactNode;
}) {
  return (
    <ReminderBellSlotContext.Provider value={bell}>
      {children}
    </ReminderBellSlotContext.Provider>
  );
}

export default function ReminderBellSlot() {
  return <>{useContext(ReminderBellSlotContext)}</>;
}
