import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import translations from './translations.json';

interface Translation {
    key: string;
    EN_US: string;
    AM: string;
}

interface TranslationResources {
    EN_US: Record<string, string>;
    AM: Record<string, string>;
}

const i18nTranslations = (translations as Translation[]).reduce<TranslationResources>(
    (acc, item) => {
        return {
            EN_US: { ...acc.EN_US, [item.key]: item.EN_US },
            AM: { ...acc.AM, [item.key]: item.AM }
        };
    },
    { EN_US: {}, AM: {} }
);

const initI18n = async () => {
    const savedLanguage = await AsyncStorage.getItem('userLanguage');

    await i18n
        .use(initReactI18next)
        .init({
            resources: {
                en: { translation: i18nTranslations.EN_US },
                am: { translation: i18nTranslations.AM }
            },
            lng: savedLanguage || 'en',
            fallbackLng: 'en',
            interpolation: { escapeValue: false },
        });
};

initI18n();

export default i18n;

export const changeLanguage = async (language: 'en' | 'am') => {
    await AsyncStorage.setItem('userLanguage', language);
    await i18n.changeLanguage(language);
};
