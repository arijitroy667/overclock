import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

import type { Insights, Me, Preferences, Task } from '../../../packages/types';

export type { Insights, Me, Preferences, Task };

/** Reframing runs in the background right after capture; allow ~30s before treating it as "no reframe". */
export const isReframing = (t: Task) => !t.reframed_title && Date.now() - new Date(t.captured_at).getTime() < 30_000;

// In development the API runs on the same machine as Metro, so reuse the host the app was loaded from
// (it survives Wi-Fi address changes). EXPO_PUBLIC_API_URL overrides it, e.g. for a deployed API.
const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
const BASE = (process.env.EXPO_PUBLIC_API_URL || (devHost ? `http://${devHost}:8000` : 'http://localhost:8000')) + '/api/v1';

// Set from the root layout (Clerk's getToken lives in React context; this module doesn't).
let getToken: () => Promise<string | null> = async () => null;
export const setTokenGetter = (fn: typeof getToken) => { getToken = fn; };

/** The server answered with an error. Anything else thrown by fetch means we never reached it. */
export class HttpError extends Error {}

async function req<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const token = await getToken().catch(() => null); // offline: let fetch fail as a network error
  const res = await fetch(BASE + path, {
    method: init?.method ?? 'GET',
    headers: { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }) },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!res.ok) throw new HttpError((await res.json().catch(() => null))?.detail ?? `HTTP ${res.status}`);
  return res.json();
}

// ---- offline-tolerant capture (§17): a thought is never lost to a bad connection ----
const QUEUE = 'capture-queue';
type Queued = { text: string; source: 'text' | 'voice' };

async function readQueue(): Promise<Queued[]> {
  return JSON.parse((await AsyncStorage.getItem(QUEUE)) ?? '[]');
}

/** Returns the reframed task, or null if it was queued offline. */
export async function capture(text: string, source: Queued['source'] = 'text'): Promise<Task | null> {
  try {
    return await req<Task>('/tasks/capture', { method: 'POST', body: { text, source } });
  } catch (e) {
    if (e instanceof HttpError) throw e; // server said no; anything else = unreachable, keep it for later
    await AsyncStorage.setItem(QUEUE, JSON.stringify([...(await readQueue()), { text, source }]));
    return null;
  }
}

export async function flushQueue(): Promise<number> {
  const queued = await readQueue();
  let sent = 0;
  for (const item of queued) {
    try {
      await req('/tasks/capture', { method: 'POST', body: item });
      sent++;
    } catch {
      break; // still offline; keep the rest in order
    }
  }
  await AsyncStorage.setItem(QUEUE, JSON.stringify(queued.slice(sent)));
  return queued.length - sent;
}

export const api = {
  me: () => req<Me>('/me'),
  onboard: (body: { display_name?: string; timezone: string; accept_disclaimer: boolean }) =>
    req('/me/onboarding', { method: 'POST', body }),
  tasks: (energy?: number) => req<Task[]>('/tasks' + (energy ? `?energy=${energy}` : '')),
  resurface: () => req<Task[]>('/tasks/resurface'),
  reframe: (id: string) => req<Task>(`/tasks/${id}/reframe`, { method: 'POST' }),
  patch: (id: string, body: Partial<Task> & { reframe_accepted?: boolean }) =>
    req<Task>(`/tasks/${id}`, { method: 'PATCH', body }),
  complete: (id: string, actual_duration?: number) =>
    req<Task>(`/tasks/${id}/complete`, { method: 'POST', body: { actual_duration } }),
  startSession: (task_id?: string) =>
    req<{ id: string; guardrail_after_minutes: number }>('/focus-sessions/start', { method: 'POST', body: { task_id } }),
  endSession: (id: string) => req(`/focus-sessions/${id}/end`, { method: 'POST' }),
  guardrailAck: (id: string, kind: 'hydration' | 'movement' | 'meal') =>
    req(`/focus-sessions/${id}/guardrail-ack`, { method: 'POST', body: { kind } }),
  logEnergy: (energy_level: number) => req('/energy-logs', { method: 'POST', body: { energy_level } }),
  insights: () => req<Insights>('/insights/weekly'),
  setPreferences: (body: Partial<Preferences>) => req<Preferences>('/me/preferences', { method: 'PATCH', body }),
  exportData: () => req<unknown>('/me/export'),
  deleteAccount: () => req('/me', { method: 'DELETE' }),
};
