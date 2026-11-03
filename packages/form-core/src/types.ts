/**
 * TechForm Buddy - Shared Form Core Library Types
 * Strict compliance with Hard Rules:
 * - Passwords, OTP, Captcha and Hidden fields are completely excluded from scanning.
 * - Sensitive financial/ID fields (Aadhaar, PAN, Passport, Bank, Card) are marked as manual-only.
 * - Form values are never sent to external LLMs.
 */

export type FieldInputType =
  | 'text'
  | 'email'
  | 'tel'
  | 'number'
  | 'date'
  | 'time'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'textarea'
  | 'file'
  | 'url';

export interface FieldOption {
  label: string;
  value: string;
}

export type DocumentType =
  | 'aadhaar'
  | 'pan'
  | 'photo'
  | 'signature'
  | 'marksheet'
  | 'certificate'
  | 'resume'
  | 'other';

export interface VaultDocument {
  id: string;
  name: string;
  docType: DocumentType;
  fileType: string;
  fileSize: number;
  dataUrl?: string;
  lastUpdated?: number;
}

export interface ExtensionUserProfile {
  personal: {
    fullName: string;
    dob: string;
    gender: string;
    email: string;
    phone: string;
    address: string;
    state: string;
    city: string;
    pincode: string;
  };
  education: {
    college: string;
    university: string;
    course: string;
    branch: string;
    year: string;
    semester: string;
    rollNumber: string;
    enrollmentNumber: string;
    cgpa?: string;
  };
  additional: {
    fatherName: string;
    motherName: string;
    category: string;
    customFields: Record<string, string>;
  };
}

export interface FormFieldSchema {
  /** Unique identifier within scanned document (generated or from element id/name) */
  id: string;
  /** Unique, stable CSS selector to locate the element in the DOM */
  selector: string;
  /** Normalized input type */
  type: FieldInputType;
  /** Resolved human-readable field label */
  label: string;
  /** Section heading / fieldset legend under which field resides */
  section: string;
  /** Available options for select elements or radio groups */
  options?: FieldOption[];
  /** Whether the field has the required attribute or aria-required="true" */
  required: boolean;
  /** Maximum length allowed if specified */
  maxLength?: number;
  /** Regex pattern if specified */
  pattern?: string;
  /** Minimum value or date if specified */
  min?: string | number;
  /** Maximum value or date if specified */
  max?: string | number;
  /**
   * Always true for sensitive fields (passwords, OTPs, Aadhaar/PAN text numbers).
   * Tells overlay and autofill engine: "Please fill/type this yourself".
   */
  manual: boolean;
  /**
   * True for Aadhaar, PAN, Passport, Credit Card, Bank Account numbers.
   * Enforces Hard Rule 4: Never store or autofill text credentials from storage.
   */
  sensitive: boolean;
  /** Name of the radio group if this is a radio field */
  groupName?: string;
  /** Document type if this is a file upload input */
  matchedDocType?: DocumentType;
  /** Whether document can be attached */
  canAttachDoc?: boolean;
  /** Accepted file formats if specified on input */
  accept?: string;
}

export interface FormSchema {
  url: string;
  title: string;
  fields: FormFieldSchema[];
  scannedAt: number;
  isRealForm?: boolean;
}

export interface PageGuideStep {
  stepNumber: number;
  text: string;
  targetText?: string;
  targetSelector?: string;
}

export interface PageGuideData {
  taskName?: string;
  title: string;
  summary: string;
  steps: PageGuideStep[];
  aiAdvice?: string;
}

export type FillStatus =
  | 'filled'
  | 'skipped'
  | 'manual'
  | 'document_attached'
  | 'document_ready'
  | 'unverified';

export interface FieldFillResult {
  fieldId: string;
  selector: string;
  status: FillStatus;
  valueApplied?: string;
  docName?: string;
  verified?: boolean;
  reason?: string;
}

export interface FillSummary {
  success: boolean;
  results: FieldFillResult[];
  filledCount: number;
  skippedCount: number;
  manualCount: number;
  documentCount?: number;
  unverifiedCount?: number;
}

/**
 * Result of the semantic analyzing layer for a single form field.
 * Enforces Hard Rule 6 (no guessing) and Hard Rule 4 (sensitive fields manual).
 */
export interface FieldAnalysisResult {
  fieldId: string;
  selector: string;
  label: string;
  type: FieldInputType;
  profileKey: string | null;
  confidence: number; // 0.0 to 1.0 (>= 0.80 required to fill)
  canFill: boolean;
  manual: boolean;
  sensitive: boolean;
  explanation: string;
  whatToEnter: string;
  reason?: string;
}

export interface FormAnalysisSummary {
  fields: FieldAnalysisResult[];
  matchedCount: number;
  unmatchedCount: number;
  manualCount: number;
  sensitiveCount: number;
}

/** Bridge messaging protocol */
export type BridgeMessageType =
  | 'SCAN_REQUEST'
  | 'SCAN_RESPONSE'
  | 'FILL_REQUEST'
  | 'FILL_RESPONSE'
  | 'URL_CHANGED'
  | 'DOM_MUTATED'
  | 'SPEAK_REQUEST'
  | 'STOP_SPEAK_REQUEST'
  | 'PING'
  | 'PONG';

export interface BridgeMessage<T = unknown> {
  id: string;
  type: BridgeMessageType;
  payload?: T;
  timestamp: number;
}

export interface IBridge {
  send<T = unknown, R = unknown>(type: BridgeMessageType, payload?: T): Promise<R>;
  onMessage(handler: (message: BridgeMessage) => void): () => void;
  disconnect(): void;
}
