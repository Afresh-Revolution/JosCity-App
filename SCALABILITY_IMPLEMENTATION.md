# JOSCity scalability implementation

This report follows `scalability.md`. Work landed in the live API (`../New_Joscity`), the live website (`../JOSCITY`), and the mobile app (`mobile/`). The architecture stays a **modular monolith**. Redis is optional.

## 1. Existing architecture

| Layer | What we found |
| --- | --- |
| Website | React + Vite SPA (`../JOSCITY`), JWT in `localStorage`, polling + Socket.IO for chat |
| Mobile | Expo/React Native (`mobile/`), already paginated feed (page size 10) and `apiFetch` timeouts |
| API | Express on Node (`server.js`), JWT auth, Socket.IO, Cloudinary uploads |
| Data | PostgreSQL via `pg` Pool (not an ORM). Marketplace also has a MySQL debug entry (`src/index.js`) that is not the main process |
| Payments | Paystack + Safe Haven webhooks; wallet and CAC-edit flows in Postgres |
| Jobs | In-process `setInterval` for expired stories and scheduled posts |
| Cache / queues | None before this work. No Bull/BullMQ |
| Hosting | Process listens on `LISTEN_HOST`/`PORT`; DigitalOcean-style `DATABASE_URL` already in `.env.example` |

This is the right shape for current scale: one API, one Postgres, object storage off-box.

## 2. Scalability problems found

```text
Problem
News feed website drained every page until a 3-month cutoff (100 items per request).
Impact
Unbounded DB/CPU/network on every home load; first-paint delayed; connection pool exhaustion.
Severity
CRITICAL
Solution implemented
One page of 20 on load; infinite scroll fetches the next page. API default/max limits 20/100.

Problem
JSON body parser accepted 150MB on every route.
Impact
Easy memory DoS against a single Node process.
Severity
CRITICAL
Solution implemented
Default JSON/urlencoded limit is 2mb (`JSON_BODY_LIMIT`). Multipart uploads still use multer/Cloudinary limits.

Problem
JWT verify used `JWT_SECRET || "fallback_secret"` on sockets and chat.
Impact
Forged tokens if the secret is missing.
Severity
CRITICAL
Solution implemented
`utils/jwtSecret.js` requires a real secret. Verify fails closed.

Problem
Idle Postgres pool errors called `process.exit(-1)`.
Impact
A single idle-client error killed the whole API.
Severity
HIGH
Solution implemented
Log the error. Do not exit. Pool size/timeouts are env-driven.

Problem
No rate limiting.
Impact
Login/signup/forgot-password and list endpoints can be abused.
Severity
HIGH
Solution implemented
Per-IP/user limiter (Redis when `REDIS_URL` is set, memory otherwise). Stricter cap on auth routes.

Problem
Auth middleware queried `users` on every request. Health was `/api/ping` with no DB check. No SIGTERM drain.
Impact
DB load, false-healthy deploys, dropped in-flight requests on restart.
Severity
HIGH
Solution implemented
30s user-row cache; `/health/live` and `/health/ready`; graceful shutdown.

Problem
Socket.IO and rate limits were process-local. Story/scheduled jobs would duplicate on multiple instances.
Impact
Broken chat fan-out and double-publish behind a load balancer.
Severity
HIGH (multi-instance)
Solution implemented
Optional Redis adapter + cache/rate-limit/job lock. Without Redis, single-instance behavior is unchanged.

Problem
Website `fetchWithTimeout` ignored its timeout. Marketplace/forums `fetch` had none. Chat/notification polls ran in background tabs.
Impact
Hung UI, wasted bandwidth on hidden tabs.
Severity
MEDIUM
Solution implemented
AbortController timeouts; pause polls while `document.hidden`. Mobile polls skip when the app is not `active`.
```

## 3. Changes made

### API (`../New_Joscity`)

