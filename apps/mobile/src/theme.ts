// Small, deliberately constrained token set (PRD §12): calm colors, big touch targets, no alarm-red.
import { useColorScheme } from 'react-native';

import { usePrefs } from './prefs';

const light = {
  bg: '#F7F6F2',
  card: '#FFFFFF',
  text: '#1F2328',
  muted: '#6B7075',
  accent: '#3A6FF7',
  accentText: '#FFFFFF',
  soft: '#E9EEFD',
  border: '#E3E1DA',
  warm: '#E8A33D', // gentle attention; never "failure" red
};

const dark: typeof light = {
  bg: '#14161A',
  card: '#1D2026',
  text: '#ECEDEE',
  muted: '#9BA1A6',
  accent: '#7B9DFF',
  accentText: '#0E1116',
  soft: '#252C3D',
  border: '#2C3038',
  warm: '#F0B35A',
};

// Calm mode (§17): same layout, fewer and quieter colors.
const calmLight: typeof light = { ...light, accent: '#66758A', soft: '#ECEEF1', warm: '#8A9099' };
const calmDark: typeof light = { ...dark, accent: '#8E9AAD', soft: '#23272E', warm: '#9AA0A8' };

export type Theme = typeof light & { calm: boolean; font?: string; fontBold?: string };

export function useTheme(): Theme {
  const isDark = useColorScheme() === 'dark';
  const { prefs } = usePrefs();
  const palette = prefs.calm_mode ? (isDark ? calmDark : calmLight) : isDark ? dark : light;
  return {
    ...palette,
    calm: prefs.calm_mode,
    // Lexend (§17 dyslexia-friendly option); loaded in the root layout
    font: prefs.dyslexia_font ? 'Lexend_400Regular' : undefined,
    fontBold: prefs.dyslexia_font ? 'Lexend_600SemiBold' : undefined,
  };
}

export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const radius = 14;
export const touch = 52; // generous minimum touch target
