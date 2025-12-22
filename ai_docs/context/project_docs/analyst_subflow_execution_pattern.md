# Analyst & Subflow Execution Pattern

**Version:** 1.0
**Date:** 2025-12-21
**Status:** Architectural Definition

---

## Core Principles

### 1. **Analyst Always Runs ALL Subflows**
The Analyst Flow does not selectively choose which subflow to execute. Instead:
- Analyst **triggers all subflows** on every run
- Each **subflow self-gates** based on entry criteria
- If criteria not met, subflow returns early (no-op)
- If criteria met, subflow assesses state and creates/resolves requirements

### 2. **Analyst Runs After EVERY Requirement Submission**
The Analyst Flow is triggered:
- After **every** `submit_requirement_result()` call during a session (real-time)
- After session completion
- On storyteller initialization
- Periodically (e.g., after 7 days of inactivity)

This enables **immediate response** to user progress, not batch processing.

### 3. **Requirement Submissions Include Transcript**
When the VAPI agent calls `submit_requirement_result()` during a session, the payload includes:
- Requirement ID
- Status (addressed, partially_addressed, skipped)
- Structured result data
- **Transcript segment** (the relevant portion of the conversation)

This allows immediate processing and validation of requirement fulfillment.

---

## Execution Flow: Frank's Journey (Example)

### **Initial State: Frank Signs Up**

**Database:**
```sql
INSERT INTO storyteller VALUES (
    id: 'frank-123',
    name: 'Frank',
    current_phase: NULL,
    trust_setup_started: FALSE,
    trust_setup_complete: FALSE,
    contextual_grounding_complete: FALSE,
    ...
);
```

---

### **Trigger: Account Creation**

**Event:** `storyteller_created`

**Analyst Flow triggered:**

```python
async def run_analyst_flow(storyteller_id: str, trigger_reason: str):
    """
    Analyst Flow ALWAYS runs ALL subflows.
    Each subflow self-gates based on entry criteria.
    """
    storyteller = await load_storyteller(storyteller_id)

    # Run ALL subflows (in order)
    await TrustBuildingWorkflow.run(storyteller_id)
    await ContextualGroundingWorkflow.run(storyteller_id)
    await SectionSelectionWorkflow.run(storyteller_id)
    await LaneDevelopmentWorkflow.run(storyteller_id)
    await ArchetypeAssessmentWorkflow.run(storyteller_id)  # Self-gates
    await SynthesisWorkflow.run(storyteller_id)  # Self-gates
    await CompositionWorkflow.run(storyteller_id)  # Self-gates
    await EditorWorkflow.run(storyteller_id)  # Self-gates

    # Determine next action based on state after all subflows run
    next_action = await determine_next_action(storyteller_id)
    return next_action
```

---

### **Subflow 1: Trust Building Workflow (Entry Criteria Met)**

