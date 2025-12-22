# Flow Architecture: Orchestration & Execution

## Overview

This document defines the **flow architecture** for the Everbound system. Flows are agentic orchestration nodes that assess state, determine next actions, and execute specialized processes. They interact with each other through **Requirements Tables** and state transitions.

**Core Principle**: Analyst runs ALL subflows → Subflows self-gate → Requirements lodged → Session addresses requirements → Analyst re-runs ALL subflows → Loop.

**Key Architectural Decisions**:
1. **Analyst ALWAYS runs ALL subflows** - No selective execution, each subflow self-gates based on entry criteria
2. **Analyst runs after EVERY requirement submission** - Real-time response during sessions, not batch processing
3. **Requirement submissions include transcript** - Full audit trail of what was asked and answered
4. **Subflows are assessment engines** - They create/resolve requirements, not interactive sessions

For detailed execution pattern with examples, see [analyst_subflow_execution_pattern.md](../project_docs/analyst_subflow_execution_pattern.md).

---

## Canonical Process Mapping

From [process.txt](../source_docs/process.txt):

```
Trust → Scope → Context → Capture → Synthesis → Verification → Book
```

This translates to:

```
Analyst Flow triggered
    ↓
Runs ALL subflows (each self-gates):
    - Trust Building (gates on phase = trust_building)
    - Contextual Grounding (gates on phase = history_building)
    - Section Selection (gates on contextual_grounding_complete)
    - Lane Development (gates on sections_selected)
    - Archetype Assessment (gates on session_count >= 4 AND session_count % 3 == 0)
    - Synthesis (gates on sufficient_material)
    - Composition (gates on all_sufficiency_gates_passed)
    - Editor (gates on story_exists)
    ↓
Each subflow that passes gate:
    - Assesses state
    - Creates/resolves requirements
    - Returns execution result
    ↓
Analyst determines next action based on state after all subflows
    ↓
Session Flow addresses requirements (if pending)
    ↓
During session: VAPI agent calls submit_requirement_result() for each requirement
    ↓
Each requirement submission triggers Analyst Flow (real-time)
    ↓
[Loop continues until composition complete → Editor approves → Export]
```

---

## Primary Flows (Orchestrators)

### 1. ANALYST FLOW

**Node Type**: `analyst_orchestrator`

**Purpose**: Continuous orchestration of all subflows to assess storyteller state and determine next actions. The "brain" of the system that runs ALL subflows on every invocation, allowing each to self-gate and create/resolve requirements.

**CRITICAL**: Analyst does NOT selectively choose which subflow to run. It ALWAYS runs ALL subflows sequentially. Each subflow checks its own entry criteria (gates) and returns early if not met.

**Triggers** (Real-Time):
- **After EVERY requirement submission during a session** (via `submit_requirement_result()` tool)
- After session completion
- On new storyteller initialization
- When user requests next steps
- Periodically (e.g., after 7 days of inactivity)

**Inputs**:
- Storyteller ID
- Trigger reason (`requirement_submission`, `session_complete`, `initialization`, etc.)
- Requirement ID (if triggered by requirement submission)
- Current progress state (`storyteller_progress`)
- All life events
- All session artifacts
- Current requirements table
- Scope type

**Execution Pattern**:
```python
async def run_analyst_flow(storyteller_id: str, trigger_reason: str):
    """
    Analyst Flow ALWAYS runs ALL subflows.
    Each subflow self-gates based on entry criteria.
    """
    storyteller = await load_storyteller(storyteller_id)

    # Run ALL subflows (in order)
    results = []
    results.append(await TrustBuildingWorkflow.run(storyteller_id))
    results.append(await ContextualGroundingWorkflow.run(storyteller_id))
    results.append(await SectionSelectionWorkflow.run(storyteller_id))
    results.append(await LaneDevelopmentWorkflow.run(storyteller_id))
    results.append(await ArchetypeAssessmentWorkflow.run(storyteller_id))
    results.append(await SynthesisWorkflow.run(storyteller_id))
    results.append(await CompositionWorkflow.run(storyteller_id))
    results.append(await EditorWorkflow.run(storyteller_id))

    # Determine next action based on state after all subflows run
    next_action = await determine_next_action(storyteller_id, results)
    return next_action
```

**Responsibilities**:
1. **Trigger All Subflows**: Execute all subflows on every run (no selective execution)
2. **Aggregate Results**: Collect results from all subflow executions
3. **Next Action Determination**: Based on state after all subflows, determine what happens next
4. **State Consistency**: Ensure storyteller state is coherent after all subflows complete

**Subflow Execution Results**:
Each subflow returns one of:
- `{"executed": False, "reason": "gate_not_met"}` - Subflow gated early
- `{"executed": True, "complete": False, "requirements_created": N}` - Subflow ran, created requirements
- `{"executed": True, "complete": True, "next_phase": "..."}` - Subflow complete, phase transition

**Next Action Determination Logic**:
```python
async def determine_next_action(storyteller_id: str, subflow_results: list):
    """
    After all subflows have run, determine what happens next based on state.
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
        # In composition phase with no pending requirements
        story = await StoryService.get_active_story(storyteller_id)
        if story and story.status == "ready_for_export":
            return {
                "action": "export_story",
                "story_id": story.id
            }
        else:
            # Editor/Composition may be in progress
            return {
                "action": "wait",
                "reason": "composition_in_progress"
            }

    else:
        # No pending requirements, not in composition
        # May indicate completion of current phase or stuck state
        return {
            "action": "review_needed",
            "reason": "no_pending_requirements_but_not_complete",
            "current_phase": storyteller.current_phase
        }
```

**Archetype-Aware Requirement Lodging**:

The **Archetype Assessment Workflow** (when it passes gate and executes) lodges strategic requirements based on refinement status. These requirements help clarify which archetype pattern is most apt.

Note: This happens WITHIN the ArchetypeAssessmentWorkflow subflow, not directly in Analyst Flow. Analyst simply runs the subflow; the subflow creates the requirements.

```python
def lodge_discriminating_requirements(candidate_archetypes):
    """
    EXPLORING phase (3+ viable candidates): Lodge requirements that discriminate between archetypes.
    Focus on pivotal events that could reveal which pattern is dominant.
    """
    top_two = get_top_candidates(candidate_archetypes, limit=2)

    # Identify pivotal events that could discriminate
    for life_event in get_pivotal_events(storyteller_id):
        IF event not fully explored:
            create_requirement(
                requirement_type='emotional_context',
                priority='critical',
                archetype_lane='discriminating',
                archetype_refinement_purpose='discriminate',
                discriminates_between=[top_two[0]['archetype'], top_two[1]['archetype']],
                requirement_description=f"Need to understand {event.name} - does this show {top_two[0]['archetype']} OR {top_two[1]['archetype']}?",
                suggested_prompts=generate_discriminating_prompts(event, top_two),
                expected_archetype_outcomes={
                    f"if_{top_two[0]['archetype']}_dominant": describe_expected_pattern(top_two[0]),
                    f"if_{top_two[1]['archetype']}_dominant": describe_expected_pattern(top_two[1])
                }
            )

def lodge_validating_requirements(candidate_archetypes):
    """
    NARROWING phase (2 strong contenders): Lodge requirements that validate whether a candidate is truly present.
    Focus on evidence that would strengthen or weaken each candidate.
    """
    for candidate in candidate_archetypes WHERE confidence > 0.60:
        # Find gaps in evidence for this candidate
        evidence_gaps = identify_evidence_gaps(candidate['archetype'])

        for gap in evidence_gaps:
            create_requirement(
                requirement_type='thematic_exploration',
                priority='important',
                archetype_lane=candidate['archetype'],
                archetype_refinement_purpose='validate',
                discriminates_between=[c['archetype'] for c in candidate_archetypes],
                requirement_description=f"Need more evidence for {candidate['archetype']} - currently missing {gap}",
                suggested_prompts=generate_validating_prompts(gap, candidate['archetype'])
            )

def lodge_strengthening_requirements(dominant_archetype):
    """
    RESOLVED phase (1 dominant archetype >= 0.85 confidence): Lodge requirements that deepen the archetype.
    Focus on adding richness and dimension to the already-identified pattern.
    """
    # Identify archetype dimensions that are underdeveloped
    dimensions = assess_archetype_dimensions(dominant_archetype, storyteller_id)

    for dimension in dimensions WHERE strength < 0.75:
        create_requirement(
            requirement_type='scene_detail',
            priority='optional',
            archetype_lane=dominant_archetype,
            archetype_refinement_purpose='strengthen',
            requirement_description=f"Deepen {dimension} in {dominant_archetype} pattern",
            suggested_prompts=generate_strengthening_prompts(dimension, dominant_archetype)
        )
```

