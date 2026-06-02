const DEFAULT_TRUSTED_ORIGIN = 'https://maps.gebeta.app';
const DEFAULT_MOBILE_REDIRECT_URI = 'trafficapp://telegram-auth';

function getTelegramClientId(): string {
    const clientId = process.env.EXPO_PUBLIC_TELEGRAM_CLIENT_ID?.trim();

    if (!clientId) {
        throw new Error(
            'EXPO_PUBLIC_TELEGRAM_CLIENT_ID is not set. Add it to your .env file.'
        );
    }

    return clientId;
}

function getConfiguredUrl(envValue: string | undefined, fallback: string): string {
    const trimmed = envValue?.trim();
    return trimmed || fallback;
}

function getTelegramNativeRedirectUri(clientId: string): string {
    return getConfiguredUrl(
        process.env.EXPO_PUBLIC_TELEGRAM_REDIRECT_URI,
        `https://app${clientId}-login.tg.dev/tglogin`
    );
}

function getTelegramMobileRedirectUri(): string {
    return getConfiguredUrl(
        process.env.EXPO_PUBLIC_TELEGRAM_MOBILE_REDIRECT_URI,
        DEFAULT_MOBILE_REDIRECT_URI
    );
}

function getTelegramWebRedirectUri(origin: string): string {
    return getConfiguredUrl(
        process.env.EXPO_PUBLIC_TELEGRAM_WEB_REDIRECT_URI,
        `${origin}/onboard`
    );
}

export function getTelegramAuthConfig() {
    const clientId = getTelegramClientId();
    const trustedOrigin = getConfiguredUrl(
        process.env.EXPO_PUBLIC_TELEGRAM_TRUSTED_ORIGIN,
        DEFAULT_TRUSTED_ORIGIN
    );

    return {
        clientId,
        redirectUri: getTelegramNativeRedirectUri(clientId),
        mobileRedirectUri: getTelegramMobileRedirectUri(),
        webRedirectUri: getTelegramWebRedirectUri(trustedOrigin),
        trustedOrigin,
        onboardUrl: getConfiguredUrl(
            process.env.EXPO_PUBLIC_TELEGRAM_LOGIN_URL,
            `${trustedOrigin}/onboard`
        ),
        scopes: ['openid', 'profile', 'phone', 'telegram:bot_access'],
        authorizationEndpoint: 'https://oauth.telegram.org/auth',
    };
}

export function getTelegramOAuthPostMessageUrl(clientId: string, lang: string): string {
    const config = getTelegramAuthConfig();
    const redirectUri = config.webRedirectUri;

    const params = new URLSearchParams({
        response_type: 'post_message',
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: 'openid profile phone telegram:bot_access',
        lang,
    });

    return `${config.authorizationEndpoint}?${params.toString()}`;
}

export function getTelegramWebViewStartUrl(lang = 'en'): string {
    const config = getTelegramAuthConfig();

    if (config.onboardUrl.includes('oauth.telegram.org/auth')) {
        return config.onboardUrl;
    }

    return getTelegramOAuthPostMessageUrl(config.clientId, lang);
}

export function isTelegramAuthCallbackUrl(url: string): boolean {
    if (url.includes('id_token=') || url.includes('tgAuthResult=')) {
        return true;
    }

  const config = getTelegramAuthConfig();

  return (
    url.startsWith('trafficapp://') ||
    url.includes('-login.tg.dev') ||
    url.includes(new URL(config.webRedirectUri).host)
  );
}

export const TELEGRAM_WEBVIEW_INJECTED_JS = `
(function () {
  if (window.__gebetaTelegramBridgeInstalled) {
    return;
  }

  window.__gebetaTelegramBridgeInstalled = true;

  function notify(payload) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    }
  }

  function extractIdToken(data) {
    if (!data) {
      return null;
    }

    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (error) {
        return null;
      }
    }

    return data.id_token || null;
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
    if (tgAuthResult) {
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
        } catch (error) {}
        return null;
      }

      var trimmedResult = String(tgAuthResult).trim();
      try {
        trimmedResult = decodeURIComponent(trimmedResult);
      } catch (error) {}

      if (trimmedResult.indexOf('eyJ') === 0 && trimmedResult.split('.').length === 3) {
        notify({ id_token: trimmedResult });
        return;
      }

      var idTokenFromJson = unwrapTelegramAuthPayload(trimmedResult);
      if (idTokenFromJson) {
        notify({ id_token: idTokenFromJson });
        return;
      }

      try {
        var normalized = String(tgAuthResult).replace(/-/g, '+').replace(/_/g, '/');
        while (normalized.length % 4) normalized += '=';
        var base64Decoded = atob(normalized);
        var idTokenFromBase64 = unwrapTelegramAuthPayload(base64Decoded);
        if (idTokenFromBase64) {
          notify({ id_token: idTokenFromBase64 });
        }
      } catch (error) {}
    }
  }

  window.addEventListener('message', function (event) {
    if (event.origin !== 'https://oauth.telegram.org') {
      return;
    }

    var idToken = extractIdToken(event.data);

    if (idToken) {
      notify({ id_token: idToken });
      return;
    }

    if (event.data && event.data.error) {
      notify({ error: String(event.data.error) });
    }
  });

  function isExternalAppUrl(url) {
    if (!url) return false;
    url = String(url);
    return (
      url.indexOf('tg://') === 0 ||
      url.indexOf('telegram://') === 0 ||
      url.indexOf('intent://') === 0 ||
      url.indexOf('trafficapp://') === 0
    );
  }

  function handleExternalNavigation(url) {
    if (url.indexOf('trafficapp://') === 0) {
      notify({ deep_link: url });
      return true;
    }

    if (
      url.indexOf('tg://') === 0 ||
      url.indexOf('telegram://') === 0 ||
      url.indexOf('intent://') === 0
    ) {
      notify({ external_url: url });
      return true;
    }

    return false;
  }

  var originalAssign = window.location.assign.bind(window.location);
  window.location.assign = function (url) {
    if (handleExternalNavigation(String(url))) {
      return;
    }

    return originalAssign(url);
  };

  var originalReplace = window.location.replace.bind(window.location);
  window.location.replace = function (url) {
    if (handleExternalNavigation(String(url))) {
      return;
    }

    return originalReplace(url);
  };

  document.addEventListener(
    'click',
    function (event) {
      var target = event.target;

      while (target && target.tagName !== 'A') {
        target = target.parentElement;
      }

      if (!target || !target.href || !isExternalAppUrl(target.href)) {
        return;
      }

      event.preventDefault();
      handleExternalNavigation(String(target.href));
    },
    true
  );

  scanLocation();

  // auto-click "open telegram" button after page loads
  function autoClickOpenTelegram() {
    try {
      setTimeout(function() {

        var buttons = document.querySelectorAll('button, a, div[role="button"]');
        var openTelegramButton = null;
        
        for (var i = 0; i < buttons.length; i++) {
          var btn = buttons[i];
          var text = (btn.textContent || btn.innerText || '').trim().toLowerCase();
          
          if (text.indexOf('open telegram') !== -1 || text === 'open telegram') {
            openTelegramButton = btn;
            break;
          }
        }
        
        if (openTelegramButton) {
          openTelegramButton.click();
        }
      }, 1500);
    } catch (e) {}
  }

  autoClickOpenTelegram();
})();
true;
`;
