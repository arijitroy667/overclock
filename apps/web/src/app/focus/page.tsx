"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import { api } from "@/lib/api";

const WARNINGS_MIN = [15, 10, 5]; // §7 Pillar 2 default pre-warnings
const GUARDRAIL_REPEAT_MIN = 30;

export default function FocusPage() {
  return <Suspense><Focus /></Suspense>;
}

// ponytail: browser Notification + setTimeout only fire while this tab is open; web push when the scheduler lands.
function notify(title: string, body: string) {
  if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification(title, { body });
}

function Focus() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id") ?? undefined;
  const title = params.get("title") ?? "Focus";
  const total = Number(params.get("minutes")) || 25;

  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [guardrailAt, setGuardrailAt] = useState(120);
  const [inFlow, setInFlow] = useState(false);
  const inFlowRef = useRef(false);
  const sessionStarted = useRef(false);

  useEffect(() => {
    if (sessionStarted.current) return; // Strict Mode runs effects twice in dev; start exactly one session
    sessionStarted.current = true;
    api.startSession(id).then((s) => {
      setSessionId(s.id);
      setGuardrailAt(s.guardrail_after_minutes);
    }).catch(() => {});
  }, [id]);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const timers: number[] = [];
    const at = (min: number, fn: () => void) => timers.push(window.setTimeout(fn, min * 60_000));

    if (typeof Notification !== "undefined" && Notification.permission === "default") Notification.requestPermission();

    // Transition nudges are skipped once in flow; the body-check overlay always shows.
    WARNINGS_MIN.filter((w) => w < total).forEach((w) => at(total - w, () => !inFlowRef.current && notify(`${w} minutes left`, title)));
    at(total, () => !inFlowRef.current && notify("Time’s up", "Wrap up or keep going. Your call."));

    return () => {
      clearInterval(tick);
      timers.forEach(clearTimeout);
    };
  }, [id, title, total]);

  const elapsedMin = (now - startedAt) / 60000;
  const remaining = total - elapsedMin;
  const fraction = Math.max(0, remaining / total);
  const mm = Math.floor(Math.abs(remaining));
  const ss = Math.floor((Math.abs(remaining) * 60) % 60).toString().padStart(2, "0");
  const guardrailDue = elapsedMin >= guardrailAt;

  useEffect(() => {
    if (guardrailDue) notify("Quick body check", "Water, stretch, food? Your work will wait a minute.");
  }, [guardrailDue]);

  async function ack(kind: "hydration" | "movement" | "meal") {
    if (sessionId) await api.guardrailAck(sessionId, kind).catch(() => {});
    setGuardrailAt(elapsedMin + GUARDRAIL_REPEAT_MIN);
  }

  async function leave(done: boolean) {
    if (sessionId) await api.endSession(sessionId).catch(() => {});
    if (done && id) await api.complete(id, Math.max(1, Math.round(elapsedMin))).catch(() => {});
    router.push("/");
  }

  const R = 110;
  const C = 2 * Math.PI * R;
  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-4 p-6 text-center">
      <p className="text-sm text-muted">{inFlow ? "Protected: nudges paused, body checks still on" : "Focus"}</p>
      <h1 className="text-2xl font-bold">{title}</h1>
      <div className="relative my-4 grid place-items-center">
        <svg width={260} height={260} role="img" aria-label={`${mm} minutes ${remaining > 0 ? "left" : "over"}`}>
          <circle cx={130} cy={130} r={R} stroke="var(--soft)" strokeWidth={18} fill="none" />
          <circle
            cx={130} cy={130} r={R} stroke={remaining > 0 ? "var(--accent)" : "var(--warm)"} strokeWidth={18} fill="none"
            strokeDasharray={`${C * fraction} ${C}`} strokeLinecap="round" transform="rotate(-90 130 130)"
          />
        </svg>
        <div className="absolute">
          <div className="text-5xl font-bold tabular-nums">{remaining < 0 ? "+" : ""}{mm}:{ss}</div>
          <div className="text-sm text-muted">{remaining > 0 ? "left" : "over. No rush"}</div>
        </div>
      </div>
      {!inFlow && (
        <button onClick={() => { inFlowRef.current = true; setInFlow(true); }} className="min-h-12 w-full rounded-xl bg-soft font-medium">
          I’m in flow
        </button>
      )}
      <button onClick={() => leave(true)} className="min-h-12 w-full rounded-xl bg-accent font-semibold text-accent-text">Done</button>
      <button onClick={() => leave(false)} className="min-h-12 w-full rounded-xl bg-soft font-medium">Step away (it’ll be here)</button>

      {guardrailDue && (
        <div role="dialog" aria-modal="true" aria-labelledby="bodycheck" className="fixed inset-0 grid place-items-center bg-bg p-6">
          <div className="flex max-w-md flex-col gap-3">
            <h2 id="bodycheck" className="text-2xl font-bold">Quick body check</h2>
            <p>You’ve been deep in this for {Math.round(elapsedMin)} minutes. Nice. Take one small thing for your body, then dive back in.</p>
            <button onClick={() => ack("hydration")} className="min-h-12 rounded-xl bg-soft">Drank some water</button>
            <button onClick={() => ack("movement")} className="min-h-12 rounded-xl bg-soft">Stood up and stretched</button>
            <button onClick={() => ack("meal")} className="min-h-12 rounded-xl bg-soft">Grabbed food</button>
          </div>
        </div>
      )}
    </main>
  );
}
