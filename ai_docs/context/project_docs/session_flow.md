# Session Flow Critical Assessment

## Your Proposed Flow

```
1. Flow kicks off
2. Create outbound_agent dynamically
   - Session goal based on task description
   - Tool: GetStoryPointContext
3. VAPI initiates call / conducts interview
4. VAPI sends end_call_report to backend
5. POST CALL:
   - Persist transcript
   - Organize/sort/construct story points
   - Build archetype template based on current data
   - Construct next session tasks based on process map
   - Schedule task for next session
```

---

## Critical Analysis

### ✅ STRENGTHS

1. **Dynamic Agent Creation**: Smart - allows each session to be tailored to current phase
2. **GetStoryPointContext Tool**: Excellent - gives agent semantic access to prior context
3. **Batch Post-Processing**: Efficient - doesn't block call completion
4. **Automated Next Step Planning**: Reduces manual orchestration

### ⚠️ CRITICAL GAPS

#### 1. **Pre-Call Context Loading Missing**

**Issue**: Where does "task description" come from?

```
Current: Flow kicks off → Create agent
Missing: Load user state, determine phase, check scope
```

**Impact**: Agent might interview without knowing:
- Which phase user is in (Phase 2? Phase 6?)
- User's scope selection (whole life vs single event)
- User's privacy boundaries (comfortable with romance? trauma?)
- Where last session left off

**Fix**:
```python
# PRE-CALL PHASE NEEDED
def prepare_session(user_id: str, scheduled_task_id: str):
    # 1. Load user's current state
    user_state = get_user_state(user_id)

    # 2. Determine session goal from state + process map
    session_goal = determine_session_goal(
        current_phase=user_state.phase,
        scope=user_state.scope,  # whole_life | chapter | event
        completed_sections=user_state.completed_sections,
        process_map=PROCESS_MAP
    )

    # 3. Generate context-aware prompts
    prompts = generate_prompts(
        phase=user_state.phase,
        scope=user_state.scope,
        privacy_boundaries=user_state.boundaries,
        last_session_summary=user_state.last_summary
    )

    # 4. Create agent with full context
    agent = create_outbound_agent(
        session_goal=session_goal,
        prompts=prompts,
        tools=[GetStoryPointContext],
        user_context=user_state.context_summary
    )

    return agent
```

#### 2. **GetStoryPointContext Tool Timing**

**Issue**: When does agent call this tool?

```
Current: Tool available during call
Unclear: When agent decides to use it
```

**Scenarios**:
- **Start of call**: Agent loads context → Good
- **Mid-conversation**: User mentions "my sister" → Agent retrieves sister's name from prior session → Excellent
- **After user says something new**: Too late

**Recommendation**:
```python
# GetStoryPointContext should be called:
# 1. Automatically at call start (pre-load)
# 2. On-demand when agent detects reference to prior material
# 3. When user says "like I mentioned before..."

# Example VAPI function definition
{
    "name": "GetStoryPointContext",
    "description": """
        Retrieve semantically relevant context from user's prior sessions.
        Call this when:
        - User references a previous topic
        - You need to maintain narrative continuity
        - User asks about what they've already shared
    """,
    "parameters": {
        "query": {
            "type": "string",
            "description": "Semantic query (e.g., 'sister', 'childhood home', 'first job')"
        },
        "time_period": {
            "type": "string",
            "description": "Optional time filter (e.g., 'childhood', '1960s')"
        }
    }
}
```

#### 3. **Session Failure Recovery Strategy**

**User's Solution**: VAPI has built-in transcript/recording URLs + webapp fallback

**Issue**: All processing happens post-call. What if something goes wrong?

**Your Approach** (Better than mid-call streaming):

1. **VAPI provides transcript URL** - can fetch anytime
2. **If no end_call_report after 20 mins** - manually fetch recording/transcript
3. **User reviews transcript in webapp** - approve/modify before processing
4. **No need for real-time streaming** - simpler architecture

**Implementation**:

