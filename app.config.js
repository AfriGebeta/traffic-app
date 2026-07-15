const { load: loadEnv } = require('@expo/env');
const fs = require('fs');
const path = require('path');
const appJson = require('./app.json');

loadEnv(__dirname);

const telegramClientId = process.env.EXPO_PUBLIC_TELEGRAM_CLIENT_ID?.trim();
if (!telegramClientId) {
  throw new Error(
    'Missing EXPO_PUBLIC_TELEGRAM_CLIENT_ID.'
  );
}
const telegramLoginHost = `app${telegramClientId}-login.tg.dev`;
const [mapsIntentFilter, ...otherIntentFilters] = appJson.expo.android.intentFilters;
const googleServicesFile = process.env.GOOGLE_SERVICES_JSON?.trim() || appJson.expo.android.googleServicesFile;
const googleServicesPath = path.resolve(__dirname, googleServicesFile);

if (!fs.existsSync(googleServicesPath)) {
  console.warn(
    [
      '[Firebase config]',
      `google-services.json was not found at: ${googleServicesPath}`,
      'Add the file there, or set GOOGLE_SERVICES_JSON to the correct relative/absolute path before running a native Android build.',
    ].join(' ')
  );
}

module.exports = {
  expo: {
    ...appJson.expo,
    ios: {
      ...appJson.expo.ios,
      associatedDomains: [
        ...(appJson.expo.ios.associatedDomains ?? []),
        `applinks:${telegramLoginHost}`,
      ],
      infoPlist: {
        ...(appJson.expo.ios.infoPlist ?? {}),
        LSApplicationQueriesSchemes: [
          ...new Set([
            ...((appJson.expo.ios.infoPlist ?? {}).LSApplicationQueriesSchemes ?? []),
            'tg',
            'telegram',
          ]),
        ],
      },
    },
    android: {
      ...appJson.expo.android,
      googleServicesFile,
      queries: [
        { scheme: 'tg' },
        { scheme: 'telegram' },
        { package: 'org.telegram.messenger' },
        { package: 'org.telegram.messenger.web' },
      ],
      intentFilters: [
        mapsIntentFilter,
        ...otherIntentFilters,
        {
          action: 'VIEW',
          autoVerify: true,
          data: [
            {
              scheme: 'https',
              host: telegramLoginHost,
              pathPrefix: '/tglogin',
            },
          ],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
  },
};
