"use client";

import { useEffect } from "react";
import {
  GENERAL_SETTINGS_EVENT,
  GENERAL_SETTINGS_STORAGE_KEY,
  readGeneralEnableScaling,
} from "@/lib/settings";

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

    const setScalingState = (enabled: boolean) => {
      const root = document.documentElement;
      if (!enabled) {
        root.dataset.appScaling = "off";
      } else {
        delete root.dataset.appScaling;
      }
    };

    const applyScaleVars = (scale: number) => {
      const root = document.documentElement;
      root.style.setProperty("--ui-scale", scale.toFixed(4));
      root.style.setProperty("--ui-scale-inv", (1 / scale).toFixed(4));
    };

    const applyScale = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        const enableScaling = readGeneralEnableScaling();
        setScalingState(enableScaling);
        if (!enableScaling) {
          lastScale = 1;
          applyScaleVars(1);
          return;
        }
        const viewport = document.querySelector("main") as HTMLElement | null;
        const nextScale = computeScale(container, viewport);
        if (Math.abs(nextScale - lastScale) < SCALE_EPSILON) return;
        lastScale = nextScale;
        applyScaleVars(nextScale);
      });
    };

    const handleGeneralChange = (event: Event) => {
      if (event instanceof StorageEvent) {
        if (
          event.key &&
          event.key !== GENERAL_SETTINGS_STORAGE_KEY
        ) {
          return;
        }
      }
      if (event instanceof CustomEvent) {
        const detail = event.detail as { enableScaling?: boolean } | null;
        if (typeof detail?.enableScaling === "boolean") {
          if (!detail.enableScaling) {
            lastScale = 1;
            setScalingState(false);
            applyScaleVars(1);
            return;
          }
          setScalingState(true);
          applyScale();
          return;
        }
      }
      applyScale();
    };

    applyScale();
    window.addEventListener("resize", applyScale);
    window.addEventListener("app:layout-change", applyScale);
    window.addEventListener(GENERAL_SETTINGS_EVENT, handleGeneralChange);
    window.addEventListener("storage", handleGeneralChange);
    if (document.fonts?.ready) {
      document.fonts.ready.then(applyScale).catch(() => undefined);
    }

    return () => {
      setScalingState(true);
      window.removeEventListener("resize", applyScale);
      window.removeEventListener("app:layout-change", applyScale);
      window.removeEventListener(GENERAL_SETTINGS_EVENT, handleGeneralChange);
      window.removeEventListener("storage", handleGeneralChange);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, []);

  return null;
}
