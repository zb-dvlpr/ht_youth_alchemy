"use client";

import { useEffect } from "react";

const MIN_SCALE = 0.85;
const MAX_SCALE = 1;

function computeScale() {
  const dpr = window.devicePixelRatio || 1;
  if (dpr <= 1) return 1;
  const scale = 1 / (1 + (dpr - 1) * 0.6);
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
}

export default function ViewportScaler() {
  useEffect(() => {
    const applyScale = () => {
      const scale = computeScale();
      const root = document.documentElement;
      root.style.setProperty("--ui-scale", scale.toFixed(3));
      root.style.setProperty("--ui-scale-inv", (1 / scale).toFixed(3));
    };
    applyScale();
    window.addEventListener("resize", applyScale);
    return () => window.removeEventListener("resize", applyScale);
  }, []);

  return null;
}
