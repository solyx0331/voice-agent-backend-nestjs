# Troubleshooting 404 Error When Creating Retell Agent

## Error
```
[Nest] ERROR [RetellService] Error creating Retell agent: 404 Not Found
```

## Possible Causes

### 1. Invalid LLM ID
The LLM might not have been created successfully, or the LLM ID format is incorrect.

**Check:**
- Look for the log message: `LLM created in Retell with ID: <id>`
- Verify the LLM ID is not null or undefined
- Check if the LLM creation step completed successfully

### 2. Invalid Voice ID
The `voice_id` being used might not exist in Retell's system.

**Common Issues:**
- Voice ID format might have changed in Retell API
- The mapped voice ID might not be valid
- Default voice `11labs-Adrian` might not exist

**Solution:**
- Check Retell's voice list: https://docs.retellai.com/api-references/list-voices
- Verify the voice ID format matches Retell's current API

### 3. API Structure Mismatch
The Retell SDK version might be outdated or the API structure has changed.

**Check:**
- Current SDK version: `retell-sdk@4.66.0` (in package.json)
- Check Retell API docs: https://docs.retellai.com/api-references/create-agent

### 4. Missing Required Fields
Some required fields might be missing or incorrectly formatted.

**Required Fields for Agent Creation:**
- `response_engine.llm_id` - Must be a valid LLM ID
- `voice_id` - Must be a valid voice ID
- `agent_name` - Agent name
- `language` - Language code (e.g., "en-US")

## Debugging Steps

### Step 1: Check Logs
Look for these log messages in order:
1. `Creating LLM in Retell for agent: <name>`
2. `LLM created in Retell with ID: <id>`
3. `Creating agent in Retell: <name>`
4. `Using LLM ID: <id>`
5. `Retell agent config prepared with voice_id: <voice_id>`

If any step is missing, that's where the issue is.

### Step 2: Verify LLM Creation
Check if the LLM was actually created:
- Look for `LLM created in Retell with ID: <id>` in logs
- The LLM ID should be a non-empty string

### Step 3: Check Agent Config
The enhanced logging will now show:
- Full agent configuration being sent
- Voice ID being used
- LLM ID being used

### Step 4: Test Voice ID
Try using a known valid voice ID. Common Retell voice IDs:
- `11labs-Aria`
- `11labs-Adam`
- `openai-Alloy`
- `openai-Nova`

## Enhanced Logging

I've added enhanced logging that will show:
- Full LLM configuration
- Full agent configuration
- Detailed error responses from Retell API
- HTTP status codes

When you create an agent again, check the logs for:
- `LLM config: {...}` - Shows what's being sent to create LLM
- `Agent config: {...}` - Shows what's being sent to create agent
- `Retell API response: {...}` - Shows error details from Retell

## Quick Fixes

### Option 1: Use a Known Valid Voice
Update the default voice in `retell.service.ts`:
```typescript
config.voice_id = "11labs-Aria"; // Try a different voice
```

### Option 2: Verify LLM Creation
Add a delay or verification step after LLM creation to ensure it's ready:
```typescript
// Wait a moment for LLM to be fully created
await new Promise(resolve => setTimeout(resolve, 1000));
```

### Option 3: Check Retell API Status
- Visit https://status.retellai.com/ to check if there are any API issues
- Verify your API key has the correct permissions

## Next Steps

1. **Try creating an agent again** and check the enhanced logs
2. **Look for the detailed error messages** that will now be logged
3. **Check the agent config** that's being sent to Retell
4. **Verify the LLM ID** is valid and the voice_id exists

The enhanced logging should help identify exactly what's causing the 404 error.