```python
# services/session_recovery.py

async def monitor_active_sessions():
    """Background task checking for stuck sessions"""

    while True:
        # Check every 5 minutes
        await asyncio.sleep(300)

        # Find sessions with no end_call_report
        stuck_sessions = await db.get_sessions_without_report(
            started_before=datetime.now() - timedelta(minutes=20)
        )

        for session in stuck_sessions:
            await recover_session(session)


async def recover_session(session):
    """Recover session using VAPI's transcript URL"""

    try:
        # 1. Fetch from VAPI
        transcript = await fetch_vapi_transcript(session.vapi_call_id)
        recording_url = await fetch_vapi_recording(session.vapi_call_id)

        # 2. Mark as recovered
        await db.update_session(
            session_id=session.id,
            status="recovered",
            transcript=transcript,
            recording_url=recording_url
        )

        # 3. Send to user for review before processing
        await send_to_user_for_review(
            user_id=session.user_id,
            session_id=session.id,
            transcript=transcript,
            recording_url=recording_url,
            message="""
            Your session completed but we didn't receive the final report.
            We've recovered your transcript. Please review it before we continue.

            [Review Transcript] [Listen to Recording] [Redo Session]
            """
        )

    except Exception as e:
        # Couldn't recover - offer to reschedule
        await offer_reschedule(session.user_id, reason="technical_issue")


async def fetch_vapi_transcript(call_id: str) -> str:
    """Fetch transcript from VAPI"""
    response = await http_client.get(
        f"https://api.vapi.ai/call/{call_id}",
        headers={"Authorization": f"Bearer {VAPI_API_KEY}"}
    )
    call_data = response.json()

    # VAPI provides transcript in call object
    return call_data["transcript"]


async def fetch_vapi_recording(call_id: str) -> str:
    """Fetch recording URL from VAPI"""
    response = await http_client.get(
        f"https://api.vapi.ai/call/{call_id}",
        headers={"Authorization": f"Bearer {VAPI_API_KEY}"}
    )
    call_data = response.json()

    # VAPI provides recording URL
    return call_data["recordingUrl"]
```

**Webapp Transcript Review UI**:

```typescript
// components/SessionReview.tsx

export function SessionReview({ sessionId }: { sessionId: string }) {
  const { transcript, recording, storyPoints } = useSession(sessionId);

  return (
    <div className="session-review">
      <h2>Review Your Session</h2>

      {/* Audio playback */}
      <audio src={recording} controls />

      {/* Transcript with timestamps */}
      <div className="transcript">
        {transcript.map((line, i) => (
          <div key={i} className={line.speaker}>
            <span className="timestamp">{line.timestamp}</span>
            <span className="text">{line.text}</span>
            {/* Allow inline editing */}
            <button onClick={() => editLine(i)}>Edit</button>
          </div>
        ))}
      </div>

      {/* Story points extracted */}
      <div className="story-points">
        <h3>Key Moments We Captured</h3>
        {storyPoints.map(point => (
          <StoryPointCard
            key={point.id}
            point={point}
            onEdit={updateStoryPoint}
            onDelete={removeStoryPoint}
          />
        ))}
      </div>

      <div className="actions">
        <button onClick={approveSession}>Looks Good</button>
        <button onClick={requestChanges}>Request Changes</button>
        <button onClick={redoSession}>Start Over</button>
      </div>
    </div>
  );
}
```

**Benefit**: Simpler architecture, user in control, can recover from any failure

#### 4. **Archetype Template Building - Adaptive Approach**

**User's Solution**: Use specialized agentic node that intelligently assesses after each session

From process.txt Phase 10:
> "System analyzes material for... archetype(s) at: Whole work level"
> "Hidden by default"

**Improved Approach**: Agentic archetype assessment node

```python
# POST CALL
async def post_call_processing(user_id, call_report):
    # 1. Persist transcript ✓
    persist_transcript(call_report.transcript)

    # 2. Organize story points ✓
    story_points = organize_story_points(call_report.transcript)

    # 3. Adaptive Archetype Assessment (AGENTIC NODE)
    # Agent decides: no change | assert tentative | refine | pivot
    archetype_action = await archetype_assessment_agent(
        user_id=user_id,
        new_story_points=story_points,
        existing_archetype=get_current_archetype(user_id),
        session_count=get_session_count(user_id),
        all_story_points=get_all_story_points(user_id)
    )

    match archetype_action.decision:
        case "no_change":
            # Not enough new information
            pass

        case "assert_tentative":
            # First time seeing a pattern (session 3-4)
            save_tentative_archetype(user_id, archetype_action.archetype)

        case "refine":
            # Strengthen existing archetype with new evidence
            refine_archetype(user_id, archetype_action.refinements)

        case "pivot":
            # Story is taking a different shape than expected
            update_archetype(user_id, archetype_action.new_archetype)
            log_archetype_pivot(user_id, archetype_action.reason)

    # 4. Construct next session tasks ✓
    next_tasks = determine_next_tasks(
        current_phase=get_current_phase(user_id),
        completed_sections=get_completed_sections(user_id),
        process_map=PROCESS_MAP,
        current_archetype=archetype_action.archetype  # Inform next steps
    )

    # 5. Schedule handled by call-end agent (see below)
```

