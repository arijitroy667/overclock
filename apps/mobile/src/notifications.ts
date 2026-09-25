import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

type NotificationsModule = typeof import('expo-notifications');

// Since SDK 53, merely importing expo-notifications throws inside Expo Go on Android.
// There we skip system reminders (the in-app timer and body-check screen still work); a development build gets them all.
const unsupported = Constants.executionEnvironment === ExecutionEnvironment.StoreClient && Platform.OS === 'android';

// eslint-disable-next-line @typescript-eslint/no-require-imports
export const Notifications: NotificationsModule | null = unsupported ? null : require('expo-notifications');

/** Schedule a local notification `minutes` from now. Resolves to its id, or null when notifications are unavailable. */
export async function notifyIn(minutes: number, title: string, body: string): Promise<string | null> {
  if (!Notifications) return null;
  return Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.max(1, Math.round(minutes * 60)) },
  });
}

/** Expo push token, for reminders that arrive with the app closed. Needs a development build
 *  and an EAS project id; in Expo Go there is none, so we quietly stay on local notifications. */
export async function registerPushToken(): Promise<string | null> {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!Notifications || !projectId) return null;
  try {
    if (!(await Notifications.requestPermissionsAsync()).granted) return null;
    return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch {
    return null;
  }
}
