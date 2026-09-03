You are a senior software architect and full-stack engineer. I want you to audit and upgrade this existing application so it is architected for production use and can scale from a small user base to tens of thousands, hundreds of thousands, and eventually millions of users without requiring a complete rewrite.

IMPORTANT:
- First inspect the entire existing codebase before making changes.
- Do not assume the technology stack. Identify the frontend, backend, database, hosting/infrastructure assumptions, authentication system, real-time functionality, file storage, payments, notifications, APIs, and third-party services already being used.
- Preserve existing functionality and UI unless a change is necessary for scalability, security, reliability, or performance.
- Do not unnecessarily rewrite working parts of the application.
- Prefer incremental, production-safe improvements.
- Do not introduce microservices unless the current architecture genuinely requires them.
- A modular monolith is preferred initially where appropriate.
- Do not hardcode secrets, API keys, credentials, URLs, limits, or environment-specific configuration.
- Use environment variables and provide/update `.env.example`.
- Follow the conventions already used by the project where sensible.

## PHASE 1 — AUDIT THE CURRENT APPLICATION

Before modifying code, inspect the project and determine:

1. Frontend framework and architecture.
2. Backend framework/runtime.
3. Database type and ORM/database client.
4. Authentication and authorization implementation.
5. Current API structure.
6. Hosting/deployment assumptions.
7. File/image storage strategy.
8. Whether Redis or another cache exists.
9. Whether background jobs/queues exist.
10. Whether WebSockets or realtime functionality exists.
11. Payment architecture, if applicable.
12. Notification architecture.
13. Logging/error handling implementation.
14. Current database indexes and potentially expensive queries.
15. Existing pagination strategy.
16. Rate limiting/security protections.
17. Monitoring/observability.
18. Existing automated tests.
19. Potential single points of failure.
20. The largest scalability risks.

Create a concise audit before implementation and classify findings as:

- CRITICAL
- HIGH
- MEDIUM
- LOW

Then proceed with implementation. Do not stop after the audit unless a change would be destructive or requires credentials/infrastructure that cannot reasonably be provisioned from the repository.

---

# PHASE 2 — MAKE THE BACKEND STATELESS

Ensure the backend can run multiple instances simultaneously behind a load balancer.

Do not rely on in-memory application state for:

- authentication sessions
- user state
- temporary transactions
- rate limits
- jobs
- notifications
- realtime coordination
- caches that must be shared between servers

Move shared state to the appropriate persistent/shared service.

If server-side sessions exist, make them compatible with multiple backend instances.

Ensure application instances can be created and destroyed without losing important application state.

---

# PHASE 3 — DATABASE SCALABILITY

Audit all database access.

Implement or improve:

### Indexes

Add appropriate indexes for fields commonly used in:

- WHERE clauses
- JOINs
- ORDER BY
- foreign keys
- lookup fields
- status fields where appropriate
- timestamps used for feeds/history
- user IDs
- geographic queries, if applicable

Do not add unnecessary indexes.

Create proper migrations for database changes.

### Query optimization

Identify:

- N+1 queries
- full table scans
- unnecessary joins
- unnecessary SELECT *
- duplicated database calls
- expensive aggregation
- unnecessary synchronous writes

Fix them where appropriate.

### Connection pooling

Ensure database connection pooling is configured correctly.

The application must not create a new database connection for every incoming request.

Make pool limits configurable using environment variables.

### Transactions

Use transactions for operations where multiple database mutations must succeed or fail together.

Especially inspect:

- payments
- bookings/orders/rides
- wallet transactions
- account balances
- inventory
- critical status transitions

### Concurrency

Protect against race conditions.

Use appropriate techniques such as:

- transactions
- row-level locking
- optimistic concurrency
- unique constraints
- idempotency

where necessary.

---

# PHASE 4 — PAGINATION

Find every API or database operation that can return an unbounded collection.

Do not allow endpoints to return unlimited records.

Implement pagination.

Prefer cursor-based pagination for large or frequently changing datasets.

Example response structure:

```json
{
  "data": [],
  "pagination": {
    "nextCursor": "...",
    "hasMore": true
  }
}
```