**Archetype Assessment Agent Implementation**:

```python
# services/archetype_agent.py

async def archetype_assessment_agent(
    user_id: str,
    new_story_points: list,
    existing_archetype: Optional[dict],
    session_count: int,
    all_story_points: list
) -> ArchetypeAction:
    """
    Intelligent agent that assesses whether archetype needs updating.
    Uses GenAI framework agentic node.
    """

    prompt = f"""
    You are an expert in narrative archetypes. Review this user's story material and determine
    what action to take regarding their story archetype.

    Session count: {session_count}
    Current archetype: {existing_archetype or "None yet"}

    New material from latest session:
    {format_story_points(new_story_points)}

    All material so far:
    {format_story_points(all_story_points[-50:])}  # Last 50 points for context

    Archetype options (from process.txt):
    - Threat vs Endurance vs Transformation
    - Identity Before/After
    - Relationship to Loss, Agency, Meaning

    Decide:
    1. "no_change" - Not enough new information, keep existing
    2. "assert_tentative" - First clear pattern emerging (usually session 3-4)
    3. "refine" - New material strengthens existing archetype
    4. "pivot" - Story is taking different shape than expected

    Respond with JSON:
    {{
        "decision": "no_change|assert_tentative|refine|pivot",
        "archetype": {{
            "primary": "transformation|endurance|threat",
            "identity_shift": "before/after description",
            "relationship_to_loss": "...",
            "relationship_to_agency": "...",
            "relationship_to_meaning": "..."
        }},
        "confidence": 0.0-1.0,
        "reason": "Why this decision",
        "refinements": ["specific updates if refining"],
        "evidence": ["story points that support this"]
    }}
    """

    response = await llm_call(
        model="claude-3-5-sonnet-20241022",
        prompt=prompt,
        temperature=0.3  # Lower temp for consistent assessment
    )

    return ArchetypeAction(**response)
```

#### 5. **Missing Quality Gates**

**Issue**: No verification that session was successful

**What could go wrong**:
- Poor audio quality → transcript gibberish
- User was distracted → shallow responses
- User expressed discomfort → should pause, not continue
- Technical issues → partial capture

**Add Quality Checks**:

```python
def post_call_quality_check(call_report):
    """Validate session quality before proceeding"""

    quality_issues = []

    # 1. Transcript completeness
    if call_report.duration < 5 * 60:  # Less than 5 mins
        quality_issues.append("Session too short")

    # 2. Transcript quality
    confidence = call_report.transcription_confidence
    if confidence < 0.8:
        quality_issues.append("Poor audio quality")

    # 3. User engagement
    user_word_count = count_words(call_report.transcript, speaker="user")
    if user_word_count < 200:  # Arbitrary threshold
        quality_issues.append("Low user engagement")

    # 4. Sentiment analysis
    sentiment = analyze_sentiment(call_report.transcript)
    if sentiment.distress_detected:
        quality_issues.append("User distress detected")

    # 5. Completion markers
    if not agent_said_goodbye(call_report.transcript):
        quality_issues.append("Call may have dropped")

    return quality_issues

# Then decide:
if quality_issues:
    notify_admin(quality_issues)
    send_user_apology_and_reschedule()
else:
    proceed_with_processing()
```

#### 6. **Next Session Scheduling - Agent-Driven**

**User's Solution**: Agent determines next steps WITH user as session ends

**Issue**: Auto-scheduling assumes user wants to continue immediately

**Your Approach**: Agent handles scheduling during call end + SMS/email fallback

**Implementation**:

```python
# VAPI Agent System Prompt (Call-End Phase)
"""
As the session approaches 10 minutes, transition to wrap-up:

1. Acknowledge what was shared
2. Briefly mention what's next (if appropriate)
3. Ask about scheduling:
   "When would work well for our next conversation?
   - We could do [suggest 2-3 times based on their preferences]
   - Or you can schedule later through the website
   - Or take a break and reach out when you're ready"

4. Call the ScheduleNextSession function with user's choice:
   - specific_time: if they chose a time
   - schedule_later: if they want to decide later
   - need_break: if they want to pause

5. Warm goodbye
"""

# VAPI Function for Scheduling
{
    "name": "ScheduleNextSession",
    "description": "Record user's scheduling preference for next session",
    "parameters": {
        "preference": {
            "type": "string",
            "enum": ["specific_time", "schedule_later", "need_break"]
        },
        "datetime": {
            "type": "string",
            "description": "ISO datetime if specific_time chosen"
        },
        "notes": {
            "type": "string",
            "description": "Any special requests or context"
        }
    }
}
```

**Backend Handler**:

```python
@app.post("/api/tools/schedule-next-session")
async def schedule_next_session(request: dict):
    """Handle scheduling decision from agent"""

    user_id = request["metadata"]["userId"]
    preference = request["preference"]
    datetime_str = request.get("datetime")

    match preference:
        case "specific_time":
            # Agent got a time commitment
            scheduled_task = await scheduler.create_task(
                user_id=user_id,
                datetime=parse_datetime(datetime_str),
                task_type="story_session",
                next_phase=determine_next_phase(user_id)
            )
            await send_calendar_invite(user_id, scheduled_task)
            return {"result": "scheduled", "task_id": scheduled_task.id}

        case "schedule_later":
            # User wants to think about it
            await send_scheduling_reminder(
                user_id=user_id,
                delay_hours=24,
                message="Ready to schedule your next story session?"
            )
            return {"result": "will_follow_up"}

        case "need_break":
            # User needs pause
            await set_user_state(user_id, "on_break")
            await send_message(
                user_id=user_id,
                message="Take all the time you need. When you're ready, just let us know."
            )
            return {"result": "on_break"}


# Fallback for failed calls
async def handle_call_failure_scheduling(user_id: str, session_id: str):
    """If call ends without scheduling being handled"""

    # SMS/Email pointing to webapp
    await send_sms(
        to=get_user_phone(user_id),
        message="""
        Your Everbound session completed!

        To schedule your next session and review what we captured,
        visit: https://app.everbound.com/sessions/{session_id}

        Or text back with "SCHEDULE" to see available times.
        """
    )

    await send_email(
        to=get_user_email(user_id),
        subject="Review Your Story Session",
        html=f"""
        <h2>Your session is ready to review</h2>
        <p>Visit your dashboard to:</p>
        <ul>
            <li>Review the transcript</li>
            <li>See the moments we captured</li>
            <li>Schedule your next session</li>
        </ul>
        <a href="https://app.everbound.com/sessions/{session_id}">
            Review Session
        </a>
        """
    )


# SMS response handler
@app.post("/api/sms/webhook")
async def handle_sms_response(message: dict):
    """Handle user SMS responses"""

    user_phone = message["from"]
    text = message["body"].upper()

    if "SCHEDULE" in text:
        # Send available times
        user = await get_user_by_phone(user_phone)
        available_slots = await get_available_slots(user.id)

        reply = "When works for you?\n"
        for i, slot in enumerate(available_slots[:3], 1):
            reply += f"{i}. {slot.format()}\n"
        reply += "\nReply with number to confirm, or visit app for more options."

        await send_sms(to=user_phone, message=reply)

    elif text.isdigit() and 1 <= int(text) <= 3:
        # User chose a slot
        user = await get_user_by_phone(user_phone)
        slot_index = int(text) - 1
        available_slots = await get_available_slots(user.id)
        chosen_slot = available_slots[slot_index]

        await scheduler.create_task(
            user_id=user.id,
            datetime=chosen_slot.datetime,
            task_type="story_session"
        )

        await send_sms(
            to=user_phone,
            message=f"Perfect! Your next session is scheduled for {chosen_slot.format()}. You'll get a reminder 30 minutes before."
        )
```

**User Experience Flow**:

```
Call ends
    ↓
Agent: "When should we talk next?"
    ↓
User chooses → Agent schedules → Confirmation
                    ↓
            OR
                    ↓
User says "I'll decide later" → SMS/Email sent
                                      ↓
                            User clicks link or texts back
                                      ↓
                            Webapp/SMS scheduling flow
                                      ↓
                            Task created in scheduler
```

**Benefit**: Respectful, flexible, covers all cases including failures

#### 7. **Missing User Verification Loop**

