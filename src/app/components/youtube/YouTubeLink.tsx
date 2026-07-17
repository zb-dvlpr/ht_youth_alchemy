"use client";

import type { MouseEvent, ReactNode } from "react";
import Tooltip from "../Tooltip";
import { resolveYouTubeTarget } from "@/lib/youtube";
import YouTubeIcon, { type YouTubeIconVariant } from "./YouTubeIcon";
import { useYouTubePlayer } from "./YouTubePlayerProvider";
import styles from "./youtube.module.css";

type YouTubeLinkProps = {
  url: string;
  label: string;
  iconOnly?: boolean;
  className?: string;
  iconClassName?: string;
  children?: ReactNode;
  onActivate?: () => void;
  mode?: "auto" | "player" | "external";
  iconVariant?: YouTubeIconVariant;
};

const isPlainPrimaryClick = (event: MouseEvent<HTMLAnchorElement>) =>
  event.button === 0 &&
  !event.metaKey &&
  !event.ctrlKey &&
  !event.shiftKey &&
  !event.altKey;

export default function YouTubeLink({
  url,
  label,
  iconOnly = false,
  className,
  iconClassName,
  children,
  onActivate,
  mode = "auto",
  iconVariant = "default",
}: YouTubeLinkProps) {
  const { openVideo } = useYouTubePlayer();
  const target = resolveYouTubeTarget(url);
  const shouldUsePlayer =
    mode === "player" || (mode === "auto" && target.kind === "video");
  const linkClassName = [
    iconOnly ? styles.iconOnlyLink : styles.inlineLink,
    className,
  ]
    .filter(Boolean)
    .join(" ");
  const icon = (
    <YouTubeIcon
      variant={iconVariant}
      className={[styles.icon, iconClassName].filter(Boolean).join(" ")}
    />
  );

  const link = (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={linkClassName}
      aria-label={iconOnly ? label : undefined}
      onClick={(event) => {
        if (shouldUsePlayer && target.kind === "video" && isPlainPrimaryClick(event)) {
          event.preventDefault();
          openVideo({
            url,
            title: label,
            triggerElement: event.currentTarget,
          });
          onActivate?.();
          return;
        }
        onActivate?.();
      }}
    >
      {icon}
      {iconOnly ? null : (children ?? <span>{label}</span>)}
    </a>
  );

  return iconOnly ? <Tooltip content={label}>{link}</Tooltip> : link;
}