Set sensible default and maximum limits.

Example:

```text
default limit: 20
maximum limit: 100
```

Do not trust client-provided limits without validation.

Maintain backward compatibility where possible.

---

# PHASE 5 — REDIS / DISTRIBUTED CACHE

If Redis is not currently configured and the application's architecture supports it, introduce Redis cleanly.

Create a reusable cache abstraction rather than scattering Redis calls throughout the codebase.

Use caching selectively for appropriate workloads such as:

- frequently accessed configuration
- expensive repeated queries
- temporary data
- rate limiting
- distributed locks where required
- session storage if server-side sessions are used
- repeated location/reference data
- frequently requested public data

Do NOT cache everything.

Implement TTLs.

Use a clear key naming convention such as:

```text
app:user:{id}
app:config:{key}
app:search:{hash}
```

Implement cache invalidation for data that changes.

The application should degrade gracefully if Redis temporarily becomes unavailable where technically appropriate.

---

# PHASE 6 — BACKGROUND JOB QUEUE

Identify operations currently performed synchronously that should happen asynchronously.

Examples include:

- sending email
- sending SMS
- push notifications
- image processing
- analytics events
- report generation
- webhook delivery
- non-critical third-party API calls
- cleanup operations
- heavy data processing

Introduce a job queue compatible with the current stack.

For Node.js, BullMQ + Redis is acceptable if appropriate.

Structure it cleanly, for example:

```text
jobs/
workers/
queues/
```

Jobs should support:

- retry attempts
- exponential backoff
- failure handling
- structured logging
- idempotency where necessary

Do not put critical payment confirmation logic into an unreliable fire-and-forget process.

---

# PHASE 7 — RATE LIMITING

Implement distributed rate limiting.

Protect sensitive endpoints more aggressively.

Examples:

### Login
5–10 attempts per minute per IP/account.

### Password reset / OTP
Very restrictive limits.

### Registration
Restrict automated account creation.

### Search
Reasonable limits.

### General APIs
Higher but bounded limits.

### Expensive endpoints
Custom lower limits.

Return proper HTTP 429 responses.

Where Redis exists, use a distributed implementation so rate limits still work when multiple backend instances are running.

---

# PHASE 8 — SECURITY HARDENING

Audit and improve:

- authentication
- authorization
- password hashing
- JWT/session security
- token expiry
- refresh token handling
- input validation
- SQL injection protection
- XSS
- CSRF where applicable
- CORS
- mass assignment
- insecure direct object references
- file uploads
- API abuse
- sensitive error leakage
- secrets management

Ensure every protected resource checks authorization server-side.

Never rely only on the frontend to determine whether a user can access something.

For privileged functionality implement appropriate roles/permissions.

Example:

```text
USER
DRIVER
AGENT
ADMIN
SUPER_ADMIN
```

Only use roles relevant to this application.

---

# PHASE 9 — IDEMPOTENCY

Implement idempotency where duplicate requests could create serious problems.

Prioritize:

- payments
- withdrawals
- bookings
- ride/order creation
- wallet operations
- refunds
- webhook processing

Example:

```text
Idempotency-Key: <unique-request-id>
```

Repeated requests with the same valid key must not create duplicate transactions.

---

# PHASE 10 — FILE AND IMAGE STORAGE

Inspect how files/images are currently stored.

Production deployments should not depend on local server disk for persistent user-generated content.

Use or prepare an abstraction for object storage such as:

- AWS S3
- Cloudflare R2
- Google Cloud Storage
- Supabase Storage
- another compatible provider

Keep provider-specific implementation behind a storage service.

Implement:

- file size limits
- MIME validation
- secure generated filenames
- upload authorization
- image compression/resizing where appropriate
- thumbnails where appropriate

Store file URLs/keys in the database rather than binary data unless the current application has a strong reason otherwise.

---

# PHASE 11 — CDN READINESS

Ensure static and user-uploaded assets can be delivered through a CDN.

Do not proxy large static files through the primary API server unnecessarily.

Use proper caching headers where applicable.

---

# PHASE 12 — REALTIME SCALABILITY

If the application uses:

