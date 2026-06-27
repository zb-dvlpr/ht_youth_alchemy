"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "../page.module.css";
import { Messages } from "@/lib/i18n";
import { fetchChppJson } from "@/lib/chpp/client";
import { formatDateTime } from "@/lib/datetime";
import { formatSekCurrency } from "@/lib/currency";
import { hattrickPlayerUrl, hattrickTeamUrl } from "@/lib/hattrick/urls";
import { SPECIALTY_EMOJI } from "@/lib/specialty";
import {
  buildTransferMarketScopeKey,
  addTransferMarketPastSearch,
  getTransferMarketProfile,
  readTransferMarketPastSearches,
  readTransferMarketProfiles,
  saveTransferMarketProfile,
  type TransferMarketPastSearchEntry,
  type TransferMarketSearchProfile,
  type TransferMarketStoredCriteria,
} from "@/lib/transferMarketStorage";
import {
  TRANSFER_MARKET_OPEN_PAST_SEARCHES_EVENT,
  TRANSFER_MARKET_OPEN_PROFILES_EVENT,
} from "@/lib/transferMarket/events";
import { useDisplayCurrency } from "./DisplayCurrencyProvider";
import { useNotifications } from "./notifications/NotificationsProvider";
import { useChppPermissions } from "./ChppPermissionsProvider";
import { useSupporterStatus } from "./SupporterStatusProvider";
import Modal from "./Modal";
import Tooltip from "./Tooltip";
import {
  TransferSearchContent,
  TRANSFER_SEARCH_SKILLS,
  buildTransferSearchMinimumBidSek,
  buildTransferSearchParams,
  displayToSek,
  formatTransferSearchBidDraftDisplay,
  formatTransferSearchCurrencyLabel,
  formatTransferSearchPlayerName,
  normalizeTransferSearchFilters,
  normalizeTransferSearchResults,
  type TransferSearchBidDraft,
  type TransferSearchFilters,
  type TransferSearchHtmsPotentialFilter,
  type TransferSearchResolvedCountryMeta,
  type TransferSearchResult,
  type TransferSearchResultsViewMode,
  type TransferSearchSkillFilter,
  type TransferSearchSortKey,
} from "./TransferSearchModal";

type SeniorTeamOption = {
  teamId: number;
  teamName: string;
  leagueId?: number | null;
  countryId?: number | null;
  isPrimaryClub?: boolean;
  teamGender: "male" | "female" | null;
};

type TransferMarketToolProps = {
  messages: Messages;
  initialSeniorTeams?: SeniorTeamOption[];
  initialSeniorTeamId?: number | null;
  managerScopeId?: string | null;
};

const emptyHtmsPotentialFilter: TransferSearchHtmsPotentialFilter = {
  min: "",
  max: "",
};

const createDefaultTransferSearchFilters = (): TransferSearchFilters =>
  normalizeTransferSearchFilters({
    skillFilters: Array.from({ length: 4 }, () => ({
      skillKey: null,
      min: 0,
      max: 0,
    })),
    specialty: null,
    nativeCountryId: null,
    ageMinYears: "17",
    ageMinDays: "0",
    ageMaxYears: "18",
    ageMaxDays: "111",
    tsiMin: "",
    tsiMax: "",
    priceMinDisplay: "",
    priceMaxDisplay: "",
  });

