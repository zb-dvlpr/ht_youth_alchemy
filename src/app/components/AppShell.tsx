"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import styles from "../page.module.css";
import Tooltip from "./Tooltip";
import ClubChronicle from "./ClubChronicle";
import Modal from "./Modal";
import { Messages } from "@/lib/i18n";

type AppShellProps = {
  messages: Messages;
  children: ReactNode;
};

type ToolId = "youth" | "chronicle";

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

const APP_SHELL_VIEW_STATE_KEY = "ya_app_shell_view_state_v1";
const APP_SHELL_ACTIVE_TOOL_KEY = "ya_app_shell_active_tool_v1";

export default function AppShell({ messages, children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [activeTool, setActiveTool] = useState<ToolId>("youth");
  const [viewStateRestored, setViewStateRestored] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [changelogPage, setChangelogPage] = useState(0);

  const tools = useMemo(
    () => [
      {
        id: "youth" as const,
        label: messages.toolYouthOptimization,
        icon: "✨",
      },
      {
        id: "chronicle" as const,
        label: messages.toolClubChronicle,
        icon: "📰",
      },
    ],
    [messages.toolClubChronicle, messages.toolYouthOptimization]
  );

  const changelogEntries = useMemo(
    () => [
      {
        version: "2.19.0",
        entries: [messages.changelog_2_19_0],
      },
      {
        version: "2.16.0",
        entries: [messages.changelog_2_16_0],
      },
      {
        version: "2.15.0",
        entries: [messages.changelog_2_15_0],
      },
      {
        version: "2.14.0",
        entries: [messages.changelog_2_14_0],
      },
      {
        version: "2.13.0",
        entries: [messages.changelog_2_13_0],
      },
      {
        version: "2.12.0",
        entries: [messages.changelog_2_12_0],
      },
      {
        version: "2.11.0",
        entries: [messages.changelog_2_11_0],
      },
      {
        version: "2.10.0",
        entries: [messages.changelog_2_10_0],
      },
      {
        version: "2.9.0",
        entries: [messages.changelog_2_9_0],
      },
      {
        version: "2.8.0",
        entries: [messages.changelog_2_8_0],
      },
      {
        version: "2.7.0",
        entries: [messages.changelog_2_7_0],
      },
      {
        version: "2.6.0",
        entries: [messages.changelog_2_6_0],
      },
      {
        version: "2.5.0",
        entries: [messages.changelog_2_5_0],
      },
      {
        version: "2.4.0",
        entries: [messages.changelog_2_4_0],
      },
      {
        version: "2.3.0",
        entries: [messages.changelog_2_3_0],
      },
      {
        version: "2.2.0",
        entries: [messages.changelog_2_2_0],
      },
      {
        version: "2.1.0",
        entries: [messages.changelog_2_1_0],
      },
      {
        version: "2.0.0",
        entries: [messages.changelog_2_0_0],
      },
      {
        version: "1.28.0",
        entries: [messages.changelog_1_28_0],
      },
      {
        version: "1.26.0",
        entries: [messages.changelog_1_26_0],
      },
      {
        version: "1.25.0",
        entries: [messages.changelog_1_25_0],
      },
      {
        version: "1.24.0",
        entries: [messages.changelog_1_24_0],
      },
      {
        version: "1.23.0",
        entries: [messages.changelog_1_23_0],
      },
      {
        version: "1.22.0",
        entries: [messages.changelog_1_22_0],
      },
      {
        version: "1.21.0",
        entries: [messages.changelog_1_21_0],
      },
      {
        version: "1.19.0",
        entries: [messages.changelog_1_19_0],
      },
    ],
    [
      messages.changelog_1_19_0,
      messages.changelog_1_21_0,
      messages.changelog_1_22_0,
      messages.changelog_1_23_0,
      messages.changelog_1_24_0,
      messages.changelog_1_25_0,
      messages.changelog_1_26_0,
      messages.changelog_1_28_0,
      messages.changelog_2_0_0,
      messages.changelog_2_1_0,
      messages.changelog_2_2_0,
      messages.changelog_2_3_0,
      messages.changelog_2_4_0,
      messages.changelog_2_5_0,
      messages.changelog_2_6_0,
      messages.changelog_2_7_0,
      messages.changelog_2_8_0,
      messages.changelog_2_9_0,
      messages.changelog_2_10_0,
      messages.changelog_2_11_0,
      messages.changelog_2_12_0,
      messages.changelog_2_13_0,
      messages.changelog_2_14_0,
      messages.changelog_2_15_0,
      messages.changelog_2_16_0,
      messages.changelog_2_19_0,
    ]
  );
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
    if (!viewStateRestored) return;
    try {
      window.localStorage.setItem(APP_SHELL_ACTIVE_TOOL_KEY, activeTool);
    } catch {
      // ignore storage errors
    }
  }, [activeTool, viewStateRestored]);

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
              parsed.activeTool === "chronicle" ? "chronicle" : "youth"
            );
            return;
          }
          window.localStorage.removeItem(APP_SHELL_VIEW_STATE_KEY);
        }
        const stored = window.localStorage.getItem(APP_SHELL_ACTIVE_TOOL_KEY);
        setActiveTool(stored === "chronicle" ? "chronicle" : "youth");
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
    const handler = () => {
      if (activeTool !== "chronicle") return;
      setChangelogPage(0);
      setShowChangelog(true);
    };
    window.addEventListener("ya:changelog-open", handler);
    return () => window.removeEventListener("ya:changelog-open", handler);
  }, [activeTool]);

  const renderToolButton = (tool: (typeof tools)[number]) => {
    const button = (
      <button
        type="button"
        className={`${styles.sidebarItem} ${
          activeTool === tool.id ? styles.sidebarItemActive : ""
        }`}
        onClick={() => setActiveTool(tool.id)}
        aria-label={tool.label}
      >
        <span className={styles.sidebarIcon} aria-hidden="true">
          {tool.icon}
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

  return (
    <div className={styles.shell}>
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
        </nav>
      </aside>
      <section className={styles.shellContent} data-active-tool={activeTool}>
        {activeTool === "youth" ? children : <ClubChronicle messages={messages} />}
      </section>
      <Modal
        open={showChangelog}
        title={messages.changelogTitle}
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
