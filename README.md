# MWB Driver App (Expo)

Mobile app for drivers to:
- login using device code
- load assigned runs
- update status (`on_route`, `arrived`, `failed`, `completed`)
- submit completion proof (signature required, photo optional, GPS optional)

## 1) Prerequisites

- Node.js 18+
- npm
- Expo CLI (via `npx expo`)
- WordPress plugin `mw-booking` activated with REST endpoints

## 2) Configure API URL

Copy `.env.example` to `.env` and set:

```
EXPO_PUBLIC_API_BASE_URL=https://your-domain.com/wp-json/mwb/v1
```

## 3) Install and run

```bash
cd driver-app
npm install
npm run start
```

Then open with Expo Go (or run Android/iOS locally).

## 4) API Endpoints used

- `POST /driver/login`
- `POST /driver/logout`
- `GET /driver/runs?run_date=YYYY-MM-DD`
- `POST /driver/run/update`

## 5) Notes

- Current login validates by `device_code` (PIN accepted but not enforced yet).
- Token auth is transient-based (server-side expiry 7 days).
- For production, replace with JWT/refresh token flow and stronger device auth.

