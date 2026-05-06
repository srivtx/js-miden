export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  timeoutMs: number;
}

export class RetryClient {
  constructor(private options: RetryOptions = {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 16000,
    timeoutMs: 10000,
  }) {}

  async fetch(url: string): Promise<{ status: number; data: string }> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);

        const data = await response.text();

        // BUG: Retries on 4xx errors (should only retry 5xx and timeouts)
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${data}`);
        }

        return { status: response.status, data };
      } catch (error: any) {
        lastError = error;

        const isTimeout = error.name === 'AbortError';
        const is5xx = error.message?.includes('HTTP 5');
        const is4xx = error.message?.includes('HTTP 4');

        // BUG: No jitter - all retries happen at exact intervals
        if (attempt < this.options.maxRetries) {
          const delay = Math.min(
            this.options.baseDelayMs * Math.pow(2, attempt),
            this.options.maxDelayMs
          );
          // Should add jitter: delay + Math.random() * delay
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
