"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "../page.module.css";
import { Messages } from "@/lib/i18n";
import { fetchChppJson } from "@/lib/chpp/client";
import { formatDateTime } from "@/lib/datetime";
import { SPECIALTY_EMOJI } from "@/lib/specialty";
import { mapWithConcurrency } from "@/lib/async";
import {
  buildTransferMarketScopeKey,
  addTransferMarketPastSearch,
  deleteTransferMarketProfile,
  readTransferMarketCurrentCriteria,
  readTransferMarketPastSearches,
  readTransferMarketProfiles,
  saveTransferMarketCurrentCriteria,
  type TransferMarketPastSearchEntry,
  type TransferMarketSearchProfile,
  type TransferMarketStoredCriteria,
} from "@/lib/transferMarketStorage";
import {
  TRANSFER_MARKET_OPEN_PAST_SEARCHES_EVENT,
  TRANSFER_MARKET_OPEN_PROFILES_EVENT,
} from "@/lib/transferMarket/events";
import {
  MANUAL_OPEN_EVENT,
  MOBILE_LAUNCHER_REQUEST_EVENT,
} from "@/lib/mobileShellEvents";
import { useDisplayCurrency } from "./DisplayCurrencyProvider";
import { useNotifications } from "./notifications/NotificationsProvider";
import { useChppPermissions } from "./ChppPermissionsProvider";
import { useSupporterStatus } from "./SupporterStatusProvider";
import Modal from "./Modal";
import MobileFloatingActionMenu from "./MobileFloatingActionMenu";
import {
  MobileMenuAction,
  MobileMenuDivider,
  MobileMenuTeamSwitcher,
} from "./MobileFloatingMenuSections";
import TransferSearchResultCard, {
  normalizeTransferSearchResultCardDetails,
  type TransferSearchResultCardDetails,
} from "./TransferSearchResultCard";
import { useTransferMarketProfileSave } from "./useTransferMarketProfileSave";
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
  const mobileTeamOptions = useMemo(
    () =>
      initialSeniorTeams.map((team) => ({
        id: team.teamId,
        label: team.teamName,
      })),
    [initialSeniorTeams]
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
  const [resultDetailsById, setResultDetailsById] = useState<
    Record<number, TransferSearchResultCardDetails>
  >({});
  const [itemCount, setItemCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exactEmpty, setExactEmpty] = useState(false);
  const [sortKey, setSortKey] = useState<TransferSearchSortKey>("default");
  const [resultsViewMode, setResultsViewMode] =
    useState<TransferSearchResultsViewMode>("cards");
  const [pastOpen, setPastOpen] = useState(false);
  const [profilesOpen, setProfilesOpen] = useState(false);
  const [mobileMenuPosition, setMobileMenuPosition] = useState({ x: 12, y: 120 });
  const [pastSearches, setPastSearches] = useState<TransferMarketPastSearchEntry[]>([]);
  const [profiles, setProfiles] = useState<TransferMarketSearchProfile[]>([]);
  const [currentCriteriaReady, setCurrentCriteriaReady] = useState(false);
  const [bidDrafts, setBidDrafts] = useState<Record<number, TransferSearchBidDraft>>({});
  const [quickBidPendingPlayerId, setQuickBidPendingPlayerId] = useState<number | null>(null);
  const requestIdRef = useRef(0);
  const storageWriteFailedRef = useRef(false);

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

  const { openSaveProfile, saveProfileModal } = useTransferMarketProfileSave({
    messages,
    scopeKey,
    displayCurrency,
    htmsPotentialFilter,
    onSaved: readProfiles,
  });

  const openPastSearches = useCallback(() => {
    setPastOpen(true);
    void readPast();
  }, [readPast]);

  const openSearchProfiles = useCallback(() => {
    setProfilesOpen(true);
    void readProfiles();
  }, [readProfiles]);

  useEffect(() => {
    const openPast = () => {
      openPastSearches();
    };
    const openProfilesHandler = () => {
      openSearchProfiles();
    };
    window.addEventListener(TRANSFER_MARKET_OPEN_PAST_SEARCHES_EVENT, openPast);
    window.addEventListener(TRANSFER_MARKET_OPEN_PROFILES_EVENT, openProfilesHandler);
    return () => {
      window.removeEventListener(TRANSFER_MARKET_OPEN_PAST_SEARCHES_EVENT, openPast);
      window.removeEventListener(TRANSFER_MARKET_OPEN_PROFILES_EVENT, openProfilesHandler);
    };
  }, [openPastSearches, openSearchProfiles]);

  useEffect(() => {
    let cancelled = false;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setCurrentCriteriaReady(false);
    setResults([]);
    setResultDetailsById({});
    setItemCount(null);
    setError(null);
    setExactEmpty(false);
    setBidDrafts({});
    void (async () => {
      try {
        const stored = await readTransferMarketCurrentCriteria(scopeKey);
        if (cancelled || requestIdRef.current !== requestId) return;
        if (stored) {
          setFilters(normalizeTransferSearchFilters(stored.filters));
          setHtmsPotentialFilter(stored.htmsPotentialFilter);
          setSortKey(stored.sortKey);
          setResultsViewMode(stored.resultsViewMode);
        } else {
          setFilters(createDefaultTransferSearchFilters());
          setHtmsPotentialFilter(emptyHtmsPotentialFilter);
          setSortKey("default");
          setResultsViewMode("cards");
        }
      } catch {
        if (!cancelled) {
          addNotification(messages.transferMarketStorageError);
          setFilters(createDefaultTransferSearchFilters());
          setHtmsPotentialFilter(emptyHtmsPotentialFilter);
          setSortKey("default");
          setResultsViewMode("cards");
        }
      } finally {
        if (!cancelled && requestIdRef.current === requestId) {
          setCurrentCriteriaReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [addNotification, messages.transferMarketStorageError, scopeKey]);

  useEffect(() => {
    if (!currentCriteriaReady) return;
    const timeoutId = window.setTimeout(() => {
      void saveTransferMarketCurrentCriteria({
        scopeKey,
        filters,
        htmsPotentialFilter,
        displayCurrency,
        sortKey,
        resultsViewMode,
      }).catch(() => {
        if (storageWriteFailedRef.current) return;
        storageWriteFailedRef.current = true;
        addNotification(messages.transferMarketStorageError);
      });
    }, 350);
    return () => window.clearTimeout(timeoutId);
  }, [
    addNotification,
    currentCriteriaReady,
    displayCurrency,
    filters,
    htmsPotentialFilter,
    messages.transferMarketStorageError,
    resultsViewMode,
    scopeKey,
    sortKey,
  ]);

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
      setResultDetailsById({});
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
        const detailEntries = await mapWithConcurrency(
          nextResults,
          4,
          async (result) => {
            try {
              const { response, payload } = await fetchChppJson<{
                data?: { HattrickData?: { Player?: unknown } };
                error?: string;
                details?: string;
              }>(
                `/api/chpp/playerdetails?playerId=${result.playerId}&includeMatchInfo=true`,
                { cache: "no-store" }
              );
              if (!response.ok || payload?.error) return null;
              const details = normalizeTransferSearchResultCardDetails(
                payload?.data?.HattrickData?.Player,
                result.playerId
              );
              return details ? ([result.playerId, details] as const) : null;
            } catch {
              return null;
            }
          }
        );
        if (requestIdRef.current !== requestId) return;
        setResultDetailsById(
          Object.fromEntries(
            detailEntries.filter(
              (
                entry
              ): entry is readonly [number, TransferSearchResultCardDetails] =>
                entry !== null
            )
          )
        );
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
    setResultDetailsById({});
    setItemCount(null);
    setError(null);
    setExactEmpty(false);
    setPastOpen(false);
    setProfilesOpen(false);
    addNotification(messages.transferMarketCriteriaLoaded);
  };

  const submitTransferBid = async (
    result: TransferSearchResult,
    bidKind: keyof TransferSearchBidDraft
  ) => {
    if (!selectedTeam?.teamId || !canPlaceBid) return;
    const draft = bidDrafts[result.playerId] ?? {
      bidDisplay: "",
      maxBidDisplay: "",
    };
    const amountSek = displayToSek(
      draft[bidKind],
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
          body: JSON.stringify(
            bidKind === "bidDisplay"
              ? {
                  playerId: result.playerId,
                  teamId: selectedTeam.teamId,
                  bidAmount: amountSek,
                }
              : {
                  playerId: result.playerId,
                  teamId: selectedTeam.teamId,
                  maxBidAmount: amountSek,
                }
          ),
        }
      );
      if (!response.ok || payload?.error) {
        throw new Error(payload?.details ?? payload?.error ?? "Failed to place bid");
      }
      addNotification(
        messages.seniorTransferSearchBidPlaced.replace(
          "{{player}}",
          formatTransferSearchPlayerName(result)
        )
      );
    } catch (bidError) {
      addNotification(bidError instanceof Error ? bidError.message : String(bidError));
    } finally {
      setQuickBidPendingPlayerId(null);
    }
  };

  const submitQuickBid = async (result: TransferSearchResult) => {
    if (!selectedTeam?.teamId || !canPlaceBid) return;
    const minimumBidSek = buildTransferSearchMinimumBidSek(result);
    if (typeof minimumBidSek !== "number") return;
    setBidDrafts((prev) => ({
      ...prev,
      [result.playerId]: {
        bidDisplay: formatTransferSearchBidDraftDisplay(
          minimumBidSek,
          displayCurrency
        ),
        maxBidDisplay: prev[result.playerId]?.maxBidDisplay ?? "",
      },
    }));
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
            bidAmount: minimumBidSek,
          }),
        }
      );
      if (!response.ok || payload?.error) {
        throw new Error(payload?.details ?? payload?.error ?? "Failed to place bid");
      }
      addNotification(
        messages.seniorTransferSearchBidPlaced.replace(
          "{{player}}",
          formatTransferSearchPlayerName(result)
        )
      );
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
  ) => (
    <TransferSearchResultCard
      result={result}
      countryMeta={countryMeta}
      resultDetails={resultDetailsById[result.playerId] ?? null}
      messages={messages}
      displayCurrency={displayCurrency}
      selectedSeniorLeagueId={selectedTeam?.leagueId ?? null}
      bidDraft={
        bidDrafts[result.playerId] ?? { bidDisplay: "", maxBidDisplay: "" }
      }
      pending={quickBidPendingPlayerId === result.playerId}
      canBid={canQuickBid}
      canPlaceBid={canPlaceBid}
      onBidDraftChange={(playerId, key, value) =>
        setBidDrafts((prev) => ({
          ...prev,
          [playerId]: {
            bidDisplay: prev[playerId]?.bidDisplay ?? "",
            maxBidDisplay: prev[playerId]?.maxBidDisplay ?? "",
            [key]: value,
          },
        }))
      }
      onSubmitBid={(nextResult, bidKind) => {
        void submitTransferBid(nextResult, bidKind);
      }}
    />
  );

  const renderCriteriaRows = (
    entries: TransferMarketPastSearchEntry[]
  ) =>
    entries.map((entry) => (
      <div key={entry.id} className={styles.transferMarketListRow}>
        <div>
          <strong>{formatDateTime(entry.createdAt)}</strong>
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

  const deleteProfile = async (profile: TransferMarketSearchProfile) => {
    try {
      await deleteTransferMarketProfile(scopeKey, profile.name);
      setProfiles(await readTransferMarketProfiles(scopeKey));
      addNotification(messages.transferMarketProfileDeleted);
    } catch {
      addNotification(messages.transferMarketStorageError);
    }
  };

  const renderProfileRows = (entries: TransferMarketSearchProfile[]) =>
    entries.map((entry) => (
      <div key={entry.id} className={styles.transferMarketListRow}>
        <div>
          <strong>{entry.name}</strong>
          <div className={styles.profileUpdated}>{formatDateTime(entry.updatedAt)}</div>
          <p className={styles.muted}>{formatCriteriaSummary(entry, messages)}</p>
        </div>
        <div className={styles.transferMarketListRowActions}>
          <button
            type="button"
            className={styles.confirmSubmit}
            onClick={() => loadCriteria(entry)}
          >
            {messages.transferMarketLoadButton}
          </button>
          <button
            type="button"
            className={styles.transferMarketModalSecondaryButton}
            onClick={() => void deleteProfile(entry)}
          >
            {messages.transferMarketDeleteProfileButton}
          </button>
        </div>
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
      </div>
      <div className={styles.transferMarketMobileMenu}>
        <MobileFloatingActionMenu
          toggleLabel={messages.mobileYouthMenuToggleLabel}
          position={mobileMenuPosition}
          onPositionChange={setMobileMenuPosition}
        >
          {({ closeMenu }) => (
            <>
              <MobileMenuAction
                onClick={() => {
                  closeMenu();
                  window.dispatchEvent(
                    new CustomEvent(MOBILE_LAUNCHER_REQUEST_EVENT)
                  );
                }}
              >
                {messages.mobileHomeLabel}
              </MobileMenuAction>
              <MobileMenuDivider />
              {mobileTeamOptions.length > 1 ? (
                <>
                  <MobileMenuTeamSwitcher
                    label={messages.transferMarketTeamLabel}
                    teamOptions={mobileTeamOptions}
                    selectedTeamId={selectedTeamId}
                    onTeamChange={setSelectedTeamId}
                  />
                  <MobileMenuDivider />
                </>
              ) : null}
              <MobileMenuAction
                onClick={() => {
                  closeMenu();
                  openPastSearches();
                }}
              >
                {messages.transferMarketPastSearchesButton}
              </MobileMenuAction>
              <MobileMenuAction
                onClick={() => {
                  closeMenu();
                  openSearchProfiles();
                }}
              >
                {messages.transferMarketProfilesTooltip}
              </MobileMenuAction>
              <MobileMenuDivider />
              <MobileMenuAction
                onClick={() => {
                  closeMenu();
                  window.dispatchEvent(new CustomEvent(MANUAL_OPEN_EVENT));
                }}
              >
                {messages.helpMenuManual}
              </MobileMenuAction>
            </>
          )}
        </MobileFloatingActionMenu>
      </div>
      <TransferSearchContent
        open
        mode="mobileWorkspace"
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
              renderProfileRows(profiles)
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
      {saveProfileModal}
    </div>
  );
}