**Issue**: No way for user to correct/clarify after session

From process.txt Phase 9:
> "Anything here feel off or missing?"
> "Would you like to leave this as is?"

**Current flow**:
```
Call ends → Backend processes → Done
          ↓
      User never sees results
```

**Should be**:
```
Call ends → Backend processes → Send summary to user
                                      ↓
                              User reviews/corrects
                                      ↓
                              Confirmed → Continue
```

**Implementation**:
```python
# After post-call processing
def send_session_verification(user_id, session_id):
    """Let user review and correct"""

    session_summary = generate_session_summary(session_id)
    story_points = get_story_points(session_id)

    # Send to web app or email
    send_to_user(
        user_id=user_id,
        message=f"""
        Here's what we captured today:

        {session_summary}

        Key moments:
        {format_story_points(story_points)}

        Does this feel right?
        [Yes, looks good] [Something's off] [Add more detail]
        """
    )

    # Wait for user response before finalizing
    # This is critical for trust + accuracy
```

---

## REVISED FLOW RECOMMENDATION

### Improved Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. PRE-CALL PREPARATION                                     │
├─────────────────────────────────────────────────────────────┤
│ • Load user state (phase, scope, boundaries)                │
│ • Determine session goal from process map                   │
│ • Generate contextual prompts                               │
│ • Pre-load story context via GetStoryPointContext           │
│ • Create VAPI agent with tools + context                    │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. CALL EXECUTION                                           │
├─────────────────────────────────────────────────────────────┤
│ • VAPI initiates call                                       │
│ • Agent conducts interview with phase-specific prompts     │
│ • Agent calls GetStoryPointContext as needed (real-time)    │
│ • Backend receives transcript stream (webhook)              │
│ • Real-time privacy classification                          │
│ • Checkpoint every 2 minutes                                │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. CALL END                                                 │
├─────────────────────────────────────────────────────────────┤
│ • VAPI sends end_call_report                                │
│ • Backend receives full transcript                          │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. QUALITY CHECK                                            │
├─────────────────────────────────────────────────────────────┤
│ • Validate transcript quality                               │
│ • Check session duration                                    │
│ • Analyze user engagement                                   │
│ • Detect distress signals                                   │
│ → If issues detected: notify user, offer reschedule         │
│ → If quality good: proceed                                  │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. POST-CALL PROCESSING                                     │
├─────────────────────────────────────────────────────────────┤
│ • Persist full transcript (encrypted)                       │
│ • Organize into story points                                │
│ • Tag with metadata (phase, people, places, emotions)       │
│ • Update user's context summary                             │
│ • IF session_count >= 4 AND session_count % 3 == 0:         │
│   → Infer archetype (whole narrative level)                 │
│ • Determine next session tasks from process map             │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. USER VERIFICATION (NEW)                                  │
├─────────────────────────────────────────────────────────────┤
│ • Generate session summary                                  │
│ • Send to user (email/web app)                              │
│ • User reviews and confirms/corrects                        │
│ • Wait for user response                                    │
│ → If corrections: update story points                       │
│ → If confirmed: mark session as finalized                   │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. SCHEDULE NEXT SESSION (USER-DRIVEN)                      │
├─────────────────────────────────────────────────────────────┤
│ • Show user what's next                                     │
│ • Offer scheduling options                                  │
│ • User chooses time (or postpones)                          │
│ • Create task in scheduler                                  │
│ → Loop back to step 1 for next session                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Code Structure Recommendations

### 1. Pre-Call Orchestrator