```python
class TrustBuildingWorkflow(Workflow):
    async def run(self, storyteller_id: str):
        """
        Self-gating workflow: Only executes if in trust_building phase or phase is NULL.
        """
        storyteller = await load_storyteller(storyteller_id)

        # GATE: Entry criteria
        if storyteller.current_phase not in [None, 'trust_building']:
            # Wrong phase - return early
            return {"executed": False, "reason": "phase_gate_not_met"}

        # Entry criteria met - proceed with assessment

        # Set phase if NULL
        if storyteller.current_phase is None:
            await StorytellerService.update_progress(
                storyteller_id=storyteller_id,
                current_phase='trust_building'
            )

        # Assess each trust building element
        requirements_to_create = []

        # Element 1: Introduction
        if not storyteller.trust_setup_started:
            requirements_to_create.append({
                "requirement_type": "trust_setup",
                "priority": "critical",
                "requirement_description": "Complete introduction and expectations setting",
                "suggested_prompts": [
                    "We'll build an outline first, not the book.",
                    "You can skip anything.",
                    "You decide how much of your life we focus on.",
                    "Nothing is locked in."
                ],
                "metadata": {"trust_step": "introduction"}
            })

        # Element 2: Scope Selection
        if not storyteller.scope_type:
            requirements_to_create.append({
                "requirement_type": "trust_setup",
                "priority": "critical",
                "requirement_description": "Select memoir scope",
                "suggested_prompts": [
                    "Which best describes what you want to capture?",
                    "☐ My whole life story",
                    "☐ One major chapter of my life",
                    "☐ A specific life event or period",
                    "☐ I'm not sure yet (help me choose)"
                ],
                "metadata": {"trust_step": "scope_selection"}
            })

        # Element 3: Gentle Profile
        profile_missing = await identify_missing_profile_elements(storyteller_id)
        for element in profile_missing:
            requirements_to_create.append({
                "requirement_type": "trust_setup",
                "priority": "important",
                "requirement_description": f"Gather {element} information",
                "suggested_prompts": get_prompts_for_element(element),
                "metadata": {"trust_step": "gentle_profile", "element": element}
            })

        # Create all requirements
        for req_data in requirements_to_create:
            await RequirementService.create(
                storyteller_id=storyteller_id,
                **req_data
            )

        # Check if trust building complete
        if len(requirements_to_create) == 0:
            # All elements complete - transition phase
            await StorytellerService.update_progress(
                storyteller_id=storyteller_id,
                trust_setup_complete=True,
                current_phase='history_building'
            )
            return {
                "executed": True,
                "complete": True,
                "next_phase": "history_building"
            }
        else:
            return {
                "executed": True,
                "complete": False,
                "requirements_created": len(requirements_to_create)
            }
```

**Result:**
```python
{
    "executed": True,
    "complete": False,
    "requirements_created": 4  # introduction, scope, life_structure, boundaries
}
```

**Database:**
```sql
-- 4 requirements created
INSERT INTO requirement VALUES
('req-001', 'frank-123', 'trust_setup', 'critical', 'Complete introduction...', 'pending', ...),
('req-002', 'frank-123', 'trust_setup', 'critical', 'Select memoir scope', 'pending', ...),
('req-003', 'frank-123', 'trust_setup', 'important', 'Gather life structure...', 'pending', ...),
('req-004', 'frank-123', 'trust_setup', 'important', 'Gather comfort boundaries', 'pending', ...);

UPDATE storyteller_progress
SET current_phase = 'trust_building'
WHERE storyteller_id = 'frank-123';
```

---

### **Subflow 2: Contextual Grounding Workflow (Entry Criteria NOT Met)**

```python
class ContextualGroundingWorkflow(Workflow):
    async def run(self, storyteller_id: str):
        """
        Self-gating: Only executes if in history_building phase.
        """
        storyteller = await load_storyteller(storyteller_id)

        # GATE: Entry criteria
        if storyteller.current_phase != 'history_building':
            # Wrong phase - return early
            return {"executed": False, "reason": "phase_gate_not_met"}

        # Entry criteria met - would proceed with assessment...
        # (Not reached in this run since Frank is still in trust_building phase)
```

**Result:**
```python
{
    "executed": False,
    "reason": "phase_gate_not_met"
}
```

---

### **Subflow 3-8: Other Workflows (All Gate Early)**

Similarly, all other workflows check their gates and return early:

```python
# SectionSelectionWorkflow
# Gate: current_phase == 'history_building' AND contextual_grounding_complete == True
# Result: {"executed": False, "reason": "phase_gate_not_met"}

# LaneDevelopmentWorkflow
# Gate: current_phase == 'story_capture' AND sections_selected == True
# Result: {"executed": False, "reason": "phase_gate_not_met"}

# ArchetypeAssessmentWorkflow
# Gate: current_phase == 'story_capture' AND session_count >= 4 AND session_count % 3 == 0
# Result: {"executed": False, "reason": "session_count_gate_not_met"}

# SynthesisWorkflow
# Gate: current_phase == 'story_capture' AND any_section_has_sufficient_material
# Result: {"executed": False, "reason": "material_gate_not_met"}

# CompositionWorkflow
# Gate: all_sufficiency_gates_passed (archetype resolved, material threshold, etc.)
# Result: {"executed": False, "reason": "sufficiency_gates_not_met"}

# EditorWorkflow
# Gate: story_exists AND chapters_created
# Result: {"executed": False, "reason": "no_story_exists"}
```

