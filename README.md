# MWB Driver App

A React Native / Expo mobile app for drivers to manage their daily runs.

## Features

- Login with device code
- View assigned runs by date
- Update run status (`on_route`, `arrived`, `failed`, `completed`)
- Submit completion proof — signature required, photo & GPS optional

## Tech Stack

- [Expo](https://expo.dev) (SDK 54) + Expo Router
- React Native 0.81
- TypeScript
- WordPress REST API backend (`mw-booking` plugin)

## Prerequisites

- Node.js 18+
- pnpm (or npm)
- Expo CLI via `npx expo`
- WordPress site with `mw-booking` plugin activated

## Setup

1. **Clone the repo**
   ```bash
   git clone https://github.com/YOUR_USERNAME/driver-app.git
   cd driver-app
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Configure environment**

   Create a `.env` file in the root:
   ```
   EXPO_PUBLIC_API_BASE_URL=https://your-domain.com/wp-json/mwb/v1
   ```

4. **Run the app**
   ```bash
   npx expo start
   ```
   Then scan the QR code with Expo Go, or press `i` for iOS simulator / `a` for Android emulator.

## Scripts

| Command | Description |
|---------|-------------|
| `npx expo start` | Start dev server |
| `npx expo run:ios` | Run on iOS simulator |
| `npx expo run:android` | Run on Android emulator |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/driver/login` | Authenticate with device code |
| POST | `/driver/logout` | Logout |
| GET | `/driver/runs?run_date=YYYY-MM-DD` | Fetch runs for a date |
| POST | `/driver/run/update` | Update run status |

## Building for Production

This app uses [EAS Build](https://docs.expo.dev/build/introduction/):

```bash
npx eas build --platform ios
npx eas build --platform android
```
