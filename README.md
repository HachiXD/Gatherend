# Gatherend

Hi xD, this is Gatherend, a real-time communication platform designed for communities.

## Features

Gatherend provides real-time voice with screen and video sharing, real-time chat organized by channels, image sharing, customizable app themes, custom sticker uploads, direct messaging, and the ability to join or create boards.

## Tech Stack and Annotations

- **Voice:** Built on LiveKit. Token generation is handled in `apps/gatherend-web/src/app/api/livekit/route.ts` and client-side configuration is in `apps/gatherend-web/src/components/providers/voice-livekit-provider.tsx`.
- **Sockets:** Socket.IO implementation is located in `apps/express/sockets`.
- **Backend:** CRUD-related endpoints are implemented in Next.js, while real-time functionality is handled by Express endpoints.
- **Frontend:** Next.js, React, and Tailwind CSS are my main frameworks. Additional dependencies include TanStack Query, which is used extensively throughout the project.
- **Auth:** Better Auth handles all authentication logic. The implementation relies entirely on Better Auth utilities rather than custom auth code.
- **Database:** PostgreSQL is my primary database.
- **Redis:** Used for caching and real-time features. Configurations can be found in the respective `redis.ts` files in `/gatherend-web` and `/express`.
- **Other services:** imgproxy for image transformations, DiceBear for avatar generation, and NudeNet for image moderation.

## Roadmap

My current priorities are completing app features and fixing the board caching system, followed by a client redesign, then focusing on the self-hosting capabilities of the project.
