import { z } from 'zod';
import { FormFieldInputSchema, FormMapRequest, FormFieldMapping } from './types';

/**
 * Server-side strict whitelist of allowed profile keys.
 * Absolutely excludes all government IDs (Aadhaar, PAN, Passport, Voter ID)
 * and financial / banking credentials.
 */
export const SERVER_ALLOWED_PROFILE_KEYS = [
  'full_name',
  'first_name',
  'last_name',
  'name',
  'email',
  'phone',
  'date_of_birth',
  'gender',
  'address',
  'city',
  'state',
  'pincode',
  'country',
  'father_name',
  'mother_name',
  'blood_group',
  'emergency_contact',
  'marital_status',
  'occupation',
] as const;

export type ServerAllowedProfileKey = (typeof SERVER_ALLOWED_PROFILE_KEYS)[number];

const HostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/**
 * Zod validation schema for POST /api/form/map input.
 * Strict rules:
 * - siteHost is hostname only (no protocol, path, query, fragment, port, or slashes)
 * - fields schema only (max 100 fields)
 * - NEVER accept or forward profile values!
 */
export const FormMapRequestSchema = z.object({
  siteHost: z
    .string()
    .min(1, 'siteHost is required')
    .max(253, 'siteHost too long')
    .refine(
      (val) => !val.includes('/') && !val.includes('?') && !val.includes('#') && !val.includes(':') && !val.includes('@'),
      { message: 'siteHost must be a valid hostname without protocol, port, path, query or fragment' }
    )
    .refine((val) => HostnameRegex.test(val), {
      message: 'siteHost format invalid',
    }),
  language: z.string().min(2).max(10).default('en'),
  fields: z
    .array(
      z.object({
        id: z.string().min(1).max(100),
        label: z.string().max(300),
        type: z.string().max(50),
        options: z.array(z.string().max(100)).max(50).optional(),
        required: z.boolean().optional(),
        section: z.string().max(150).optional(),
      })
    )
    .min(1, 'At least one field schema must be provided')
    .max(100, 'Exceeded maximum allowable fields per request (100)'),
  profileKeys: z.array(z.string().max(50)).max(50),
});

/**
 * Zod schema for validating raw LLM response.
 */
export const LLMOutputItemSchema = z.object({
  fieldId: z.string().min(1),
  profileKey: z.string().nullable(),
  explanation: z.string(),
  whatToEnter: z.string(),
  confidence: z.number().min(0).max(1),
});

export const LLMOutputListSchema = z.array(LLMOutputItemSchema);
