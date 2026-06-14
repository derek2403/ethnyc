# MARS — Next.js 16 production image (two-stage).
#
# WHY two stages:
#   - builder  : installs deps + runs `next build`. .env.local IS present here so the
#                NEXT_PUBLIC_* vars (RP_ID, WORLD_APP_ID) get inlined into the client bundle.
#                This stage is thrown away, so the baked secrets never ship.
#   - runner   : only the build output + node_modules. .env.local is NOT copied — it is
#                bind-mounted at runtime (see docker-compose.yml) so server-only secrets
#                (HEDERA/OPENAI/ARC keys) are read fresh and never live inside the image.
#
# Runtime data (db/, skills/, mars-state.json) is process.cwd()-relative in the code
# (lib/db.mjs, lib/state.ts) and is bind-mounted at /app/* — NOT copied in.

# ---------- builder ----------
FROM node:22-bookworm-slim AS builder
WORKDIR /app

# Install deps against the committed lockfile (rsync package-lock.json to the server first;
# it is gitignored). Falls back to `npm install` if the lock is missing.
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copy the source (demo/skills is read by getStaticProps at build time → must be present).
COPY . .

# next build — reads .env.local from the build context to inline NEXT_PUBLIC_* vars.
RUN npm run build

# ---------- runner ----------
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
# next start binds 0.0.0.0:3000 by default; HOSTNAME makes it explicit.
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next        ./.next
COPY --from=builder /app/public       ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts

EXPOSE 3000
CMD ["npm", "run", "start"]