**Key Principles**:
- **Exploring** → Discriminate: "Is this loss OR agency OR transformation?"
- **Narrowing** → Validate: "Do we have enough evidence that loss is truly the pattern?"
- **Resolved** → Strengthen: "Let's deepen the loss pattern with more sensory/emotional detail"

**Outputs**:
- Updated `storyteller_progress`
- Updated/created `requirement` records
- Updated `storyteller_section_status` (unlock new sections)
- Next subflow instruction
- Session preparation context

**Success Criteria**:
- Phase accurately assessed
- Requirements clearly defined with priority
- Next subflow deterministically selected
- No storyteller left in ambiguous state

---

### 2. SESSION FLOW

**Node Type**: `session_orchestrator`

**Purpose**: Execute a goal-oriented story capture session with the storyteller. Handles pre-call preparation, call execution (via VAPI), post-call processing, and user verification.

**Triggers**:
- Scheduled session task reaches scheduled time
- User manually initiates session
- System-initiated follow-up (e.g., after incomplete session)

**Inputs**:
- Session task ID
- Storyteller ID
- Subflow type (from Analyst Flow)
- Requirements table (filtered to current session focus)
- User context (boundaries, scope, prior sessions)

**Responsibilities**:
1. **Pre-Call Preparation**: Load context, determine prompts, create VAPI agent
2. **Call Execution**: VAPI conducts interview with dynamic agent
3. **Post-Call Processing**: Organize transcript, extract story points, tag metadata
4. **Quality Validation**: Check session quality before finalizing
5. **User Verification**: Send session summary for user review/approval
6. **Progress Update**: Update storyteller state and section completion
7. **Trigger Analyst**: Kick off Analyst Flow to determine next steps

**Phases** (Sequential):

#### Phase 1: Pre-Call Preparation
```python
# Subnode: prepare_session
1. Load storyteller state
   - Current phase, scope, boundaries, preferences
   - Completed sections, session count
   - Last session summary

2. Determine session goal (based on subflow type)
   - IF subflow = "trust_building"
       goal = trust_setup | scope_selection | profile
   - IF subflow = "contextual_grounding"
       goal = timeline_building
   - IF subflow = "lane_development"
       goal = {section: "Childhood", focus: "specific_memories"}

3. Load relevant requirements from Requirements Table
   - Filter by: section, priority (critical first)
   - Transform into conversational prompts

4. Pre-load story context
   - Semantic search on prior story points
   - Named entities (people, places, time periods)

5. Generate phase-specific prompts
   - Use prompt pack templates (Scene → People → Tension → Change → Meaning)
   - Personalize based on boundaries and scope

6. Create VAPI agent configuration
   - System prompt with context
   - Tools: submit_requirement_result, GetStoryPointContext, SaveStorySegment, ScheduleNextSession
   - **CRITICAL**: submit_requirement_result tool triggers Analyst Flow after EACH requirement submission (real-time)

7. Create session record in database
   - Status: "scheduled"
   - Store session goal, agent config

OUTPUT: agent_config, session_id
```

#### Phase 2: Call Execution
```python
# Subnode: execute_call (VAPI-managed)
1. VAPI initiates outbound call (or waits for inbound)

2. Agent conducts interview
   - Follows session goal and prompts
   - Calls GetStoryPointContext as needed (dynamic retrieval)
   - Calls SaveStorySegment to persist key moments in real-time
   - **Calls submit_requirement_result() for each requirement addressed**
     - Includes structured result data + transcript segment
     - Triggers Analyst Flow immediately (real-time response)
     - Analyst re-runs ALL subflows to reassess state

3. Real-time transcript streaming (webhook)
   - Backend receives transcript chunks
   - Privacy classification (tier 1/2/3)
   - Checkpoint every 2 minutes

4. Call end
   - Agent asks about next session timing (ScheduleNextSession)
   - VAPI sends end_call_report to backend

5. Recovery mechanism
   - If no end_call_report after 20 minutes
   - Background monitor fetches transcript from VAPI
   - Send to user for review

OUTPUT: call_report (transcript, recording_url, metadata)
```

#### Phase 3: Quality Validation
```python
# Subnode: validate_session_quality
1. Check transcript completeness
   - Duration >= 5 minutes
   - Transcription confidence >= 0.8

2. Check user engagement
   - User word count >= 200 words
   - Multiple exchanges (not one-sided)

3. Sentiment analysis
   - Detect distress signals
   - Check for discomfort or premature ending

4. Completion markers
   - Agent said goodbye
   - Call ended naturally (not dropped)

IF quality_issues_detected:
    - Notify admin
    - Send user apology + reschedule offer
    - Mark session as "needs_review"
    - HALT further processing
    RETURN failure
ELSE:
    - Mark session as "quality_verified"
    CONTINUE to processing

OUTPUT: quality_report, proceed_flag
```

#### Phase 4: Post-Call Processing
```python
# Subnode: process_session_content
1. Persist full transcript (encrypted)
   - Save to session_interaction table
   - Link to session record

2. Organize transcript into story points
   - Extract key moments, facts, emotions
   - Tag with metadata:
     - People mentioned (life_event_participant)
     - Places mentioned (life_event_location)
     - Time periods (life_event_timespan)
     - Emotions (joy, grief, fear, etc.)
     - Themes (loss, resilience, transformation)

3. Create/update life events
   - Map story points to life_event records
   - Create new events if needed
   - Update existing events with new details

4. Create session artifacts
   - Type: "scene_capture", "timeline_entry", "character_insight"
   - Link to story points

5. Update storyteller context summary
   - Semantic embedding of session content
   - Update named entity index

6. Update section progress
   - storyteller_section_status.prompts_answered += N
   - Calculate completion_percentage
   - IF completion >= threshold: mark section as "completed"

OUTPUT: story_points[], life_events[], session_artifacts[]
```

#### Phase 5: User Verification
```python
# Subnode: send_verification_request
1. Generate session summary
   - Narrative summary of what was discussed
   - List of key moments captured
   - List of people/places/times mentioned

2. Send to user (webapp + email)
   - Transcript with timestamps
   - Audio playback link
   - Extracted story points (editable)
   - Approve / Request Changes / Redo buttons

3. Wait for user response
   - Timeout: 7 days (then auto-approve with notification)

4. Process user feedback
   - IF approved: finalize session
   - IF changes requested: update story points
   - IF redo: mark session as "superseded", schedule new session

OUTPUT: verification_status, updated_story_points[]
```

#### Phase 6: Trigger Next Steps
```python
# Subnode: finalize_and_trigger_analyst
1. Update storyteller progress
   - Increment session count
   - Update last_active_at
   - Update overall_completion_percentage

2. Mark requirements as addressed
   - Update Requirements Table
   - Set status: "pending" → "addressed"

3. Trigger Analyst Flow (async)
   - Pass session_id, storyteller_id
   - Analyst reassesses state and determines next actions

4. Offer next session scheduling (if not handled by agent)
   - SMS/email with scheduling link
   - User can schedule via webapp or SMS reply

OUTPUT: trigger_analyst_flow, send_scheduling_offer
```

**Outputs**:
- Updated `session` record (status: "completed")
- New `session_interaction` records (transcript)
- New `session_artifact` records (story points, scenes, etc.)
- New/updated `life_event` records
- Updated `storyteller_progress`
- Updated `storyteller_section_status`
- Analyst Flow triggered

**Success Criteria**:
- Session completed with quality transcript
- Story points extracted and verified by user
- Storyteller state updated
- Analyst Flow triggered for next steps

---

### 3. EDITOR FLOW

**Node Type**: `editor_orchestrator`

**Purpose**: Review composed narrative material for quality, coherence, and craft. Operates once storyteller has transitioned to composition phase (sufficiency gates passed).

**Triggers**:
- Analyst Flow determines storyteller ready for composition (sufficient material)
- After composition subflow creates chapter drafts
- User requests review of specific chapter
- Periodically during composition phase (every 3 chapters)

