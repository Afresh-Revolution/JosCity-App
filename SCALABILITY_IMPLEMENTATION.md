# JosRide and JosRide Driver scalability implementation

This report covers the passenger app (`JosRide-App/josride_app/`), driver app (`JosRide-App/Driver/`), FastAPI backend (`JCRide-back/`), and Flask website/admin portal (`JCRide-front/`). The recommended architecture remains a **modular monolith** backed by PostgreSQL. Redis and a durable job queue should be added before horizontally scaling the API.

## 1. Current architecture

| Layer | Current implementation |
| --- | --- |
| Passenger app | Expo/React Native: rides, bike delivery, wallet, tracking, chat, calls, ratings and safety |
| Driver app | Expo/React Native: onboarding, availability, offers, navigation, location, earnings and withdrawals |
| Website/admin | Flask passenger web experience, driver portal and operations console |
| API | FastAPI/Uvicorn REST API with authenticated WebSockets |
| Data | PostgreSQL/Supabase through `psycopg_pool.ConnectionPool` |
| Realtime | In-process WebSocket manager for offers, trip state, location, chat, calls and notifications |
| Payments | Paystack plus an internal wallet ledger |
| Media | Cloudinary driver-document and media storage |
| Background work | In-process scheduled-ride reminder/dispatch loop |

```text
Passenger app ─┐
Driver app ────┼── HTTPS + WebSocket ──► FastAPI ──► PostgreSQL
Website/admin ─┘                           ├── Paystack
                                          ├── Cloudinary
                                          └── email, maps, push and calling services
```

## 2. Existing scalability safeguards

- PostgreSQL connection pooling plus acquisition, connection and statement timeouts.
- Supabase session-pooler URLs on port 5432 are redirected to transaction pooling on 6543.
- Database pool closes during application shutdown.
- `/health` endpoint for host monitoring.
- Timeouts on Paystack, email, push and JosCity integration calls.
- Paginated scheduled-ride endpoints and mobile histories.
- WebSockets reduce continuous HTTP polling during active trips.
- Driver location/map lookups include abortable timeouts.
- Wallet settlement and withdrawal paths use server-side checks and transactions.
- Uploads use Cloudinary rather than API-container storage.

## 3. Main risks and required work

### Persistent rate limiting — critical

The backend contains a production TODO for persistent login rate limiting. Add a Redis-backed limiter by IP and authenticated account. Apply stricter limits to login, OTP, wallet funding, transfers, withdrawals, ride creation, SOS and uploads.

### Process-local realtime — critical before multiple instances

Connected passengers and drivers live in one Python process. An event created on one instance cannot reliably reach a client connected to another. Before adding API instances, introduce Redis Pub/Sub or a managed broker, shared presence with TTLs, WebSocket-aware load balancing and event IDs/ride versions. Sticky sessions alone are insufficient.

### In-process scheduled worker — high

Every API instance can start the scheduled-ride loop, risking duplicate reminders or dispatch. Keep one scheduler until work is claimed atomically with PostgreSQL locks, or move scheduling to a dedicated durable worker.

### Driver-location volume — high

Throttle GPS updates, broadcast only meaningful movement, keep the latest active position in Redis with a short TTL, and persist only samples required for trip history or safety. Do not retain every heartbeat indefinitely.

### Nearby-driver matching — high

As the fleet grows, use PostGIS or Redis GEO instead of scanning drivers and calculating all distances in application code. Query only approved, eligible, online drivers within a controlled radius.

### Payment idempotency — high

Paystack webhooks and client requests may be retried. Keep provider references unique, verify webhook signatures, lock wallet rows, maintain an immutable ledger and reject duplicate funding, payout or trip settlement. Repeated idempotency keys should return the stored result.

### Growing lists and third-party calls — medium

Keep strict provider timeouts and move non-blocking email, push, document and reconciliation work to a durable queue as volume grows. Enforce maximum page sizes on trips, notifications, wallet records, drivers and reports. Use cursor pagination for large tables.

## 4. Database plan

Verify indexes against the deployed schema and query plans. Maintain equivalents of:

