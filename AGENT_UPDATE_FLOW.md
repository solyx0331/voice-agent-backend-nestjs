# Agent Update Flow - Frontend to Retell

## Overview

When you update an agent in the frontend, the changes are automatically synchronized to Retell's API. This document explains what gets updated and how.

## Update Process

### 1. Frontend Update Request
When you update an agent in the frontend UI, it sends a `PUT /api/agents/:id` request with the updated fields.

### 2. Backend Processing
The backend `AgentsService.update()` method:
1. Retrieves the existing agent from the database
2. Merges the new updates with existing data
3. Updates Retell LLM (if agent has `retellLlmId`)
4. Updates Retell Agent (if agent has `retellAgentId`)
5. Updates the database

### 3. What Gets Updated in Retell

#### Retell LLM Updates
The following fields update the Retell LLM:
- **`begin_message`**: From `baseLogic.greetingMessage` or `greetingScript`
- **`general_prompt`**: Built from:
  - Agent name and description
  - FAQs
  - Intents
  - Base Logic (primaryIntentPrompts, leadCaptureQuestions, responseLogic)
  - Lead Capture fields

#### Retell Agent Updates
The following fields update the Retell Agent:
- **`agent_name`**: Agent name
- **`voice_id`**: Voice ID (if voice configuration changed)
- **`webhook_url`**: From `notifications.crm.endpoint`
- **`voicemail_option`**: From `callRules.fallbackToVoicemail` and `callRules.voicemailMessage`
- **`voice_temperature`**: Voice stability (0-2) - if provided
- **`voice_speed`**: Speech speed (0.5-2) - if provided
- **`volume`**: Volume level (0-2) - if provided
- **`responsiveness`**: Agent responsiveness (0-1) - if provided
- **`interruption_sensitivity`**: Interruption sensitivity (0-1) - if provided
- **`end_call_after_silence_ms`**: End call after silence - if provided
- **`max_call_duration_ms`**: Max call duration - if provided
- **`begin_message_delay_ms`**: Delay before first message - if provided

### 4. Database Update
After Retell updates succeed (or even if they fail), the database is updated with all the new fields.

## Error Handling

- **If Retell LLM update fails**: The error is logged, but the update continues (database will still be updated)
- **If Retell Agent update fails**: The error is logged, but the update continues (database will still be updated)
- **If database update fails**: The entire operation fails and an error is returned

This ensures that:
- Your database always reflects the latest changes
- Retell updates are attempted but don't block the operation
- You can manually retry Retell updates if needed

## Fields That Are NOT Updated in Retell

These fields are stored only in the database (Retell doesn't support them):
- **Business Hours** (`callRules.businessHours`): Retell doesn't have business hours API
- **Email Notifications** (`notifications.email`): Retell doesn't have email notification API
- **CRM Integration Details** (`notifications.crm.type`, `notifications.crm.apiKey`): Only the webhook endpoint is sent to Retell

## Example Update Flow

```typescript
// Frontend sends:
PUT /api/agents/123
{
  "name": "Updated Agent Name",
  "voice": {
    "type": "generic",
    "genericVoice": "ElevenLabs - Aria",
    "temperature": 1.2,
    "speed": 1.0,
    "volume": 1.0
  },
  "baseLogic": {
    "greetingMessage": "Hello! How can I help you?"
  },
  "responsiveness": 0.8,
  "maxCallDurationMs": 1800000
}

// Backend updates:
// 1. Retell LLM: begin_message and general_prompt
// 2. Retell Agent: agent_name, voice_id, voice_temperature, voice_speed, volume, responsiveness, max_call_duration_ms
// 3. Database: All fields
```

## Notes

- All numeric fields are automatically validated and clamped to their valid ranges
- Only fields that are explicitly provided in the update request are sent to Retell
- If a field is not provided, it won't be updated in Retell (existing values remain)
- The update is **idempotent** - you can safely retry updates

