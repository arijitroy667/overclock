"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useState } from "react";

import { api } from "@/lib/api";

export default function Settings() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [disclaimer, setDisclaimer] = useState("");
  const [confirm, setConfirm] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.me().then((me) => setDisclaimer(me.disclaimer)).catch(() => {}); }, []);

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

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </section>
  );
}
