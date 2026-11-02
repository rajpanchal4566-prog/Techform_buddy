import { LLMProvider, FormMapRequest, FormFieldMapping } from './types';
import { isSensitiveOrExcludedField } from './sanitizer';

export interface MockProviderOptions {
  simulatedDelayMs?: number;
  shouldFail?: boolean;
  shouldTimeout?: boolean;
  returnMalformedSchema?: boolean;
  forcedMappings?: Record<string, Partial<FormFieldMapping>>;
}

export class MockProvider implements LLMProvider {
  public readonly name = 'mock-llm-provider';
  private options: MockProviderOptions;

  constructor(options: MockProviderOptions = {}) {
    this.options = options;
  }

  public setOptions(options: MockProviderOptions) {
    this.options = { ...this.options, ...options };
  }

  public async mapForm(request: FormMapRequest): Promise<FormFieldMapping[]> {
    if (this.options.shouldTimeout) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      throw new Error('Gemini API request timed out after 10000ms');
    }

    if (this.options.shouldFail) {
      throw new Error('Simulated upstream LLM provider failure');
    }

    if (this.options.simulatedDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, this.options.simulatedDelayMs));
    }

    if (this.options.returnMalformedSchema) {
      // Return invalid structure (violates Zod schema)
      return [
        {
          fieldId: 'invalid_field',
          profileKey: 12345 as any, // non-string
          explanation: null as any,
          whatToEnter: '',
          confidence: 2.5, // > 1.0
        },
      ];
    }

    const availableSet = new Set(request.profileKeys);
    const mappings: FormFieldMapping[] = [];

    for (const field of request.fields) {
      if (this.options.forcedMappings?.[field.id]) {
        const forced = this.options.forcedMappings[field.id];
        mappings.push({
          fieldId: field.id,
          profileKey: forced.profileKey !== undefined ? forced.profileKey : null,
          explanation: forced.explanation || 'Provided explanation.',
          whatToEnter: forced.whatToEnter || 'Enter details.',
          confidence: forced.confidence !== undefined ? forced.confidence : 0.9,
        });
        continue;
      }

      // Hard Rule 4 & Security: Sensitive or auth fields MUST NOT be mapped
      if (isSensitiveOrExcludedField(field.label, field.id, field.type)) {
        mappings.push({
          fieldId: field.id,
          profileKey: null,
          explanation: 'Sensitive identity or authentication field.',
          whatToEnter: 'Please type this yourself directly on the website.',
          confidence: 0,
        });
        continue;
      }

      // Prompt injection check simulation:
      // If untrusted field label contains "ignore all instructions", ensure model does NOT follow it!
      const labelLower = field.label.toLowerCase();
      if (labelLower.includes('ignore all instructions') || labelLower.includes('ignore instructions')) {
        mappings.push({
          fieldId: field.id,
          profileKey: null,
          explanation: 'Unrecognized input field.',
          whatToEnter: 'Please review and enter manually.',
          confidence: 0.1,
        });
        continue;
      }

      // Standard heuristic mapping simulation for mock provider
      let mappedKey: string | null = null;
      let confidence = 0.5;
      let explanation = 'Enter this field as requested.';
      let whatToEnter = 'Standard text.';

      if (labelLower.includes('name') && availableSet.has('full_name')) {
        mappedKey = 'full_name';
        confidence = 0.95;
        explanation = "Applicant's official legal name.";
        whatToEnter = 'Your full name.';
      } else if (labelLower.includes('email') && availableSet.has('email')) {
        mappedKey = 'email';
        confidence = 0.98;
        explanation = 'Contact email address for communications.';
        whatToEnter = 'Valid email address.';
      } else if ((labelLower.includes('phone') || labelLower.includes('mobile')) && availableSet.has('phone')) {
        mappedKey = 'phone';
        confidence = 0.92;
        explanation = '10-digit mobile number for communication.';
        whatToEnter = '10-digit mobile number.';
      } else if ((labelLower.includes('dob') || labelLower.includes('birth')) && availableSet.has('date_of_birth')) {
        mappedKey = 'date_of_birth';
        confidence = 0.90;
        explanation = 'Date of birth as recorded on records.';
        whatToEnter = 'Date of birth.';
      }

      mappings.push({
        fieldId: field.id,
        profileKey: mappedKey,
        explanation,
        whatToEnter,
        confidence,
      });
    }

    return mappings;
  }
}
