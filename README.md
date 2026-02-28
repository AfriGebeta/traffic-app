# GebetaMaps App- Built for the community

This app is built intended for a community-driven traffic reporting app for Ethiopia. This open-source project allows users to navigate efficiently while contributing real time traffic information, incidents, and local insights to help the community.

## Features

- Real-time navigation
- Live traffic incident reporting and alerts
- Explore nearby places 
- Bilingual support (English & Amharic)
- Voice-powered navigation in collaboration with Hasab AI
- Built with React Native and Expo for cross-platform support

## Get Started

### Prerequisites

- Node.js (v16 or higher)
- npm
- Expo CLI
- Android Studio (for Android development) or Xcode (for iOS development)

### Installation

1. Clone the repository

   ```bash
   git clone https://github.com/AfriGebeta/traffic-app.git
   ```

2. Install dependencies

   ```bash
   npm install
   ```

3. Set up environment variables

   Create a `.env` file in the root directory:

   ```
   EXPO_PUBLIC_GEBETA_API_KEY=your_api_key_here - you can get it from https://gebeta.app
   EXPO_PUBLIC_API_URL - your backend
   ```

4. Start the development server

   ```bash
   npx expo start
   ```

5. Start the development server:
   ```bash
   npx expo start
   ```

6. Run on Android device (via USB cable):
   ```bash
   npx expo run:android
   ```
   Make sure your Android device is connected via USB with USB debugging enabled, or use an Android emulator.


## Contributing

We highly welcome contributions from the community. whether you're fixing bugs, adding features, or improving documentation, your help makes the app better for everyone.

please read our [CONTRIBUTING.md](CONTRIBUTING.md) guide to learn about:
- Development workflow
- How to submit pull requests


## Technologies

- **React Native** - Cross-platform mobile framework
- **Expo** - Development platform and tooling
- **MapLibre GL** - Open-source map rendering
- **TypeScript** - Type-safe JavaScript
- **TailwindCSS (NativeWind)** - Utility first styling
- **Gebeta Maps API** - Our map services

---

**Note:** This app requires a Gebeta Maps API key and a backend. Visit [Gebeta Maps](https://gebeta.app) to obtain your API key.
