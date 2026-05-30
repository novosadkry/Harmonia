# CLAUDE.md — Harmonia: Discord Music Bot + Web Dashboard

You are building **Harmonia**, a full-stack Discord music bot with a web dashboard. Read this entire file before writing any code. Follow the architecture, naming conventions, and implementation order exactly.

---

## Project Overview

Harmonia lets Discord users search YouTube/Spotify, build personal playlists, and control a music bot from a web dashboard. It feels like Spotify but lives inside Discord communities.

**Key design decisions:**
- The **web dashboard** is the primary interface. Discord slash commands are secondary.
- The **bot process** is a dumb audio player — it executes commands, emits events. All logic lives in the web layer.
- A **global track library** deduplicates tracks across all users and playlists. No track metadata is ever stored twice.
- **Redis** owns all real-time state (queue, playback, DJ lock). **PostgreSQL** owns all persistent state.

---

## Monorepo Structure

```
harmonia/
├── apps/
│   ├── web/          # Next.js 14 app (dashboard + API)
│   └── bot/          # discord.js bot process
├── packages/
│   ├── db/           # Prisma schema, client, migrations
│   ├── redis/        # Redis client, pub/sub helpers, key constants
│   └── types/        # Shared TypeScript types across apps
├── docker-compose.yml
├── .env.example
└── CLAUDE.md
```

Use **pnpm workspaces** for the monorepo. All packages are internal and referenced via workspace protocol.

---

## Tech Stack — Exact Packages

### Web App (`apps/web`)
- `next` 14 (App Router, TypeScript)
- `next-auth` v5 (Auth.js) — Discord OAuth provider
- `socket.io` — server-side WebSocket for real-time dashboard updates
- `socket.io-client` — client-side
- `@tanstack/react-query` v5 — data fetching and cache on the frontend
- `tailwindcss` + `tailwind-merge` + `clsx`
- `shadcn/ui` — base components (install individually as needed)
- `lucide-react` — icons
- `zustand` — minimal client-side state (current guild, UI state)
- `zod` — input validation on API routes
- `spotify-web-api-node` — Spotify metadata resolution

### Bot (`apps/bot`)
- `discord.js` v14
- `@discordjs/voice`
- `@discordjs/opus` (or `opusscript` as fallback)
- `ffmpeg-static` — bundled FFmpeg binary
- `yt-dlp-wrap` — Node wrapper for yt-dlp CLI (must be installed on system)
- `socket.io-client` — connects to the web app's WebSocket to receive commands

### Shared Packages
- `packages/db`: `@prisma/client`, `prisma`
- `packages/redis`: `ioredis`
- `packages/types`: zero dependencies, pure TypeScript interfaces

---

## Environment Variables

Create `.env` at the monorepo root. All apps read from it.

```env
# Discord
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_BOT_TOKEN=

# Spotify
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=

# YouTube
YOUTUBE_API_KEY=

# Database
DATABASE_URL=postgresql://harmonia:harmonia@localhost:5432/harmonia

# Redis
REDIS_URL=redis://localhost:6379

# Auth
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000

# Internal communication
BOT_WS_URL=http://localhost:3001   # Bot's internal HTTP/WS server
INTERNAL_API_SECRET=               # Shared secret for web→bot HTTP calls
```

---

## Database Schema (`packages/db/prisma/schema.prisma`)

Define these models exactly. Do not add extra fields without noting them here.

```prisma
model User {
  id            String   @id          // Discord user ID
  username      String
  discriminator String
  avatarUrl     String?
  createdAt     DateTime @default(now())

  playlists     Playlist[]
  tracksAdded   Track[]   @relation("TrackAddedBy")
}

model Track {
  id             String   @id @default(uuid())
  youtubeVideoId String   @unique      // Primary dedup key
  spotifyUri     String?  @unique      // Secondary dedup key, nullable
  title          String
  artist         String
  album          String?
  durationSeconds Int
  thumbnailUrl   String?
  playCount      Int      @default(0)
  firstAddedBy   String
  createdAt      DateTime @default(now())

  addedBy        User     @relation("TrackAddedBy", fields: [firstAddedBy], references: [id])
  playlistTracks PlaylistTrack[]
}

model Playlist {
  id          String   @id @default(uuid())
  userId      String
  name        String
  description String?
  isPublic    Boolean  @default(false)
  shareCode   String?  @unique        // Short code for sharing
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user        User     @relation(fields: [userId], references: [id])
  tracks      PlaylistTrack[]
}

model PlaylistTrack {
  playlistId  String
  trackId     String
  position    Int
  addedAt     DateTime @default(now())

  playlist    Playlist @relation(fields: [playlistId], references: [id], onDelete: Cascade)
  track       Track    @relation(fields: [trackId], references: [id])

  @@id([playlistId, trackId])
  @@index([playlistId, position])
}

model SearchCache {
  queryHash   String   @id           // SHA-256 of normalized query string
  queryRaw    String
  trackId     String
  hitCount    Int      @default(1)
  lastSearchedAt DateTime @default(now())
}
```

