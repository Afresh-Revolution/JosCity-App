Feed sessions are implemented in the sibling `../New_Joscity` API and the mobile app.

Deploy the backend before releasing the mobile update. Existing clients retain their chronological page-number API; the updated main feed opts in with `sessionMode=1`. No deployment or production database changes were performed during this implementation.

The explicit PostgreSQL migration is `../New_Joscity/migrations/064_feed_sessions.sql`. From the `New_Joscity` directory, apply it to the configured database with `node scripts/run-sql.js 064_feed_sessions.sql`. It creates the same table and expiry index as runtime initialization and can be rerun safely. This migration file has been added but has not been executed against the database.

Server settings (optional):

| Variable | Default | Allowed range |
| --- | --- | --- |
| `FEED_SESSION_TTL_MINUTES` | 30 | 1–120 |
| `FEED_EXPLORATION_WEIGHT` | 2 | 0–5 |
| `FEED_CANDIDATE_LIMIT` | 500 | 100–2000 |

The existing infrastructure initialization creates `feed_sessions` and its expiry index on first use. The database role therefore needs permission to create that table and index. Expired rows are removed when a new session is created. Sessions store only ordered candidate IDs, internal seed, cursor key, timestamps, owner and scope. Post bodies remain in the posts table. Redis receives lightweight metadata only; PostgreSQL is authoritative even if Redis fails or requests reach different API workers.

Candidate generation uses the latest eligible posts, with pinned posts first, within the configured candidate limit. Ranking combines pinned priority, freshness, capped engagement, shared author interests inferred from saved/reacted posts, saved-post affinity and a small deterministic exploration score. The current backend has no full location/trending/explicit-interest recommendation model; those signals are not fabricated. Ranking is frozen for the session. New posts and changed ranking signals enter on refresh/expiry. Deleted, hidden and blocked posts are filtered when pages are read. Pagination covers the bounded candidate pool, then ends until refresh.

The client retains only the server session ID, expiry and opaque cursor, scoped to the mounted feed/account. Refresh rotates the session; normal pagination and short navigation preserve it. Returning after expiry refreshes it, and a new app process starts a new session. Invalid/removed sessions recover through a fresh first-page request. Cursors are HMAC-authenticated and bound to a database-owned session, account and feed scope. Missing pagination state and tampering are rejected. No seed or ranking score is returned to clients.

The native home feed now rejects a legacy response that lacks `feedSessionId`. This deliberately exposes an out-of-date deployment instead of rendering its chronological order as though it were ranked.

The mobile feed ignores obsolete requests, prevents simultaneous page loads, deduplicates IDs and resets on account changes. Generic HTTP response fallbacks are disabled: offline screens may retain information already loaded in their own mounted state or explicit detail/media cache, but they do not populate from a broad cached API response. A virtualized FlatList limits mounted posts and triggers infinite scrolling, retaining the load-more button for retry/accessibility.

Validation:

- `node --test tests/feedSessions.test.js` in `New_Joscity` checks stable ordering, duplicate-free pagination and retries, session/user variation, relevance preservation, expiry, refresh, device isolation, cursor/ID tampering, missing sessions, Redis failure and read-time visibility filtering.
- `node mobile/node_modules/typescript/bin/tsc --noEmit -p mobile/tsconfig.json` checks the entire mobile project.
- `node --test mobile/tests/feed.test.cjs` checks client session/cursor propagation, refresh, invalid-session recovery and tampered-cursor errors.
- The backend `npm test` suite passed all 19 tests; all 4 mobile API tests passed. Android and iOS production JavaScript/Hermes exports succeeded. The offline Expo dependency check reported compatible installed versions (it does not verify registry metadata).
- Backend tests use a database adapter double; live PostgreSQL integration, load testing and physical Android/iOS device checks remain release validation tasks.

Additional review fixes address optional author access in comments, photo-upload result narrowing, business request ID normalization, activity source typing, nullable support/event/export values and an unreachable friend-state branch. Existing unrelated workspace changes were preserved.
