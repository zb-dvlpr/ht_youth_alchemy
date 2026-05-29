"use client";

import { type ReactNode } from "react";
import { trackAnalyticsEvent } from "@/lib/analytics";
import {
  BUY_COFFEE_PROMPT_DEBUG_OPEN_EVENT,
  BUY_COFFEE_PROMPT_OPEN_EVENT,
} from "@/lib/settings";

export type BuyCoffeePromptSource =
  | "top_bar"
  | "sidebar"
  | "mobile_launcher"
  | "auto"
  | "unknown";

type BuyCoffeeButtonProps = {
  "aria-label": string;
  className?: string;
  children: ReactNode;
  source: Exclude<BuyCoffeePromptSource, "auto" | "unknown">;
};

export default function BuyCoffeeButton({
  "aria-label": ariaLabel,
  className,
  children,
  source,
}: BuyCoffeeButtonProps) {
  return (
    <button
      type="button"
      className={className}
      aria-label={ariaLabel}
      onClick={() => {
        trackAnalyticsEvent("coffee_flow", {
          action: "opened",
          app_source: source,
        });
        window.dispatchEvent(
          new CustomEvent(BUY_COFFEE_PROMPT_OPEN_EVENT, {
            detail: { source },
          })
        );
        window.dispatchEvent(
          new CustomEvent(BUY_COFFEE_PROMPT_DEBUG_OPEN_EVENT, {
            detail: { source },
          })
        );
      }}
    >
      {children}
    </button>
  );
}
