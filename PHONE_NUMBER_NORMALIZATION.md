# Phone Number & Postcode Normalization System

## Overview

This document describes the system-level normalization and readback control for Australian phone numbers and postcodes. This ensures natural, consistent readback regardless of agent prompt wording.

## Key Principles

1. **System-Level Enforcement**: Formatting happens at the backend, not in LLM prompts
2. **Dual Storage**: Both raw and spoken formats are stored
3. **Strict LLM Rules**: LLM is instructed to NEVER format numbers itself
4. **No Looping**: Confirmed fields are tracked to prevent re-asking

## Implementation

### 1. Normalization Utilities

#### Phone Number Normalizer (`src/services/utils/phone-normalizer.ts`)
- `normalizeAustralianPhone()`: Normalizes input to raw (0412345678) and spoken ("04 12 345 678") formats
- `extractPhoneFromText()`: Extracts phone numbers from transcripts
- `getPhoneReadbackFormat()`: Returns the spoken format for readback

#### Postcode Normalizer (`src/services/utils/postcode-normalizer.ts`)
- `normalizeAustralianPostcode()`: Normalizes to raw ("3000") and spoken ("three zero zero zero") formats
- `extractPostcodeFromText()`: Extracts postcodes from transcripts
- `getPostcodeReadbackFormat()`: Returns the spoken format for readback

### 2. Context Memory Updates

The `ContextMemoryService` now:
- Stores both `rawValue` and `spokenValue` for phone/postcode fields
- Tracks `confirmed` status to prevent re-asking
- Provides `getSpokenFormat()` method for readback
- Automatically normalizes phone/postcode on extraction

### 3. Retell Prompt Rules

The prompt generation (`retell.service.ts`) includes strict rules:
- **NEVER** read phone numbers digit-by-digit
- **NEVER** say "pause" when reading numbers
- **ALWAYS** use the system-provided formatted values
- **NEVER** reformat numbers yourself
- **DO NOT** re-ask confirmed numbers

### 4. Webhook Normalization

Phone numbers extracted from transcripts are automatically normalized:
- Raw format stored for database/API
- Spoken format used for display/readback

## Usage Flow

### Phone Number Capture
1. User says: "My number is 0412345678"
2. System extracts: "0412345678"
3. System normalizes:
   - `rawPhoneNumber`: "0412345678"
   - `spokenPhoneNumber`: "04 12 345 678"
4. LLM confirms: "Just to confirm, I have your mobile number as 04 12 345 678. Is that correct?"
5. User confirms: "Yes"
6. System marks field as `confirmed: true`
7. LLM never re-asks this number

### Postcode Capture
1. User says: "Postcode is 3000"
2. System extracts: "3000"
3. System normalizes:
   - `rawPostcode`: "3000"
   - `spokenPostcode`: "three zero zero zero"
4. LLM confirms: "Just to confirm, your postcode is three zero zero zero?"
5. User confirms: "Yes"
6. System marks field as `confirmed: true`

## Success Criteria

✅ Phone numbers always read naturally (e.g., "04 12 345 678")
✅ No digit-by-digit speech
✅ No voice switching during number readback
✅ No looping confirmations
✅ Testers can clearly understand and confirm numbers
✅ Works regardless of agent prompt wording

## Testing

To test phone number normalization:
1. Call the agent
2. Provide a phone number: "0412345678"
3. Verify agent confirms: "04 12 345 678" (not digit-by-digit)
4. Confirm the number
5. Verify agent doesn't re-ask

To test postcode normalization:
1. Call the agent
2. Provide a postcode: "3000"
3. Verify agent confirms: "three zero zero zero" (not "three thousand")
4. Confirm the postcode
5. Verify agent doesn't re-ask
