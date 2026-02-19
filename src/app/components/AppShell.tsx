"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import styles from "../page.module.css";
import Tooltip from "./Tooltip";
import ClubChronicle from "./ClubChronicle";
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
      <section className={styles.shellContent}>
        {activeTool === "youth" ? children : <ClubChronicle messages={messages} />}
      </section>
    </div>
  );
}
