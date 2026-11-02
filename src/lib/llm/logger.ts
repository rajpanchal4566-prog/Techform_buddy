/**
 * TechForm Buddy - Secure Redacted Logger (Phase 3)
 *
 * Strict Privacy Requirement:
 * Request and response bodies for form mapping and profile fill-values
 * MUST NEVER include raw profile values or sensitive user information.
 */

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  endpoint: string;
  method: string;
  userId?: string;
  siteHost?: string;
  fieldCount?: number;
  durationMs?: number;
  status: number;
  message?: string;
  error?: string;
  payloadSummary: string; // Redacted summary only (e.g. "[REDACTED: 5 field schemas]")
}

class RedactedLogger {
  private logHistory: LogEntry[] = [];
  private maxHistory = 200;

  public log(entry: Omit<LogEntry, 'timestamp'>): void {
    const fullEntry: LogEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    };

    this.logHistory.push(fullEntry);
    if (this.logHistory.length > this.maxHistory) {
      this.logHistory.shift();
    }

    // Standard console format with strictly redacted payload
    const prefix = `[TFB-AUDIT] [${fullEntry.level.toUpperCase()}] ${fullEntry.method} ${fullEntry.endpoint}`;
    const details = `status=${fullEntry.status} host=${fullEntry.siteHost || 'n/a'} duration=${fullEntry.durationMs || 0}ms payload=${fullEntry.payloadSummary}`;
    if (fullEntry.level === 'error') {
      console.error(`${prefix} ${details} error=${fullEntry.error || ''}`);
    } else if (fullEntry.level === 'warn') {
      console.warn(`${prefix} ${details} msg=${fullEntry.message || ''}`);
    } else {
      console.log(`${prefix} ${details}`);
    }
  }

  /**
   * Returns a copy of recent logs (used by unit tests to verify redaction).
   */
  public getHistory(): LogEntry[] {
    return [...this.logHistory];
  }

  public clearHistory(): void {
    this.logHistory = [];
  }
}

export const redactedLogger = new RedactedLogger();