**Inputs**:
- Storyteller ID
- Story ID
- Story chapters (composed)
- Collections (source material)
- Current archetype

**Responsibilities**:
1. **Narrative Quality Review**: Assess chapters for craft standards
2. **Coherence Check**: Ensure consistency across chapters (character arcs, timeline, themes)
3. **Pacing Analysis**: Evaluate scene-to-summary ratio, chapter rhythm
4. **Character Consistency**: Track character development and voice
5. **Thematic Clarity**: Ensure themes are woven throughout
6. **Edit Requirements Lodging**: Lodge issues in Edit Requirements Table
7. **Approval Gating**: Approve material for finalization or block for revisions

**Assessment Criteria** (per chapter):
```
1. Narrative Coherence (0-10)
   - Do scenes flow logically?
   - Are transitions smooth?
   - Is chronology clear?

2. Pacing (0-10)
   - Scene-to-summary ratio (target: 70-80% scene)
   - Balance of action, reflection, summary
   - Chapter length appropriate

3. Character Consistency (0-10)
   - Character voice consistent
   - Actions align with established traits
   - Relationships tracked accurately

4. Sensory Details (0-10)
   - Visual, auditory, tactile, olfactory details present
   - Showing vs. telling ratio
   - Immersive scene construction

5. Thematic Integration (0-10)
   - Themes present and clear
   - Motifs/symbols used effectively
   - Thematic arc progressing

6. Emotional Resonance (0-10)
   - Reflection vs. raw emotion balanced
   - Opening hook strong
   - Closing resonance present
```

**Decision Tree**:
```
FOR each chapter in story:
    scores = assess_chapter(chapter)

    IF any_score < 6 (blocking issue):
        lodge_edit_requirement(
            chapter_id=chapter.id,
            issue_type=identify_issue(scores),
            severity="blocking",
            specific_concern=generate_concern_description(scores),
            suggested_approach=generate_suggestion(scores)
        )
        chapter.status = "needs_revision"

    ELSE IF any_score < 8 (important issue):
        lodge_edit_requirement(
            chapter_id=chapter.id,
            severity="important",
            ...
        )
        chapter.status = "needs_polish"

    ELSE:
        chapter.status = "approved"

# Overall story assessment
IF all_chapters_approved:
    story.status = "ready_for_export"
    RETURN next_flow: "book_export"
ELSE:
    RETURN next_subflow: "composition" (address edit requirements)
```

**Outputs**:
- Updated `story_chapter` records (status, scores)
- New `edit_requirement` records (Edit Requirements Table)
- Overall story quality report
- Next subflow instruction (composition or export)

**Success Criteria**:
- All chapters assessed with detailed scores
- Edit requirements clearly defined with suggested approaches
- Blocking issues prevent progression
- Approved chapters locked for export

---

## Subflows (Executed by Primary Flows)

Subflows are specialized execution nodes called by primary flows. They have narrow scope and clear success criteria.

---

### SUBFLOW 1: Trust Building

**Node Type**: `trust_building_subflow`

**Purpose**: Execute Phase 1-3 of canonical process (Introduction & Trust Setup, Scope Selection, Gentle Profile). Establish psychological safety and gather essential context.

**Parent Flow**: Session Flow

**Triggers**: Analyst Flow determines storyteller in trust building phase

**Inputs**:
- Storyteller ID
- Current trust building step (introduction | scope | profile)

**Execution Steps**:

#### Step 1: Introduction & Trust Setup
```
Goal: Reduce anxiety, set expectations

Prompts:
- "We'll build an outline first, not the book."
- "You can skip anything."
- "You decide how much of your life we focus on."
- "Nothing is locked in."

Artifacts Created:
- storyteller_progress.current_phase = "trust_building"
- storyteller_progress.trust_setup_complete = true

Success Criteria:
- User acknowledges and expresses willingness to proceed
```

#### Step 2: Scope Selection
```
Goal: Determine focus (whole_life | major_chapter | single_event | unsure)

Prompts (checkbox):
- ☐ My whole life story
- ☐ One major chapter of my life
- ☐ A specific life event or period
- ☐ I'm not sure yet (help me choose)

Artifacts Created:
- storyteller_scope.scope_type = [selected_type]
- Sections enabled based on scope (via scope_type.enabled_sections)
- storyteller_section_status initialized (some locked, some unlocked)

Success Criteria:
- Scope selected and persisted
- Sections appropriately unlocked
```

#### Step 3: Gentle Profile
```
Goal: Gather boundaries and life structure (checkbox only, no essays)

Domains:
- Life structure (relationships, children, careers, moves, military, faith)
- Comfort boundaries (romance, loss/trauma, privacy)

Artifacts Created:
- storyteller_boundary populated (comfortable_discussing_romance, etc.)
- storyteller_preference populated (book_type, working_style)
- Additional sections unlocked based on profile (e.g., "Love & Partnership" if relationship)

Success Criteria:
- Boundaries set (used to filter prompts)
- Life structure captured (guides section unlocking)
- User feels safe and informed
```

**Outputs**:
- Updated `storyteller_progress` (trust_setup_complete = true)
- Updated `storyteller_boundary`
- Updated `storyteller_preference`
- Updated `storyteller_scope`
- Updated `storyteller_section_status` (sections unlocked)

**Success Criteria**:
- All three steps completed
- Storyteller ready to transition to history building phase
- Analyst Flow triggered to reassess and move to next phase

---

### SUBFLOW 2: Contextual Grounding

**Node Type**: `contextual_grounding_subflow`

**Purpose**: Execute Phase 4 of canonical process (Facts Before Story). Build chronological scaffold to enable memory retrieval.

**Parent Flow**: Session Flow

**Triggers**: Analyst Flow determines need for timeline/factual context (history building phase)

**Inputs**:
- Storyteller ID
- Scope type (determines depth of grounding)

**Execution Steps**:

#### Scope-Dependent Factual Capture
```
IF scope = "whole_life":
    Factual prompts:
    - Birth year (or approximate)
    - Where you grew up
    - Schools attended (optional)
    - Major moves (cities only)
    - Work phases
    - Relationship anchors (optional)
    - Children birth years (optional)

ELSE IF scope = "major_chapter":
    Factual prompts:
    - When this chapter began/ended
    - Where you were living
    - Primary roles at the time

ELSE IF scope = "single_event":
    Factual prompts:
    - What immediately preceded the event
    - Who was involved
    - Where you were in life at the start
```

**Artifacts Created**:
```
For each factual prompt response:
    1. Create or update life_event
       - event_type: "contextual_anchor"
       - event_name: e.g., "Growing up in Boston"

    2. Create life_event_timespan
       - start_date, end_date (or approx)

    3. Create life_event_location
       - city, state, country

    4. Create life_event_participant (if people mentioned)
       - participant_name, relationship

    5. Create life_event_detail (flexible key-value)
       - "school": "Boston Latin", "job": "Teacher"
```

**Outputs**:
- Multiple `life_event` records (contextual anchors)
- Multiple `life_event_timespan` records (timeline scaffold)
- Multiple `life_event_location` records (places)
- Multiple `life_event_participant` records (people)
- Updated `storyteller_progress` (contextual_grounding_complete = true)

**Success Criteria**:
- Chronological scaffold established
- Key time/place/role cues captured
- Storyteller ready for section selection and deep story capture
- Analyst Flow triggered to transition to story capture phase

---

### SUBFLOW 3: Section Selection

**Node Type**: `section_selection_subflow`

**Purpose**: Execute Phase 5 of canonical process (Narrative Lanes). Allow storyteller to choose which sections of life to explore.

**Parent Flow**: Session Flow

**Triggers**: Analyst Flow after contextual grounding complete

**Inputs**:
- Storyteller ID
- Enabled sections (from scope and profile)

**Execution Steps**:

#### Present Available Sections
```
Core sections (always enabled):
- Origins (if whole life)
- Childhood
- Teen Years
- Early Adulthood
- Work & Purpose
- Values & Beliefs
- Milestones & Turning Points
- Lessons & Legacy

Conditional sections (enabled by profile):
- Love & Partnership (if has_relationships = true)
- Parenthood (if has_children = true)
- Service & Sacrifice (if military_service = true)
- Major Adventures
- Caregiving / Illness / Loss (if comfortable_discussing_loss = true)

User selects:
- Checkboxes for each section
- Can select all or subset
- "I'm not sure" triggers recommendation based on scope
```

