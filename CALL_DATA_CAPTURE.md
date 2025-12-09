# Call Data Capture Implementation

## Overview

This document describes the implementation of call data capture from Retell webhooks, storing call transcripts, metadata, and analysis in the database, and exposing it via APIs for the frontend.

## Implementation Status

✅ **FULLY IMPLEMENTED** - All components are in place:

1. ✅ Updated Call schema with Retell-specific fields
2. ✅ Created Retell webhook endpoint
3. ✅ Updated Twilio webhook to create initial call records
4. ✅ Implemented Retell webhook handlers for all event types
5. ✅ Updated calls service to return data in frontend format
6. ✅ Added API endpoint to get calls by agent ID

## Architecture

### Call Data Flow

```
1. User calls Twilio number
   ↓
2. Twilio webhook → Backend creates initial call record
   ↓
3. Call connected to Retell
   ↓
4. Retell webhooks → Backend updates call record with:
   - Transcripts (real-time)
   - Call analysis (sentiment, summary)
   - Call metadata (duration, cost, etc.)
   - Recording URLs
   ↓
5. Frontend retrieves call data via API
```

## Database Schema Updates

### Call Schema (`src/schemas/call.schema.ts`)

Added Retell-specific fields:

- `retellCallId`: Retell call ID for tracking
- `twilioCallSid`: Twilio Call SID for tracking
- `recordingUrl`: URL to call recording
- `callAnalysis`: Object containing:
  - `sentiment`: "positive" | "neutral" | "negative"
  - `summary`: Call summary text
  - `extractedData`: Dynamic variables extracted from call
- `callCost`: Object containing:
  - `total`: Total cost
  - `currency`: Currency code
- `disconnectionReason`: Reason for call end
- `startTime`: Actual call start time
- `endTime`: Actual call end time

## Webhook Endpoints

### 1. Twilio Webhook (`POST /api/webhooks/twilio/:agentId`)

**Purpose**: Receives incoming call events from Twilio

**What it does**:
- Registers call with Retell
- Creates initial call record in database
- Returns TwiML to connect call to Retell

**Call Record Created**:
```javascript
{
  contact: "Unknown", // Updated from Retell if available
  phone: fromNumber,
  agent: agent.name,
  agentId: agentId,
  type: "inbound",
  retellCallId: retellCall.call_id,
  twilioCallSid: callSid,
  startTime: new Date(),
  status: "completed",
  // ... other fields
}
```

### 2. Retell Webhook (`POST /api/webhooks/retell`)

**Purpose**: Receives call events from Retell

**Supported Events**:
- `call_started`: Call begins
- `call_ended` / `call_terminated`: Call ends
- `call_transcript`: Real-time transcript updates
- `call_analyzed`: Post-call analysis (sentiment, summary)

**Event Handlers**:

#### `call_started`
- Updates call start time
- Updates caller information if available

#### `call_ended`
- Calculates and updates call duration
- Updates call status
- Updates recording URL if available
- Updates outcome based on disconnection reason
- Updates latency metrics
- Increments agent call count

#### `call_transcript`
- Merges new transcript entries with existing ones
- Sorts by timestamp
- Handles both incremental and full transcript updates

#### `call_analyzed`
- Updates call analysis (sentiment, summary, extracted data)
- Updates call cost if available

## API Endpoints

### Get All Calls
```
GET /api/calls?search=...&agent=...&agentId=...&type=...&start=...&end=...
```

**Query Parameters**:
- `search`: Search in contact, phone, or agent name
- `agent`: Filter by agent name
- `agentId`: Filter by agent ID (NEW)
- `type`: Filter by call type (inbound, outbound, missed)
- `start`: Start date (ISO format)
- `end`: End date (ISO format)

**Response**: Array of call objects with all fields including transcripts

### Get Call by ID
```
GET /api/calls/:id
```

**Response**: Single call object with all details

### Get Agent Calls
```
GET /api/agents/:id/calls?limit=10
```

**Query Parameters**:
- `limit`: Maximum number of calls to return (default: 100)

**Response**: Array of calls for the specified agent

## Retell Webhook Configuration

### Setting Up Retell Webhooks

1. **Go to Retell Dashboard**:
   - Navigate to your Retell account
   - Go to Settings → Webhooks

2. **Add Webhook URL**:
   ```
   https://your-backend.com/api/webhooks/retell
   ```