---

### **Analyst Determines Next Action**

After all subflows have run (most gated early), Analyst determines next action:

```python
async def determine_next_action(storyteller_id: str):
    """
    Based on current state after all subflows run, determine what happens next.
    """
    storyteller = await load_storyteller(storyteller_id)
    pending_requirements = await RequirementService.get_pending(storyteller_id)

    if len(pending_requirements) > 0:
        # There are pending requirements - schedule/trigger session
        return {
            "action": "schedule_session",
            "session_type": "requirement_driven",
            "requirements": [req.id for req in pending_requirements]
        }
    elif storyteller.current_phase == 'composition':
        # In composition phase with no pending requirements - may be complete
        return {
            "action": "check_story_status",
            "story_id": storyteller.active_story_id
        }
    else:
        # No pending requirements, not in composition - may be stuck or complete
        return {
            "action": "review_needed",
            "reason": "no_pending_requirements_but_not_complete"
        }
```

**Result:**
```python
{
    "action": "schedule_session",
    "session_type": "requirement_driven",
    "requirements": ["req-001", "req-002", "req-003", "req-004"]
}
```

---

### **Session Flow: Frank's First VAPI Call**

**Session triggered** (scheduled or immediate):

```python
class SessionFlow(Workflow):
    async def run(self, storyteller_id: str, session_id: str):
        # Phase 1: Pre-Call Preparation
        requirements = await RequirementService.get_pending(
            storyteller_id=storyteller_id,
            order_by=['priority DESC', 'created_at ASC']
        )

        # Build VAPI agent system prompt
        system_prompt = build_system_prompt_from_requirements(requirements)

        # Create VAPI agent with tools
        vapi_agent = await VAPIService.create_agent(
            system_prompt=system_prompt,
            tools=[
                submit_requirement_result,  # ← Key tool
                save_story_segment,
                get_story_point_context
            ]
        )

        # Phase 2: Call Execution
        await VAPIService.initiate_call(
            phone_number=storyteller.phone_number,
            agent=vapi_agent
        )

        # Call proceeds... (VAPI handles conversation)
```

---

### **During VAPI Call: Requirement Submissions (Real-Time)**

**VAPI Agent conducts conversation...**

> **Agent:** "Hi Frank! Before we dive into your story, I want to set some expectations. We'll build an outline first, not the book itself. You can skip anything that doesn't feel right..."

**Frank:** "Yeah, that sounds great. I wasn't sure what to expect."

**Agent calls tool:**
```python
await submit_requirement_result(
    requirement_id="req-001",
    status="addressed",
    result={
        "introduction_acknowledged": True,
        "user_response": "Yeah, that sounds great. I wasn't sure what to expect."
    },
    transcript_segment={
        "agent_utterance": "We'll build an outline first, not the book itself. You can skip anything...",
        "user_utterance": "Yeah, that sounds great. I wasn't sure what to expect.",
        "timestamp": "2025-12-21T10:15:32Z",
        "duration_seconds": 45
    }
)
```

---

### **submit_requirement_result Tool (Triggers Analyst Flow)**

```python
async def submit_requirement_result(
    requirement_id: str,
    status: str,  # "addressed", "partially_addressed", "skipped"
    result: dict,  # Structured data from user response
    transcript_segment: dict  # Transcript payload
):
    """
    Tool called by VAPI agent during session to submit requirement results.

    CRITICAL: This triggers Analyst Flow immediately after submission.
    """
    # 1. Update requirement
    await RequirementService.mark_addressed(
        requirement_id=requirement_id,
        status=status,
        result=result,
        transcript_segment=transcript_segment
    )

    # 2. Apply side effects based on requirement metadata
    requirement = await RequirementService.get_by_id(requirement_id)

    if requirement.metadata.get('trust_step') == 'introduction':
        await StorytellerService.update_progress(
            storyteller_id=requirement.storyteller_id,
            trust_setup_started=True
        )

    # 3. TRIGGER ANALYST FLOW IMMEDIATELY
    await run_analyst_flow(
        storyteller_id=requirement.storyteller_id,
        trigger_reason="requirement_submission",
        requirement_id=requirement_id
    )

    return {
        "success": True,
        "requirement_id": requirement_id,
        "status": status
    }
```

