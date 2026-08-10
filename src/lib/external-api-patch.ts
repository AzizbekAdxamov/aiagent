import iconv from 'iconv-lite';
import { externalApi } from './external-api';
import { apiAuthContext } from './api-auth-context';
import { refreshUserTokens } from './auth';

// Patch the exported externalApi instance to provide robust decoding and proper Authorization header
// This avoids editing the original file directly and lets the rest of the code continue importing from the original module.

const apiAny: any = externalApi as any;

function patchedGetHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  // PER-USER TOKEN (BOSQICH 1): user konteksti bo'lsa — user tokeni ishlatiladi
  // GUEST REJIM: user konteksti BOR lekin accessToken bo'sh (guest) bo'lsa —
  // global .env tokeni ISHLATILMAYDI (guest'lar Mentalaba API'ga chiqmaydi).
  // Global token faqat apiAuthContext UMUMAN o'rnatilmagan hollarda ishlaydi.
  const userCtx = apiAuthContext.getStore();
  const token = userCtx ? userCtx.accessToken : (apiAny.accessToken || '');
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function patchedRequest(endpoint: string, options?: RequestInit): Promise<any> {
  const baseURL = apiAny.baseURL || (process.env.MENTALABA_API_URL || 'https://api.mentalaba.uz/v1');
  const url = `${baseURL}${endpoint}`;

  let response = await fetch(url, {
    ...options,
    headers: {
      ...patchedGetHeaders(),
      ...options?.headers,
    },
  });

  if (response.status === 401) {
    const userCtx = apiAuthContext.getStore();
    if (userCtx?.accessToken && userCtx.refreshToken) {
      // PER-USER TOKEN (BOSQICH 1): user tokeni eskirgan → user refresh bilan yangilanadi
      const refreshed = await refreshUserTokens(userCtx.refreshToken);
      if (refreshed) {
        userCtx.accessToken = refreshed.accessToken;
        if (refreshed.refreshToken) userCtx.refreshToken = refreshed.refreshToken;
        try {
          userCtx.onTokenRefreshed?.(refreshed.accessToken, refreshed.refreshToken);
        } catch (e) {
          console.warn('[Token Persist Warn]', (e as Error).message);
        }
        response = await fetch(url, {
          ...options,
          headers: {
            ...patchedGetHeaders(),
            ...options?.headers,
          },
        });
      }
    } else if (!apiAuthContext.getStore() && (apiAny.refreshTokenValue || apiAny.refreshToken)) {
      // Global (admin) token — eski mexanizm, faqat user konteksti BO'LMASA
      try {
        if (typeof apiAny.refreshAccessToken === 'function') await apiAny.refreshAccessToken();
      } catch (e) {
        // ignore
      }
      response = await fetch(url, {
        ...options,
        headers: {
          ...patchedGetHeaders(),
          ...options?.headers,
        },
      });
    }

    // AUTH_EXPIRED (401 ≠ ma'lumot yo'q): refresh urinishlardan KEYIN hali ham
    // 401 bo'lsa — markerli xato tashlanadi. Tool-router buni ushlab,
    // "topilmadi" o'rniga LOGIN so'rovini ko'rsatadi (provider-manager).
    if (response.status === 401) {
      throw new Error('AUTH_EXPIRED: Mentalaba API 401 — token eskirgan, qayta login kerak');
    }
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`API error: ${response.status} ${response.statusText} for ${endpoint}${errorBody ? ': ' + errorBody.substring(0, 200) : ''}`);
  }

  const contentType = response.headers.get('content-type') || '';
  const buffer = Buffer.from(await response.arrayBuffer());
  let text = '';

  const charsetMatch = contentType.match(/charset=([^;,\s]+)/i);
  if (charsetMatch) {
    const charset = charsetMatch[1];
    try {
      if (/utf-?8/i.test(charset)) {
        text = buffer.toString('utf8');
      } else {
        text = iconv.decode(buffer, charset);
      }
    } catch (e) {
      console.warn('[ExternalAPI Patch] Failed decoding with charset', charset, 'falling back to utf8');
      text = buffer.toString('utf8');
    }
  } else {
    text = buffer.toString('utf8');
    if (/[ÃÂâ]/.test(text)) {
      const decodings = ['windows-1252', 'iso-8859-1', 'windows-1251'];
      for (const enc of decodings) {
        try {
          const attempt = iconv.decode(buffer, enc);
          if (!/[ÃÂâ]/.test(attempt)) {
            console.warn(`[ExternalAPI Patch] Re-decoded response for ${endpoint} using ${enc}`);
            text = attempt;
            break;
          }
          if ((text.match(/[ÃÂâ]/g) || []).length > (attempt.match(/[ÃÂâ]/g) || []).length) {
            text = attempt;
          }
        } catch (e) {
          // ignore
        }
      }
    }
  }

  // Try to parse JSON
  try {
    return JSON.parse(text);
  } catch (e) {
    return text;
  }
}

// Apply patches
apiAny.getHeaders = patchedGetHeaders;
apiAny.request = patchedRequest;

export { externalApi };
