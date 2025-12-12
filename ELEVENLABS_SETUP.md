# ElevenLabs API Setup Guide

## Required Permissions

To use custom voice cloning with ElevenLabs, your API key must have the following permission:

- **`voices_write`**: Required to create custom voice clones via the `/v1/voices/add` endpoint

## How to Enable Permissions

1. **Log in to ElevenLabs Dashboard**
   - Go to https://elevenlabs.io/
   - Log in to your account

2. **Navigate to API Keys Settings**
   - Click on your profile/settings
   - Go to "API Keys" section

3. **Check API Key Permissions**
   - Find your API key (or create a new one)
   - Ensure the **"voices_write"** permission is enabled
   - Save the changes

4. **Verify Subscription Plan**
   - Voice cloning requires a subscription plan that supports custom voices
   - Check your plan at: https://elevenlabs.io/pricing
   - Some plans may have limitations on voice cloning

## Setting Up the API Key

1. **Copy your API key** from the ElevenLabs dashboard

2. **Add to environment variables**
   ```env
   ELEVENLABS_API_KEY=your_api_key_here
   ```

3. **Restart your backend server** to load the new environment variable

## Testing the Setup

After setting up your API key with the correct permissions:

1. Upload a voice file (MP3 or WAV) via `POST /voice-upload`
2. Check the backend logs for:
   - `✅ Custom voice created in ElevenLabs successfully!`
   - `Voice ID: [your_voice_id]`
3. Verify in ElevenLabs dashboard that the voice appears in "My Voices"

## Troubleshooting

### Error: "Missing voices_write permission"

**Solution**: Enable the `voices_write` permission for your API key in the ElevenLabs dashboard.

### Error: "Subscription plan doesn't support voice cloning"

**Solution**: Upgrade your ElevenLabs subscription plan to one that supports custom voice cloning.

### Error: "401 Unauthorized"

**Possible causes**:
- Invalid API key
- API key doesn't have required permissions
- API key has expired or been revoked

**Solution**: 
- Verify your API key is correct
- Check that `voices_write` permission is enabled
- Generate a new API key if needed

## API Reference

- ElevenLabs Add Voice API: https://elevenlabs.io/docs/api-reference/add-voice
- ElevenLabs TTS API: https://elevenlabs.io/docs/api-reference/text-to-speech
- ElevenLabs API Keys: https://elevenlabs.io/app/settings/api-keys