```text
rides(customer_id, created_at DESC)
rides(driver_id, created_at DESC)
rides(status, created_at DESC)
drivers(status, is_online)
driver_locations(driver_id, updated_at DESC)
notifications(user_id, created_at DESC)
wallet_transactions(wallet_id, created_at DESC)
wallet_transactions(reference) UNIQUE
withdrawals(user_id, created_at DESC)
scheduled_rides(status, scheduled_for)
messages(ride_id, created_at DESC)
ratings(driver_id, created_at DESC)
```

Use a geospatial index for proximity queries. Keep each instance's pool small and budget the combined pool against the database limit. Make ride acceptance atomic so only one driver wins. Set unique constraints for all retryable money operations. Archive or partition old location/event data when retention grows.

## 5. Redis design

Redis is optional for one API instance but required for safe multi-instance realtime operation.

| Key | TTL | Purpose |
| --- | --- | --- |
| `josride:presence:user:{id}` | 60–120s | Passenger presence |
| `josride:presence:driver:{id}` | 30–60s | Driver heartbeat |
| `josride:driver-location:{id}` | 30–60s | Latest dispatch/tracking position |
| `josride:geo:drivers:{city}` | heartbeat refreshed | Nearby-driver lookup |
| `josride:ride:{id}:state` | trip plus grace period | Hot trip state |
| `josride:rate-limit:*` | limiter window | Shared abuse protection |
| `josride:idempotency:*` | 24–72h | Safe retry results |
| `josride:lock:scheduled-dispatch` | worker interval | Single scheduler leader |

PostgreSQL remains the source of truth. Redis must never be the only copy of balances, settlements or completed trips.

## 6. Realtime requirements

- Authenticate sockets and authorise each ride/channel subscription.
- Heartbeat connections and expire stale driver presence.
- Reconnect with exponential backoff and jitter.
- After reconnecting, fetch authoritative ride state over REST.
- Include event IDs or increasing ride versions to discard duplicates and stale events.
- Use push notifications for important events while apps are backgrounded or disconnected.
- Never log access tokens, bank details or precise coordinates unnecessarily.

## 7. Queue plan

Use a durable worker system when multiple instances or traffic justify it.

| Job | Idempotency key |
| --- | --- |
| Scheduled reminder | scheduled ride + reminder type |
| Scheduled dispatch | scheduled ride ID |
| Push notification | event/notification ID |
| Email/OTP | message attempt ID |
| Payment reconciliation | Paystack reference |
| Failed-payout refund/review | withdrawal/reference ID |
| Document processing | document ID/version |

Money jobs need bounded retries, recorded attempts and a dead-letter/manual-review path. A retry must never produce another debit or credit.

## 8. Security and privacy

- Keep `SECRET_KEY`, Paystack, Cloudinary, email and TURN credentials outside source control.
- Disable development bypass flags and remove demo credentials from public production material.
- Enforce passenger, driver and admin roles on the server.
- Verify driver approval, documents, vehicle and availability before dispatch.
- Verify Paystack webhook signatures and unique transaction references.
- Limit JSON/multipart sizes and validate uploads.
- Restrict web CORS origins; mobile security still depends on authentication, not CORS.
- Redact tokens, bank data, identity documents and exact locations from logs.
- Audit wallet adjustments, approvals, trip-state changes, SOS actions and admin operations.
- Define retention for precise location data and identity documents.

## 9. Reliability and observability

Split health checks:

```text
GET /health/live   process is running
GET /health/ready  database and required dependencies are ready
```

Measure structured request logs, p50/p95/p99 latency, 5xx rate, pool wait time, slow queries, active sockets, reconnects, online-driver heartbeat freshness, request-to-offer/acceptance time, scheduled-job failures, payment/reconciliation failures and crash-free mobile sessions.

Alert on readiness failure, sustained errors, database saturation, stalled dispatch, abnormal payment failures and queue backlog.

## 10. Deployment

Launch safely with one API instance, PostgreSQL transaction pooling, Cloudinary, Paystack and external providers. Before two or more API instances:

1. Add shared Redis realtime fan-out and presence.
2. Add persistent rate limiting.
3. Make scheduled dispatch single-leader or move it to a worker.
4. Verify atomic ride acceptance and payment idempotency under concurrency.
5. Add dependency-aware readiness and graceful HTTP/WebSocket shutdown.
6. Load-test staging with realistic REST and WebSocket traffic.

Do not store durable state on an API container.

## 11. Configuration

