// Client-side platform helpers for shortcut labels and similar UI.
// Safe defaults assume non-Apple (Ctrl) until navigator is available.

export type PlatformFamily = "mac" | "windows" | "linux" | "other";

export function detectPlatform(): PlatformFamily {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";

  // iOS / macOS share the Meta (⌘) modifier.
  if (/Mac|iPhone|iPad|iPod/i.test(platform) || /Mac OS X|Macintosh/.test(ua)) {
    return "mac";
  }
  if (/Win/i.test(platform) || /Windows/i.test(ua)) return "windows";
  if (/Linux/i.test(platform) || /Linux/i.test(ua) || /X11/i.test(platform)) return "linux";
  return "other";
}

export function isApplePlatform(): boolean {
  return detectPlatform() === "mac";
}

/** Human-readable chord for the primary modifier + key, e.g. "⌘K" or "Ctrl+K". */
export function formatModShortcut(key: string): string {
  const k = key.length === 1 ? key.toUpperCase() : key;
  return isApplePlatform() ? `⌘${k}` : `Ctrl+${k}`;
}