const formatCriteriaSummary = (
  criteria: TransferMarketStoredCriteria,
  messages: Messages
) => {
  const filters = criteria.filters;
  const parts = [
    `${messages.seniorTransferSearchAgeRangeLabel}: ${filters.ageMinYears}y ${filters.ageMinDays}d-${filters.ageMaxYears}y ${filters.ageMaxDays}d`,
  ];
  filters.skillFilters.forEach((filter) => {
    if (!filter.skillKey) return;
    const definition = TRANSFER_SEARCH_SKILLS.find(
      (entry) => entry.key === filter.skillKey
    );
    if (!definition) return;
    const label = String(messages[definition.labelKey as keyof Messages] ?? filter.skillKey);
    parts.push(`${label} ${filter.min}-${filter.max}`);
  });
  if (filters.specialty !== null) {
    parts.push(`${messages.specialtyLabel}: ${SPECIALTY_EMOJI[filters.specialty] ?? filters.specialty}`);
  }
  if (filters.nativeCountryId !== null) {
    parts.push(`${messages.transferSearchNativeCountryLabel}: ${filters.nativeCountryId}`);
  }
  if (filters.tsiMin || filters.tsiMax) {
    parts.push(`TSI ${filters.tsiMin || "0"}-${filters.tsiMax || "∞"}`);
  }
  if (filters.priceMinDisplay || filters.priceMaxDisplay) {
    parts.push(
      `${formatTransferSearchCurrencyLabel(
        messages.seniorTransferSearchPriceRangeLabel,
        criteria.displayCurrency
      )}: ${filters.priceMinDisplay || "0"}-${filters.priceMaxDisplay || "∞"}`
    );
  }
  if (criteria.htmsPotentialFilter.min || criteria.htmsPotentialFilter.max) {
    parts.push(
      `${messages.transferSearchHtmsPotentialRangeLabel}: ${
        criteria.htmsPotentialFilter.min || "0"
      }-${criteria.htmsPotentialFilter.max || "∞"}`
    );
  }
  return parts.join(" · ");
};