**Database updates:**
```sql
UPDATE requirement
SET status = 'addressed',
    addressed_at = NOW(),
    result = '{"introduction_acknowledged": true, "user_response": "Yeah, that sounds great..."}',
    transcript_segment = '{"agent_utterance": "...", "user_utterance": "...", "timestamp": "...", "duration_seconds": 45}'
WHERE id = 'req-001';

UPDATE storyteller_progress
SET trust_setup_started = TRUE
WHERE storyteller_id = 'frank-123';
```

---

### **Analyst Flow Triggered (After Requirement Submission #1)**

**Trigger:** `requirement_submission` (requirement_id: `req-001`)

**Analyst runs ALL subflows again:**

#### **Subflow 1: Trust Building Workflow**

```python
async def run(self, storyteller_id: str):
    storyteller = await load_storyteller(storyteller_id)

    # GATE: Entry criteria
    if storyteller.current_phase not in [None, 'trust_building']:
        return {"executed": False, "reason": "phase_gate_not_met"}

    # Phase is 'trust_building' - proceed

    # Assess each element
    requirements_to_create = []

    # Element 1: Introduction - NOW COMPLETE
    if not storyteller.trust_setup_started:
        # (Would create requirement, but trust_setup_started is now TRUE)
        pass  # ✓ No requirement needed

    # Element 2: Scope Selection - STILL PENDING
    if not storyteller.scope_type:
        # Still no scope selected - requirement already exists (req-002)
        pass  # Requirement already exists, don't duplicate

    # Element 3: Gentle Profile - STILL PENDING
    # ... similar check ...

    # No NEW requirements to create (existing ones still pending)

    # Check if trust building complete
    if storyteller.trust_setup_started and storyteller.scope_type and profile_complete:
        # All complete - would transition phase
        pass
    else:
        # Still incomplete
        return {
            "executed": True,
            "complete": False,
            "pending_requirements": ["req-002", "req-003", "req-004"]
        }
```

**Result:** Trust Building recognizes progress but phase not complete yet.

#### **Subflows 2-8:** All gate early (same as before)

**Analyst determines next action:**
```python
{
    "action": "continue_session",  # Session still in progress
    "pending_requirements": ["req-002", "req-003", "req-004"]
}
```

---

### **VAPI Call Continues...**

> **Agent:** "Perfect! Now, which best describes what you want to capture? Your whole life story, one major chapter, a specific event, or not sure yet?"

**Frank:** "I think my whole life story. I'm 72, lived through a lot..."

**Agent calls tool:**
```python
await submit_requirement_result(
    requirement_id="req-002",
    status="addressed",
    result={
        "scope_type": "whole_life",
        "user_response": "I think my whole life story. I'm 72, lived through a lot..."
    },
    transcript_segment={
        "agent_utterance": "Which best describes what you want to capture?...",
        "user_utterance": "I think my whole life story. I'm 72, lived through a lot...",
        "timestamp": "2025-12-21T10:17:15Z",
        "duration_seconds": 28
    }
)
```

**Tool executes:**
```python
async def submit_requirement_result(...):
    # Update requirement
    await RequirementService.mark_addressed(requirement_id="req-002", ...)

    # Side effect: Update scope
    await StorytellerService.update(
        storyteller_id="frank-123",
        scope_type="whole_life"
    )

    # Side effect: Enable sections
    await SectionService.enable_sections_for_scope(
        storyteller_id="frank-123",
        scope_type="whole_life"
    )

    # TRIGGER ANALYST FLOW AGAIN
    await run_analyst_flow(
        storyteller_id="frank-123",
        trigger_reason="requirement_submission",
        requirement_id="req-002"
    )
```

