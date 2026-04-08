const TABS_STORAGE_KEY = "ya_cc_tabs_v1";
const LEGACY_WATCHLIST_STORAGE_KEY = "ya_club_chronicle_watchlist_v1";

export const APP_SHELL_OPEN_TOOL_EVENT = "ya:app-shell-open-tool";
export const CLUB_CHRONICLE_WATCHLISTS_IMPORTED_EVENT =
  "ya:club-chronicle-watchlists-imported";
export const CLUB_CHRONICLE_WATCHLISTS_FLUSH_EVENT =
  "ya:club-chronicle-watchlists-flush";
export const CLUB_CHRONICLE_WATCHLISTS_SNAPSHOT_REQUEST_EVENT =
  "ya:club-chronicle-watchlists-snapshot-request";
export const CLUB_CHRONICLE_WATCHLISTS_IMPORT_QUERY_PARAM = "ccwi";

type CompactManualTeam = {
  i: number;
  n?: string;
  l?: string | null;
  u?: string | null;
  g?: "m" | "f";
  x?: number | null;
};

type CompactChronicleTab = {
  i: string;
  n?: string;
  s: number[];
  o: string[];
  m: CompactManualTeam[];
};

type CompactChronicleWatchlistsPayload = {
  v: 1;
  a: string;
  t: CompactChronicleTab[];
};

type StoredChronicleTab = {
  id?: string;
  name?: string;
  supportedSelections?: Record<string, boolean>;
  ownLeagueSelections?: Record<string, boolean>;
  manualTeams?: Array<{
    teamId?: number | string;
    teamName?: string;
    leagueName?: string | null;
    leagueLevelUnitName?: string | null;
    teamGender?: "male" | "female" | null;
    leagueLevelUnitId?: number | string | null;
  }> | number[];
};

export type StoredChronicleTabsSnapshot = {
  version?: number;
  activeTabId?: string;
  tabs?: StoredChronicleTab[];
};

type ChronicleWatchlistsSnapshotRequestDetail = {
  snapshot: StoredChronicleTabsSnapshot | null;
};

type ImportChronicleTabs = {
  version: 1;
  activeTabId: string;
  tabs: Array<{
    id: string;
    name?: string;
    supportedSelections: Record<number, boolean>;
    ownLeagueSelections: Record<string, boolean>;
    manualTeams: Array<{
      teamId: number;
      teamName?: string;
      leagueName?: string | null;
      leagueLevelUnitName?: string | null;
      teamGender?: "male" | "female" | null;
      leagueLevelUnitId?: number | null;
    }>;
  }>;
};

const PREFIX = "hya-ccw1:";

const normalizeManualTeamGender = (
  gender?: CompactManualTeam["g"]
): "male" | "female" | null =>
  gender === "m" ? "male" : gender === "f" ? "female" : null;

const base64UrlEncode = (value: string) => {
  if (typeof window === "undefined") return "";
  const utf8 = new TextEncoder().encode(value);
  let binary = "";
  utf8.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window
    .btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
};

const base64UrlDecode = (value: string) => {
  if (typeof window === "undefined") return "";
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const paddingLength = (4 - (normalized.length % 4 || 4)) % 4;
  const padded = normalized + "=".repeat(paddingLength);
  const binary = window.atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

const sanitizePositiveNumberArray = (input: unknown): number[] =>
  Array.isArray(input)
    ? input
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
    : [];

const sanitizeOwnLeagueKeys = (input: unknown): string[] =>
  Array.isArray(input)
    ? input
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean)
    : [];

