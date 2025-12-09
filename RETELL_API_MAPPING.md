# Retell API Field Mapping

This document explains how our agent DTO fields map to Retell API fields when creating voice agents.

## Required Fields

These fields are always set:

- `response_engine`: Automatically set to use the created Retell LLM
- `voice_id`: Mapped from `voice.customVoiceId` or `voice.genericVoice`
- `agent_name`: Mapped from `name`
- `language`: Defaults to `"en-US"` if not specified

## Supported Optional Fields

### Voice Configuration

| Our DTO Field | Retell API Field | Type | Description |
|--------------|-----------------|------|-------------|
| `voice.customVoiceId` | `voice_id` | string | Custom voice ID from Retell |
| `voice.genericVoice` | `voice_id` | string | Generic voice name (mapped to Retell voice ID) |
| `voice.voiceModel` | `voice_model` | enum | Voice model (e.g., "eleven_turbo_v2") |
| `voice.fallbackVoiceIds` | `fallback_voice_ids` | string[] | Fallback voices for outages |
| `voice.temperature` | `voice_temperature` | number (0-2) | Voice stability (0=stable, 2=variant) |
| `voice.speed` | `voice_speed` | number (0.5-2) | Speech speed (0.5=slow, 2=fast) |
| `voice.volume` | `volume` | number (0-2) | Volume level (0=quiet, 2=loud) |

### Agent Behavior

| Our DTO Field | Retell API Field | Type | Description |
|--------------|-----------------|------|-------------|
| `responsiveness` | `responsiveness` | number (0-1) | How responsive the agent is |
| `interruptionSensitivity` | `interruption_sensitivity` | number (0-1) | How easily user can interrupt |
| `enableBackchannel` | `enable_backchannel` | boolean | Enable backchannel phrases |
| `backchannelFrequency` | `backchannel_frequency` | number (0-1) | How often to backchannel |
| `backchannelWords` | `backchannel_words` | string[] | Custom backchannel words |
| `reminderTriggerMs` | `reminder_trigger_ms` | number | Trigger reminder after silence (ms) |
| `reminderMaxCount` | `reminder_max_count` | integer | Max reminder count (0=disabled) |

### Ambient Sound

| Our DTO Field | Retell API Field | Type | Description |
|--------------|-----------------|------|-------------|
| `ambientSound` | `ambient_sound` | enum | Ambient sound type (coffee-shop, etc.) |
| `ambientSoundVolume` | `ambient_sound_volume` | number (0-2) | Ambient sound volume |

### Webhooks & Notifications

| Our DTO Field | Retell API Field | Type | Description |
|--------------|-----------------|------|-------------|
| `notifications.crm.endpoint` | `webhook_url` | string | Webhook URL for call events |
| `notifications.crm.webhookTimeoutMs` | `webhook_timeout_ms` | integer | Webhook timeout in milliseconds |
| `webhookUrl` | `webhook_url` | string | Alternative webhook URL field |

### Transcription & Speech

| Our DTO Field | Retell API Field | Type | Description |
|--------------|-----------------|------|-------------|
| `boostedKeywords` | `boosted_keywords` | string[] | Keywords to bias transcription |
| `normalizeForSpeech` | `normalize_for_speech` | boolean | Normalize numbers/dates for speech |
| `sttMode` | `stt_mode` | enum | "fast" or "accurate" |
| `vocabSpecialization` | `vocab_specialization` | enum | "general" or "medical" |
| `pronunciationDictionary` | `pronunciation_dictionary` | object[] | Custom pronunciation guide |

### Data Storage

| Our DTO Field | Retell API Field | Type | Description |
|--------------|-----------------|------|-------------|
| `dataStorageSetting` | `data_storage_setting` | enum | "everything", "everything_except_pii", "basic_attributes_only" |
| `optInSignedUrl` | `opt_in_signed_url` | boolean | Enable signed URLs for logs/recordings |
| `signedUrlExpirationMs` | `signed_url_expiration_ms` | integer | Signed URL expiration time |

### Call Management

