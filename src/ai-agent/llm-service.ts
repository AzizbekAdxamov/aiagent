import type { ChatMessage } from "@/types";
import { providerManager } from "./provider-manager";
import { embeddingService } from "./embedding-service";

class LLMService {
  init() {
    providerManager.init();
    embeddingService.init();
  }

  isInitialized(): boolean {
    return providerManager.isInitialized();
  }

  getActiveProvider(): string {
    return providerManager.getActiveProvider();
  }

  getProvidersStatus() {
    return providerManager.getProvidersStatus();
  }

  async generateResponse(
    userMessage: string,
    sessionContext: any,
    conversationHistory: ChatMessage[],
    language: "uz" | "ru" | "en" = "uz"
  ): Promise<{ content: string; intent?: string; toolUsed?: string; provider?: string }> {
    return providerManager.generateResponse(userMessage, sessionContext, conversationHistory, language);
  }

  async generateStreamingResponse(
    userMessage: string,
    sessionContext: any,
    conversationHistory: ChatMessage[],
    language: "uz" | "ru" | "en" = "uz",
    onToken: (token: string) => void
  ): Promise<{ intent?: string; toolUsed?: string; provider?: string }> {
    const result = await this.generateResponse(userMessage, sessionContext, conversationHistory, language);
    onToken(result.content);
    return { intent: result.intent, toolUsed: result.toolUsed, provider: result.provider };
  }
}

export const llmService = new LLMService();
