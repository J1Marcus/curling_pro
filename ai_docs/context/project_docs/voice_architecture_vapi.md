# Everbound Voice Architecture
## VAPI-Centered Life Story Capture System

**Target Audience**: 65+ years old
**Core Principle**: Voice-first, minimal friction, privacy-focused

---

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERFACES                          │
├─────────────────┬───────────────────────────────────────────┤
│   Phone Call    │          Web App                          │
│   (VAPI)        │    (Chat/Voice Toggle)                    │
└────────┬────────┴──────────────┬────────────────────────────┘
         │                       │
         └───────────┬───────────┘
                     │
         ┌───────────▼──────────────┐
         │   VAPI Voice Agent       │
         │   - Conversation Engine  │
         │   - Call Management      │
         │   - Real-time STT/TTS    │
         └───────────┬──────────────┘
                     │
         ┌───────────▼──────────────┐
         │   Everbound Backend      │
         │   - Session Orchestration│
         │   - Existing Scheduler   │
         │   - Story Processor      │
         │   - Privacy Layer        │
         └───────────┬──────────────┘
                     │
         ┌───────────▼──────────────┐
         │   Storage & Processing   │
         │   - Local Audio Cache    │
         │   - Encrypted Transcripts│
         │   - Story Synthesis      │
         └──────────────────────────┘
```

---

## Core Components

### 1. VAPI Voice Agent (Primary Interface)

**Capabilities**:
- Inbound/outbound phone calls
- Real-time speech-to-text (STT)
- Text-to-speech (TTS) with natural voices
- Function calling for backend integration
- Session management

**Configuration**:
```json
{
  "voice": "gentle, warm tone suitable for 65+",
  "transcription": "real-time streaming",
  "model": "gpt-4 or claude via VAPI",
  "function_calls": [
    "saveStorySegment",
    "scheduleNextSession",
    "requestClarification",
    "markSensitiveTopic"
  ]
}
```

**Session Flow**:
1. VAPI initiates scheduled call
2. Warm greeting + brief orientation
3. Contextual prompt based on Phase (from process.txt)
4. User responds via voice
5. VAPI streams to backend in real-time
6. Backend saves + acknowledges
7. Next prompt or graceful close
8. Schedule next session

---

### 2. Scheduling System (Existing)

**Integration Points**:
- Trigger VAPI outbound calls at scheduled times
- Handle user-initiated reschedules
- Send SMS/email reminders 30 mins before
- Track completion status per phase

**Sample Flow**:
```python
# Your existing scheduler triggers
scheduler.schedule_session(
    user_id="user_123",
    session_type="story_capture",
    phase="childhood_memories",
    duration=10,  # minutes
    preferred_time="2pm-4pm weekdays"
)

# Scheduler hits VAPI webhook
POST /vapi/initiate-call
{
    "phone_number": "+1234567890",
    "assistant_id": "everbound-storyteller",
    "context": {
        "user_id": "user_123",
        "phase": "childhood_memories",
        "previous_context": "Last spoke about growing up in Ohio"
    }
}
```

---

### 3. Backend Architecture

```
everbound_backend/
├── voice_agent/
│   ├── vapi_client.py          # VAPI API integration
│   ├── session_orchestrator.py # Phase management
│   ├── prompt_generator.py     # Contextual prompts per phase
│   └── webhook_handlers.py     # VAPI callbacks
│
├── story_capture/
│   ├── segment_processor.py    # Process voice responses
│   ├── privacy_filter.py       # Tier 1/2/3 classification
│   ├── context_manager.py      # Track user's story state
│   └── synthesis_engine.py     # Chapter assembly
│
├── scheduler/  # Your existing code
│   ├── session_scheduler.py
│   └── reminders.py
│
└── storage/
    ├── audio_cache.py          # Temporary local storage
    ├── transcript_store.py     # Encrypted transcripts
    └── story_database.py       # Assembled narratives
