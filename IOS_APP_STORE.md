# iOS App Store Connect — JosCity (`com.joscity.app`)

Checklist for first submission and for Guideline 5.1.1 / 3.1.x reviews. Apple’s rules are in the [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/).

Bundle ID: `com.joscity.app`

---

## Required URLs (App Information / Version)

| Field | Value |
|------|--------|
| Privacy Policy URL | `https://joscity.com/privacy-policy` |
| Support URL | `https://joscity.com/contact` |
| Marketing URL (optional) | `https://joscity.com` |
| EULA | Apple standard unless you attach a custom one |

Guideline **5.1.1(i):** privacy policy must also be reachable **in the app** (Welcome, Register, Profile → Legal).

---

## Account deletion — Guideline 5.1.1(v)

Apple requires an **in-app** way to delete the whole account (not deactivate-only, not “email support”).

**Review notes (paste):**

> Account deletion: Profile (personal) or Manage (business) → Account settings → Delete account. The user confirms with their password. Deletion is immediate and cannot be undone. Deactivate is a separate pause option. Web copy of the same flow (for users without the app): https://joscity.com/delete-account

Confirm in App Review that:

- Delete is easy to find (not buried behind a web-only form).
- Deactivate is optional **in addition to** delete.

---

## App Privacy (nutrition labels)

Declare collection that happens in the app, including:

- Contact info (name, email, phone, physical address)  
- **Government ID** (NIN)  
- User content (posts, photos, videos, messages, reviews)  
- Photos / Camera / Microphone (user-initiated media)  
- Identifiers (account ID)  
- Purchases: marketplace goods/services processed by third-party payment (not Apple IAP)  
- Push notifications token  

Tracking: **No** unless you later add ATT / advertising SDKs (`NSPrivacyTracking` is false in `app.json`).

---

## Payments — 3.1.1 vs 3.1.3(e)

| What the user pays for | Rule | What to tell App Review |
| --- | --- | --- |
| Physical goods and local services (marketplace) | **3.1.3(e)** — must **not** use IAP | Paystack / wallet / bank transfer. Consumed outside the app. |
| Digital membership, unlocks, in-app currency | **3.1.1** — must use StoreKit IAP | **Not offered in the iOS app.** Membership status can still display. Do not link out to a web checkout. |

`ITSAppUsesNonExemptEncryption` is `false` (HTTPS only). Answer the export-compliance question accordingly.

Privacy manifest (`PrivacyInfo.xcprivacy`) is generated from `ios.privacyManifests` in `mobile/app.json` (UserDefaults, file timestamp, disk space, boot time — required-reason APIs used by Expo).

---

## Permissions (purpose strings)

Already set in `app.json` plugins:

- Photos — share photos, videos, and stories  
- Camera — take a photo or video  
- Microphone — record video for posts, stories, reels  
- Notifications — remote notifications background mode  

Do **not** add Always location or tracking strings unless the feature exists.

---

## User-generated content — Guideline 1.2

JosCity is a social/community app. Reviewers expect:

- Filtering / community guidelines (`https://joscity.com/community-guidelines`)  
- Report (posts) and **Block** (profile + post menu); blocked members cannot message you and their posts are hidden  
- Help → report a problem; aim to respond within 24 hours

Age rating: typically **12+ / 13+** (social networking, user content). Not a Kids Category app.

---

## Sign in with Apple — Guideline 4.8

Required only if the app offers a **third-party** or social login (Google, Facebook, etc.). JosCity uses **email and password** only, so SIWA is not required.

---

## Review notes template

```
JosCity is a community and local marketplace for Jos, Plateau.

Demo (no OTP; tap Personal or Business on Log in first):
- Personal: play.personal@joscity.com / JosCityReview2026!
- Business: play.business@joscity.com / JosCityReview2026!

Payments: checkout is for physical goods and services fulfilled outside the app (Guideline 3.1.3(e)). Digital memberships are not sold in the iOS app.

Account deletion: Profile or Manage → Account settings → Delete account (password, immediate).

Support: support@joscity.com · https://joscity.com/contact
```

---

## After `app.json` changes

Rebuild with EAS / `npx expo prebuild` so Info.plist, privacy manifest, and microphone usage strings are in the binary. A JS-only OTA update is not enough for those native keys.
