import { getToken } from "@clerk/nextjs";

import type { Idea, Insights, Me, Preferences, Task } from "../../../../packages/types";

export type { Idea, Insights, Me, Preferences, Task };

/** Reframing runs in the background right after capture; allow ~30s before treating it as "no reframe". */
export const isReframing = (t: Task) => !t.reframed_title && Date.now() - new Date(t.captured_at).getTime() < 30_000;

// ponytail: mirrors apps/mobile/src/api.ts (storage differs). Move to packages/ once it needs to change in both.
/** The server answered with an error. Anything else thrown by fetch means we never reached it. */
export class HttpError extends Error {}

async function req<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const token = await getToken().catch(() => null); // throws when offline; let fetch fail as a network error
  const res = await fetch("/api/v1" + path, {
    method: init?.method ?? "GET",
    headers: { "content-type": "application/json", ...(token && { authorization: `Bearer ${token}` }) },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!res.ok) throw new HttpError((await res.json().catch(() => null))?.detail ?? `HTTP ${res.status}`);
  return res.json();
}

// ---- offline-tolerant capture (§17) ----
const QUEUE = "capture-queue";
const readQueue = (): string[] => JSON.parse(localStorage.getItem(QUEUE) ?? "[]");

/** Returns the reframed task, or null if it was queued offline. */
export async function capture(text: string): Promise<Task | null> {
  try {
    return await req<Task>("/tasks/capture", { method: "POST", body: { text } });
  } catch (e) {
    if (e instanceof HttpError) throw e; // server said no; anything else = unreachable, keep it for later
    localStorage.setItem(QUEUE, JSON.stringify([...readQueue(), text]));
    return null;
  }
}

export async function flushQueue(): Promise<void> {
  const queued = readQueue();
  let sent = 0;
  for (const text of queued) {
    try {
      await req("/tasks/capture", { method: "POST", body: { text } });
      sent++;
    } catch {
      break;
    }
  }
  localStorage.setItem(QUEUE, JSON.stringify(queued.slice(sent)));
}

export const api = {
  me: () => req<Me>("/me"),
  onboard: (body: { display_name?: string; timezone: string; accept_disclaimer: boolean }) =>
    req("/me/onboarding", { method: "POST", body }),
  tasks: (energy?: number) => req<Task[]>("/tasks" + (energy ? `?energy=${energy}` : "")),
  resurface: () => req<Task[]>("/tasks/resurface"),
  reframe: (id: string) => req<Task>(`/tasks/${id}/reframe`, { method: "POST" }),
  patch: (id: string, body: { reframe_accepted?: boolean }) => req<Task>(`/tasks/${id}`, { method: "PATCH", body }),
  complete: (id: string, actual_duration?: number) =>
    req<Task>(`/tasks/${id}/complete`, { method: "POST", body: { actual_duration } }),
  startSession: (task_id?: string, type: "manual" | "crisis_sprint" = "manual") =>
    req<{ id: string; guardrail_after_minutes: number }>("/focus-sessions/start", { method: "POST", body: { task_id, type } }),
  endSession: (id: string) => req(`/focus-sessions/${id}/end`, { method: "POST" }),
  guardrailAck: (id: string, kind: "hydration" | "movement" | "meal") =>
    req(`/focus-sessions/${id}/guardrail-ack`, { method: "POST", body: { kind } }),
  logEnergy: (energy_level: number) => req("/energy-logs", { method: "POST", body: { energy_level } }),
  insights: () => req<Insights>("/insights/weekly"),
  setPreferences: (body: Partial<Preferences>) => req<Preferences>("/me/preferences", { method: "PATCH", body }),
  ideas: () => req<Idea[]>("/ideas"),
  addIdea: (text: string) => req<Idea>("/ideas", { method: "POST", body: { text } }),
  archiveIdea: (id: string) => req(`/ideas/${id}`, { method: "DELETE" }),
  promoteIdea: (id: string) => req<Task>(`/ideas/${id}/promote`, { method: "POST" }),
  reflection: () => req<{ week_start: string; text: string }>("/insights/reflection"),
  exportData: () => req<unknown>("/me/export"),
  deleteAccount: () => req("/me", { method: "DELETE" }),
};
