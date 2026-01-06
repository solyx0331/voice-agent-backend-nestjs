/**
 * Postcode Normalization Utility for Australian Postcodes
 * 
 * Australian postcodes are 4 digits (e.g., 3000, 2000)
 * Readback format: digit-by-digit with natural pauses (not saying "pause")
 */

export interface NormalizedPostcode {
  rawPostcode: string; // Raw digits: "3000"
  spokenPostcode: string; // Natural format: "three zero zero zero"
  isValid: boolean;
}

/**
 * Map digits to spoken words
 */
const DIGIT_WORDS: Record<string, string> = {
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

/**
 * Normalize Australian postcode
 * @param postcodeInput Raw postcode input from STT/transcript
 * @returns Normalized postcode object with raw and spoken formats
 */
export function normalizeAustralianPostcode(postcodeInput: string): NormalizedPostcode {
  if (!postcodeInput || typeof postcodeInput !== 'string') {
    return {
      rawPostcode: '',
      spokenPostcode: '',
      isValid: false,
    };
  }

  // Extract only digits
  const digits = postcodeInput.replace(/\D/g, '');

  // Australian postcodes are exactly 4 digits
  const isValid = /^\d{4}$/.test(digits);

  if (!isValid || digits.length !== 4) {
    return {
      rawPostcode: digits,
      spokenPostcode: digits, // Fallback to raw if invalid
      isValid: false,
    };
  }

  // Format for natural readback: "three zero zero zero"
  // Read each digit individually with natural spacing
  const spokenParts = digits.split('').map(digit => DIGIT_WORDS[digit] || digit);
  const spokenPostcode = spokenParts.join(' ');

  return {
    rawPostcode: digits,
    spokenPostcode: spokenPostcode,
    isValid: true,
  };
}

/**
 * Format postcode for confirmation readback
 * Returns the spoken format that should be used in agent responses
 */
export function getPostcodeReadbackFormat(postcodeInput: string): string {
  const normalized = normalizeAustralianPostcode(postcodeInput);
  return normalized.isValid ? normalized.spokenPostcode : postcodeInput;
}

/**
 * Extract postcode from text/transcript
 */
export function extractPostcodeFromText(text: string): string | null {
  if (!text) return null;

  // Pattern for 4-digit postcode
  const pattern = /\b(\d{4})\b/;
  const match = text.match(pattern);
  
  if (match) {
    const digits = match[1];
    // Validate it's a reasonable Australian postcode (1000-9999)
    const num = parseInt(digits, 10);
    if (num >= 1000 && num <= 9999) {
      return digits;
    }
  }

  return null;
}
