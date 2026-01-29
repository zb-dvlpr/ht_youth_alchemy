"use client";

import { useState } from "react";
import styles from "../page.module.css";
import { Locale, SUPPORTED_LOCALES } from "@/lib/i18n";
import Tooltip from "./Tooltip";

type LanguageSwitcherProps = {
  locale: Locale;
  label: string;
  switchingLabel: string;
};

const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
  sv: "Svenska",
  it: "Italiano",
  pt: "Português",
};

export default function LanguageSwitcher({
  locale,
  label,
  switchingLabel,
}: LanguageSwitcherProps) {
  const [value, setValue] = useState<Locale>(locale);
  const [isChanging, setIsChanging] = useState(false);

  const handleChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    if (isChanging) return;
    const next = event.target.value as Locale;
    setValue(next);
    setIsChanging(true);
    await fetch("/api/lang", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: next }),
    });
    window.location.reload();
  };

  return (
    <label className={styles.langSwitcher}>
      <span className={styles.langLabel}>{label}</span>
      <select
        className={styles.langSelect}
        value={value}
        onChange={handleChange}
        disabled={isChanging}
      >
        {SUPPORTED_LOCALES.map((loc) => (
          <option key={loc} value={loc}>
            {LOCALE_LABELS[loc]}
          </option>
        ))}
      </select>
      {isChanging ? (
        <Tooltip content={switchingLabel}>
          <span className={styles.langSpinner} role="status" />
        </Tooltip>
      ) : null}
    </label>
  );
}