**Artifacts Created**:
```
For each selected section:
    storyteller_section_selection created
    storyteller_section_status updated:
        - status: "unlocked" (if prerequisites met)
        - status: "locked" (if dependent on another section)
```

**Outputs**:
- Multiple `storyteller_section_selection` records
- Updated `storyteller_section_status` (unlocked selected sections)
- Progressive unlocking logic initialized (later sections locked until earlier ones complete)

**Success Criteria**:
- User has selected sections (narrative lanes)
- Sections appropriately locked/unlocked based on prerequisites
- Analyst Flow triggered to start lane development

---

### SUBFLOW 4: Lane Development

**Node Type**: `lane_development_subflow`

**Purpose**: Execute Phase 6 of canonical process (Guided Story Capture - The Engine). Capture rich, scene-based material for a specific narrative lane.

**Parent Flow**: Session Flow

**Triggers**: Analyst Flow selects a specific section/lane to develop (highest priority incomplete section)

**Inputs**:
- Storyteller ID
- Section/lane name (e.g., "Childhood")
- Requirements from Requirements Table (specific to this lane)

**Execution Steps**:

#### Apply Prompt Pack Template
```
From process.txt Phase 6:
1. Scene – "Take me to a specific moment…"
2. People – "Who was there? What were they like?"
3. Tension – "What was uncertain, hard, or unresolved?"
4. Change – "Did anything shift for you?" (optional)
5. Meaning – "Looking back, what do you notice now?" (tri-valent)

Guardrails:
- Short answers encouraged
- Voice optional (can type or speak)
- Users may skip any prompt
- Before deepening: consent check ("Want to zoom in, or stay broad?")
```

#### Respect Boundaries
```
Before each prompt:
    1. Check storyteller_boundary
    2. Check life_event_boundary (if event-specific)
    3. Check process_prompt.sensitivity_tier

IF prompt involves trauma/loss AND comfortable_discussing_trauma = false:
    - Skip prompt OR
    - Offer gentler version OR
    - Ask permission first ("This might touch on difficult topics. Want to continue?")
```

#### Extract Scene-Based Material
```
For each response:
    1. Identify if scene (showing) or summary (telling)
    2. Extract sensory details (visual, auditory, tactile, olfactory, taste)
    3. Extract emotions (joy, fear, grief, anger, confusion)
    4. Extract people, places, time markers
    5. Extract tension/conflict (what was at stake)
    6. Extract change/transformation (what shifted)
    7. Extract reflection/meaning (looking back)

Create session_artifact:
    - artifact_type: "scene_capture" (if showing) or "summary_capture" (if telling)
    - content: full text of response
    - metadata: {sensory_details, emotions, people, places, tension, change, reflection}
    - linked to life_event (create or update)
```

#### Track Lane Progress
```
After each prompt answered:
    storyteller_section_status.prompts_answered += 1
    storyteller_section_status.completion_percentage = (prompts_answered / total_prompts) * 100

IF completion_percentage >= 80:
    storyteller_section_status.status = "completed"

    # Check for dependent sections to unlock
    dependent_sections = process_section.WHERE unlock_after_section_id = current_section.id
    FOR section IN dependent_sections:
        storyteller_section_status.status = "unlocked"
```

**Outputs**:
- Multiple `session_artifact` records (scene captures)
- New/updated `life_event` records (with rich detail)
- Updated `storyteller_section_status` (progress tracked)
- Potentially unlocked new sections (if prerequisites met)

**Success Criteria**:
- Rich, scene-based material captured (70%+ showing vs. telling)
- Section progress tracked and updated
- Dependent sections unlocked if appropriate
- Requirements addressed (marked in Requirements Table)
- Analyst Flow triggered to determine next lane or phase transition

---

### SUBFLOW 5: Archetype Assessment (Multi-Archetype Refinement)

**Node Type**: `archetype_assessment_subflow`

**Purpose**: Progressive archetype refinement through multi-archetype tracking. Starts with multiple candidate archetypes (exploring), narrows to strong contenders (narrowing), resolves to single dominant archetype (resolved). **Feeds Analyst Flow with strategic requirements** to discriminate between archetypes.

**Refinement Philosophy**: Don't settle on one archetype too early. Track multiple candidates, use requirements to gather material that clarifies which pattern is most apt. By composition gate, one archetype must be resolved with >= 0.85 confidence.

**Parent Flow**: Analyst Flow

**Triggers**:
- Session count >= 4 AND session_count % 3 == 0 (every 3rd session starting at session 4)
- User asks "what's my story shape?" or "how does this fit together?"
- Before composition gate (must validate archetype resolved)
- Manual trigger by admin

**Inputs**:
- Storyteller ID
- All life events
- All session artifacts (story points)
- Previous archetype analysis (if exists)
- Current requirements table (to see if discriminating requirements addressed)

**Execution Steps**:

#### Multi-Archetype Agentic Assessment
```
Call LLM with expert prompt:

Analyze this storyteller's material for narrative patterns.
Track MULTIPLE candidate archetypes with confidence scores.

Archetype dimensions (from process.txt Phase 10):
- Identity shift (who I was → who I became)
- Relationship to loss (what was lost, how processed)
- Relationship to agency (constraints vs autonomy)
- Relationship to meaning (what matters, why)

Previous analysis: {previous_analysis or "None yet"}
Session count: {session_count}
Analysis number: {analysis_number}

New material since last assessment:
{latest story points}

All material summary:
{complete material overview}

For EACH candidate archetype, assess:
1. Confidence (0.0-1.0)
2. Supporting evidence (story point IDs)
3. Narrative indicators (themes, patterns)
4. Status (active, weakening, ruled_out)

Return JSON:
{
    "candidate_archetypes": [
        {
            "archetype": "relationship_to_loss",
            "confidence": 0.78,
            "status": "active",
            "evidence": ["evt-123", "evt-456"],
            "indicators": ["grief themes", "absence focus", "cannot move forward"],
            "evidence_gained_since_last": "grandmother death scene with strong grief"
        },
        {
            "archetype": "relationship_to_agency",
            "confidence": 0.62,
            "status": "active",
            "evidence": ["evt-789"],
            "indicators": ["constraint", "forced choices", "lack of autonomy"],
            "evidence_gained_since_last": "father departure - some agency loss"
        },
        {
            "archetype": "identity_shift",
            "confidence": 0.35,
            "status": "ruled_out",
            "ruled_out_reason": "no clear transformation arc visible",
            "evidence": [],
            "indicators": []
        }
    ],
    "refinement_progress": "Loss archetype strengthening with grandmother death. Agency still plausible but weaker.",
    "identity_before": "...",
    "identity_after": "...",
    "relationship_to_loss_strength": 0.78,
    "relationship_to_agency_strength": 0.62,
    "relationship_to_meaning_strength": 0.45
}
```

#### Determine Refinement Status
```
active_candidates = [c for c in candidates if c['confidence'] > 0.60]
top_confidence = max(c['confidence'] for c in candidates)

IF len(active_candidates) >= 3:
    refinement_status = 'exploring'  # Still unclear, multiple viable

ELIF len(active_candidates) == 2:
    refinement_status = 'narrowing'  # Between two strong contenders

ELIF len(active_candidates) == 1 AND top_confidence >= 0.85:
    refinement_status = 'resolved'   # Clear winner!
    dominant = candidates[0]

ELSE:
    refinement_status = 'narrowing'  # Getting closer
```

#### Create Archetype Analysis Record
```
analysis = create_archetype_analysis(
    storyteller_id=storyteller_id,
    analysis_number=previous.analysis_number + 1 if previous else 1,
    candidate_archetypes=candidates,  # Full array with all details
    refinement_status=refinement_status,
    dominant_archetype=dominant['archetype'] if refinement_status == 'resolved' else null,
    dominant_confidence=dominant['confidence'] if refinement_status == 'resolved' else null,
    refinement_progress=agent_response.refinement_progress,
    relationship_to_loss_strength=agent_response.relationship_to_loss_strength,
    relationship_to_agency_strength=agent_response.relationship_to_agency_strength,
    relationship_to_meaning_strength=agent_response.relationship_to_meaning_strength,
    revealed_to_user=false,  # Hidden by default!
    previous_analysis_id=previous.id if previous else null
)
```

