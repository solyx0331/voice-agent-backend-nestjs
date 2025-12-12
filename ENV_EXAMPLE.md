# Environment Variables Example

Copy this to `.env` file:

```env
# Database Configuration
DATABASE_URL=mongodb+srv://username:password@cluster.mongodb.net/database_name
DB_NAME=voice_ai_agent

# Retell AI Configuration
RETELL_API_KEY=your_retell_api_key_here

# ElevenLabs Configuration
# IMPORTANT: Your API key must have "voices_write" permission enabled
# Voice cloning requires a subscription plan that supports custom voices
# To enable permissions:
# 1. Go to https://elevenlabs.io/ and log in
# 2. Navigate to Settings > API Keys
# 3. Ensure your API key has "voices_write" permission enabled
# 4. For more info: https://elevenlabs.io/docs/api-reference/add-voice
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here

# Twilio Configuration
TWILIO_ACCOUNT_SID=your_twilio_account_sid_here
TWILIO_AUTH_TOKEN=your_twilio_auth_token_here
# Static phone number for testing (optional - if not set, will purchase a new number)
# Format: E.164 format with or without spaces (e.g., +61341517921 or +61 3 4151 7921)
# The system will automatically normalize it to E.164 format
TWILIO_STATIC_PHONE_NUMBER=+61 3 4151 7921
# Twilio Address SID for Australian number purchases (optional but recommended)
# Australian phone numbers require a verified address in Twilio
# If not set, the system will try to find an existing Australian address automatically
# You can create an address in Twilio Console and get the SID from there
TWILIO_ADDRESS_SID=ADxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Webhook Configuration
# Base URL for webhooks (e.g., https://your-domain.com or https://your-ngrok-url.ngrok.io)
WEBHOOK_BASE_URL=https://your-domain.com

# Server Configuration
PORT=8000
NODE_ENV=development

# CORS Configuration (optional)
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
ALLOWED_ORIGIN_PATTERNS=https://.*\.vercel\.app,https://.*\.ngrok\.io
```

