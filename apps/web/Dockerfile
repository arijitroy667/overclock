# Build from the repo root: docker build -f apps/web/Dockerfile .
# (the app type-checks against packages/types, which lives outside apps/web)
FROM node:22-alpine AS deps
WORKDIR /app
COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /repo
COPY packages ./packages
WORKDIR /repo/apps/web
COPY --from=deps /app/node_modules ./node_modules
COPY apps/web .
# Baked into the client bundle at build time; everything else is read at runtime.
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_ZHVtbXktZm9yLWJ1aWxkLmNsZXJrLmFjY291bnRzLmRldiQ=
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./.next/static
COPY --from=build /repo/apps/web/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