- WebSockets
- Socket.IO
- live tracking
- chat
- realtime driver/rider status
- presence
- live notifications

audit the current architecture.

It must support multiple backend instances.

If necessary, introduce a distributed pub/sub layer such as Redis.

Do not rely on a single process having knowledge of every connected socket.

Implement:

- reconnect handling
- heartbeat/ping
- connection cleanup
- authentication
- authorization
- rooms/channels where appropriate

Do not broadcast sensitive updates globally.

---

# PHASE 13 — GEOLOCATION / MAP SCALABILITY

If this application uses locations, maps, nearby users, drivers, vehicles, stores, deliveries, or geographic searches:

Do NOT retrieve every record and calculate distance in application code.

Use a geospatial index.

If PostgreSQL is used, evaluate PostGIS.

Implement efficient nearby queries based on:

```text
latitude
longitude
radius
availability/status
```

Add the necessary spatial indexes.

Only return a bounded number of candidates.

Example:

```text
Find active drivers within X km
→ sort by proximity
→ return nearest 20–50
```

Do not continuously write GPS coordinates to the primary database at an unnecessarily high frequency.

If live location updates are frequent, introduce a scalable temporary location/state strategy where appropriate.

---

# PHASE 14 — API VERSIONING

Prepare the API for mobile clients that may remain on older application versions.

Use a strategy such as:

```text
/api/v1/
```

Do not break existing clients unnecessarily.

If introducing versioning would currently be disruptive, create an architecture that allows future versions cleanly.

---

# PHASE 15 — REQUEST VALIDATION

Every endpoint accepting external data should validate it before business logic executes.

Use the validation solution most appropriate for the existing stack.

Validate:

- body
- query parameters
- path parameters
- enums
- dates
- IDs
- pagination
- coordinates
- monetary values
- uploaded files

Return consistent validation errors.

---

# PHASE 16 — STANDARD API RESPONSE/ERROR STRUCTURE

Normalize API errors.

Example success:

```json
{
  "success": true,
  "data": {}
}
```

Example error:

```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Resource not found"
  }
}
```

Do not expose:

- stack traces
- SQL queries
- secrets
- internal infrastructure information

to production clients.

Preserve existing response contracts if changing them would break the application.

---

# PHASE 17 — HEALTH CHECKS

Add lightweight infrastructure health endpoints.

Example:

```text
GET /health
```

Should verify basic application availability.

Optionally add:

```text
GET /health/ready
GET /health/live
```

where suitable.

Do not expose sensitive system information.

These endpoints should support load balancers/container orchestration.

---

# PHASE 18 — GRACEFUL SHUTDOWN

Implement proper shutdown handling.

When a server instance receives termination signals:

1. Stop accepting new requests.
2. Finish active requests where feasible.
3. Stop workers.
4. Close database connections.
5. Close Redis connections.
6. Close realtime connections appropriately.
7. Exit cleanly.

This is required for autoscaling and rolling deployments.

---

# PHASE 19 — TIMEOUTS, RETRIES AND CIRCUIT PROTECTION

Audit external API calls.

Every outbound network call should have a timeout.

Do not allow requests to hang indefinitely.

Use retries only where safe.

Use exponential backoff where appropriate.

Do not blindly retry payment mutations or other non-idempotent operations.

Introduce circuit-breaker behavior where repeated third-party failures could exhaust server resources.

---

# PHASE 20 — OBSERVABILITY

Introduce structured production logging.

Logs should include where appropriate:

```text
timestamp
requestId
userId
route
method
status
duration
service
errorCode
```

Never log:

- passwords
- full authentication tokens
- private keys
- OTP secrets
- sensitive payment data

Add a request/correlation ID.

Ensure one request can be traced through API operations and jobs.

Prepare integration points for tools such as:

- Sentry
- OpenTelemetry
- Datadog
- Grafana
- CloudWatch

Use whichever best matches the existing stack.

---

# PHASE 21 — METRICS

Expose or collect metrics for:

- request count
- requests per second
- response latency
- p50/p95/p99 latency
- error rate
- active connections
- database query performance
- connection pool usage
- cache hit/miss rate
- queue depth
- failed jobs
- external API latency