export default function TransferMarketTool({
  messages,
  initialSeniorTeams = [],
  initialSeniorTeamId = null,
  managerScopeId = null,
}: TransferMarketToolProps) {
  const { addNotification } = useNotifications();
  const { countryOptions, resolveForCountry } = useDisplayCurrency();
  const { isSupporter } = useSupporterStatus();
  const { loading: permissionsLoading, hasPermission } = useChppPermissions();
  const canPlaceBid = !permissionsLoading && hasPermission("place_bid");
  const canQuickBid = isSupporter && canPlaceBid;
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(() => {
    if (initialSeniorTeamId) return initialSeniorTeamId;
    return (
      initialSeniorTeams.find((team) => team.isPrimaryClub)?.teamId ??
      initialSeniorTeams[0]?.teamId ??
      null
    );
  });
  const selectedTeam = useMemo(
    () =>
      initialSeniorTeams.find((team) => team.teamId === selectedTeamId) ??
      initialSeniorTeams[0] ??
      null,
    [initialSeniorTeams, selectedTeamId]
  );
  const displayCurrency = resolveForCountry(selectedTeam?.countryId ?? null);
  const scopeKey = buildTransferMarketScopeKey({
    managerId: managerScopeId,
    teamId: selectedTeam?.teamId ?? selectedTeamId,
  });
  const [filters, setFilters] = useState(createDefaultTransferSearchFilters);
  const [htmsPotentialFilter, setHtmsPotentialFilter] = useState(
    emptyHtmsPotentialFilter
  );
  const [results, setResults] = useState<TransferSearchResult[]>([]);
  const [itemCount, setItemCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exactEmpty, setExactEmpty] = useState(false);
  const [sortKey, setSortKey] = useState<TransferSearchSortKey>("default");
  const [resultsViewMode, setResultsViewMode] =
    useState<TransferSearchResultsViewMode>("cards");
  const [pastOpen, setPastOpen] = useState(false);
  const [profilesOpen, setProfilesOpen] = useState(false);
  const [pastSearches, setPastSearches] = useState<TransferMarketPastSearchEntry[]>([]);
  const [profiles, setProfiles] = useState<TransferMarketSearchProfile[]>([]);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [overwriteName, setOverwriteName] = useState<string | null>(null);
  const [pendingProfileCriteria, setPendingProfileCriteria] =
    useState<TransferSearchFilters | null>(null);
  const [bidDrafts, setBidDrafts] = useState<Record<number, TransferSearchBidDraft>>({});
  const [quickBidPendingPlayerId, setQuickBidPendingPlayerId] = useState<number | null>(null);
  const requestIdRef = useRef(0);

  const readPast = useCallback(async () => {
    try {
      setPastSearches(await readTransferMarketPastSearches(scopeKey));
    } catch {
      addNotification(messages.transferMarketStorageError);
    }
  }, [addNotification, messages.transferMarketStorageError, scopeKey]);

  const readProfiles = useCallback(async () => {
    try {
      setProfiles(await readTransferMarketProfiles(scopeKey));
    } catch {
      addNotification(messages.transferMarketStorageError);
    }
  }, [addNotification, messages.transferMarketStorageError, scopeKey]);

  useEffect(() => {
    const openPast = () => {
      setPastOpen(true);
      void readPast();
    };
    const openProfiles = () => {
      setProfilesOpen(true);
      void readProfiles();
    };
    window.addEventListener(TRANSFER_MARKET_OPEN_PAST_SEARCHES_EVENT, openPast);
    window.addEventListener(TRANSFER_MARKET_OPEN_PROFILES_EVENT, openProfiles);
    return () => {
      window.removeEventListener(TRANSFER_MARKET_OPEN_PAST_SEARCHES_EVENT, openPast);
      window.removeEventListener(TRANSFER_MARKET_OPEN_PROFILES_EVENT, openProfiles);
    };
  }, [readPast, readProfiles]);

  const updateSkillFilter = useCallback(
    (index: number, patch: Partial<TransferSearchSkillFilter>) => {
      setFilters((prev) => {
        const skillFilters = [...prev.skillFilters];
        while (skillFilters.length <= index) {
          skillFilters.push({ skillKey: null, min: 0, max: 0 });
        }
        skillFilters[index] = { ...skillFilters[index], ...patch };
        return normalizeTransferSearchFilters({ ...prev, skillFilters });
      });
    },
    []
  );

  const updateFilterField = useCallback(
    <K extends Exclude<keyof TransferSearchFilters, "skillFilters">>(
      key: K,
      value: TransferSearchFilters[K]
    ) => setFilters((prev) => ({ ...prev, [key]: value })),
    []
  );

  const runSearch = useCallback(
    async (committedFilters: TransferSearchFilters) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      const normalized = normalizeTransferSearchFilters(committedFilters);
      setFilters(normalized);
      setLoading(true);
      setError(null);
      setExactEmpty(false);
      setResults([]);
      setItemCount(null);
      try {
        const params = buildTransferSearchParams(normalized, displayCurrency);
        const { response, payload } = await fetchChppJson<{
          data?: {
            HattrickData?: {
              TransferSearch?: {
                ItemCount?: unknown;
                TransferResults?: { TransferResult?: unknown };
              };
            };
          };
          error?: string;
          details?: string;
        }>(`/api/chpp/transfersearch?${params.toString()}`, {
          cache: "no-store",
        });
        if (!response.ok || payload?.error) {
          throw new Error(payload?.details ?? payload?.error ?? "Failed to search transfers");
        }
        if (requestIdRef.current !== requestId) return;
        const transferSearch = payload?.data?.HattrickData?.TransferSearch;
        const nextResults = normalizeTransferSearchResults(
          transferSearch?.TransferResults?.TransferResult
        );
        setResults(nextResults);
        setItemCount(nextResults.length);
        setExactEmpty(nextResults.length === 0);
        setBidDrafts(() => {
          const next: Record<number, TransferSearchBidDraft> = {};
          nextResults.forEach((result) => {
            next[result.playerId] = {
              bidDisplay: formatTransferSearchBidDraftDisplay(
                buildTransferSearchMinimumBidSek(result),
                displayCurrency
              ),
              maxBidDisplay: "",
            };
          });
          return next;
        });
        try {
          await addTransferMarketPastSearch({
            scopeKey,
            filters: normalized,
            htmsPotentialFilter,
            displayCurrency,
          });
        } catch {
          addNotification(messages.transferMarketStorageError);
        }
      } catch (searchError) {
        if (requestIdRef.current !== requestId) return;
        setError(searchError instanceof Error ? searchError.message : String(searchError));
      } finally {
        if (requestIdRef.current === requestId) setLoading(false);
      }
    },
    [
      addNotification,
      displayCurrency,
      htmsPotentialFilter,
      messages.transferMarketStorageError,
      scopeKey,
    ]
  );

  const loadCriteria = (criteria: TransferMarketStoredCriteria) => {
    setFilters(normalizeTransferSearchFilters(criteria.filters));
    setHtmsPotentialFilter(criteria.htmsPotentialFilter);
    setResults([]);
    setItemCount(null);
    setError(null);
    setExactEmpty(false);
    setPastOpen(false);
    setProfilesOpen(false);
    addNotification(messages.transferMarketCriteriaLoaded);
  };

  const openSaveProfile = (committedFilters: TransferSearchFilters) => {
    setPendingProfileCriteria(committedFilters);
    setProfileName("");
    setProfileError(null);
    setOverwriteName(null);
    setSaveModalOpen(true);
  };

  const closeSaveProfileModal = () => {
    setSaveModalOpen(false);
    setProfileName("");
    setProfileError(null);
    setOverwriteName(null);
    setPendingProfileCriteria(null);
  };

  const saveProfile = async (overwrite = false) => {
    const trimmed = profileName.trim();
    if (!trimmed) {
      setProfileError(messages.transferMarketProfileNameRequired);
      return;
    }
    if (!pendingProfileCriteria) return;
    try {
      const existing = await getTransferMarketProfile(scopeKey, trimmed);
      if (existing && !overwrite) {
        setOverwriteName(trimmed);
        return;
      }
      await saveTransferMarketProfile({
        scopeKey,
        name: trimmed,
        filters: normalizeTransferSearchFilters(pendingProfileCriteria),
        htmsPotentialFilter,
        displayCurrency,
      });
      closeSaveProfileModal();
      addNotification(
        existing
          ? messages.transferMarketProfileOverwritten
          : messages.transferMarketProfileSaved
      );
    } catch {
      setProfileError(messages.transferMarketStorageError);
    }
  };

  const submitQuickBid = async (result: TransferSearchResult) => {
    if (!selectedTeam?.teamId || !canPlaceBid) return;
    const amountSek = displayToSek(
      bidDrafts[result.playerId]?.bidDisplay ?? "",
      displayCurrency
    );
    if (!amountSek) return;
    setQuickBidPendingPlayerId(result.playerId);
    try {
      const { response, payload } = await fetchChppJson<{ error?: string; details?: string }>(
        "/api/chpp/playerdetails",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            playerId: result.playerId,
            teamId: selectedTeam.teamId,
            bidAmount: amountSek,
          }),
        }
      );
      if (!response.ok || payload?.error) {
        throw new Error(payload?.details ?? payload?.error ?? "Failed to place bid");
      }
      addNotification(messages.seniorTransferSearchBidPlaced);
    } catch (bidError) {
      addNotification(bidError instanceof Error ? bidError.message : String(bidError));
    } finally {
      setQuickBidPendingPlayerId(null);
    }
  };

  const resultCountLabel =
    itemCount === null
      ? null
      : messages.seniorTransferSearchResultsCount.replace(
          "{{count}}",
          String(results.length)
        );

  const renderResultCard = (
    result: TransferSearchResult,
    countryMeta: TransferSearchResolvedCountryMeta | null
  ) => {
    const priceSek =
      typeof result.highestBidSek === "number" && result.highestBidSek > 0
        ? result.highestBidSek
        : result.askingPriceSek;
    return (
      <article key={result.playerId} className={styles.transferSearchResultCard}>
        <div className={styles.transferSearchResultHeader}>
          <div>
            <h4 className={styles.profileName}>
              <a
                className={styles.profileNameLink}
                href={hattrickPlayerUrl(result.playerId)}
                target="_blank"
                rel="noreferrer"
              >
                {formatTransferSearchPlayerName(result)}
              </a>
            </h4>
            <p className={styles.profileMeta}>
              {countryMeta ? <span>{countryMeta.name}</span> : null}
              {result.age !== null ? (
                <span>
                  {result.age} {messages.yearsLabel} {result.ageDays ?? 0} {messages.daysLabel}
                </span>
              ) : null}
              {result.tsi !== null ? <span>TSI: {result.tsi}</span> : null}
            </p>
          </div>
          <div className={styles.transferSearchPriceBlock}>
            <div className={styles.infoLabel}>
              {formatTransferSearchCurrencyLabel(
                messages.clubChronicleTransferListedAskingPriceColumn,
                displayCurrency
              )}
            </div>
            <div className={`${styles.infoValue} ${styles.transferSearchPriceValue}`}>
              {typeof priceSek === "number"
                ? formatSekCurrency(priceSek, displayCurrency)
                : messages.unknownShort}
            </div>
          </div>
        </div>
        <div className={styles.profileInfoRow}>
          <div>
            <div className={styles.infoLabel}>{messages.playerIdLabel}</div>
            <div className={styles.infoValue}>{result.playerId}</div>
          </div>
          {result.specialty !== null ? (
            <div>
              <div className={styles.infoLabel}>{messages.specialtyLabel}</div>
              <div className={styles.infoValue}>
                {SPECIALTY_EMOJI[result.specialty] ?? result.specialty}
              </div>
            </div>
          ) : null}
          {result.sellerTeamName ? (
            <div>
              <div className={styles.infoLabel}>{messages.seniorTransferSearchSellerLabel}</div>
              <div className={styles.infoValue}>
                {result.sellerTeamId ? (
                  <a
                    className={styles.chroniclePressLink}
                    href={hattrickTeamUrl(result.sellerTeamId)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {result.sellerTeamName}
                  </a>
                ) : (
                  result.sellerTeamName
                )}
              </div>
            </div>
          ) : null}
        </div>
        <div className={styles.transferSearchBidGrid}>
          <input
            className={styles.transferSearchInput}
            type="number"
            min="0"
            value={bidDrafts[result.playerId]?.bidDisplay ?? ""}
            onChange={(event) =>
              setBidDrafts((prev) => ({
                ...prev,
                [result.playerId]: {
                  bidDisplay: event.target.value,
                  maxBidDisplay: prev[result.playerId]?.maxBidDisplay ?? "",
                },
              }))
            }
            disabled={!canQuickBid || quickBidPendingPlayerId === result.playerId}
            aria-label={messages.seniorTransferSearchBidAmountLabel}
          />
          <Tooltip
            content={
              !canPlaceBid
                ? messages.chppMissingPlaceBidTooltip
                : messages.seniorTransferSearchSupporterOnlyTooltip
            }
            disabled={canQuickBid}
          >
            <button
              type="button"
              className={`${styles.confirmSubmit} ${styles.transferSearchBidAction}`}
              disabled={!canQuickBid || quickBidPendingPlayerId === result.playerId}
              onClick={() => void submitQuickBid(result)}
            >
              {messages.seniorTransferSearchPlaceBidButton}
            </button>
          </Tooltip>
        </div>
      </article>
    );
  };

  const renderCriteriaRows = (
    entries: Array<TransferMarketPastSearchEntry | TransferMarketSearchProfile>
  ) =>
    entries.map((entry) => (
      <div key={entry.id} className={styles.transferMarketListRow}>
        <div>
          {"name" in entry ? (
            <strong>{entry.name}</strong>
          ) : (
            <strong>{formatDateTime(entry.createdAt)}</strong>
          )}
          {"updatedAt" in entry ? (
            <div className={styles.profileUpdated}>{formatDateTime(entry.updatedAt)}</div>
          ) : null}
          <p className={styles.muted}>{formatCriteriaSummary(entry, messages)}</p>
        </div>
        <button
          type="button"
          className={styles.confirmSubmit}
          onClick={() => loadCriteria(entry)}
        >
          {messages.transferMarketLoadButton}
        </button>
      </div>
    ));

  return (
    <div className={styles.transferMarketTool}>
      <div className={styles.transferMarketHeader}>
        {initialSeniorTeams.length > 1 ? (
          <label className={styles.transferMarketTeamSelect}>
            <span className={styles.infoLabel}>{messages.transferMarketTeamLabel}</span>
            <select
              className={styles.transferSearchInput}
              value={selectedTeamId ?? ""}
              onChange={(event) => {
                const next = Number(event.target.value);
                setSelectedTeamId(Number.isFinite(next) ? next : null);
              }}
            >
              {initialSeniorTeams.map((team) => (
                <option key={team.teamId} value={team.teamId}>
                  {team.teamName}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className={styles.transferMarketMobileActionRow}>
          <button type="button" className={styles.secondaryButton} onClick={() => {
            setPastOpen(true);
            void readPast();
          }}>
            {messages.transferMarketPastSearchesButton}
          </button>
          <button type="button" className={styles.secondaryButton} onClick={() => {
            setProfilesOpen(true);
            void readProfiles();
          }}>
            {messages.transferMarketProfilesTooltip}
          </button>
        </div>
      </div>
      <TransferSearchContent
        open
        mode="workspace"
        messages={messages}
        selectedPlayerName={null}
        filters={filters}
        displayCurrency={displayCurrency}
        countryOptions={countryOptions}
        skillSlotCount={4}
        loading={loading}
        onUpdateSkillFilter={updateSkillFilter}
        onUpdateFilterField={updateFilterField}
        onSearch={(committedFilters) => void runSearch(committedFilters)}
        resultCountLabel={resultCountLabel}
        exactEmpty={exactEmpty}
        error={error}
        results={results}
        sortKey={sortKey}
        onSortKeyChange={setSortKey}
        resultsViewMode={resultsViewMode}
        onResultsViewModeChange={setResultsViewMode}
        canQuickBid={canQuickBid}
        quickBidUnavailableTooltip={
          !canPlaceBid
            ? messages.chppMissingPlaceBidTooltip
            : messages.seniorTransferSearchSupporterOnlyTooltip
        }
        quickBidPendingPlayerId={quickBidPendingPlayerId}
        onQuickBid={(result) => void submitQuickBid(result)}
        htmsPotentialFilter={htmsPotentialFilter}
        onHtmsPotentialFilterChange={setHtmsPotentialFilter}
        onSaveAsProfile={openSaveProfile}
        saveAsProfileLabel={messages.transferMarketSaveAsProfileButton}
        renderResultCard={renderResultCard}
        onClose={() => undefined}
      />
      <Modal
        open={pastOpen}
        title={messages.transferMarketPastSearchesTitle}
        className={styles.transferMarketListModal}
        body={
          <div className={styles.transferMarketListBody}>
            {pastSearches.length ? (
              renderCriteriaRows(pastSearches)
            ) : (
              <p className={styles.muted}>{messages.transferMarketPastSearchesEmpty}</p>
            )}
          </div>
        }
        actions={
          <button
            type="button"
            className={styles.confirmSubmit}
            onClick={() => setPastOpen(false)}
          >
            {messages.seniorTransferSearchCloseButton}
          </button>
        }
        closeOnBackdrop
        onClose={() => setPastOpen(false)}
      />
      <Modal
        open={profilesOpen}
        title={messages.transferMarketProfilesTitle}
        className={styles.transferMarketListModal}
        body={
          <div className={styles.transferMarketListBody}>
            {profiles.length ? (
              renderCriteriaRows(profiles)
            ) : (
              <p className={styles.muted}>{messages.transferMarketProfilesEmpty}</p>
            )}
          </div>
        }
        actions={
          <button
            type="button"
            className={styles.confirmSubmit}
            onClick={() => setProfilesOpen(false)}
          >
            {messages.seniorTransferSearchCloseButton}
          </button>
        }
        closeOnBackdrop
        onClose={() => setProfilesOpen(false)}
      />
      <Modal
        open={saveModalOpen}
        title={
          overwriteName
            ? messages.transferMarketOverwriteProfileTitle
            : messages.transferMarketSaveProfileTitle
        }
        body={
          <div className={styles.transferMarketSaveProfileBody}>
            {overwriteName ? (
              <p className={styles.muted}>
                {messages.transferMarketOverwriteProfileBody.replace(
                  "{{name}}",
                  overwriteName
                )}
              </p>
            ) : (
              <label className={styles.transferMarketProfileNameField}>
                <span className={styles.infoLabel}>
                  {messages.transferMarketProfileNameLabel}
                </span>
                <input
                  className={styles.transferSearchInput}
                  value={profileName}
                  placeholder={messages.transferMarketProfileNamePlaceholder}
                  onChange={(event) => {
                    setProfileName(event.target.value);
                    setProfileError(null);
                  }}
                />
              </label>
            )}
            {profileError ? <p className={styles.errorText}>{profileError}</p> : null}
          </div>
        }
        actions={
          overwriteName ? (
            <>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={closeSaveProfileModal}
              >
                {messages.transferMarketOverwriteProfileCancel}
              </button>
              <button
                type="button"
                className={styles.confirmSubmit}
                onClick={() => void saveProfile(true)}
              >
                {messages.transferMarketOverwriteProfileConfirm}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={closeSaveProfileModal}
              >
                {messages.transferMarketOverwriteProfileCancel}
              </button>
              <button
                type="button"
                className={styles.confirmSubmit}
                onClick={() => void saveProfile(false)}
              >
                {messages.transferMarketSaveProfileConfirm}
              </button>
            </>
          )
        }
        closeOnBackdrop
        onClose={closeSaveProfileModal}
      />
    </div>
  );
}
