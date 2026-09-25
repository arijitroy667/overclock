import { ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { Lexend_400Regular, Lexend_600SemiBold, useFonts } from '@expo-google-fonts/lexend';
import { router, Stack } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { api, flushQueue, setTokenGetter } from '@/api';
import { Notifications, registerPushToken } from '@/notifications';
import { PrefsProvider } from '@/prefs';
import { useTheme } from '@/theme';

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
if (!publishableKey) throw new Error('Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in apps/mobile/.env.local');

Notifications?.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Lexend_400Regular, Lexend_600SemiBold });
  if (!fontsLoaded) return null;
  return (
    <ClerkProvider publishableKey={publishableKey!} tokenCache={tokenCache}>
      <SignedInPrefs />
    </ClerkProvider>
  );
}

function SignedInPrefs() {
  const { isSignedIn } = useAuth();
  // Remount on sign-in/out so preferences load for the account that's signed in.
  return (
    <PrefsProvider key={String(isSignedIn)}>
      <AppStack />
    </PrefsProvider>
  );
}

function AppStack() {
  const t = useTheme();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  setTokenGetter(getToken);

  useEffect(() => {
    if (!isSignedIn) return;
    api.me()
      .then((me) => !me.onboarded && router.replace('/onboarding'))
      .catch(() => {}); // offline: let them capture anyway
    flushQueue().catch(() => {});
    registerPushToken().then((token) => token && api.addPush(token)).catch(() => {});
    const sub = AppState.addEventListener('change', (s) => s === 'active' && flushQueue().catch(() => {}));
    return () => sub.remove();
  }, [isSignedIn]);

  if (!isLoaded) return null;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
      <Stack.Protected guard={!!isSignedIn}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
        <Stack.Screen name="focus" options={{ presentation: 'fullScreenModal' }} />
      </Stack.Protected>
      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}
