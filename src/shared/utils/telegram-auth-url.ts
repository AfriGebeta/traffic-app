import * as Linking from 'expo-linking';
import { logUrlTokenExtraction, telegramAuthLog } from './telegram-auth-logger';

function parseHashParams(url: string): URLSearchParams {
    const hashIndex = url.indexOf('#');
    if (hashIndex === -1) {
        return new URLSearchParams();
    }

    return new URLSearchParams(url.slice(hashIndex + 1));
}

function isJwt(value: string): boolean {
    return value.startsWith('eyJ') && value.split('.').length === 3;
}

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function decodeBase64Polyfill(base64: string): string {
    const bytes: number[] = [];
    let buffer = 0;
    let bits = 0;

    for (const char of base64) {
        if (char === '=') {
            break;
        }

        const value = BASE64_ALPHABET.indexOf(char);
        if (value === -1) {
            continue;
        }

        buffer = (buffer << 6) | value;
        bits += 6;

        if (bits >= 8) {
            bits -= 8;
            bytes.push((buffer >> bits) & 0xff);
        }
    }

    if (typeof TextDecoder !== 'undefined') {
        return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
    }

    return String.fromCharCode(...bytes);
}

function decodeBase64ToUtf8(value: string): string {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padding = (4 - (normalized.length % 4)) % 4;
    const padded = normalized + '='.repeat(padding);

    if (typeof globalThis.atob === 'function') {
        try {
            return globalThis.atob(padded);
        } catch {
           
        }
    }

    const bufferCtor = (globalThis as { Buffer?: { from: (input: string, encoding: string) => { toString: (encoding: string) => string } } }).Buffer;
    if (bufferCtor) {
        return bufferCtor.from(padded, 'base64').toString('utf8');
    }

    return decodeBase64Polyfill(padded);
}

function safeDecodeURIComponent(value: string): string {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

function stripJsonStringQuotes(value: string): string {
    const trimmed = value.trim();

    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
        return trimmed.slice(1, -1);
    }

    return trimmed;
}

function tokenFromParsedJson(value: unknown): string | null {
    if (typeof value === 'string' && isJwt(value)) {
        return value;
    }

    if (value && typeof value === 'object' && 'id_token' in value) {
        const idToken = (value as { id_token?: unknown }).id_token;

        if (typeof idToken === 'string' && idToken) {
            return idToken;
        }
    }

    return null;
}

function unwrapTelegramAuthPayload(decoded: string): string | null {
    const unquoted = stripJsonStringQuotes(decoded.trim());

    if (isJwt(unquoted)) {
        return unquoted;
    }

    try {
        return tokenFromParsedJson(JSON.parse(decoded));
    } catch {
        return null;
    }
}

function parseTgAuthResultValue(value: string): string | null {
    const trimmed = safeDecodeURIComponent(value.trim());
    if (!trimmed) {
        return null;
    }

    if (isJwt(trimmed)) {
        telegramAuthLog.info('parseTgAuthResultValue matched direct JWT');
        return trimmed;
    }

    const fromJson = unwrapTelegramAuthPayload(trimmed);
    if (fromJson) {
        telegramAuthLog.info('parseTgAuthResultValue matched JSON payload');
        return fromJson;
    }

    try {
        const base64Decoded = decodeBase64ToUtf8(trimmed);
        const fromBase64 = unwrapTelegramAuthPayload(base64Decoded);

        if (fromBase64) {
            telegramAuthLog.info('parseTgAuthResultValue matched base64 payload');
            return fromBase64;
        }

        telegramAuthLog.warn('parseTgAuthResultValue base64 decoded but no token found', {
            preview: base64Decoded.slice(0, 24),
            endsWithQuote: base64Decoded.endsWith('"'),
        });
    } catch (error) {
        telegramAuthLog.warn('parseTgAuthResultValue base64 decode failed', {
            error: error instanceof Error ? error.message : String(error),
            preview: trimmed.slice(0, 24),
        });
    }

    return null;
}

function parseJwtFromUnknownHash(hashParams: URLSearchParams): string | null {
    for (const [, value] of hashParams.entries()) {
        if (value.startsWith('eyJ') && value.split('.').length === 3) {
            return value;
        }

        const fromTgAuthResult = parseTgAuthResultValue(value);
        if (fromTgAuthResult) {
            return fromTgAuthResult;
        }
    }

    return null;
}

export function extractLegacyTelegramParams(url: string): Record<string, string> | null {
    const { queryParams } = Linking.parse(url);

    if (!queryParams?.id || !queryParams?.hash) {
        return null;
    }

    return {
        id: String(queryParams.id),
        hash: String(queryParams.hash),
        auth_date: String(queryParams.auth_date ?? ''),
        first_name: String(queryParams.first_name ?? ''),
    };
}