---

## Redis Key Schema (`packages/redis/src/keys.ts`)

Export these key builder functions. Nothing in the codebase should hardcode Redis keys.

```typescript
export const keys = {
  // Playback state for a guild — Redis Hash
  playbackState: (guildId: string) => `guild:${guildId}:playback`,

  // Current queue — Redis List of serialized TrackInQueue JSON
  queue: (guildId: string) => `guild:${guildId}:queue`,

  // DJ lock — Redis String (value = userId), with TTL
  djLock: (guildId: string) => `guild:${guildId}:dj`,

  // Pub/sub channels
  commandChannel: (guildId: string) => `guild:${guildId}:commands`,
  eventChannel: (guildId: string) => `guild:${guildId}:events`,

  // Hot search cache — Redis String (value = trackId), with TTL
  searchCache: (queryHash: string) => `search:${queryHash}`,
};
```

**Playback state hash fields:** `status` (playing|paused|stopped), `trackId`, `startedAt` (unix ms), `pausedAt` (unix ms or null), `volume` (0–100), `loop` (none|track|queue), `shuffle` (bool).

**DJ lock TTL:** 5 minutes, refreshed on every bot action. Auto-expires if user leaves channel.

**Queue entries** are JSON strings: `{ trackId, youtubeVideoId, title, artist, thumbnailUrl, durationSeconds, queuedBy }`.

---

## Shared Types (`packages/types/src/index.ts`)

```typescript
export type PlaybackStatus = 'playing' | 'paused' | 'stopped';
export type LoopMode = 'none' | 'track' | 'queue';

export interface PlaybackState {
  status: PlaybackStatus;
  trackId: string | null;
  startedAt: number | null;
  pausedAt: number | null;
  volume: number;
  loop: LoopMode;
  shuffle: boolean;
}

export interface TrackInQueue {
  trackId: string;
  youtubeVideoId: string;
  title: string;
  artist: string;
  thumbnailUrl: string | null;
  durationSeconds: number;
  queuedBy: string; // userId
}

// Commands sent from web → bot via Redis pub/sub
export type BotCommand =
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'SKIP' }
  | { type: 'STOP' }
  | { type: 'SEEK'; positionSeconds: number }
  | { type: 'SET_VOLUME'; volume: number }
  | { type: 'SET_LOOP'; mode: LoopMode }
  | { type: 'TOGGLE_SHUFFLE' }
  | { type: 'JOIN_CHANNEL'; channelId: string }
  | { type: 'LEAVE_CHANNEL' };

// Events emitted from bot → web via Redis pub/sub
export type BotEvent =
  | { type: 'TRACK_STARTED'; track: TrackInQueue }
  | { type: 'TRACK_ENDED'; trackId: string }
  | { type: 'TRACK_ERROR'; trackId: string; error: string }
  | { type: 'QUEUE_UPDATED'; queue: TrackInQueue[] }
  | { type: 'PLAYBACK_STATE_CHANGED'; state: PlaybackState }
  | { type: 'DJ_CHANGED'; userId: string | null }
  | { type: 'BOT_JOINED'; channelId: string }
  | { type: 'BOT_LEFT' };
```

---

## Module Implementation Guide

### 1. Track Resolver (`apps/web/src/lib/resolver.ts`)

This is the most critical module. Every track addition flows through here.

```typescript
// Signature
async function resolveTrack(input: string): Promise<Track>
```

**Resolution logic (implement in this order):**

