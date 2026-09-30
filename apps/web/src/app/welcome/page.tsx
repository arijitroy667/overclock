import Link from "next/link";

const WHY = [
  {
    tag: "Interest, not importance",
    body: "ADHD motivation is interest-based. A task has to feel interesting, novel, challenging, playful or urgent before it starts — willpower alone doesn't reliably produce action.",
  },
  {
    tag: "Time blindness",
    body: "Time exists in two states: now, and not now. Deadlines don't feel real until they're on top of you, and every task takes longer than it looked.",
  },
  {
    tag: "A leaky bucket",
    body: "What isn't written down in the moment is gone. Anything that depends on remembering to check it will quietly stop working.",
  },
];

const STEPS = [
  { n: "01", title: "Dump it", body: "Type it or say it. It saves before anything else happens — offline too. One second, no forms, no categories." },
  { n: "02", title: "Get it rewritten", body: "The task comes back with a first step you can do in two minutes, framed the way that actually gets you moving." },
  { n: "03", title: "Let the app hold the clock", body: "Padded estimates from your own history, a countdown you can see, and nudges that reach you with the app shut." },
];

const FEATURES = [
  { title: "Task Alchemy", body: "Five ways to make a task startable — play, challenge, novelty, urgency, interest. It learns which one works on you.", accent: "bg-acid" },
  { title: "Hyperfocus Guardian", body: "Deep sessions get protected automatically. Water, food and movement checks still get through, because flow won't remind you.", accent: "bg-hot" },
  { title: "Energy matching", body: "Say how you feel; see only the work that fits it. Low-energy days get admin, not architecture.", accent: "bg-accent" },
  { title: "Focus Rooms", body: "Body doubling without the camera. See that other people are working right now, say nothing, get on with it.", accent: "bg-acid" },
  { title: "Idea Vault", body: "Somewhere to park the thought that just derailed you, so it stops circling and doesn't become another obligation.", accent: "bg-hot" },
  { title: "Crunch mode", body: "For real deadlines: one task, no side doors — plus an honest word if crunch stops being occasional.", accent: "bg-accent" },
];

export default function Welcome() {
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-24 p-4 pb-24 md:p-8">
      <nav className="nb sticky top-4 z-10 flex items-center justify-between gap-4 px-4 py-3">
        <span className="text-xl font-extrabold tracking-tight">OVERCLOCK</span>
        <div className="flex items-center gap-2">
          <Link href="#how" className="hidden min-h-11 items-center px-3 font-semibold sm:inline-flex">How it works</Link>
          <Link href="/sign-in" className="nb-btn nb-btn-primary">Start free</Link>
        </div>
      </nav>

      {/* Hero */}
      <header className="flex flex-col gap-8 pt-6 md:pt-16">
        <span className="nb-tag w-fit">ADHD operating system</span>
        <h1 className="max-w-4xl text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-7xl md:text-8xl">
          Run your brain at its <span className="nb-marker">actual</span> clock speed.
        </h1>
        <p className="max-w-2xl text-lg text-muted md:text-xl">
          Overclock isn&apos;t a to-do list with better colours. It rewrites the task until starting it feels
          possible, holds the time you can&apos;t feel, and never once tells you to try harder.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/sign-in" className="nb-btn nb-btn-primary text-lg">Start free →</Link>
          <Link href="#how" className="nb-btn text-lg">See how it works</Link>
        </div>

        {/* The whole product in one picture: what you dump in, what comes back. */}
        <div className="mt-6 grid gap-6 md:grid-cols-[1fr_auto_1fr] md:items-center">
          <div className="nb-flat rotate-[-1deg] p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-muted">What you dump in</p>
            <p className="mt-3 text-xl">&ldquo;sort out the insurance thing before it lapses&rdquo;</p>
          </div>
          <div className="grid h-12 w-12 shrink-0 place-items-center justify-self-center rounded-full border-[3px] border-border bg-acid text-xl font-black text-[#0b0b0f] md:h-14 md:w-14">
            →
          </div>
          <div className="nb rotate-[1deg] p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-muted">What comes back</p>
            <p className="mt-3 text-xl font-bold">10-minute insurance sprint</p>
            <p className="mt-2 text-muted">First step: open the policy email and read only the renewal date.</p>
            <p className="mt-3 flex flex-wrap gap-2">
              <span className="nb-tag">urgency</span>
              <span className="nb-tag" style={{ background: "var(--soft)" }}>~25 min, padded</span>
            </p>
          </div>
        </div>
      </header>

      {/* Why it works this way */}
      <section className="flex flex-col gap-8">
        <h2 className="max-w-3xl text-3xl font-extrabold sm:text-5xl">
          Built for the way the wiring actually works.
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          {WHY.map(({ tag, body }) => (
            <article key={tag} className="nb flex flex-col gap-3 p-6">
              <h3 className="text-xl font-extrabold">{tag}</h3>
              <p className="text-muted">{body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="flex flex-col gap-8 scroll-mt-24">
        <h2 className="text-3xl font-extrabold sm:text-5xl">Three moves, every time.</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {STEPS.map(({ n, title, body }) => (
            <article key={n} className="nb flex flex-col gap-3 p-6">
              <span className="text-5xl font-black text-accent">{n}</span>
              <h3 className="text-2xl font-extrabold">{title}</h3>
              <p className="text-muted">{body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="flex flex-col gap-8">
        <h2 className="text-3xl font-extrabold sm:text-5xl">Everything else it does.</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ title, body, accent }) => (
            <article key={title} className="nb flex flex-col gap-3 p-6">
              <span className={`h-3 w-16 border-2 border-border ${accent}`} />
              <h3 className="text-xl font-extrabold">{title}</h3>
              <p className="text-muted">{body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* The honest bit */}
      <section className="nb flex flex-col gap-4 bg-soft p-8">
        <h2 className="text-3xl font-extrabold sm:text-4xl">What it isn&apos;t.</h2>
        <p className="max-w-3xl text-lg">
          Not a medical device. It doesn&apos;t diagnose, treat or cure ADHD, and it&apos;s no substitute for
          professional care.
        </p>
        <p className="max-w-3xl text-lg">
          There are no streaks to lose, no guilt notifications, no endless feed and nothing designed to keep you
          here. Daily progress has a finish line you can actually reach. Your data exports in one click and
          deletes in two.
        </p>
      </section>

      {/* Close */}
      <section className="flex flex-col items-start gap-6">
        <h2 className="max-w-3xl text-4xl font-extrabold leading-tight sm:text-6xl">
          The task is still there. Let&apos;s make it startable.
        </h2>
        <Link href="/sign-in" className="nb-btn nb-btn-acid text-lg">Start free →</Link>
      </section>

      <footer className="flex flex-col gap-2 border-t-[3px] border-border pt-6 text-sm text-muted">
        <p>Overclock — built by someone with ADHD, for people with ADHD.</p>
        <p>If things feel heavier than a tool can help with, please talk to a doctor or a mental health professional.</p>
      </footer>
    </main>
  );
}
