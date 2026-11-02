/**
 * Browser Agent Tool Registry & Protocol
 *
 * Defines typed tool schemas, parameter validation, safety policies,
 * and structured execution results for autonomous browser and portal tasks.
 */

export type ToolExecutionStatus = 'attempted' | 'successful' | 'failed' | 'unverified';

export interface ToolVerificationRecord {
  verified: boolean;
  condition: string;
  expectedValue?: any;
  actualValue?: any;
  details?: string;
}

export interface ToolExecutionResult<T = any> {
  tool: string;
  toolName: string;
  status: ToolExecutionStatus;
  success: boolean;
  message: string;
  messageHi?: string;
  data?: T;
  error?: string;
  verification?: ToolVerificationRecord;
  recoveryAdvice?: string;
  timestamp: number;
}

export type BrowserToolName =
  | 'search_portal'
  | 'navigate'
  | 'inspect_page'
  | 'detect_forms'
  | 'fill_fields'
  | 'download_document'
  | 'ask_user'
  | 'request_approval'
  | 'speak';

export interface ToolParameterDef {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required?: boolean;
  enum?: string[];
  default?: any;
}

export interface BrowserToolDefinition {
  name: BrowserToolName;
  description: string;
  descriptionHi: string;
  parameters: Record<string, ToolParameterDef>;
  isReadOnly: boolean;
  isConsequential: boolean; // Requires explicit user approval before execution
  defaultVerifyCondition: string;
}