```

---

### 4. Web App (Chat/Voice Toggle)

**Tech Stack Recommendation**:
- **Frontend**: React/Next.js
- **Voice SDK**: VAPI Web SDK for browser-based calls
- **Chat**: Fallback text interface using same backend prompts

**User Experience**:
```
┌─────────────────────────────────┐
│  Everbound Web App              │
│                                 │
│  ┌───────────────────────┐     │
│  │ 🎤 Voice  |  💬 Chat  │ ◄─ Toggle
│  └───────────────────────┘     │
│                                 │
│  [Voice Mode]                   │
│  🔴 Recording...                │
│  "Tell me about a moment        │
│   when you felt truly home..."  │
│                                 │
│  [Click to respond]             │
│                                 │
│  Session 3/12 • Childhood       │
└─────────────────────────────────┘
```

**Implementation**:
```javascript
// VAPI Web SDK integration
import Vapi from "@vapi-ai/web";

const vapi = new Vapi("your-public-key");

// Start voice session
const startVoiceSession = () => {
  vapi.start({
    assistantId: "everbound-storyteller",
    metadata: {
      userId: currentUser.id,
      phase: currentPhase,
      sessionId: currentSessionId
    }
  });
};

// Listen for messages
vapi.on("message", (message) => {
  // Display transcript in real-time
  updateTranscript(message.text);
});

// Toggle to chat mode
const switchToChat = () => {
  vapi.stop();
  // Use same backend prompts via REST API
  chatMode.enable();
};
```

---

### 5. Privacy & Local Storage Strategy

**Principles**:
- Audio stays local or encrypted in transit
- User controls what gets synthesized
- Tier 3 (private) content never leaves device

**Architecture**:
```
Voice Input (VAPI)
    ↓
Transcript (encrypted in transit)
    ↓
Backend receives text only
    ↓
Classification (Tier 1/2/3)
    ↓
├─ Tier 1/2: Stored in DB (encrypted at rest)
└─ Tier 3: Returned to user's device only
    ↓
Local browser IndexedDB or secure notes
```

**Implementation**:
```python
# privacy_filter.py
def classify_segment(text: str, user_preferences: dict) -> str:
    """
    Classify story segment by privacy tier.
    Returns: 'tier_1' | 'tier_2' | 'tier_3'
    """
    # Use lightweight local LLM or rule-based
    if contains_sensitive_keywords(text):
        return 'tier_3'  # Keep private
    elif user_preferences.get('romance') == False:
        return 'tier_3'
    return 'tier_1'  # Safe for synthesis

# Only tier 1/2 persisted server-side
```

---

### 6. Cost Optimization

**Strategy**: Hybrid local + cloud

| Component | Local Option | Cloud Option | Recommendation |
|-----------|-------------|--------------|----------------|
| **Voice I/O** | N/A | VAPI | **VAPI** (core capability) |
| **Transcription** | Whisper (local) | VAPI built-in | **VAPI** (real-time needed) |
| **Prompt Generation** | Llama 3.1 8B | GPT-4/Claude | **Hybrid**: local for simple, cloud for complex |
| **Story Synthesis** | Llama 70B (if feasible) | Claude Opus | **Cloud** (quality critical) |
| **Privacy Classification** | Local LLM | Claude Haiku | **Local** (privacy requirement) |

**Cost Estimates** (per user, full story ~12 sessions):
- VAPI calls: ~$5-8 (120 mins total)
- Cloud LLM synthesis: ~$2-4 (chapter assembly)
- Storage: negligible
- **Total: $7-12 per completed story**

---

### 7. Multi-User Interview Feature

**Use Case**: Interview family member about shared event

**Flow**:
1. Primary user initiates from web app
2. System sends consent link to interviewee
3. Once accepted, VAPI places call or web session starts
4. Interview conducted with modified prompts:
   - "Tell me about [User]'s childhood from your perspective..."
5. Transcript tagged with source: `interviewee_id`
6. Primary user reviews and approves inclusion
7. Synthesis engine weaves multiple perspectives

**Implementation**:
```python
# Multi-perspective capture
class InterviewSession:
    def __init__(self, primary_user_id, interviewee_id, event_id):
        self.primary_user_id = primary_user_id
        self.interviewee_id = interviewee_id
        self.event_id = event_id
        self.consent_given = False

    def generate_prompts(self):
        """Generate prompts from interviewee's perspective"""
        return [
            f"What do you remember about {primary_user.name} during {event.timeframe}?",
            "What stands out to you about that time?",
            "Is there a specific moment you recall?"
        ]

    def request_consent(self):
        """Send consent request via SMS/email"""
        send_consent_link(
            to=self.interviewee_id,
            message=f"{primary_user.name} invited you to share memories about {event.title}"
        )