Current core variables include `DATABASE_URL`, `HOST`, `PORT`, `DEBUG`, `CORS_ORIGINS`, `SECRET_KEY`, `JWT_EXPIRES_MINUTES`, email/Resend/SMTP variables, `CLOUDINARY_*`, `PAYSTACK_*`, `WEBRTC_*`, `SCHEDULED_WORKER_*`, `DRIVER_SEARCH_RADIUS_KM` and the public maps key.

Recommended additions:

```text
REDIS_URL
RATE_LIMIT_ENABLED=true
RATE_LIMIT_AUTH_MAX
RATE_LIMIT_RIDE_MAX
RATE_LIMIT_WALLET_MAX
MAX_JSON_BODY_BYTES
MAX_UPLOAD_BYTES
DB_POOL_MIN
DB_POOL_MAX
DB_POOL_TIMEOUT_SECONDS
HEALTH_REQUIRE_REDIS
WORKER_ENABLED
LOG_LEVEL
SENTRY_DSN (or equivalent)
```

Never expose server secrets with an `EXPO_PUBLIC_` prefix; those values are compiled into mobile builds.

## 12. Load testing

Test staging, never live payments. Cover login, fare estimates, ride creation, driver heartbeats, nearby-driver offers, concurrent acceptance, trip tracking, chat, histories, scheduled dispatch and replayed Paystack webhooks.

Initial quality gates—not capacity promises:

```text
REST p95 below 1.5 seconds for normal operations
Unexpected error rate below 1%
Realtime event p95 below 1 second in-region
No duplicate acceptance, settlement, debit, credit or dispatch
No database pool exhaustion
Authoritative trip state survives an API restart
```

Record instance/database size, socket count, driver update frequency, duration and dataset size with every result.

## 13. Scale stages

These are planning estimates, not benchmarks.

- **Up to 1,000 registered users:** one API instance may be sufficient after rate limiting, monitoring, backups and staging tests.
- **Around 10,000:** likely pressure is location writes, proximity search, socket fan-out and DB connections. Add Redis, geospatial matching, shared realtime, a worker and multiple tested API instances.
- **Around 100,000:** use cursor pagination, data retention/partitioning, autoscaling, query monitoring and replicas for suitable reporting reads.
- **Around 1,000,000:** consider isolating realtime/dispatch, payments and reporting only where measurements justify it; add regional resilience and disaster-recovery exercises.

## 14. Priorities

### Do now

- Add persistent limits to authentication and sensitive endpoints.
- Confirm maximum page sizes on every growing list.
- Verify unique references and transactional/idempotent wallet handling.
- Add request IDs, structured logs, readiness and error monitoring.
- Audit production builds for disabled bypass flags and embedded secrets.
- Back up PostgreSQL and test restoration.

### Before multiple API instances

- Add Redis-backed fan-out, presence and latest locations.
- Make the scheduled worker single-leader.
- Concurrency-test ride acceptance and payment paths.
- Configure graceful shutdown and WebSocket-aware load balancing.
- Run mixed REST/WebSocket staging tests.

### At sustained growth

- Add PostGIS or Redis GEO.
- Move non-blocking work to a durable queue.
- Optimise measured slow queries and adopt cursor pagination.
- Apply location retention/partitioning.
- Add replicas or service separation only when metrics justify them.

## 15. Status summary

| Area | Status |
| --- | --- |
| Passenger and driver mobile clients | Implemented |
| Shared FastAPI/PostgreSQL backend | Implemented |
| Database pool and timeouts | Implemented |
| Cloud object storage | Implemented |
| Paystack funding/withdrawal | Implemented; reconciliation must be monitored |
| Single-instance WebSocket trips/chat/calls | Implemented |
| Scheduled-ride loop | Implemented in process; unsafe to duplicate without locking |
| Shared Redis presence/pub-sub | Not found in inspected dependencies/configuration |
| Persistent distributed rate limiting | Not implemented; required hardening |
| Durable job queue | Not implemented |
| Multi-instance realtime | Not ready until shared fan-out/presence is added |
| Capacity benchmark | Not established; staging load tests required |

---

This document separates verified current behavior from recommendations. Scaling decisions should follow measured latency, database pressure, socket volume, dispatch time and payment reliability—not registered-user count alone.
