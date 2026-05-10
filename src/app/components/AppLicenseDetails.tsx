"use client";

import type { Messages } from "@/lib/i18n";
import type { LemonSqueezyLicenseDetails } from "@/lib/lemonsqueezyLicense";
import { formatDateTime } from "@/lib/datetime";

import styles from "../page.module.css";

type AppLicenseDetailsProps = {
  details: LemonSqueezyLicenseDetails;
  messages: Messages;
};

const formatValue = (value: string | number | null | undefined, fallback: string) => {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
};

const formatDateTimeValue = (value: string | null | undefined, fallback: string) => {
  if (!value) return fallback;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return fallback;
  return formatDateTime(parsed) || fallback;
};

const formatLicenseStatus = (
  status: LemonSqueezyLicenseDetails["status"],
  messages: Messages
) => {
  switch (status) {
    case "active":
      return messages.settingsLicenseStatusActive;
    case "inactive":
      return messages.settingsLicenseStatusInactive;
    case "expired":
      return messages.settingsLicenseStatusExpired;
    case "disabled":
      return messages.settingsLicenseStatusDisabled;
    default:
      return messages.unknownShort;
  }
};

export default function AppLicenseDetails({
  details,
  messages,
}: AppLicenseDetailsProps) {
  const rows: Array<{ label: string; value: string }> = [
    {
      label: messages.settingsLicenseDetailProduct,
      value: formatValue(details.productName, messages.unknownShort),
    },
    {
      label: messages.settingsLicenseDetailStatus,
      value: formatLicenseStatus(details.status, messages),
    },
    {
      label: messages.settingsLicenseDetailKey,
      value: formatValue(details.key, messages.unknownShort),
    },
    {
      label: messages.settingsLicenseDetailActivationLimit,
      value: formatValue(details.activationLimit, messages.unknownShort),
    },
    {
      label: messages.settingsLicenseDetailActivationUsage,
      value: formatValue(details.activationUsage, messages.unknownShort),
    },
    {
      label: messages.settingsLicenseDetailCreatedAt,
      value: formatDateTimeValue(details.createdAt, messages.unknownShort),
    },
    {
      label: messages.settingsLicenseDetailExpiresAt,
      value: details.expiresAt
        ? formatDateTimeValue(details.expiresAt, messages.unknownShort)
        : messages.settingsLicenseNeverExpires,
    },
    {
      label: messages.settingsLicenseDetailCustomerName,
      value: formatValue(details.customerName, messages.unknownShort),
    },
    {
      label: messages.settingsLicenseDetailCustomerEmail,
      value: formatValue(details.customerEmail, messages.unknownShort),
    },
  ];

  return (
    <div className={styles.licenseDetailsPanel}>
      {rows.map((row) => (
        <div key={row.label} className={styles.licenseDetailsRow}>
          <span className={styles.licenseDetailsLabel}>{row.label}</span>
          <span
            className={
              row.label === messages.settingsLicenseDetailStatus
                ? styles.licenseDetailsStatus
                : styles.licenseDetailsValue
            }
          >
            {row.value}
          </span>
        </div>
      ))}
    </div>
  );
}
