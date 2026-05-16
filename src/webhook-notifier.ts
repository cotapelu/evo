import { Logger } from './logger.js';

/**
 * Webhook notifier for sending event notifications to external services (Slack, Teams, custom webhooks)
 */
export class WebhookNotifier {
  private webhookUrl: string;
  private logger: Logger;
  private retryAttempts: number;
  private retryDelayMs: number;

  constructor(webhookUrl: string, logger: Logger, options?: { retryAttempts?: number; retryDelayMs?: number }) {
    this.webhookUrl = webhookUrl;
    this.logger = logger;
    this.retryAttempts = options?.retryAttempts ?? 2;
    this.retryDelayMs = options?.retryDelayMs ?? 1000;
  }

  /**
   * Send a webhook notification with event data
   */
  async send(event: string, data: any): Promise<void> {
    const payload = {
      event,
      data,
      timestamp: new Date().toISOString(),
      source: 'evo-agent',
    };

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await fetch(this.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          // Abort after 5s
          signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) {
          const text = await response.text().catch(() => '');
          lastError = new Error(`HTTP ${response.status}: ${text}`);
          if (attempt < this.retryAttempts) {
            await this.delay(this.retryDelayMs * attempt);
            continue;
          }
          this.logger.warn(`Webhook ${event} failed: ${lastError.message}`);
        } else {
          this.logger.debug(`Webhook ${event} sent successfully`);
          return;
        }
      } catch (error: any) {
        lastError = error;
        if (attempt < this.retryAttempts) {
          await this.delay(this.retryDelayMs * attempt);
          continue;
        }
        this.logger.warn(`Webhook ${event} error:`, error instanceof Error ? error.message : String(error));
      }
    }

    // All attempts failed
    if (lastError) {
      throw lastError;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
