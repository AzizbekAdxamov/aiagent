/**
 * CONVERSATION SNAPSHOT (BOSQICH 14): uzoq suhbatlarda LLM'ga yuboriladigan
 * history'ni qisqartiradi. DB'dan hech narsa o'chirilmaydi — faqat provider
 * call'lariga boradigan kontekst optimallashtiriladi.
 *
 * Qoida:
 *  - Oxirgi 6 xabar TO'LIQ yuboriladi (dialog davomi uchun kerak)
 *  - Undan oldingi xabarlar SNAPSHOT qilinadi: har biri faqat 1-qator,
 *    maksimum 100 belgi (mavzu izi saqlanadi, token tejaydi)
 *  - Jami yuboriladigan xabarlar chegaralanadi (MESSAGE_CAP)
 */
import type { ChatMessage } from "@/types";

const FULL_KEEP = 6; // oxirgi nechta xabar to'liq
const OLD_CAP = 10; // eski xabarlardan nechtasi snapshot qilinadi
const SNAPSHOT_MAX = 100; // har bir eski xabar uchun maksimum belgi

export function buildSnapshotHistory(conversationHistory: ChatMessage[]): ChatMessage[] {
  if (!conversationHistory || conversationHistory.length <= 12) {
    return conversationHistory;
  }

  const full = conversationHistory.slice(-FULL_KEEP);
  const old = conversationHistory.slice(0, Math.max(0, conversationHistory.length - FULL_KEEP)).slice(-OLD_CAP);

  const snapshot: ChatMessage[] = old.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content.length > SNAPSHOT_MAX ? `${m.content.slice(0, SNAPSHOT_MAX)}…` : m.content,
    intent: m.intent,
    selectedTool: m.selectedTool,
    timestamp: m.timestamp,
  }));

  return [...snapshot, ...full];
}
