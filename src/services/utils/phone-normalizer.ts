/**
 * Phone Number Normalization Utility for Australian Numbers
 * 
 * This utility ensures phone numbers are:
 * - Captured accurately
 * - Normalized and validated
 * - Formatted for natural readback
 * - Never read digit-by-digit
 */

export interface NormalizedPhone {
  rawPhoneNumber: string; // E.164 format: 0412345678
  spokenPhoneNumber: string; // Natural format: "04 12 345 678"
  isValid: boolean;
}

/**
 * Normalize Australian phone number
 * @param phoneInput Raw phone input from STT/transcript
 * @returns Normalized phone object with raw and spoken formats
 */
export function normalizeAustralianPhone(phoneInput: string): NormalizedPhone {
  if (!phoneInput || typeof phoneInput !== 'string') {
    return {
      rawPhoneNumber: '',
      spokenPhoneNumber: '',
      isValid: false,
    };
  }

  // Remove all non-digit characters except + at the start
  let cleaned = phoneInput.replace(/[^\d+]/g, '');

  // Handle +61 format (convert to 0 format)
  if (cleaned.startsWith('+61')) {
    cleaned = '0' + cleaned.substring(3);
  } else if (cleaned.startsWith('61') && cleaned.length === 11) {
    cleaned = '0' + cleaned.substring(2);
  }

  // Remove leading + if still present
  cleaned = cleaned.replace(/^\+/, '');

  // Validate Australian mobile format (must start with 04 and be 10 digits)
  const isValid = /^04\d{8}$/.test(cleaned);

  if (!isValid || cleaned.length !== 10) {
    return {
      rawPhoneNumber: cleaned,
      spokenPhoneNumber: cleaned, // Fallback to raw if invalid
      isValid: false,
    };
  }

  // Format for natural readback: 04 12 345 678
  // Australian mobile format: 04XX XXX XXX
  const formatted = `${cleaned.substring(0, 2)} ${cleaned.substring(2, 4)} ${cleaned.substring(4, 7)} ${cleaned.substring(7, 10)}`;

  return {
    rawPhoneNumber: cleaned,
    spokenPhoneNumber: formatted,
    isValid: true,
  };
}

/**
 * Format phone number for confirmation readback
 * Returns the spoken format that should be used in agent responses
 */
export function getPhoneReadbackFormat(phoneInput: string): string {
  const normalized = normalizeAustralianPhone(phoneInput);
  return normalized.isValid ? normalized.spokenPhoneNumber : phoneInput;
}

/**
 * Extract phone number from text/transcript
 * Handles various formats caller might use
 */
export function extractPhoneFromText(text: string): string | null {
  if (!text) return null;

  // Patterns for Australian phone numbers
  const patterns = [
    // 04XX XXX XXX format
    /(?:0[2-478]\d{1})\s*(\d{3})\s*(\d{3})/,
    // 04XXXXXXXX format
    /(0[2-478]\d{8})/,
    // +61 4XX XXX XXX format
    /(?:\+61|0061)\s*([2-478]\d{1})\s*(\d{3})\s*(\d{3})/,
    // Any 10-digit sequence starting with 04
    /(04\d{8})/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      // Reconstruct full number
      if (match[0].startsWith('+61') || match[0].startsWith('0061')) {
        return '0' + match[1] + match[2] + match[3];
      }
      return match[0].replace(/\s+/g, '');
    }
  }

  return null;
}
