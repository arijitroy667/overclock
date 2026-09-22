# Overclock

Personal OS for the ADHD brain. Product spec: [prd.md](prd.md) (§15 is the current build target).

## Status
- [x] `services/api` — FastAPI core (capture → Task Alchemy reframe, time padding, resurfacing, focus sessions + guardrails, energy, insights, export/delete)
- [x] `apps/mobile` — Expo app: capture (offline queue, keyboard dictation for voice), reframed task cards, focus timer with 15/10/5 local reminders + body-check guardrails, energy check-in → filtered tasks, insights, onboarding
- [x] `apps/web` — Next.js 15 dashboard: same flows as mobile + insights side panel; proxies `/api/v1` to the API (no CORS)
- [x] `packages/types` — API shapes shared by both apps
- [x] Clerk sign-in on web + mobile; API verifies session tokens (JWKS + `azp`)
- [x] Instant capture (reframe runs in the background), Settings: disclaimer, data export, account deletion
- [ ] Development build for system notifications on Android, web push / server-side reminder scheduler, infra (Terraform, CI)

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
Local reminders work in Expo Go; remote push will need a development build.

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
