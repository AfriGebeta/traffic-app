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
// First entry is the web-only autoVerify filter for maps.gebeta.app; keep it
// untouched and preserve any other filters (e.g. the trafficapp custom scheme).
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
      queries: [
        { scheme: 'tg' },
        { scheme: 'telegram' },
        { package: 'org.telegram.messenger' },
        { package: 'org.telegram.messenger.web' },
      ],
      intentFilters: [
        // maps.gebeta.app stays in its own web-only autoVerify filter so it
        // verifies independently of the Telegram login host below.
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