export const BROWSER_TOOL_REGISTRY: Record<BrowserToolName, BrowserToolDefinition> = {
  search_portal: {
    name: 'search_portal',
    description: 'Search official government portal directory and live index for official service URLs.',
    descriptionHi: 'आधिकारिक सरकारी पोर्टल डायरेक्टरी और इंडेक्स में सेवा पोर्टल खोजें।',
    parameters: {
      query: { type: 'string', description: 'Search keywords or service name (e.g. "National Scholarship Portal", "Passport")', required: true },
      domain: { type: 'string', description: 'Optional domain category (e.g. "government", "education", "banking")', required: false },
    },
    isReadOnly: true,
    isConsequential: false,
    defaultVerifyCondition: 'portal_found',
  },

  navigate: {
    name: 'navigate',
    description: 'Navigate browser tab to target official URL.',
    descriptionHi: 'ब्राउज़र को लक्षित आधिकारिक पोर्टल URL पर ले जाएं।',
    parameters: {
      url: { type: 'string', description: 'Destination web URL starting with http:// or https://', required: true },
      reason: { type: 'string', description: 'Reason for navigation', required: false },
    },
    isReadOnly: false,
    isConsequential: false,
    defaultVerifyCondition: 'dom_ready',
  },

  inspect_page: {
    name: 'inspect_page',
    description: 'Capture DOM snapshot of active page including headings, buttons, downloadable links, and form fields.',
    descriptionHi: 'सक्रिय पृष्ठ का हेडिंग, बटन, डाउनलोड लिंक और फॉर्म फ़ील्ड स्नैपशॉट लें।',
    parameters: {
      scope: { type: 'string', description: 'Inspection scope ("all", "forms", "downloads")', required: false, default: 'all' },
    },
    isReadOnly: true,
    isConsequential: false,
    defaultVerifyCondition: 'snapshot_captured',
  },

  detect_forms: {
    name: 'detect_forms',
    description: 'Scan and semantically classify all input form fields using form-core analyzer.',
    descriptionHi: 'फॉर्म-कोर एनालाइज़र से सभी फॉर्म फ़ील्ड्स को पहचानें और वर्गीकृत करें।',
    parameters: {
      forceRescan: { type: 'boolean', description: 'Force re-scan ignoring previous cache', required: false, default: false },
    },
    isReadOnly: true,
    isConsequential: false,
    defaultVerifyCondition: 'fields_classified',
  },

  fill_fields: {
    name: 'fill_fields',
    description: 'Autofill verified profile values into identified form fields, excluding passwords and sensitive IDs.',
    descriptionHi: 'सत्यापित प्रोफ़ाइल विवरण फॉर्म फ़ील्ड्स में सुरक्षित रूप से भरें (पासवर्ड व संवेदनशील आईडी छोड़कर)।',
    parameters: {
      fields: { type: 'array', description: 'Optional list of field IDs to fill. If omitted, fills all eligible fields.', required: false },
      profileValues: { type: 'object', description: 'Optional explicit values map', required: false },
      autofillAll: { type: 'boolean', description: 'Whether to autofill all high-confidence fields', required: false, default: true },
    },
    isReadOnly: false,
    isConsequential: false,
    defaultVerifyCondition: 'inputs_verified',
  },

  download_document: {
    name: 'download_document',
    description: 'Locate and initiate download for official form PDF, guideline, or notice.',
    descriptionHi: 'आधिकारिक फॉर्म पीडीएफ, दिशानिर्देश या नोटिस का डाउनलोड शुरू करें।',
    parameters: {
      url: { type: 'string', description: 'Download target file URL', required: false },
      filename: { type: 'string', description: 'Proposed local filename', required: false, default: 'official-document.pdf' },
      docType: { type: 'string', description: 'Document type or keyword', required: false },
    },
    isReadOnly: false,
    isConsequential: false,
    defaultVerifyCondition: 'download_started',
  },

  ask_user: {
    name: 'ask_user',
    description: 'Ask user for missing personal data or clarification with optional quick pick choices.',
    descriptionHi: 'आवश्यक लापता जानकारी या स्पष्टीकरण के लिए उपयोगकर्ता से प्रश्न पूछें।',
    parameters: {
      question: { type: 'string', description: 'Question text in active language', required: true },
      questionHi: { type: 'string', description: 'Question text in Hindi', required: false },
      fieldKey: { type: 'string', description: 'Slot or field key being resolved', required: false },
      options: { type: 'array', description: 'List of quick selection choices', required: false },
    },
    isReadOnly: true,
    isConsequential: false,
    defaultVerifyCondition: 'user_responded',
  },

  request_approval: {
    name: 'request_approval',
    description: 'Request explicit user confirmation before high-impact action (reviewing submitted data, external handoff).',
    descriptionHi: 'महत्वपूर्ण कार्रवाई से पहले उपयोगकर्ता से स्पष्ट अनुमति का अनुरोध करें।',
    parameters: {
      actionDescription: { type: 'string', description: 'Clear explanation of what will happen upon approval', required: true },
      actionDescriptionHi: { type: 'string', description: 'Explanation in Hindi', required: false },
      targetAction: { type: 'string', description: 'Action identifier to be executed if approved', required: true },
      payload: { type: 'object', description: 'Payload data to execute upon approval', required: false },
    },
    isReadOnly: false,
    isConsequential: true,
    defaultVerifyCondition: 'approval_decided',
  },

  speak: {
    name: 'speak',
    description: 'Read aloud text guidance or status in the user preferred language.',
    descriptionHi: 'उपयोगकर्ता की भाषा में आवाज द्वारा मार्गदर्शन या स्थिति सुनाएं।',
    parameters: {
      text: { type: 'string', description: 'Text to read aloud', required: true },
      language: { type: 'string', description: 'Language code (e.g. en, hi)', required: false },
    },
    isReadOnly: true,
    isConsequential: false,
    defaultVerifyCondition: 'spoken',
  },
};

export function normalizeToolName(toolName: string): BrowserToolName | string {
  if (toolName === 'fill') return 'fill_fields';
  if (toolName === 'download') return 'download_document';
  if (toolName === 'read_snapshot') return 'inspect_page';
  return toolName;
}

/**
 * Validate incoming tool parameters against defined tool schema
 */
