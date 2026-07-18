"use client";

import { useEffect } from "react";

export default function PwaRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined") return;
    if (!window.isSecureContext) return;
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // PWA support is progressive; registration failures must not affect the app.
    });
  }, []);

  return null;
}
