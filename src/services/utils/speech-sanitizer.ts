/**
 * Speech Output Sanitizer
 * 
 * Removes all timing instructions, control words, and formatting markers
 * that could leak into spoken output. This is a hard guardrail.
 * 
 * Timing control belongs to TTS engine, NOT LLM prompts.
 */

const FORBIDDEN_TOKENS = [
  // Timing words
  /\bpause\b/gi,
  /\bPAUSE\b/g,
  /\[pause\]/gi,
  /\[PAUSE\]/g,
  /\(pause\)/gi,
  /\(PAUSE\)/g,
  
  // Timing instructions
  /\d+-\d+\s*seconds?/gi,
  /\d+\.\d+-\d+\s*seconds?/gi,
  /\d+\s*second\s*pause/gi,
  /brief\s*pause/gi,
  /short\s*pause/gi,
  /natural\s*pause/gi,
  
  // Bracket instructions
  /\[PAUSE\s*\d+[\.-]\d+s?\]/gi,
  /\[pause\s*\d+[\.-]\d+s?\]/gi,
  /\[PAUSE\s*\d+s?\]/gi,
  /\[pause\s*\d+s?\]/gi,
  
  // Control words
  /\bSLOWLY\b/g,
  /\bCLEARLY\b/g,
  /\bPAUSE\b/g,
  /\bBREATHE\b/gi,
  /\bslow\s*down\b/gi,
  /\bpacing\b/gi,
  
  // Ellipsis patterns that might be interpreted as pauses
  /\.\.\.\s*pause/gi,
  /pause\s*\.\.\./gi,
  
  // Timing markers in examples
  /\[PAUSE\s*\d+[\.-]\d+s\]/gi,
  /\[pause\s*\d+[\.-]\d+s\]/gi,
];

/**
 * Sanitize speech output by removing all timing instructions and control words
 * @param text Text that will be sent to TTS
 * @returns Sanitized text safe for speech synthesis
 */
export function sanitizeSpeechOutput(text: string): string {
  if (!text || typeof text !== 'string') {
    return text || '';
  }

  let sanitized = text;

  // Remove all forbidden tokens
  for (const pattern of FORBIDDEN_TOKENS) {
    sanitized = sanitized.replace(pattern, '');
  }

  // Remove standalone brackets that might contain instructions
  sanitized = sanitized.replace(/\[[^\]]*pause[^\]]*\]/gi, '');
  sanitized = sanitized.replace(/\([^)]*pause[^)]*\)/gi, '');

  // Clean up multiple spaces left by removals
  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  // Remove trailing/leading punctuation artifacts
  sanitized = sanitized.replace(/^[.,;:\s]+|[.,;:\s]+$/g, '');

  return sanitized;
}

/**
 * Validate that text contains no forbidden tokens
 * @param text Text to validate
 * @returns true if text is safe, false if it contains forbidden tokens
 */
export function validateSpeechOutput(text: string): { valid: boolean; violations: string[] } {
  if (!text || typeof text !== 'string') {
    return { valid: true, violations: [] };
  }

  const violations: string[] = [];

  for (const pattern of FORBIDDEN_TOKENS) {
    if (pattern.test(text)) {
      violations.push(pattern.toString());
    }
  }

  // Check for bracket instructions
  if (/\[[^\]]*pause[^\]]*\]/gi.test(text)) {
    violations.push('Bracket pause instruction');
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Format summary as natural sentences (not bullet points with timing)
 * @param fields Record of field names and values
 * @returns Natural sentence format for summary
 */
export function formatSummaryAsNaturalSentences(fields: Record<string, any>): string {
  const sentences: string[] = [];
  
  // Start with introduction
  sentences.push("Here's a quick summary of what I have.");
  
  // Add each field as a natural sentence
  for (const [fieldName, value] of Object.entries(fields)) {
    if (value && value !== '') {
      // Format field name (convert camelCase to readable)
      const readableName = fieldName
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .trim();
      
      sentences.push(`${readableName}: ${value}.`);
    }
  }
  
  // Join with natural flow (periods create natural pauses in TTS)
  return sentences.join(' ');
}
