# BUILDER: Compiles Next.js app and generates Prisma client
FROM node:22.22.2-alpine AS builder

WORKDIR /app

# Copy root package.json to install prisma + shared deps
COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps

# Copy prisma
COPY prisma ./prisma

# Copy shared domain modules
COPY packages ./packages

# Copy entire project
COPY apps ./apps

COPY apps/gatherend-web/public ./apps/gatherend-web/public

# Generate Prisma Client
RUN npx prisma generate

# Install dependencies for the Next.js project
WORKDIR /app/apps/gatherend-web
RUN npm install --legacy-peer-deps

# Install native Linux binaries for Tailwind/lightningcss (Alpine = musl)
RUN npm install lightningcss-linux-x64-musl@1.30.2 @tailwindcss/oxide-linux-x64-musl@4.1.17 --save-optional --legacy-peer-deps

# BUILD-TIME ENV VARS (only NEXT_PUBLIC_* are embedded in client JS)
# Public vars - these get inlined into the client bundle
ARG NEXT_PUBLIC_SOCKET_URL
ARG NEXT_PUBLIC_LIVEKIT_URL
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_CDN_URL
ARG NEXT_PUBLIC_IMGPROXY_URL
ARG NEXT_PUBLIC_STORAGE_DOMAIN
ARG NEXT_PUBLIC_BETTER_AUTH_URL
ARG NEXT_PUBLIC_DICEBEAR_URL

ENV NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL
ENV NEXT_PUBLIC_LIVEKIT_URL=$NEXT_PUBLIC_LIVEKIT_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_CDN_URL=$NEXT_PUBLIC_CDN_URL
ENV NEXT_PUBLIC_IMGPROXY_URL=$NEXT_PUBLIC_IMGPROXY_URL
ENV NEXT_PUBLIC_STORAGE_DOMAIN=$NEXT_PUBLIC_STORAGE_DOMAIN
ENV NEXT_PUBLIC_BETTER_AUTH_URL=$NEXT_PUBLIC_BETTER_AUTH_URL
ENV NEXT_PUBLIC_DICEBEAR_URL=$NEXT_PUBLIC_DICEBEAR_URL


# SENSITIVE VARS - passed at runtime via Railway, NOT baked into image

# CLERK_SECRET_KEY, DATABASE_URL, DIRECT_URL, ACCELERATE_URL
# are provided by Railway at runtime and read by Next.js server

# Dummy DATABASE_URL for build time only (Prisma client needs a valid URL format)
# This is NEVER used for actual connections - Railway provides the real URL at runtime
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"

# Build Next.js standalone
RUN npm run build

# 
# 2) RUNNER
# 
FROM node:22.22.2-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Install only Prisma CLI
RUN npm install prisma@6.18.0 --omit=dev

# Copy standalone
COPY --from=builder /app/apps/gatherend-web/.next/standalone ./
COPY --from=builder /app/apps/gatherend-web/.next/static ./apps/gatherend-web/.next/static
COPY --from=builder /app/apps/gatherend-web/public ./apps/gatherend-web/public

# Copy Prisma Client generated
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy Prisma schema and migrations
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000

CMD ["node", "apps/gatherend-web/server.js"]