const sanitizeStoredManualTeams = (input: unknown): CompactManualTeam[] =>
  Array.isArray(input)
    ? input
        .map((team): CompactManualTeam | null => {
          if (typeof team === "number") {
            const teamId = Number(team);
            if (!Number.isFinite(teamId) || teamId <= 0) return null;
            return { i: teamId };
          }
          if (!team || typeof team !== "object") return null;
          const source = team as Record<string, unknown>;
          const teamId = Number(source.teamId);
          if (!Number.isFinite(teamId) || teamId <= 0) return null;
          return {
            i: teamId,
            n: typeof source.teamName === "string" ? source.teamName : undefined,
            l:
              typeof source.leagueName === "string"
                ? source.leagueName
                : source.leagueName === null
                  ? null
                  : undefined,
            u:
              typeof source.leagueLevelUnitName === "string"
                ? source.leagueLevelUnitName
                : source.leagueLevelUnitName === null
                  ? null
                  : undefined,
            g:
              source.teamGender === "male"
                ? "m"
                : source.teamGender === "female"
                  ? "f"
                  : undefined,
            x:
              source.leagueLevelUnitId === null ||
              source.leagueLevelUnitId === undefined
                ? undefined
                : Number(source.leagueLevelUnitId),
          };
        })
        .filter((team): team is CompactManualTeam => team !== null)
    : [];

const sanitizeCompactManualTeams = (input: unknown): CompactManualTeam[] =>
  Array.isArray(input)
    ? input
        .map((team): CompactManualTeam | null => {
          if (!team || typeof team !== "object") return null;
          const source = team as Record<string, unknown>;
          const teamId = Number(source.i);
          if (!Number.isFinite(teamId) || teamId <= 0) return null;
          return {
            i: teamId,
            n: typeof source.n === "string" ? source.n : undefined,
            l:
              typeof source.l === "string"
                ? source.l
                : source.l === null
                  ? null
                  : undefined,
            u:
              typeof source.u === "string"
                ? source.u
                : source.u === null
                  ? null
                  : undefined,
            g:
              source.g === "m"
                ? "m"
                : source.g === "f"
                  ? "f"
                  : undefined,
            x:
              source.x === null || source.x === undefined
                ? undefined
                : Number(source.x),
          };
        })
        .filter((team): team is CompactManualTeam => team !== null)
    : [];

const readStoredChronicleTabs = (): StoredChronicleTabsSnapshot | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(TABS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredChronicleTabsSnapshot;
    return parsed && Array.isArray(parsed.tabs) ? parsed : null;
  } catch {
    return null;
  }
};

export function requestChronicleWatchlistsSnapshot():
  | StoredChronicleTabsSnapshot
  | null {
  if (typeof window === "undefined") return null;
  const detail: ChronicleWatchlistsSnapshotRequestDetail = {
    snapshot: null,
  };
  window.dispatchEvent(
    new CustomEvent<ChronicleWatchlistsSnapshotRequestDetail>(
      CLUB_CHRONICLE_WATCHLISTS_SNAPSHOT_REQUEST_EVENT,
      { detail }
    )
  );
  return detail.snapshot;
}

export function exportChronicleWatchlistsToQrString(
  snapshotOverride?: StoredChronicleTabsSnapshot | null
): string {
  if (typeof window === "undefined") {
    throw new Error("unavailable");
  }
  const stored = snapshotOverride ?? readStoredChronicleTabs();
  const tabs = Array.isArray(stored?.tabs) ? stored.tabs : [];
  const compactTabs: CompactChronicleTab[] = (tabs.length > 0 ? tabs : [{ id: "tab-1" }])
    .map((tab, index) => {
      const id =
        typeof tab.id === "string" && tab.id.trim() ? tab.id.trim() : `tab-${index + 1}`;
      const supportedSelections = Object.entries(tab.supportedSelections ?? {})
        .filter(([, selected]) => Boolean(selected))
        .map(([teamId]) => Number(teamId))
        .filter((teamId) => Number.isFinite(teamId) && teamId > 0);
      const ownLeagueSelections = Object.entries(tab.ownLeagueSelections ?? {})
        .filter(([, selected]) => Boolean(selected))
        .map(([key]) => key)
        .filter(Boolean);
      return {
        i: id,
        n: typeof tab.name === "string" && tab.name.trim() ? tab.name.trim() : undefined,
        s: supportedSelections,
        o: ownLeagueSelections,
        m: sanitizeStoredManualTeams(tab.manualTeams),
      };
    });
  const activeTabId =
    typeof stored?.activeTabId === "string" &&
    compactTabs.some((tab) => tab.i === stored.activeTabId)
      ? stored.activeTabId
      : compactTabs[0]?.i ?? "tab-1";
  const payload: CompactChronicleWatchlistsPayload = {
    v: 1,
    a: activeTabId,
    t: compactTabs,
  };
  return `${PREFIX}${base64UrlEncode(JSON.stringify(payload))}`;
}

