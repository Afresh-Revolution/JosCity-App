# Live agent and map integration

`AgentScreen`, `AgentServicesScreen` and `PlateauMapScreen` route to the live API-driven screens. `src/api/agent.ts` defines the typed contract; `src/state/useAgentWorkspace.ts` and `usePlateauMap.ts` supply the workflows used by both app and website.

Backend contract and deployment instructions: `../New_Joscity/HELP_ME_BUY_DELIVER_FRONTEND_INTEGRATION.md`, September 18 update. Apply migration 078 after 065–077, configure the server Places key and map publication price, configure native/web Google Maps keys, then rebuild the native app. No production migration or payment is performed by this source change.

The old preview state/components are legacy only. Real job stages come from `stage_label`, final delivery confirmation belongs to the requester, and external vendor payouts await admin processing. Location sharing is opt-in and foreground-only. Coverage is an approximate service rectangle, not a legal state boundary.

Business map publication defaults to the agreed **NGN 5,000** on the server. Request/job lists are paginated; web agent/map/admin screens load on demand.

## Verification, September 18, 2026

- Mobile and website TypeScript checks pass.
- Expo production exports pass for iOS, Android, and web.
- Website Vite/PWA production build passes (existing Sass and unrelated image-path warnings remain).
- 18 backend regression tests and 8 mobile contract/permission tests pass. Database doubles cover concurrent funding, rollback, permissions, private data, routing, and payment retry behavior.
- No browser was connected for visual QA. Native device permissions/maps, OTP/NIN, Cloudinary uploads, bank payout processing, and real database transactions still require staging acceptance testing.
- No database migrations, live payments, or deployments were performed. Website/browser and backend Places API keys still need configuration. Native Maps keys must have the appropriate SDKs and app restrictions enabled before rebuilding the native app.
