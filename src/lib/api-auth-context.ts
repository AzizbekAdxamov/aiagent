import { AsyncLocalStorage } from "async_hooks";

/**
 * PER-USER TOKEN KONTEKSTI (BOSQICH 1):
 * Har bir chat so'rovi o'z foydalanuvchisining tokeni bilan Mentalaba API'ga
 * murojaat qilishi uchun AsyncLocalStorage ishlatiladi. Serverless/Node
 * muhitida bir vaqtda kelgan so'rovlar bir-biriga aralashmasligi uchun
 * kontekst har bir so'rov ichida alohida saqlanadi.
 *
 * Chat route `apiAuthContext.run({ accessToken, refreshToken }, handler)` bilan
 * o'rab oladi. external-api.request() shu kontekstdagi tokenni ishlatadi —
 * global .env tokeni EMAS.
 */
export interface UserTokenContext {
  accessToken: string;
  refreshToken?: string;
  /** User token API'da 401 bo'lib, refresh qilinganda chaqiriladi (DB'ga yozish uchun) */
  onTokenRefreshed?: (access: string, refresh?: string) => void;
}

export const apiAuthContext = new AsyncLocalStorage<UserTokenContext>();

export function getRequestTokenContext(): UserTokenContext | undefined {
  return apiAuthContext.getStore();
}
