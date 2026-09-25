# Overclock

Personal OS for the ADHD brain. Product spec: [prd.md](prd.md) (§15 is the current build target).

## Status
- [x] `services/api` — FastAPI core (capture → Task Alchemy reframe, time padding, resurfacing, focus sessions + guardrails, energy, insights, export/delete)
- [x] `apps/mobile` — Expo app: capture (offline queue, keyboard dictation for voice), reframed task cards, focus timer with 15/10/5 local reminders + body-check guardrails, energy check-in → filtered tasks, insights, onboarding
- [x] `apps/web` — Next.js 15 dashboard: same flows as mobile + insights side panel; proxies `/api/v1` to the API (no CORS)
- [x] `packages/types` — API shapes shared by both apps
- [x] Clerk sign-in on web + mobile; API verifies session tokens (JWKS + `azp`)
- [x] Instant capture (reframe runs in the background), Settings: disclaimer, data export, account deletion
- [x] Alembic migrations (applied automatically on API startup)
- [x] Comfort preferences synced across devices: calm mode, easier-to-read font (Lexend), reminder timing
- [x] Development-build config (`expo-dev-client`, `eas.json`) for system notifications on Android
- [x] Phase 2: adaptive PINCH-lever choice, AI weekly reflection, Idea Vault, Crisis Sprint Mode
- [ ] Phase 2 left: passive hyperfocus detection, Focus Rooms (body doubling)
- [x] CI (GitHub Actions) and Docker images for the API and web
- [x] Web push + server-side reminder scheduler (reminders arrive with the app closed)
- [ ] Focus Rooms (body doubling), hosting, store release

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
createdb overclock_test   # on the compose Postgres
uv run pytest             # DATABASE_URL overrides the test DB
```

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
