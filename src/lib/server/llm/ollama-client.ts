export interface OllamaClientOptions {
  baseUrl: string;
  model: string;
  timeoutMs: number;
  retries?: number;
}

export interface OllamaChatResult {
  content: string;
  model: string;
  duration_ms: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  done_reason?: string;
}

interface OllamaChatPayload {
  model?: string;
  message?: { content?: string };
  response?: string;
  done_reason?: string;
  total_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

export class OllamaClient {
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly retries: number;

  constructor(options: OllamaClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.model = options.model;
    this.timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : 15000;
    this.retries = options.retries ?? 1;
  }

  async structuredChat(prompt: string, format: unknown): Promise<OllamaChatResult> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      try {
        return await this.tryStructuredChat(prompt, format);
      } catch (error) {
        lastError = error;
        if (attempt < this.retries) await delay(200 * (attempt + 1));
      }
    }
    throw lastError instanceof Error ? lastError : new Error("ollama_unavailable");
  }

  private async tryStructuredChat(prompt: string, format: unknown): Promise<OllamaChatResult> {
    const controller = new AbortController();
    const startedAt = Date.now();
    const timeout = setTimeout(() => controller.abort(new Error(`ollama_timeout_${this.timeoutMs}ms`)), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: "user", content: prompt }],
          stream: false,
          format,
          options: { temperature: 0 },
        }),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error(`ollama_http_${response.status}`);
      const payload = await response.json() as OllamaChatPayload;
      const content = payload.message?.content ?? payload.response;
      if (!content) throw new Error("ollama_empty_response");
      return {
        content,
        model: payload.model ?? this.model,
        duration_ms: payload.total_duration ? Math.round(payload.total_duration / 1_000_000) : Date.now() - startedAt,
        prompt_tokens: payload.prompt_eval_count,
        completion_tokens: payload.eval_count,
        done_reason: payload.done_reason,
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`ollama_timeout_${this.timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
