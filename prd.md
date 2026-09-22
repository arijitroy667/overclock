# Overclock — Product Requirements Document

**Tagline:** Run your ADHD brain at its actual clock speed.

| | |
|---|---|
| **Author** | Arijit "Ariz" Roy |
| **Doc status** | Draft v1.0 — ready for build |
| **Date** | September 22, 2026 |
| **Intended reader** | Claude Code (implementation agent) and Ariz (product owner) |
| **Doc type** | Full-scope PRD — Phase 1 (MVP) is build-ready; Phases 2–3 are the roadmap |

---

## 0. How to read this document

This PRD is written to be handed directly to Claude Code as the starting context for a new repository. It is intentionally long because it front-loads the *why* (clinical research, competitive gaps, design philosophy) before the *what* (features, data model, API surface) and the *how* (stack, infra, phased build plan). Section 15 ("Phase 1 — MVP Build Spec") is the actionable slice — if you only implement one section first, implement that one. Everything before it is the reasoning that justifies every feature decision; everything after it is the long-term roadmap so early architecture choices don't paint the product into a corner.

---

## 1. Executive Summary

**Overclock is a personal operating system for the ADHD brain** — a mobile app + companion web dashboard that treats ADHD not as a deficit to be managed into neurotypical compliance, but as a different operating profile that needs different infrastructure. It externalizes the executive functions ADHD brains systematically underperform at (time sense, working memory, task initiation, emotional regulation) while deliberately engineering the conditions — interest, novelty, urgency, challenge, social presence — that make the ADHD brain's genuine advantages (hyperfocus, divergent thinking, crisis performance, rapid pattern-matching) switch on reliably instead of randomly.

The product is built and used by someone who has ADHD, for people who have ADHD. It is not a meditation app with ADHD branding, not a generic to-do list with a colorful skin, and not a clinical treatment device. It is infrastructure.

---

## 2. Problem Statement

### 2.1 What ADHD actually is

