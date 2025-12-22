# VAPI Configuration - Quick Start

## 📋 What You Need

1. **VAPI Account** - Sign up at https://vapi.ai
2. **API Key** - From VAPI Dashboard → API Keys
3. **Webhook Secret** - From VAPI Dashboard → Webhooks

---

## ⚡ Quick Setup (5 minutes)

### Step 1: Get VAPI Credentials

1. Go to https://dashboard.vapi.ai
2. Navigate to **Settings → API Keys**
   - Click "Create API Key"
   - Copy the key (starts with `vapi_...`)
   
3. Navigate to **Settings → Webhooks**
   - Generate webhook signing secret
   - Copy the secret (starts with `whsec_...`)

### Step 2: Update Your `.env` Files

Add these 3 lines to **`app/.env`**:

```bash
# VAPI (Voice Platform)
VAPI_API_KEY=vapi_your_actual_key_here
VAPI_SERVER_SECRET=whsec_your_actual_secret_here
BACKEND_URL=http://localhost:8080
```

Add the same to **`docker/.env`**:

```bash
# VAPI (Voice Platform)
VAPI_API_KEY=vapi_your_actual_key_here
VAPI_SERVER_SECRET=whsec_your_actual_secret_here
BACKEND_URL=http://localhost:8080
```

### Step 3: Configure Webhooks in VAPI Dashboard

Go to VAPI Dashboard → Webhooks and add these 3 endpoints:

#### For Local Development (use ngrok):
```bash
# Install ngrok
brew install ngrok

# Start tunnel
ngrok http 8080

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
```

Then configure in VAPI:

1. **Transcript Webhook**
   - URL: `https://abc123.ngrok.io/webhooks/vapi/transcript`
   - Events: `transcript.update`

2. **Call Ended Webhook**
   - URL: `https://abc123.ngrok.io/webhooks/vapi/call-ended`
   - Events: `call.ended`

3. **Function Call Webhook**
   - URL: `https://abc123.ngrok.io/webhooks/vapi/function-call`
   - Events: `function.call`

✅ **Enable Signature Verification** in VAPI Dashboard

---

## 🧪 Test Your Configuration

### 1. Verify API Key Works

```bash
curl https://api.vapi.ai/v1/agents \
  -H "Authorization: Bearer ${VAPI_API_KEY}"
```

Expected: `200 OK` with empty array `[]`

### 2. Restart Services

```bash
docker-compose restart
```

### 3. Check Environment Variables Loaded

```bash
docker-compose exec api printenv | grep VAPI
```

Expected output:
```
VAPI_API_KEY=vapi_...
VAPI_SERVER_SECRET=whsec_...
BACKEND_URL=http://localhost:8080
```

---

## 📚 Full Documentation

For detailed setup, security considerations, and troubleshooting:
👉 **[ai_docs/guides/vapi_setup_guide.md](ai_docs/guides/vapi_setup_guide.md)**

---

## ✅ Next Steps

1. ✅ **Complete Auto-Claude Task #011** - Centralized Config (`app/core/config.py`)
2. ✅ **Complete Auto-Claude Task #012** - Webhook Security (signature verification)
3. ✅ Implement VAPIService (Phase 4.2)
4. ✅ Implement Webhook Handlers (Phase 5.2)
5. ✅ Test E2E flow via playground

---

## 🆘 Troubleshooting

### "VAPI_API_KEY not found"
```bash
# Check if set
docker-compose exec api printenv | grep VAPI

# Reload
docker-compose restart
```

### "Webhooks not received"
- Verify ngrok is running: `ngrok http 8080`
- Check webhook URLs in VAPI Dashboard match ngrok URL
- Test webhook endpoint: `curl https://abc123.ngrok.io/health`

### "401 Unauthorized"
- Verify API key is correct and active in VAPI Dashboard
- Check for typos in `.env` files
- Regenerate API key if needed

---

**Quick Start Created**: 2025-12-21