export function extractIdTokenFromUrl(url: string): string | null {
    const { queryParams } = Linking.parse(url);

    if (queryParams?.id_token) {
        const token = String(queryParams.id_token);
        logUrlTokenExtraction(url, token);
        return token;
    }

    if (queryParams?.tgAuthResult) {
        const token = parseTgAuthResultValue(String(queryParams.tgAuthResult));
        if (token) {
            logUrlTokenExtraction(url, token);
            return token;
        }
    }

    const hashParams = parseHashParams(url);
    const hashIdToken = hashParams.get('id_token');

    if (hashIdToken) {
        logUrlTokenExtraction(url, hashIdToken);
        return hashIdToken;
    }

    const tgAuthResult = hashParams.get('tgAuthResult');
    if (tgAuthResult) {
        const token = parseTgAuthResultValue(tgAuthResult);
        if (token) {
            logUrlTokenExtraction(url, token);
            return token;
        }
    }

    const jwtFromHash = parseJwtFromUnknownHash(hashParams);
    if (jwtFromHash) {
        logUrlTokenExtraction(url, jwtFromHash);
        return jwtFromHash;
    }

    logUrlTokenExtraction(url, null);
    return null;
}

export function extractTelegramAuthErrorFromUrl(url: string): string | null {
    const { queryParams } = Linking.parse(url);

    if (queryParams?.error) {
        return String(queryParams.error);
    }

    const hashParams = parseHashParams(url);
    const error = hashParams.get('error');

    if (error) {
        return error;
    }

    return null;
}

export function parseTelegramAuthMessage(rawData: string): { id_token?: string; error?: string } | null {
    try {
        const data = JSON.parse(rawData) as { id_token?: string; error?: string };

        if (data.id_token || data.error) {
            return data;
        }
    } catch {
        return null;
    }

    return null;
}

export function isTelegramAuthCompletionUrl(url: string): boolean {
    return (
        url.startsWith('trafficapp://') ||
        url.includes('id_token=') ||
        url.includes('tgAuthResult=') ||
        url.includes('-login.tg.dev') ||
        url.includes('error=')
    );
}

const PARSE_TG_AUTH_RESULT_JS = `
function tokenFromParsedJson(value) {
  if (typeof value === 'string' && value.indexOf('eyJ') === 0 && value.split('.').length === 3) {
    return value;
  }
  if (value && typeof value === 'object' && value.id_token) {
    return value.id_token;
  }
  return null;
}

function unwrapTelegramAuthPayload(decoded) {
  var unquoted = String(decoded).trim();
  if (unquoted.charAt(0) === '"' && unquoted.charAt(unquoted.length - 1) === '"') {
    unquoted = unquoted.slice(1, -1);
  }
  if (unquoted.indexOf('eyJ') === 0 && unquoted.split('.').length === 3) {
    return unquoted;
  }
  try {
    return tokenFromParsedJson(JSON.parse(decoded));
  } catch (e) {}
  return null;
}

function parseTgAuthResultValue(value) {
  if (!value) return null;

  var trimmed = String(value).trim();
  try {
    trimmed = decodeURIComponent(trimmed);
  } catch (e) {}

  if (trimmed.indexOf('eyJ') === 0 && trimmed.split('.').length === 3) {
    return trimmed;
  }

  var fromJson = unwrapTelegramAuthPayload(trimmed);
  if (fromJson) return fromJson;

  try {
    var normalized = String(value).replace(/-/g, '+').replace(/_/g, '/');
    while (normalized.length % 4) normalized += '=';
    var base64Decoded = atob(normalized);
    return unwrapTelegramAuthPayload(base64Decoded);
  } catch (e) {}

  return null;
}
`;

export const TELEGRAM_AUTH_SCAN_JS = `
(function () {
  ${PARSE_TG_AUTH_RESULT_JS}

  function notify(payload) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    }
  }

  function scanLocation() {
    var params = new URLSearchParams(window.location.search);

    if (params.get('id_token')) {
      notify({ id_token: params.get('id_token') });
      return;
    }

    var hash = window.location.hash ? window.location.hash.substring(1) : '';
    if (!hash) {
      return;
    }

    var hashParams = new URLSearchParams(hash);
    if (hashParams.get('id_token')) {
      notify({ id_token: hashParams.get('id_token') });
      return;
    }

    var tgAuthResult = hashParams.get('tgAuthResult');
    var idToken = parseTgAuthResultValue(tgAuthResult);
    if (idToken) {
      notify({ id_token: idToken });
    }
  }

  scanLocation();
})();
true;
`;
