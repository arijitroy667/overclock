"use client";

import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, ReactNode, useCallback, useEffect, useRef, useState } from "react";

import { api, capture, flushQueue, isReframing, reminderPresets, type Insights, type Me, type Task } from "@/lib/api";
import { dictate, dictationSupported } from "@/lib/dictation";

const ENERGY = ["Running on fumes", "Low", "Okay", "Good", "Charged up"];

const LEVER_WORDS: Record<string, string> = {
  play: "playful framing",
  challenge: "a challenge",
  novelty: "a fresh angle",
  urgency: "a countdown",
  interest: "the interesting part",
};


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
      <header className="nb mb-6 flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <h1 className="text-xl font-extrabold tracking-tight">OVERCLOCK</h1>
        <div className="flex items-center gap-3">
          {offline && <p className="text-sm text-muted">Can’t reach the server. Captures still save.</p>}
          <Link href="/rooms" className="min-h-11 px-2 text-sm font-bold uppercase tracking-wide">Rooms</Link>
          <Link href="/ideas" className="min-h-11 px-2 text-sm font-bold uppercase tracking-wide">Ideas</Link>
          <Link href="/settings" className="min-h-11 px-2 text-sm font-bold uppercase tracking-wide">Settings</Link>
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
                className={`nb-btn px-3 text-sm ${energy === i + 1 ? "nb-btn-primary" : ""}`}
              >
                {i + 1} · {label}
              </button>
            ))}
            {energy && <button onClick={() => setEnergy(undefined)} className="nb-btn px-3 text-sm">Show everything</button>}
          </div>
        </Card>
        {resurfaced.length > 0 && <h2 className="text-lg font-extrabold uppercase tracking-wide">From a few days ago</h2>}
        {resurfaced.map((t) => <TaskCard key={t.id} task={t} onChange={load} />)}
        {tasks.some((t) => !resurfacedIds.has(t.id)) && <h2 className="text-lg font-extrabold uppercase tracking-wide">Up next</h2>}
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
  const [listening, setListening] = useState(false);
  const [canDictate, setCanDictate] = useState(false);
  const recorder = useRef<{ stop: () => void } | null>(null);

  useEffect(() => setCanDictate(dictationSupported()), []);

  function toggleDictation() {
    if (listening) {
      recorder.current?.stop();
      return;
    }
    setListening(true);
    setNote("Listening…");
    recorder.current = dictate((heard) => {
      setListening(false);
      setNote(heard ? null : "Didn’t catch that. Try again, or type it.");
      if (heard) void submitText(heard); // straight in: speaking it should be the whole interaction
    });
  }

  async function submitText(value: string) {
    setBusy(true);
    setText("");
    try {
      const task = await capture(value);
      setNote(task ? null : "Saved in this browser. It’ll sync when you’re back online.");
      onCaptured();
    } catch (err) {
      setText(value); // never drop what they said or typed
      setNote((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (value) await submitText(value);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label htmlFor="capture" className="text-2xl font-extrabold">What’s on your mind?</label>
      <div className="flex gap-2">
        <input
          id="capture"
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Dump it here. We’ll make it easier to start."
          className="nb-input flex-1"
        />
        {canDictate && (
          <button
            type="button"
            onClick={toggleDictation}
            aria-label={listening ? "Stop listening" : "Capture by voice"}
            aria-pressed={listening}
            className={`nb-btn text-lg ${listening ? "nb-btn-primary" : ""}`}
          >
            {listening ? "◼" : "🎙"}
          </button>
        )}
        <button disabled={busy} className="nb-btn nb-btn-primary">
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
  const [picking, setPicking] = useState(false);
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

  const when = task.scheduled_start && new Date(task.scheduled_start);
  const meta = [
    task.estimated_duration_padded && `~${task.estimated_duration_padded} min`,
    when && `reminder ${when.toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}`,
    task.due_at && `due ${new Date(task.due_at).toLocaleDateString()}`,
  ].filter(Boolean).join(" · ");
  return (
    <Card>
      <h3 className="text-xl font-extrabold">{showOriginal || !reframed ? task.raw_input_text : task.reframed_title}</h3>
      {task.first_step && <p>First step: {task.first_step}</p>}
      {isReframing(task) && <p className="text-sm text-muted">Finding a better angle…</p>}
      {meta && <p className="text-sm text-muted">{meta}</p>}
      <div className="flex flex-wrap gap-2">
        <button onClick={start} className="nb-btn nb-btn-primary">Start</button>
        <button disabled={busy} onClick={() => run(() => api.reframe(task.id))} className="nb-btn">Another angle</button>
        <button disabled={busy} onClick={() => run(() => api.complete(task.id))} className="nb-btn nb-btn-acid">Done</button>
        <button onClick={() => setPicking(!picking)} className="nb-btn">Remind me</button>
        {reframed && (
          <button onClick={() => setShowOriginal(!showOriginal)} className="min-h-11 px-2 text-sm text-muted underline">
            {showOriginal ? "Show reframed" : "Show what I wrote"}
          </button>
        )}
      </div>
      {picking && (
        <div className="flex flex-wrap gap-2">
          {reminderPresets().map(({ label, at }) => (
            <button
              key={label}
              disabled={busy}
              onClick={() => { setPicking(false); run(() => api.patch(task.id, { scheduled_start: at.toISOString(), status: "scheduled" })); }}
              className="nb-btn px-4 text-sm"
            >
              {label}
            </button>
          ))}
        </div>
      )}
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
          <h2 className="font-extrabold">Your week, in words</h2>
          <p className="text-sm">{reflection}</p>
        </Card>
      )}
      <Card>
        <h2 className="font-extrabold">Showed up {data.days_active_this_week} of the last 7 days</h2>
        <p className="text-sm text-muted">{data.days_active_total} days total. Gaps don’t reset anything.</p>
      </Card>
      <Card>
        <h2 className="font-extrabold">Level {data.level} · {data.xp} XP</h2>
        <div className="h-4 overflow-hidden border-2 border-border bg-soft">
          <div className="h-full bg-acid" style={{ width: `${(data.xp_today / data.xp_daily_cap) * 100}%` }} />
        </div>
        <p className="text-sm text-muted">
          {data.xp_today >= data.xp_daily_cap ? "Today’s XP is full. That’s a real finish line." : `${data.xp_today} / ${data.xp_daily_cap} XP today`}
        </p>
      </Card>
      <Card>
        <h2 className="font-extrabold">Finished this week</h2>
        <p>{data.completion_rate === null ? "Nothing captured yet" : `${Math.round(data.completion_rate * 100)}% of what you captured`}</p>
      </Card>
      {data.best_lever && (
        <Card>
          <h2 className="font-extrabold">What gets you started</h2>
          <p className="text-sm text-muted">
            {LEVER_WORDS[data.best_lever.lever] ?? data.best_lever.lever} works best so far —
            you started {data.best_lever.started} of {data.best_lever.reframed} tasks framed that way.
            {data.weakest_lever && data.weakest_lever.lever !== data.best_lever.lever &&
              ` ${LEVER_WORDS[data.weakest_lever.lever] ?? data.weakest_lever.lever} lands least often; Overclock leans on it less.`}
          </p>
        </Card>
      )}
      {data.hyperfocus_sessions_14d > 0 && (
        <Card>
          <h2 className="font-extrabold">Flow shows up</h2>
          <p className="text-sm text-muted">
            {data.hyperfocus_sessions_14d} deep sessions in two weeks
            {data.hyperfocus_peak_hour !== null && `, most often around ${data.hyperfocus_peak_hour}:00`}
            {data.hyperfocus_top_category && `, usually on ${data.hyperfocus_top_category.replace("_", " ")} work`}.
          </p>
        </Card>
      )}
      {data.crisis_overuse && (
        <Card>
          <h2 className="font-extrabold">Crunch mode has been on a lot</h2>
          <p className="text-sm text-muted">
            {data.crisis_sprints_14d} sprints in two weeks. It works, and living there is tiring. Worth asking what keeps
            landing at the last minute.
          </p>
        </Card>
      )}
      {energy.length > 0 && (
        <Card>
          <h2 className="font-extrabold">Energy</h2>
          <div className="flex h-24 items-end gap-2" role="img" aria-label={energy.map(([d, v]) => `${d}: ${v} of 5`).join(", ")}>
            {energy.map(([day, avg]) => (
              <div key={day} className="flex flex-1 flex-col items-center gap-1">
                <div className="w-3/4 border-2 border-border bg-accent" style={{ height: `${(avg / 5) * 72}px` }} />
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
      <h2 className="text-3xl font-extrabold">Welcome to Overclock</h2>
      <p>Tools built around how an ADHD brain actually runs: capture fast, start small, let the app hold the clock.</p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="What should we call you? (optional)"
        className="nb-input"
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
      <button disabled={!accepted} onClick={finish} className="nb-btn nb-btn-primary">
        Let’s go
      </button>
    </div>
  );
}

function Card({ children }: { children: ReactNode }) {
  return <div className="nb flex flex-col gap-2 p-4">{children}</div>;
}