#### Signal Analyst Flow for Strategic Requirements
```
# After assessment, trigger Analyst Flow to lodge requirements based on refinement status

IF refinement_status == 'exploring':
    # Multiple candidates - need discriminating requirements
    RETURN {
        'action': 'lodge_discriminating_requirements',
        'candidates': top_two_candidates,
        'message': 'Multiple archetypes viable - lodge requirements to clarify'
    }

ELIF refinement_status == 'narrowing':
    # Strong contenders - need validating requirements
    RETURN {
        'action': 'lodge_validating_requirements',
        'candidates': active_candidates,
        'message': 'Archetype narrowing - lodge requirements to validate'
    }

ELIF refinement_status == 'resolved':
    # Archetype clear - can proceed to composition gate
    RETURN {
        'action': 'archetype_resolved',
        'dominant': dominant_archetype,
        'confidence': dominant_confidence,
        'message': 'Archetype resolved - composition gate can check'
    }
```

#### User Verification (Only If User Asks)
```
From process.txt:
"Archetypes are structural, not prescriptive"
"Hidden by default"
"Revealed only if user asks for 'story map' or 'narrative shape'"

IF user_asks_for_story_shape:
    # Reveal current archetype understanding
    analysis.revealed_to_user = true
    analysis.revealed_at = now()

    IF refinement_status == 'resolved':
        # Single archetype - present confidently
        message = f"""
        This currently reads like a journey through {dominant_archetype}.
        The pattern I'm noticing is {describe_archetype_pattern(dominant_archetype)}.

        Does that feel accurate, or would you frame it differently?
        """

    ELSE:
        # Multiple candidates - present honestly
        message = f"""
        I'm seeing multiple possible patterns in your story:
        - {candidate1['archetype']} ({candidate1['confidence']*100}% confidence)
        - {candidate2['archetype']} ({candidate2['confidence']*100}% confidence)

        As we continue, I'll help clarify which feels most true to your experience.
        Does one of these resonate more, or is there another way you'd describe the shape?
        """

    user_response = await ask_user(message)

    IF user confirms (or selects one):
        analysis.user_confirmed = true
    ELSE:
        # User disagrees - immediate pivot
        create_user_feedback(
            feedback_type="archetype_mismatch",
            content=user_response
        )
        # Trigger re-analysis with user input
        RETURN next_subflow: "archetype_assessment" (with user correction)
```

**Outputs**:
- New `archetype_analysis` record with multi-archetype tracking
- `refinement_status` (exploring | narrowing | resolved)
- `candidate_archetypes` array with confidence scores
- Signal to Analyst Flow about what requirements to lodge
- If resolved: `dominant_archetype` and `dominant_confidence`

**Success Criteria**:
- Multiple candidate archetypes tracked with confidence scores
- Refinement status determined based on candidate count and confidence
- Hidden from user unless they ask (per process.txt commitment)
- If revealed, honest presentation of multiple candidates OR resolved archetype
- Analyst Flow signaled with strategic guidance for next requirements
- Progression: exploring → narrowing → resolved over multiple assessments

**Feeds Into**:
- **Analyst Flow**: Uses refinement status to lodge discriminating/validating/strengthening requirements
- **Composition Gate**: Blocks composition unless refinement_status = 'resolved' AND confidence >= 0.85

---

### SUBFLOW 6: Synthesis

**Node Type**: `synthesis_subflow`

**Purpose**: Execute Phase 9 of canonical process (Synthesis Checkpoints - Provisional). Create visible progress by assembling read-only chapter drafts from captured material.

**Parent Flow**: Analyst Flow

**Triggers**:
- Analyst determines a section has sufficient material for provisional draft
- After 3-4 sessions in same section
- User requests to see current progress

**Inputs**:
- Storyteller ID
- Section/collection to synthesize
- All relevant story points (session artifacts)
- Current archetype (if available)

**Execution Steps**:

#### Assemble Provisional Draft
```
1. Gather all session artifacts for section
   - Filter by section (e.g., "Childhood")
   - Order by chronology or narrative logic

2. Identify key scenes vs. summaries
   - session_artifact WHERE artifact_type = "scene_capture" (70-80% target)
   - session_artifact WHERE artifact_type = "summary_capture" (20-30% target)

3. Organize into narrative flow
   - Opening hook (strong scene)
   - Chronological or thematic progression
   - Intersperse summary for pacing
   - Closing resonance (reflection or pivot moment)

4. Generate provisional text
   - Use LLM to weave story points into coherent narrative
   - Maintain user's voice (analyze tone from transcripts)
   - Preserve exact quotes where powerful
   - Add transitions between scenes
   - Include sensory details from artifacts

5. Label as PROVISIONAL
   - Watermark: "DRAFT - Your Review Needed"
   - Explicitly state: "Raw story inputs remain accessible"
```

#### Create Collection & Synthesis Record
```
Create collection:
    collection_name = "Childhood (Provisional Draft)"
    organizing_principle = "theme" or "archetype" (if available)
    is_provisional = true  # Critical flag!

Link story points to collection:
    FOR artifact IN section_artifacts:
        collection_life_event.create(
            collection_id=collection.id,
            life_event_id=artifact.life_event_id,
            narrative_role=determine_role(artifact),  # "inciting_incident", "climax", "resolution"
            sequence_order=position_in_narrative
        )

Create collection_synthesis:
    synthesis_type = "provisional_draft"
    synthesized_content = generated_narrative_text
    metadata = {
        "scene_to_summary_ratio": calculate_ratio(),
        "word_count": count_words(),
        "key_themes": extract_themes(),
        "key_characters": extract_characters()
    }
```

#### User Verification (Required)
```
Send to user (webapp/email):

"Here's a provisional draft of your Childhood chapter.

This is NOT final - think of it as a rough sketch. Your raw story is still
preserved separately.

[READ DRAFT]

Follow-up prompts (2-3 max):
- "One more specific moment would strengthen this." [Which moment?]
- "Anything here feel off or missing?" [User can comment]
- "Would you like to leave this as is?" [Approve/Request Changes]

User actions:
- Approve → mark is_provisional = false, status = "approved"
- Request changes → create user_feedback, update synthesis
- Add more material → return to lane_development subflow
```

**Outputs**:
- New `collection` record (provisional draft)
- New `collection_life_event` records (links story points)
- New `collection_synthesis` record (synthesized text)
- User verification request sent
- Updated `storyteller_progress` (show visible progress)

**Success Criteria**:
- Provisional draft assembled with narrative coherence
- Scene-to-summary ratio appropriate (70-80% scene)
- User notified and given control
- Material remains editable and reversible
- Raw inputs preserved and accessible

---

### SUBFLOW 7: Composition

**Node Type**: `composition_subflow`

**Purpose**: Execute Phase 12 of canonical process (Story Writing - Composition). Once sufficiency gates passed, assemble material into book-grade narrative manuscript.

**Parent Flow**: Editor Flow

**Triggers**:
- Analyst Flow determines **ALL sufficiency gates passed** (see below)
- Editor Flow requests composition after addressing edit requirements

**BLOCKING Sufficiency Gates** (must ALL pass before composition begins):

1. **Archetype Resolution Gate** (CRITICAL):
   - `archetype_analysis.refinement_status` = 'resolved'
   - `archetype_analysis.dominant_confidence` >= 0.85
   - If revealed to user: `archetype_analysis.user_confirmed` = true
   - **Cannot proceed to composition with multiple viable archetypes**

2. **Material Threshold Gate**:
   - Minimum life events per archetype dimension (varies by archetype)
   - Scene density adequate (70%+ scene vs summary in captured material)
   - Sensory details present (3+ senses in key scenes)

3. **Character Development Gate**:
   - Protagonist arc clear (identity before/after)
   - Key relationships developed with motivations
   - Character voices distinct

4. **Thematic Coherence Gate**:
   - Themes align with resolved archetype
   - Recurring motifs present
   - Meaning-making evident

**Inputs**:
- Storyteller ID
- Story ID (manuscript)
- Approved collections (non-provisional)
- Archetype (confirmed by user if revealed, or best-fit if hidden)
- Book type preference (from storyteller_preference)

**Execution Steps**:

#### Initialize Story Structure
```
Create story record:
    story_title = user_provided or "The Story of [Name]"
    primary_archetype = confirmed_archetype
    voice_tone = storyteller_preference.book_type  # "reflective", "adventure", "legacy"
    structure = derive_from_archetype()  # e.g., "three-act", "chronological", "thematic"
    status = "in_composition"
```

