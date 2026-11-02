import { LLMProvider, FormMapRequest, FormFieldMapping } from './types';
import { buildSecureLLMPrompt } from './sanitizer';
import { LLMOutputListSchema } from './schema';

export class GeminiProvider implements LLMProvider {
  public readonly name: string;
  public readonly model: string;
  private apiKey: string;
  private timeoutMs: number;

  constructor(apiKey?: string, model?: string, timeoutMs = 10000) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || '';
    this.model = model || process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
    this.name = `gemini:${this.model}`;
    this.timeoutMs = timeoutMs;
  }

  public async mapForm(request: FormMapRequest): Promise<FormFieldMapping[]> {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const { systemInstruction, userPrompt } = buildSecureLLMPrompt(request);

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const payload = {
      system_instruction: {
        parts: [{ text: systemInstruction }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        const sanitizedError = errorText.replace(new RegExp(this.apiKey, 'g'), '[REDACTED_KEY]').slice(0, 300);
        console.error(`[Gemini HTTP Error] status=${response.status} model=${this.model} error=${sanitizedError}`);
        throw new Error(`Gemini API HTTP error (status ${response.status}): ${sanitizedError}`);
      }

      const result = await response.json();
      const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        throw new Error('Empty response received from Gemini API');
      }

      const parsedJson = JSON.parse(rawText);
      const validatedList = LLMOutputListSchema.parse(parsedJson);

      return validatedList;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.error(`[Gemini Timeout] model=${this.model} exceeded timeout of ${this.timeoutMs}ms`);
        throw new Error(`Gemini API request timed out after ${this.timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
}
