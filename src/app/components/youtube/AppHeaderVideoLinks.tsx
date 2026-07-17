"use client";

import type { Messages } from "@/lib/i18n";
import { YOUTUBE_HELP_URLS } from "@/lib/youtubeHelpVideos";
import styles from "../../page.module.css";
import YouTubeLink from "./YouTubeLink";

type AppHeaderVideoLinksProps = {
  messages: Messages;
  className?: string;
};

export default function AppHeaderVideoLinks({
  messages,
  className,
}: AppHeaderVideoLinksProps) {
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
        className={styles.appHeaderVideoLink}
        iconClassName={styles.appHeaderVideoIcon}
      />
      <YouTubeLink
        url={YOUTUBE_HELP_URLS.appOverviewSecondary}
        label={messages.youtubeAppOverviewVideoTwo}
        iconOnly
        mode="player"
        className={styles.appHeaderVideoLink}
        iconClassName={styles.appHeaderVideoIcon}
      />
    </div>
  );
}
