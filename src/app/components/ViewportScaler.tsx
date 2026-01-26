"use client";

import { useEffect } from "react";

const MIN_SCALE = 0.7;
const MAX_SCALE = 1;

function computeScale(container: HTMLElement) {
  const rect = container.getBoundingClientRect();
  const currentScale =
    Number(
      getComputedStyle(document.documentElement)
        .getPropertyValue("--ui-scale")
        .trim()
    ) || 1;
  const contentWidth = rect.width / currentScale;
  const contentHeight = rect.height / currentScale;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  if (!contentWidth || !contentHeight) return 1;
  const scale = Math.min(
    MAX_SCALE,
    viewportWidth / contentWidth,
    viewportHeight / contentHeight
  );
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
}

export default function ViewportScaler() {
  useEffect(() => {
    const container = document.querySelector(
      "[data-scale-container]"
    ) as HTMLElement | null;
    if (!container) return;

    const applyScale = () => {
      const scale = computeScale(container);
      const root = document.documentElement;
      root.style.setProperty("--ui-scale", scale.toFixed(3));
      root.style.setProperty("--ui-scale-inv", (1 / scale).toFixed(3));
    };
    applyScale();
    const observer = new ResizeObserver(applyScale);
    observer.observe(container);
    window.addEventListener("resize", applyScale);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", applyScale);
    };
  }, []);

  return null;
}
