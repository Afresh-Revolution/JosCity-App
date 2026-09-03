# JosCity App Store / Play Compliance Report

Audit scope: JosCity mobile (`mobile/`), supporting website legal pages (`JOSCITY/`), and account-deletion API (`../New_Joscity`), against `req.md` (Apple App Store Review Guidelines and Google Play Developer Policies).

Package: `com.joscity.app`  
Legal site: `https://joscity.com`

The previous copy of this file described **JosRide**. This report is for **JosCity** only.

## Summary

Critical and High store-risk items found in this pass were fixed in the client, website, and API. Remaining work is store-listing metadata (App Store Connect / Play Console) and a reviewer demo account. Digital membership **purchase** is gated off in the native app until StoreKit / Play Billing is implemented; marketplace checkout for physical goods and local services stays on Paystack/wallet (allowed).

---

## Critical

| Issue | Risk | Files | Change |
| --- | --- | --- | --- |
| HTTP 401 did not run the session handler (`void unauthorizedHandler`) | Critical | `mobile/src/api/client.ts` | Handler is invoked; concurrent 401s are debounced |
| Expired session left the auth token in SecureStore | Critical | `mobile/app/_layout.tsx` | 401 unregisters push, `clearSession()`, then `/welcome` |
| Play/Apple required a public **web** deletion URL; none existed | Critical | `JOSCITY/src/pages/DeleteAccount.tsx`, `main.tsx`, `Footer.tsx`; `New_Joscity/controller/accountController.js`, `routes/account.js`; `mobile/src/constants/legal.ts` | Live page `https://joscity.com/delete-account` + `POST /api/account/delete-web` |
| Contact page listed a fake phone (`+234 800 000 0000`) | Critical | `JOSCITY/src/pages/ContactPage.tsx` | Replaced with `+234 7067621916` (same number as Privacy / Terms) |

---

## High

| Issue | Risk | Files | Change |
| --- | --- | --- | --- |
| Welcome screen had no Terms / Privacy links (Guideline 5.1.1(i)) | High | `mobile/src/screens/WelcomeScreen.tsx` | Terms and Privacy Policy open `joscity.com` URLs |
| Legal screen omitted cookies, support, and web deletion | High | `mobile/src/screens/LegalScreen.tsx`, `mobile/src/i18n/en.ts` | Added Cookie policy, Contact, Delete account (web) |
| Digital membership sold in-app via wallet (Apple 3.1.1 / Play Billing) | High | `mobile/src/screens/MembershipScreen.tsx` | Subscribe/renew hidden on iOS and Android; existing status still shown |
| No way to block abusive users (Guideline 1.2) | High | `New_Joscity/services/userBlocks.js`, `friendsController.js`, `feedController.js`, `chatController.js`; `MemberProfileScreen.tsx`, `PostCard.tsx` | Block from profile and post menu; hide posts; refuse chat |
| Privacy policy did not explain deletion path or timeline | High | `JOSCITY/src/pages/PrivacyPolicy.tsx`, `mobile/src/i18n/en.ts` | Section 7: in-app + web deletion; immediate on password confirm |
| Production builds could be pointed at `http://` API | High | `mobile/src/config/env.ts` | Non-dev `http://` bases fall back to the HTTPS production API |
| Missing iOS privacy manifest / export-compliance flag | High | `mobile/app.json` | `privacyManifests` + `ITSAppUsesNonExemptEncryption: false` |
| Camera video recording had no microphone purpose string | High | `mobile/app.json` | `microphonePermission` on `expo-image-picker` |
| Upload XHR ignored 401 | High | `mobile/src/api/client.ts` | 401 on `uploadForm` clears the session |

---

## Medium

| Issue | Risk | Notes |
| --- | --- | --- |
| Membership / CBC / wallet / rewards default to “coming soon” | Medium | Feature flags remain; do not enable paid membership on store builds until IAP/Play Billing exists |
| Store reviewers need a working demo login | Medium | Seeded: `play.personal@joscity.com` and `play.business@joscity.com` (see `PLAY_CONSOLE_README.md`) |
| NIN is collected at registration | Medium | Declare **Government ID** in Play Data safety and App Store Connect App Privacy |
| UGC reporting and blocking | Medium | Report post + Block user are in the app; confirm 24-hour moderation response in review notes (Guideline 1.2) |
| Account deletion requires password | Medium | Allowed; in-app path is Settings → Delete account (not email-only) |