```python
# services/session_orchestrator.py

class SessionOrchestrator:
    """Manages full session lifecycle"""

    def __init__(self, user_id: str, task_id: str):
        self.user_id = user_id
        self.task_id = task_id
        self.user_state = None
        self.agent_config = None

    async def prepare_session(self):
        """PRE-CALL: Prepare everything needed"""

        # 1. Load user state
        self.user_state = await self.load_user_state()

        # 2. Determine session goal from process map
        session_goal = self.determine_session_goal()

        # 3. Generate prompts
        prompts = self.generate_prompts()

        # 4. Pre-load context
        story_context = await self.preload_story_context()

        # 5. Create agent configuration
        self.agent_config = self.create_agent_config(
            session_goal=session_goal,
            prompts=prompts,
            story_context=story_context
        )

        return self.agent_config

    def load_user_state(self):
        """Load everything needed to contextualize session"""
        return UserState(
            user_id=self.user_id,
            current_phase=db.get_current_phase(self.user_id),
            scope=db.get_scope(self.user_id),  # whole_life | chapter | event
            privacy_boundaries=db.get_boundaries(self.user_id),
            completed_sections=db.get_completed_sections(self.user_id),
            session_count=db.get_session_count(self.user_id),
            last_session_summary=db.get_last_summary(self.user_id)
        )

    def determine_session_goal(self):
        """Use process map to determine what this session should accomplish"""

        phase = self.user_state.current_phase
        scope = self.user_state.scope

        # Map to process.txt phases
        if phase == "introduction":
            return SessionGoal(
                phase="Phase 1: Introduction & Trust Setup",
                objective="Reduce anxiety, set expectations",
                target_duration=10,
                prompts_type="trust_building"
            )

        elif phase == "scope_selection":
            return SessionGoal(
                phase="Phase 2: Scope Selection",
                objective="Determine focus: whole life | chapter | event",
                target_duration=8,
                prompts_type="scope_determination"
            )

        elif phase == "profile_setup":
            return SessionGoal(
                phase="Phase 3: Gentle Profile",
                objective="Gather boundaries and life structure",
                target_duration=10,
                prompts_type="checkbox_only"
            )

        elif phase == "contextual_grounding":
            return SessionGoal(
                phase="Phase 4: Contextual Grounding",
                objective="Facts before story - timeline building",
                target_duration=10,
                prompts_type="factual_chronological"
            )

        elif phase == "story_capture":
            # The main engine - most sessions will be here
            return self.determine_story_capture_goal()

        # ... etc

    def determine_story_capture_goal(self):
        """Determine specific story capture session goal"""

        completed = self.user_state.completed_sections
        scope = self.user_state.scope

        # Example: If scope is "whole_life" and "childhood" not completed
        if scope == "whole_life" and "childhood" not in completed:
            return SessionGoal(
                phase="Phase 6: Story Capture - Childhood",
                objective="Capture specific childhood memories",
                target_duration=10,
                prompts_type="scene_based",
                section="childhood",
                prompt_pack=[
                    "Take me to a specific moment from your childhood...",
                    "Who was there?",
                    "What was uncertain or hard?",
                    "Did anything shift for you?",
                    "Looking back, what do you notice now?"
                ]
            )

        # Use process map to walk through sections progressively
        next_section = self.get_next_section_from_process_map()
        return self.build_goal_for_section(next_section)

    def generate_prompts(self):
        """Generate phase-specific prompts"""
        # Use prompt templates based on session goal
        pass

    async def preload_story_context(self):
        """Pre-load relevant context before call starts"""

        # Use semantic search on prior story points
        recent_context = await semantic_search(
            user_id=self.user_id,
            query="most recent story points",
            limit=5
        )

        # Also load any named entities mentioned
        entities = await get_named_entities(self.user_id)

        return StoryContext(
            recent_points=recent_context,
            people=entities["people"],
            places=entities["places"],
            time_periods=entities["time_periods"]
        )

    def create_agent_config(self, session_goal, prompts, story_context):
        """Build VAPI agent configuration"""

        return {
            "name": f"Everbound Session {self.user_state.session_count + 1}",
            "model": {
                "provider": "anthropic",
                "model": "claude-3-5-sonnet-20241022",
                "systemPrompt": self.build_system_prompt(session_goal, story_context),
                "temperature": 0.7
            },
            "voice": {
                "provider": "11labs",
                "voiceId": "warm-gentle-voice"
            },
            "firstMessage": prompts[0],
            "functions": [
                {
                    "name": "GetStoryPointContext",
                    "description": "Retrieve relevant context from prior sessions",
                    "url": f"{BACKEND_URL}/api/tools/get-story-context",
                    "method": "POST",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {"type": "string"},
                            "time_period": {"type": "string"}
                        }
                    }
                },
                {
                    "name": "SaveStorySegment",
                    "description": "Save a story segment with metadata",
                    "url": f"{BACKEND_URL}/api/tools/save-story-segment",
                    "method": "POST"
                }
            ],
            "metadata": {
                "userId": self.user_id,
                "taskId": self.task_id,
                "phase": session_goal.phase,
                "sessionNumber": self.user_state.session_count + 1
            }
        }
```

### 2. Real-Time Processing

