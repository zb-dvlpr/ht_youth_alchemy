"use client";

import { type ReactNode } from "react";
import {
  BUY_COFFEE_PROMPT_DEBUG_OPEN_EVENT,
  BUY_COFFEE_PROMPT_OPEN_EVENT,
} from "@/lib/settings";

type BuyCoffeeButtonProps = {
  "aria-label": string;
  className?: string;
  children: ReactNode;
};

export default function BuyCoffeeButton({
  "aria-label": ariaLabel,
  className,
  children,
}: BuyCoffeeButtonProps) {
  return (
    <button
      type="button"
      className={className}
      aria-label={ariaLabel}
      onClick={() => {
        window.dispatchEvent(new CustomEvent(BUY_COFFEE_PROMPT_OPEN_EVENT));
        window.dispatchEvent(new CustomEvent(BUY_COFFEE_PROMPT_DEBUG_OPEN_EVENT));
      }}
    >
      {children}
    </button>
  );
}
