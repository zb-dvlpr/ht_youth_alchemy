"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  buildCurrencyKey,
  buildDisplayCurrencyOptions,
  buildWorldDetailsCountryOptions,
  buildCurrencyOptionKey,
  buildDisplayCurrencyOptionLabel,
  formatSekCurrency,
  parseWorldDetailsCurrencies,
  SEK_DISPLAY_CURRENCY,
  type CurrencyMeta,
  type DisplayCurrency,
  type DisplayCurrencyOption,
  type WorldDetailsCountryOption,
} from "@/lib/currency";
import {
  DISPLAY_CURRENCY_SETTINGS_EVENT,
  readDisplayCurrencySetting,
  writeDisplayCurrencySetting,
  type StoredDisplayCurrencySetting,
} from "@/lib/settings";
import { fetchChppJson } from "@/lib/chpp/client";

const DISPLAY_CURRENCY_WORLDDETAILS_STORAGE_KEY =
  "ya_worlddetails_currencies_v1";
const DISPLAY_CURRENCY_WORLDDETAILS_SCHEMA_VERSION = 3;
const DISPLAY_CURRENCY_WORLDDETAILS_TTL_MS = 16 * 7 * 24 * 60 * 60 * 1000;

type StoredCurrenciesCache = {
  schemaVersion: number;
  fetchedAt: number;
  currencies: CurrencyMeta[];
};

type DisplayCurrencyContextValue = {
  currencyOptions: DisplayCurrencyOption[];
  countryOptions: WorldDetailsCountryOption[];
  setting: StoredDisplayCurrencySetting;
  selectedOverride: DisplayCurrency | null;
  setOverride: (currency: DisplayCurrencyOption) => void;
  clearOverride: () => void;
  resolveForCountry: (countryId: number | null | undefined) => DisplayCurrency;
  formatSek: (
    valueSek: number | null | undefined,
    options?: { compact?: boolean; fallback?: string; maximumFractionDigits?: number }
  ) => string;
};

const DisplayCurrencyContext = createContext<DisplayCurrencyContextValue | null>(
  null
);

const isValidCurrencyMeta = (value: unknown): value is CurrencyMeta => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as CurrencyMeta;
  return (
    typeof candidate.countryId === "number" &&
    Number.isFinite(candidate.countryId) &&
    candidate.countryId > 0 &&
    typeof candidate.countryName === "string" &&
    candidate.countryName.trim().length > 0 &&
    typeof candidate.currencyName === "string" &&
    candidate.currencyName.trim().length > 0 &&
    typeof candidate.currencyRate === "number" &&
    Number.isFinite(candidate.currencyRate) &&
    candidate.currencyRate > 0
  );
};

const readCachedCurrencies = (): CurrencyMeta[] | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(
      DISPLAY_CURRENCY_WORLDDETAILS_STORAGE_KEY
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredCurrenciesCache>;
    if (
      parsed.schemaVersion !== DISPLAY_CURRENCY_WORLDDETAILS_SCHEMA_VERSION ||
      typeof parsed.fetchedAt !== "number" ||
      Date.now() - parsed.fetchedAt > DISPLAY_CURRENCY_WORLDDETAILS_TTL_MS ||
      !Array.isArray(parsed.currencies)
    ) {
      return null;
    }
    const currencies = parsed.currencies.filter(isValidCurrencyMeta);
    return currencies.length ? currencies : null;
  } catch {
    return null;
  }
};

const writeCachedCurrencies = (currencies: CurrencyMeta[]) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      DISPLAY_CURRENCY_WORLDDETAILS_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: DISPLAY_CURRENCY_WORLDDETAILS_SCHEMA_VERSION,
        fetchedAt: Date.now(),
        currencies,
      } satisfies StoredCurrenciesCache)
    );
  } catch {
    // ignore storage errors
  }
};

