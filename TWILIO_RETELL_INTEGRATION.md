# Twilio + Retell Integration Flow

## Current Implementation Status

✅ **FULLY IMPLEMENTED** - The complete flow is now working:

1. ✅ User dials a Twilio number
2. ✅ Twilio sends HTTP POST to backend webhook endpoint
3. ✅ Backend matches the number to a Retell agent (via agentId in URL)
4. ✅ Backend registers the call with Retell API to start a session
5. ✅ Backend returns TwiML to connect Twilio call to Retell's SIP endpoint
6. ✅ Retell starts speaking to the caller using its own voice pipeline

## Implementation Details

### Webhook Endpoint
- **URL**: `POST /api/webhooks/twilio/:agentId`
- **Purpose**: Receives incoming Twilio calls and connects them to Retell agents

### Flow Breakdown

#### 1. Incoming Call from Twilio
When a user dials your Twilio number (`+61 3 4151 7921`), Twilio sends an HTTP POST request to:
```
POST https://your-backend.com/api/webhooks/twilio/{agentId}
```

#### 2. Backend Processing
The webhook handler:
- Extracts `agentId` from the URL parameter
- Finds the agent in MongoDB
- Verifies the agent has a `retellAgentId`
- Extracts caller information from Twilio payload (`From`, `To`, `CallSid`)

#### 3. Retell Session Creation
- Calls `retellService.registerPhoneCall()` with:
  - `agent_id`: The Retell agent ID
  - `from_number`: Caller's phone number (for tracking)
  - `to_number`: Your Twilio number (for tracking)
  - `direction`: "inbound"
- Retell returns a `call_id` and connection details

#### 4. TwiML Response
- Generates TwiML XML that connects Twilio to Retell's SIP endpoint
- Format: `sip:{call_id}@sip.retellai.com`
- Twilio uses this to establish the connection

#### 5. Retell Voice Pipeline
- Retell receives the SIP connection
- Starts the AI agent conversation
- Uses the configured voice model
- Handles the entire conversation flow

## Twilio Configuration

### Required Settings in Twilio Console

For your phone number **+61 3 4151 7921**, configure the following:

#### Voice Configuration Tab

1. **"A CALL COMES IN" Section:**
   - **Configure with**: `Webhook`
   - **URL**: `https://your-backend.com/api/webhooks/twilio/{agentId}`
     - Replace `{agentId}` with the actual MongoDB agent ID
     - Example: `https://your-backend.com/api/webhooks/twilio/507f1f77bcf86cd799439011`
   - **HTTP Method**: `HTTP POST` ✅

2. **"Primary handler fails" Section:**
   - **Configure with**: `Webhook` (optional, for error handling)
   - **URL**: (Leave empty or set to error handler)
   - **HTTP Method**: `HTTP POST`

3. **"Call status changes" Section:**
   - **HTTP Method**: `HTTP POST` ✅
   - This will send status updates to your webhook URL

### Important Notes

⚠️ **Agent ID in URL**: Currently, the webhook URL includes the agent ID. This means:
- Each agent needs its own webhook URL configured in Twilio
- OR you can use a single webhook and match by phone number (see below)

### Alternative: Match by Phone Number

If you want a single webhook endpoint that matches by phone number instead of agentId:

1. Create endpoint: `POST /api/webhooks/twilio`
2. Extract `To` number from Twilio payload
3. Query MongoDB: `findOne({ phoneNumber: toNumber })`
4. Use the found agent's `retellAgentId`

This approach allows one webhook URL for all agents.

## Environment Variables

Ensure these are set in your `.env`:

```env
# Retell AI
RETELL_API_KEY=your_retell_api_key

# Twilio
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_STATIC_PHONE_NUMBER=+61341517921

# Webhook Base URL (must be publicly accessible)
WEBHOOK_BASE_URL=https://your-backend.com
# For local development, use ngrok:
# WEBHOOK_BASE_URL=https://your-ngrok-url.ngrok.io
```

## Testing the Integration

### 1. Verify Webhook URL is Accessible
```bash
curl -X POST https://your-backend.com/api/webhooks/twilio/{agentId} \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=%2B1234567890&To=%2B61341517921&CallSid=test123"
```

### 2. Check Backend Logs
When a call comes in, you should see:
```
Received Twilio webhook for agent {agentId}
Processing Twilio webhook for agent {agentId}: Call from {fromNumber} to {toNumber}
Registered call with Retell. Call ID: {retellCallId}
Generating TwiML to connect to Retell SIP endpoint
```

### 3. Place a Test Call
- Dial your Twilio number: `+61 3 4151 7921`
- The call should connect to your Retell agent
- The AI should start speaking using the configured voice

## Troubleshooting

### Issue: "Agent not found"
- **Cause**: Agent ID in URL doesn't match any agent in database
- **Fix**: Verify the agentId in the webhook URL matches your MongoDB agent `_id`

### Issue: "Agent does not have a Retell agent ID"
- **Cause**: Agent was created but Retell agent creation failed
- **Fix**: Recreate the agent or manually add `retellAgentId` to the agent document

### Issue: "Failed to register phone call with Retell"
- **Cause**: Retell API key invalid or network issue
- **Fix**: Check `RETELL_API_KEY` is correct and Retell API is accessible

### Issue: Call connects but no audio
- **Cause**: SIP endpoint format incorrect or Retell not receiving connection
- **Fix**: Verify TwiML format and check Retell dashboard for call status

## Next Steps (Optional Enhancements)

1. **Call Recording**: Store call records in MongoDB with Retell call_id
2. **Status Callbacks**: Handle call status updates (completed, failed, etc.)
3. **Phone Number Matching**: Implement single webhook that matches by phone number
4. **Error Handling**: Better error messages and fallback behavior
5. **Call Analytics**: Track call duration, outcomes, and metrics