---

## Low / residual

- Store listing screenshots, age rating, and Data safety form are manual Console / App Store Connect steps (see `PLAY_CONSOLE_README.md` and `IOS_APP_STORE.md`).
- Marketplace, events, and wallet funding for **physical goods and services consumed outside the app** correctly use Paystack / bank transfer (Apple 3.1.3(e); not Play “financial product”).
- Tokens stay in SecureStore; user profile cache stays in AsyncStorage (non-secret).
- No third-party social login, so Sign in with Apple (4.8) is not required.
- No `NSLocationAlways…` strings (the app does not request location).
- Accessibility and empty-state polish can continue iteratively; no remaining Critical/High client blockers from this pass.

---

## Already compliant (verified, no code change)

- In-app account deletion with password, then sign-out (`AccountSettingsScreen` + `hardDeleteUser`).
- Deactivate is a **separate** pause action (Apple allows this in addition to delete; delete remains available).
- Register screens require Terms + Privacy checkbox.
- Password reset OTP on login; email activation on signup.
- Logout on personal and business profiles.
- Help & support (email, in-app report, legal links).
- HTTPS default API; Paystack/SafeHaven **public** keys only in the client.
- Photo/camera purpose strings; notifications permission.

---

## Payments (store rules)

| Product | Store rule | JosCity handling |
| --- | --- | --- |
| Marketplace goods / local services | Must **not** use IAP (3.1.3(e)) | Paystack / wallet / bank — keep this framing in listings |
| Wallet top-up for those goods | Same | Allowed |
| Digital membership / unlocking app features | Must use IAP / Play Billing (3.1.1) | Purchase buttons **disabled** on native apps until StoreKit + Play Billing ship |
| CBC points | Earn-only in the app | Do not sell points in-app without IAP |

Do **not** add a button that sends iOS users to the website to buy membership (3.1.3(b)).

---

## Manual steps (developer)

1. Deploy website so `https://joscity.com/delete-account` and updated privacy policy are live.
2. Restart **New_Joscity** so `POST /api/account/delete-web` and block routes are loaded. Run `npm run migrate -- migrations/045_user_blocks.sql` from `New_Joscity` if the API has not created `user_blocks` yet.
3. Play Console: Data safety **account deletion URL** = `https://joscity.com/delete-account`. Privacy = `https://joscity.com/privacy-policy`.
4. App Store Connect: Privacy Policy URL, Support URL (`https://joscity.com/contact`), App Privacy nutrition labels, export compliance = no non-exempt encryption.
5. Review notes: path to delete (Profile → Account settings → Delete account); demo logins; payments are for physical goods/services, not IAP digital goods.
6. Rebuild the Expo app after `app.json` privacy/microphone changes (`npx expo prebuild` / EAS).
7. Smoke-test: login, 401/expiry, logout, in-app delete, web delete, Terms/Privacy taps, camera/photos permission prompts, membership screen has no Subscribe on device.

---

## Fixed in this pass (file index)

**Mobile:** `app.json`, `app/_layout.tsx`, `src/api/client.ts`, `src/config/env.ts`, `src/constants/legal.ts`, `src/i18n/en.ts`, `src/screens/WelcomeScreen.tsx`, `src/screens/LegalScreen.tsx`, `src/screens/MembershipScreen.tsx`, `src/screens/MemberProfileScreen.tsx`, `src/components/feed/PostCard.tsx`, `src/api/social.ts`

**Website:** `JOSCITY/src/pages/DeleteAccount.tsx`, `PrivacyPolicy.tsx`, `ContactPage.tsx`, `Footer.tsx`, `main.tsx`

**API:** `../New_Joscity/controller/accountController.js`, `../New_Joscity/routes/account.js`, `../New_Joscity/services/userBlocks.js`, `../New_Joscity/controller/friendsController.js`, `../New_Joscity/controller/feedController.js`, `../New_Joscity/controller/chatController.js`, `../New_Joscity/migrations/045_user_blocks.sql`