```

---

## Phase-Specific VAPI Configurations

### Phase 1: Introduction (Trust Setup)
```python
vapi_config = {
    "system_prompt": """
    You are a warm, patient interviewer helping someone preserve their life story.
    - Speak slowly and clearly
    - Reassure them this is just an outline, not final
    - Emphasize they can skip anything
    - Keep session under 10 minutes
    """,
    "first_message": "Hi [Name], thanks for taking time today. We're just going to chat for about 10 minutes. This is just to build an outline - nothing is locked in. Sound good?"
}
```

### Phase 4: Contextual Grounding
```python
vapi_config = {
    "system_prompt": """
    Gather factual timeline information. No interpretation.
    - Ask about dates, places, roles
    - Do not ask "how did that make you feel"
    - Keep responses brief, factual
    """,
    "sample_prompts": [
        "What year were you born, or roughly?",
        "Where did you grow up?",
        "Can you name the places you've lived?"
    ]
}
```

### Phase 6: Story Capture (The Engine)
```python
vapi_config = {
    "system_prompt": """
    Use scene-based prompts. One at a time.
    - "Take me to a specific moment when..."
    - "Who was there?"
    - "What was uncertain or hard?"
    - If user hesitates: "We can stay general if you prefer"
    """,
    "function_calls_enabled": True,
    "functions": [
        {
            "name": "saveStorySegment",
            "description": "Save a story segment with metadata",
            "parameters": {
                "text": "string",
                "phase": "string",
                "emotional_weight": "low|medium|high",
                "privacy_tier": "1|2|3"
            }
        }
    ]
}
```

---

## Data Flow Example (Complete Session)

```
1. Scheduler triggers 2:00 PM call
   ↓
2. VAPI initiates call to +1-234-567-8901
   ↓
3. User answers → Warm greeting
   ↓
4. VAPI: "Last time we talked about your childhood in Ohio.
          Today, can you take me to a specific moment from
          that time - maybe a Sunday afternoon?"
   ↓
5. User responds (voice) → VAPI transcribes in real-time
   ↓
6. Transcript streamed to backend webhook:
   POST /api/voice/segment
   {
     "user_id": "user_123",
     "session_id": "sess_456",
     "phase": "childhood_memories",
     "text": "I remember Sunday afternoons at my grandmother's...",
     "timestamp": "2025-12-20T14:03:22Z"
   }
   ↓
7. Backend processes:
   - Privacy classification → Tier 1 (safe)
   - Save to database (encrypted)
   - Update user's story context
   ↓
8. VAPI receives acknowledgment → Continues
   "That sounds lovely. Who else was usually there?"
   ↓
9. After 10 minutes or natural stopping point:
   "This was great. I'll see you next Thursday at 2pm?"
   ↓
10. Scheduler updates session status → complete
    Schedules next phase
```

---

## Technical Specifications

### VAPI Integration

**Authentication**:
```python
import requests

VAPI_API_KEY = os.getenv("VAPI_API_KEY")
VAPI_BASE_URL = "https://api.vapi.ai"

headers = {
    "Authorization": f"Bearer {VAPI_API_KEY}",
    "Content-Type": "application/json"
}
```

**Create Assistant**:
```python
assistant_config = {
    "name": "Everbound Storyteller",
    "voice": {
        "provider": "11labs",  # or "playht", "deepgram"
        "voiceId": "warm-elderly-friendly-voice"
    },
    "model": {
        "provider": "anthropic",
        "model": "claude-3-5-sonnet-20241022",
        "systemPrompt": get_phase_prompt(current_phase),
        "temperature": 0.7
    },
    "transcriber": {
        "provider": "deepgram",
        "model": "nova-2",
        "language": "en-US"
    },
    "functions": [
        {
            "name": "saveStorySegment",
            "description": "Save user's story segment",
            "url": f"{YOUR_BACKEND_URL}/api/voice/segment",
            "method": "POST"
        }
    ]
}