#### Assemble Chapters from Collections
```
FOR each collection IN approved_collections ORDER BY narrative_position:

    Create story_chapter:
        chapter_number = sequence
        chapter_title = derive_from_collection_theme()
        narrative_purpose = map_to_archetype_arc()  # e.g., "inciting_incident", "rising_action"

    Link collection to chapter:
        story_collection.create(
            story_id=story.id,
            chapter_id=chapter.id,
            collection_id=collection.id,
            transformation_notes="How raw material transformed into narrative"
        )
```

#### Compose Chapter Content
```
FOR each chapter:

    # Get source material
    story_points = get_story_points_for_chapter(chapter)
    scenes = filter_scenes(story_points)
    summaries = filter_summaries(story_points)

    # Organize into sections
    opening_hook = select_strongest_scene(scenes, position="opening")
    body_scenes = arrange_scenes_for_impact(scenes)
    closing_resonance = select_reflection_or_pivot(scenes + summaries)

    # Create chapter sections
    FOR section IN [opening_hook] + body_scenes + [closing_resonance]:

        Create chapter_section:
            section_type = "scene" | "summary" | "reflection" | "transition"
            sequence_order = position
            word_count = estimate_length()

        IF section_type = "scene":
            Create story_scene:
                scene_setting = extract_location_time(section)
                visual_details = extract_sensory(section, sense="visual")
                auditory_details = extract_sensory(section, sense="auditory")
                tactile_details = extract_sensory(section, sense="tactile")
                olfactory_details = extract_sensory(section, sense="olfactory")
                emotional_context = extract_emotions(section)
                reflection = extract_meaning(section)

        # Generate polished prose
        section.content = compose_narrative_prose(
            raw_material=section,
            voice_tone=story.voice_tone,
            archetype=story.primary_archetype,
            maintain_user_voice=true
        )
```

#### Develop Characters
```
FOR each person mentioned across all chapters:

    Create story_character:
        character_name = real_name or pseudonym (if privacy boundary)
        based_on_participant = life_event_participant.id
        character_type = "protagonist" | "supporting" | "minor" | "composite"
        physical_description = aggregate_descriptions()
        personality_traits = aggregate_traits()
        character_arc = {
            "introduction": "Who they were at start",
            "development": "How they changed",
            "resolution": "Where they ended up"
        }

    Track appearances:
        FOR chapter WHERE character appears:
            character_appearance.create(
                character_id=character.id,
                chapter_id=chapter.id,
                role_in_chapter="mentor" | "antagonist" | "companion" | "catalyst"
            )

    Map relationships:
        FOR other_character IN story_characters:
            IF relationship_exists:
                character_relationship.create(
                    character_id=character.id,
                    related_character_id=other_character.id,
                    relationship_type="parent-child" | "romantic" | "friend" | "adversary"
                    relationship_arc="How it evolved"
                )
```

#### Weave Themes
```
FOR each theme identified (from archetype analysis):

    Create story_theme:
        theme_name = e.g., "Loss and Resilience"
        theme_description = "How this theme manifests in the story"
        symbols_motifs = ["ocean as metaphor for grief", "letters as connection"]

    Map to chapters:
        FOR chapter WHERE theme present:
            chapter_theme.create(
                chapter_id=chapter.id,
                theme_id=theme.id,
                how_theme_appears="Specific manifestation in this chapter"
            )
```

#### Calibrate Tone
```
Apply tone based on storyteller_preference.book_type:
    - "reflective": More introspection, meaning-making, looking back
    - "adventure": More action, suspense, forward momentum
    - "legacy": More life lessons, wisdom, passing on knowledge
    - "healing": More gentle, trauma-aware, therapeutic language

Adjust prose across all chapters to match tone.
```

#### Create Draft Version
```
Create story_draft:
    draft_version = 1
    draft_date = now()
    content_snapshot = serialize_all_chapters()
    draft_type = "first_composition"

Save draft for version history.
```

**Outputs**:
- New `story` record (manuscript initialized)
- Multiple `story_chapter` records (structured chapters)
- Multiple `chapter_section` records (scenes, summaries, transitions)
- Multiple `story_scene` records (detailed scene construction)
- Multiple `story_character` records (crafted characters with arcs)
- Multiple `character_relationship` records (relational dynamics)
- Multiple `character_appearance` records (tracking across chapters)
- Multiple `story_theme` records (thematic threads)
- Multiple `chapter_theme` records (themes per chapter)
- New `story_draft` record (version snapshot)
- Editor Flow triggered for quality review

**Success Criteria**:
- Full manuscript assembled with chapters, scenes, characters, themes
- Scene-to-summary ratio maintained (70-80% scene)
- Character arcs tracked and complete
- Themes woven throughout
- Tone calibrated to user preference
- Draft saved for version control
- Ready for Editor Flow review

---

## Requirements Tables

Requirements Tables are the connective tissue between flows. They track what needs to happen and what's been addressed.

---

### Requirements Table (Story Capture Requirements)

**Schema**:
```sql
CREATE TABLE requirement (
    id UUID PRIMARY KEY,
    storyteller_id UUID NOT NULL,
    requirement_type VARCHAR(50) NOT NULL,  -- "scene_detail", "character_insight", "thematic_exploration", "timeline_clarification", "emotional_context"
    priority VARCHAR(20) NOT NULL,          -- "critical", "important", "optional"
    section_id UUID,                        -- Which narrative lane (can be null if whole-story)
    archetype_lane VARCHAR(50),             -- Which archetype dimension this serves, OR "discriminating" for multi-archetype requirements

    -- Archetype refinement fields (NEW for multi-archetype tracking)
    archetype_refinement_purpose VARCHAR(20),  -- 'validate', 'discriminate', 'strengthen', NULL
    discriminates_between JSONB,               -- Array of archetypes this requirement helps choose between
                                               -- e.g., ["relationship_to_loss", "relationship_to_agency"]
    expected_archetype_outcomes JSONB,         -- What answering this reveals about competing archetypes
                                               -- e.g., {"if_loss_dominant": "Focus on emptiness...", "if_agency_dominant": "Focus on constraints..."}

    requirement_description TEXT NOT NULL,
    suggested_prompts JSONB,                -- Suggested follow-up prompts
    status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- "pending", "addressed", "resolved"
    result JSONB,                           -- Structured result data from user response
    transcript_segment JSONB,               -- Transcript payload {agent_utterance, user_utterance, timestamp, duration_seconds}
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    addressed_at TIMESTAMP,
    created_by VARCHAR(50) NOT NULL DEFAULT 'analyst_flow',

    FOREIGN KEY (storyteller_id) REFERENCES storyteller(id),
    FOREIGN KEY (section_id) REFERENCES process_section(id)
);

CREATE INDEX idx_requirement_storyteller_status ON requirement(storyteller_id, status);
CREATE INDEX idx_requirement_section_priority ON requirement(section_id, priority);
CREATE INDEX idx_requirement_archetype_refinement ON requirement(archetype_refinement_purpose, status);
```

**Purpose**: Analyst Flow lodges requirements based on gap analysis. Session Flow addresses requirements during lane development.

**Example Requirements**:

```json
// Regular requirement (scene detail)
{
    "requirement_id": "req-001",
    "storyteller_id": "user-123",
    "requirement_type": "scene_detail",
    "priority": "critical",
    "section_id": "childhood",
    "archetype_lane": "relationship_to_loss",
    "archetype_refinement_purpose": null,
    "discriminates_between": null,
    "expected_archetype_outcomes": null,
    "requirement_description": "Need more sensory detail about grandmother's house - currently only visual",
    "suggested_prompts": [
        "What did your grandmother's house smell like?",
        "What sounds do you remember from being there?",
        "Was there a texture or feeling you associate with that place?"
    ],
    "status": "pending"
}

// Discriminating requirement (archetype refinement - EXPLORING phase)
{
    "requirement_id": "req-004",
    "storyteller_id": "user-123",
    "requirement_type": "emotional_context",
    "priority": "critical",
    "section_id": "early_adulthood",
    "archetype_lane": "discriminating",
    "archetype_refinement_purpose": "discriminate",
    "discriminates_between": ["relationship_to_loss", "relationship_to_agency"],
    "expected_archetype_outcomes": {
        "if_loss_dominant": "Focus on emptiness, missing him, grief, what was lost permanently",
        "if_agency_dominant": "Focus on constraints, forced changes, lost autonomy, lack of choice in what happened next"
    },
    "requirement_description": "Need to understand father's departure - is this primarily about grief/loss OR constrained agency?",
    "suggested_prompts": [
        "When you think about your father leaving, what do you feel most - the absence of him, or what you couldn't do because he left?",
        "Looking back, did his leaving feel like something was taken from you, or like your choices were taken from you?",
        "What changed most after he left - who was around you, or what you could do?"
    ],
    "status": "pending"
}
```

