import iconv from 'iconv-lite';
import { externalApi } from './external-api';

// Patch the exported externalApi instance to provide robust decoding and proper Authorization header
// This avoids editing the original file directly and lets the rest of the code continue importing from the original module.

const apiAny: any = externalApi as any;

function patchedGetHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = apiAny.accessToken || '';
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

  if (response.status === 401 && (apiAny.refreshTokenValue || apiAny.refreshToken)) {
    // Attempt to call existing refresh if present
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