response = requests.post(
    f"{VAPI_BASE_URL}/assistant",
    headers=headers,
    json=assistant_config
)
assistant_id = response.json()["id"]
```

**Initiate Call**:
```python
def initiate_scheduled_call(user_id: str, phone: str, phase: str):
    """Trigger VAPI to call user for story session"""

    # Get user's current context
    context = get_user_context(user_id)

    call_config = {
        "assistantId": assistant_id,
        "phoneNumberId": "your-vapi-phone-number-id",
        "customer": {
            "number": phone
        },
        "metadata": {
            "userId": user_id,
            "phase": phase,
            "previousContext": context.summary,
            "sessionNumber": context.session_count + 1
        }
    }

    response = requests.post(
        f"{VAPI_BASE_URL}/call/phone",
        headers=headers,
        json=call_config
    )

    return response.json()["id"]  # call_id for tracking
```

**Webhook Handler**:
```python
from fastapi import FastAPI, Request

app = FastAPI()

@app.post("/api/vapi/webhook")
async def handle_vapi_webhook(request: Request):
    """Receive real-time events from VAPI"""

    event = await request.json()

    match event["type"]:
        case "transcript":
            # Real-time transcript chunk
            save_transcript_segment(
                user_id=event["metadata"]["userId"],
                text=event["transcript"]["text"],
                speaker=event["transcript"]["role"]  # "user" or "assistant"
            )

        case "function-call":
            # VAPI is calling saveStorySegment
            segment = event["functionCall"]["parameters"]
            save_story_segment(
                user_id=event["metadata"]["userId"],
                segment=segment
            )
            return {"result": "saved"}

        case "call-end":
            # Session completed
            finalize_session(
                user_id=event["metadata"]["userId"],
                duration=event["call"]["duration"]
            )
            schedule_next_session(event["metadata"]["userId"])

        case _:
            pass

    return {"status": "ok"}
```

---

## Deployment Architecture

### Production Setup

```
┌─────────────────┐
│   User Device   │
│  (Phone/Web)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   VAPI Cloud    │  ◄── Managed service
│  - Voice I/O    │
│  - STT/TTS      │
└────────┬────────┘
         │ HTTPS Webhooks
         ▼
┌─────────────────────────┐
│  Your Backend (FastAPI) │
│  - Railway/Render/AWS   │
│  - Webhook handlers     │
│  - Session logic        │
│  - Scheduler            │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Database (PostgreSQL)  │
│  - User profiles        │
│  - Transcripts (enc)    │
│  - Story segments       │
└─────────────────────────┘
```

### Environment Variables

```bash
# .env
VAPI_API_KEY=your_vapi_api_key
VAPI_PHONE_NUMBER_ID=your_phone_number_id
VAPI_ASSISTANT_ID=your_assistant_id

DATABASE_URL=postgresql://...
ENCRYPTION_KEY=...

# Your existing scheduler config
SCHEDULER_DB_URL=...
```

---

## Next Steps

1. **VAPI Setup**:
   - Create VAPI account
   - Purchase phone number
   - Create assistant with Phase 1 prompts
   - Test simple call flow

2. **Backend Integration**:
   - Add VAPI webhook endpoint to existing backend
   - Connect to your scheduler
   - Implement `saveStorySegment` function

3. **Testing with 65+ Users**:
   - Start with friendly volunteers
   - Test phone call quality
   - Measure 10-minute session effectiveness
   - Iterate on prompt pacing

4. **Web App**:
   - Integrate VAPI Web SDK
   - Build chat fallback
   - Add session dashboard

5. **Privacy Audit**:
   - Implement local privacy classifier
   - Test Tier 3 content isolation
   - Add user controls for data deletion

---

## Success Metrics

- **Session Completion Rate**: >80%
- **Average Session Duration**: 8-12 minutes
- **User Comfort** (survey): >4.5/5
- **Story Quality** (coherence): Human review
- **Cost per Story**: <$15

---

## References

- VAPI Docs: https://docs.vapi.ai
- Voice Design for Seniors: https://www.nngroup.com/articles/voice-ui-elderly/
- Narrative Therapy Ethics: Aligned with process.txt principles
