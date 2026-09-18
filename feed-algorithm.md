Implement a proper deterministic Feed Session Seed system.

This is critical to the JosCity Feed.

When the user begins a new Feed session, create a unique feedSessionId.

Example:

feedSessionId = UUID()

Internally derive a deterministic seed using:

hash(userId + feedSessionId)

Do NOT expose the raw ranking seed to the client.

The client should only receive and return the feedSessionId.

For every candidate post, derive a stable pseudo-random value using something conceptually similar to:

seededRandom(feedSeed + postId)

This means that within a single Feed session:

* each post receives the same exploration/random value
* rankings remain stable
* pagination remains stable
* posts do not randomly jump between pages
* duplicate posts are prevented
* infinite scrolling behaves correctly

The random factor must only be a small component of the final ranking score.

For example:

finalScore =
relevanceScore
+ freshnessScore
+ engagementScore
+ interestScore
+ locationScore
+ trendingScore
+ qualityScore
+ deterministicExplorationScore
- seenPenalty
- repetitionPenalty

Where:

deterministicExplorationScore =
seededRandom(feedSeed + postId) * explorationWeight

The exploration weight should be configurable and should normally contribute only a relatively small percentage of the final ranking.

Do NOT use:

Math.random()

inside Feed ranking on every request.

Do NOT use:

ORDER BY RANDOM()

for the personalized Feed.

Those approaches will make pagination unstable.

========================================
FEED SESSION LIFECYCLE

Create a new Feed session when:

1. User opens the Feed without an existing valid session.
2. User explicitly performs pull-to-refresh.
3. Existing Feed session expires.
4. App starts a substantially new browsing session.

Reuse the current session when:

1. User scrolls.
2. User requests the next page.
3. User navigates into a post and returns shortly afterwards.
4. Normal infinite scrolling continues.

Recommended session lifetime:

15-30 minutes.

Make this configurable.

Example:

FEED_SESSION_TTL_MINUTES=30

If Redis already exists, preferably store lightweight Feed session metadata there.

Example:

feed-session:{userId}:{feedSessionId}

{
seed,
createdAt,
expiresAt
}

Do not store the entire Feed in Redis unless performance testing demonstrates that it is necessary.

========================================
PULL TO REFRESH

When the user performs an explicit pull-to-refresh:

invalidate/finish the current Feed session.

Generate:

new feedSessionId
new internal seed

Regenerate candidates and rerank them.

This allows the Feed to feel fresh.

However, the new seed must not completely destroy relevance.

Strong posts should usually remain strong.

The seed should primarily change the ordering of similarly ranked posts and introduce limited exploration.

Example:

Previous session:

Post A = 92.4
Post B = 91.8
Post C = 90.9
Post D = 76.3

New session may produce:

Post B
Post A
Post C
Post D

It should NOT normally produce:

Post D
Post C
Post B
Post A

purely because of randomness.

========================================
MULTI-DEVICE BEHAVIOR

Different devices/sessions belonging to the same user may have separate Feed sessions.

Therefore the exact ordering does not need to be identical across two devices.

The underlying personalization profile should still be shared because it belongs to the user.

This gives JosCity the desired behavior:

Same database
+
same user interests
+
different session seeds

similar but not identical Feed ordering.

========================================
CURSOR PAGINATION

The pagination cursor should contain or reference enough information to continue the exact same ranking session.

Prefer an opaque cursor.

Conceptually it may encode/reference:

feedSessionId
lastScore
lastPostId
pagination position

Do not trust mutable ranking values supplied directly by the client.

Sign/encrypt the cursor or store the pagination state server-side if the existing architecture makes that appropriate.

The backend must guarantee:

No duplicate posts between pages.

No skipped posts caused by re-randomization.

No new seed during normal pagination.

========================================
TEST THIS BEHAVIOR

Add tests proving:

1. Same user + same feedSessionId returns stable ordering.
2. Same user + same feedSessionId + pagination produces no duplicate posts.
3. Same user + new feedSessionId produces some ordering variation.
4. Different users can receive different ordering.
5. High-ranking relevant content is not destroyed by random exploration.
6. Expired sessions create new sessions.
7. Pull-to-refresh creates a new session.
8. Feed pagination cannot accidentally regenerate the seed.
9. Invalid/tampered feedSessionId is safely rejected or replaced.
10. Redis failure, if Redis is used, has a safe fallback.

The Feed Session Seed must be implemented on the backend and treated as part of the recommendation architecture, not as a frontend shuffle.