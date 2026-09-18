Implement complete production push notifications for:

1. JosRide passenger app
2. JosRide Driver app
3. JosCity mobile app
4. Their corresponding backends

The goal is to display operating-system popup notifications when an app is open, backgrounded or closed. WebSockets must remain responsible for live in-app updates, while remote push notifications cover backgrounded, closed and disconnected clients.

First inspect the repositories and document the existing notification implementation. Reuse working code and complete only what is missing. Do not create duplicate notification systems or change unrelated features.

TECHNOLOGY

The mobile apps use Expo/React Native and EAS. Use:

- expo-notifications
- expo-device
- expo-constants
- Expo Push Service
- FCM V1 for Android
- APNs for iOS

Do not use Expo Go as the production test environment. Test using signed development, preview or production builds.

MOBILE IMPLEMENTATION

For each app:

1. Install compatible Expo notification packages using `npx expo install`.
2. Configure the `expo-notifications` config plugin.
3. Read the EAS project ID from Expo Constants when obtaining an Expo push token.
4. Request notification permission at an appropriate point after explaining why it is needed.
5. Handle Android 13+ `POST_NOTIFICATIONS` runtime permission.
6. Do not repeatedly prompt after permission is denied. Provide a button that opens system settings.
7. Create Android channels:
   - `messages`: HIGH importance, sound and vibration
   - `notifications`: HIGH importance
   - `rides`: MAX importance for important JosRide trip events
   - `payments`: HIGH importance for wallet/payment results
8. Configure an Android notification icon and brand colour. The icon must be a valid monochrome transparent notification icon.
9. Obtain the Expo push token only on supported physical devices.
10. Register the token with the correct backend after login and whenever the token changes.
11. Store the installation/device identifier locally so the same registration can be updated.
12. Disable or unregister the token on logout without deleting other devices belonging to that user.
13. Configure the foreground notification handler so banners, notification-list entries, sound and badges are shown when appropriate.
14. Handle notification taps when:
   - the app is foregrounded;
   - the app is backgrounded;
   - the notification launches a terminated app.
15. Deep-link users to the correct screen.
16. Fetch authoritative data from the API after opening a notification. Do not trust sensitive or stale push payload data.
17. Preserve existing WebSocket behaviour and avoid displaying duplicate in-app and push alerts.

TOKEN STORAGE

Add a database-backed device registration model/table with fields equivalent to:

- id
- user_id
- app_name: `josride`, `josride_driver` or `joscity`
- platform: `android` or `ios`
- expo_push_token
- installation_id
- enabled
- app_version
- created_at
- updated_at
- last_seen_at

Requirements:

- A user may have multiple devices.
- A token must be unique.
- Reinstalling or changing tokens must not create uncontrolled duplicates.
- Users must never receive notifications intended for another app or account role.
- Token-registration endpoints require authentication.
- Add register, refresh and disable/unregister endpoints.
- Never expose one user’s tokens to another user or return tokens in ordinary profile responses.

BACKEND DELIVERY

Create a reusable push-notification service in each relevant backend.

The service must:

1. Load active tokens for the intended user and app.
2. Send notifications through the Expo Push API in batches.
3. Set title, body, sound, priority, Android channel and a small routing-data payload.
4. Record notification delivery attempts without storing secrets.
5. Process Expo push tickets and receipts.
6. Disable tokens reported as `DeviceNotRegistered`.
7. Retry temporary errors with bounded exponential backoff.
8. Avoid retrying permanent errors.
9. Use an idempotency/event key to prevent duplicate pushes.
10. Never block a successful message, trip or wallet operation merely because push delivery failed.
11. Keep existing database notifications as the source for the notification centre.
12. Do not put access tokens, passwords, full messages, bank details, exact addresses or sensitive identity information in push payloads.

TRIGGERS

JosCity:

- New direct message
- Reply to a message where supported
- New follower/friend activity
- Comment, reply or reaction
- Business order or order-status update
- Marketplace/payment update
- Relevant account, moderation or security notice

JosRide passenger:

- Driver assigned
- Driver arriving or arrived
- Ride accepted, started, completed or cancelled
- Scheduled-ride reminder and dispatch
- New driver chat message
- Incoming call or missed call
- Wallet funding, transfer, withdrawal or refund result
- Support response
- Safety/account notice

JosRide Driver:

- New ride or delivery offer
- Offer withdrawn, expired or assigned elsewhere
- Passenger message
- Incoming or missed call
- Passenger cancellation
- Scheduled work reminder
- Trip-status action required
- Earnings, withdrawal or refund result
- Driver-document, vehicle or account approval update
- Support or safety notice

For noisy events such as location updates, do not send push notifications.

ROUTING DATA

Use a small versioned payload such as:

{
  "type": "message",
  "entityId": "conversation-or-ride-id",
  "screen": "messages",
  "app": "josride",
  "eventId": "unique-event-id",
  "version": 1
}

Implement a central route resolver instead of spreading navigation logic across screens. Validate allowed routes and ignore invalid payloads.

DUPLICATE PREVENTION

If a recipient is actively viewing the relevant conversation or trip through WebSocket, suppress the popup when appropriate. Otherwise send the push. Ensure one business event produces no more than one push per registered installation.

SECURITY AND PRIVACY

- Keep FCM V1 service-account JSON and APNs credentials outside source control.
- Add secret credential files to `.gitignore`.
- It is acceptable to commit `google-services.json`, but never commit the FCM service-account private key.
- Do not add secret values to variables beginning with `EXPO_PUBLIC_`.
- Respect notification permission and saved notification preferences.
- Add per-category preferences for messages, rides/orders, payments and general updates.
- Transactional and safety notifications must not be used for advertising.
- Do not expose private message content on the lock screen when the user disables message previews.

CONFIGURATION

Inspect existing environment-variable naming and extend it consistently. Add documented variables equivalent to:

- PUSH_NOTIFICATIONS_ENABLED
- EXPO_PUSH_ACCESS_TOKEN, only if enhanced Expo push security is enabled
- PUSH_RECEIPT_CHECK_ENABLED
- PUSH_BATCH_SIZE
- PUSH_MAX_RETRIES

Do not use the existing FCM server-key placeholder as a substitute for FCM V1 credentials.

TESTS

Add tests for:

- authenticated token registration;
- multiple devices per user;
- logout disabling only the current installation;
- role/app isolation;
- message trigger;
- JosRide trip trigger;
- payment trigger;
- duplicate-event suppression;
- invalid/expired token removal;
- provider timeout/failure without failing the main operation;
- notification-tap route resolution;
- foreground, background and terminated-app handling.

Provide a manual test checklist for Android and iOS covering permission allowed, denied, later enabled in settings, foreground, background, force-closed app, logout, multiple devices and notification taps.

DELIVERABLES

After implementation, provide:

1. Files changed in each project.
2. Database migration and rollback instructions.
3. New environment variables.
4. Firebase/FCM setup steps for every Android package.
5. Apple/EAS credential setup steps for every iOS bundle identifier.
6. Commands for producing new binaries.
7. A physical-device testing checklist.
8. Any console actions that I must perform manually.
9. Any unfinished item that requires credentials or access you do not have.

Do not claim that delivery works until a real production or preview build receives a test push while foregrounded, backgrounded and terminated.