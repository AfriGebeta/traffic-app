import * as Linking from 'expo-linking';

const LOG_PREFIX = '[TelegramAuth]';

function getHash(url: string): string | null {
    const hashIndex = url.indexOf('#');
    return hashIndex === -1 ? null : url.slice(hashIndex);
}

function getQueryKeys(url: string): string[] {
    const { queryParams } = Linking.parse(url);
    return queryParams ? Object.keys(queryParams) : [];
}

function summarizeIdToken(idToken: string | null | undefined): string | null {
    if (!idToken) {
        return null;
    }

    return `${idToken.slice(0, 12)}... (${idToken.length} chars)`;
}

export const telegramAuthLog = {
    info(step: string, details?: Record<string, unknown>) {
        
    },

    warn(step: string, details?: Record<string, unknown>) {
       
    },

    error(step: string, error: unknown, details?: Record<string, unknown>) {
       
    },

    url(step: string, url: string) {
        // const idToken = extractIdTokenPreview(url);

        // console.log(LOG_PREFIX, step, {
        //     url,
        //     queryKeys: getQueryKeys(url),
        //     hash: getHash(url),
        //     hasIdTokenParam: url.includes('id_token'),
        //     hasTgAuthResult: url.includes('tgAuthResult'),
        //     hasLegacyHash: url.includes('hash='),
        //     hasLegacyId: url.includes('id=') && url.includes('hash='),
        //     idTokenPreview: idToken,
        // });
    },
};

function extractIdTokenPreview(url: string): string | null {
    const { queryParams } = Linking.parse(url);

    if (queryParams?.id_token) {
        return summarizeIdToken(String(queryParams.id_token));
    }

    const hashIndex = url.indexOf('#');
    if (hashIndex !== -1) {
        const hashParams = new URLSearchParams(url.slice(hashIndex + 1));
        const hashToken = hashParams.get('id_token');
        if (hashToken) {
            return summarizeIdToken(hashToken);
        }
    }

    return null;
}

export function logUrlTokenExtraction(url: string, idToken: string | null) {
    // telegramAuthLog.info('extractIdTokenFromUrl', {
    //     found: !!idToken,
    //     idTokenPreview: summarizeIdToken(idToken),
    //     queryKeys: getQueryKeys(url),
    //     hash: getHash(url),
    // });
}
