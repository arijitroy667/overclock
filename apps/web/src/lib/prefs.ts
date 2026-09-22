import type { Preferences } from "./api";

export const DEFAULT_PREFS: Preferences = { calm_mode: false, dyslexia_font: false, reminder_offsets: [15, 10, 5] };
const KEY = "prefs";

/** Last-known preferences for this browser (a cache of the account's settings, so pages don't flash). */
export function cachedPrefs(): Preferences {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function applyPrefs(p: Preferences) {
  document.documentElement.dataset.calm = String(p.calm_mode);
  document.documentElement.dataset.font = p.dyslexia_font ? "dyslexia" : "default";
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {}
}
