import Link from "next/link";

const PILLARS = [
  ["Capture anything, instantly", "Type it or say it. It saves before anything else happens, even offline."],
  ["Tasks rewritten so they start", "Every task gets a first step you can do in two minutes, framed the way that works for your brain."],
  ["The app holds the clock", "Padded estimates from your own history, a visible countdown, and reminders that reach you with the app closed."],
  ["Flow, protected", "Long uninterrupted stretches are noticed and shielded — with body checks that don't let you skip water and food."],
  ["Energy, not willpower", "Check in with how you feel and see the tasks that fit right now."],
  ["Nothing to lose by stopping", "Gaps never reset anything. Daily progress has a finish line, so there's no reason to grind."],
];

export default function Welcome() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-10 p-6 md:p-12">
      <header className="flex flex-col gap-4">
        <h1 className="text-4xl font-bold tracking-tight">Overclock</h1>
        <p className="text-xl">Run your ADHD brain at its actual clock speed.</p>
        <p className="text-muted">
          ADHD motivation is interest-based: a task has to feel interesting, novel, challenging, playful or urgent
          before it starts. Overclock puts that in writing for every task you capture, holds the time you can’t feel,
          and remembers what you were about to forget.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/sign-in" className="grid min-h-12 place-items-center rounded-xl bg-accent px-6 font-semibold text-accent-text">
            Sign in
          </Link>
          <Link href="/sign-in" className="grid min-h-12 place-items-center rounded-xl bg-soft px-6 font-medium">
            Create an account
          </Link>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        {PILLARS.map(([title, body]) => (
          <div key={title} className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-4">
            <h2 className="font-semibold">{title}</h2>
            <p className="text-sm text-muted">{body}</p>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
        <h2 className="font-semibold">What Overclock isn’t</h2>
        <p className="text-sm text-muted">
          Not a medical device. It doesn’t diagnose, treat or cure ADHD, and it isn’t a substitute for professional
          care. There are no streaks to lose, no guilt notifications and no endless feed — this is a tool you should be
          able to put down.
        </p>
      </section>
    </main>
  );
}