Structure the implementation so monitoring can be added without changing business logic.

---

# PHASE 22 — DATABASE READINESS FOR REPLICAS

Separate database access patterns where practical into:

```text
read
write
```

Do not prematurely configure replicas if the infrastructure doesn't have them.

Instead, ensure the data access architecture can support read replicas later without rewriting the application.

Critical consistency-sensitive reads should still go to the primary database.

---

# PHASE 23 — CONFIGURATION MANAGEMENT

Centralize environment configuration.

Validate required environment variables during startup.

The server should fail clearly if a critical variable is missing.

Example categories:

```text
DATABASE_URL
REDIS_URL
JWT_SECRET
APP_ENV
PORT
STORAGE_*
EMAIL_*
SMS_*
PAYMENT_*
SENTRY_*
```

Use only variables relevant to this application.

Update `.env.example` without inserting real secrets.

---

# PHASE 24 — DOCKER / CONTAINER READINESS

If appropriate for the project, provide production-ready Docker support.

The application container should be:

- stateless
- reproducible
- reasonably small
- non-root where practical
- configurable entirely through environment variables

Add:

```text
Dockerfile
.dockerignore
```

if missing and useful.

Do not force Docker into a deployment setup where the project clearly uses another platform abstraction successfully.

---

# PHASE 25 — AUTOSCALING READINESS

Ensure the application can safely run:

```text
Instance 1
Instance 2
Instance 3
...
Instance N
```

simultaneously.

No request should depend on reaching the same server instance twice unless explicitly required.

Identify anything preventing horizontal scaling and fix it.

---

# PHASE 26 — LOAD TESTING

Add a load-testing setup using a tool appropriate to the project, preferably k6 or Artillery.

Create tests for major flows such as:

```text
health endpoint
authentication
main dashboard/feed
search
resource creation
resource retrieval
location/nearby requests
```

Do NOT load test production systems automatically.

Create scripts and documentation allowing controlled execution against a staging environment.

Provide configurable scenarios roughly representing:

```text
100 concurrent users
1,000 concurrent users
5,000 concurrent users
10,000+ concurrent users
```

Where practical, model realistic behavior rather than hammering a single endpoint.

Track:

```text
requests/sec
p95 latency
p99 latency
error rate
timeouts
```

---

# PHASE 27 — TESTING

Add or improve automated tests for critical functionality.

Prioritize:

- authentication
- authorization
- payment/business transactions
- duplicate-request protection
- database transactions
- pagination
- rate limits
- queue workers
- API validation

Do not waste time creating superficial tests simply to increase coverage percentage.

---

# PHASE 28 — CI/CD READINESS

Inspect the repository's existing CI/CD.

If missing, create a sensible pipeline configuration compatible with the repository.

At minimum, CI should be able to run:

```text
install dependencies
lint
typecheck
test
build
```

Do not automatically deploy without understanding the project's hosting environment.

---

# PHASE 29 — ARCHITECTURAL STRUCTURE

Keep business logic modular.

The architecture should logically separate domains similar to:

```text
src/
  modules/
    auth/
    users/
    payments/
    notifications/
    admin/
    ...
  infrastructure/
    database/
    cache/
    queues/
    storage/
    logging/
  middleware/
  config/
  shared/
```

Adapt this to the existing project rather than forcing this exact structure.

Avoid creating tightly coupled modules.

---

# PHASE 30 — DO NOT PREMATURELY CREATE MICROSERVICES

Do not split this application into microservices solely for scalability.

Prefer:

```text
Modular Monolith
       ↓
Horizontal Scaling
       ↓
Cache
       ↓
Queues
       ↓
Database optimization
       ↓
Observability
```

Only identify potential future service boundaries.

Examples might include:

```text
Payments
Notifications
Realtime Tracking
Search
Analytics
```

Do not extract them unless there is already a strong technical reason.

---

# TARGET ARCHITECTURE

Where compatible with the existing application, work toward:

```text
                         USERS
                           │
                           ▼
                    CDN / WAF / Edge
                           │
                           ▼
                Load Balancer / Gateway
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
            API #1       API #2       API #N
              │            │            │
              └────────────┼────────────┘
                           │
             ┌─────────────┼─────────────┐
             ▼             ▼             ▼
         PostgreSQL      Redis        Job Queue
             │             │             │
             │             │             ▼
             │             │          Workers
             │             │
             ▼             ▼
       Read replicas   Realtime/pub-sub
        when needed      when needed

                           │
                           ▼
                     Object Storage
                           │
                           ▼
                           CDN

                     Observability
             Logs + Metrics + Errors + Alerts
```

Adapt this architecture to what is actually needed.

---

# IMPORTANT COST RULE

Scalability does NOT mean enabling expensive infrastructure immediately.

Design the application so infrastructure can grow progressively.

Target stages:

### Stage 1
1–1,000 users

Keep infrastructure inexpensive and simple.

### Stage 2
1,000–10,000 users

Introduce caching, workers, better monitoring, database tuning and horizontal scaling as traffic requires.

### Stage 3
10,000–100,000 users

Increase instances, database capacity, Redis capacity, queue workers, CDN usage and potentially read replicas.

### Stage 4
100,000–1,000,000+ users

Evaluate:

- dedicated infrastructure
- database partitioning
- read replicas
- service extraction
- advanced caching
- dedicated search
- realtime infrastructure
- regional distribution

Do not implement Stage 4 complexity unless justified now.

Make the CODE ready for these evolutions.

---

# IMPLEMENTATION RULES

While implementing:

1. Make changes in small logical groups.
2. Follow existing coding conventions.
3. Keep TypeScript strict if TypeScript is being used.
4. Do not use `any` unnecessarily.
5. Avoid duplicated business logic.
6. Use reusable abstractions.
7. Do not introduce unnecessary dependencies.
8. Remove dead code created by your changes.
9. Preserve backward compatibility.
10. Add migrations rather than manually changing schemas.
11. Update relevant tests.
12. Update documentation.
13. Ensure builds pass after changes.
14. Ensure linting passes.
15. Ensure tests pass.
16. Do not silently suppress errors.
17. Do not leave critical TODO placeholders.
18. Do not fake integrations.
19. Clearly identify features requiring external infrastructure or credentials.
20. Never commit real credentials.

---

# AFTER IMPLEMENTATION

When finished, produce a report containing:

## 1. Existing architecture

Explain what architecture you discovered.

## 2. Scalability problems found

List each significant issue.

For each include:

```text
Problem
Impact
Severity
Solution implemented
```

## 3. Changes made

List the files/modules changed and why.

## 4. Database improvements

Include:

- indexes
- migrations
- query improvements
- transactions
- concurrency protections

## 5. Caching

Explain:

- what is cached
- TTLs
- invalidation
- why those items were selected

## 6. Queue architecture

List all asynchronous jobs.

## 7. Security improvements

Explain all security-related changes.

## 8. Infrastructure requirements

Tell me exactly what external services are now needed.

Example:

```text
PostgreSQL
Redis
Object storage
Email provider
Monitoring provider
```

Do not list services that aren't actually required.

## 9. Environment variables

Document every environment variable added.

## 10. Deployment architecture

Show the recommended deployment topology.

## 11. Load testing

Explain how I can run the tests.

## 12. Scalability estimate

Give a reasoned assessment of which component is likely to become the first bottleneck at approximately:

```text
1,000 users
10,000 users
100,000 users
1,000,000 users
```

Do not claim exact capacity without benchmarks.

## 13. Remaining recommendations

Separate recommendations into:

```text
DO NOW
DO BEFORE PUBLIC LAUNCH
DO AT 10K+ ACTIVE USERS
DO AT 100K+ ACTIVE USERS
ONLY IF REQUIRED LATER
```

---

# FINAL REQUIREMENT

Do not simply explain how scalability should work.

Actually inspect and modify this repository.

Start by auditing the codebase, then implement the highest-impact improvements in priority order.

If the repository already implements any requirement correctly, do not rewrite it. Mark it as already satisfied and continue.

The final application should remain simple enough to maintain today while being structurally capable of scaling significantly as usage increases.