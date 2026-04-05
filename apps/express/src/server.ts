// Express + Socket.IO Server
// If you are using Railway, it injects env vars automatically; in local dev, load from .env.
if (process.env.NODE_ENV !== "production") {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require("fs");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require("path");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const dotenv = require("dotenv");

  // Load both repo root `.env` (DB, etc.) and `apps/express/.env` (IMGPROXY, secrets, etc)
  // regardless of where the process is started from (root, apps/express, dist, etc.).
  const candidatePaths = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../.env"),
    path.resolve(process.cwd(), "../../.env"),
    path.resolve(process.cwd(), "../../../.env"),
    path.resolve(process.cwd(), "apps/express/.env"),
    path.resolve(process.cwd(), "../apps/express/.env"),
    path.resolve(process.cwd(), "../../apps/express/.env"),
    path.resolve(process.cwd(), "../../../apps/express/.env"),
  ];

  const seen = new Set<string>();
  for (const p of candidatePaths) {
    if (seen.has(p)) continue;
    seen.add(p);
    if (fs.existsSync(p)) {
      dotenv.config({ path: p });
    }
  }
}

import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { registerRoutes } from "./routes/index.js";
import { registerSocketHandlers } from "./sockets/index.js";
import { db } from "./lib/db.js";
import { logger } from "./lib/logger.js";
import { presenceManager } from "./lib/presence-manager.js";
import { voiceParticipantsManager } from "./lib/voice-participants-manager.js";
import {
  getRedisClient,
  getRedisSubscriber,
  isRedisConfigured,
  initializeRedis,
  closeRedis,
} from "./lib/redis.js";
import { globalRateLimit, readRateLimit } from "./middleware/rate-limit.js";

// EXPRESS APP SETUP
const app = express();

// Disable x-powered-by header (security: don't expose Express)
app.disable("x-powered-by");

// CORS configuration
const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:3000",
  ...(process.env.RAILWAY_PRIVATE_URL ? [process.env.RAILWAY_PRIVATE_URL] : []),
  "http://localhost:3000", // Local development
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests without origin (like Postman or server-to-server)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "x-profile-id"],
  }),
);

app.use(express.json());

// INTERNAL API SECRET VALIDATION
// Fail fast if INTERNAL_API_SECRET is not configured
if (!process.env.INTERNAL_API_SECRET) {
  throw new Error("FATAL: Missing INTERNAL_API_SECRET environment variable");
}

// Prevent caching of API responses
app.use((req, res, next) => {
  res.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});

// SECURITY HEADERS

// CSP for API responses
app.use((req, res, next) => {
  res.set(
    "Content-Security-Policy",
    "frame-ancestors 'none'; default-src 'none'",
  );
  res.set("X-Frame-Options", "DENY"); // Legacy fallback
  res.set("X-Content-Type-Options", "nosniff");
  res.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload",
  );
  next();
});

// RATE LIMITING

// Permissive rate limit for reads
app.use(readRateLimit);
// Stricter rate limit for writes
app.use(globalRateLimit);

// HTTP SERVER + SOCKET.IO SETUP

const server = createServer(app);

const io = new Server(server, {
  path: "/api/socket/io",
  addTrailingSlash: false,
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
  pingTimeout: 60000,
  pingInterval: 25000,
  connectionStateRecovery: {
    // Allow short network blips without losing room subscriptions.
    // Keeps "board:*" and similar rooms stable across reconnects.
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
  },
});

// REDIS ADAPTER

function configureRedisAdapter() {
  if (!isRedisConfigured()) {
    logger.warn(
      "Redis not configured - Socket.IO running in single-server mode",
    );
    return;
  }

  try {
    const pubClient = getRedisClient();
    const subClient = getRedisSubscriber();
    io.adapter(createAdapter(pubClient, subClient));
    logger.info("Socket.IO Redis adapter configured successfully");
  } catch (error) {
    logger.error("Failed to configure Redis adapter:", error);
    logger.warn("Running in single-server mode");
  }
}

presenceManager.setSocketIO(io);

// REGISTER ROUTES AND SOCKET HANDLERS

registerRoutes(app, io);
registerSocketHandlers(io);

// SERVER STARTUP

const PORT = process.env.PORT || 3001;

(async () => {
  const redisInitialized = await initializeRedis();

  if (redisInitialized) {
    configureRedisAdapter();
    await presenceManager.initialize();
    await voiceParticipantsManager.initialize();
  }

  // Warn about optional but recommended env vars
  if (!process.env.FRONTEND_URL) {
    logger.warn("FRONTEND_URL not set — defaulting to http://localhost:3000");
  }
  if (!process.env.IMGPROXY_URL) {
    logger.warn("IMGPROXY_URL not set — image transformations disabled");
  }
  if (!process.env.CONTENT_MODERATION_URL) {
    logger.warn(
      "CONTENT_MODERATION_URL not set — moderated image uploads will be rejected",
    );
  }
  if (!process.env.ATTACHMENTS_BASE_URL) {
    logger.warn(
      "ATTACHMENTS_BASE_URL not set — signed attachment URLs disabled",
    );
  }
  if (!process.env.MEDIA_ALLOWED_HOSTNAMES) {
    logger.warn(
      "MEDIA_ALLOWED_HOSTNAMES not set — media proxy will reject all source URLs",
    );
  }

  server.listen(PORT, () => {
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    logger.info(`Socket.IO Server running`);
    logger.info(`Port: ${PORT}`);
    logger.info(`Path: /api/socket/io`);
    logger.info(`CORS: ${process.env.FRONTEND_URL || "http://localhost:3000"}`);
    logger.info(`Redis: ${isRedisConfigured() ? "enabled" : "disabled"}`);
    logger.info(`Started: ${new Date().toISOString()}`);
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  });
})();

// GRACEFUL SHUTDOWN

const shutdown = async (signal: string) => {
  logger.info(`${signal} received, shutting down server...`);

  try {
    await presenceManager.cleanup();
    logger.info("Presence manager cleanup completed");
  } catch (err) {
    logger.error("Error cleaning up presence manager:", err);
  }

  try {
    await voiceParticipantsManager.cleanup();
    logger.info("Voice participants manager cleanup completed");
  } catch (err) {
    logger.error("Error cleaning up voice participants manager:", err);
  }

  io.close(() => {
    logger.info("Socket.IO closed");

    server.close(async () => {
      logger.info("HTTP server closed");
      try {
        await closeRedis();
        logger.info("Redis disconnected");
      } catch (err) {
        console.error("Error disconnecting Redis:", err);
      }
      try {
        await db.$disconnect();
        logger.info("Prisma disconnected");
      } catch (err) {
        console.error("Error disconnecting Prisma:", err);
      }
      process.exit(0);
    });
  });

  setTimeout(() => {
    console.error("Forcing server shutdown");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  shutdown("UNCAUGHT_EXCEPTION");
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});
