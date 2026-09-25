"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useState } from "react";

import { api, type Preferences } from "@/lib/api";
import { applyPrefs, cachedPrefs, DEFAULT_PREFS } from "@/lib/prefs";
import { currentSubscription, pushSupported, subscribe, unsubscribe } from "@/lib/push";

const REMINDER_PRESETS = [[15, 10, 5], [30, 15, 5], [10, 5], [5]];

export default function Settings() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [disclaimer, setDisclaimer] = useState("");
  const [confirm, setConfirm] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);

  const [pushOn, setPushOn] = useState(false);
  const [canPush, setCanPush] = useState(false);

  useEffect(() => {
    setCanPush(pushSupported());
    currentSubscription().then((s) => setPushOn(!!s)).catch(() => {});
  }, []);

  async function togglePush(on: boolean) {
    setPushOn(on);
    try {
      await (on ? subscribe() : unsubscribe());
    } catch (e) {
      setPushOn(!on);
      setNote((e as Error).message);
    }
  }

  useEffect(() => {
    setPrefs(cachedPrefs()); // browser-only; server render uses defaults
    api.me().then((me) => { setDisclaimer(me.disclaimer); setPrefs(me.preferences); }).catch(() => {});
  }, []);

  async function update(change: Partial<Preferences>) {
    const optimistic = { ...prefs, ...change };
    setPrefs(optimistic);
    applyPrefs(optimistic);
    try {
      applyPrefs(await api.setPreferences(change));
    } catch (e) {
      setNote(`Couldn’t save that: ${(e as Error).message}`);
    }
  }

  async function exportData() {
    try {
      const data = await api.exportData();
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const a = Object.assign(document.createElement("a"), { href: url, download: `overclock-export-${new Date().toISOString().slice(0, 10)}.json` });
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setNote((e as Error).message);
    }
  }

  async function deleteAccount() {
    setBusy(true);
    try {
      await api.deleteAccount(); // Overclock data first, so nothing is orphaned if the next step fails
      await user?.delete();
      await signOut({ redirectUrl: "/sign-in" });
    } catch (e) {
      setNote(`Your Overclock data is deleted, but removing the sign-in failed: ${(e as Error).message}`);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-4 md:p-8">
      <Link href="/" className="text-sm text-muted underline">← Back</Link>
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card title="What Overclock is (and isn’t)">
        <p>{disclaimer}</p>
        <p className="text-sm text-muted">If things feel heavier than a tool can help with, please reach out to a doctor or a mental health professional.</p>
      </Card>

      <Card title="Comfort">
        <Toggle label="Calm mode" hint="Quieter colors, no motion. Handy when everything feels like a lot." checked={prefs.calm_mode} onChange={(v) => update({ calm_mode: v })} />
        <Toggle label="Easier-to-read font" hint="Lexend, with a little more spacing." checked={prefs.dyslexia_font} onChange={(v) => update({ dyslexia_font: v })} />
      </Card>

      <Card title="Reminders on this device">
        {canPush ? (
          <Toggle
            label="Send reminders even when Overclock is closed"
            hint="Uses your browser's notifications. On iPhone, add Overclock to your Home Screen first."
            checked={pushOn}
            onChange={togglePush}
          />
        ) : (
          <p className="text-sm text-muted">This browser can’t receive notifications. Timers still work while the tab is open.</p>
        )}
      </Card>

      <Card title="Heads-up before time runs out">
        <div className="flex flex-wrap gap-2">
          {REMINDER_PRESETS.map((preset) => {
            const active = preset.join() === prefs.reminder_offsets.join();
            return (
              <button
                key={preset.join()}
                onClick={() => update({ reminder_offsets: preset })}
                aria-pressed={active}
                className={`min-h-11 rounded-xl px-3 text-sm font-medium ${active ? "bg-accent text-accent-text" : "bg-soft"}`}
              >
                {preset.join(" · ")} min
              </button>
            );
          })}
        </div>
      </Card>

      <Card title="Your data">
        <p className="text-sm text-muted">Everything you’ve captured, logged and finished, as a JSON file.</p>
        <button onClick={exportData} className="min-h-11 self-start rounded-xl bg-soft px-4 font-medium">Download my data</button>
      </Card>

      <Card title="Delete account">
        <p className="text-sm text-muted">Permanently removes your tasks, sessions, energy logs and sign-in. This can’t be undone.</p>
        <label className="text-sm" htmlFor="confirm">Type <b>delete</b> to confirm</label>
        <input id="confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="min-h-11 rounded-xl border border-border bg-card px-3" />
        <button
          disabled={confirm.trim().toLowerCase() !== "delete" || busy}
          onClick={deleteAccount}
          className="min-h-11 self-start rounded-xl bg-text px-4 font-medium text-bg disabled:opacity-40"
        >
          {busy ? "Deleting…" : "Delete my account"}
        </button>
      </Card>

      {note && <p className="text-sm text-muted">{note}</p>}
    </main>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 size-5 accent-[var(--accent)]" />
      <span>
        <span className="font-medium">{label}</span>
        <span className="block text-sm text-muted">{hint}</span>
      </span>
    </label>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </section>
  );
}
