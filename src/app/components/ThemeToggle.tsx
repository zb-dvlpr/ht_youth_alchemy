"use client";

import { useEffect, useState } from "react";
import Tooltip from "./Tooltip";
import styles from "../page.module.css";
import type { Messages } from "@/lib/i18n";

type ThemeToggleProps = {
  messages: Messages;
};

type ThemeMode = "light" | "dark";

const THEME_STORAGE_KEY = "ya_theme";

export default function ThemeToggle({ messages }: ThemeToggleProps) {
  const [mode, setMode] = useState<ThemeMode>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    const prefersDark =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    const nextMode: ThemeMode =
      stored === "dark" || stored === "light"
        ? (stored as ThemeMode)
        : prefersDark
        ? "dark"
        : "light";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMode(nextMode);
    document.documentElement.dataset.theme = nextMode;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.dataset.theme = mode;
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  }, [mode, mounted]);

  const toggle = () => {
    setMode((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const tooltip =
    mode === "dark" ? messages.themeSwitchLight : messages.themeSwitchDark;

  return (
    <Tooltip content={tooltip}>
      <button
        type="button"
        className={styles.themeToggle}
        onClick={toggle}
        aria-label={tooltip}
      >
        {mode === "dark" ? "☀️" : "🌙"}
      </button>
    </Tooltip>
  );
}
