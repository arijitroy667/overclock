import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

import { api, Preferences } from './api';

export const DEFAULT_PREFS: Preferences = { calm_mode: false, dyslexia_font: false, reminder_offsets: [15, 10, 5] };
const KEY = 'prefs';

type Ctx = { prefs: Preferences; update: (change: Partial<Preferences>) => Promise<void> };
const PrefsContext = createContext<Ctx>({ prefs: DEFAULT_PREFS, update: async () => {} });

export const usePrefs = () => useContext(PrefsContext);

/** Account preferences, cached on the device so the app opens in the right look even offline. */
export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);

  function save(p: Preferences) {
    setPrefs(p);
    AsyncStorage.setItem(KEY, JSON.stringify(p)).catch(() => {});
  }

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((raw) => raw && setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) })).catch(() => {});
    api.me().then((me) => save(me.preferences)).catch(() => {});
  }, []);

  async function update(change: Partial<Preferences>) {
    const previous = prefs;
    save({ ...prefs, ...change });
    try {
      save(await api.setPreferences(change));
    } catch (e) {
      save(previous);
      throw e;
    }
  }

  return <PrefsContext.Provider value={{ prefs, update }}>{children}</PrefsContext.Provider>;
}
