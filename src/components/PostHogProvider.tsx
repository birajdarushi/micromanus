"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

// Product analytics (PostHog → ClickHouse under the hood). No-ops when the
// public key is unset so local/dev builds stay quiet.
export default function PostHogProvider() {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key || typeof window === "undefined") return;
    // Avoid double-init under React Strict Mode re-mounts.
    if ((window as unknown as { __mmPosthog?: boolean }).__mmPosthog) return;
    (window as unknown as { __mmPosthog?: boolean }).__mmPosthog = true;

    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      person_profiles: "identified_only",
      capture_pageview: true,
      capture_pageleave: true,
      persistence: "localStorage+cookie",
      // Session replay — also requires Session Replay enabled in PostHog project settings.
      disable_session_recording: false,
      session_recording: {
        // type=password is masked by default; also mask API key / promo fields by test id.
        maskTextSelector: "[data-ph-mask], [data-testid='api-key-input']",
        maskAllInputs: false,
        maskInputOptions: {
          password: true,
        },
      },
    });
    // Explicitly start so recording is active even if sampling/flags would defer it.
    posthog.startSessionRecording(true);
  }, []);

  return null;
}

export function identifyUser(id: string, props?: Record<string, string | number | boolean | null>) {
  try {
    if (typeof window === "undefined" || !process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
    posthog.identify(id, props);
  } catch {
    /* ignore */
  }
}

export function captureEvent(event: string, props?: Record<string, unknown>) {
  try {
    if (typeof window === "undefined" || !process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
    posthog.capture(event, props);
  } catch {
    /* ignore */
  }
}