Attention-Deficit/Hyperactivity Disorder is a neurodevelopmental condition, not a personality trait or a motivation problem. Under DSM-5 criteria, diagnosis requires five or more symptoms (for adults) from either or both of two clusters — **inattentive** (difficulty sustaining focus, poor organization, losing items, forgetfulness, avoidance of sustained-focus tasks) and **hyperactive/impulsive** (restlessness, interrupting, difficulty waiting, excessive talking) — present before age 12, persisting at least six months, and impairing functioning in two or more settings (school/work, home, social) ([ADDA, DSM-5 Criteria](https://add.org/adhd-dsm-5-criteria/)). Three subtypes exist: predominantly inattentive, predominantly hyperactive-impulsive, and combined.

It is common and under-recognized in adults. In the US, roughly 6.0% of adults (~15.5 million people, about 1 in 16) currently have ADHD, up from 4.4% in the DSM-IV era — and notably, 55.9% of diagnosed adults were first diagnosed *as adults*, not as children, reflecting how much adult ADHD historically went unrecognized ([2026 ADHD Prevalence Report](https://nfil.net/blog/prevalence-of-adhd-2026-report-on-trends-adult-persistence-and-diagnostic-criteria-effects/)).

Neurologically, ADHD is associated with dysregulated dopaminergic signaling and altered connectivity between the brain's default mode network (the "mind-wandering" network) and task-positive/executive circuits — meaning the switch that should suppress mind-wandering when a task starts doesn't reliably flip ([Silberstein et al., *Brain and Behavior*, 2016](https://onlinelibrary.wiley.com/doi/full/10.1002/brb3.582)). Reduced frontal-striatal activity — the same circuitry that handles timing, planning, and impulse control — also explains why tasks without an immediate reward often don't register as urgent or even real until the deadline is emotionally "now" ([Simply Psychology, ADHD Time Blindness Guide, 2026](https://www.simplypsychology.com/articles/adhd-time-blindness-guide)).

The single most load-bearing concept for this product is the **interest-based nervous system**, a term coined by Dr. William Dodson: neurotypical motivation is *importance*-based (you can make yourself do a boring task because it matters), while ADHD motivation is *interest*-based — the task itself has to trigger engagement, or willpower alone won't reliably produce action. The five things that reliably trigger ADHD engagement are summarized by the acronym **PINCH**: **P**assion/Play, **I**nterest, **N**ovelty, **C**hallenge/competition, and **H**urry/urgency ([Neurodivergent Insights, Interest-Based Nervous System](https://neurodivergentinsights.com/interest-based-nervous-system/)). Every core mechanic in this product is, at root, an engine for injecting PINCH into tasks that don't naturally have it.

### 2.2 The disadvantage stack (what has to be minimized)

Executive function is not one skill — it is at least six, and ADHD impairs several simultaneously ([Simply Psychology, Executive Dysfunction in Daily Life](https://www.simplypsychology.com/articles/adhd-executive-dysfunction-daily-life)):

| Executive function | What breaks | Daily symptom |
|---|---|---|
| Working memory | Information doesn't stick — "a leaky bucket" | Forgetting instructions seconds after hearing them; walking into a room and forgetting why |
| Inhibitory control | Trouble suppressing automatic responses / resisting distraction | Getting pulled off-task by any higher-stimulation input |
| Cognitive flexibility | Hard to shift between tasks or mental frames | Painful transitions between activities; task-switching cost is much higher than for neurotypical brains |
| Planning & organization | Goals don't decompose into ordered steps | Large projects trigger overwhelm/paralysis instead of a plan; physical and digital clutter accumulates because there's no self-sustaining system |
| Emotional regulation | Reactions to frustration are harder to modulate | Disproportionate frustration response to small setbacks; this is the root of **Rejection Sensitive Dysphoria (RSD)** — an intense, often physically painful emotional reaction to perceived criticism or failure |
| Time perception ("time blindness") | No intuitive sense of duration or elapsed time | Systematic underestimation of task length; deadlines feel unreal until they're imminent; time exists in only two states, "now" and "not now" |

These are not character flaws and the product must never frame them that way — but they are the specific, nameable failure modes the product has to engineer around.

### 2.3 The advantage stack (what has to be maximized)

The same neurology that produces the disadvantage stack produces a real advantage stack, when the environment is right ([Simply Psychology, How to Use ADHD to Your Advantage](https://www.simplypsychology.org/how-to-use-adhd-to-your-advantage.html)):

- **Hyperfocus** — prolonged, effortless-feeling intense concentration, especially on high-interest or high-novelty work (coding, creative work, crisis problem-solving).
- **Divergent thinking / creativity** — a documented tendency toward unusual idea combinations and rapid associative leaps (Dr. Edward Hallowell describes it as "an intense itch to create, strive, and act").
- **Crisis performance** — ADHD traits (urgency-sensitivity, rapid iteration, comfort with ambiguity) can make ADHD brains disproportionately effective in fast-moving, high-stakes, deadline-driven environments, precisely because urgency is one of the five PINCH triggers.
- **Resilience and adaptability** — a lifetime of building workarounds for a world designed for a different operating system tends to build real problem-solving range and grit.
- **High energy and rapid decision-making** — useful for bold experimentation, especially in build-fast domains like early-stage products and prototyping.

The strategic insight the whole product is built on: **the advantage stack and the disadvantage stack are not separate systems — they are the same system (an interest-driven, dopamine-sensitive attention engine) viewed under two different conditions.** Under the wrong conditions (boring, ambiguous, no urgency, unstructured) it produces the disadvantage stack. Under the right conditions (interesting, novel, structured externally, urgent or gamified) the *same* system produces the advantage stack. The product's job is not to suppress the ADHD brain — it's to manufacture the right conditions on demand.

### 2.4 Why existing tools don't solve this

A survey of the current ADHD app landscape (Inflow, Tiimo, Sunsama, Forest, Brain.fm, Freedom, Structured, Time Timer, Brili, EndeavorOTC) shows a consistent pattern: **every tool solves exactly one slice** — Tiimo visualizes schedules, Forest gamifies a Pomodoro timer, Freedom blocks distracting sites, Inflow teaches CBT-based coping skills, Sunsama unifies calendars ([Inflow, Best Apps for ADHD 2026](https://www.getinflow.io/post/best-apps-for-adhd)). None of them combine *externalized time/executive function*, *interest-based task reframing*, *hyperfocus protection*, and *personalization that learns what specifically triggers this individual's PINCH response* into one coherent, adaptive system. The user is left manually stitching together four or five single-purpose apps — which is itself an executive-function-heavy task, i.e., exactly the thing an ADHD brain struggles with. That integration gap is Overclock's opening.

---

## 3. Product Vision & Design Philosophy

**Core thesis:** *Don't fight the interest-based nervous system. Feed it on purpose.*

Six non-negotiable design principles govern every feature decision in this document:

1. **Externalize, don't moralize.** Time blindness, working memory gaps, and task-initiation failure are not solved by reminding the user to "just focus" or "try harder." They're solved by moving the function outside the brain — visible timers, forced re-surfacing of forgotten tasks, pre-built decision trees — the same way a calculator externalizes arithmetic for everyone, ADHD or not.
2. **Interest is an input you can engineer, not a mood you wait for.** Every task the user enters gets run through a reframing layer that injects one or more PINCH elements (novelty, challenge, urgency, play) before it's shown back to them. This is the single most important feature in the product.
3. **Protect hyperfocus; don't interrupt it — but don't worship it either.** Hyperfocus is powerful and also the reason ADHD people skip meals, miss meetings, and burn out. The product actively shields a detected hyperfocus session from *interruptions* while also enforcing hard biological guardrails (hydration, movement, meal breaks) that a person in flow will not self-monitor.
4. **Never shame a broken streak.** RSD means a lost streak or missed day can produce a disproportionate emotional gut-punch that causes total disengagement ("I already failed, why bother"). All progress mechanics must be non-punitive and resumable with zero friction.
5. **Optimize for task completion and time-to-flow, not for time-in-app.** This is a deliberate rejection of the standard consumer-app playbow. An app that makes ADHD-brain engagement its core metric is building a more sophisticated rival for the user's attention, not a solution to attention itself. Success is measured by tasks actually finished and by how quickly the user gets from "I don't want to start" to "I'm in flow" — not by session length or daily opens.
6. **No dark patterns, ever — this population is a documented risk group for compulsive app/game use, and this product is deliberately built around dopamine and novelty triggers.** That combination makes ethical restraint a hard architectural constraint, not a nice-to-have: no infinite scroll, no variable-ratio slot-machine reward schedules, no manufactured urgency about the app itself (only about the user's real tasks), and every gamification loop must have a visible, reachable end state per session (see §10).

---

## 4. What Is the Application? (one-paragraph answer)

Overclock is a cross-platform (iOS/Android + web) personal productivity and self-regulation system purpose-built for people with ADHD. A user captures anything on their mind in one frictionless inbox; an AI reframing layer rewrites vague or boring tasks into interest-triggering, appropriately urgent, right-sized actions; a time-blindness-aware scheduler and multi-stage reminder system replaces the user's unreliable internal clock; a hyperfocus detector protects deep-work sessions while enforcing biological check-ins; an energy/mood layer matches task type to the user's current cognitive state; body-doubling sessions supply the social-presence dopamine boost the research shows helps with task initiation; and a personalization engine learns, over time, exactly which PINCH levers work for *this specific user* and tunes every future interaction accordingly. It is explicitly not a diagnostic tool, not a medication tracker beyond simple optional logging, and not a replacement for clinical care — it is a daily-use cognitive exoskeleton that sits alongside whatever clinical treatment (medication, therapy) the user already has or doesn't have.

---

## 5. Target User

**Primary persona — "Builder Ariz":** A diagnosed-or-self-aware ADHD adult (student, early-career professional, or founder) who is highly capable, has real ambitions, and experiences the classic ADHD paradox: can pull off extraordinary bursts of output under the right conditions, but is inconsistent, loses days to task-initiation failure, and has been told (or has told himself) some version of "if you'd just apply yourself." This person does not need to be convinced ADHD is real — they need tools that work *with* their actual brain instead of tools designed for a neurotypical default.

**Secondary personas:** ADHD students managing coursework deadlines; ADHD knowledge workers managing async, self-directed work (the hardest environment for interest-based motivation, since almost nothing has externally-imposed urgency); newly-diagnosed adults (the 55.9% diagnosed after childhood) still building a personal operating manual for their own brain.

---

## 6. Mechanism: Disadvantage → Countermeasure → Feature

This table is the traceability matrix between the research in §2 and the feature set in §7 — every feature exists because a specific line in this table demands it.

| ADHD trait | Category | Countermeasure / amplifier | Feature(s) |
|---|---|---|---|
| Time blindness | Disadvantage | Make time visually and physically present; pad estimates; anchor to events, not clock time | Time-Anchor Timer, multi-stage transition alerts, auto-padded estimates |
| Working memory gaps | Disadvantage | Capture everything immediately; auto re-surface, never rely on the user to remember to check | Universal Capture Inbox, Resurfacing Engine |
| Task initiation failure | Disadvantage | Make the *first* step tiny, novel, and socially witnessed | Task Alchemy reframing, 2-Minute Ignition, Body Doubling |
| Executive planning deficit | Disadvantage | Do the decomposition for the user | AI task breakdown (Planner agent) |
| Emotional dysregulation / RSD | Disadvantage | Non-punitive language and mechanics everywhere; no red streak-broken UI | RSD-safe copy system, no-shame streaks |
| Interest-based (not importance-based) motivation | Root cause of both stacks | Inject PINCH into every task before showing it | Task Alchemy |
| Hyperfocus | Advantage | Detect it, shield it from interruption, and set biological guardrails | Hyperfocus Guardian |
| Divergent thinking / creativity | Advantage | Give it an unstructured capture space and periodic novelty prompts | Idea Vault, novelty rotation |
| Crisis / urgency performance | Advantage | A structured, opt-in sprint mode that channels urgency into output instead of panic | Crisis Sprint Mode |
| Social-presence dopamine boost | Advantage (leverages research on dopamine + social context) | Virtual/co-located body doubling | Focus Rooms |
| Variable energy/dopamine availability | Both | Log and match task difficulty/type to current state instead of ignoring it | Energy Mapping |

---

## 7. Feature Set (Product Pillars)

### Pillar 1 — Task Alchemy (the Interest Engine)
The core differentiator. Every captured task is passed through an LLM-backed reframing pipeline that:
- Breaks vague/large tasks into a first step small enough to start in under 2 minutes.
- Injects at least one PINCH element: reframes as a challenge ("beat your last time"), adds artificial urgency (a visible countdown appropriate to the task, not a fake deadline lie), adds novelty (rotates framing/visual theme so the trick doesn't go stale), or adds play (turns a chore into a mini-quest with a title).
- Learns per-user which reframing style actually gets tasks started (tracked via completion-after-reframe rate) and personalizes future reframes — this is the job of the **Motivator agent** (see §11).
- Never lies about real deadlines or fabricates false urgency that could cause downstream harm (e.g., it won't tell the user a bill is due today when it isn't) — urgency framing is applied only to structure/pacing, never to factual due dates.

### Pillar 2 — Time-Anchor System (time blindness countermeasure)
- Visual, always-legible countdown timers (shrinking-arc style, not just digits) for any active task or block.
- Multi-stage transition alerts (configurable, default 15/10/5-minute pre-warnings) before any scheduled boundary.
- **Auto-padding:** the scheduler learns the user's personal estimate-vs-actual ratio per task category and silently pads future estimates, rather than trusting the user's stated estimate.
- Event-anchored reminders ("after lunch," "when you get to your desk") as an alternative to clock-time reminders, since ADHD time sense anchors better to events than to numbers.

### Pillar 3 — Universal Capture Inbox + Resurfacing Engine (working memory countermeasure)
- One global capture action (voice, text, or quick-photo) reachable in under 1 second from anywhere in the app and from a home-screen widget/share-sheet — friction is the enemy of a working-memory-driven brain.
- Nothing captured is ever silently lost: everything not explicitly scheduled, dismissed, or completed automatically resurfaces on a spaced-repetition-like cadence so the user re-encounters it instead of having to remember to look for it.

### Pillar 4 — Hyperfocus Guardian
- Passive detection using in-app signal (sustained single-task engagement, typing/interaction cadence, explicit "I'm in flow" tap) to infer an active hyperfocus session.
- While detected: auto-silences non-critical notifications, defers non-urgent nudges, and shows a subtle "protected" state.
- Enforces hard guardrails regardless of flow state: a hydration/movement/meal nudge that cannot be silently dismissed past a configurable ceiling (default: a gentle full-screen interrupt after 2 hours continuous, escalating), because hyperfocus is exactly the state in which a person will skip meals and not notice pain/fatigue signals.
- Logs hyperfocus sessions for the Insights dashboard (which task types trigger it most, what time of day, what preceded it) so the user can learn to engineer the on-ramp deliberately.

### Pillar 5 — Energy & Dopamine Mapping
- Lightweight, frequent (not burdensome) self-report check-ins for energy level and mood.
- Over time, builds a personal energy curve; the task list can be sorted/filtered by "what fits my energy right now" (e.g., surfacing low-effort admin tasks during a low-energy window instead of forcing a hard creative task there).
- Optional, user-entered medication-timing log (purely informational, never clinical advice, never required) to help the user notice their own patterns — explicitly not a medical device feature.

### Pillar 6 — RSD-Safe Emotional Layer
- All copy across the app is written and reviewed against an explicit "no shame" style guide: no red "you failed," no broken-streak imagery, no guilt-based push notifications.
- A "reset, not restart" mechanic: missing a day doesn't zero out progress, it just marks a gap and continues.
- An optional brief guided reset (grounding breath cue + reframing prompt) available in-app for RSD flare-ups or overwhelm spikes — psychoeducational, not therapeutic treatment, with a clear in-app signpost to professional support resources for anything beyond in-the-moment regulation.

### Pillar 7 — Focus Rooms (Body Doubling)
- Drop-in virtual co-working rooms (video-optional; presence-only mode available for users who don't want camera-on accountability) themed by task type (Deep Work / Admin & Chores / Study).
- Silent-by-default with an optional ambient soundscape; light presence indicators (who else is "in the room") supply the social-context dopamine signal without requiring interaction.
- A "solo body double" AI-presence mode (a lightweight ambient companion in-app) for when no human room is available, positioned honestly as a weaker substitute, not a replacement for human co-presence.

### Pillar 8 — Crisis Sprint Mode
- An explicitly opt-in, time-boxed mode for genuine deadline crunches that leans into urgency-driven performance instead of pretending it doesn't happen: a single-task locked view, an aggressive but honest countdown, distraction-blocking, and a rapid task-triage flow.
- Designed to be used sparingly (the app will surface a gentle pattern-of-use insight if Crisis Mode is being used as a chronic crutch rather than an occasional tool, since chronic crisis-mode living is a burnout risk, not a productivity strategy).

### Pillar 9 — Idea Vault
- A zero-friction, unstructured capture space for the tangential ideas an ADHD brain generates constantly, deliberately separated from the structured task list so a stray idea doesn't derail an active task — "capture and return," not "capture and chase."

### Pillar 10 — Bounded Progression & Insights
- XP/streaks/levels are present but explicitly bounded per §3 principle 6: no infinite-scroll reward feed, no randomized variable-ratio loot mechanics. Rewards are predictable and tied to real task completion, not app engagement.
- A weekly Insights dashboard (web-primary, mobile-accessible) surfacing: completion rate trend, hyperfocus pattern analysis, best/worst task-reframe styles, energy curve, and a plain-language weekly reflection summary generated by the **Reflection agent**.

---

## 8. Non-Goals & Ethical Guardrails

Explicitly out of scope / explicitly forbidden, stated plainly so Claude Code never implements them by default:

- **Not a diagnostic or medical device.** No claims of treating, curing, or diagnosing ADHD anywhere in copy, marketing, or UI. A visible, permanent disclaimer belongs in onboarding and settings.
- **No dark patterns.** No infinite scroll, no variable-ratio ("slot machine") reward randomization, no manufactured scarcity about the app itself, no guilt-trip push copy, no pay-to-remove-friction mechanics that make the free experience deliberately worse.
- **No punitive streak mechanics.**
- **No medical/clinical advice generation** — the AI layer must never suggest medication changes, dosages, or diagnoses; any health-adjacent question from the user should be met with a redirect to a qualified professional plus general psychoeducational information at most.
- **No dependency-by-design.** The product must periodically and honestly surface its own usage pattern to the user (see Pillar 10) rather than silently maximizing time-in-app.

---

## 9. Success Metrics (KPIs)

Deliberately *not* the standard consumer-app metric set. In priority order:

1. **Task-completion uplift** — completion rate of Task-Alchemy-reframed tasks vs. a control group of un-reframed tasks (internal A/B).
2. **Time-to-flow** — median time from "task shown" to "first sustained engagement" (proxy for task-initiation friction, the single biggest lever for this population).
3. **7-day and 30-day resumption rate after a gap** — because non-punitive re-engagement after a lapse is a core thesis, not just retention in the generic sense.
4. **Self-reported weekly "felt in control" score** (single-question pulse survey) — the actual outcome this product exists to move, since engagement metrics alone can't tell you if a user's life got better.
5. Standard secondary metrics (DAU/WAU, session count) tracked but explicitly *not* optimized for, per §3 principle 5 — a drop in session count paired with a rise in metrics 1–4 is a **success**, not a red flag.

---

## 10. System Architecture (high level)

```
┌─────────────────────────┐        ┌─────────────────────────┐
│   Mobile App (RN/Expo)   │        │   Web App (Next.js)      │
│  iOS + Android            │        │  Dashboard + marketing   │
└────────────┬─────────────┘        └────────────┬─────────────┘
             │  HTTPS / WSS                        │  HTTPS / WSS
             └───────────────┬──────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   API Gateway /    │
                    │   FastAPI (BFF)    │
                    └─────────┬─────────┘
       ┌───────────────┬──────┴───────┬──────────────────┐
┌──────▼──────┐ ┌───────▼──────┐ ┌─────▼──────┐  ┌────────▼────────┐
│ Core Service │ │ Agent Service│ │ Realtime    │  │ Notification /  │
│ (tasks, users,│ │ (LangGraph   │ │ Service     │  │ Scheduler       │
│  energy, XP) │ │  multi-agent)│ │ (WebSockets,│  │ (reminders,     │
│              │ │              │ │  Focus Rooms)│  │  transition     │
└──────┬───────┘ └───────┬──────┘ └─────┬───────┘  │  alerts)        │
       │                 │              │          └────────┬────────┘
┌──────▼─────────────────▼──────────────▼───────────────────▼───────┐
│                     PostgreSQL (primary) + pgvector (RAG memory)    │
│                     Redis (cache, queues, presence)                 │
└──────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │  Object storage    │  (S3 — voice captures, photos)
                    └────────────────────┘
```

External integrations: Anthropic Claude API (primary reasoning/reframing model), a real-time video/audio provider for Focus Rooms, Expo push notifications (mobile) + web push, Stripe (subscription billing, Phase 3), PostHog (product analytics, self-hostable).

---

## 11. AI / Agent Architecture

Built on **LangGraph** for orchestration and **LangChain** for retrieval, matching Ariz's existing stack and directly reinforcing the multi-agent systems experience already built in Courtney AI and Sentinel.

| Agent | Job | Reads | Writes |
|---|---|---|---|
| **Planner** | Decomposes a captured task into a right-sized first step + subtasks | Task text, user's historical task-breakdown preferences | Structured subtask list |
| **Motivator (Task Alchemy)** | Chooses which PINCH lever(s) to apply and generates the reframed task copy | Task + subtasks, user's per-lever success-rate history (RAG memory) | Reframed task copy, chosen lever tag (for learning loop) |
| **Time-Translator** | Estimates realistic duration, applies personal padding factor, proposes reminder schedule | Task category, user's estimate-vs-actual history | Scheduled reminders, padded duration |
| **Reflection** | Generates the weekly plain-language summary and surfaces patterns (best reframe style, hyperfocus triggers, crisis-mode overuse) | Aggregated week of logs | Weekly insight summary |

**Personalization memory:** a per-user vector store (pgvector on Postgres for MVP; documented upgrade path to a managed vector DB such as Pinecone at scale) holds embeddings of past task text + which reframe/lever led to completion, so the Motivator agent's lever selection improves per-user over time via retrieval-augmented prompting rather than fine-tuning. Chroma is the recommended local/dev vector store for fast iteration before the pgvector/Pinecone production path.

All four agents run behind the Agent Service, called by the Core Service — the mobile/web apps never call the LLM directly (keeps API keys server-side, enables prompt-level guardrail enforcement in one place, and allows swapping model providers centrally).

---

## 12. Tech Stack

Chosen to extend Ariz's existing core stack (Python/FastAPI, LangChain/LangGraph, React/Next.js/TypeScript, AWS, Docker, PostgreSQL) rather than introduce an unrelated toolchain — this is deliberate, since the same skill investment compounds across this project and prior ones (Bulwark, SentinelOps, Courtney AI).

| Layer | Choice | Rationale |
|---|---|---|
| Mobile app | **React Native + Expo**, TypeScript | Single codebase for iOS/Android; shares language and component patterns with the Next.js web app; Expo push notifications and OTA updates simplify the notification-heavy feature set |
| Web app | **Next.js 15 (App Router) + TypeScript + React** | Matches existing stack; SSR for the marketing site, CSR for the dashboard |
| UI styling | Tailwind CSS + a small custom design-token system | ADHD-friendly UI needs a deliberately low-clutter, low-choice design language — a constrained token system enforces that discipline |
| Backend API | **Python + FastAPI** | Matches existing stack; async-native, good fit for the notification/scheduling workload |
| Agent orchestration | **LangGraph** (multi-agent graph) + **LangChain** (retrieval, tool use) | Direct extension of existing GenAI experience |
| LLM provider | **Anthropic Claude API** (primary) | Best reasoning-per-dollar for the nuanced, safety-sensitive copy generation this product needs (RSD-safe language, no false urgency) |
| Primary database | **PostgreSQL** | Matches existing stack; relational integrity for users/tasks/sessions |
| Vector memory | **pgvector** (MVP/production) with **Chroma** for local dev; documented Pinecone upgrade path at scale | Keeps infra minimal at MVP while giving a clean, resume-relevant upgrade story |
| Cache / queues / presence | **Redis** | Session cache, Focus Room presence, Celery broker |
| Background jobs / scheduler | **Celery + Celery Beat** (containerized), with an **AWS EventBridge Scheduler + SQS** upgrade path for production-scale reminder fan-out | Time-Anchor System's multi-stage reminders are inherently a scheduled-job problem |
| Realtime (Focus Rooms) | **WebSockets via FastAPI** for presence; **LiveKit** (self-hostable) for optional video/audio | Avoids building WebRTC from scratch; LiveKit has a generous self-host option that fits a bootstrapped build |
| Auth | **Clerk** (MVP) — hosted auth with first-class Next.js + React Native SDKs; documented **AWS Cognito** migration path if the product moves fully into Ariz's AWS-native infra later | Fastest reliable path to secure multi-platform auth without hand-rolling session security |
| Object storage | **AWS S3** | Voice captures, attached photos |
| CI/CD | **GitHub Actions** → Docker build → **Amazon ECR** → **ECS Fargate** | Matches SentinelOps DevOps track, reinforcing the same skill set across projects |
| Infra as code | **Terraform** | Same reasoning — direct continuity with the SentinelOps roadmap |
| Observability | **OpenTelemetry** + **Prometheus** + **Grafana** + **Loki** | Same observability stack as SentinelOps; one skill set, two projects |
| Analytics | **PostHog** (self-hosted) | Product analytics + feature flags without vendor lock-in; supports the "measure completion, not engagement" metric philosophy directly (custom event funnels rather than vanity engagement dashboards) |
| Payments (Phase 3) | **Stripe** | Standard, well-documented, mobile+web SDKs |
| Error tracking | **Sentry** | Standard for both RN and Next.js |

---

## 13. Data Model (core entities)

```
User
 ├─ id, email, display_name, timezone, created_at
 ├─ onboarding_profile (jsonb: self-reported ADHD subtype, primary pain points, notification prefs)
 └─ personalization_state (jsonb: current PINCH-lever success weights, estimate-padding factors per category)

Task
 ├─ id, user_id, raw_input_text, captured_at, source (voice/text/photo)
 ├─ status (inbox | scheduled | in_progress | done | archived)
 ├─ category (auto-tagged: deep_work / admin / creative / social / chore / study)
 ├─ reframed_title, applied_pinch_lever, reframe_accepted (bool)
 ├─ estimated_duration_raw, estimated_duration_padded, actual_duration
 └─ scheduled_start, scheduled_end, completed_at

Subtask
 ├─ id, task_id, title, order_index, status

FocusSession
 ├─ id, user_id, task_id (nullable), started_at, ended_at
 ├─ type (manual | hyperfocus_detected | crisis_sprint | focus_room)
 └─ interruption_count, guardrail_prompts_triggered (jsonb)

EnergyLog
 ├─ id, user_id, logged_at, energy_level (1-5), mood_tag, optional_medication_note

FocusRoom
 ├─ id, theme, started_at, ended_at, is_video_enabled
 └─ RoomParticipant (room_id, user_id, joined_at, left_at)

ReflectionSummary
 ├─ id, user_id, week_start, generated_text, metrics_snapshot (jsonb)

PersonalizationMemory (pgvector table)
 ├─ id, user_id, embedding, source_task_id, lever_used, outcome (completed/abandoned), created_at
```

---

## 14. API Surface (representative, not exhaustive)

REST (FastAPI, versioned under `/api/v1`):

- `POST /tasks/capture` — universal inbox capture (text/voice transcript/photo OCR)
- `GET /tasks` / `PATCH /tasks/{id}` / `POST /tasks/{id}/reframe` (triggers Motivator agent) / `POST /tasks/{id}/complete`
- `POST /focus-sessions/start` / `POST /focus-sessions/{id}/end` / `POST /focus-sessions/{id}/guardrail-ack`
- `POST /energy-logs`
- `GET /insights/weekly`
- `GET/POST /focus-rooms`, `POST /focus-rooms/{id}/join`
- `GET /personalization/profile`

WebSocket channels: `/ws/focus-room/{room_id}` (presence + optional signaling), `/ws/notifications` (live transition alerts while app is foregrounded).

---

## 15. Phase 1 — MVP Build Spec (what Claude Code should build first)

Scope deliberately excludes Focus Rooms video, Crisis Sprint Mode, and full multi-agent personalization loop — those are Phase 2. The MVP proves the core thesis (interest-based reframing + externalized time/memory) with the smallest system that can validate it.

**MVP includes:**
- Universal Capture Inbox (text + voice-to-text) — mobile + web
- Task Alchemy reframing (single Motivator-agent call per task, no personalization loop yet — static PINCH-lever heuristics to start)
- Time-Anchor timers + multi-stage reminders (push, mobile-first)
- Basic Resurfacing Engine (fixed-interval, not yet adaptive spaced repetition)
- Manual-start Hyperfocus session tracking (user taps "I'm in flow"; app applies DND + guardrail nudges) — passive auto-detection deferred to Phase 2
- Energy check-ins + energy-filtered task view
- Bounded XP/streak system with non-punitive copy
- Basic Insights screen (completion rate, streak, energy trend — no AI-generated reflection yet)
- Auth (Clerk), onboarding flow with clear non-clinical disclaimer

**MVP explicitly excludes:** Focus Rooms, Crisis Sprint Mode, Idea Vault, full personalization memory loop, payments.

**Suggested monorepo layout:**

```
overclock/
├── apps/
│   ├── mobile/            # Expo React Native app
│   └── web/                # Next.js dashboard + marketing
├── services/
│   ├── api/                 # FastAPI core service
│   └── agents/              # LangGraph agent service
├── packages/
│   ├── ui/                  # shared design tokens/components (web+native via Tamagui or NativeWind, TBD)
│   └── types/                # shared TypeScript types (task, user, session)
├── infra/
│   └── terraform/            # IaC for ECS, RDS, S3, EventBridge
└── docs/
    └── Overclock_PRD.md      # this file
```

**Definition of done for MVP:** a user can capture a task by voice in under 5 seconds, receive a reframed version within ~2 seconds, start a time-anchored session, get padded/multi-stage reminders, log energy, complete the task, and see it reflected in a non-punitive streak — end to end, on both mobile and web, with no crashes and P95 API latency under 500ms for the capture→reframe round trip.

---

## 16. Security, Privacy & Compliance

- Task content and energy/mood logs are sensitive personal data even though this is not a clinical app — encrypt at rest (RDS encryption) and in transit (TLS everywhere) by default.
- Full data export and full account deletion must be self-service from day one (both GDPR-style and India's DPDP Act expectations, relevant given the primary user base).
- No third-party ad networks or data brokers, ever — this is both an ethical requirement (§8) and a trust requirement for a product handling emotionally sensitive capture data.
- LLM calls: strip PII where feasible before sending task text to the model provider; document data retention settings on the Anthropic API account.
- Rate limiting and auth on every endpoint from day one (FastAPI + Redis-backed limiter) — not a "Phase 2 hardening" item.

---

## 17. Non-Functional Requirements

- **Accessibility-by-default UI:** minimal simultaneous choices per screen, generous touch targets, adjustable visual stimulation (a "calm mode" reducing color/motion for overwhelm moments), full dark mode, dyslexia-friendly font option.
- **Offline-tolerant capture:** the Universal Capture Inbox must work offline and sync when reconnected — an ADHD brain's captured thought cannot wait for a network check.
- **Notification reliability > notification volume:** better to send fewer, well-timed, high-signal alerts than many ignorable ones — an ignored-notification pattern trains the user to ignore all notifications, defeating the Time-Anchor System.
- **Performance:** capture-to-reframe round trip target P95 < 2s; app cold start < 2s.

---

## 18. Roadmap

- **Phase 1 (MVP, ~6–10 weeks solo-build pace):** §15 scope. Goal: validate that reframing measurably improves completion rate for the builder's own real task list before adding social/community surface area.
- **Phase 2 (~next 6–8 weeks):** Full personalization loop (PersonalizationMemory + adaptive lever selection), passive hyperfocus auto-detection, Focus Rooms (presence-only, then video via LiveKit), Idea Vault, AI-generated weekly Reflection summaries, Crisis Sprint Mode.
- **Phase 3 (growth/monetization):** Stripe subscription tier, community features (opt-in), wearable integration (heart-rate-informed energy logging), Android/iOS store launch hardening, marketing site build-out, PostHog-driven growth experimentation — always re-checked against the §3 anti-dark-pattern principles before shipping any growth mechanic.

---

## 19. Open Questions / Risks

- **Auto-detected hyperfocus false positives** could annoy users if triggered during ordinary sustained work rather than true flow — Phase 1 sidesteps this by making hyperfocus tracking manual-start; Phase 2 needs real usage data before trusting a passive detector.
- **LLM latency/cost at scale** for per-task reframing — worth benchmarking Claude Haiku-class models for the Motivator agent's low-stakes reframe calls versus reserving a larger model for the weekly Reflection summary, to keep the capture→reframe round trip fast and cheap.
- **Body doubling supply/demand cold-start** (Phase 2) — an empty Focus Room is worse than no feature; needs either scheduled/seeded sessions or the solo AI-presence fallback to launch credibly.
- **Regulatory framing risk:** any copy that drifts toward implying clinical efficacy needs continuous review — this is a product-and-legal risk, not just a copywriting nitpick, given the health-adjacent subject matter.

---

## 20. Sources

- [ADDA — DSM-5 Criteria for ADHD](https://add.org/adhd-dsm-5-criteria/)
- [Simply Psychology — ADHD Time Blindness Guide (2026)](https://www.simplypsychology.com/articles/adhd-time-blindness-guide)
- [Simply Psychology — ADHD Executive Dysfunction in Daily Life](https://www.simplypsychology.com/articles/adhd-executive-dysfunction-daily-life)
- [Simply Psychology — How To Use ADHD To Your Advantage](https://www.simplypsychology.org/how-to-use-adhd-to-your-advantage.html)
- [New Frontiers Executive Function Coaching — Prevalence of ADHD: 2026 Report](https://nfil.net/blog/prevalence-of-adhd-2026-report-on-trends-adult-persistence-and-diagnostic-criteria-effects/)
- [Silberstein et al. — Dopaminergic modulation of default mode network connectivity in ADHD, *Brain and Behavior* (2016)](https://onlinelibrary.wiley.com/doi/full/10.1002/brb3.582)
- [Psych Central — ADHD Body Doubling](https://psychcentral.com/adhd/adhd-body-doubling)
- [Neurodivergent Insights — Interest-Based Nervous System and ADHD Motivation](https://neurodivergentinsights.com/interest-based-nervous-system/)
- [PMC — Short-term and long-term effect of non-pharmacotherapy for adults with ADHD: a systematic review and network meta-analysis](https://pmc.ncbi.nlm.nih.gov/articles/PMC11825462/)
- [Inflow — The 12 Best Apps for ADHD in 2026](https://www.getinflow.io/post/best-apps-for-adhd)

---

*This document is intended as living context for Claude Code. Claude Code should treat §15 as the immediate build target, §12–14 as binding architecture unless a specific technical blocker is found, and §7 as the full feature backlog beyond MVP. Any deviation from the tech stack in §12 should be flagged back to Ariz before implementation, since the choices there are deliberately continuous with his existing skill investment across other projects.*