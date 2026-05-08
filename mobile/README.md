# HaulFlow Mobile Wrapper

Thin Expo wrapper that loads the HaulFlow driver portal (`https://haulflow.vercel.app/driver`) inside a native WebView. Submitted as the iOS and Android app to the App Store and Google Play.

## Why a wrapper

The real app is the web app deployed to Vercel. This wrapper exists only because Apple and Google sell apps, not URLs. It is intentionally tiny — every screen, every API call, every business rule lives in the web app. When you push code to GitHub, Vercel deploys it and **every installed app instantly gets the update**, no app-store re-submission required. You only re-submit when something inside this `mobile/` folder changes (icon, splash, permissions, native version bump).

## Build & submit

```bash
cd mobile
npm install                    # first time only

# Production build for iOS
eas build --platform ios --profile production

# Production build for Android
eas build --platform android --profile production

# Submit to stores (after a successful build)
eas submit --platform ios
eas submit --platform android
```

## Files

- `App.tsx` — the WebView screen
- `index.js` — Expo entry point
- `app.json` — name, version, bundle id, permissions, icon paths
- `eas.json` — build profiles
- `assets/` — icon and splash images (replace with your branded assets when ready)