- `server.js` — request IDs, JSON limit, `/api` rate limit, health routes, graceful shutdown, Redis job locks
- `config/database.js` — configurable pool; no process exit on idle errors
- `infrastructure/cache.js` — Redis with in-memory fallback; `tryLock`
- `infrastructure/health.js`, `infrastructure/shutdown.js`
- `middleware/rateLimit.js`, `middleware/requestContext.js`, `middleware/authMiddleware.js`
- `utils/pagination.js`, `utils/jwtSecret.js`
- `controller/feedController.js`, `chatController.js`, `commentController.js`, `reactionController.js`
- `routes/authRoute.js` — tighter auth burst limit
- `services/socketService.js` — Redis adapter when `REDIS_URL` is set
- `migrations/050_scalability_indexes.sql` (applied)
- `Dockerfile`, `.dockerignore`, `loadtest/k6-api.js`
- `.env.example` — new ops variables
- `package.json` — `ioredis`, `@socket.io/redis-adapter`

### Website (`../JOSCITY`)

- `NewsFeed.tsx` — page size 20, load-more sentinel
- `feedApi.ts` — default limit 20
- `fetchWithTimeout.ts`, `marketplaceApi.ts`, `forumsApi.ts` — request timeouts
- `visibleInterval.ts` — used by newsfeed, forums, chat, notifications

### Mobile (`mobile/`)

- Already paginated. Added `foregroundInterval.ts` so badge/presence polls do not run while backgrounded.

## 4. Database improvements

- Indexes (idempotent): `users(account_status)`, `users(account_type)`, `posts(time DESC)`, `posts(user_id)`, `messages(conversation_id, created_at DESC)`, `post_comments(post_id, created_at DESC)`, `notifications(to_user_id, time DESC)`
- Migration: `migrations/050_scalability_indexes.sql` (ran successfully)
- Query: feed/chat/comments/reactions now clamp `limit` (default 20, max 100)
- Pool: `DB_POOL_MAX` (default 5, appropriate for Neon session mode)
- Transactions: payment/wallet paths were already transactional; not rewritten
- Concurrency: Redis `SET NX` locks for story cleanup and scheduled posts when Redis is up

## 5. Caching

| Key | TTL | Why |
| --- | --- | --- |
| `joscity:auth:{userId}` | 30s | Cuts a `users` lookup on every authenticated request |
| `joscity:rl:*` | window (`RATE_LIMIT_WINDOW_MS`) | Rate-limit counters |
| `joscity:lock:*` | job interval | Single-leader in-process jobs |

Invalidation is TTL-only. Account status changes can lag up to 30s. That is intentional.

Without `REDIS_URL`, all of this is per-process memory. That is correct for one API instance and **wrong** for two.

## 6. Queue architecture

Still no dedicated queue (Bull/SQS). Existing async work:

| Job | Trigger | Multi-instance |
| --- | --- | --- |
| Expired story cleanup | hourly `setInterval` | Redis lock if configured |
| Publish scheduled posts | every 60s | Redis lock if configured |
| Paystack/Safe Haven | HTTP webhooks | already request-driven |
| Email (Resend) | inline on the request | unchanged |

A real queue is listed under remaining work, not invented here.

## 7. Security improvements

- Removed JWT `fallback_secret`
- Capped JSON body size
- Rate limits on `/api` and auth login/signup/reset
- Structured request logs with `X-Request-Id` (health/ping omitted)
- `trust proxy` was already on (needed for correct client IP behind a load balancer)

## 8. Infrastructure requirements

Required today:

```text
PostgreSQL
Object storage (Cloudinary — already in use)
```

Optional, required before running more than one API process:

```text
Redis (REDIS_URL)
```

Already used, not added by this work: email (Resend), Paystack, Safe Haven.

Not required: Kafka, Elasticsearch, a second database, microservices.

## 9. Environment variables

Added or documented:

| Variable | Default | Purpose |
| --- | --- | --- |
| `REDIS_URL` | unset | Cache, rate limits, Socket.IO adapter, job locks |
| `LISTEN_HOST` | `0.0.0.0` | Bind address |
| `DB_POOL_MAX` | `5` | Postgres pool size |
| `DB_IDLE_TIMEOUT_MS` | `10000` | Idle client timeout |
| `DB_CONNECT_TIMEOUT_MS` | `8000` | Connect timeout |
| `JSON_BODY_LIMIT` | `2mb` | Express JSON parser |
| `URLENCODED_BODY_LIMIT` | same as JSON | Express urlencoded parser |
| `RATE_LIMIT_API_MAX` | `120` | Requests per window per IP/user |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate-limit window |
| `RATE_LIMIT_AUTH_MAX` | `20` | Auth burst cap |
| `RATE_LIMIT_AUTH_WINDOW_MS` | `900000` | Auth window (15 min) |
| `HEALTH_REQUIRE_REDIS` | unset/false | 503 ready checks if Redis is down |
| `CORS_ORIGINS` | existing | Already used; documented in `.env.example` |