```python
# api/webhooks/vapi.py

@router.post("/vapi/transcript-stream")
async def handle_transcript_stream(event: dict):
    """Process transcript in real-time"""

    user_id = event["metadata"]["userId"]
    session_id = event["call_id"]
    text = event["transcript"]["text"]
    speaker = event["transcript"]["role"]

    # Save immediately
    await save_transcript_chunk(
        user_id=user_id,
        session_id=session_id,
        speaker=speaker,
        text=text,
        timestamp=event["timestamp"]
    )

    # Real-time privacy classification
    if speaker == "user":
        privacy_tier = await classify_privacy_real_time(text, user_id)

        if privacy_tier == "tier_3":
            await mark_as_private(session_id, text)
            # Consider: flag to agent to be extra careful

    return {"status": "processed"}


@router.post("/vapi/end-call")
async def handle_end_call(report: dict):
    """Handle call completion"""

    user_id = report["metadata"]["userId"]
    session_id = report["call_id"]

    # Kick off async post-processing
    await process_completed_session.delay(user_id, session_id)

    return {"status": "queued"}
```

### 3. Post-Call Processing

```python
# services/post_call_processor.py

async def process_completed_session(user_id: str, session_id: str):
    """Comprehensive post-call processing"""

    # 1. Quality check
    quality_issues = await check_session_quality(session_id)
    if quality_issues:
        await handle_quality_issues(user_id, session_id, quality_issues)
        return

    # 2. Organize transcript into story points
    story_points = await organize_story_points(session_id)

    # 3. Update user context
    await update_user_context(user_id, story_points)

    # 4. Archetype inference (conditional)
    session_count = await get_session_count(user_id)
    if session_count >= 4 and session_count % 3 == 0:
        await infer_archetype(user_id)

    # 5. Generate session summary
    summary = await generate_session_summary(session_id)

    # 6. Send to user for verification
    await send_verification_request(user_id, session_id, summary)

    # 7. Determine next session tasks
    next_tasks = await determine_next_tasks(user_id)

    # 8. Offer scheduling (don't auto-schedule)
    await offer_next_session(user_id, next_tasks)
```

---

## Additional Tools to Consider

### 1. MarkTopicComplete

```python
# Allow agent to signal completion
{
    "name": "MarkTopicComplete",
    "description": "Mark current topic/section as sufficiently explored",
    "parameters": {
        "topic": "string",
        "completeness_score": "1-10"
    }
}
```

### 2. DetectUserDiscomfort

```python
# Real-time detection
{
    "name": "DetectUserDiscomfort",
    "description": "Flag if user seems uncomfortable or wants to skip",
    "parameters": {
        "reason": "string",
        "severity": "low|medium|high"
    }
}
# Agent can adjust in real-time
```

### 3. RequestFollowUp

```python
# Agent can flag need for deeper exploration
{
    "name": "RequestFollowUp",
    "description": "Mark a moment that deserves more detail in next session",
    "parameters": {
        "moment_description": "string",
        "why_important": "string"
    }
}
```

---

## Summary: Refined Architecture

| Component | Original Concern | Your Solution | Status |
|-----------|-----------------|---------------|---------|
| "Flow kicks off" | No user state loading | Add PRE-CALL preparation phase | ✅ **Required** |
| "Create outbound_agent" | Where's session goal from? | Determine from process map + user state | ✅ **Required** |
| "GetStoryPointContext" | When is it called? | Pre-load at start + on-demand during call | ✅ **Required** |
| "end_call_report" | All processing post-call | VAPI transcript URLs + 20min recovery monitor | ✅ **Resolved** |
| "Build archetype template" | Too frequent/rigid | Agentic assessment node (adaptive) | ✅ **Resolved** |
| "Schedule task" | No user consent | Agent asks during call + SMS/email fallback | ✅ **Resolved** |
| *Missing* | No user verification | Webapp transcript review + approval | ✅ **Required** |
| *Missing* | No quality gates | Session quality checks before processing | ✅ **Required** |

---

