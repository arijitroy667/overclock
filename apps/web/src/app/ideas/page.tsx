"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import { api, type Idea } from "@/lib/api";

export default function Ideas() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [text, setText] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const load = () => api.ideas().then(setIdeas).catch(() => {});
  useEffect(() => { load(); }, []);

  async function add(e: FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    setText("");
    try {
      setIdeas([await api.addIdea(value), ...ideas]);
    } catch (err) {
      setText(value);
      setNote((err as Error).message);
    }
  }

  async function run(fn: () => Promise<unknown>, said: string) {
    try {
      await fn();
      setNote(said);
      load();
    } catch (err) {
      setNote((err as Error).message);
    }
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4 md:p-8">
      <Link href="/" className="text-sm text-muted underline">← Back</Link>
      <h1 className="text-2xl font-bold">Idea vault</h1>
      <p className="text-sm text-muted">
        Somewhere to park the thoughts that show up mid-task. Nothing here nags you, and nothing here counts against you.
      </p>

      <form onSubmit={add} className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Park an idea…"
          aria-label="Park an idea"
          className="min-h-12 flex-1 rounded-xl border border-border bg-card px-4 outline-none focus:border-accent"
        />
        <button className="min-h-12 rounded-xl bg-accent px-5 font-semibold text-accent-text">Park it</button>
      </form>
      {note && <p className="text-sm text-muted">{note}</p>}

      {ideas.length === 0 && <p className="text-sm text-muted">Empty for now. That is a perfectly good state.</p>}
      {ideas.map((idea) => (
        <div key={idea.id} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
          <p>{idea.text}</p>
          <p className="text-sm text-muted">{new Date(idea.created_at).toLocaleDateString()}</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => run(() => api.promoteIdea(idea.id), "Added to your tasks.")} className="min-h-11 rounded-xl bg-soft px-4">
              Make it a task
            </button>
            <button onClick={() => run(() => api.archiveIdea(idea.id), "Tucked away.")} className="min-h-11 rounded-xl px-4 text-muted underline">
              Let it go
            </button>
          </div>
        </div>
      ))}
    </main>
  );
}
