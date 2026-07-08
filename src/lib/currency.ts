export type CurrencyMeta = {
  countryId: number;
  countryName: string;
  currencyName: string;
  currencyRate: number;
};

export type DisplayCurrency = {
  key: string;
  currencyName: string;
  currencyRate: number;
};

export type DisplayCurrencyOption = DisplayCurrency & {
  countryId: number;
  countryName: string;
  label: string;
};

export type WorldDetailsCountryOption = {
  id: number;
  name: string;
};

export const SEK_DISPLAY_CURRENCY: DisplayCurrency = {
  key: "SEK:1",
  currencyName: "SEK",
  currencyRate: 1,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toArray = <T>(value: T | T[] | null | undefined): T[] => {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
};

const unwrapNodeValue = (value: unknown): unknown => {
  if (isRecord(value) && "#text" in value) return value["#text"];
  return value;
};

const parsePositiveNumber = (value: unknown): number | null => {
  const unwrapped = unwrapNodeValue(value);
  const parsed =
    typeof unwrapped === "number"
      ? unwrapped
      : typeof unwrapped === "string"
        ? Number(unwrapped.trim())
        : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export function buildCurrencyKey(currencyName: string, currencyRate: number): string {
  return `${currencyName.trim().toUpperCase()}:${currencyRate}`;
}

export function buildCurrencyOptionKey(
  countryId: number,
  currencyName: string,
  currencyRate: number
): string {
  return `${countryId}:${currencyName.trim().toUpperCase()}:${currencyRate}`;
}

export function getDisplayCurrencyLabel(currency: DisplayCurrency): string {
  return currency.currencyName;
}

export function getDisplayCurrencyRateLabel(currency: DisplayCurrency): string {
  return `${currency.currencyName}, 1 = ${currency.currencyRate} SEK`;
}

export function buildDisplayCurrencyOptionLabel(
  currencyName: string,
  countryName: string,
  currencyRate: number
): string {
  return `${currencyName} - ${countryName} (1 = ${currencyRate} SEK)`;
}

export function parseCurrencyRate(value: unknown): number | null {
  const unwrapped = unwrapNodeValue(value);
  if (typeof unwrapped === "number") {
    return Number.isFinite(unwrapped) && unwrapped > 0 ? unwrapped : null;
  }
  if (typeof unwrapped !== "string") return null;
  const trimmed = unwrapped.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(",", ".");
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function normalizeCurrencyName(value: unknown): string | null {
  const unwrapped = unwrapNodeValue(value);
  if (typeof unwrapped !== "string") return null;
  const trimmed = unwrapped.trim();
  return trimmed ? trimmed : null;
}

export function parseWorldDetailsCurrencies(payload: unknown): CurrencyMeta[] {
  const root = isRecord(payload) && isRecord(payload.data) ? payload.data : payload;
  const hattrickData =
    isRecord(root) && isRecord(root.HattrickData) ? root.HattrickData : root;
  const leagueList =
    isRecord(hattrickData) && isRecord(hattrickData.LeagueList)
      ? hattrickData.LeagueList
      : null;
  const leagues = toArray(
    leagueList && "League" in leagueList ? leagueList.League : undefined
  );

  return leagues.flatMap((league) => {
    if (!isRecord(league) || !isRecord(league.Country)) return [];
    const country = league.Country;
    const countryId = parsePositiveNumber(country.CountryID ?? country.CountryId);
    const currencyName = normalizeCurrencyName(country.CurrencyName);
    const currencyRate = parseCurrencyRate(country.CurrencyRate);
    const countryName = normalizeCurrencyName(country.CountryName);
    if (!countryId || !countryName || !currencyName || !currencyRate) return [];
    return [
      {
        countryId,
        countryName,
        currencyName,
        currencyRate,
      },
    ];
  });
}

export function buildDisplayCurrencyOptions(
  currencies: CurrencyMeta[]
): DisplayCurrencyOption[] {
  const byKey = new Map<string, DisplayCurrencyOption>();
  currencies.forEach((currency) => {
    const key = buildCurrencyOptionKey(
      currency.countryId,
      currency.currencyName,
      currency.currencyRate
    );
    if (byKey.has(key)) return;
    byKey.set(key, {
      key,
      countryId: currency.countryId,
      countryName: currency.countryName,
      currencyName: currency.currencyName,
      currencyRate: currency.currencyRate,
      label: buildDisplayCurrencyOptionLabel(
        currency.currencyName,
        currency.countryName,
        currency.currencyRate
      ),
    });
  });
  if (
    !Array.from(byKey.values()).some(
      (currency) =>
        buildCurrencyKey(currency.currencyName, currency.currencyRate) ===
        SEK_DISPLAY_CURRENCY.key
    )
  ) {
    byKey.set(buildCurrencyOptionKey(0, "SEK", 1), {
      ...SEK_DISPLAY_CURRENCY,
      key: buildCurrencyOptionKey(0, "SEK", 1),
      countryId: 0,
      countryName: "Sweden",
      label: buildDisplayCurrencyOptionLabel("SEK", "Sweden", 1),
    });
  }
  return Array.from(byKey.values()).sort(
    (left, right) =>
      left.currencyName.localeCompare(right.currencyName, undefined, {
        sensitivity: "base",
      }) ||
      left.countryName.localeCompare(right.countryName, undefined, {
        sensitivity: "base",
      }) ||
      left.currencyRate - right.currencyRate
  );
}

export function buildWorldDetailsCountryOptions(
  currencies: CurrencyMeta[]
): WorldDetailsCountryOption[] {
  const byId = new Map<number, WorldDetailsCountryOption>();
  currencies.forEach((currency) => {
    if (
      !Number.isFinite(currency.countryId) ||
      currency.countryId <= 0 ||
      !currency.countryName.trim()
    ) {
      return;
    }
    if (byId.has(currency.countryId)) return;
    byId.set(currency.countryId, {
      id: currency.countryId,
      name: currency.countryName.trim(),
    });
  });
  return Array.from(byId.values()).sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: "base" })
  );
}

