# Overclock

Personal OS for the ADHD brain. Product spec: [prd.md](prd.md) (§15 is the current build target).

## What's built

Every feature in the PRD except the ones that need paid services (see the end).

| Pillar | Where it shows up |
|---|---|
| 1 · Task Alchemy | Capture anything; Gemini rewrites it with the motivation lever that works for you, plus a 2-minute first step. Retries by itself if the model is busy |
| 2 · Time-Anchor | Padded estimates from your own history, ring timer, reminders at your chosen offsets — delivered even with the app closed |
| 3 · Capture + resurfacing | Text or voice, works offline, syncs later; forgotten inbox items resurface |
| 4 · Hyperfocus Guardian | 45 uninterrupted minutes auto-protects the session; body checks after 2 hours that can't be silently dismissed |
| 5 · Energy mapping | Check in, see the tasks that fit; energy curve in Insights |
| 6 · RSD-safe | No streak loss, no guilt copy, daily XP cap with a reachable finish line |
| 7 · Focus Rooms | Presence-only body doubling over a WebSocket |
| 8 · Crisis Sprint | Opt-in crunch mode, plus an honest nudge if it becomes a habit |
| 9 · Idea Vault | Park stray ideas away from the task list; promote one when it's ready |
| 10 · Insights | Weekly AI reflection, which reframe styles get you started, flow patterns, completion rate |

Phase 3: CI, Docker images for the whole stack, web push, server-side reminders, public landing page.

## Run the API
```sh
docker compose up -d                       # Postgres (5433) + Redis
cd services/api
uv run uvicorn app.main:app --env-file .env --reload --host 0.0.0.0   # docs at http://localhost:8000/docs
```

## Run the mobile app
```sh
cd apps/mobile
npx expo start       # scan the QR with Expo Go; settings in .env.local
```
In **Expo Go on Android**, system notifications are skipped (Expo Go no longer ships them); the in-app timer and body checks still work.
For notifications, install a **development build** once, then keep using `npx expo start` as usual:
```sh
npx eas-cli@latest login                                  # free Expo account
npx eas-cli@latest build --profile development --platform android   # cloud build → install the APK on your phone
# or, with Android Studio installed:  npx expo run:android
```

## Database changes
```sh
cd services/api
# edit app/db.py, then:
uv run alembic revision --autogenerate -m "what changed"
uv run alembic upgrade head      # the API also runs this on startup
```

## Run the web dashboard
```sh
cd apps/web
npm run dev          # http://localhost:3000 — set API_URL if the API isn't on localhost:8000
```

## Test

```sh
cd services/api
uv run pytest                      # 17 tests, needs the compose Postgres
```

End-to-end check of every flow against a running API (real Gemini calls, cleans up after itself):

```sh
# terminal 1
cd services/api && DEV_AUTH_USER=verify-bot uv run uvicorn app.main:app --env-file .env --port 8000
# terminal 2
cd services/api && uv run python scripts/verify_local.py
```

`DEV_AUTH_USER` disables sign-in and is for local checks only. Run the app itself without it.

## Not built (needs a paid service)

- **Video in Focus Rooms** — LiveKit means a hosted or self-run media server; presence works today.
- **App store release** — Google Play ($25 once) and Apple ($99/year) developer accounts.
- **Payments (Stripe)** and **AWS/Terraform deployment** — deliberately deferred.
- **pgvector personalization memory** (§11): lever choice learns from your own task history instead, which
  needs no embeddings. Worth revisiting when lever choice should depend on what a task is about.

## CI

`.github/workflows/ci.yml` runs on every push and pull request, on GitHub's free runners:

| Job | What it checks |
|---|---|
| `api` | pytest against a real Postgres, and that the migrations still match the models (`alembic check`) |
| `web` | typecheck, lint, production build |
| `mobile` | typecheck, lint, Android bundle |

Builds use placeholder Clerk keys, so CI needs no secrets.

## Reminders

"Remind me" on a task queues nudges (its `reminder_offsets`, then the start time); a loop inside the API
sends them whether or not the app is open. Web push needs a VAPID key pair — free, no account:

```sh
cd services/api && uv run python scripts/gen_vapid.py   # paste both lines into .env
```

Phone push needs a development build and an EAS project id (Expo's push service is free); in Expo Go the
app falls back to local notifications.

## Deploying

Both services are plain Docker images, so any host that runs containers works — including your own machine:

```sh
docker compose -f compose.prod.yml up -d --build      # API + web + Postgres + Redis
```

Set these on the host (see `.env.example` in each folder):
`CLERK_JWKS_URL`, `GEMINI_API_KEY`, `CLERK_AUTHORIZED_PARTIES` (your web origin) for the API;
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (at **build** time — it ends up in the browser bundle),
`CLERK_SECRET_KEY` and `API_URL` for the web app.

No AWS or Terraform, deliberately — a change from PRD §12. The images are provider-agnostic: a small VPS,
or a container host plus managed Postgres/Redis, whatever is cheapest at the time. Check current free-tier
limits before committing to a provider; they change often.
