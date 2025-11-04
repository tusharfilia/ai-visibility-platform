/**
 * Circuit Breaker Implementation
 * Prevents cascading failures by temporarily stopping calls to failing services
 */

export interface CircuitBreakerConfig {
  threshold: number;        // Number of failures before opening
  timeout: number;          // Time to wait before trying again (ms)
  resetTimeout: number;     // Time to wait before resetting failure count (ms)
}

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private state: CircuitBreakerState = 'CLOSED';
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private nextAttemptTime: number = 0;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
  }

  /**
   * Check if circuit breaker allows execution
   */
  canExecute(): boolean {
    const now = Date.now();
    
    switch (this.state) {
      case 'CLOSED':
        return true;
        
      case 'OPEN':
        if (now >= this.nextAttemptTime) {
          this.state = 'HALF_OPEN';
          return true;
        }
        return false;
        
      case 'HALF_OPEN':
        return true;
        
      default:
        return false;
    }
  }

  /**
   * Record successful execution
   */
  recordSuccess(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  /**
   * Record failed execution
   */
  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.config.threshold) {
      this.state = 'OPEN';
      this.nextAttemptTime = Date.now() + this.config.timeout;
    }
  }

  /**
   * Get current state
   */
  getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * Get failure count
   */
  getFailureCount(): number {
    return this.failureCount;
  }

  /**
   * Get time until next attempt
   */
  getTimeUntilNextAttempt(): number {
    if (this.state !== 'OPEN') {
      return 0;
    }
    
    return Math.max(0, this.nextAttemptTime - Date.now());
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.nextAttemptTime = 0;
  }

  /**
   * Get circuit breaker metrics
   */
  getMetrics(): {
    state: CircuitBreakerState;
    failureCount: number;
    timeUntilNextAttempt: number;
    isHealthy: boolean;
  } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      timeUntilNextAttempt: this.getTimeUntilNextAttempt(),
      isHealthy: this.state === 'CLOSED' || this.state === 'HALF_OPEN'
    };
  }
}