export function validateToolParams(
  rawToolName: BrowserToolName | string,
  params: Record<string, any>
): { valid: boolean; error?: string } {
  const toolName = normalizeToolName(rawToolName);
  const tool = BROWSER_TOOL_REGISTRY[toolName as BrowserToolName];
  if (!tool) {
    return { valid: false, error: `Unknown browser agent tool: "${toolName}"` };
  }

  const p = params || {};

  for (const [key, def] of Object.entries(tool.parameters)) {
    const val = p[key];

    if (val === undefined || val === null || val === '') {
      if (def.required) {
        return { valid: false, error: `Tool "${toolName}" missing required parameter: "${key}"` };
      }
      continue;
    }

    if (def.type === 'string' && typeof val !== 'string') {
      return { valid: false, error: `Tool "${toolName}" parameter "${key}" must be a string` };
    }

    if (def.type === 'number' && typeof val !== 'number') {
      return { valid: false, error: `Tool "${toolName}" parameter "${key}" must be a number` };
    }

    if (def.type === 'boolean' && typeof val !== 'boolean') {
      return { valid: false, error: `Tool "${toolName}" parameter "${key}" must be a boolean` };
    }

    if (def.type === 'array' && !Array.isArray(val)) {
      return { valid: false, error: `Tool "${toolName}" parameter "${key}" must be an array` };
    }

    if (def.type === 'object' && (typeof val !== 'object' || Array.isArray(val))) {
      return { valid: false, error: `Tool "${toolName}" parameter "${key}" must be an object` };
    }
  }

  return { valid: true };
}

/**
 * Helper to construct standardized ToolExecutionResult
 */
export function createExecutionResult<T = any>(
  tool: string,
  status: ToolExecutionStatus,
  message: string,
  opts?: {
    messageHi?: string;
    data?: T;
    error?: string;
    verification?: ToolVerificationRecord;
    recoveryAdvice?: string;
  }
): ToolExecutionResult<T> {
  return {
    tool,
    toolName: tool,
    status,
    success: status === 'successful',
    message,
    messageHi: opts?.messageHi,
    data: opts?.data,
    error: opts?.error,
    verification: opts?.verification || {
      verified: status === 'successful',
      condition: BROWSER_TOOL_REGISTRY[tool as BrowserToolName]?.defaultVerifyCondition || 'default',
    },
    recoveryAdvice: opts?.recoveryAdvice,
    timestamp: Date.now(),
  };
}

/**
 * Observed browser state captured after tool execution
 */
export interface BrowserObservationRecord {
  url: string;
  hostname: string;
  title: string;
  readyState: string;
  fieldValues?: Record<string, string>;
  elementFound?: boolean;
  visibleErrors?: string[];
  downloadFound?: boolean;
  fieldCount?: number;
  downloadCount?: number;
  timestamp: number;
}

/**
 * Safe recovery strategy to resolve step verification failure
 */
export interface StepRecoveryStrategy {
  strategyName: string;
  description: string;
  descriptionHi?: string;
  action: BrowserToolName;
  fallbackParams?: Record<string, any>;
  maxRetries: number;
}

/**
 * Verification Engine: Validates observed DOM and browser state against verifyCondition
 */