**Database updates:**
```sql
UPDATE requirement SET status = 'addressed', ... WHERE id = 'req-002';

UPDATE storyteller_scope SET scope_type = 'whole_life' WHERE storyteller_id = 'frank-123';

INSERT INTO storyteller_section_status VALUES
('frank-123', 'Origins', 'unlocked', 0, 0.0),
('frank-123', 'Childhood', 'unlocked', 0, 0.0),
('frank-123', 'Teen Years', 'locked', 0, 0.0),  -- Unlocks after Childhood 80% complete
('frank-123', 'Early Adulthood', 'unlocked', 0, 0.0),
('frank-123', 'Work & Purpose', 'unlocked', 0, 0.0),
...;
```

---

### **Analyst Flow Triggered Again (After Requirement Submission #2)**

**Same pattern:**
1. Runs ALL subflows
2. Trust Building: Recognizes scope now complete, still waiting on profile elements
3. All other workflows: Gate early
4. Determines next action: Continue session

---

### **VAPI Call Continues Through All Requirements...**

Same pattern for `req-003` (life structure) and `req-004` (boundaries):
- Agent asks questions
- Frank responds
- Agent calls `submit_requirement_result()`
- Analyst Flow triggered after EACH submission
- Trust Building Workflow reassesses each time

---

### **After Final Requirement Submission (req-004)**

**VAPI Agent:**
```python
await submit_requirement_result(
    requirement_id="req-004",
    status="addressed",
    result={
        "comfortable_discussing_romance": True,
        "comfortable_discussing_loss": True,
        "use_real_names": True
    },
    transcript_segment={...}
)
```

**Tool executes:**
```python
# Update requirement
await RequirementService.mark_addressed(requirement_id="req-004", ...)

# Side effects: Set boundaries
await BoundaryService.set_boundaries(
    storyteller_id="frank-123",
    boundaries={
        "comfortable_discussing_romance": True,
        "comfortable_discussing_loss": True,
        "use_real_names": True
    }
)

# Side effects: Unlock conditional sections
await SectionService.unlock_conditional_sections(
    storyteller_id="frank-123",
    conditions={"comfortable_discussing_loss": True}
)
# Unlocks: "Parenthood", "Love & Partnership", "Caregiving/Illness/Loss"

# TRIGGER ANALYST FLOW
await run_analyst_flow(
    storyteller_id="frank-123",
    trigger_reason="requirement_submission",
    requirement_id="req-004"
)
```

---

### **Analyst Flow Triggered (Final Trust Building Assessment)**

#### **Subflow 1: Trust Building Workflow**

```python
async def run(self, storyteller_id: str):
    storyteller = await load_storyteller(storyteller_id)

    # GATE: Phase check
    if storyteller.current_phase != 'trust_building':
        return {"executed": False, "reason": "phase_gate_not_met"}

    # Assess all elements
    introduction_complete = storyteller.trust_setup_started  # ✓ TRUE
    scope_complete = storyteller.scope_type is not None  # ✓ TRUE ("whole_life")
    profile_complete = await check_profile_complete(storyteller_id)  # ✓ TRUE

    if introduction_complete and scope_complete and profile_complete:
        # ALL TRUST BUILDING REQUIREMENTS MET!
        await StorytellerService.update_progress(
            storyteller_id=storyteller_id,
            trust_setup_complete=True,
            current_phase='history_building'  # Transition phase
        )

        return {
            "executed": True,
            "complete": True,
            "next_phase": "history_building"
        }
```

**Result:**
```python
{
    "executed": True,
    "complete": True,
    "next_phase": "history_building"
}
```

**Database:**
```sql
UPDATE storyteller_progress
SET trust_setup_complete = TRUE,
    current_phase = 'history_building'
WHERE storyteller_id = 'frank-123';
```

---

#### **Subflow 2: Contextual Grounding Workflow (NOW Executes!)**

