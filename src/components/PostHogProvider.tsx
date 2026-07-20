"use client";

import posthog from "posthog-js";

// PostHog is initialized in instrumentation-client.ts; this module only
// exports thin helpers so existing callers don't need to change imports.
export default function PostHogProvider() {
  return null;
}

export function identifyUser(id: string, props?: Record<string, string | number | boolean | null>) {
  try {
    if (typeof window === "undefined" || !process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) return;
    posthog.identify(id, props);
  } catch {
    /* ignore */
  }
}

export function captureEvent(event: string, props?: Record<string, unknown>) {
  try {
    if (typeof window === "undefined" || !process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) return;
    posthog.capture(event, props);
  } catch {
    /* ignore */
  }
}
