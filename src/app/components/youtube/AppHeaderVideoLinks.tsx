"use client";

import type { Messages } from "@/lib/i18n";
import { YOUTUBE_HELP_URLS } from "@/lib/youtubeHelpVideos";
import styles from "../../page.module.css";
import type { YouTubeIconVariant } from "./YouTubeIcon";
import YouTubeLink from "./YouTubeLink";

type AppHeaderVideoLinksProps = {
  messages: Messages;
  className?: string;
  linkClassName?: string;
  iconClassName?: string;
  iconVariant?: YouTubeIconVariant;
};

export default function AppHeaderVideoLinks({
  messages,
  className,
  linkClassName,
  iconClassName,
  iconVariant = "default",
}: AppHeaderVideoLinksProps) {
  const resolvedLinkClassName = [styles.appHeaderVideoLink, linkClassName]
    .filter(Boolean)
    .join(" ");
  const resolvedIconClassName = [styles.appHeaderVideoIcon, iconClassName]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={[styles.appHeaderVideoLinks, className]
        .filter(Boolean)
        .join(" ")}
    >
      <YouTubeLink
        url={YOUTUBE_HELP_URLS.appOverviewPrimary}
        label={messages.youtubeAppOverviewVideoOne}
        iconOnly
        mode="player"
        iconVariant={iconVariant}
        className={resolvedLinkClassName}
        iconClassName={resolvedIconClassName}
      />
      <YouTubeLink
        url={YOUTUBE_HELP_URLS.appOverviewSecondary}
        label={messages.youtubeAppOverviewVideoTwo}
        iconOnly
        mode="player"
        iconVariant={iconVariant}
        className={resolvedLinkClassName}
        iconClassName={resolvedIconClassName}
      />
    </div>
  );
}
