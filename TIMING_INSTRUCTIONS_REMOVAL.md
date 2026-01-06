# Timing Instructions Removal - Complete

## Summary

All timing instructions have been removed from LLM prompts and a speech sanitizer has been implemented to prevent any timing words from reaching TTS.

## Changes Made

### 1. Speech Sanitizer Created
**File**: `src/services/utils/speech-sanitizer.ts`

- Removes all forbidden tokens: `pause`, `PAUSE`, `[pause]`, `[PAUSE]`, timing instructions
- Validates output before TTS
- Used at all TTS entry points

### 2. Prompt Cleanup (`retell.service.ts`)

**Removed:**
- ❌ "PAUSE for 1-2 seconds after asking each question"
- ❌ "[PAUSE 0.5-1s]" examples
- ❌ "Insert natural pauses after sentences"
- ❌ "After a question mark (?), pause for 1-2 seconds"
- ❌ "Use punctuation as a guide: periods and commas should have brief pauses"
- ❌ "Speak SLOWLY and CLEARLY" (changed to "clearly and naturally")

**Updated:**
- ✅ Summary format changed to natural sentences
- ✅ Added: "Let TTS engine handle natural pacing"
- ✅ Added: "NEVER include timing instructions in your responses"

### 3. TTS Sanitization Points

#### ElevenLabs Service
- All text sanitized before TTS generation
- Validation logging for violations

#### Webhook Handler
- Function call responses sanitized before TTS
- Prevents LLM-generated timing instructions from reaching TTS

#### LLM Creation
- `begin_message` sanitized before being sent to Retell

### 4. Summary Format Update

**Before:**
```
Full Name: John Smith. [PAUSE 0.5-1s]
Phone Number: 04 12 345 678. [PAUSE 0.5-1s]
```

**After:**
```
Here's a quick summary. Full Name: John Smith. Phone Number: 04 12 345 678.
```

## Forbidden Tokens List

The sanitizer removes:
- `pause`, `PAUSE`
- `[pause]`, `[PAUSE]`
- `(pause)`, `(PAUSE)`
- Timing instructions: `1-2 seconds`, `0.5-1 second`
- Bracket instructions: `[PAUSE 0.5-1s]`
- Control words: `SLOWLY`, `BREATHE`, `slow down`
- Ellipsis patterns: `... pause`, `pause ...`

## Testing

To verify timing instructions are removed:

1. **Check logs**: Look for "Speech output contains forbidden tokens" warnings
2. **Test calls**: Verify agent never says "pause" out loud
3. **Test summaries**: Verify summaries are natural sentences without timing markers
4. **Test phone numbers**: Verify phone numbers read naturally without digit-by-digit speech

## Success Criteria

✅ The word "pause" is never spoken
✅ No timing instructions leak into speech
✅ Phone numbers and summaries sound natural
✅ Voice remains consistent throughout the call
✅ TTS engine handles all pacing automatically

## Important Rule

**LLMs should NEVER be trusted with speech timing control.**

Timing belongs to:
- ✅ TTS engine (Retell/ElevenLabs)
- ✅ Backend formatting
- ❌ NOT prompts