export function buildChronicleWatchlistsImportUrl(
  encoded: string,
  baseUrl: string
): string {
  const url = new URL(baseUrl, baseUrl);
  url.searchParams.set(CLUB_CHRONICLE_WATCHLISTS_IMPORT_QUERY_PARAM, encoded);
  return url.toString();
}

export function importChronicleWatchlistsFromQrString(
  encoded: string
): ImportChronicleTabs {
  const trimmed = encoded.trim();
  if (!trimmed.startsWith(PREFIX)) {
    throw new Error("invalid-prefix");
  }
  const decoded = base64UrlDecode(trimmed.slice(PREFIX.length));
  const parsed = JSON.parse(decoded) as Partial<CompactChronicleWatchlistsPayload>;
  if (parsed.v !== 1 || !Array.isArray(parsed.t) || parsed.t.length === 0) {
    throw new Error("invalid-payload");
  }

  const tabs = parsed.t
    .map(
      (
        tab,
        index
      ): ImportChronicleTabs["tabs"][number] | null => {
      if (!tab || typeof tab !== "object") return null;
      const compact = tab as Partial<CompactChronicleTab>;
      const id =
        typeof compact.i === "string" && compact.i.trim()
          ? compact.i.trim()
          : `tab-${index + 1}`;
      const supportedSelections = Object.fromEntries(
        sanitizePositiveNumberArray(compact.s).map((teamId) => [teamId, true])
      ) as Record<number, boolean>;
      const ownLeagueSelections = Object.fromEntries(
        sanitizeOwnLeagueKeys(compact.o).map((key) => [key, true])
      ) as Record<string, boolean>;
      const manualTeams: ImportChronicleTabs["tabs"][number]["manualTeams"] =
        sanitizeCompactManualTeams(compact.m).map((team) => ({
          teamId: team.i,
          teamName: team.n,
          leagueName: team.l ?? null,
          leagueLevelUnitName: team.u ?? null,
          teamGender: normalizeManualTeamGender(team.g),
          leagueLevelUnitId:
            typeof team.x === "number" && Number.isFinite(team.x) ? team.x : null,
        }));
      return {
        id,
        name:
          typeof compact.n === "string" && compact.n.trim()
            ? compact.n.trim()
            : undefined,
        supportedSelections,
        ownLeagueSelections,
        manualTeams,
      };
      }
    )
    .filter(
      (
        tab
      ): tab is ImportChronicleTabs["tabs"][number] => tab !== null
    );

  if (tabs.length === 0) {
    throw new Error("empty-tabs");
  }

  const activeTabId =
    typeof parsed.a === "string" && tabs.some((tab) => tab.id === parsed.a)
      ? parsed.a
      : tabs[0].id;

  return {
    version: 1,
    activeTabId,
    tabs,
  };
}

export function applyImportedChronicleWatchlists(
  payload: ImportChronicleTabs
) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify(payload));
  const activeTab =
    payload.tabs.find((tab) => tab.id === payload.activeTabId) ?? payload.tabs[0];
  if (activeTab) {
    window.localStorage.setItem(
      LEGACY_WATCHLIST_STORAGE_KEY,
      JSON.stringify({
        supportedSelections: activeTab.supportedSelections,
        ownLeagueSelections: activeTab.ownLeagueSelections,
        manualTeams: activeTab.manualTeams,
      })
    );
  }
}

export function summarizeImportedChronicleWatchlists(
  payload: ImportChronicleTabs
) {
  return {
    tabCount: payload.tabs.length,
    directTeamCount: payload.tabs.reduce(
      (count, tab) => count + Object.keys(tab.supportedSelections).length,
      0
    ),
    ownLeagueCount: payload.tabs.reduce(
      (count, tab) => count + Object.keys(tab.ownLeagueSelections).length,
      0
    ),
    manualTeamCount: payload.tabs.reduce(
      (count, tab) => count + tab.manualTeams.length,
      0
    ),
  };
}
