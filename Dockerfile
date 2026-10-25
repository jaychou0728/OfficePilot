# syntax=docker/dockerfile:1

# ---------- build ----------
FROM node:24-bookworm-slim AS build
WORKDIR /app

# Install dependencies with the locked workspace graph.
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci

# Build server (tsup) and web (tsc + vite).
COPY tsconfig.base.json tsconfig.json ./
COPY packages/shared ./packages/shared
COPY apps/server ./apps/server
COPY apps/web ./apps/web
COPY fixtures ./fixtures
COPY scripts ./scripts
RUN npm run build

# ---------- runtime ----------
FROM node:24-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DATA_DIR=/app/data

# Runtime needs the full node_modules (tsx for `npm run demo:seed`), the
# shared workspace package, the bundled server, the built web assets, demo
# fixtures and the seed script. Server source is kept for the TS seed script.
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/apps/server/package.json ./apps/server/package.json
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/server/src ./apps/server/src
COPY --from=build /app/apps/web/package.json ./apps/web/package.json
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY --from=build /app/fixtures ./fixtures
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/tsconfig.base.json ./tsconfig.base.json

RUN mkdir -p /app/data

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then((r) => r.ok ? r.json() : Promise.reject(new Error('http'))).then((j) => process.exit(j.status === 'ok' ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "apps/server/dist/index.js"]
