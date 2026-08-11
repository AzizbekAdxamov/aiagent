/**
 * FORMATTER LAYER (BOSQICH 7) — ResponseBuilder
 *
 * provider-manager.ts dagi 700+ satrli getTemplateResponse ni modullarga
 * ajratadi. Har bir tool o'z formatter faylida:
 *   - common.ts          → greeting, api error, fallback, thanks, admission
 *   - university.ts      → search_university
 *   - direction.ts       → search_direction, list_directions
 *   - tuition.ts         → search_tuition
 *   - grant.ts           → search_grants
 *   - news.ts            → search_news
 *   - comparison.ts      → compare_universities
 *   - recommendation.ts  → recommend
 *
 * ResponseBuilder.build() — tool natijasini ko'rib, to'g'ri formatterga
 * yo'naltiradi. Intent-level fallback'lar ham shu yerda (tool natijasi yo'q
 * yoki bo'sh bo'lganda).
 */
import {
  greetingResponse,
  apiErrorResponse,
  fallbackResponse,
  thanksResponse,
  admissionResponse,
  genericClarificationResponse,
  appendLowConfidenceClarification,
  generalChatResponse,
} from "./common";
import { formatUniversitySearch, universityNotFoundResponse } from "./university";
import { formatDirectionSearch, formatDirectionDetail, formatDirectionList, directionNotFoundResponse, directionListNotFoundResponse } from "./direction";
import { formatTuitionSearch, tuitionNotFoundResponse } from "./tuition";
import { formatGrantsSearch, grantsNotFoundResponse } from "./grant";
import { formatNewsSearch, newsNotFoundResponse } from "./news";
import { formatComparison } from "./comparison";
import { formatRecommend } from "./recommendation";
import { formatExplanation } from "./explanation";

export interface BuildTemplateParams {
  intent: string;
  toolResults: any[];
  message: string;
  language: string;
  /** CONFIDENCE SCORE: past ishonchli direction bo'lsa clarification qo'shiladi */
  entityConfidence?: Record<string, number>;
  entities?: Record<string, any>;
}

export class ResponseBuilder {
  /**
   * Tool natijalari asosida template javob qurish.
   * Greeting so'zi → greeting shabloni, keyin tool bo'yicha dispatch.
   */
  build({ intent, toolResults, message, language, entityConfidence, entities }: BuildTemplateParams): string {
    // Greeting — FAQAT toza salomlashish (classifier Step 0 greeting guard bilan
    // bir xil qoida). MUHIM (Fix): "Salom. Men bu yil imtihondan yiqildim...
    // Qanday maslahat berasan?" kabi UZUN xabar greeting EMAS — unga greeting
    // template qaytarmaslik kerak (aks holda ruhiy maslahat o'rniga salomlashish
    // chiqadi). "salom" so'zi ichida bo'lgan har qanday xabar emas, faqat
    // yolg'iz salomlashish xabari greeting hisoblanadi.
    const trimmedMsg = message.trim();
    const isBareSalutation =
      /^(salom|assalomu?|hayrli\s+kun|hello|hi|hey|vaalom)\s*[!.?,]*\s*$/i.test(trimmedMsg);
    const isGreetingWord = intent === "greeting" || isBareSalutation;
    if (isGreetingWord) {
      return greetingResponse(language);
    }

    let content: string | null = null;

    if (toolResults.length > 0) {
      const firstResult = toolResults[0];

      // API/tool xatosi (401, timeout) → aniq bog'lanish xatosi
      if (firstResult.success === false) {
        console.warn(`[Template] API xatosi (${firstResult.tool}): ${firstResult.error || "noma'lum xato"}`);
        return apiErrorResponse(language);
      }

      if (firstResult.success && firstResult.data) {
        switch (firstResult.tool) {
          case "search_university":
            content = formatUniversitySearch(firstResult, message);
            break;
          case "search_direction":
            // QUERY RESOLVER (BOSQICH 14): direction_detail rejimida yo'nalishning
            // o'zi haqida javob beramiz — universitetlar ro'yxati reklamasi emas.
            content = firstResult.data?.directionDetail
              ? formatDirectionDetail(firstResult, firstResult.data?.directionPhrase)
              : formatDirectionSearch(firstResult, message);
            break;
          case "list_directions":
            content = formatDirectionList(firstResult);
            break;
          case "search_tuition":
            content = formatTuitionSearch(firstResult);
            break;
          case "search_grants":
            content = formatGrantsSearch(firstResult);
            break;
          case "search_news":
            content = formatNewsSearch(firstResult);
            break;
          case "compare_universities":
            content = formatComparison(firstResult);
            break;
          case "recommend":
            content = formatRecommend(firstResult, message);
            break;
          case "explain_recommendation":
            content = formatExplanation(firstResult);
            break;
          default:
            content = null;
        }
      }
    }

    // Intent-level fallback (tool natijasi bo'lmagan yoki "none" tool bo'lsa)
    if (content === null) {
      content = this.intentFallback(intent, message, language);
    }

    // CONFIDENCE SCORE: past ishonchli direction bo'lsa — aniqlashtirish qo'shamiz
    if (content && entityConfidence && entities) {
      content = appendLowConfidenceClarification(content, entities, entityConfidence, language);
    }

    return content;
  }

  /** Tool natijasi bo'lmaganda — intent bo'yicha maxsus javob */
  private intentFallback(intent: string, message: string, language: string): string {
    const lower = message.toLowerCase();

    if (intent === "direction_search") return directionNotFoundResponse();
    if (intent === "direction_list") return directionListNotFoundResponse();
    if (intent === "grant_list" || intent === "grant_search") return grantsNotFoundResponse();
    if (intent === "news_list" || intent === "news_search") return newsNotFoundResponse();
    if (intent === "tuition_search") return tuitionNotFoundResponse();
    if (intent === "university_list") {
      return `Kechirasiz, hozircha universitetlar ro'yxatini olishning imkoni bo'lmadi. 😔\n\n📌 **[Mentalaba.uz](https://mentalaba.uz/universities)** — barcha universitetlar katalogi`;
    }
    if (intent === "university_search" || intent === "university_detail") return universityNotFoundResponse();
    if (intent === "thanks") return thanksResponse();
    if (intent === "admission") return admissionResponse(message);
    if (intent === "general_chat") return generalChatResponse(language);

    if (lower.includes("qaysi") || lower.includes("tanlasam") || lower.includes("bilmayman") || lower.includes("yaxshisi") || lower.includes("maslahat")) {
      return genericClarificationResponse(language);
    }

    return fallbackResponse(language);
  }
}

export const responseBuilder = new ResponseBuilder();