## Final Recommended Flow (Incorporating Your Refinements)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. PRE-CALL PREPARATION (SessionOrchestrator)               │
├─────────────────────────────────────────────────────────────┤
│ • Load user state (phase, scope, boundaries, context)       │
│ • Determine session goal from process map                   │
│ • Generate phase-specific prompts                           │
│ • Pre-load story context (GetStoryPointContext)             │
│ • Create VAPI agent configuration with tools                │
│ • Initiate VAPI call                                        │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. CALL EXECUTION (VAPI + Agent)                            │
├─────────────────────────────────────────────────────────────┤
│ • VAPI conducts interview with contextual prompts           │
│ • Agent has access to:                                      │
│   - GetStoryPointContext (on-demand)                        │
│   - SaveStorySegment                                        │
│   - ScheduleNextSession (at call end)                       │
│ • Agent asks about next session timing before goodbye       │
│ • Recording + transcript captured by VAPI                   │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. CALL END & RECOVERY                                      │
├─────────────────────────────────────────────────────────────┤
│ • VAPI sends end_call_report to backend                     │
│ • If no report after 20 mins:                               │
│   - Monitor fetches transcript/recording from VAPI          │
│   - Send to user for review                                 │
│ • If scheduling not handled:                                │
│   - SMS/email with webapp link                              │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. QUALITY CHECK                                            │
├─────────────────────────────────────────────────────────────┤
│ • Validate transcript quality/completeness                  │
│ • Check session duration and engagement                     │
│ • Detect distress signals                                   │
│ → If issues: notify user, offer reschedule                  │
│ → If quality good: proceed to processing                    │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. POST-CALL PROCESSING                                     │
├─────────────────────────────────────────────────────────────┤
│ • Persist full transcript (encrypted)                       │
│ • Organize transcript into story points                     │
│ • Tag with metadata (phase, people, places, emotions)       │
│ • Update user's semantic context store                      │
│ • Agentic archetype assessment (adaptive):                  │
│   - no_change | assert_tentative | refine | pivot          │
│ • Determine next session tasks from process map             │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. USER VERIFICATION (Webapp)                               │
├─────────────────────────────────────────────────────────────┤
│ • Generate session summary                                  │
│ • Send to user via webapp/email                             │
│ • User reviews:                                             │
│   - Transcript (with audio playback)                        │
│   - Extracted story points                                  │
│   - Can edit, approve, or request changes                   │
│ • Wait for user confirmation                                │
│ → Finalize session once approved                            │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. NEXT SESSION (Agent-driven or Fallback)                  │
├─────────────────────────────────────────────────────────────┤
│ • If agent scheduled during call:                           │
│   - Task created in scheduler                               │
│   - Calendar invite sent                                    │
│ • If not scheduled:                                         │
│   - SMS/email with scheduling options                       │
│   - User can schedule via webapp or SMS reply               │
│ • User can also postpone or take break                      │
│ → Loop back to step 1 for next session                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Architectural Decisions (Your Improvements)

### 1. **Agentic Archetype Assessment** ✅
- Adaptive AI agent evaluates after each session
- Makes intelligent decisions: no_change | assert_tentative | refine | pivot
- Better than rigid "every Nth session" approach
- Aligns with process.txt principle that archetypes are structural, not prescriptive

### 2. **VAPI-Native Recovery** ✅
- Leverage VAPI's built-in transcript/recording URLs
- Background monitor checks for stuck sessions (>20 min)
- Simpler than real-time streaming
- User reviews in webapp before processing

### 3. **Agent-Driven Scheduling** ✅
- Agent asks about next session during call end
- Natural conversation flow
- SMS/email fallback if not handled
- Respectful of user's autonomy

### 4. **Webapp as Control Center** ✅
- Users review transcripts with audio
- Edit/approve story points
- Schedule sessions
- Full transparency and control

---

## Implementation Priority

### Phase 1: Core Flow (MVP)
1. Pre-call preparation (SessionOrchestrator)
2. VAPI integration with basic tools
3. Post-call processing and storage
4. Simple next-session scheduling

### Phase 2: Safety & Quality
1. Quality gates and validation
2. Session recovery monitor
3. Webapp transcript review
4. User verification loop

### Phase 3: Intelligence
1. Agentic archetype assessment
2. Semantic context retrieval (GetStoryPointContext)
3. Agent-driven scheduling
4. Multi-user interview support

---

## Bottom Line

Your original flow was **structurally sound**. With these additions:

✅ **Pre-call context loading** - Ensures agent has full picture
✅ **VAPI recovery strategy** - Simpler than real-time streaming
✅ **Agentic archetype assessment** - Adaptive, not rigid
✅ **Agent-driven scheduling** - Natural and respectful
✅ **Webapp verification** - User control and transparency

**Ready to implement.** Start with Phase 1, iterate on Phase 2-3.