```python
async def run(self, storyteller_id: str):
    storyteller = await load_storyteller(storyteller_id)

    # GATE: Entry criteria
    if storyteller.current_phase != 'history_building':
        return {"executed": False, "reason": "phase_gate_not_met"}

    # Phase is NOW 'history_building' - proceed!

    # Assess contextual grounding requirements based on scope
    scope_type = storyteller.scope_type  # "whole_life"

    if scope_type == "whole_life":
        required_anchors = [
            "birth_year",
            "childhood_location",
            "major_moves",
            "work_phases",
            "relationship_anchors",  # optional
            "children_birth_years"  # optional
        ]

    # Check which anchors are missing
    existing_anchors = await LifeEventService.get_contextual_anchors(storyteller_id)
    missing_anchors = [a for a in required_anchors if a not in existing_anchors]

    # Create requirements for missing anchors
    for anchor in missing_anchors:
        await RequirementService.create(
            storyteller_id=storyteller_id,
            requirement_type="contextual_anchor",
            priority="critical" if anchor in ["birth_year", "childhood_location"] else "important",
            requirement_description=f"Gather {anchor} for timeline scaffold",
            suggested_prompts=get_prompts_for_anchor(anchor),
            metadata={"grounding_element": anchor}
        )

    return {
        "executed": True,
        "complete": False,
        "requirements_created": len(missing_anchors)
    }
```

**Result:**
```python
{
    "executed": True,
    "complete": False,
    "requirements_created": 6  # All anchors needed
}
```

**Database:**
```sql
INSERT INTO requirement VALUES
('req-005', 'frank-123', 'contextual_anchor', 'critical', 'Gather birth_year...', 'pending', ...),
('req-006', 'frank-123', 'contextual_anchor', 'critical', 'Gather childhood_location...', 'pending', ...),
('req-007', 'frank-123', 'contextual_anchor', 'important', 'Gather major_moves...', 'pending', ...),
...;
```

---

#### **Subflows 3-8:** Gate early (Frank still not in story_capture phase, etc.)

**Analyst determines next action:**
```python
{
    "action": "schedule_session",  # New session needed for contextual grounding
    "session_type": "contextual_grounding",
    "requirements": ["req-005", "req-006", "req-007", "req-008", "req-009", "req-010"]
}
```

---

## Summary of Execution Pattern

### **Key Flow:**

```
1. Analyst Flow triggered (any reason)
   ↓
2. Runs ALL subflows sequentially
   - Trust Building → assesses, creates/resolves requirements
   - Contextual Grounding → gates on phase, creates requirements if in history_building
   - Section Selection → gates on contextual_grounding_complete
   - Lane Development → gates on sections_selected
   - Archetype Assessment → gates on session_count >= 4 AND session_count % 3 == 0
   - Synthesis → gates on sufficient_material_in_section
   - Composition → gates on all_sufficiency_gates_passed
   - Editor → gates on story_exists AND chapters_created
   ↓
3. Each subflow:
   - Checks entry criteria (gates)
   - Returns early if gate not met
   - If gate met: Assesses state, creates/resolves requirements
   - Returns execution result
   ↓
4. Analyst determines next action based on state after all subflows
   - If pending requirements exist → schedule/continue session
   - If no pending requirements + not complete → review needed
   - If complete → transition to next phase or export
   ↓
5. Session Flow executes (if scheduled)
   ↓
6. VAPI agent addresses requirements during call
   ↓
7. VAPI agent calls submit_requirement_result() for each requirement
   ↓
8. submit_requirement_result() triggers Analyst Flow (REAL-TIME)
   ↓
   [Loop back to step 1 - Analyst runs ALL subflows again]
```

---

## Subflow Gating Criteria Reference

| Subflow | Entry Criteria (Gate) | Creates Requirements For | Transitions To |
|---------|----------------------|-------------------------|----------------|
| **Trust Building** | `current_phase IN [NULL, 'trust_building']` | Introduction, Scope Selection, Gentle Profile | `history_building` |
| **Contextual Grounding** | `current_phase == 'history_building'` | Timeline anchors (birth year, locations, moves, work, relationships) | `history_building` (same phase) |
| **Section Selection** | `current_phase == 'history_building' AND contextual_grounding_complete == TRUE` | Section selection prompt | `story_capture` |
| **Lane Development** | `current_phase == 'story_capture' AND sections_selected == TRUE` | Scene details, character insights, emotional context, thematic exploration | `story_capture` (same phase) |
| **Archetype Assessment** | `current_phase == 'story_capture' AND session_count >= 4 AND session_count % 3 == 0` | Discriminating/validating/strengthening requirements (archetype-driven) | `story_capture` (same phase) |
| **Synthesis** | `current_phase == 'story_capture' AND any_section_has_sufficient_material` | Provisional draft assembly | `story_capture` (same phase) |
| **Composition** | `all_sufficiency_gates_passed` (archetype resolved ≥0.85, material threshold, character dev, thematic coherence) | Initial chapter composition, character development, theme weaving | `composition` |
| **Editor** | `story_exists AND chapters_created` | Edit requirements (pacing, coherence, sensory detail, theme integration) | `composition` (iterative) or `export` (if approved) |

