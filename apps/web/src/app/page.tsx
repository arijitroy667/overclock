"use client";

import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, ReactNode, useCallback, useEffect, useState } from "react";

import { api, capture, flushQueue, isReframing, type Insights, type Me, type Task } from "@/lib/api";

const ENERGY = ["Running on fumes", "Low", "Okay", "Good", "Charged up"];

export default function Dashboard() {
  const [me, setMe] = useState<Me | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    api.me().then(setMe).catch(() => setOffline(true));
    flushQueue().catch(() => {});
    window.addEventListener("online", flushQueue);
    return () => window.removeEventListener("online", flushQueue);
  }, []);

  return (
    <main className="mx-auto max-w-5xl p-4 md:p-8">
      <header className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Overclock</h1>
        <div className="flex items-center gap-3">
          {offline && <p className="text-sm text-muted">Can’t reach the server. Captures still save.</p>}
          <Link href="/ideas" className="text-sm text-muted underline">Ideas</Link>
          <Link href="/settings" className="text-sm text-muted underline">Settings</Link>
          <UserButton />
        </div>
      </header>
      {me && !me.onboarded ? <Onboarding me={me} onDone={() => setMe({ ...me, onboarded: true })} /> : <Home />}
    </main>
  );
}

function Home() {
  const [energy, setEnergy] = useState<number | undefined>();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [resurfaced, setResurfaced] = useState<Task[]>([]);
  const [insights, setInsights] = useState<Insights | null>(null);

  const load = useCallback(() => {
    api.tasks(energy).then(setTasks).catch(() => {});
    api.insights().then(setInsights).catch(() => {});
  }, [energy]);
  useEffect(load, [load]);
  useEffect(() => { api.resurface().then(setResurfaced).catch(() => {}); }, []);

  function afterCapture() {
    load();
    [4000, 10000].forEach((ms) => setTimeout(load, ms)); // pick up the background reframe
  }

  async function pickEnergy(level: number) {
    await api.logEnergy(level).catch(() => {});
    setEnergy(level);
  }

  const resurfacedIds = new Set(resurfaced.map((r) => r.id));
  return (
    <div className="grid gap-6 md:grid-cols-[1fr_300px]">
      <section className="flex flex-col gap-4">
        <Capture onCaptured={afterCapture} />
        <Card>
          <p className="text-sm text-muted">How’s your energy? We’ll show what fits.</p>
          <div className="flex flex-wrap gap-2">
            {ENERGY.map((label, i) => (
              <button
                key={label}
                onClick={() => pickEnergy(i + 1)}
                className={`min-h-11 rounded-xl px-3 text-sm font-medium ${energy === i + 1 ? "bg-accent text-accent-text" : "bg-soft"}`}
              >
                {i + 1} · {label}
              </button>
            ))}
            {energy && <button onClick={() => setEnergy(undefined)} className="min-h-11 px-3 text-sm text-muted underline">Show everything</button>}
          </div>
        </Card>
        {resurfaced.length > 0 && <h2 className="text-lg font-semibold">From a few days ago</h2>}
        {resurfaced.map((t) => <TaskCard key={t.id} task={t} onChange={load} />)}
        {tasks.some((t) => !resurfacedIds.has(t.id)) && <h2 className="text-lg font-semibold">Up next</h2>}
        {tasks.filter((t) => !resurfacedIds.has(t.id)).map((t) => <TaskCard key={t.id} task={t} onChange={load} />)}
      </section>
      <aside>{insights && <InsightsPanel data={insights} />}</aside>
    </div>
  );
}

