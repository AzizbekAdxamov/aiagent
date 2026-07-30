/**
 * Jina AI Embedding Service
 * 
 * OpenAI-compatible embedding API
 * 10M free tokens
 * Base URL: https://api.jina.ai/v1
 * Model: jina-embeddings-v3 (multilingual, 1024 dimensions)
 */

class EmbeddingService {
  private apiKey: string = "";
  private baseURL: string = "https://api.jina.ai/v1";
  private model: string = "jina-embeddings-v3";
  private initialized = false;

  init() {
    this.apiKey = process.env.JINA_API_KEY || "";
    this.model = process.env.JINA_EMBEDDING_MODEL || "jina-embeddings-v3";
    this.initialized = !!this.apiKey;
    
    if (this.initialized) {
      console.log(`[Jina AI] Embedding service initialized with model: ${this.model}`);
    } else {
      console.log("[Jina AI] No API key configured, embeddings disabled");
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Create embeddings for a single text
   */
  async embed(text: string): Promise<number[]> {
    const results = await this.embedBatch([text]);
    return results[0] || [];
  }

  /**
   * Create embeddings for multiple texts at once
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!this.initialized) {
      console.warn("[Jina AI] Embedding service not initialized");
      return texts.map(() => []);
    }

    try {
      const response = await fetch(`${this.baseURL}/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          normalized: true,
          embedding_type: "float",
          input: texts,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Jina AI] API error: ${response.status}`, errorText);
        return texts.map(() => []);
      }

      const result = await response.json();
      
      if (!result.data || !Array.isArray(result.data)) {
        console.error("[Jina AI] Unexpected response format", result);
        return texts.map(() => []);
      }

      // Sort by index and extract embeddings
      const embeddings: number[][] = new Array(texts.length);
      for (const item of result.data) {
        if (item.index < texts.length) {
          embeddings[item.index] = item.embedding;
        }
      }

      return embeddings;
    } catch (error) {
      console.error("[Jina AI] Embedding error:", error);
      return texts.map(() => []);
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * Search for the most similar texts given a query
   */
  async semanticSearch(
    query: string,
    candidates: Array<{ id: string | number; text: string; metadata?: any }>,
    topK: number = 5
  ): Promise<Array<{ id: string | number; score: number; metadata?: any }>> {
    if (!this.initialized || candidates.length === 0) {
      return candidates.slice(0, topK).map((c) => ({ id: c.id, score: 0 }));
    }

    try {
      // Embed query and all candidates in one batch
      const texts = [query, ...candidates.map((c) => c.text)];
      const allEmbeddings = await this.embedBatch(texts);

      if (allEmbeddings.length === 0 || allEmbeddings[0].length === 0) {
        return candidates.slice(0, topK).map((c) => ({ id: c.id, score: 0 }));
      }

      const queryEmbedding = allEmbeddings[0];
      const results: Array<{ id: string | number; score: number; metadata?: any }> = [];

      for (let i = 0; i < candidates.length; i++) {
        const candidateEmbedding = allEmbeddings[i + 1];
        if (candidateEmbedding && candidateEmbedding.length > 0) {
          const score = this.cosineSimilarity(queryEmbedding, candidateEmbedding);
          results.push({
            id: candidates[i].id,
            score,
            metadata: candidates[i].metadata,
          });
        }
      }

      // Sort by score descending
      results.sort((a, b) => b.score - a.score);
      return results.slice(0, topK);
    } catch (error) {
      console.error("[Jina AI] Semantic search error:", error);
      return candidates.slice(0, topK).map((c) => ({ id: c.id, score: 0 }));
    }
  }
}

export const embeddingService = new EmbeddingService();
