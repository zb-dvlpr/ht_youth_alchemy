"use client";

import { useCallback, useState } from "react";

import { Messages } from "@/lib/i18n";
import {
  getTransferMarketProfile,
  saveTransferMarketProfile,
} from "@/lib/transferMarketStorage";
import type { DisplayCurrency } from "@/lib/currency";
import type {
  TransferSearchFilters,
  TransferSearchHtmsPotentialFilter,
} from "./TransferSearchModal";
import { normalizeTransferSearchFilters } from "./TransferSearchModal";
import { useNotifications } from "./notifications/NotificationsProvider";
import Modal from "./Modal";
import styles from "../page.module.css";

type UseTransferMarketProfileSaveArgs = {
  messages: Messages;
  scopeKey: string;
  displayCurrency: DisplayCurrency;
  htmsPotentialFilter: TransferSearchHtmsPotentialFilter;
  canSaveProfile: boolean;
  onSaved?: () => void;
};

export function useTransferMarketProfileSave({
  messages,
  scopeKey,
  displayCurrency,
  htmsPotentialFilter,
  canSaveProfile,
  onSaved,
}: UseTransferMarketProfileSaveArgs) {
  const { addNotification } = useNotifications();
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [overwriteName, setOverwriteName] = useState<string | null>(null);
  const [pendingProfileCriteria, setPendingProfileCriteria] =
    useState<TransferSearchFilters | null>(null);

  const closeSaveProfileModal = useCallback(() => {
    setSaveModalOpen(false);
    setProfileName("");
    setProfileError(null);
    setOverwriteName(null);
    setPendingProfileCriteria(null);
  }, []);

  const openSaveProfile = useCallback(
    (committedFilters: TransferSearchFilters) => {
      if (!canSaveProfile) return;
      setPendingProfileCriteria(committedFilters);
      setProfileName("");
      setProfileError(null);
      setOverwriteName(null);
      setSaveModalOpen(true);
    },
    [canSaveProfile]
  );

  const saveProfile = useCallback(
    async (overwrite = false) => {
      if (!canSaveProfile) {
        closeSaveProfileModal();
        return;
      }
      const trimmed = profileName.trim();
      if (!trimmed) {
        setProfileError(messages.transferMarketProfileNameRequired);
        return;
      }
      if (!pendingProfileCriteria) return;
      try {
        const existing = await getTransferMarketProfile(scopeKey, trimmed);
        if (existing && !overwrite) {
          setOverwriteName(trimmed);
          return;
        }
        await saveTransferMarketProfile({
          scopeKey,
          name: trimmed,
          filters: normalizeTransferSearchFilters(pendingProfileCriteria),
          htmsPotentialFilter,
          displayCurrency,
        });
        closeSaveProfileModal();
        addNotification(
          existing
            ? messages.transferMarketProfileOverwritten
            : messages.transferMarketProfileSaved
        );
        onSaved?.();
      } catch {
        setProfileError(messages.transferMarketStorageError);
      }
    },
    [
      addNotification,
      canSaveProfile,
      closeSaveProfileModal,
      displayCurrency,
      htmsPotentialFilter,
      messages.transferMarketProfileNameRequired,
      messages.transferMarketProfileOverwritten,
      messages.transferMarketProfileSaved,
      messages.transferMarketStorageError,
      onSaved,
      pendingProfileCriteria,
      profileName,
      scopeKey,
    ]
  );

  const saveProfileModal = (
    <Modal
      open={saveModalOpen && canSaveProfile}
      title={
        overwriteName
          ? messages.transferMarketOverwriteProfileTitle
          : messages.transferMarketSaveProfileTitle
      }
      body={
        <div className={styles.transferMarketSaveProfileBody}>
          {overwriteName ? (
            <p className={styles.muted}>
              {messages.transferMarketOverwriteProfileBody.replace(
                "{{name}}",
                overwriteName
              )}
            </p>
          ) : (
            <label className={styles.transferMarketProfileNameField}>
              <span className={styles.infoLabel}>
                {messages.transferMarketProfileNameLabel}
              </span>
              <input
                className={styles.transferSearchInput}
                value={profileName}
                placeholder={messages.transferMarketProfileNamePlaceholder}
                onChange={(event) => {
                  setProfileName(event.target.value);
                  setProfileError(null);
                }}
              />
            </label>
          )}
          {profileError ? <p className={styles.errorText}>{profileError}</p> : null}
        </div>
      }
      actions={
        <>
          <button
            type="button"
            className={styles.transferMarketModalSecondaryButton}
            onClick={closeSaveProfileModal}
          >
            {messages.transferMarketOverwriteProfileCancel}
          </button>
          <button
            type="button"
            className={styles.confirmSubmit}
            onClick={() => void saveProfile(Boolean(overwriteName))}
          >
            {overwriteName
              ? messages.transferMarketOverwriteProfileConfirm
              : messages.transferMarketSaveProfileConfirm}
          </button>
        </>
      }
      closeOnBackdrop
      onClose={closeSaveProfileModal}
    />
  );

  return {
    openSaveProfile,
    closeSaveProfileModal,
    saveProfileModal,
  };
}
