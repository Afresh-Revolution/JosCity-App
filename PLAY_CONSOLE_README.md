# Google Play Console — JosCity (`com.joscity.app`)

Use this when publishing or after a **Play Console Requirements** / declarations rejection.

JosCity is a **community + marketplace** app (accounts, feed, local businesses, physical goods and services). Paying for a listing or service with Paystack is **checkout for goods/services**, not banking.

---

## Path A — Personal developer account (preferred if you are an individual)

Use this if JosCity is **not** banking, loans, trading, crypto exchange, medical, VPN, or a government app.

1. Play Console → JosCity → **Policy → App content**.
2. Open **Financial features** (also check Health, Government, VPN).
3. Answer accurately:
   - The app **does not provide financial products or services** (no bank accounts, loans, trading, crypto wallet/exchange).
   - Wallet / Paystack is **payment for goods and services** in the marketplace, not a financial product.
   - Do **not** declare Medical / Human Subjects / VPN / Government unless that is literally the product.
4. Save, then resubmit the release.
5. If Google still requires an Organization account after correct answers, use Path B.

## Path B — Organization account

Required if you publish as a registered company, or you truly offer finance/health/VPN/government features.

1. [Play Console requirements](https://support.google.com/googleplay/android-developer/answer/10788890) and [account type](https://support.google.com/googleplay/android-developer/answer/13634885).
2. Convert Personal → Organization (account owner) or create an Organization account and [transfer the app](https://support.google.com/googleplay/android-developer/answer/11637427).
3. You will need legal name & address, **D-U-N-S**, verified website, org email/phone, payments profile.

You cannot convert Organization → Personal. Prefer Path A when the rejection was a wrong **Financial features** tick.

Mandatory Organization categories (new accounts / these types, from 31 Aug 2024):

1. Financial products and services  
2. Health (Medical, Human Subjects Research)  
3. Apps using `VpnService`  
4. Government apps  

---

## Privacy, Data safety, account deletion

| Item | Value |
|------|--------|
| Privacy policy | `https://joscity.com/privacy-policy` |
| Terms | `https://joscity.com/terms-of-service` |
| Support | `https://joscity.com/contact` · `support@joscity.com` · `+234 7067621916` |
| **Account deletion URL** (Data safety) | `https://joscity.com/delete-account` |
| In-app deletion | Profile or Manage → Account settings → Delete account (password; immediate) |

Play requires **both** in-app deletion **and** a web URL (users who uninstalled the app). Deactivate is not deletion.

### Data safety (declare what you actually collect)

Typical JosCity types (adjust if a flag is off):

- Personal info: name, email, phone, address  
- **Government ID:** NIN (registration / verification)  
- User-generated content: posts, photos, videos, messages, reviews  
- Photos and camera (when the user shares media)  
- App activity / diagnostics as applicable  
- Financial info: **not stored in the app**; card/bank handled by Paystack / payment partners  
- Approximate location: **only if** you later add location APIs (the current app does not request GPS)

Encrypted in transit: **Yes** (HTTPS). Users can request deletion: **Yes**.

---

## Payments declaration

- Marketplace / events / local services: **goods and services**, not Google Play Billing.
- Do **not** sell digital memberships, unlocks, or CBC points in the Android app until Play Billing is implemented. Subscribe is hidden on native builds.
- Families policy: only if children are a target audience (JosCity is a general social/marketplace app; rate **Teen / 13+**, not Designed for Families).

---

## Demo accounts (paste into Play Console review notes)

These logins are pre-approved and already activated. On the welcome/login screen, switch **Personal** or **Business**, then use email + password. No OTP.

| Account | Email | Password |
| --- | --- | --- |
| Personal | `play.personal@joscity.com` | `JosCityReview2026!` |
| Business | `play.business@joscity.com` | `JosCityReview2026!` |

**Review notes (paste):**

> Demo logins (no OTP):
> Personal — play.personal@joscity.com / JosCityReview2026!
> Business — play.business@joscity.com / JosCityReview2026!
> On Log in, tap Personal or Business before signing in.
>
> Account deletion: Profile (personal) or Manage (business) → Account settings → Delete account. Confirm with the password. Immediate.
>
> Payments: marketplace checkout is for physical goods and local services, not Play Billing. Digital membership is not sold in this Android build.

Re-seed or reset the password from `New_Joscity`: `npm run seed:play-review`

---

## Before you submit

- App name **JosCity**, package `com.joscity.app`
- Content rating questionnaire complete  
- Paste the **demo logins** above into the review notes  
- How to open marketplace checkout (or reach payment)  
- Deletion path in the notes  
- Screenshots match the live build (no placeholder/fake phone numbers)

Also review the [Developer Distribution Agreement](https://play.google.com/about/developer-distribution-agreement.html) and [User Data policy](https://support.google.com/googleplay/android-developer/answer/10144311).

---

## Decision tree

```
Rejected: “requires Organization account”
        │
        ├─ JosCity is community + marketplace checkout (Paystack)?
        │     YES → Path A: Financial features = none
        │            (clear health/VPN/gov if wrongly set) → resubmit
        │     Still rejected? → Path B
        │
        └─ Real financial / health / VPN / government app,
           OR publishing as a registered company?
                 YES → Path B: Organization + D-U-N-S → resubmit
```
