// Completion feedback for long research runs: a soft chime (always works once
// the user has interacted with the page) plus optional OS notifications.

export function requestNotifyPermission(): void {
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
}

/** Soft three-note chime via Web Audio — no asset file, no notification permission. */
export function playDoneChime(): void {
  if (typeof window === "undefined") return;
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const now = ctx.currentTime;
    // C5 → E5 → G5, soft sine, short decay
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t0 = now + i * 0.09;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.07, t0 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.42);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.45);
    });
    window.setTimeout(() => {
      void ctx.close();
    }, 900);
  } catch {
    /* autoplay policies / headless */
  }
}

export function isAway(): boolean {
  if (typeof document === "undefined") return false;
  return document.visibilityState === "hidden" || document.hidden || !document.hasFocus();
}

/** Best-effort OS notification when the tab is in the background. */
export function notifyResearchComplete(body: string, chatId?: string | null): void {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  if (!isAway()) return;
  try {
    const n = new Notification("MicroManus — research complete", {
      body: (body || "Your research is ready.").slice(0, 140),
      tag: chatId ? `mm-done-${chatId}` : "mm-research-done",
    });
    n.onclick = () => {
      try {
        window.focus();
        n.close();
      } catch {
        /* ignore */
      }
    };
  } catch {
    /* permission revoked mid-run */
  }
}
