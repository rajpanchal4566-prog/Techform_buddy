import { LLMProvider } from './types';
import { GeminiProvider } from './geminiProvider';
import { MockProvider } from './mockProvider';

export * from './types';
export * from './schema';
export * from './sanitizer';
export * from './cache';
export * from './rateLimiter';
export * from './logger';
export * from './cors';
export * from './geminiProvider';
export * from './mockProvider';

let activeProvider: LLMProvider | null = null;

export function getLLMProvider(): LLMProvider {
  if (activeProvider) {
    return activeProvider;
  }

  // If in test environment or test override requested, use MockProvider
  if (process.env.USE_MOCK_LLM === 'true') {
    return new MockProvider();
  }

  return new GeminiProvider();
}

/**
 * Allows swapping the provider adapter dynamically (e.g. for testing or switching models).
 */
export function setLLMProvider(provider: LLMProvider | null): void {
  activeProvider = provider;
}
