"use client";

import { useEffect } from "react";
import { backfillSeniorEncounteredPlayerModelFromLocalCache } from "@/lib/seniorEncounteredPlayerModel";

const BACKFILL_INTERVAL_MS = 5 * 60 * 1000;

export default function SeniorMlBackfillBootstrap() {
  useEffect(() => {
    void backfillSeniorEncounteredPlayerModelFromLocalCache();
    const intervalId = window.setInterval(() => {
      void backfillSeniorEncounteredPlayerModelFromLocalCache();
    }, BACKFILL_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, []);

  return null;
}
