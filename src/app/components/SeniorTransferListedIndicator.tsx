"use client";

import styles from "../page.module.css";
import { Messages } from "@/lib/i18n";
import { formatDateTime } from "@/lib/datetime";
import { parseChppDate } from "@/lib/chpp/utils";
import { hattrickTeamUrl } from "@/lib/hattrick/urls";
import Tooltip from "./Tooltip";

export type SeniorTransferListing = {
  askingPrice?: number;
  deadline?: string;
  highestBid?: number;
  bidderTeamId?: number;
  bidderTeamName?: string;
};

type SeniorTransferListedIndicatorProps = {
  listing: SeniorTransferListing | null;
  messages: Messages;
  formatEurFromSek: (value: number) => string;
  compact?: boolean;
  nested?: boolean;
};

export default function SeniorTransferListedIndicator({
  listing,
  messages,
  formatEurFromSek,
  compact = false,
  nested = false,
}: SeniorTransferListedIndicatorProps) {
  if (!listing) return null;

  const deadlineDate =
    typeof listing.deadline === "string" && listing.deadline
      ? parseChppDate(listing.deadline)
      : null;
  const hasHighestBid =
    typeof listing.highestBid === "number" && Number.isFinite(listing.highestBid);

  return (
    <Tooltip
      content={
        <div className={styles.transferListedTooltipContent}>
          <div className={styles.transferListedTooltipRow}>
            <span className={styles.transferListedTooltipLabel}>
              {messages.clubChronicleTransferListedAskingPriceColumn}
            </span>
            <span className={styles.transferListedTooltipValue}>
              {typeof listing.askingPrice === "number" && Number.isFinite(listing.askingPrice)
                ? formatEurFromSek(listing.askingPrice)
                : messages.unknownShort}
            </span>
          </div>
          <div className={styles.transferListedTooltipRow}>
            <span className={styles.transferListedTooltipLabel}>
              {messages.seniorTransferSearchDeadlineLabel}
            </span>
            <span className={styles.transferListedTooltipValue}>
              {deadlineDate ? formatDateTime(deadlineDate) : messages.unknownShort}
            </span>
          </div>
          <div className={styles.transferListedTooltipRow}>
            <span className={styles.transferListedTooltipLabel}>
              {messages.seniorTransferSearchHighestBidLabel}
            </span>
            <span className={styles.transferListedTooltipValue}>
              {hasHighestBid ? (
                <>
                  {typeof listing.bidderTeamId === "number" &&
                  listing.bidderTeamId > 0 &&
                  listing.bidderTeamName ? (
                    <a
                      className={styles.chroniclePressLink}
                      href={hattrickTeamUrl(listing.bidderTeamId)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {listing.bidderTeamName}
                    </a>
                  ) : (
                    listing.bidderTeamName ?? messages.unknownLabel
                  )}
                  {`: ${formatEurFromSek(listing.highestBid as number)}`}
                </>
              ) : (
                messages.seniorTransferListedNoBidsYet
              )}
            </span>
          </div>
        </div>
      }
      variant="stacked"
      openOnClick
      interactive
    >
      {nested ? (
        <span
          className={`${styles.transferListedIndicatorButton} ${
            compact ? styles.transferListedIndicatorButtonCompact : ""
          }`}
          role="button"
          aria-label={messages.seniorTransferListedIndicatorLabel}
        >
          <span
            className={`${styles.transferListedIndicatorEmoji} ${
              compact ? styles.transferListedIndicatorEmojiCompact : ""
            }`}
            aria-hidden="true"
          >
            💰
          </span>
        </span>
      ) : (
        <button
          type="button"
          className={`${styles.transferListedIndicatorButton} ${
            compact ? styles.transferListedIndicatorButtonCompact : ""
          }`}
          aria-label={messages.seniorTransferListedIndicatorLabel}
        >
          <span
            className={`${styles.transferListedIndicatorEmoji} ${
              compact ? styles.transferListedIndicatorEmojiCompact : ""
            }`}
            aria-hidden="true"
          >
            💰
          </span>
        </button>
      )}
    </Tooltip>
  );
}
