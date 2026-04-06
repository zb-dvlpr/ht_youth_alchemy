"use client";

import {
  Children,
  Fragment,
  type CSSProperties,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import styles from "../page.module.css";
import Tooltip from "./Tooltip";
import ClubChronicle from "./ClubChronicle";
import Modal from "./Modal";
import BuyCoffeeButton from "./BuyCoffeeButton";
import { Messages } from "@/lib/i18n";
import { getChangelogEntries } from "@/lib/changelog";
import { formatDateTime } from "@/lib/datetime";
import {
  getMissingChppPermissions,
  parseExtendedPermissionsFromCheckToken,
  REQUIRED_CHPP_EXTENDED_PERMISSIONS,
} from "@/lib/chpp/permissions";
import { reconnectChppWithTokenReset } from "@/lib/chpp/client";
import {
  BUY_COFFEE_PROMPT_DEBUG_OPEN_EVENT,
  BUY_COFFEE_PROMPT_OPEN_EVENT,
} from "@/lib/settings";

type AppShellProps = {
  messages: Messages;
  appVersion: string;
  globalHeader: ReactNode;
  children: ReactNode;
  seniorTool: ReactNode;
  mobileLauncherUtility?: ReactNode;
};

type ToolId = "youth" | "senior" | "chronicle";

type ViewStateSnapshot = {
  activeTool: ToolId;
  collapsed: boolean;
  windowScrollX: number;
  windowScrollY: number;
  mainScrollTop: number | null;
  mainScrollLeft: number | null;
  chroniclePanelScroll: Record<string, number>;
  capturedAt: number;
};

type BuyCoffeePromptState = {
  firstSeenAt: number;
  lastPromptAt: number | null;
  cadenceDays: number;
};

const APP_SHELL_VIEW_STATE_KEY = "ya_app_shell_view_state_v1";
const APP_SHELL_ACTIVE_TOOL_KEY = "ya_app_shell_active_tool_v1";
const APP_SHELL_COLLAPSED_KEY = "ya_app_shell_collapsed_v1";
const CHANGELOG_SEEN_LATEST_ENTRY_KEY = "ya_changelog_seen_latest_entry_v1";
const BUY_COFFEE_PROMPT_STORAGE_KEY = "ya_buy_me_coffee_prompt_v1";
const BUY_COFFEE_INITIAL_DELAY_MS = 30 * 1000;
const BUY_COFFEE_FIRST_PROMPT_MS = 7 * 24 * 60 * 60 * 1000;
const BUY_COFFEE_DEFAULT_CADENCE_DAYS = 30;
const BUY_COFFEE_SUPPORTED_CADENCE_DAYS = 60;
const YOUTH_REFRESH_REQUEST_EVENT = "ya:youth-refresh-request";
const YOUTH_REFRESH_STOP_EVENT = "ya:youth-refresh-stop";
const YOUTH_REFRESH_STATE_EVENT = "ya:youth-refresh-state";
const YOUTH_LATEST_UPDATES_OPEN_EVENT = "ya:youth-latest-updates-open";
const SENIOR_REFRESH_REQUEST_EVENT = "ya:senior-refresh-request";
const SENIOR_REFRESH_STOP_EVENT = "ya:senior-refresh-stop";
const SENIOR_REFRESH_STATE_EVENT = "ya:senior-refresh-state";
const SENIOR_LATEST_UPDATES_OPEN_EVENT = "ya:senior-latest-updates-open";
const MOBILE_LAUNCHER_REQUEST_EVENT = "ya:mobile-launcher-request";
const MOBILE_NAV_TRAIL_STATE_EVENT = "ya:mobile-nav-trail-state";
const MOBILE_NAV_TRAIL_JUMP_EVENT = "ya:mobile-nav-trail-jump";
const MOBILE_LAYOUT_MEDIA_QUERY = "(max-width: 900px)";

type MobileNavSegment = {
  id: string;
  label: string;
};

export default function AppShell({
  messages,
  appVersion,
  globalHeader,
  children,
  seniorTool,
  mobileLauncherUtility,
}: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [activeTool, setActiveTool] = useState<ToolId>("youth");
  const [mobileLayoutActive, setMobileLayoutActive] = useState(false);
  const [mobileLauncherOpen, setMobileLauncherOpen] = useState(false);
  const [mobileNavSegments, setMobileNavSegments] = useState<MobileNavSegment[]>([]);
  const [viewStateRestored, setViewStateRestored] = useState(false);
  const [topBarHeight, setTopBarHeight] = useState(56);
  const [mobileNavHeaderHeight, setMobileNavHeaderHeight] = useState(56);
  const [youthRefreshing, setYouthRefreshing] = useState(false);
  const [youthRefreshStatus, setYouthRefreshStatus] = useState<string | null>(null);
  const [youthRefreshProgressPct, setYouthRefreshProgressPct] = useState(0);
  const [youthLastRefreshAt, setYouthLastRefreshAt] = useState<number | null>(null);
  const [seniorRefreshing, setSeniorRefreshing] = useState(false);
  const [seniorRefreshStatus, setSeniorRefreshStatus] = useState<string | null>(null);
  const [seniorRefreshProgressPct, setSeniorRefreshProgressPct] = useState(0);
  const [seniorLastRefreshAt, setSeniorLastRefreshAt] = useState<number | null>(null);
  const [showChangelog, setShowChangelog] = useState(false);
  const [changelogPage, setChangelogPage] = useState(0);
  const [scopeReconnectModalOpen, setScopeReconnectModalOpen] = useState(false);
  const [buyCoffeePromptOpen, setBuyCoffeePromptOpen] = useState(false);
  const [buyCoffeePromptState, setBuyCoffeePromptState] =
    useState<BuyCoffeePromptState | null>(null);
  const [buyCoffeeSessionReady, setBuyCoffeeSessionReady] = useState(false);
  const shellTopBarRef = useRef<HTMLDivElement | null>(null);
  const mobileNavHeaderRef = useRef<HTMLDivElement | null>(null);
  const buyCoffeePromptShownThisSessionRef = useRef(false);
  const mobileLayoutInitializedRef = useRef(false);

  const persistBuyCoffeePromptState = (nextState: BuyCoffeePromptState) => {
    setBuyCoffeePromptState(nextState);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        BUY_COFFEE_PROMPT_STORAGE_KEY,
        JSON.stringify(nextState)
      );
    } catch {
      // ignore storage errors
    }
  };

  const ensureRefreshScopes = async () => {
    try {
      const response = await fetch("/api/chpp/oauth/check-token", {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            permissions?: string[];
            raw?: string;
          }
        | null;
      if (!response.ok) {
        setScopeReconnectModalOpen(true);
        return false;
      }
      const grantedPermissions = Array.isArray(payload?.permissions)
        ? payload.permissions
        : [];
      const missingPermissions = getMissingChppPermissions(
        grantedPermissions,
        REQUIRED_CHPP_EXTENDED_PERMISSIONS
      );
      const rawTokenCheck = typeof payload?.raw === "string" ? payload.raw : "";
      const hasScopeTag = /<Scope>/i.test(rawTokenCheck);
      const scopeTokens = hasScopeTag
        ? parseExtendedPermissionsFromCheckToken(rawTokenCheck)
        : [];
      const missingDefaultScope = hasScopeTag && !scopeTokens.includes("default");
      if (missingPermissions.length > 0 || missingDefaultScope) {
        setScopeReconnectModalOpen(true);
        return false;
      }
      return true;
    } catch {
      setScopeReconnectModalOpen(true);
      return false;
    }
  };

  const tools = useMemo(
    () => [
      {
        id: "youth" as const,
        label: messages.toolYouthOptimization,
        icon: "✨",
        badge: messages.toolYouthBadge,
      },
      {
        id: "senior" as const,
        label: messages.toolSeniorOptimization,
        icon: "✨",
        badge: messages.toolSeniorBadge,
      },
      {
        id: "chronicle" as const,
        label: messages.toolClubChronicle,
        icon: "📰",
      },
    ],
    [
      messages.toolClubChronicle,
      messages.toolSeniorBadge,
      messages.toolSeniorOptimization,
      messages.toolYouthBadge,
      messages.toolYouthOptimization,
    ]
  );

  const changelogEntries = useMemo(() => getChangelogEntries(messages), [messages]);
  const changelogRows = useMemo(
    () =>
      changelogEntries.flatMap((entry) =>
        entry.entries.map((item) => ({
          version: entry.version,
          text: item,
        }))
      ),
    [changelogEntries]
  );
  const changelogPageSize = 10;
  const changelogTotalPages = Math.max(
    1,
    Math.ceil(changelogRows.length / changelogPageSize)
  );
  const changelogPageIndex = Math.min(changelogPage, changelogTotalPages - 1);
  const changelogPageStart = changelogPageIndex * changelogPageSize;
  const changelogPageRows = changelogRows.slice(
    changelogPageStart,
    changelogPageStart + changelogPageSize
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const latestVersion = changelogEntries[0]?.version ?? null;
    if (!latestVersion) return;
    try {
      const previous = window.localStorage.getItem(CHANGELOG_SEEN_LATEST_ENTRY_KEY);
      if (!previous) {
        window.localStorage.setItem(CHANGELOG_SEEN_LATEST_ENTRY_KEY, latestVersion);
        return;
      }
      if (previous !== latestVersion) {
        window.localStorage.setItem(CHANGELOG_SEEN_LATEST_ENTRY_KEY, latestVersion);
        setChangelogPage(0);
        setShowChangelog(true);
      }
    } catch {
      // ignore storage errors
    }
  }, [changelogEntries]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(BUY_COFFEE_PROMPT_STORAGE_KEY);
      if (!raw) {
        const initialState: BuyCoffeePromptState = {
          firstSeenAt: Date.now(),
          lastPromptAt: null,
          cadenceDays: BUY_COFFEE_DEFAULT_CADENCE_DAYS,
        };
        window.localStorage.setItem(
          BUY_COFFEE_PROMPT_STORAGE_KEY,
          JSON.stringify(initialState)
        );
        setBuyCoffeePromptState(initialState);
        return;
      }
      const parsed = JSON.parse(raw) as Partial<BuyCoffeePromptState> | null;
      const normalized: BuyCoffeePromptState = {
        firstSeenAt:
          typeof parsed?.firstSeenAt === "number" &&
          Number.isFinite(parsed.firstSeenAt)
            ? parsed.firstSeenAt
            : Date.now(),
        lastPromptAt:
          typeof parsed?.lastPromptAt === "number" &&
          Number.isFinite(parsed.lastPromptAt)
            ? parsed.lastPromptAt
            : null,
        cadenceDays:
          parsed?.cadenceDays === BUY_COFFEE_SUPPORTED_CADENCE_DAYS
            ? BUY_COFFEE_SUPPORTED_CADENCE_DAYS
            : BUY_COFFEE_DEFAULT_CADENCE_DAYS,
      };
      window.localStorage.setItem(
        BUY_COFFEE_PROMPT_STORAGE_KEY,
        JSON.stringify(normalized)
      );
      setBuyCoffeePromptState(normalized);
    } catch {
      setBuyCoffeePromptState({
        firstSeenAt: Date.now(),
        lastPromptAt: null,
        cadenceDays: BUY_COFFEE_DEFAULT_CADENCE_DAYS,
      });
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const timer = window.setTimeout(() => {
      setBuyCoffeeSessionReady(true);
    }, BUY_COFFEE_INITIAL_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mediaQuery = window.matchMedia(MOBILE_LAYOUT_MEDIA_QUERY);
    const apply = (matches: boolean) => {
      setMobileLayoutActive(matches);
      if (!matches) {
        setMobileLauncherOpen(false);
        return;
      }
      if (!mobileLayoutInitializedRef.current) {
        mobileLayoutInitializedRef.current = true;
        setMobileLauncherOpen(true);
      }
    };

    apply(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => apply(event.matches);
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (mobileLayoutActive) {
      root.dataset.mobileShell = "true";
    } else {
      delete root.dataset.mobileShell;
    }
    return () => {
      delete root.dataset.mobileShell;
    };
  }, [mobileLayoutActive]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!mobileLayoutActive) return;
    if (mobileLauncherOpen) {
      window.history.replaceState({ appShell: "launcher" }, "", window.location.href);
    }
  }, [mobileLayoutActive, mobileLauncherOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!mobileLayoutActive) return;
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state as
        | { appShell?: "launcher" | "tool"; tool?: ToolId }
        | null;
      if (state?.appShell === "tool" && state.tool) {
        setActiveTool(
          state.tool === "chronicle"
            ? "chronicle"
            : state.tool === "senior"
            ? "senior"
            : "youth"
        );
        setMobileLauncherOpen(false);
        return;
      }
      setMobileLauncherOpen(true);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [mobileLayoutActive]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handle = () => {
      setMobileLauncherOpen(true);
      if (mobileLayoutActive) {
        window.history.pushState({ appShell: "launcher" }, "", window.location.href);
      }
    };
    window.addEventListener(MOBILE_LAUNCHER_REQUEST_EVENT, handle);
    return () => window.removeEventListener(MOBILE_LAUNCHER_REQUEST_EVENT, handle);
  }, [mobileLayoutActive]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!buyCoffeePromptState) return;
    if (!buyCoffeeSessionReady) return;
    if (buyCoffeePromptOpen) return;
    if (buyCoffeePromptShownThisSessionRef.current) return;
    if (showChangelog || scopeReconnectModalOpen) return;
    if (youthRefreshing || seniorRefreshing) return;
    if (document.hidden) return;
    const otherModalOpen =
      document.querySelectorAll('[role="dialog"][aria-modal="true"]').length > 0;
    if (otherModalOpen) return;
    const nextPromptAt =
      buyCoffeePromptState.lastPromptAt === null
        ? buyCoffeePromptState.firstSeenAt + BUY_COFFEE_FIRST_PROMPT_MS
        : buyCoffeePromptState.lastPromptAt +
          buyCoffeePromptState.cadenceDays * 24 * 60 * 60 * 1000;
    if (Date.now() < nextPromptAt) return;
    buyCoffeePromptShownThisSessionRef.current = true;
    setBuyCoffeePromptOpen(true);
  }, [
    buyCoffeePromptOpen,
    buyCoffeePromptState,
    buyCoffeeSessionReady,
    scopeReconnectModalOpen,
    seniorRefreshing,
    showChangelog,
    youthRefreshing,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => {
      buyCoffeePromptShownThisSessionRef.current = true;
      setBuyCoffeePromptOpen(true);
    };
    window.addEventListener(BUY_COFFEE_PROMPT_OPEN_EVENT, handler);
    window.addEventListener(BUY_COFFEE_PROMPT_DEBUG_OPEN_EVENT, handler);
    return () => {
      window.removeEventListener(BUY_COFFEE_PROMPT_OPEN_EVENT, handler);
      window.removeEventListener(BUY_COFFEE_PROMPT_DEBUG_OPEN_EVENT, handler);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!viewStateRestored) return;
    try {
      window.localStorage.setItem(APP_SHELL_ACTIVE_TOOL_KEY, activeTool);
    } catch {
      // ignore storage errors
    }
  }, [activeTool, viewStateRestored]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!viewStateRestored) return;
    try {
      window.localStorage.setItem(
        APP_SHELL_COLLAPSED_KEY,
        collapsed ? "1" : "0"
      );
    } catch {
      // ignore storage errors
    }
  }, [collapsed, viewStateRestored]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const restore = () => {
      try {
        const raw = window.localStorage.getItem(APP_SHELL_VIEW_STATE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as ViewStateSnapshot;
          if (
            parsed &&
            typeof parsed === "object" &&
            Date.now() - Number(parsed.capturedAt ?? 0) <= 2 * 60 * 1000
          ) {
            setCollapsed(Boolean(parsed.collapsed));
            setActiveTool(
              parsed.activeTool === "chronicle"
                ? "chronicle"
                : parsed.activeTool === "senior"
                  ? "senior"
                  : "youth"
            );
            return;
          }
          window.localStorage.removeItem(APP_SHELL_VIEW_STATE_KEY);
        }
        const stored = window.localStorage.getItem(APP_SHELL_ACTIVE_TOOL_KEY);
        setActiveTool(
          stored === "chronicle"
            ? "chronicle"
            : stored === "senior"
              ? "senior"
              : "youth"
        );
        const collapsedStored = window.localStorage.getItem(
          APP_SHELL_COLLAPSED_KEY
        );
        if (collapsedStored === "1" || collapsedStored === "0") {
          setCollapsed(collapsedStored === "1");
        }
      } catch {
        // ignore parse/storage errors
      } finally {
        setViewStateRestored(true);
      }
    };
    restore();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let parsed: ViewStateSnapshot | null = null;
    try {
      const raw = window.localStorage.getItem(APP_SHELL_VIEW_STATE_KEY);
      if (!raw) return;
      parsed = JSON.parse(raw) as ViewStateSnapshot;
      if (!parsed || typeof parsed !== "object") return;
      if (Date.now() - Number(parsed.capturedAt ?? 0) > 2 * 60 * 1000) {
        window.localStorage.removeItem(APP_SHELL_VIEW_STATE_KEY);
        return;
      }
    } catch {
      return;
    }
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (!parsed) return;
        const main = document.querySelector("[data-app-main='true']") as HTMLElement | null;
        if (main && parsed.mainScrollTop !== null && parsed.mainScrollLeft !== null) {
          main.scrollTop = parsed.mainScrollTop;
          main.scrollLeft = parsed.mainScrollLeft;
        }
        window.scrollTo(parsed.windowScrollX ?? 0, parsed.windowScrollY ?? 0);
        if (parsed.activeTool === "chronicle" && parsed.chroniclePanelScroll) {
          Object.entries(parsed.chroniclePanelScroll).forEach(([panelId, top]) => {
            const panel = document.querySelector(
              `[data-cc-scroll-key='${panelId}']`
            ) as HTMLElement | null;
            if (panel && Number.isFinite(top)) {
              panel.scrollTop = top;
            }
          });
        }
        window.localStorage.removeItem(APP_SHELL_VIEW_STATE_KEY);
      });
    });
  }, [activeTool]);

  useEffect(() => {
    setMobileNavSegments([]);
  }, [activeTool, mobileLauncherOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handle = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const detail = event.detail as
        | { tool?: ToolId; segments?: MobileNavSegment[] }
        | undefined;
      if (!detail || detail.tool !== activeTool) return;
      const segments = Array.isArray(detail.segments)
        ? detail.segments.filter(
            (segment): segment is MobileNavSegment =>
              Boolean(
                segment &&
                  typeof segment.id === "string" &&
                  typeof segment.label === "string"
              )
          )
        : [];
      setMobileNavSegments(segments);
    };
    window.addEventListener(MOBILE_NAV_TRAIL_STATE_EVENT, handle);
    return () => window.removeEventListener(MOBILE_NAV_TRAIL_STATE_EVENT, handle);
  }, [activeTool]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const captureViewState = () => {
      const main = document.querySelector("[data-app-main='true']") as HTMLElement | null;
      const chroniclePanelScroll: Record<string, number> = {};
      document.querySelectorAll<HTMLElement>("[data-cc-scroll-key]").forEach((node) => {
        const key = node.dataset.ccScrollKey;
        if (!key) return;
        chroniclePanelScroll[key] = node.scrollTop;
      });
      const snapshot: ViewStateSnapshot = {
        activeTool,
        collapsed,
        windowScrollX: window.scrollX,
        windowScrollY: window.scrollY,
        mainScrollTop: main ? main.scrollTop : null,
        mainScrollLeft: main ? main.scrollLeft : null,
        chroniclePanelScroll,
        capturedAt: Date.now(),
      };
      try {
        window.localStorage.setItem(APP_SHELL_VIEW_STATE_KEY, JSON.stringify(snapshot));
      } catch {
        // ignore storage errors
      }
    };
    window.addEventListener("ya:before-locale-switch", captureViewState);
    return () => {
      window.removeEventListener("ya:before-locale-switch", captureViewState);
    };
  }, [activeTool, collapsed]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const node = shellTopBarRef.current;
    if (!node) return;
    const measure = () => {
      const next = Math.round(node.getBoundingClientRect().height);
      if (next > 0) {
        setTopBarHeight(next);
      }
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const node = mobileNavHeaderRef.current;
    if (!node) return;
    const measure = () => {
      const next = Math.round(node.getBoundingClientRect().height);
      if (next > 0) {
        setMobileNavHeaderHeight(next);
      }
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [mobileLayoutActive, mobileLauncherOpen, mobileNavSegments, activeTool]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handle = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const detail = event.detail as
        | {
            refreshing?: boolean;
            status?: string | null;
            progressPct?: number;
            lastRefreshAt?: number | null;
          }
        | undefined;
      if (!detail) return;
      setSeniorRefreshing(Boolean(detail.refreshing));
      setSeniorRefreshStatus(
        typeof detail.status === "string" ? detail.status : null
      );
      setSeniorRefreshProgressPct(
        typeof detail.progressPct === "number"
          ? Math.max(0, Math.min(100, detail.progressPct))
          : 0
      );
      setSeniorLastRefreshAt(
        typeof detail.lastRefreshAt === "number" ? detail.lastRefreshAt : null
      );
    };
    window.addEventListener(SENIOR_REFRESH_STATE_EVENT, handle);
    return () => window.removeEventListener(SENIOR_REFRESH_STATE_EVENT, handle);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handle = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const detail = event.detail as
        | {
            refreshing?: boolean;
            status?: string | null;
            progressPct?: number;
            lastRefreshAt?: number | null;
          }
        | undefined;
      if (!detail) return;
      setYouthRefreshing(Boolean(detail.refreshing));
      setYouthRefreshStatus(
        typeof detail.status === "string" ? detail.status : null
      );
      setYouthRefreshProgressPct(
        typeof detail.progressPct === "number"
          ? Math.max(0, Math.min(100, detail.progressPct))
          : 0
      );
      setYouthLastRefreshAt(
        typeof detail.lastRefreshAt === "number" ? detail.lastRefreshAt : null
      );
    };
    window.addEventListener(YOUTH_REFRESH_STATE_EVENT, handle);
    return () => window.removeEventListener(YOUTH_REFRESH_STATE_EVENT, handle);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => {
      if (activeTool === "youth") return;
      setChangelogPage(0);
      setShowChangelog(true);
    };
    window.addEventListener("ya:changelog-open", handler);
    return () => window.removeEventListener("ya:changelog-open", handler);
  }, [activeTool]);

  const handleSelectTool = (toolId: ToolId) => {
    setActiveTool(toolId);
    if (mobileLayoutActive) {
      setMobileLauncherOpen(false);
      window.history.pushState(
        { appShell: "tool", tool: toolId },
        "",
        window.location.href
      );
    }
  };

  const renderToolButton = (tool: (typeof tools)[number]) => {
    const button = (
      <button
        type="button"
        className={`${styles.sidebarItem} ${
          activeTool === tool.id ? styles.sidebarItemActive : ""
        }`}
        onClick={() => handleSelectTool(tool.id)}
        aria-label={tool.label}
      >
        <span className={styles.sidebarIcon} aria-hidden="true">
          <span className={styles.sidebarIconGlyph}>
            {tool.badge ? `${tool.badge}${tool.icon}` : tool.icon}
          </span>
        </span>
        {!collapsed ? (
          <span className={styles.sidebarLabel}>{tool.label}</span>
        ) : null}
      </button>
    );

    if (!collapsed) return button;

    return (
      <Tooltip content={tool.label} fullWidth>
        {button}
      </Tooltip>
    );
  };

  const kofiButton = (
    <BuyCoffeeButton
      className={styles.sidebarItem}
      aria-label={messages.supportOnKofi}
    >
      <span className={styles.sidebarIcon} aria-hidden="true">
        <span className={styles.sidebarIconGlyph}>☕</span>
      </span>
      {!collapsed ? <span className={styles.sidebarLabel}>{messages.supportOnKofi}</span> : null}
    </BuyCoffeeButton>
  );

  const activeOptimizationLastRefreshAt =
    activeTool === "youth" ? youthLastRefreshAt : seniorLastRefreshAt;
  const activeToolMeta = tools.find((tool) => tool.id === activeTool) ?? tools[0];
  const headerChildren = useMemo(() => Children.toArray(globalHeader), [globalHeader]);
  const youthToolChildren = useMemo(() => Children.toArray(children), [children]);
  const seniorToolChildren = useMemo(() => Children.toArray(seniorTool), [seniorTool]);

  const handleBuyCoffeeLater = () => {
    const baseState = buyCoffeePromptState ?? {
      firstSeenAt: Date.now(),
      lastPromptAt: null,
      cadenceDays: BUY_COFFEE_DEFAULT_CADENCE_DAYS,
    };
    persistBuyCoffeePromptState({
      ...baseState,
      lastPromptAt: Date.now(),
    });
    setBuyCoffeePromptOpen(false);
  };

  const handleBuyCoffeeAction = () => {
    if (typeof window !== "undefined") {
      window.open("https://ko-fi.com/zbdvlpr", "_blank", "noopener,noreferrer");
    }
    const baseState = buyCoffeePromptState ?? {
      firstSeenAt: Date.now(),
      lastPromptAt: null,
      cadenceDays: BUY_COFFEE_DEFAULT_CADENCE_DAYS,
    };
    persistBuyCoffeePromptState({
      ...baseState,
      lastPromptAt: Date.now(),
      cadenceDays: BUY_COFFEE_SUPPORTED_CADENCE_DAYS,
    });
    setBuyCoffeePromptOpen(false);
  };

  const mobileNavTrail = mobileLayoutActive && !mobileLauncherOpen ? (
    <div className={styles.mobileNavHeader} ref={mobileNavHeaderRef}>
      <div className={styles.mobileNavAppMeta}>
        <span className={styles.mobileNavAppTitle}>{messages.brandTitle}</span>
        <span className={styles.version}>v{appVersion}</span>
      </div>
      <div className={styles.mobileNavTrail} aria-label={messages.brandTitle}>
        <button
          type="button"
          className={styles.mobileNavTrailButton}
          onClick={() => {
            window.dispatchEvent(new CustomEvent(MOBILE_LAUNCHER_REQUEST_EVENT));
          }}
        >
          {messages.brandTitle}
        </button>
        <span className={styles.mobileNavTrailSeparator} aria-hidden="true">
          ›
        </span>
        <button
          type="button"
          className={`${styles.mobileNavTrailButton} ${
            mobileNavSegments.length === 0 ? styles.mobileNavTrailCurrent : ""
          }`}
          disabled={mobileNavSegments.length === 0}
          onClick={() => {
            window.dispatchEvent(
              new CustomEvent(MOBILE_NAV_TRAIL_JUMP_EVENT, {
                detail: { tool: activeTool, target: "tool-root" },
              })
            );
          }}
        >
          {activeToolMeta.label}
        </button>
        {mobileNavSegments.map((segment, index) => {
          const isCurrent = index === mobileNavSegments.length - 1;
          return (
            <Fragment key={segment.id}>
              <span className={styles.mobileNavTrailSeparator} aria-hidden="true">
                ›
              </span>
              <button
                type="button"
                className={`${styles.mobileNavTrailButton} ${
                  isCurrent ? styles.mobileNavTrailCurrent : ""
                }`}
                disabled={isCurrent}
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent(MOBILE_NAV_TRAIL_JUMP_EVENT, {
                      detail: { tool: activeTool, target: segment.id },
                    })
                  )
                }
              >
                {segment.label}
              </button>
            </Fragment>
          );
        })}
      </div>
    </div>
  ) : null;

  return (
    <div
      className={styles.shellFrame}
      data-mobile-layout={mobileLayoutActive ? "true" : "false"}
      data-mobile-launcher-open={mobileLauncherOpen ? "true" : "false"}
      style={
        {
          "--shell-topbar-height": `${topBarHeight}px`,
          "--mobile-nav-header-height": `${mobileNavHeaderHeight}px`,
        } as CSSProperties
      }
    >
      <div className={styles.shellTopBar} ref={shellTopBarRef}>
        {headerChildren}
      </div>
      {!mobileLayoutActive ? (
        <aside
          className={`${styles.sidebar} ${
            collapsed ? styles.sidebarCollapsed : ""
          }`}
        >
          <div className={styles.sidebarHeader}>
            <Tooltip
              content={
                collapsed
                  ? messages.sidebarExpandTooltip
                  : messages.sidebarCollapseTooltip
              }
            >
              <button
                type="button"
                className={styles.sidebarToggle}
                onClick={() => setCollapsed((prev) => !prev)}
                aria-label={
                  collapsed
                    ? messages.sidebarExpandTooltip
                    : messages.sidebarCollapseTooltip
                }
              >
                {collapsed ? "»" : "«"}
              </button>
            </Tooltip>
          </div>
          <nav className={styles.sidebarNav}>
            {tools.map((tool) => (
              <div key={tool.id} className={styles.sidebarItemWrap}>
                {renderToolButton(tool)}
              </div>
            ))}
            <div className={styles.sidebarItemWrap}>
              {collapsed ? (
                <Tooltip content={messages.supportOnKofi} fullWidth>
                  {kofiButton}
                </Tooltip>
              ) : (
                kofiButton
              )}
            </div>
          </nav>
        </aside>
      ) : null}
      {!mobileLauncherOpen &&
      !mobileLayoutActive &&
      (activeTool === "youth" || activeTool === "senior") ? (
        <div className={styles.shellContextBar}>
          <div className={styles.youthActionBarActions}>
            <Tooltip content={messages.refreshAllYouthDataTooltip}>
              <button
                type="button"
                className={styles.chronicleUpdatesButton}
                onClick={() => {
                  void (async () => {
                    const hasRequiredScopes = await ensureRefreshScopes();
                    if (!hasRequiredScopes) return;
                    window.dispatchEvent(
                      new CustomEvent(
                        activeTool === "youth"
                          ? YOUTH_REFRESH_REQUEST_EVENT
                          : SENIOR_REFRESH_REQUEST_EVENT
                      )
                    );
                  })();
                }}
                disabled={activeTool === "youth" ? youthRefreshing : seniorRefreshing}
                aria-label={
                  activeTool === "youth"
                    ? messages.refreshAllYouthDataTooltip
                    : messages.refreshAllSeniorDataTooltip
                }
              >
                {messages.clubChronicleRefreshButton}
              </button>
            </Tooltip>
            <button
              type="button"
              className={styles.chronicleUpdatesButton}
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent(
                    activeTool === "youth"
                      ? YOUTH_LATEST_UPDATES_OPEN_EVENT
                      : SENIOR_LATEST_UPDATES_OPEN_EVENT
                  )
                )
              }
              aria-label={messages.clubChronicleUpdatesButton}
              data-help-anchor={
                activeTool === "senior" ? "senior-latest-updates" : undefined
              }
            >
              {messages.clubChronicleUpdatesButton}
            </button>
          </div>
          {(activeTool === "youth"
            ? youthRefreshStatus || youthRefreshing
            : seniorRefreshStatus || seniorRefreshing) ? (
            <div className={styles.chronicleRefreshStatusWrap} aria-live="polite">
              <span className={styles.chronicleRefreshStatusText}>
                {activeTool === "youth"
                  ? youthRefreshStatus ?? messages.refreshingLabel
                  : seniorRefreshStatus ?? messages.refreshingLabel}
              </span>
              <span className={styles.chronicleRefreshProgressRow}>
                <span className={styles.chronicleRefreshProgressTrack} aria-hidden="true">
                  <span
                    className={styles.chronicleRefreshProgressFill}
                    style={{
                      width: `${Math.max(
                        0,
                        Math.min(
                          100,
                          activeTool === "youth"
                            ? youthRefreshProgressPct
                            : seniorRefreshProgressPct
                        )
                      )}%`,
                    }}
                  />
                </span>
                {(activeTool === "youth" ? youthRefreshing : seniorRefreshing) ? (
                  <Tooltip content={messages.refreshStopTooltip}>
                    <button
                      type="button"
                      className={`${styles.chronicleUpdatesButton} ${styles.chronicleRefreshStopButton}`}
                      onClick={() =>
                        window.dispatchEvent(
                          new CustomEvent(
                            activeTool === "youth"
                              ? YOUTH_REFRESH_STOP_EVENT
                              : SENIOR_REFRESH_STOP_EVENT
                          )
                        )
                      }
                      aria-label={messages.refreshStopTooltip}
                    >
                      ■
                    </button>
                  </Tooltip>
                ) : null}
              </span>
            </div>
          ) : null}
          {activeOptimizationLastRefreshAt ? (
            <span className={styles.chronicleRefreshStatusText}>
              {messages.youthLastGlobalRefresh}:{" "}
              {formatDateTime(activeOptimizationLastRefreshAt)}
            </span>
          ) : null}
        </div>
      ) : null}
      {mobileLayoutActive && !mobileLauncherOpen ? mobileNavTrail : null}
      <section className={styles.shellWorkspace} data-active-tool={activeTool}>
        {mobileLayoutActive ? (
          mobileLauncherOpen ? (
            <div className={styles.mobileLauncher}>
              <div className={styles.mobileLauncherGrid}>
                {tools.map((tool) => (
                  <button
                    key={tool.id}
                    type="button"
                    className={styles.mobileLauncherToolCard}
                    onClick={() => handleSelectTool(tool.id)}
                    aria-label={tool.label}
                  >
                    <span className={styles.mobileLauncherToolIcon} aria-hidden="true">
                      {tool.badge ? `${tool.badge}${tool.icon}` : tool.icon}
                    </span>
                    <span className={styles.mobileLauncherToolLabel}>{tool.label}</span>
                  </button>
                ))}
              </div>
              {mobileLauncherUtility ? (
                <div className={styles.mobileLauncherUtilityRow}>
                  {mobileLauncherUtility}
                </div>
              ) : null}
            </div>
          ) : (
            <>
              {activeTool === "youth" ? youthToolChildren : null}
              {activeTool === "senior" ? seniorToolChildren : null}
              {activeTool === "chronicle" ? <ClubChronicle messages={messages} /> : null}
            </>
          )
        ) : (
          <>
            {activeTool === "youth" ? youthToolChildren : null}
            {activeTool === "senior" ? seniorToolChildren : null}
            {activeTool === "chronicle" ? <ClubChronicle messages={messages} /> : null}
          </>
        )}
      </section>
      <Modal
        open={buyCoffeePromptOpen}
        title={messages.buyCoffeePromptTitle}
        movable={false}
        body={
          <div className={styles.algorithmsModalBody}>
            <p>{messages.buyCoffeePromptLead}</p>
            <p>{messages.buyCoffeePromptBody}</p>
            <p>{messages.buyCoffeePromptFoot}</p>
          </div>
        }
        actions={
          <>
            <button
              type="button"
              className={styles.confirmCancel}
              onClick={handleBuyCoffeeLater}
            >
              {messages.buyCoffeePromptLater}
            </button>
            <button
              type="button"
              className={styles.confirmSubmit}
              onClick={handleBuyCoffeeAction}
            >
              {messages.buyCoffeePromptAction}
            </button>
          </>
        }
      />
      <Modal
        open={scopeReconnectModalOpen}
        title={messages.scopeReconnectTitle}
        movable={false}
        body={<p>{messages.scopeReconnectBody}</p>}
        actions={
          <button
            type="button"
            className={styles.confirmSubmit}
            onClick={() => {
              void reconnectChppWithTokenReset();
            }}
          >
            {messages.scopeReconnectAction}
          </button>
        }
      />
      <Modal
        open={showChangelog}
        title={messages.changelogTitle}
        movable={false}
        body={
          <div className={styles.changelogBody}>
            <div className={styles.changelogTable}>
              <div className={styles.changelogRowHeader}>
                <span>{messages.changelogVersionLabel}</span>
                <span>{messages.changelogEntryLabel}</span>
              </div>
              {changelogPageRows.map((row, index) => (
                <div
                  key={`${row.version}-${changelogPageStart + index}`}
                  className={styles.changelogRow}
                >
                  <span className={styles.changelogVersion}>v{row.version}</span>
                  <span className={styles.changelogText}>{row.text}</span>
                </div>
              ))}
            </div>
            <div className={styles.changelogPagination}>
              <span className={styles.changelogPageLabel}>
                {messages.changelogPageLabel
                  .replace("{{current}}", String(changelogPageIndex + 1))
                  .replace("{{total}}", String(changelogTotalPages))}
              </span>
              <div className={styles.changelogPageButtons}>
                <button
                  type="button"
                  className={styles.confirmCancel}
                  onClick={() =>
                    setChangelogPage((prev) => Math.max(0, prev - 1))
                  }
                  disabled={changelogPageIndex === 0}
                >
                  {messages.changelogNewer}
                </button>
                <button
                  type="button"
                  className={styles.confirmSubmit}
                  onClick={() =>
                    setChangelogPage((prev) =>
                      Math.min(changelogTotalPages - 1, prev + 1)
                    )
                  }
                  disabled={changelogPageIndex >= changelogTotalPages - 1}
                >
                  {messages.changelogOlder}
                </button>
              </div>
            </div>
          </div>
        }
        actions={
          <button
            type="button"
            className={styles.confirmSubmit}
            onClick={() => setShowChangelog(false)}
          >
            {messages.closeLabel}
          </button>
        }
        closeOnBackdrop
        onClose={() => setShowChangelog(false)}
      />
    </div>
  );
}