export function verifyStepCondition(
  condition: string,
  observation: BrowserObservationRecord,
  expected?: any
): { verified: boolean; status: ToolExecutionStatus; reason: string; reasonHi?: string } {
  switch (condition) {
    case 'dom_ready': {
      if (observation.visibleErrors && observation.visibleErrors.length > 0) {
        return {
          verified: false,
          status: 'failed',
          reason: `Page loaded with errors: ${observation.visibleErrors.join('; ')}`,
          reasonHi: `पेज पर त्रुटि मिली: ${observation.visibleErrors.join('; ')}`,
        };
      }
      const isReady = observation.readyState === 'complete' || observation.readyState === 'interactive';
      if (!isReady) {
        return {
          verified: false,
          status: 'attempted',
          reason: 'Page DOM is still loading.',
          reasonHi: 'पेज लोड हो रहा है।',
        };
      }
      if (expected?.url) {
        try {
          const expectedHost = new URL(expected.url).hostname.replace(/^www\./, '');
          const actualHost = observation.hostname.replace(/^www\./, '');
          if (expectedHost && actualHost && !actualHost.includes(expectedHost) && !expectedHost.includes(actualHost)) {
            return {
              verified: false,
              status: 'failed',
              reason: `Destination mismatch: expected "${expectedHost}", but loaded "${actualHost}"`,
              reasonHi: `गंतव्य मेल नहीं खाता: अपेक्षित "${expectedHost}", मिला "${actualHost}"`,
            };
          }
        } catch {}
      }
      return {
        verified: true,
        status: 'successful',
        reason: `Page loaded and DOM interactive (${observation.url})`,
        reasonHi: `पेज लोड हुआ (${observation.url})`,
      };
    }

    case 'portal_found': {
      const count = expected?.results?.length ?? (observation.elementFound ? 1 : 0);
      if (count > 0) {
        return {
          verified: true,
          status: 'successful',
          reason: 'Verified official portal found in directory.',
          reasonHi: 'सत्यापित आधिकारिक पोर्टल मिला।',
        };
      }
      return {
        verified: false,
        status: 'unverified',
        reason: 'Zero matching official portals returned.',
        reasonHi: 'कोई आधिकारिक पोर्टल नहीं मिला।',
      };
    }

    case 'fields_classified': {
      const count = observation.fieldCount ?? Object.keys(observation.fieldValues || {}).length;
      if (count > 0) {
        return {
          verified: true,
          status: 'successful',
          reason: `Verified ${count} form field elements detected on page.`,
          reasonHi: `पेज पर ${count} फॉर्म फ़ील्ड्स सत्यापित हुए।`,
        };
      }
      return {
        verified: false,
        status: 'unverified',
        reason: 'No form field elements detected on the active page.',
        reasonHi: 'पेज पर कोई फॉर्म फ़ील्ड नहीं मिला।',
      };
    }

    case 'inputs_verified': {
      const expectedFields = expected?.fields || {};
      const actualFields = observation.fieldValues || {};
      let matched = 0;
      let totalExpected = 0;

      for (const [key, expVal] of Object.entries(expectedFields)) {
        if (!expVal) continue;
        totalExpected++;
        const actVal = actualFields[key];
        if (actVal && String(actVal).trim() === String(expVal).trim()) {
          matched++;
        }
      }

      if (totalExpected === 0) {
        const hasAnyFilled = Object.values(actualFields).some(v => Boolean(v));
        return {
          verified: hasAnyFilled,
          status: hasAnyFilled ? 'successful' : 'unverified',
          reason: hasAnyFilled ? 'Field values verified in DOM.' : 'No filled field values verified.',
          reasonHi: hasAnyFilled ? 'फ़ील्ड्स सत्यापित हुए।' : 'कोई भरा हुआ फ़ील्ड नहीं मिला।',
        };
      }

      const allMatched = matched === totalExpected;
      return {
        verified: allMatched,
        status: allMatched ? 'successful' : 'unverified',
        reason: `Verified ${matched}/${totalExpected} inputs in DOM.`,
        reasonHi: `DOM में ${matched}/${totalExpected} इनपुट सत्यापित हुए।`,
      };
    }

    case 'download_started': {
      if (observation.downloadFound) {
        return {
          verified: true,
          status: 'successful',
          reason: 'Official document download confirmed.',
          reasonHi: 'आधिकारिक दस्तावेज़ डाउनलोड की पुष्टि हुई।',
        };
      }
      return {
        verified: false,
        status: 'unverified',
        reason: 'Download did not start or link was unreachable.',
        reasonHi: 'डाउनलोड शुरू नहीं हुआ या लिंक अनुपलब्ध था।',
      };
    }

    case 'snapshot_captured': {
      return {
        verified: true,
        status: 'successful',
        reason: 'DOM state snapshot successfully captured.',
        reasonHi: 'पेज स्नैपशॉट सफलतापूर्वक प्राप्त हुआ।',
      };
    }

    case 'approval_decided': {
      const consented = expected?.consented === true;
      return {
        verified: consented,
        status: consented ? 'successful' : 'failed',
        reason: consented ? 'User approved consequential action.' : 'User declined or paused action.',
        reasonHi: consented ? 'उपयोगकर्ता ने अनुमति दी।' : 'उपयोगकर्ता ने अस्वीकार किया।',
      };
    }

    case 'user_responded': {
      const hasResponse = Boolean(expected?.response || expected?.answer);
      return {
        verified: hasResponse,
        status: hasResponse ? 'successful' : 'unverified',
        reason: hasResponse ? 'User responded to query.' : 'Waiting for user input.',
        reasonHi: hasResponse ? 'उपयोगकर्ता का उत्तर प्राप्त हुआ।' : 'उत्तर की प्रतीक्षा है।',
      };
    }

    case 'spoken': {
      return {
        verified: true,
        status: 'successful',
        reason: 'Audio guidance played successfully.',
        reasonHi: 'ऑडियो मार्गदर्शन सुनाया गया।',
      };
    }

    default:
      return {
        verified: true,
        status: 'successful',
        reason: `Condition "${condition}" verified.`,
        reasonHi: `स्थिति "${condition}" सत्यापित हुई।`,
      };
  }
}