1. Detect input type:
   - YouTube URL (regex: `youtube.com/watch?v=` or `youtu.be/`) → extract `videoId`
   - Spotify track URL (regex: `open.spotify.com/track/`) → extract Spotify URI
   - Spotify playlist URL → handled separately by `resolveSpotifyPlaylist()`
   - YouTube playlist URL → handled separately by `resolveYouTubePlaylist()`
   - Plain string → treat as search query

2. For **YouTube video ID**: check `Track.youtubeVideoId` in DB → return if found, else fetch metadata via YouTube Data API v3 (`videos?part=snippet,contentDetails`) → insert and return.

3. For **Spotify URI**: check `Track.spotifyUri` in DB → return if found. Otherwise fetch metadata from Spotify API. Then search YouTube with query `"${artist} - ${title} official audio"` → take first result → check if that `youtubeVideoId` already exists in DB (merge if so, else insert new Track with both IDs set).

4. For **search query**: normalize (lowercase, trim, collapse whitespace) → SHA-256 hash → check `SearchCache` table → if hit, return `Track` by cached `trackId`. Otherwise search YouTube Data API → take first result → resolve as YouTube video ID (step 2) → upsert `SearchCache` row → return Track.

Never throw on resolution failure. Return a typed `Result<Track, ResolverError>` so callers can handle gracefully.

---

### 2. Playlist Service (`apps/web/src/lib/playlist-service.ts`)

CRUD operations. All functions take `userId` as first argument and validate ownership.

- `createPlaylist(userId, name, description?)` 
- `deletePlaylist(userId, playlistId)`
- `addTrack(userId, playlistId, input: string)` — calls resolver, then upserts `PlaylistTrack` with next available position
- `removeTrack(userId, playlistId, trackId)`
- `reorderTracks(userId, playlistId, orderedTrackIds: string[])` — bulk update positions
- `sharePlaylist(userId, playlistId)` — generate nanoid(8) shareCode, save, return URL
- `clonePlaylist(userId, shareCode)` — load source playlist tracks, create new playlist for userId, bulk insert PlaylistTrack rows pointing to the same Track records (no track duplication)
- `importFromSpotifyPlaylist(userId, spotifyPlaylistUrl)` — paginate Spotify API (max 100/page), resolve each track in parallel (concurrency limit: 5), create playlist, bulk insert
- `importFromYouTubePlaylist(userId, youTubePlaylistUrl)` — same pattern via YouTube API

---

### 3. Playback Service (`apps/web/src/lib/playback-service.ts`)

Manages DJ lock and sends commands to the bot. Never directly controls audio.

- `takeDJControl(userId, guildId, channelId)` — SET NX on djLock key (atomic), fail if taken by someone else, publish `JOIN_CHANNEL` command
- `releaseDJControl(userId, guildId)` — verify caller holds lock, DEL key, publish `LEAVE_CHANNEL`
- `getDJState(guildId)` — return current DJ userId or null
- `sendCommand(userId, guildId, command: BotCommand)` — verify userId holds DJ lock, publish to `commandChannel`
- `getPlaybackState(guildId)` — read Redis hash, return `PlaybackState`
- `getQueue(guildId)` — LRANGE full queue list, parse JSON entries
- `enqueueTrack(userId, guildId, trackId)` — resolve track, RPUSH to queue, publish `QUEUE_UPDATED`, increment `Track.playCount`
- `enqueuePlaylist(userId, guildId, playlistId)` — load playlist tracks in order, bulk RPUSH

---

### 4. Bot Audio Engine (`apps/bot/src/audio/`)

**`player.ts`** — wraps `@discordjs/voice` AudioPlayer. One instance per guild.

- `play(youtubeVideoId)` — spawn `yt-dlp` with `--format bestaudio --get-url` to get a direct stream URL (do NOT download the file), create `createAudioResource` from the URL piped through FFmpeg (`-i <url> -f opus`), subscribe the VoiceConnection to the player.
- `pause()`, `resume()`, `stop()`, `setVolume(vol)`
- Emit `trackEnded` when AudioPlayer goes Idle, `trackError` on error.

**`queue-manager.ts`** — subscribes to Redis `commandChannel` for the guild. On each command, calls the appropriate player method. On `trackEnded`, calls `LPOP` from the Redis queue and starts the next track. Publishes `BotEvent` after every state change.