If a client posts large JSON (not multipart), raise `JSON_BODY_LIMIT`. Media uploads should stay multipart.

## 10. Deployment architecture

Recommended now:

```text
[Browser / Expo] → HTTPS load balancer
                 → N identical Node processes (start at 1)
                 → PostgreSQL
                 → Cloudinary
                 → Redis (when N > 1)
```

Health:

- Load balancer liveness: `GET /health/live`
- Readiness / deploy gate: `GET /health/ready` (Postgres; Redis only if `HEALTH_REQUIRE_REDIS=true`)
- Legacy: `GET /api/ping`

Container: `Dockerfile` (node:20-alpine, `node server.js`). SIGTERM drains HTTP then closes Redis and the pool.

Do not put the Node process in charge of SSL or of storing uploads on local disk.

## 11. Load testing

k6 script: `../New_Joscity/loadtest/k6-api.js`

```text
cd ../New_Joscity
k6 run -e BASE_URL=http://localhost:3000 loadtest/k6-api.js
k6 run -e BASE_URL=http://localhost:3000 -e TOKEN=<jwt> loadtest/k6-api.js
```

Never point this at production. Thresholds are smoke-level (`p95 < 1.5s`, error rate `< 5%`), not a capacity claim.

## 12. Scalability estimate

Reasoned, not benchmarked:

```text
1,000 users
Current single Node + Postgres + Cloudinary is enough if the feed stays paginated.

10,000 users
First bottleneck: Postgres (feed queries + auth) and the single Socket.IO process.
Enable REDIS_URL, run 2 API instances, watch pool wait time and p95 /api/feed.

100,000 users
Bottlenecks: chat fan-out, notification polling, scheduled-post interval, and feed formatPost N+1 work.
Need a job queue, cursor pagination on feed, replica reads, and to stop HTTP-polling unread counts.

1,000,000 users
Need dedicated realtime (or Redis adapter + sticky sessions is not enough), CDN in front of the SPA, read replicas, and almost certainly a split of media/chat from the feed API.
Do not start that rewrite now.
```

## 13. Remaining recommendations

```text
DO NOW
- Set JWT_SECRET in every environment (already required).
- Confirm production JSON clients still work at 2mb; raise JSON_BODY_LIMIT only if a real payload needs it.
- Point the load balancer at /health/ready.

DO BEFORE PUBLIC LAUNCH
- Set REDIS_URL if you will run more than one API dyno/container.
- Turn on request logging in your host (DigitalOcean/App Platform/Fly) rather than only stdout JSON.
- Run the k6 smoke test against staging with a real JWT.

DO AT 10K+ ACTIVE USERS
- Move story cleanup and scheduled posts to a worker (BullMQ or a cron container).
- Replace notification HTTP polling with the existing Socket.IO channel.
- Cursor pagination for feed (created_at, post_id) instead of OFFSET.
- Reduce formatPost N+1 (batch reactions/comments).

DO AT 100K+ ACTIVE USERS
- Postgres read replica for feed/list endpoints.
- Sticky sessions or a fully Redis-backed presence map (connectedUsers is still in-memory).
- CDN + long-cache hashed SPA assets.

ONLY IF REQUIRED LATER
- Split chat or media into a separate service.
- Elasticsearch / OpenSearch for people search.
- Kafka or similar event bus.
```

Already satisfied (not rewritten): JWT is stateless; Cloudinary holds blobs; mobile home feed was already paged; CORS origins are env-driven; marketplace checkout already uses transactions.

---

Website UI changes (feed load-more, timeouts, pause-on-hidden) were implemented on the live Vite app in `../JOSCITY`. They were not click-tested in a browser from this session; after a refresh, the home feed should load one page of ~20 posts and fetch more as you scroll.