**Workflow** (Real-Time):
1. **Subflow creates requirement** (e.g., Trust Building, Lane Development, Archetype Assessment)
   - Standard requirements: scene_detail, character_insight, thematic_exploration, trust_setup
   - **Archetype refinement requirements**: discriminate (exploring), validate (narrowing), strengthen (resolved)

2. **Session Flow fetches pending requirements**
   - Filter by: section, priority (critical first)
   - Transform into conversational prompts for VAPI agent

3. **VAPI agent addresses requirements during session**
   - Uses suggested prompts from requirements
   - **Calls submit_requirement_result() for EACH requirement addressed**
     - Includes: requirement_id, status, structured result, transcript_segment
     - **Tool immediately triggers Analyst Flow (real-time)**
     - Analyst re-runs ALL subflows to reassess state

4. **submit_requirement_result Tool Implementation**:
```python
async def submit_requirement_result(
    requirement_id: str,
    status: str,  # "addressed", "partially_addressed", "skipped"
    result: dict,  # Structured data from user response
    transcript_segment: dict  # Transcript with timestamps
):
    # Update requirement in database
    await RequirementService.mark_addressed(
        requirement_id=requirement_id,
        status=status,
        result=result,
        transcript_segment=transcript_segment
    )

    # Apply side effects (e.g., update storyteller, unlock sections)
    await apply_requirement_side_effects(requirement_id, result)

    # TRIGGER ANALYST FLOW IMMEDIATELY
    await run_analyst_flow(
        storyteller_id=requirement.storyteller_id,
        trigger_reason="requirement_submission",
        requirement_id=requirement_id
    )

    return {"success": True, "analyst_triggered": True}
```

5. **Analyst Flow reassesses** (after each requirement submission)
   - Runs ALL subflows with updated state
   - Subflows may create new requirements or resolve existing ones
   - Determines next action based on aggregate state

6. **Post-session processing**
   - Final Analyst Flow run after session complete
   - Validates all requirements addressed
   - Updates overall progress
   - Determines next session focus

---

### Edit Requirements Table (Composition Quality Requirements)

**Schema**:
```sql
CREATE TABLE edit_requirement (
    id UUID PRIMARY KEY,
    story_id UUID NOT NULL,
    chapter_id UUID,                        -- Specific chapter (can be null if whole-story)
    issue_type VARCHAR(50) NOT NULL,        -- "flow", "pacing", "clarity", "consistency", "sensory_detail", "theme"
    severity VARCHAR(20) NOT NULL,          -- "blocking", "important", "polish"
    specific_concern TEXT NOT NULL,
    suggested_approach TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- "pending", "in_review", "resolved"
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMP,
    created_by VARCHAR(50) NOT NULL DEFAULT 'editor_flow',

    FOREIGN KEY (story_id) REFERENCES story(id),
    FOREIGN KEY (chapter_id) REFERENCES story_chapter(id)
);

CREATE INDEX idx_edit_requirement_story_severity ON edit_requirement(story_id, severity, status);
CREATE INDEX idx_edit_requirement_chapter ON edit_requirement(chapter_id, status);
```

**Purpose**: Editor Flow lodges edit requirements after reviewing composed chapters. Composition Subflow addresses requirements in revision cycles.

**Example Edit Requirements**:
```json
{
    "edit_id": "edit-001",
    "story_id": "story-456",
    "chapter_id": "chapter-03",
    "issue_type": "pacing",
    "severity": "important",
    "specific_concern": "Chapter 3 is 80% summary, needs more scene work. The confrontation with father is told, not shown.",
    "suggested_approach": "Expand the confrontation into a full scene with dialogue, setting, and sensory details. Cut some of the summary about 'those years' to make room.",
    "status": "pending"
}
```

**Workflow**:
1. Editor Flow reviews chapter → lodges edit requirement
2. Composition Subflow addresses requirement (revision cycle)
3. Editor Flow reviews again → marks requirement as "resolved" or lodges new requirement
4. Iterative refinement until all blocking/important requirements resolved

---

## Flow Interaction Patterns

### Pattern 1: Analyst → Session → Analyst Loop (Real-Time)

```
┌──────────────┐
│  Analyst     │ Runs ALL subflows
│  Flow        │ Each subflow assesses state and creates requirements
└──────┬───────┘
       ↓
┌──────────────┐
│ Requirements │ Pending requirements created by subflows
│ Table        │
└──────┬───────┘
       ↓
┌──────────────┐
│  Analyst     │ Determines next action based on state after all subflows
│  Flow        │ → schedule_session if pending requirements exist
└──────┬───────┘
       ↓
┌──────────────┐
│  Session     │ VAPI agent addresses requirements during call
│  Flow        │
└──────┬───────┘
       │
       │ DURING SESSION (Real-Time Loop):
       │
       ├→ VAPI agent asks requirement question
       ├→ User responds
       ├→ Agent calls submit_requirement_result(req_id, result, transcript_segment)
       │     ↓
       │  ┌──────────────┐
       │  │ Requirements │ Update requirement: status = "addressed"
       │  │ Table        │ Store result + transcript_segment
       │  └──────┬───────┘
       │         ↓
       │  ┌──────────────┐
       │  │  Analyst     │ IMMEDIATELY triggered (real-time)
       │  │  Flow        │ Re-runs ALL subflows with updated state
       │  └──────┬───────┘
       │         ↓
       │  Subflows reassess, may create/resolve requirements
       │         ↓
       │  [Continue session with updated state]
       │
       ├→ Next requirement question...
       │
       └→ Session ends
          ↓
┌──────────────┐
│  Analyst     │ Final run after session complete
│  Flow        │ Validates all addressed, determines next session
└──────────────┘
       ↓
   [LOOP or transition to next phase]
```

**Key Points**:
- **Analyst ALWAYS runs ALL subflows** - No selective execution
- **Real-time triggering** - Analyst runs after EVERY requirement submission during session
- **Subflows self-gate** - Each subflow checks entry criteria and returns early if not met
- **Requirements drive sessions** - Session addresses pending requirements
- **Transcript included** - Each requirement submission includes transcript segment for audit trail
- Loop continues until storyteller reaches composition phase

---

### Pattern 2: Editor → Composition → Editor Loop

```
┌──────────────┐
│  Analyst     │ Determines sufficiency gates passed
│  Flow        │ Transition to composition phase
└──────┬───────┘
       ↓
┌──────────────┐
│  Composition │ Assemble chapters from collections
│  Subflow     │ Generate manuscript
└──────┬───────┘
       ↓
┌──────────────┐
│  Editor      │ Review chapters for quality
│  Flow        │ Assess narrative craft
└──────┬───────┘
       ↓
┌──────────────┐
│ Edit         │ Lodge edit requirements
│ Requirements │
│ Table        │
└──────┬───────┘
       ↓
┌──────────────┐
│  Editor      │ Blocking issues?
│  Flow        │
└──────┬───────┘
       │
       ├─ YES → Return to Composition Subflow (revision cycle)
       │
       └─ NO → Approve chapter, continue to next chapter
                   ↓
               All chapters approved?
                   ↓
               YES → Transition to Book Export
```

**Key Points**:
- Editor Flow acts as quality gate
- Edit Requirements Table tracks issues
- Composition Subflow iterates until quality standards met
- Blocking issues prevent progression

---

### Pattern 3: Multi-Archetype Refinement (Progressive Narrowing)

