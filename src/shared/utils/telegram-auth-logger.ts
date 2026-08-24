import * as Linking from 'expo-linking';

const LOG_PREFIX = '[TelegramAuth]';

let sessionStart = Date.now();
function record(level: string, step: string, details?: Record<string, unknown>) {
    const sinceStart = `+${((Date.now() - sessionStart) / 1000).toFixed(2)}s`;

    let serialized = '';
    if (details) {
        try {
            serialized = ` ${JSON.stringify(details).replace(/\s+/g, ' ')}`;
        } catch {
            serialized = ' [unserializable details]';
        }
    }

    const line = `${LOG_PREFIX}[${level}][${sinceStart}] ${step}${serialized}`;

    if (level === 'error') {
        console.error(line);
        return;
    }

    if (level === 'warn') {
        console.warn(line);
        return;
    }

    console.log(line);
}

function getHash(url: string): string | null {
    const hashIndex = url.indexOf('#');
    return hashIndex === -1 ? null : url.slice(hashIndex);
}

function getQueryKeys(url: string): string[] {
    try {
        const { queryParams } = Linking.parse(url);
        return queryParams ? Object.keys(queryParams) : [];
    } catch {
        return [];
    }
}

function summarizeIdToken(idToken: string | null | undefined): string | null {
    if (!idToken) {
        return null;
    }

    return `${idToken.slice(0, 12)}... (${idToken.length} chars)`;
}

function decodeTgAuthResult(url: string): string | null {
    const match = url.match(/tgAuthResult=([^&#\s]+)/);

    if (!match?.[1]) {
        return null;
    }

    let value = match[1];

    try {
        value = decodeURIComponent(value);
    } catch {
    }

    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);

    try {
        if (typeof globalThis.atob === 'function') {
            return globalThis.atob(padded).slice(0, 300);
        }
    } catch {
    }

    return `<undecodable: ${value.slice(0, 60)}>`;
}

export const telegramAuthLog = {
    startSession(step: string, details?: Record<string, unknown>) {
        sessionStart = Date.now();
        record('info', `=== ${step} ===`, details);
    },

    info(step: string, details?: Record<string, unknown>) {
        record('info', step, details);
    },

    warn(step: string, details?: Record<string, unknown>) {
        record('warn', step, details);
    },

    error(step: string, error: unknown, details?: Record<string, unknown>) {
        record('error', step, {
            ...details,
            error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
        });
    },

    diag(step: string, details?: Record<string, unknown>) {
        record('diag', step, details);
    },

    url(step: string, url: string) {
        record('url', step, {
            url,
            queryKeys: getQueryKeys(url),
            hash: getHash(url),
            hasIdTokenParam: url.includes('id_token'),
            hasTgAuthResult: url.includes('tgAuthResult'),
            tgAuthResultDecoded: decodeTgAuthResult(url),
            hasCodeParam: /[?&#]code=/.test(url),
        });
    },
};

export function logUrlTokenExtraction(url: string, idToken: string | null) {
    telegramAuthLog.info('extractIdTokenFromUrl', {
        found: !!idToken,
        idTokenPreview: summarizeIdToken(idToken),
        queryKeys: getQueryKeys(url),
        hash: getHash(url),
        tgAuthResultDecoded: decodeTgAuthResult(url),
    });
}
