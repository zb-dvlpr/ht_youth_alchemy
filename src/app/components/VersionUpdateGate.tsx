"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { Messages } from "@/lib/i18n";
import styles from "../page.module.css";
import Modal from "./Modal";

type VersionUpdateGateProps = {
  appVersion: string;
  messages: Messages;
};

type VersionResponse = {
  version?: string;
};

const VERSION_CHECK_INTERVAL_MS = 2 * 60 * 60 * 1000;

function parseVersion(version: string) {
  const [major = "0", minor = "0", patch = "0"] = version.split(".");
  return {
    major: Number.parseInt(major, 10) || 0,
    minor: Number.parseInt(minor, 10) || 0,
    patch: Number.parseInt(patch, 10) || 0,
  };
}

function isServerVersionNewer(serverVersion: string, clientVersion: string) {
  const server = parseVersion(serverVersion);
  const client = parseVersion(clientVersion);
  if (server.major !== client.major) return server.major > client.major;
  if (server.minor !== client.minor) return server.minor > client.minor;
  return server.patch > client.patch;
}

function buildCacheBustingUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set("alchemyUpdate", String(Date.now()));
  return url.toString();
}

export default function VersionUpdateGate({
  appVersion,
  messages,
}: VersionUpdateGateProps) {
  const [updateRequired, setUpdateRequired] = useState(false);
  const checkInFlightRef = useRef(false);

  const checkVersion = useCallback(async () => {
    if (updateRequired || checkInFlightRef.current) return;
    checkInFlightRef.current = true;
    try {
      const response = await fetch(`/api/version?ts=${Date.now()}`, {
        cache: "no-store",
      });
      if (!response.ok) return;
      const payload = (await response.json()) as VersionResponse;
      if (
        payload.version &&
        isServerVersionNewer(payload.version, appVersion)
      ) {
        setUpdateRequired(true);
      }
    } catch {
      // Version checks should never interrupt normal app usage unless an update is confirmed.
    } finally {
      checkInFlightRef.current = false;
    }
  }, [appVersion, updateRequired]);

  useEffect(() => {
    void checkVersion();
    const intervalId = window.setInterval(() => {
      void checkVersion();
    }, VERSION_CHECK_INTERVAL_MS);
    const handleFocus = () => {
      void checkVersion();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void checkVersion();
      }
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [checkVersion]);

  const handleUpdate = () => {
    window.location.replace(buildCacheBustingUrl());
  };

  return (
    <Modal
      open={updateRequired}
      title={messages.updateRequiredTitle}
      movable={false}
      body={<p>{messages.updateRequiredBody}</p>}
      actions={
        <button
          type="button"
          className={styles.confirmSubmit}
          onClick={handleUpdate}
        >
          {messages.updateRequiredAction}
        </button>
      }
    />
  );
}
