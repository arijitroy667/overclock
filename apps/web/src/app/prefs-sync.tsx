"use client";

import { useEffect } from "react";

import { api } from "@/lib/api";
import { applyPrefs, cachedPrefs } from "@/lib/prefs";

/** Applies calm mode / font from the cache immediately, then from the account. */
export function PrefsSync() {
  useEffect(() => {
    applyPrefs(cachedPrefs());
    api.me().then((me) => applyPrefs(me.preferences)).catch(() => {});
  }, []);
  return null;
}
