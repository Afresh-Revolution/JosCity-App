# Plateau map UI handoff

Routes: `/map` (Explore), `/business/map` (business overview), `/agents/map` (agent dashboard). Website has matching routes; the shared sidebar Map entry adapts to a signed-in business account. Existing account navigation stays visible.

UI only: schematic map placeholder, search placeholder, Places/Businesses/Deliveries panels, locked business address/Add to map form, help guide and optional location introduction. The map illustration is not a geographic boundary. No environment files/keys were read or changed. No map SDK, map requests, GPS calls, payment, entitlement or backend code was added.

Integration owned by the map/backend work:
- Supply actual Plateau State geometry, viewport/boundary limits and existing place data. Filter searches and listing coordinates to the state, not just a bounding rectangle. The present UI does not enforce geography.
- Supply published business locations only after the server verifies paid access. Enable Add to map from authoritative entitlement; never infer payment from local UI state.
- Resolve agent pickup/drop-off pins from authorized assigned jobs only; do not publish customers' locations as public markers.
- Wire the introduction to first-launch onboarding and native while-in-use permission. Persist the decision and handle denied/restricted access with manual browsing. Do not make browsing depend on location consent. No first-launch behavior or OS permission request exists yet.
- Connect search, marker details, recentering, directions, map loading/error/offline states and listing publication once services are ready.
- Configure platform-specific map keys/restrictions with the other implementation. Never expose server secrets in frontend environment variables.

## Location permission update
Foreground permission now requests once from the native app root using a feature-specific persisted key, covering existing installs after updating as well as new installs. Already granted and permanently denied permissions are respected; errors stay retryable. Map Location access offers a manual retry/settings path. No coordinates are read, stored or sent, and no background permission is requested. First-launch behavior is now connected on native only; website permissions remain explicit UI previews. A new native binary including expo-location and its permission configuration is required; an OTA-only update cannot add the native module.