export function DisplayCurrencyProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [currencies, setCurrencies] = useState<CurrencyMeta[]>(
    () => readCachedCurrencies() ?? []
  );
  const [setting, setSetting] = useState<StoredDisplayCurrencySetting>(() =>
    readDisplayCurrencySetting()
  );

  useEffect(() => {
    if (currencies.length > 0) return;

    let cancelled = false;
    void (async () => {
      try {
        const { response, payload } = await fetchChppJson("/api/chpp/worlddetails", {
          cache: "no-store",
        });
        if (!response.ok) return;
        const parsed = parseWorldDetailsCurrencies(payload);
        if (!parsed.length || cancelled) return;
        writeCachedCurrencies(parsed);
        setCurrencies(parsed);
      } catch {
        // SEK fallback remains active.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currencies.length]);

  useEffect(() => {
    const handleSettingsChange = () => {
      setSetting(readDisplayCurrencySetting());
    };
    window.addEventListener(DISPLAY_CURRENCY_SETTINGS_EVENT, handleSettingsChange);
    return () => {
      window.removeEventListener(
        DISPLAY_CURRENCY_SETTINGS_EVENT,
        handleSettingsChange
      );
    };
  }, []);

  const currencyOptions = useMemo(
    () => buildDisplayCurrencyOptions(currencies),
    [currencies]
  );
  const countryOptions = useMemo(
    () => buildWorldDetailsCountryOptions(currencies),
    [currencies]
  );

  const selectedOverride = useMemo(() => {
    if (setting.mode !== "override") return null;
    const key =
      typeof setting.countryId === "number" && setting.countryId >= 0
        ? buildCurrencyOptionKey(
            setting.countryId,
            setting.currencyName,
            setting.currencyRate
          )
        : buildCurrencyKey(setting.currencyName, setting.currencyRate);
    return (
      currencyOptions.find((currency) => currency.key === key) ??
      currencyOptions.find(
        (currency) =>
          currency.currencyName === setting.currencyName &&
          currency.currencyRate === setting.currencyRate
      ) ?? {
        key,
        currencyName: setting.currencyName,
        currencyRate: setting.currencyRate,
      }
    );
  }, [currencyOptions, setting]);

  const resolveForCountry = useCallback(
    (countryId: number | null | undefined) => {
      if (selectedOverride) return selectedOverride;
      if (!countryId || !Number.isFinite(countryId) || countryId <= 0) {
        return SEK_DISPLAY_CURRENCY;
      }
      const countryCurrency = currencies.find(
        (currency) => currency.countryId === countryId
      );
      if (!countryCurrency) return SEK_DISPLAY_CURRENCY;
      const optionKey = buildCurrencyOptionKey(
        countryCurrency.countryId,
        countryCurrency.currencyName,
        countryCurrency.currencyRate
      );
      return (
        currencyOptions.find((currency) => currency.key === optionKey) ?? {
          key: buildCurrencyKey(
            countryCurrency.currencyName,
            countryCurrency.currencyRate
          ),
          currencyName: countryCurrency.currencyName,
          currencyRate: countryCurrency.currencyRate,
        }
      );
    },
    [currencies, currencyOptions, selectedOverride]
  );

  const setOverride = useCallback((currency: DisplayCurrencyOption) => {
    writeDisplayCurrencySetting({
      mode: "override",
      countryId: "countryId" in currency ? currency.countryId : undefined,
      countryName: "countryName" in currency ? currency.countryName : undefined,
      currencyName: currency.currencyName,
      currencyRate: currency.currencyRate,
    });
  }, []);

  const clearOverride = useCallback(() => {
    writeDisplayCurrencySetting({ mode: "default" });
  }, []);

  const formatSek = useCallback<
    DisplayCurrencyContextValue["formatSek"]
  >(
    (valueSek, options) =>
      formatSekCurrency(valueSek, selectedOverride ?? SEK_DISPLAY_CURRENCY, options),
    [selectedOverride]
  );

  const value = useMemo<DisplayCurrencyContextValue>(
    () => ({
      currencyOptions,
      countryOptions,
      setting,
      selectedOverride,
      setOverride,
      clearOverride,
      resolveForCountry,
      formatSek,
    }),
    [
      clearOverride,
      currencyOptions,
      countryOptions,
      formatSek,
      resolveForCountry,
      selectedOverride,
      setOverride,
      setting,
    ]
  );

  return (
    <DisplayCurrencyContext.Provider value={value}>
      {children}
    </DisplayCurrencyContext.Provider>
  );
}

export function useDisplayCurrency() {
  const context = useContext(DisplayCurrencyContext);
  if (!context) {
    const fallbackOption = {
      ...SEK_DISPLAY_CURRENCY,
      key: buildCurrencyOptionKey(0, "SEK", 1),
      countryId: 0,
      countryName: "Sweden",
      label: buildDisplayCurrencyOptionLabel("SEK", "Sweden", 1),
    };
    return {
      currencyOptions: [fallbackOption],
      countryOptions: [{ id: fallbackOption.countryId, name: fallbackOption.countryName }],
      setting: { mode: "default" as const },
      selectedOverride: null,
      setOverride: () => undefined,
      clearOverride: () => undefined,
      resolveForCountry: () => SEK_DISPLAY_CURRENCY,
      formatSek: (
        valueSek: number | null | undefined,
        options?: {
          compact?: boolean;
          fallback?: string;
          maximumFractionDigits?: number;
        }
      ) => formatSekCurrency(valueSek, SEK_DISPLAY_CURRENCY, options),
    } satisfies DisplayCurrencyContextValue;
  }
  return context;
}
