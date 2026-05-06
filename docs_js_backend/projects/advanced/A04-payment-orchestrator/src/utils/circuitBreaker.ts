/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascading failures when a provider is down
 */

export type CircuitState = 'closed' | 'open' | 'half-open';

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private lastFailureTime: number | null = null;
  private successCount = 0;

  constructor(
    private name: string,
    private config: {
      failureThreshold: number;
      resetTimeoutMs: number;
      halfOpenMaxCalls?: number;
    }
  ) {}

  getState(): CircuitState {
    if (this.state === 'open') {
      const now = Date.now();
      if (this.lastFailureTime && now - this.lastFailureTime >= this.config.resetTimeoutMs) {
        this.state = 'half-open';
        this.successCount = 0;
        console.log(`[CircuitBreaker:${this.name}] Transitioned to half-open`);
      }
    }
    return this.state;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const currentState = this.getState();

    if (currentState === 'open') {
      throw new Error(`Circuit breaker '${this.name}' is OPEN`);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === 'half-open') {
      this.successCount++;
      const halfOpenMax = this.config.halfOpenMaxCalls || 3;
      if (this.successCount >= halfOpenMax) {
        this.state = 'closed';
        this.failureCount = 0;
        console.log(`[CircuitBreaker:${this.name}] Transitioned to closed`);
      }
    } else {
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === 'half-open') {
      this.state = 'open';
      console.log(`[CircuitBreaker:${this.name}] Transitioned to open (half-open failure)`);
    } else if (this.failureCount >= this.config.failureThreshold) {
      this.state = 'open';
      console.log(`[CircuitBreaker:${this.name}] Transitioned to open (threshold reached)`);
    }
  }

  getMetrics(): {
    state: CircuitState;
    failureCount: number;
    successCount: number;
    lastFailureTime: number | null;
  } {
    return {
      state: this.getState(),
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
    };
  }
}