| Our DTO Field | Retell API Field | Type | Description |
|--------------|-----------------|------|-------------|
| `callRules.fallbackToVoicemail` | `voicemail_option` | object | Voicemail detection and action |
| `callRules.voicemailMessage` | `voicemail_option.action.text` | string | Voicemail message text |
| `endCallAfterSilenceMs` | `end_call_after_silence_ms` | integer | End call after silence (min 10000ms) |
| `maxCallDurationMs` | `max_call_duration_ms` | integer | Max call duration (60000-7200000ms) |
| `beginMessageDelayMs` | `begin_message_delay_ms` | integer | Delay before first message (0-5000ms) |
| `ringDurationMs` | `ring_duration_ms` | integer | Ring duration (5000-90000ms) |

### Post-Call Analysis

| Our DTO Field | Retell API Field | Type | Description |
|--------------|-----------------|------|-------------|
| `postCallAnalysisData` | `post_call_analysis_data` | object[] | Data to extract from calls |
| `postCallAnalysisModel` | `post_call_analysis_model` | enum | Model for analysis (e.g., "gpt-4.1-mini") |
| `analysisSuccessfulPrompt` | `analysis_successful_prompt` | string | Prompt to determine success |
| `analysisSummaryPrompt` | `analysis_summary_prompt` | string | Prompt for summary generation |

### DTMF (Touch-Tone) Input

| Our DTO Field | Retell API Field | Type | Description |
|--------------|-----------------|------|-------------|
| `allowUserDtmf` | `allow_user_dtmf` | boolean | Allow DTMF input |
| `userDtmfOptions.digitLimit` | `user_dtmf_options.digit_limit` | integer | Max digits per input |
| `userDtmfOptions.terminationKey` | `user_dtmf_options.termination_key` | string | Key to end input (#, *, 0-9) |
| `userDtmfOptions.timeoutMs` | `user_dtmf_options.timeout_ms` | integer | Timeout for DTMF input (1000-15000ms) |

### PII & Privacy

| Our DTO Field | Retell API Field | Type | Description |
|--------------|-----------------|------|-------------|
| `piiConfig.mode` | `pii_config.mode` | enum | PII scrubbing mode ("post_call") |
| `piiConfig.categories` | `pii_config.categories` | enum[] | PII categories to scrub |

### Language

| Our DTO Field | Retell API Field | Type | Description |
|--------------|-----------------|------|-------------|
| `language` | `language` | enum | Language code (e.g., "en-US", "multi") |

## Default Values

If fields are not specified, these defaults are used:

- `language`: `"en-US"`
- `voice_id`: `"11labs-Adrian"` (if not specified)
- `normalize_for_speech`: `true`
- `stt_mode`: `"fast"`
- `vocab_specialization`: `"general"`
- `end_call_after_silence_ms`: `600000` (10 minutes)
- `max_call_duration_ms`: `3600000` (1 hour)
- `begin_message_delay_ms`: `1000` (1 second)
- `voicemail_option`: `null` (disabled)

## Example Usage

```typescript
const agentDto = {
  name: "Customer Support Agent",
  voice: {
    type: "generic",
    genericVoice: "ElevenLabs - Aria",
    voiceModel: "eleven_turbo_v2",
    temperature: 1,
    speed: 1,
    volume: 1,
    fallbackVoiceIds: ["openai-Alloy", "deepgram-Angus"]
  },
  responsiveness: 1,
  interruptionSensitivity: 1,
  enableBackchannel: true,
  callRules: {
    fallbackToVoicemail: true,
    voicemailMessage: "Please leave a message..."
  },
  notifications: {
    crm: {
      endpoint: "https://webhook.example.com/events",
      webhookTimeoutMs: 10000
    }
  },
  // ... other fields
};
```

## Notes

- All numeric fields are automatically clamped to their valid ranges
- Array fields are validated to ensure they're arrays
- Optional fields can be set to `null` to remove/disable features
- Voice IDs are automatically mapped from generic names to Retell voice IDs
- The `response_engine` is automatically configured with the created LLM ID

