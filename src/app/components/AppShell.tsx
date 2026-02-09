"use client";

import { ReactNode, useMemo, useState } from "react";
import styles from "../page.module.css";
import Tooltip from "./Tooltip";
import { Messages } from "@/lib/i18n";

type AppShellProps = {
  messages: Messages;
  children: ReactNode;
};

type ToolId = "youth" | "chronicle";

export default function AppShell({ messages, children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [activeTool, setActiveTool] = useState<ToolId>("youth");

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
        {activeTool === "youth" ? (
          children
        ) : (
          <div className={styles.card}>
            <h2 className={styles.sectionTitle}>
              {messages.clubChronicleTitle}
            </h2>
            <p className={styles.muted}>{messages.clubChronicleBody}</p>
          </div>
        )}
      </section>
    </div>
  );
}