**`voice-manager.ts`** — manages `joinVoiceChannel` / `leaveVoiceChannel`. Handles disconnection events (auto-rejoin once, then give up and release DJ lock).

---

### 5. API Routes (`apps/web/src/app/api/`)

All routes require authentication (check session). Return JSON. Use Zod for request body validation.

```
POST   /api/playlists                    createPlaylist
GET    /api/playlists                    listUserPlaylists
DELETE /api/playlists/[id]               deletePlaylist
POST   /api/playlists/[id]/tracks        addTrack { input: string }
DELETE /api/playlists/[id]/tracks/[tid]  removeTrack
PUT    /api/playlists/[id]/tracks/order  reorderTracks { orderedTrackIds }
POST   /api/playlists/[id]/share         sharePlaylist
POST   /api/playlists/clone              clonePlaylist { shareCode }
POST   /api/playlists/import             importPlaylist { url: string }

GET    /api/guild/[guildId]/playback     getPlaybackState
GET    /api/guild/[guildId]/queue        getQueue
POST   /api/guild/[guildId]/dj/take      takeDJControl { channelId }
POST   /api/guild/[guildId]/dj/release   releaseDJControl
POST   /api/guild/[guildId]/command      sendCommand { command: BotCommand }
POST   /api/guild/[guildId]/queue        enqueueTrack { trackId }
POST   /api/guild/[guildId]/queue/playlist enqueuePlaylist { playlistId }

GET    /api/search?q=&type=              search (YouTube + Spotify unified)
GET    /api/tracks/trending              top tracks by playCount
```

---

### 6. WebSocket Server (`apps/web/src/lib/socket-server.ts`)

Initialize Socket.io on the Next.js custom server (`server.ts`). On connection, authenticate via session cookie. 

- Client joins room `guild:<guildId>` when they open a guild page.
- The server subscribes to Redis `eventChannel` for that guild (one Redis subscriber per active guild, not per client).
- On Redis event, broadcast to the guild room: `io.to(`guild:${guildId}`).emit('event', event)`.
- Client-side: `usePlaybackState(guildId)` hook subscribes to socket events and updates Zustand store.

---

### 7. Dashboard UI (`apps/web/src/app/(dashboard)/`)

**Aesthetic direction:** Dark theme. Spotify-inspired but distinct. Use deep charcoal (`#0f0f13`) background, not pure black. Accent color: electric violet (`#7c3aed`) with a secondary warm amber (`#f59e0b`) for DJ/active states. Typography: `Syne` (display/headings, Google Fonts) + `DM Sans` (body). Subtle noise texture overlay on backgrounds. Smooth transitions on all playback state changes (150ms ease).

**Pages and layout:**

`/` — Landing page. Login with Discord CTA. Brief feature overview.

`/dashboard` — Guild selector. Show all Discord guilds the user shares with the bot. Cards with guild icon, name, member count, whether bot is present.

`/dashboard/[guildId]` — Main app layout with left sidebar:
- Sidebar: user avatar, guild name, nav links (Now Playing, Queue, My Playlists, Discover, Settings)
- Persistent now-playing bar at the bottom (always visible)

`/dashboard/[guildId]/now-playing` — Full now-playing view:
- Large album art (blurred as page background)
- Track title, artist, album
- Progress bar (computed client-side from `startedAt` + elapsed, updated every second via `setInterval`)
- Playback controls: shuffle, prev (restart track), play/pause, skip, repeat
- Volume slider
- DJ status badge (who holds control, button to take/release)
- Waveform animation when playing (CSS only, decorative)

`/dashboard/[guildId]/queue` — Current queue list. Drag-to-reorder (if DJ). Each row: position number, thumbnail, title, artist, duration, queued-by avatar. "Clear queue" and "Save as playlist" actions.

`/dashboard/[guildId]/playlists` — Grid of user's playlists. Create new. Click → playlist detail.

`/dashboard/[guildId]/playlists/[playlistId]` — Playlist detail. Track list with add/remove. Search bar at top to add tracks. "Play entire playlist" button (enqueues all). "Share" button generates link. Import from Spotify/YouTube URL.

