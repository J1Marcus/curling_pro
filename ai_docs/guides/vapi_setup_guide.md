# VAPI Configuration Guide

**Guide to configuring VAPI (Voice AI Platform Integration) for Everbound**

---

## Overview

VAPI is the voice conversation platform that powers Everbound's voice-first story capture. It provides:
- Speech-to-Text (STT) and Text-to-Speech (TTS)
- Call management (outbound, inbound, WebRTC)
- Real-time transcript streaming via webhooks
- AI agent configuration with custom prompts and tools

---

## Prerequisites

### 1. VAPI Account Setup

1. **Create VAPI Account**:
   - Visit [https://vapi.ai](https://vapi.ai)
   - Sign up for an account
   - Choose appropriate plan (development or production)

2. **Get API Key**:
   - Navigate to Dashboard → Settings → API Keys
   - Create new API key
   - Copy the key (starts with `vapi_...`)
   - **Store securely** - you won't see it again

3. **Generate Server Secret**:
   - Navigate to Dashboard → Settings → Webhooks
   - Generate webhook signing secret
   - Copy the secret
   - This is used to verify webhook signatures

---

## Environment Configuration

### Step 1: Update `.env` Files

Add these variables to **both** `.env` files:

#### `app/.env`
```bash
# VAPI (Voice Platform)
VAPI_API_KEY=vapi_your_api_key_here
VAPI_SERVER_SECRET=your_webhook_secret_here
BACKEND_URL=http://localhost:8080
```

#### `docker/.env`
```bash
# VAPI (Voice Platform)
VAPI_API_KEY=vapi_your_api_key_here
VAPI_SERVER_SECRET=your_webhook_secret_here
BACKEND_URL=https://yourdomain.com  # Production URL
```

### Step 2: Update Docker Compose (if needed)

The environment variables should already be passed through in [docker-compose.launchpad.yml](../../docker/docker-compose.launchpad.yml). Verify these lines exist:

```yaml
environment:
  - VAPI_API_KEY=${VAPI_API_KEY}
  - VAPI_SERVER_SECRET=${VAPI_SERVER_SECRET}
  - BACKEND_URL=${BACKEND_URL}
```

---

## Configuration Details

### Required Variables

| Variable | Description | Example | Where to Get |
|----------|-------------|---------|--------------|
| `VAPI_API_KEY` | API key for VAPI service calls | `vapi_abc123...` | VAPI Dashboard → API Keys |
| `VAPI_SERVER_SECRET` | Secret for webhook signature verification | `whsec_xyz789...` | VAPI Dashboard → Webhooks |
| `BACKEND_URL` | Your backend's public URL for webhooks | `https://api.everbound.com` | Your deployment URL |

### Environment-Specific Values

**Development (Local):**
```bash
VAPI_API_KEY=vapi_test_key_from_vapi_dashboard
VAPI_SERVER_SECRET=whsec_test_secret_from_vapi_dashboard
BACKEND_URL=http://localhost:8080
```

**Staging:**
```bash
VAPI_API_KEY=vapi_staging_key_from_vapi_dashboard
VAPI_SERVER_SECRET=whsec_staging_secret
BACKEND_URL=https://staging-api.everbound.com
```

**Production:**
```bash
VAPI_API_KEY=vapi_prod_key_from_vapi_dashboard
VAPI_SERVER_SECRET=whsec_prod_secret
BACKEND_URL=https://api.everbound.com
```

---

## Webhook Configuration

### Step 1: Configure Webhook Endpoints in VAPI Dashboard

Navigate to VAPI Dashboard → Webhooks and add these endpoints:

#### 1. **Transcript Webhook** (Real-time streaming)
```
URL: {BACKEND_URL}/webhooks/vapi/transcript
Method: POST
Events: transcript.update
```

#### 2. **Call Ended Webhook** (End-of-call report)
```
URL: {BACKEND_URL}/webhooks/vapi/call-ended
Method: POST
Events: call.ended
```

#### 3. **Function Call Webhook** (Custom tool execution)
```
URL: {BACKEND_URL}/webhooks/vapi/function-call
Method: POST
Events: function.call
```

### Step 2: Enable Webhook Signing

✅ **Enable signature verification** in VAPI Dashboard
- This uses `VAPI_SERVER_SECRET` to sign webhook payloads
- Backend validates signatures for security (Task #012)

---

## Testing VAPI Integration

### 1. **Verify API Key**

Test connection using VAPI's API:

```bash
curl https://api.vapi.ai/v1/agents \
  -H "Authorization: Bearer ${VAPI_API_KEY}"
```

Expected response: `200 OK` with agent list (may be empty)

### 2. **Test Webhook Endpoints (Local)**

For local development, you'll need to expose your localhost:

#### Option A: ngrok (Recommended for testing)

```bash
# Install ngrok
brew install ngrok

# Start ngrok tunnel
ngrok http 8080

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
# Update BACKEND_URL in .env to this URL
```

#### Option B: LocalTunnel

```bash
npm install -g localtunnel
lt --port 8080
```

#### Update VAPI Webhook URLs

Use the ngrok/localtunnel URL:
```
https://abc123.ngrok.io/webhooks/vapi/transcript
https://abc123.ngrok.io/webhooks/vapi/call-ended
https://abc123.ngrok.io/webhooks/vapi/function-call
```

### 3. **Test Call Flow**

Once Auto-Claude Task #012 (webhook security) is complete, test:

1. **Create test VAPI agent** (via playground or API)
2. **Initiate test call**
3. **Monitor webhook delivery**:
   ```bash
   # Watch logs for webhook events
   docker-compose logs -f api
   ```
4. **Verify signature validation works**

---

## VAPI Agent Configuration

### Agent Template (used by VAPIService)

The backend will create VAPI agents dynamically with this structure:

```json
{
  "name": "Everbound Story Capture",
  "model": {
    "provider": "google",
    "model": "gemini-2.5-flash",
    "temperature": 0.7
  },
  "voice": {
    "provider": "11labs",
    "voiceId": "warm-empathetic-voice"
  },
  "firstMessage": "Hi there! I'm here to help capture your story...",
  "systemPrompt": "You are a compassionate memoir interviewer...",
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "saveStorySegment",
        "description": "Save a story segment in real-time",
        "parameters": { ... }
      },
      "serverUrl": "{BACKEND_URL}/webhooks/vapi/function-call",
      "serverUrlSecret": "{VAPI_SERVER_SECRET}"
    }
  ]
}
```

This configuration is built in `app/services/vapi_service.py` (to be implemented in Phase 4).

---

## Security Considerations

### ✅ Do's:
- ✅ **Always use HTTPS** for `BACKEND_URL` in production
- ✅ **Verify webhook signatures** (Task #012)
- ✅ **Rotate secrets regularly** (every 90 days)
- ✅ **Use environment-specific API keys** (dev/staging/prod)
- ✅ **Store secrets in secure vaults** (not in git)

### ❌ Don'ts:
- ❌ **Never commit `.env` files** to git (use `.env.example` only)
- ❌ **Never expose secrets in logs** or error messages
- ❌ **Never use production keys in development**
- ❌ **Never skip webhook signature verification**

---

## Troubleshooting

### Issue: "VAPI_API_KEY not found"

**Cause**: Environment variable not loaded

**Solution**:
```bash
# Check if variable is set
echo $VAPI_API_KEY

# Reload .env
source app/.env

# Restart services
docker-compose restart
```

### Issue: "Webhook signature verification failed"

**Cause**: Mismatch between `VAPI_SERVER_SECRET` and VAPI Dashboard secret

**Solution**:
1. Go to VAPI Dashboard → Webhooks
2. Copy the exact secret
3. Update `.env` files
4. Restart services

### Issue: "Webhooks not received"

**Cause**: VAPI can't reach your `BACKEND_URL`

**Solution**:
1. Verify URL is publicly accessible:
   ```bash
   curl {BACKEND_URL}/health
   ```
2. Check ngrok/localtunnel is running (for local dev)
3. Verify webhook URLs in VAPI Dashboard match `BACKEND_URL`
4. Check firewall/security groups allow incoming traffic

### Issue: "401 Unauthorized from VAPI API"

**Cause**: Invalid or expired API key

**Solution**:
1. Go to VAPI Dashboard → API Keys
2. Verify key is active and not revoked
3. Generate new key if needed
4. Update `.env` files

---

## Production Checklist

Before going to production:

- [ ] Generate production VAPI API key
- [ ] Generate production webhook secret
- [ ] Configure production `BACKEND_URL` (HTTPS only)
- [ ] Update VAPI webhook endpoints with production URLs
- [ ] Enable webhook signature verification
- [ ] Test webhook delivery and signature validation
- [ ] Set up monitoring for webhook failures
- [ ] Configure rate limiting for webhook endpoints
- [ ] Set up alerting for VAPI API errors
- [ ] Document secret rotation process

---

## Resources

- **VAPI Documentation**: https://docs.vapi.ai
- **VAPI Dashboard**: https://dashboard.vapi.ai
- **System Architecture**: [ai_docs/context/project_docs/system_architecture.md](../context/project_docs/system_architecture.md)
- **Voice Architecture**: [ai_docs/context/source_docs/voice_architecture_vapi.md](../context/source_docs/voice_architecture_vapi.md)
- **Webhook Security Task**: `.auto-claude/specs/012-webhook-security/`

---

## Next Steps

After configuration:

1. ✅ Complete Auto-Claude Task #011 (Centralized Config) - Create `app/core/config.py` to load these variables
2. ✅ Complete Auto-Claude Task #012 (Webhook Security) - Implement signature verification
3. ✅ Implement `app/services/vapi_service.py` (Phase 4.2)
4. ✅ Implement `app/api/webhooks.py` (Phase 5.2)
5. ✅ Test E2E flow via playground

---

**Last Updated**: 2025-12-21
**Version**: 1.0
