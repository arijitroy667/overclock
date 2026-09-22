// Small, deliberately constrained token set (PRD §12): calm colors, big touch targets, no alarm-red.
import { useColorScheme } from 'react-native';

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

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const radius = 14;
export const touch = 52; // generous minimum touch target
