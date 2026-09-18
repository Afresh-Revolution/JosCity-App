# Push delivery verification

Client fixes: native APNs/FCM token rotation now resolves an Expo token before POSTing; startup registration can retry; resume, reconnect and foreground retry resync registration for the authenticated account; separate events for the same entity no longer suppress one another; background chat alerts are not hidden by stale local focus.

Automated checks: `node --test tests/push.test.cjs` and TypeScript.

End-to-end delivery is not verified. The server source and a physical-device session are not available in this workspace. Check the server `/notifications/push-token` registration response, token ownership on account switching, event dispatch for friend requests/messages/likes/comments, Expo push tickets and receipts, and APNs/FCM credentials. Android app.json has no googleServicesFile configured; verify the native build supplies the correct Firebase configuration before rebuilding. Do not invent Firebase credentials.

On a native development/production build, use two test accounts to exercise each event while the receiving app is foregrounded, backgrounded and closed. Verify banners, sound and tap navigation. Repeat for personal and business accounts, after switching accounts and after an offline login/reconnect. Respect device permissions and saved social/messages preferences.

Agent login is still a UI preview and does not create an authenticated agent account. Agent notification screens are isolated empty previews and never load the current personal/business account's inbox or unread counts. Browser push is not implemented by the native Expo notifications path; the website retains the in-app notification centre.
