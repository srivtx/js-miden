export type CircuitState = 'closed' | 'open' | 'half-open';

interface CircuitBreakerOptions {
  failureThreshold: number;
  failureWindowMs: number;
  halfOpenTimeoutMs: number;
  timeoutMs: number;
}

interface FailureRecord {
  timestamp: number;
}

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures: FailureRecord[] = [];
  private lastOpenTime: number = 0;
  private halfOpenAttempts: number = 0;

  constructor(
    private readonly options: CircuitBreakerOptions = {
      failureThreshold: 5,
      failureWindowMs: 60000,
      halfOpenTimeoutMs: 30000,
      timeoutMs: 5000,
    }
  ) {}

  getState(): CircuitState {
    this.checkTransition();
    return this.state;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.checkTransition();

    if (this.state === 'open') {
      const error = new Error('Circuit breaker is OPEN');
      (error as any).statusCode = 503;
      throw error;
    }

    if (this.state === 'half-open' && this.halfOpenAttempts >= 1) {
      const error = new Error('Circuit breaker is OPEN');
      (error as any).statusCode = 503;
      throw error;
    }

    if (this.state === 'half-open') {
      this.halfOpenAttempts++;
    }

    try {
      const result = await this.executeWithTimeout(fn);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, this.options.timeoutMs);

      fn()
        .then(resolve)
        .catch(reject)
        .finally(() => clearTimeout(timeout));
    });
  }

  private checkTransition(): void {
    if (this.state === 'open') {
      const elapsed = Date.now() - this.lastOpenTime;
      if (elapsed >= this.options.halfOpenTimeoutMs) {
        this.state = 'half-open';
        this.halfOpenAttempts = 0;
      }
    }
  }

  private onSuccess(): void {
    if (this.state === 'half-open') {
      this.state = 'closed';
      this.failures = [];
      this.halfOpenAttempts = 0;
    }
  }

  private onFailure(): void {
    this.failures.push({ timestamp: Date.now() });
    this.cleanupOldFailures();

    // BUG: No failure threshold check - circuit never opens!
    // The line below is intentionally missing:
    // if (this.failures.length >= this.options.failureThreshold) {
    //   this.state = 'open';
    //   this.lastOpenTime = Date.now();
    // }
  }

  private cleanupOldFailures(): void {
    const cutoff = Date.now() - this.options.failureWindowMs;
    this.failures = this.failures.filter(f => f.timestamp > cutoff);
  }

  getMetrics() {
    return {
      state: this.state,
      failuresInWindow: this.failures.length,
      failureThreshold: this.options.failureThreshold,
    };
  }
}
