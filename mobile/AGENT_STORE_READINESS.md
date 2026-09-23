# Agent account store readiness

Reviewed 18 September 2026. These changes add UI previews, not a certification of store compliance. Do not submit unfinished agent functionality as production-ready.

## Settings provided
Personal details; verification & security; notification settings; data download; device permissions; privacy/terms/community and child-safety policies; report a safety concern; blocked accounts; contact support; deactivate account; delete account; membership ID; referrals; appearance.

The new controls never invoke the currently signed-in Personal or Business account's destructive, export, moderation or verification APIs. Agent auth and backend are not connected. No request is presented as submitted. Deactivation is explicitly distinct from deletion.

## Required before enabling agent accounts in a store build
- Connect authenticated agent account deletion from inside the app, including associated content/data. Support email alone and temporary deactivation do not replace deletion. Provide appropriate confirmation, reauthentication, progress and completion states. Disclose any lawful retention and timing accurately. Verify deletion of the correct account and access revocation.
- Make the external website deletion request path functional and accessible without reinstalling the app; enter its URL in Play Console. Existing /delete-account policy/page is not proof that agent deletion works.
- Connect report submission, moderation handling and block/unblock enforcement to agent identity. Cover posts, direct messages, profiles and job interactions. A settings entry alone does not meet UGC safeguards. Verify shared feed behavior in an actual agent session.
- Publish applicable child-safety standards, provide in-app reporting, designate the required child-safety contact in Play Console and establish response/escalation processes for a social app.
- Ensure privacy policy accurately describes agent identity documents, location, photos, messages, transactions, service providers, retention and deletion. Complete Apple App Privacy and Google Play Data safety based on actual SDK/backend behavior.
- Request minimum permissions at point of use, provide truthful purpose strings/disclosures, support denial, and test device permission settings. Notification preference previews do not configure push delivery.
- Test security, data export, deactivation and membership issuance once connected. Data export, referrals and membership cards are product features, not universal store-mandated sections.
- Audit paid features before launch: physical purchase/delivery services and paid digital memberships have different store billing rules. If digital subscriptions are offered, implement required purchase restoration and subscription management as applicable; no paid agent subscription is implemented here.
- Provide accurate age/content ratings, support/privacy URLs, working reviewer access, live backend and complete features. Validate sign-in requirements if third-party login is offered, including Apple's applicable equivalent-login rules. Test production builds on iOS and Android; hide unfinished agent features from a public release until ready.

## Primary sources
- Apple review guidelines (1.2, 2.1, 3.1, 4.8, 5.1): https://developer.apple.com/app-store/review/guidelines/
- Apple account deletion: https://developer.apple.com/support/offering-account-deletion-in-your-app/
- Google account deletion: https://support.google.com/googleplay/android-developer/answer/13327111?hl=en
- Google UGC: https://support.google.com/googleplay/android-developer/answer/9876937?hl=en
- Google social app child-safety standards: https://support.google.com/googleplay/android-developer/answer/14747720?hl=en

Store approval remains a platform review decision; these UI additions do not guarantee it.
