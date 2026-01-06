# CORS Troubleshooting Guide

## Current Status

The backend is configured to:
- ✅ Always allow Vercel origins (`*.vercel.app`)
- ✅ Handle preflight OPTIONS requests
- ✅ Log all CORS checks for debugging

## If You're Still Getting CORS Errors

### Step 1: Verify Deployment

1. **Check Railway Deployment Status**
   - Go to Railway dashboard
   - Check if the latest deployment completed successfully
   - Look for any build errors

2. **Check Railway Logs**
   - In Railway, go to your service → "Deployments" → Click on latest deployment → "View Logs"
   - Look for these log messages:
     ```
     Allowed CORS origins: [...]
     Allowed CORS patterns: [...]
     NODE_ENV: production
     ```
   - When a request comes in, you should see:
     ```
     CORS check - Origin: https://voice-agent-phi-ten.vercel.app
     CORS: Allowing Vercel origin: https://voice-agent-phi-ten.vercel.app
     ```

### Step 2: Force Redeploy

If the code hasn't been deployed:

1. **Trigger a new deployment:**
   - In Railway, go to your service
   - Click "Redeploy" or make a small change to trigger a new build
   - Wait for deployment to complete

2. **Verify the new code is running:**
   - Check logs for the new CORS log messages
   - The logs should show "CORS check - Origin:" for each request

### Step 3: Check Environment Variables

Verify these are set in Railway:

- `NODE_ENV` = `production` (optional but recommended)
- `ALLOWED_ORIGINS` = `https://voice-agent-phi-ten.vercel.app` (optional - Vercel is allowed by default)

### Step 4: Test the Endpoint Directly

Test if CORS headers are being sent:

```bash
curl -X OPTIONS https://voice-agent-backend-nestjs-production.up.railway.app/api/dashboard/agents \
  -H "Origin: https://voice-agent-phi-ten.vercel.app" \
  -H "Access-Control-Request-Method: GET" \
  -v
```

You should see these headers in the response:
```
< Access-Control-Allow-Origin: https://voice-agent-phi-ten.vercel.app
< Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD
< Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept, Origin, Access-Control-Request-Method, Access-Control-Request-Headers
< Access-Control-Allow-Credentials: true
```

### Step 5: Clear Browser Cache

Sometimes browsers cache CORS responses:

1. Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. Or open in incognito/private window
3. Or clear browser cache completely

### Step 6: Check Frontend Configuration

Verify your frontend is sending requests correctly:

1. Check the API base URL in your frontend code
2. Ensure it's pointing to: `https://voice-agent-backend-nestjs-production.up.railway.app`
3. Check browser Network tab to see the actual request being sent

## Expected Behavior

When working correctly:

1. **Preflight Request (OPTIONS):**
   - Browser sends OPTIONS request with `Origin` header
   - Backend responds with 204 and CORS headers
   - Browser sees `Access-Control-Allow-Origin` header

2. **Actual Request:**
   - Browser sends GET/POST/etc. request
   - Backend includes CORS headers in response
   - Browser allows the response

## Railway Logs to Look For

**On startup:**
```
Allowed CORS origins: [ 'https://voice-agent-phi-ten.vercel.app', ... ]
Allowed CORS patterns: [ /^https:\/\/.*\.vercel\.app$/, ... ]
NODE_ENV: production
```

**On each request:**
```
CORS check - Origin: https://voice-agent-phi-ten.vercel.app
CORS: Allowing Vercel origin: https://voice-agent-phi-ten.vercel.app
```

If you don't see these logs, the new code hasn't been deployed yet.

## Quick Fix: Restart Railway Service

If nothing else works:

1. Go to Railway dashboard
2. Click on your service
3. Click "Settings" → "Restart"
4. Wait for service to restart
5. Test again

## Still Not Working?

If you've tried all the above:

1. **Check Railway logs** for any errors
2. **Verify the URL** - make sure it's the correct Railway URL
3. **Check if Railway is up** - visit the URL in browser to see if service is running
4. **Contact support** with Railway logs showing the CORS check messages