---

## Requirement Submission Payload Schema

```python
class RequirementSubmission(BaseModel):
    requirement_id: str
    status: Literal["addressed", "partially_addressed", "skipped"]
    result: dict  # Structured data extracted from user response
    transcript_segment: TranscriptSegment

class TranscriptSegment(BaseModel):
    agent_utterance: str  # What the agent said
    user_utterance: str  # What the user said
    timestamp: datetime  # When this exchange occurred
    duration_seconds: int  # Duration of this exchange
    metadata: Optional[dict] = None  # Additional context (e.g., sentiment, emotion detected)
```

**Example:**
```json
{
  "requirement_id": "req-002",
  "status": "addressed",
  "result": {
    "scope_type": "whole_life",
    "user_response": "I think my whole life story. I'm 72, lived through a lot, and I want my grandkids to know it all."
  },
  "transcript_segment": {
    "agent_utterance": "Which best describes what you want to capture? Your whole life story, one major chapter of your life, a specific life event, or are you not sure yet?",
    "user_utterance": "I think my whole life story. I'm 72, lived through a lot, and I want my grandkids to know it all.",
    "timestamp": "2025-12-21T10:17:15Z",
    "duration_seconds": 28,
    "metadata": {
      "sentiment": "positive",
      "confidence": 0.92
    }
  }
}
```

---

## Benefits of This Architecture

### **1. Deterministic & Predictable**
- Analyst always runs the same sequence of subflows
- No complex decision trees about which subflow to run
- State changes are driven by gates, not Analyst logic

### **2. Real-Time Responsive**
- Analyst runs after EVERY requirement submission
- Immediate response to user progress
- No waiting until end of session to reassess

### **3. Modular & Self-Contained**
- Each subflow owns its gating logic
- Easy to add new subflows (just add to Analyst sequence)
- Subflows can be tested independently with different state fixtures

### **4. Transparent & Auditable**
- Every requirement submission includes transcript
- Full audit trail of what was asked, what was answered
- Easy to trace why a requirement was created/resolved

### **5. Flexible & Extensible**
- New gates can be added to subflows without touching Analyst
- New requirement types can be added without changing core flow
- New subflows slot into the sequence naturally

---

## Implementation Checklist

- [ ] **Analyst Flow:**
  - [ ] Always runs ALL subflows (no selective execution)
  - [ ] Triggered after every `submit_requirement_result()` call
  - [ ] Triggered after session completion
  - [ ] Triggered on storyteller initialization

- [ ] **All Subflows:**
  - [ ] Implement entry criteria gates (return early if not met)
  - [ ] Assessment logic (check state, identify missing elements)
  - [ ] Requirement creation logic
  - [ ] Completion detection (when to transition phase)

- [ ] **submit_requirement_result Tool:**
  - [ ] Accepts `transcript_segment` in payload
  - [ ] Updates requirement status
  - [ ] Applies side effects (update storyteller, unlock sections, etc.)
  - [ ] Triggers Analyst Flow immediately

- [ ] **Session Flow:**
  - [ ] Fetches pending requirements
  - [ ] Builds VAPI agent with requirements-driven system prompt
  - [ ] VAPI agent calls `submit_requirement_result()` during session

- [ ] **Database Schema:**
  - [ ] `requirement.transcript_segment` JSONB field
  - [ ] Indexes on `requirement(storyteller_id, status)`
  - [ ] Indexes on phase fields in `storyteller_progress`

---

**END OF DOCUMENT**
