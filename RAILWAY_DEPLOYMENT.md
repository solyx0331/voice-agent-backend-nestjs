# Railway Deployment Guide

## MongoDB Connection Setup

### Step 1: Add MongoDB Service in Railway

1. In your Railway project dashboard, click **"+ New"** → **"Database"** → **"Add MongoDB"**
2. Railway will automatically provision a MongoDB instance
3. Railway will automatically add the `MONGO_URL` environment variable to your service

### Step 2: Verify Environment Variables

Railway automatically provides these MongoDB environment variables:
- `MONGO_URL` - Full MongoDB connection string (automatically set by Railway)

The backend code will automatically use `MONGO_URL` if available, or fall back to `DATABASE_URL`.

### Step 3: Optional - Set Database Name

If you want to use a specific database name (defaults to `voice_ai_agent`):

1. Go to your service settings in Railway
2. Add a new environment variable:
   - **Variable**: `DB_NAME`
   - **Value**: `voice_ai_agent` (or your preferred database name)

### Step 4: Verify Connection

After deployment, check the logs to see:
```
Connecting to MongoDB...
Database URL: mongodb+srv://***:***@...
```

If you see connection errors, verify:
1. The `MONGO_URL` environment variable is set in Railway
2. The MongoDB service is running in Railway
3. Network access is allowed (Railway handles this automatically)

## Required Environment Variables for Railway

Make sure these are set in your Railway service:

### Required
- `MONGO_URL` - Automatically set by Railway when you add MongoDB service
- `RETELL_API_KEY` - Your Retell AI API key
- `ELEVENLABS_API_KEY` - Your ElevenLabs API key (if using custom voices)
- `TWILIO_ACCOUNT_SID` - Your Twilio Account SID
- `TWILIO_AUTH_TOKEN` - Your Twilio Auth Token

### Optional
- `DB_NAME` - Database name (defaults to `voice_ai_agent`)
- `PORT` - Server port (Railway sets this automatically, but you can override)
- `NODE_ENV` - Set to `production` for production deployments
- `WEBHOOK_BASE_URL` - Your Railway service URL (e.g., `https://your-app.railway.app`)
- `ALLOWED_ORIGINS` - Comma-separated list of allowed CORS origins (e.g., `https://voice-agent-phi-ten.vercel.app`)
- `ALLOWED_ORIGIN_PATTERNS` - Comma-separated list of CORS origin patterns (e.g., `^https://.*\.vercel\.app$`)

## CORS Configuration

### For Vercel Frontend

If your frontend is deployed on Vercel, add these environment variables in Railway:

1. **ALLOWED_ORIGINS** (recommended):
   - Variable: `ALLOWED_ORIGINS`
   - Value: `https://voice-agent-phi-ten.vercel.app`
   - Or multiple origins: `https://voice-agent-phi-ten.vercel.app,https://your-other-domain.com`

2. **ALLOWED_ORIGIN_PATTERNS** (for all Vercel deployments):
   - Variable: `ALLOWED_ORIGIN_PATTERNS`
   - Value: `^https://.*\.vercel\.app$`

**Note**: The backend already includes Vercel pattern matching by default, but setting these explicitly ensures proper CORS handling.

### Troubleshooting CORS Issues

If you're still getting CORS errors:

1. **Check Railway logs** for CORS messages:
   ```
   CORS: Allowing origin (exact match): https://voice-agent-phi-ten.vercel.app
   CORS: Allowing origin (pattern match): https://voice-agent-phi-ten.vercel.app
   ```

2. **Verify environment variables** are set correctly in Railway

3. **Check the frontend URL** matches exactly (no trailing slashes, correct protocol)

4. **Verify NODE_ENV** is set to `production` in Railway

## Setting Environment Variables in Railway

1. Go to your service in Railway dashboard
2. Click on the **"Variables"** tab
3. Click **"+ New Variable"**
4. Add each variable with its value
5. Railway will automatically redeploy when you save

## Webhook Configuration

After deployment, update your webhook URLs:

1. Get your Railway service URL (e.g., `https://your-app.railway.app`)
2. Set `WEBHOOK_BASE_URL` environment variable to this URL
3. Update Retell webhook URL: `https://your-app.railway.app/api/webhooks/retell`
4. Update Twilio webhook URL: `https://your-app.railway.app/api/webhooks/twilio/:agentId`

## Troubleshooting

### MongoDB Connection Issues

**Error: "MongoDB connection string is required"**
- Solution: Make sure `MONGO_URL` is set in Railway environment variables

**Error: "MongoServerError: Authentication failed"**
- Solution: Railway automatically sets correct credentials in `MONGO_URL`. Don't override it.

**Error: "MongoNetworkError: connect ECONNREFUSED"**
- Solution: Make sure MongoDB service is running in Railway. Check the MongoDB service status.

### Connection String Format

Railway provides `MONGO_URL` in this format:
```
mongodb+srv://username:password@host.mongodb.net/database?retryWrites=true&w=majority
```

The backend automatically:
- Extracts and uses the connection string
- Adds the database name if missing
- Preserves query parameters

## Security Notes

- ✅ Never commit `.env` files to git
- ✅ Railway automatically manages MongoDB credentials
- ✅ Connection strings are hidden in logs (credentials are masked)
- ✅ Use Railway's built-in MongoDB service for automatic credential management
