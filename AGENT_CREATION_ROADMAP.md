# Voice Agent Creation Roadmap

This document describes the complete flow for creating a voice agent with Twilio phone number integration.

## Overview

When creating a voice agent, the system follows this sequence:

1. **Create Retell LLM** - Creates the language model in Retell AI
2. **Create Retell Agent** - Creates the voice agent in Retell AI using the LLM
3. **Purchase Twilio Number** - Dynamically purchases an Australian phone number from Twilio
4. **Configure Webhook** - Sets up webhook URL for the Twilio number
5. **Store in MongoDB** - Saves all mappings (Retell IDs, Twilio number, webhook URL) to database
6. **Return to Frontend** - Returns complete agent data including phone number

## Implementation Details

### Backend Components

#### 1. Twilio Service (`src/services/twilio.service.ts`)
- `purchaseAustralianNumber()` - Purchases an Australian mobile number from Twilio
- `configureWebhook(phoneNumberSid, agentId)` - Configures webhook URL for the phone number
- `releasePhoneNumber(phoneNumberSid)` - Releases a phone number when agent is deleted

#### 2. Agent Creation Flow (`src/modules/agents/agents.service.ts`)
The `create()` method follows this sequence:

```typescript
1. Create Retell LLM → retellLlmId
2. Verify LLM is ready
3. Create Retell Agent → retellAgentId
4. Purchase Twilio Number → twilioPhoneNumber, twilioPhoneNumberSid
5. Save to MongoDB (with phone number) → savedAgentId
6. Configure Twilio Webhook → webhookUrl
7. Update MongoDB with webhook URL
8. Return complete agent data
```

#### 3. Database Schema (`src/schemas/voice-agent.schema.ts`)
Added fields:
- `phoneNumber` - Twilio phone number in E.164 format (e.g., +61412345678)
- `twilioPhoneNumberSid` - Twilio Phone Number SID
- `webhookUrl` - Webhook URL configured for the phone number

#### 4. Webhook Controller (`src/modules/webhooks/webhooks.controller.ts`)
- Endpoint: `POST /api/webhooks/twilio/:agentId`
- Handles incoming Twilio webhooks
- Returns TwiML response to Twilio

### Frontend Components

#### 1. Type Definitions (`src/lib/api/types.ts`)
Added to `VoiceAgent` interface:
- `phoneNumber?: string`
- `twilioPhoneNumberSid?: string`
- `webhookUrl?: string`

#### 2. Agent Display (`src/components/dashboard/VoiceAgentCard.tsx`)
- Displays phone number below agent description
- Shows phone icon with formatted number

## Environment Variables

Required environment variables (see `ENV_EXAMPLE.md`):

```env
# Twilio Configuration
TWILIO_ACCOUNT_SID=your_twilio_account_sid_here
TWILIO_AUTH_TOKEN=your_twilio_auth_token_here

# Webhook Configuration
WEBHOOK_BASE_URL=https://your-domain.com
# or for development: https://your-ngrok-url.ngrok.io
```

## Error Handling & Cleanup

The system includes comprehensive error handling:

- **If Retell LLM creation fails**: No resources created
- **If Retell Agent creation fails**: LLM is deleted
- **If Twilio purchase fails**: Retell agent and LLM are deleted
- **If database save fails**: Twilio number is released, Retell resources are deleted
- **If webhook config fails**: Agent is still created, but webhook needs manual configuration

## Webhook URL Format

The webhook URL is constructed as:
```
{WEBHOOK_BASE_URL}/api/webhooks/twilio/{agentId}
```

Example:
```
https://your-domain.com/api/webhooks/twilio/507f1f77bcf86cd799439011
```

## Twilio Phone Number

- **Country**: Australia (AU)
- **Type**: Mobile numbers
- **Format**: E.164 format (e.g., +61412345678)
- **Auto-release**: Numbers are automatically released when agents are deleted

## Next Steps

1. **Install Twilio SDK**: Run `npm install` in the backend directory
2. **Set Environment Variables**: Copy `ENV_EXAMPLE.md` to `.env` and fill in your credentials
3. **Configure WEBHOOK_BASE_URL**: Set to your production domain or ngrok URL for development
4. **Test Agent Creation**: Create an agent and verify:
   - Retell agent is created
   - Twilio number is purchased
   - Webhook is configured
   - Phone number appears in frontend

## Notes

- Twilio phone numbers incur monthly charges
- Webhook URL must be publicly accessible (use ngrok for local development)
- Australian numbers are purchased automatically - ensure your Twilio account has sufficient balance
- Phone numbers are released when agents are deleted to avoid unnecessary charges