function Capture({ onCaptured }: { onCaptured: () => void }) {
  const [text, setText] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    setBusy(true);
    setText("");
    try {
      const task = await capture(value);
      setNote(task ? null : "Saved in this browser. It’ll sync when you’re back online.");
      onCaptured();
    } catch (err) {
      setText(value); // never drop what they typed
      setNote((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label htmlFor="capture" className="text-xl font-semibold">What’s on your mind?</label>
      <div className="flex gap-2">
        <input
          id="capture"
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Dump it here. We’ll make it easier to start."
          className="min-h-12 flex-1 rounded-xl border border-border bg-card px-4 outline-none focus:border-accent"
        />
        <button disabled={busy} className="min-h-12 rounded-xl bg-accent px-5 font-semibold text-accent-text disabled:opacity-50">
          {busy ? "…" : "Add"}
        </button>
      </div>
      {note && <p className="text-sm text-muted">{note}</p>}
    </form>
  );
}

function TaskCard({ task, onChange }: { task: Task; onChange: () => void }) {
  const router = useRouter();
  const [showOriginal, setShowOriginal] = useState(false);
  const [busy, setBusy] = useState(false);
  const reframed = !!task.reframed_title;

  async function start() {
    if (reframed) await api.patch(task.id, { reframe_accepted: true }).catch(() => {});
    const params = new URLSearchParams({
      id: task.id,
      title: task.reframed_title ?? task.raw_input_text,
      minutes: String(task.estimated_duration_padded ?? 25),
    });
    router.push(`/focus?${params}`);
  }

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try { await fn(); onChange(); } finally { setBusy(false); }
  }

  const meta = [task.estimated_duration_padded && `~${task.estimated_duration_padded} min`, task.due_at && `due ${new Date(task.due_at).toLocaleDateString()}`]
    .filter(Boolean).join(" · ");
  return (
    <Card>
      <h3 className="text-lg font-semibold">{showOriginal || !reframed ? task.raw_input_text : task.reframed_title}</h3>
      {task.first_step && <p>First step: {task.first_step}</p>}
      {isReframing(task) && <p className="text-sm text-muted">Finding a better angle…</p>}
      {meta && <p className="text-sm text-muted">{meta}</p>}
      <div className="flex flex-wrap gap-2">
        <button onClick={start} className="min-h-11 rounded-xl bg-accent px-5 font-semibold text-accent-text">Start</button>
        <button disabled={busy} onClick={() => run(() => api.reframe(task.id))} className="min-h-11 rounded-xl bg-soft px-4 disabled:opacity-50">Another angle</button>
        <button disabled={busy} onClick={() => run(() => api.complete(task.id))} className="min-h-11 rounded-xl bg-soft px-4 disabled:opacity-50">Done</button>
        {reframed && (
          <button onClick={() => setShowOriginal(!showOriginal)} className="px-2 text-sm text-muted underline">
            {showOriginal ? "Show reframed" : "Show what I wrote"}
          </button>
        )}
      </div>
    </Card>
  );
}

function InsightsPanel({ data }: { data: Insights }) {
  const energy = Object.entries(data.energy_by_day);
  const [reflection, setReflection] = useState<string | null>(null);

  useEffect(() => { api.reflection().then((r) => setReflection(r.text)).catch(() => {}); }, []);

  return (
    <div className="flex flex-col gap-4">
      {reflection && (
        <Card>
          <h2 className="font-semibold">Your week, in words</h2>
          <p className="text-sm">{reflection}</p>
        </Card>
      )}
      <Card>
        <h2 className="font-semibold">Showed up {data.days_active_this_week} of the last 7 days</h2>
        <p className="text-sm text-muted">{data.days_active_total} days total. Gaps don’t reset anything.</p>
      </Card>
      <Card>
        <h2 className="font-semibold">Level {data.level} · {data.xp} XP</h2>
        <div className="h-2.5 overflow-hidden rounded-full bg-soft">
          <div className="h-full bg-accent" style={{ width: `${(data.xp_today / data.xp_daily_cap) * 100}%` }} />
        </div>
        <p className="text-sm text-muted">
          {data.xp_today >= data.xp_daily_cap ? "Today’s XP is full. That’s a real finish line." : `${data.xp_today} / ${data.xp_daily_cap} XP today`}
        </p>
      </Card>
      <Card>
        <h2 className="font-semibold">Finished this week</h2>
        <p>{data.completion_rate === null ? "Nothing captured yet" : `${Math.round(data.completion_rate * 100)}% of what you captured`}</p>
      </Card>
      {data.crisis_overuse && (
        <Card>
          <h2 className="font-semibold">Crunch mode has been on a lot</h2>
          <p className="text-sm text-muted">
            {data.crisis_sprints_14d} sprints in two weeks. It works, and living there is tiring. Worth asking what keeps
            landing at the last minute.
          </p>
        </Card>
      )}
      {energy.length > 0 && (
        <Card>
          <h2 className="font-semibold">Energy</h2>
          <div className="flex h-24 items-end gap-2" role="img" aria-label={energy.map(([d, v]) => `${d}: ${v} of 5`).join(", ")}>
            {energy.map(([day, avg]) => (
              <div key={day} className="flex flex-1 flex-col items-center gap-1">
                <div className="w-3/4 rounded-md bg-accent" style={{ height: `${(avg / 5) * 72}px` }} />
                <span className="text-xs text-muted">{new Date(day).toLocaleDateString(undefined, { weekday: "short" })}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function Onboarding({ me, onDone }: { me: Me; onDone: () => void }) {
  const [name, setName] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finish() {
    try {
      await api.onboard({
        display_name: name.trim() || undefined,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        accept_disclaimer: accepted,
      });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <h2 className="text-2xl font-bold">Welcome to Overclock</h2>
      <p>Tools built around how an ADHD brain actually runs: capture fast, start small, let the app hold the clock.</p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="What should we call you? (optional)"
        className="min-h-12 rounded-xl border border-border bg-card px-4"
      />
      <Card>
        <h3 className="font-semibold">Before you start</h3>
        <p>{me.disclaimer}</p>
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="size-5" />
          I understand
        </label>
      </Card>
      {error && <p className="text-sm text-muted">{error}</p>}
      <button disabled={!accepted} onClick={finish} className="min-h-12 rounded-xl bg-accent font-semibold text-accent-text disabled:opacity-50">
        Let’s go
      </button>
    </div>
  );
}

function Card({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">{children}</div>;
}
