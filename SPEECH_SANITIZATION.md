# Speech Output Sanitization

## Overview

This document describes the system-level sanitization that prevents timing instructions and control words from leaking into spoken output.

## Problem

LLMs should NEVER control speech timing. When prompts contain words like "pause", "[PAUSE]", or timing instructions, these can leak into the spoken output, causing the agent to literally say "pause" out loud.

## Solution

### 1. Speech Sanitizer Utility

**File**: `src/services/utils/speech-sanitizer.ts`

Removes all forbidden tokens before text reaches TTS:
- `pause`, `PAUSE`, `[pause]`, `[PAUSE]`
- Timing instructions: `1-2 seconds`, `0.5-1 second`
- Control words: `SLOWLY`, `CLEARLY`, `BREATHE`
- Bracket instructions: `[PAUSE 0.5-1s]`

### 2. Sanitization Points

#### LLM Creation (`retell.service.ts`)
- `begin_message` is sanitized before being sent to Retell
- Ensures greeting messages contain no timing instructions

#### TTS Generation (`elevenlabs.service.ts`)
- All text sent to ElevenLabs TTS is sanitized
- Validates output and logs violations

#### Webhook Handler (`webhooks.service.ts`)
- Text from Retell function_call events is sanitized
- Prevents LLM-generated timing instructions from reaching TTS

### 3. Prompt Rules

All timing instructions have been removed from prompts:
- ❌ Removed: "PAUSE for 1-2 seconds"
- ❌ Removed: "[PAUSE 0.5-1s]"
- ❌ Removed: "Insert natural pauses"
- ✅ Added: "Let TTS engine handle natural pacing"

### 4. Summary Format

Summaries are now formatted as natural sentences:
- ✅ Correct: "Here's a quick summary. Full Name: John Smith. Phone Number: 04 12 345 678."
- ❌ Wrong: "Full Name: John Smith. [PAUSE] Phone Number: 04 12 345 678."

## Usage

```typescript
import { sanitizeSpeechOutput, validateSpeechOutput } from './utils/speech-sanitizer';

// Sanitize before TTS
const cleanText = sanitizeSpeechOutput(llmResponse);

// Validate (optional, for logging)
const validation = validateSpeechOutput(cleanText);
if (!validation.valid) {
  logger.warn(`Forbidden tokens found: ${validation.violations}`);
}
```

## Important Rule

**LLMs should NEVER be trusted with speech timing control.**

Timing belongs to:
- ✅ TTS engine (Retell/ElevenLabs)
- ✅ Backend formatting
- ❌ NOT prompts
