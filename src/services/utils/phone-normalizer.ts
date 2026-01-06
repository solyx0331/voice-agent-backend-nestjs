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
  spokenPhoneNumber: string; // Natural format: "Zero four one two, three four five, six seven eight"
  isValid: boolean;
  isMobile: boolean; // true for mobile (04XX), false for landline
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
      isMobile: false,
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

  // Validate Australian phone format (10 digits, starting with 02, 03, 04, 07, 08)
  // Mobile: 04XX (10 digits)
  // Landline: 02XX, 03XX, 07XX, 08XX (10 digits)
  const isValid = /^(0[23478]\d{8})$/.test(cleaned);
  const isMobile = /^04\d{8}$/.test(cleaned);

  if (!isValid || cleaned.length !== 10) {
    return {
      rawPhoneNumber: cleaned,
      spokenPhoneNumber: cleaned, // Fallback to raw if invalid
      isValid: false,
      isMobile: false,
    };
  }

  // Convert digits to words for natural speech
  const digitWords: Record<string, string> = {
    '0': 'zero',
    '1': 'one',
    '2': 'two',
    '3': 'three',
    '4': 'four',
    '5': 'five',
    '6': 'six',
    '7': 'seven',
    '8': 'eight',
    '9': 'nine',
  };

  // Format based on phone type
  let formatted: string;
  
  if (isMobile) {
    // Mobile format: 04XX XXX XXX
    // "Zero four one two, three four five, six seven eight"
    const part1 = cleaned.substring(0, 4).split('').map(d => digitWords[d]).join(' ');
    const part2 = cleaned.substring(4, 7).split('').map(d => digitWords[d]).join(' ');
    const part3 = cleaned.substring(7, 10).split('').map(d => digitWords[d]).join(' ');
    formatted = `${part1}, ${part2}, ${part3}`;
  } else {
    // Landline format: 0X XXXX XXXX (e.g., 03 9123 4567)
    // "Zero three, nine one two three, four five six seven"
    const part1 = cleaned.substring(0, 2).split('').map(d => digitWords[d]).join(' ');
    const part2 = cleaned.substring(2, 6).split('').map(d => digitWords[d]).join(' ');
    const part3 = cleaned.substring(6, 10).split('').map(d => digitWords[d]).join(' ');
    formatted = `${part1}, ${part2}, ${part3}`;
  }

  return {
    rawPhoneNumber: cleaned,
    spokenPhoneNumber: formatted,
    isValid: true,
    isMobile,
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
 * Handles various formats caller might use (including word digits)
 */
export function extractPhoneFromText(text: string): string | null {
  if (!text) return null;

  // First, try to extract numeric patterns
  const numericPatterns = [
    // 04XX XXX XXX format
    /(?:0[2-478]\d{1})\s*(\d{3})\s*(\d{3})/,
    // 04XXXXXXXX format
    /(0[2-478]\d{8})/,
    // +61 4XX XXX XXX format
    /(?:\+61|0061)\s*([2-478]\d{1})\s*(\d{3})\s*(\d{3})/,
    // Any 10-digit sequence starting with 02, 03, 04, 07, 08
    /(0[23478]\d{8})/,
  ];

  for (const pattern of numericPatterns) {
    const match = text.match(pattern);
    if (match) {
      // Reconstruct full number
      if (match[0].startsWith('+61') || match[0].startsWith('0061')) {
        return '0' + match[1] + match[2] + match[3];
      }
      return match[0].replace(/\s+/g, '');
    }
  }

  // Try to extract from word digits (e.g., "zero four one two three four five six seven eight")
  const wordToDigit: Record<string, string> = {
    'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
    'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9',
  };

  const wordPattern = /\b(zero|one|two|three|four|five|six|seven|eight|nine)(?:\s+(zero|one|two|three|four|five|six|seven|eight|nine)){9,}\b/i;
  const wordMatch = text.match(wordPattern);
  if (wordMatch) {
    const words = text.match(/\b(zero|one|two|three|four|five|six|seven|eight|nine)\b/gi);
    if (words && words.length >= 10) {
      const digits = words.slice(0, 10).map(w => wordToDigit[w.toLowerCase()]).join('');
      if (/^0[23478]\d{8}$/.test(digits)) {
        return digits;
      }
    }
  }

  return null;
}
