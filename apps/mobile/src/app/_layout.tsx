import { ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { router, Stack } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { api, flushQueue, setTokenGetter } from '@/api';
import { Notifications } from '@/notifications';
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
  return (
    <ClerkProvider publishableKey={publishableKey!} tokenCache={tokenCache}>
      <AppStack />
    </ClerkProvider>
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