/**
 * Recovery Engine: Selects appropriate safe alternative strategy on verification failure
 */
export function getStepRecoveryStrategy(
  action: BrowserToolName,
  retryCount: number,
  observation?: BrowserObservationRecord
): StepRecoveryStrategy | null {
  if (retryCount >= 2) {
    return {
      strategyName: 'escalate_to_user',
      description: 'Maximum automatic retries reached. Requesting citizen assistance.',
      descriptionHi: 'अधिकतम स्वचालित प्रयास पूरे हुए। उपयोगकर्ता सहायता की आवश्यकता है।',
      action: 'ask_user',
      maxRetries: 2,
    };
  }

  switch (action) {
    case 'navigate':
      return {
        strategyName: 'retry_search_portal',
        description: 'Navigation failed or timed out. Re-querying official directory for alternate link.',
        descriptionHi: 'नेविगेशन विफल रहा। वैकल्पिक लिंक खोजने के लिए पुनः खोज कर रहे हैं।',
        action: 'search_portal',
        maxRetries: 2,
      };

    case 'detect_forms':
      return {
        strategyName: 'wait_and_rescan',
        description: 'No form fields found initially. Waiting for dynamic SPA render and re-scanning.',
        descriptionHi: 'फ़ील्ड्स नहीं मिले। पेज लोड होने की प्रतीक्षा करके पुनः स्कैन कर रहे हैं।',
        action: 'detect_forms',
        fallbackParams: { forceRescan: true, delayMs: 1200 },
        maxRetries: 2,
      };

    case 'fill_fields':
      return {
        strategyName: 'rescan_and_refill',
        description: 'Field values did not settle in DOM. Re-scanning form elements and re-applying input events.',
        descriptionHi: 'फ़ील्ड्स सही से नहीं भरे। पुनः स्कैन कर इवेंट्स डिस्पैच कर रहे हैं।',
        action: 'fill_fields',
        fallbackParams: { autofillAll: true, forceEvents: true },
        maxRetries: 2,
      };

    case 'download_document':
      return {
        strategyName: 'inspect_downloads_and_retry',
        description: 'Direct download did not trigger. Re-inspecting page anchor links for PDF targets.',
        descriptionHi: 'डाउनलोड शुरू नहीं हुआ। पेज पर पीडीएफ लिंक खोज रहे हैं।',
        action: 'inspect_page',
        fallbackParams: { scope: 'downloads' },
        maxRetries: 2,
      };

    default:
      return null;
  }
}
