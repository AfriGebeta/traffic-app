const { load: loadEnv } = require('@expo/env');
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
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? appJson.expo.android.googleServicesFile,
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
