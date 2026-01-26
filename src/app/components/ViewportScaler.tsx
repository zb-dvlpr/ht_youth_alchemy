"use client";

import { useEffect } from "react";

const MIN_SCALE = 0.5;
const MAX_SCALE = 1;
const SCALE_EPSILON = 0.002;
const SCALE_FUDGE = 0.995;
const SCALE_PADDING_PX = 12;

function computeScale(container: HTMLElement, viewport: HTMLElement | null) {
  const contentWidth = Math.max(container.scrollWidth, container.offsetWidth);
  const contentHeight = Math.max(container.scrollHeight, container.offsetHeight);
  const viewportWidth = viewport?.clientWidth ?? window.innerWidth;
  const viewportHeight = viewport?.clientHeight ?? window.innerHeight;
  const paddedWidth = Math.max(0, viewportWidth - SCALE_PADDING_PX);
  const paddedHeight = Math.max(0, viewportHeight - SCALE_PADDING_PX);
  if (!contentWidth || !contentHeight) return 1;
  const scale = Math.min(
    MAX_SCALE,
    paddedWidth / contentWidth,
    paddedHeight / contentHeight
  );
  const adjusted = scale * SCALE_FUDGE;
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, adjusted));
}

export default function ViewportScaler() {
  useEffect(() => {
    const container = document.querySelector(
      "[data-scale-container]"
    ) as HTMLElement | null;
    if (!container) return;

    let lastScale = 1;
    let rafId: number | null = null;

    const applyScale = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        const viewport = document.querySelector("main") as HTMLElement | null;
        const root = document.documentElement;
        const nextScale = computeScale(container, viewport);
        if (Math.abs(nextScale - lastScale) < SCALE_EPSILON) return;
        lastScale = nextScale;
        root.style.setProperty("--ui-scale", nextScale.toFixed(4));
        root.style.setProperty("--ui-scale-inv", (1 / nextScale).toFixed(4));
      });
    };

    applyScale();
    window.addEventListener("resize", applyScale);
    window.addEventListener("app:layout-change", applyScale);
    if (document.fonts?.ready) {
      document.fonts.ready.then(applyScale).catch(() => undefined);
    }

    return () => {
      window.removeEventListener("resize", applyScale);
      window.removeEventListener("app:layout-change", applyScale);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, []);

  return null;
}