```
┌──────────────┐
│  Session     │ Session 4+ completed
│  Flow        │
└──────┬───────┘
       ↓
┌──────────────┐
│  Analyst     │ Trigger: session_count % 3 == 0
│  Flow        │
└──────┬───────┘
       ↓
┌──────────────┐
│  Archetype   │ Multi-archetype agentic assessment
│  Assessment  │ Track multiple candidates with confidence scores
│  Subflow     │
└──────┬───────┘
       ↓
┌──────────────┐
│  Archetype   │ Save with refinement_status:
│  Analysis    │ - exploring (3+ candidates)
│  Table       │ - narrowing (2 candidates)
└──────┬───────┘ - resolved (1 candidate >= 0.85 confidence)
       ↓         (revealed_to_user = FALSE by default)
       ↓
┌──────────────┐
│  Signal      │ Return refinement status to Analyst Flow
│  Analyst     │
└──────┬───────┘
       ↓
       ├─ IF exploring → Lodge discriminating requirements
       │                 (help choose between top 2 candidates)
       ├─ IF narrowing → Lodge validating requirements
       │                 (confirm evidence for candidates)
       └─ IF resolved → Lodge strengthening requirements
                        (deepen the dominant archetype)
       ↓
┌──────────────┐
│ Requirements │ Strategic requirements lodged
│ Table        │ with archetype_refinement_purpose
└──────┬───────┘
       ↓
   Continue normal flow (archetype hidden)
       ↓
       ↓
   Next archetype assessment (3 sessions later)
       ↓
   [Progressive refinement: exploring → narrowing → resolved]
       ↓
       ↓
   [OPTIONAL: User asks "what's my story shape?"]
       ↓
┌──────────────┐
│  Reveal      │ Set revealed_to_user = TRUE
│  Archetype   │ IF resolved: present dominant archetype
│              │ IF exploring/narrowing: present multiple candidates honestly
└──────┬───────┘
       │
       ├─ User confirms → Proceed with archetype
       │
       └─ User disagrees → Immediate pivot
                           Create user_feedback
                           Re-run archetype assessment with correction
```

**Key Points**:
- **Multi-archetype tracking**: Don't settle on one too early
- **Progressive refinement**: exploring → narrowing → resolved over multiple assessments
- **Strategic requirements**: Analyst lodges requirements based on refinement status to gather clarifying material
- **Hidden observer**: Archetype NOT revealed unless user asks
- **Composition gate**: Blocks composition unless refinement_status = 'resolved' AND confidence >= 0.85
- **User verification**: Required if revealed, immediate pivot if user disagrees

---

## Implementation Roadmap

### Phase 1: Core Flows (MVP)
**Priority**: P0
**Timeline**: Weeks 1-4

1. **Analyst Flow** - Basic version
   - Phase detection (trust, history, capture)
   - Simple requirements lodging
   - Next subflow determination

2. **Session Flow** - Complete lifecycle
   - Pre-call preparation (context loading)
   - VAPI integration (agent creation, call execution)
   - Post-call processing (transcript → story points)
   - Quality validation
   - User verification

3. **Trust Building Subflow** - Complete
   - Introduction & trust setup
   - Scope selection
   - Gentle profile

4. **Contextual Grounding Subflow** - Complete
   - Timeline building based on scope

5. **Section Selection Subflow** - Complete
   - Present available sections
   - Track selections

6. **Lane Development Subflow** - Basic version
   - Prompt pack template (Scene → People → Tension → Change → Meaning)
   - Boundary checks
   - Scene extraction

**Deliverables**:
- User can onboard (trust building)
- User can select scope and sections
- User can conduct story capture sessions (basic)
- Transcripts processed into story points
- Progress tracked

---

### Phase 2: Advanced Flows
**Priority**: P1
**Timeline**: Weeks 5-8

1. **Analyst Flow** - Advanced
   - Gap analysis (identify missing character insights, scene details, etc.)
   - Requirements Table population
   - Progressive section unlocking

2. **Lane Development Subflow** - Advanced
   - Requirements-driven prompts
   - Multi-lane coordination
   - Section completion tracking

3. **Archetype Assessment Subflow** - Complete
   - Agentic assessment agent
   - Hidden by default
   - User verification workflow

4. **Synthesis Subflow** - Complete
   - Provisional draft assembly
   - Collection creation
   - User verification

**Deliverables**:
- Analyst identifies gaps and lodges requirements
- Sessions address specific requirements
- Archetype patterns detected (hidden)
- Provisional drafts created for user review

---

### Phase 3: Composition & Quality
**Priority**: P1
**Timeline**: Weeks 9-12

1. **Editor Flow** - Complete
   - Chapter quality assessment
   - Edit requirements lodging
   - Approval gating

2. **Composition Subflow** - Complete
   - Chapter assembly from collections
   - Scene construction with full sensory details
   - Character development and arcs
   - Theme weaving
   - Iterative refinement based on edit requirements

3. **Book Export** - Basic
   - PDF generation
   - EPUB generation
   - Delivery tracking

**Deliverables**:
- Full manuscripts composed
- Quality standards enforced
- Iterative refinement workflow
- Books exported and delivered

---

### Phase 4: Optimization & Intelligence
**Priority**: P2
**Timeline**: Weeks 13-16

1. **Session Recovery** - Complete
   - Background monitor for stuck sessions
   - VAPI transcript fetching
   - Webapp transcript review

2. **Agent-Driven Scheduling** - Complete
   - Agent asks about next session during call
   - SMS/email fallback

3. **Multi-User Interviews** - Research
   - Support for interviewing family members
   - Perspective integration

4. **Advanced Archetype** - Research
   - Multiple concurrent archetypes
   - Section-level vs. whole-story archetypes
   - Archetype evolution tracking

---

## Testing Strategy

### Unit Tests

**Analyst Flow**:
- Test phase detection logic
- Test requirements lodging
- Test next subflow determination
- Test section unlocking logic

**Session Flow**:
- Test context loading
- Test prompt generation
- Test story point extraction
- Test quality validation

**Subflows**:
- Test each subflow in isolation
- Test boundary checks
- Test artifact creation

### Integration Tests

**End-to-End Journeys**:
1. **Whole Life Journey**:
   - New user → Trust building → Scope (whole life) → Profile → Contextual grounding → Section selection → Multiple lane development sessions → Archetype assessment → Synthesis → Composition → Export

2. **Single Event Journey**:
   - New user → Trust building → Scope (single event) → Profile → Contextual grounding → Lane development (focused) → Synthesis → Composition → Export

3. **Archetype Pivot Journey**:
   - User in story capture → Archetype asserts "loss_to_connection" → More sessions → New material suggests "transformation" → Archetype pivots → User asks for story shape → User confirms pivot

### Quality Gates

**Session Quality**:
- Minimum duration (5 minutes)
- Transcription confidence (>= 80%)
- User engagement (>= 200 words)
- No distress detected

**Composition Quality**:
- Scene-to-summary ratio (70-80% scene)
- Sensory details present (all 5 senses)
- Character consistency (tracked across chapters)
- Thematic coherence (themes woven throughout)

---

## Monitoring & Observability

### Flow Metrics

**Analyst Flow**:
- Requirements lodged per session
- Phase transitions (how long in each phase)
- Section unlock rate
- Requirements resolution rate

**Session Flow**:
- Session success rate (quality validated)
- Session duration (avg, median)
- Story points per session (avg)
- User verification rate (approved vs. changes requested)

**Editor Flow**:
- Edit requirements per chapter
- Blocking issues rate
- Revision cycles per chapter (avg)
- Time to approval

### Alerts

- **Stuck storytellers**: No session in 30 days
- **Low engagement**: User engagement < 100 words in session
- **Quality failures**: Session quality < 60% threshold
- **Archetype conflicts**: User disagrees with revealed archetype
- **Composition blockers**: Blocking edit requirements unresolved for > 7 days

---

## Conclusion

This flow architecture provides:

✅ **Clear orchestration**: Analyst, Session, Editor flows manage the journey
✅ **Specialized subflows**: Each canonical phase has a dedicated subflow
✅ **Requirements-driven**: Flows communicate via Requirements Tables
✅ **Feedback loops**: Analyst → Session → Analyst, Editor → Composition → Editor
✅ **User authority**: Verification loops throughout (provisional drafts, archetype reveal)
✅ **Trauma-aware**: Boundary checks at every prompt
✅ **Progressive unlocking**: Sections unlock as prerequisites met
✅ **Quality gates**: Sessions and chapters validated before progression
✅ **Hidden archetypes**: Structural, not prescriptive (per process.txt)

**Next Steps**:
1. Implement Phase 1 flows (MVP)
2. Build Requirements Table schema (next document)
3. Implement Session Flow with VAPI integration
4. Test end-to-end journey with pilot users
