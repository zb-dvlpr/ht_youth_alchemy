export type CurrencyMeta = {
  countryId: number;
  countryName?: string | null;
  currencyName: string;
  currencyRate: number;
};

export type DisplayCurrency = {
  key: string;
  currencyName: string;
  currencyRate: number;
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

export function parseCurrencyRate(value: unknown): number | null {
  return parsePositiveNumber(value);
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
    if (!countryId || !currencyName || !currencyRate) return [];
    return [
      {
        countryId,
        countryName: normalizeCurrencyName(country.CountryName),
        currencyName,
        currencyRate,
      },
    ];
  });
}

export function buildDisplayCurrencyOptions(
  currencies: CurrencyMeta[]
): DisplayCurrency[] {
  const byKey = new Map<string, DisplayCurrency>();
  byKey.set(SEK_DISPLAY_CURRENCY.key, SEK_DISPLAY_CURRENCY);
  currencies.forEach((currency) => {
    const key = buildCurrencyKey(currency.currencyName, currency.currencyRate);
    if (byKey.has(key)) return;
    byKey.set(key, {
      key,
      currencyName: currency.currencyName,
      currencyRate: currency.currencyRate,
    });
  });
  return Array.from(byKey.values()).sort(
    (left, right) =>
      left.currencyName.localeCompare(right.currencyName, undefined, {
        sensitivity: "base",
      }) || left.currencyRate - right.currencyRate
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
