"use client";

import { useEffect, useRef, useState } from "react";
import styles from "../page.module.css";
import { Locale, Messages } from "@/lib/i18n";
import type { FeedbackManagerIdentity } from "@/lib/hattrick/managerIdentity";
import Tooltip from "./Tooltip";
import Modal from "./Modal";
import { useNotifications } from "./notifications/NotificationsProvider";

type FeedbackButtonProps = {
  messages: Messages;
  locale: Locale;
  appVersion: string;
  initialManagerIdentity?: FeedbackManagerIdentity | null;
};

type FeedbackKind = "bug" | "feature";

type FeedbackDraft = {
  title: string;
  problem: string;
  reproduce: string;
  expected: string;
  actual: string;
  proposed: string;
  alternatives: string;
  notes: string;
};

const EMPTY_DRAFT: FeedbackDraft = {
  title: "",
  problem: "",
  reproduce: "",
  expected: "",
  actual: "",
  proposed: "",
  alternatives: "",
  notes: "",
};

export default function FeedbackButton({
  messages,
  locale,
  appVersion,
  initialManagerIdentity,
}: FeedbackButtonProps) {
  const { addNotification } = useNotifications();
  const [open, setOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeKind, setActiveKind] = useState<FeedbackKind>("bug");
  const [bugDraft, setBugDraft] = useState<FeedbackDraft>(EMPTY_DRAFT);
  const [featureDraft, setFeatureDraft] = useState<FeedbackDraft>(EMPTY_DRAFT);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const activeDraft = activeKind === "bug" ? bugDraft : featureDraft;
  const setActiveDraft =
    activeKind === "bug" ? setBugDraft : setFeatureDraft;

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (buttonRef.current?.contains(target ?? null)) return;
      if (menuRef.current?.contains(target ?? null)) return;
      setOpen(false);
    };
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [open]);

  const openModalFor = (kind: FeedbackKind) => {
    setActiveKind(kind);
    setErrorMessage(null);
    setModalOpen(true);
    setOpen(false);
  };

  const handleFieldChange = (field: keyof FeedbackDraft, value: string) => {
    setActiveDraft((prev) => ({ ...prev, [field]: value }));
    if (field === "title" && errorMessage) {
      setErrorMessage(null);
    }
  };

  const resetDraft = (kind: FeedbackKind) => {
    if (kind === "bug") {
      setBugDraft(EMPTY_DRAFT);
    } else {
      setFeatureDraft(EMPTY_DRAFT);
    }
  };

  const handleSubmit = async () => {
    const title = activeDraft.title.trim();
    if (!title) {
      setErrorMessage(messages.feedbackTitleRequired);
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/github/issue", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          kind: activeKind,
          title,
          problem: activeDraft.problem,
          reproduce: activeDraft.reproduce,
          expected: activeDraft.expected,
          actual: activeDraft.actual,
          proposed: activeDraft.proposed,
          alternatives: activeDraft.alternatives,
          notes: activeDraft.notes,
          locale,
          appVersion,
          managerUserId: initialManagerIdentity?.userId,
          managerLoginname: initialManagerIdentity?.loginname,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; details?: string }
        | null;
      if (!response.ok) {
        throw new Error(payload?.details || payload?.error || "submit-failed");
      }
      addNotification(
        activeKind === "bug"
          ? messages.feedbackBugSuccess
          : messages.feedbackFeatureSuccess
      );
      resetDraft(activeKind);
      setModalOpen(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error && error.message
          ? error.message
          : messages.feedbackSubmitError
      );
      addNotification(messages.feedbackSubmitError);
    } finally {
      setSubmitting(false);
    }
  };

  const field = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    placeholder?: string,
    multiline = false,
    required = false
  ) => (
    <label className={styles.settingsField}>
      <span className={styles.settingsFieldLabel}>
        {label}
        {required ? <span className={styles.feedbackRequiredMark}> *</span> : null}
      </span>
      {multiline ? (
        <textarea
          value={value}
          className={`${styles.settingsFieldInput} ${styles.feedbackTextArea}`}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          rows={4}
        />
      ) : (
        <input
          type="text"
          value={value}
          className={styles.settingsFieldInput}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  );

  return (
    <div className={styles.feedbackWrap}>
      <Tooltip content={messages.feedbackTooltip}>
        <button
          type="button"
          className={styles.feedbackButton}
          onClick={() => setOpen((prev) => !prev)}
          aria-label={messages.feedbackTooltip}
          ref={buttonRef}
        >
          💬
        </button>
      </Tooltip>
      {open ? (
        <div className={styles.feedbackMenu} ref={menuRef}>
          <button
            type="button"
            className={styles.feedbackLink}
            onClick={() => openModalFor("bug")}
          >
            {messages.feedbackBug}
          </button>
          <button
            type="button"
            className={styles.feedbackLink}
            onClick={() => openModalFor("feature")}
          >
            {messages.feedbackFeature}
          </button>
        </div>
      ) : null}
      <Modal
        open={modalOpen}
        title={
          activeKind === "bug"
            ? messages.feedbackBugTitle
            : messages.feedbackFeatureTitle
        }
        body={
          <div className={styles.feedbackModalBody}>
            {field(
              messages.feedbackFieldTitle,
              activeDraft.title,
              (value) => handleFieldChange("title", value),
              activeKind === "bug"
                ? messages.feedbackBugTitlePlaceholder
                : messages.feedbackFeatureTitlePlaceholder,
              false,
              true
            )}
            {field(
              messages.feedbackFieldProblem,
              activeDraft.problem,
              (value) => handleFieldChange("problem", value),
              messages.feedbackFieldProblemPlaceholder,
              true
            )}
            {activeKind === "bug"
              ? field(
                  messages.feedbackFieldReproduce,
                  activeDraft.reproduce,
                  (value) => handleFieldChange("reproduce", value),
                  messages.feedbackFieldReproducePlaceholder,
                  true
                )
              : field(
                  messages.feedbackFieldProposed,
                  activeDraft.proposed,
                  (value) => handleFieldChange("proposed", value),
                  messages.feedbackFieldProposedPlaceholder,
                  true
                )}
            {activeKind === "bug"
              ? field(
                  messages.feedbackFieldExpected,
                  activeDraft.expected,
                  (value) => handleFieldChange("expected", value),
                  messages.feedbackFieldExpectedPlaceholder,
                  true
                )
              : field(
                  messages.feedbackFieldAlternatives,
                  activeDraft.alternatives,
                  (value) => handleFieldChange("alternatives", value),
                  messages.feedbackFieldAlternativesPlaceholder,
                  true
                )}
            {activeKind === "bug"
              ? field(
                  messages.feedbackFieldActual,
                  activeDraft.actual,
                  (value) => handleFieldChange("actual", value),
                  messages.feedbackFieldActualPlaceholder,
                  true
                )
              : null}
            {field(
              messages.feedbackFieldNotes,
              activeDraft.notes,
              (value) => handleFieldChange("notes", value),
              messages.feedbackFieldNotesPlaceholder,
              true
            )}
            {errorMessage ? (
              <p className={styles.feedbackErrorText}>{errorMessage}</p>
            ) : null}
          </div>
        }
        actions={
          <div className={styles.modalButtonRow}>
            <button
              type="button"
              className={styles.feedbackLink}
              onClick={() => {
                setModalOpen(false);
                setErrorMessage(null);
              }}
              disabled={submitting}
            >
              {messages.closeLabel}
            </button>
            <button
              type="button"
              className={styles.confirmSubmit}
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting
                ? messages.feedbackSubmitting
                : messages.feedbackSubmit}
            </button>
          </div>
        }
        className={styles.feedbackModal}
        closeOnBackdrop
        onClose={() => {
          if (submitting) return;
          setModalOpen(false);
          setErrorMessage(null);
        }}
      />
    </div>
  );
}