export function resolveCurrencyForCountry(
  currencies: CurrencyMeta[],
  countryId: number | null | undefined
): DisplayCurrency | null {
  if (!countryId || !Number.isFinite(countryId) || countryId <= 0) return null;
  const match = currencies.find((currency) => currency.countryId === countryId);
  if (!match) return null;
  return {
    key: buildCurrencyKey(match.currencyName, match.currencyRate),
    currencyName: match.currencyName,
    currencyRate: match.currencyRate,
  };
}

const canUseIntlCurrency = (currencyName: string) => {
  if (!/^[A-Za-z]{3}$/.test(currencyName)) return false;
  try {
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currencyName.toUpperCase(),
    }).format(1);
    return true;
  } catch {
    return false;
  }
};

export function sekToDisplayAmount(
  valueSek: number | null | undefined,
  currency: DisplayCurrency | null | undefined
): number | null {
  if (typeof valueSek !== "number" || !Number.isFinite(valueSek)) return null;
  const rate =
    currency?.currencyRate && Number.isFinite(currency.currencyRate)
      ? currency.currencyRate
      : SEK_DISPLAY_CURRENCY.currencyRate;
  return valueSek / rate;
}

export function displayAmountToSek(
  displayAmount: number | string | null | undefined,
  currency: DisplayCurrency | null | undefined
): number | null {
  if (displayAmount === null || displayAmount === undefined || displayAmount === "") {
    return null;
  }
  const parsed =
    typeof displayAmount === "number" ? displayAmount : Number(displayAmount);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  const rate =
    currency?.currencyRate && Number.isFinite(currency.currencyRate)
      ? currency.currencyRate
      : SEK_DISPLAY_CURRENCY.currencyRate;
  return Math.round(parsed * rate);
}

export function formatSekCurrency(
  valueSek: number | null | undefined,
  currency: DisplayCurrency | null | undefined,
  options?: {
    compact?: boolean;
    fallback?: string;
    maximumFractionDigits?: number;
  }
): string {
  const fallback = options?.fallback ?? "-";
  const displayAmount = sekToDisplayAmount(valueSek, currency);
  if (displayAmount === null) return fallback;

  const resolvedCurrency = currency ?? SEK_DISPLAY_CURRENCY;
  const maximumFractionDigits = options?.maximumFractionDigits ?? 0;
  const notation = options?.compact ? "compact" : "standard";
  const rounded = Math.round(displayAmount);
  const currencyName = resolvedCurrency.currencyName.trim();
  if (canUseIntlCurrency(currencyName)) {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currencyName.toUpperCase(),
      maximumFractionDigits,
      notation,
    }).format(rounded);
  }
  const formatted = new Intl.NumberFormat(undefined, {
    maximumFractionDigits,
    notation,
  }).format(rounded);
  return `${formatted} ${currencyName}`;
}
