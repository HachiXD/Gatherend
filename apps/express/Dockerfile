# BUILDER: Compile TS and generate Prisma client
# I have had serious issues with alpine, so I suggest keeping bookworm-slim
FROM node:22.22.2-bookworm-slim AS builder

WORKDIR /app
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

# Copy root package.json for shared dependencies (Prisma)
COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps

# Copy prisma 
COPY prisma ./prisma

# Copy shared domain modules
COPY packages ./packages

# Generate Prisma Client
RUN npx prisma generate

# Copy express app code
COPY apps/express ./apps/express

# Install dependencies for the express app
WORKDIR /app/apps/express
RUN npm install --legacy-peer-deps

# Compile TypeScript
RUN npm run build

# RUNNER: Final image for production
FROM node:22.22.2-bookworm-slim AS runner

WORKDIR /app
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV PORT=3001

# Copy Prisma Client generated from the builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy Prisma schema
COPY --from=builder /app/prisma ./prisma

# Copy node_modules and compiled code — preserve apps/express/dist/ depth so that
# relative imports like ../../../../packages/domain/... resolve correctly at runtime.
COPY --from=builder /app/apps/express/node_modules ./apps/express/node_modules
COPY --from=builder /app/apps/express/dist ./apps/express/dist
COPY --from=builder /app/apps/express/package.json ./apps/express/package.json

# Copy compiled packages/domain CJS output (imported by apps/express/dist/lib/domain.js)
COPY --from=builder /app/packages/domain/dist/cjs ./packages/domain/dist/cjs

EXPOSE 3001

CMD ["node", "apps/express/dist/server.js"]
