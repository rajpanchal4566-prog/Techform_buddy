/**
 * TechForm Buddy - LLM Provider Types & Interfaces (Phase 3)
 */

export interface FormFieldInputSchema {
  id: string;
  label: string;
  type: string;
  options?: string[];
  required?: boolean;
  section?: string;
}

export interface FormMapRequest {
  siteHost: string;
  language: string;
  fields: FormFieldInputSchema[];
  profileKeys: string[];
}

export interface FormFieldMapping {
  fieldId: string;
  profileKey: string | null;
  explanation: string;
  whatToEnter: string;
  confidence: number;
}

export interface FormMapResponse {
  siteHost: string;
  language: string;
  mappings: FormFieldMapping[];
  fromCache?: boolean;
  provider: string;
}

export interface LLMProvider {
  name: string;
  mapForm(request: FormMapRequest): Promise<FormFieldMapping[]>;
}
