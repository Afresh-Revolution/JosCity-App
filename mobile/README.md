# JosCity mobile app

React Native app for the JosCity platform, built with **Expo SDK 54**.

The website lives in `../JOSCITY`. The API lives in `../New_Joscity` and uses the same Supabase Postgres database. This app talks to that API — it does not connect to the database directly.

## Run

```bash
cd mobile
npm install
npx expo start
```

Then open it in Expo Go, an Android emulator, or a development build.

## Environment

Copy `.env.example` to `.env` if needed:

```
EXPO_PUBLIC_API_BASE_URL=https://api-joscity-com-phqud.ondigitalocean.app/api
```

Do not put database passwords, JWT secrets, or mail keys in this app.

## Store builds (EAS)

From `mobile/`, after `npx eas-cli login`:

```bash
npm run eas:build:android   # Play Console AAB
npm run eas:build:ios       # App Store IPA
npm run eas:build           # asks which platform
npm run eas:preview         # internal APK / iOS build
```

`.env` is gitignored and is **not** uploaded to EAS. Production builds use the API URL in `eas.json`. Set Paystack / SafeHaven public keys with `eas secret:create` if those features are on.

The upload is filtered by **`.easignore` at the repo root** (EAS archives from the git root). That skips `JOSCITY/`, docs, and other files the native build does not need.

## Current screens

1. Splash — globe logo, wordmark, loading bar, with fade-in.
2. Onboarding (3 slides) — city, marketplace, wallet.
3. Welcome — Create account / Log in.