`/dashboard/[guildId]/discover` — Trending tracks (by global playCount). Public playlists. Import a shared playlist by code.

---

## Implementation Order

Build in this sequence. Do not skip ahead.

1. **Monorepo scaffold** — pnpm workspace, tsconfig, ESLint, shared `.env`
2. **`packages/db`** — Prisma schema, generate client, write initial migration
3. **`packages/redis`** — ioredis client singleton, key constants, pub/sub helpers
4. **`packages/types`** — all shared interfaces
5. **`apps/web` skeleton** — Next.js install, Auth.js with Discord provider, basic session working
6. **Track Resolver** — build and test in isolation with a small test script
7. **Playlist Service** — all CRUD, test with direct function calls
8. **API Routes** — wire services to HTTP, test with curl/Postman
9. **`apps/bot` skeleton** — discord.js login, register slash commands (`/dj take`, `/dj release`, `/skip`, `/nowplaying`)
10. **Bot Audio Engine** — yt-dlp integration, FFmpeg pipe, AudioPlayer, test with a hardcoded video ID
11. **Bot Queue Manager** — Redis command subscription, queue advance logic
12. **WebSocket server** — Socket.io setup, Redis event forwarding, test with a simple client
13. **Dashboard UI** — build pages in order: layout → now-playing → queue → playlists → discover
14. **End-to-end testing** — full flow: login → add track → enqueue → play in Discord → dashboard updates live

---

## Code Conventions

- **TypeScript strict mode** everywhere. No `any`. No `// @ts-ignore`.
- **No raw SQL.** All DB access through Prisma client from `packages/db`.
- **No hardcoded Redis keys.** Always use `keys.*` from `packages/redis`.
- **Error handling:** API routes return `{ error: string }` with appropriate HTTP status. Never leak stack traces to the client.
- **Async everywhere.** No blocking operations on the main thread. The bot's audio pipeline runs in a child process via yt-dlp.
- **Logging:** Use `pino` in both apps. Structured JSON logs in production. Include `guildId` and `userId` in every log context where available.
- **Environment validation:** Use `zod` to parse and validate all env vars at startup in both apps. Fail fast with a clear message if required vars are missing.

---

## Docker Compose (development)

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: harmonia
      POSTGRES_PASSWORD: harmonia
      POSTGRES_DB: harmonia
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

volumes:
  pgdata:
```

Run `docker compose up -d` before starting either app. Both apps connect to these services via the env vars above.

---

## External Service Setup (do this before coding)

1. **Discord:** Create application at discord.com/developers. Enable bot, copy token. Add OAuth2 redirect: `http://localhost:3000/api/auth/callback/discord`. Enable `guilds` and `identify` scopes.
2. **Spotify:** Create app at developer.spotify.com. Copy client ID and secret. No redirect needed (Client Credentials flow only).
3. **YouTube:** Enable YouTube Data API v3 at console.cloud.google.com. Create API key. Set referrer restriction to your domain in production.
4. **yt-dlp:** Install system-wide: `pip install yt-dlp`. Verify with `yt-dlp --version`. This must be on PATH for the bot process.

---

## Known Constraints and Workarounds

**Spotify audio is unavailable.** Spotify's API returns metadata only. All audio comes from YouTube. When resolving a Spotify track, always search YouTube and store the `youtubeVideoId`. Inform users of this in the UI ("Playing via YouTube").

**yt-dlp stream URLs expire.** Do not cache the raw stream URL. Call yt-dlp fresh each time a track starts playing. The `youtubeVideoId` is what you cache long-term.

**YouTube API quota.** The Data API v3 has a daily quota (10,000 units). Search costs 100 units per call. Use `SearchCache` aggressively. For playlist imports, batch video metadata requests (`videos?id=id1,id2,id3`, max 50 per call) instead of fetching one at a time.

**Spotify → YouTube mismatch.** The automated search may find a live version, cover, or remaster. Store a `userOverrideYoutubeVideoId` nullable field on `Track` (add to schema). If set, use it instead of the auto-resolved ID. Expose a "Fix match" UI on the track detail page.

**Bot in multiple guilds.** The `AudioPlayer` and `VoiceConnection` instances are per-guild. The bot process maintains a `Map<guildId, GuildPlayer>` and initializes lazily on first `JOIN_CHANNEL` command.
