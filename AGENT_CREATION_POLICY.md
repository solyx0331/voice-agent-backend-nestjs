# Agent Creation Policy

## Overview
Agents **must** be successfully created in Retell AI before being saved to the database. If Retell creation fails, the entire operation fails and no agent is stored.

## Behavior

### ✅ Success Flow
1. Create LLM in Retell AI
2. Create Agent in Retell AI (using the LLM)
3. Save agent to database (with Retell IDs)
4. Return success response

### ❌ Failure Flow
1. If LLM creation fails → **Operation fails, nothing saved**
2. If Agent creation fails → **Operation fails, LLM is cleaned up, nothing saved**
3. If Database save fails → **Operation fails, Retell resources are cleaned up**

## Error Handling

### Retell Creation Failure
- **Status Code**: Returns the HTTP status from Retell API (e.g., 404, 401, 500)
- **Error Message**: `"Failed to create agent in Retell: <error message>"`
- **Cleanup**: If LLM was created but agent creation failed, the LLM is automatically deleted
- **Database**: **No agent is saved to database**

### Database Save Failure
- **Status Code**: 500 Internal Server Error
- **Error Message**: `"Failed to save agent to database: <error message>"`
- **Cleanup**: Retell agent and LLM are automatically deleted
- **Database**: **No agent is saved to database**

## Benefits

1. **Data Consistency**: Ensures all agents in the database have corresponding Retell agents
2. **No Orphaned Records**: Prevents agents in database without Retell integration
3. **Clear Error Messages**: Users know exactly why agent creation failed
4. **Automatic Cleanup**: Retell resources are cleaned up if any step fails

## Example Error Response

```json
{
  "statusCode": 404,
  "message": "Failed to create agent in Retell: 404 Not Found",
  "error": "Not Found"
}
```

## Migration Notes

**Previous Behavior**: Agents could be created in database even if Retell creation failed (with warning logs)

**Current Behavior**: Agents are only created in database if Retell creation succeeds (strict requirement)