3. **Select Events** (recommended):
   - ✅ `call_started`
   - ✅ `call_ended`
   - ✅ `call_transcript`
   - ✅ `call_analyzed`

4. **Save Configuration**

### Webhook Payload Examples

#### call_started
```json
{
  "event": "call_started",
  "data": {
    "call_id": "abc123",
    "agent_id": "agent_xyz",
    "from_number": "+1234567890",
    "to_number": "+61341517921",
    "start_time": "2025-01-15T10:30:00Z"
  }
}
```

#### call_transcript
```json
{
  "event": "call_transcript",
  "data": {
    "call_id": "abc123",
    "transcript": [
      {
        "role": "user",
        "text": "Hello, I need help",
        "timestamp": "2025-01-15T10:30:05Z"
      },
      {
        "role": "agent",
        "text": "Hello! How can I assist you?",
        "timestamp": "2025-01-15T10:30:07Z"
      }
    ]
  }
}
```

#### call_ended
```json
{
  "event": "call_ended",
  "data": {
    "call_id": "abc123",
    "end_time": "2025-01-15T10:35:00Z",
    "duration": 300,
    "disconnection_reason": "user_hangup",
    "recording_url": "https://retell.s3.amazonaws.com/recordings/abc123.mp3",
    "latency": {
      "avg": 850,
      "peak": 1200
    }
  }
}
```

#### call_analyzed
```json
{
  "event": "call_analyzed",
  "data": {
    "call_id": "abc123",
    "analysis": {
      "sentiment": "positive",
      "summary": "Customer called to inquire about pricing. Agent provided detailed information.",
      "extracted_data": {
        "customer_name": "John Doe",
        "inquiry_type": "pricing"
      }
    },
    "cost": {
      "total": 0.05,
      "currency": "USD"
    }
  }
}
```

## Frontend Integration

The frontend can now retrieve call data using the existing API endpoints:

```typescript
// Get all calls
const calls = await apiService.getCalls({
  agentId: "agent123",
  type: "inbound",
  dateRange: { start: "2025-01-01", end: "2025-01-31" }
});

// Get calls for specific agent
const agentCalls = await apiService.getAgentCalls("agent123", 10);

// Each call object includes:
// - transcript: Array of transcript entries
// - callAnalysis: Sentiment, summary, extracted data
// - recordingUrl: URL to call recording
// - latency: Average and peak latency
// - outcome: Call outcome
// - duration: Formatted duration string
```

## Testing

### 1. Test Twilio Webhook
```bash
curl -X POST http://localhost:8000/api/webhooks/twilio/{agentId} \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=%2B1234567890&To=%2B61341517921&CallSid=test123&CallStatus=ringing"
```

### 2. Test Retell Webhook
```bash
curl -X POST http://localhost:8000/api/webhooks/retell \
  -H "Content-Type: application/json" \
  -d '{
    "event": "call_started",
    "data": {
      "call_id": "test123",
      "agent_id": "agent_xyz",
      "from_number": "+1234567890",
      "to_number": "+61341517921"
    }
  }'
```

### 3. Verify Call Records
```bash
# Get all calls
curl http://localhost:8000/api/calls

# Get calls for agent
curl http://localhost:8000/api/agents/{agentId}/calls?limit=10
```

## Troubleshooting

### Issue: Call records not being created
- **Check**: Twilio webhook is being called
- **Check**: Agent ID in URL matches database
- **Check**: Backend logs for errors

### Issue: Transcripts not updating
- **Check**: Retell webhook is configured correctly
- **Check**: Webhook URL is publicly accessible
- **Check**: Retell webhook events are enabled
- **Check**: Backend logs for transcript events

### Issue: Call analysis not appearing
- **Check**: `call_analyzed` event is enabled in Retell
- **Check**: Call has ended (analysis comes after call ends)
- **Check**: Retell has analysis enabled for your account

### Issue: Recording URLs missing
- **Check**: Recording is enabled in Retell agent settings
- **Check**: `call_ended` webhook includes `recording_url`
- **Check**: Retell account has recording enabled

## Next Steps (Optional Enhancements)

1. **Real-time Updates**: Use WebSockets to push transcript updates to frontend
2. **Call Search**: Full-text search across transcripts
3. **Analytics**: Aggregate call metrics and trends
4. **Export**: Export calls with transcripts to CSV/JSON
5. **Call Playback**: Stream recordings directly from Retell
6. **Contact Matching**: Automatically match calls to contacts by phone number

