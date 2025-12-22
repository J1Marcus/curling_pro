# Users & Agents: High-Level Architecture

**Version:** 1.1
**Date:** 2025-12-22
**Status:** Aligned with Analyst Subflow Execution Pattern

## Overview

The Everbound system is built around a **storyteller** (the human user) and a sophisticated network of **orchestrator flows** and **self-gating subflows** that guide the storyteller through the journey from initial trust-building to final book publication.

**Key Architectural Pattern:** The Analyst Flow runs ALL 8 self-gating subflows on every trigger. Each subflow checks its own entry criteria and executes only if conditions are met. The Analyst is triggered in real-time after EVERY `submit_requirement_result()` call, not after session completion.

This document defines all actors in the system at a high level: their roles, responsibilities, and how they interact.

---

## Primary User

### STORYTELLER

**Type**: Human User

**Role**: The author of their life story. The person whose memories, experiences, and narrative are being captured and transformed into a professional memoir.

**Primary Goals**:
- Share their life story in a safe, trauma-aware environment
- Maintain authorship and control at every step
- See their memories transformed into a professionally crafted book

**Key Interactions**:
- Conducts story capture sessions (via VAPI voice/text interviews)
- Reviews and approves synthesized drafts
- Provides feedback on archetypes, collections, and chapters
- Sets boundaries and preferences
- Receives final book export

**Authority Level**: **Highest** - Nothing is locked in without storyteller approval. The storyteller can:
- Skip any question or topic
- Request changes to any output
- Override system suggestions
- Pivot archetype interpretations
- Control pace and scope

---

## Orchestrator Agents (Primary Flows)

These are the "brains" of the system—autonomous decision-making agents that assess state, determine next actions, and orchestrate subflows.

---

### 1. ANALYST FLOW

**Agent Type**: `analyst_orchestrator`

**Role**: The **decision-making brain** of the system. Orchestrates ALL 8 self-gating subflows after every requirement result submission.

**Primary Responsibilities**:
- **Run ALL 8 Subflows**: Execute all subflows on every trigger (no selective execution)
- **Self-Gating Orchestration**: Each subflow checks its own entry criteria and returns early if not met
- **Phase Assessment**: Determine current phase (trust_building → history_building → story_capture → composition)
- **Completeness Check**: Evaluate material against phase requirements
- **Gap Identification**: Identify missing context, scenes, characters, themes, sensory details
- **Requirements Lodging**: Create/update requirements in the Requirements Table (critical, important, optional)
- **Section Unlocking**: Progressively unlock new narrative lanes as prerequisites are met
- **Archetype-Aware Strategy**: Lodge discriminating, validating, or strengthening requirements based on archetype refinement status

**Key Interactions**:
- **Input**: Storyteller state, progress, life events, session artifacts, requirements table, archetype analysis, requirement_result (with transcript_segment)
- **Output**: Updated state from all subflows that executed, requirements lodged, progress updated
- **Triggers**: **Real-time after EVERY `submit_requirement_result()` call** (not after session completion)

**8 Self-Gating Subflows** (ALL run on every trigger):
| Subflow | Entry Criteria (Self-Gating) |
|---------|------------------------------|
| TrustBuildingSubflow | `!trust_complete` |
| ContextualGroundingSubflow | `trust_complete && !grounding_complete` |
| SectionSelectionSubflow | `grounding_complete && !sections_selected` |
| LaneDevelopmentSubflow | `sections_selected && has_pending_requirements` |
| ArchetypeAssessmentSubflow | `session_count >= 4 && assessment_due` |
| SynthesisSubflow | `section_has_sufficient_material` |
| CompositionSubflow | `phase == composition && sufficiency_gates_passed` |
| EditorSubflow | `has_draft_content && needs_quality_review` |

**Execution Pattern**:
```
ON submit_requirement_result(storyteller_id, requirement_id, transcript_segment, result_data):
  → Load storyteller_state once
  → Run ALL 8 subflows in sequence:
      1. TrustBuildingSubflow.execute()
         → check_entry_criteria: !trust_complete
         → If False: return early (no action)
      2. ContextualGroundingSubflow.execute()
         → check_entry_criteria: trust_complete && !grounding_complete
         → If False: return early (no action)
      3. SectionSelectionSubflow.execute()
         → check_entry_criteria: grounding_complete && !sections_selected
         → If False: return early (no action)
      4. LaneDevelopmentSubflow.execute()
         → check_entry_criteria: sections_selected && has_pending_requirements
         → If True: generate prompts, update session_context
      5. ArchetypeAssessmentSubflow.execute()
         → check_entry_criteria: session_count >= 4 && assessment_due
         → If True: analyze archetypes, lodge strategic requirements
      6. SynthesisSubflow.execute()
         → check_entry_criteria: section_has_sufficient_material
         → If True: create provisional draft
      7. CompositionSubflow.execute()
         → check_entry_criteria: phase == composition && sufficiency_gates_passed
         → If True: update global manuscript
      8. EditorSubflow.execute()
         → check_entry_criteria: has_draft_content && needs_quality_review
         → If True: assess quality, lodge edit requirements
```

**Flow Pattern**: **Requirement Submitted → Analyst runs ALL 8 subflows → State Updated → Ready for next requirement**

---

### 2. SESSION FLOW

**Agent Type**: `session_orchestrator`

**Role**: The **executor**. Conducts goal-oriented story capture sessions with the storyteller through VAPI integration. Calls `submit_requirement_result()` with transcript segments, which triggers the Analyst Flow in real-time.

**Primary Responsibilities**:
- **Pre-Call Preparation**: Load storyteller context, determine session goal, fetch requirements, generate prompts, create VAPI agent
- **Call Execution**: VAPI conducts interview with dynamic agent (voice or text)
- **Requirement Submission**: Call `submit_requirement_result()` with transcript segments for each requirement addressed (triggers Analyst in real-time)
- **Post-Call Processing**: Organize transcript, extract story points, tag metadata (people, places, emotions, themes)
- **Quality Validation**: Check session quality before finalizing (duration, engagement, sentiment)
- **User Verification**: Send session summary for user review/approval
- **Progress Update**: Update storyteller state and section completion

**Key Interactions**:
- **Input**: Session task ID, storyteller ID, subflow type, requirements table, user context
- **Output**: Session record, session artifacts, life events, updated section status
- **Triggers**: Scheduled session reaches time, user manually initiates, system-initiated follow-up
- **Analyst Trigger**: Analyst is triggered by `submit_requirement_result()` calls during session (real-time), NOT by session completion

**Requirement Submission Pattern**:
```python
# During session, for each requirement addressed:
submit_requirement_result(
    storyteller_id="s123",
    requirement_id="req-001",
    transcript_segment="I grew up in a small town in Ohio...",  # REQUIRED
    result_data={...}
)
# This IMMEDIATELY triggers run_analyst_flow.delay()
```

**Execution Phases** (Sequential):
1. **Pre-Call Preparation** → Load context, determine goal, generate prompts, create VAPI agent
2. **Call Execution** → VAPI conducts interview, calls `submit_requirement_result()` for requirements addressed (triggers Analyst in real-time)
3. **Quality Validation** → Check completeness, engagement, sentiment
4. **Post-Call Processing** → Extract story points, create/update life events, create artifacts
5. **User Verification** → Send summary for approval
6. **Final Update** → Update progress, finalize session record

**Flow Pattern**: **Session executes → Submits requirements with transcripts → Analyst triggered in real-time → Session completes**

---

### 3. EDITOR SUBFLOW (Within Analyst Flow)

**Agent Type**: `editor_subflow` (part of 8 self-gating subflows)

**Role**: The **quality gate**. Reviews composed narrative material for craft standards, coherence, and quality. Runs as part of Analyst Flow's 8 self-gating subflows.

**Entry Criteria (Self-Gating)**:
- `has_draft_content`: Composition subflow has created draft content
- `needs_quality_review`: Draft content has not been reviewed or needs re-review

**Primary Responsibilities**:
- **Narrative Quality Review**: Assess chapters for craft standards (0-10 scoring)
- **Coherence Check**: Ensure consistency across chapters (character arcs, timeline, themes)
- **Pacing Analysis**: Evaluate scene-to-summary ratio (target: 70-80% scene), chapter rhythm
- **Character Consistency**: Track character development, voice, relationships
- **Thematic Clarity**: Ensure themes are woven throughout
- **Edit Requirements Lodging**: Lodge issues in Edit Requirements Table (blocking, important, polish)
- **Approval Gating**: Approve material for finalization OR block for revisions

**Key Interactions**:
- **Input**: Storyteller ID, story ID, story chapters, collections, current archetype
- **Output**: Chapter status updates, edit requirements, quality reports
- **Triggers**: Runs automatically when Analyst Flow executes (every `submit_requirement_result()` call) if entry criteria are met

**Assessment Criteria** (per chapter, 0-10 scale):
- Narrative Coherence (flow, transitions, chronology)
- Pacing (scene-to-summary ratio, balance)
- Character Consistency (voice, actions, relationships)
- Sensory Details (all 5 senses, showing vs. telling)
- Thematic Integration (themes present, motifs, arc)
- Emotional Resonance (reflection, opening hook, closing resonance)

**Decision Logic**:
```
check_entry_criteria:
  IF !has_draft_content → return early (no action)
  IF !needs_quality_review → return early (no action)

execute_logic:
  FOR each chapter:
    IF any_score < 6 → lodge edit_requirement (severity: blocking) → chapter.status = needs_revision
    IF any_score < 8 → lodge edit_requirement (severity: important) → chapter.status = needs_polish
    ELSE → chapter.status = approved

  IF all_chapters_approved → story.status = ready_for_export
  ELSE → composition will address edit requirements on next trigger
```

**Flow Pattern**: **Analyst triggers → EditorSubflow checks entry criteria → Reviews if criteria met → Lodges edit requirements → CompositionSubflow addresses on next trigger**

---

## Specialized Subflows (Self-Gating Execution Agents)

These are the 8 self-gating subflows that run within the Analyst Flow. **ALL 8 subflows run on every Analyst trigger** - each subflow checks its own entry criteria and returns early if conditions are not met. This self-gating pattern ensures no selective execution logic in the orchestrator.

**4 Phases of the Journey:**
1. **trust_building** → TrustBuildingSubflow active
2. **history_building** → ContextualGroundingSubflow, SectionSelectionSubflow active
3. **story_capture** → LaneDevelopmentSubflow, ArchetypeAssessmentSubflow, SynthesisSubflow active
4. **composition** → CompositionSubflow, EditorSubflow active

---

### 4. TRUST BUILDING SUBFLOW

**Agent Type**: `trust_building_subflow`

**Parent Flow**: Analyst Flow (one of 8 self-gating subflows)

**Canonical Phase**: trust_building (Phase 1)

**Entry Criteria (Self-Gating)**:
- `!trust_complete`: Trust setup has not been completed

**Role**: Establish psychological safety and gather essential context.

**Responsibilities**:
- **Introduction & Trust Setup**: Reduce anxiety, set expectations ("build outline first", "you can skip anything", "nothing is locked in")
- **Scope Selection**: Determine focus (whole_life | major_chapter | single_event | unsure)
- **Gentle Profile**: Gather boundaries and life structure (checkbox only, no essays)

**Key Outputs**:
- `storyteller_progress.trust_setup_complete = true`
- `storyteller_scope` populated with scope type
- `storyteller_boundary` populated with comfort levels
- `storyteller_preference` populated with book type and working style
- Sections enabled based on scope and profile

**Success Criteria**:
- All three steps completed
- Storyteller feels safe and informed
- Entry criteria changes to False (`trust_complete = true`) → subflow returns early on subsequent triggers

---

### 5. CONTEXTUAL GROUNDING SUBFLOW

**Agent Type**: `contextual_grounding_subflow`

**Parent Flow**: Analyst Flow (one of 8 self-gating subflows)

**Canonical Phase**: history_building (Phase 2)

**Entry Criteria (Self-Gating)**:
- `trust_complete`: Trust setup has been completed
- `!grounding_complete`: Contextual grounding has not been completed

**Role**: Build chronological scaffold to enable memory retrieval.

**Responsibilities**:
- Capture factual context based on scope (birth year, places, schools, moves, work, relationships)
- Create contextual anchor life events (not detailed stories yet—just scaffolding)
- Establish timeline structure

**Scope-Dependent Approach**:
- **whole_life**: Birth year, where grew up, schools, major moves, work phases, relationships, children
- **major_chapter**: When chapter began/ended, where living, primary roles
- **single_event**: What preceded event, who involved, where in life

**Key Outputs**:
- Multiple `life_event` records (type: contextual_anchor)
- `life_event_timespan` records (timeline scaffold)
- `life_event_location` records (places)
- `life_event_participant` records (people)
- `storyteller_progress.contextual_grounding_complete = true`

**Success Criteria**:
- Chronological scaffold established
- Key time/place/role cues captured
- Entry criteria changes (`grounding_complete = true`) → subflow returns early on subsequent triggers

---

### 6. SECTION SELECTION SUBFLOW

**Agent Type**: `section_selection_subflow`

**Parent Flow**: Analyst Flow (one of 8 self-gating subflows)

**Canonical Phase**: history_building (Phase 2)

**Entry Criteria (Self-Gating)**:
- `grounding_complete`: Contextual grounding has been completed
- `!sections_selected`: Section selection has not been completed

**Role**: Allow storyteller to choose which sections of life to explore.

**Responsibilities**:
- Present available sections (enabled by scope and profile)
- Capture storyteller's selections
- Initialize progressive unlocking logic

**Available Sections**:
- **Core** (always enabled): Origins, Childhood, Teen Years, Early Adulthood, Work & Purpose, Values & Beliefs, Milestones, Lessons & Legacy
- **Conditional** (enabled by profile): Love & Partnership, Parenthood, Service & Sacrifice, Major Adventures, Caregiving/Loss

**Key Outputs**:
- `storyteller_section_selection` records for chosen sections
- `storyteller_section_status` updated (unlocked selected sections, locked dependent ones)

**Success Criteria**:
- Sections selected
- Sections appropriately locked/unlocked based on prerequisites
- Entry criteria changes (`sections_selected = true`) → subflow returns early on subsequent triggers

---

### 7. LANE DEVELOPMENT SUBFLOW

**Agent Type**: `lane_development_subflow`

**Parent Flow**: Analyst Flow (one of 8 self-gating subflows)

**Canonical Phase**: story_capture (Phase 3)

**Entry Criteria (Self-Gating)**:
- `sections_selected`: Sections have been selected
- `has_pending_requirements`: There are pending requirements to address

**Role**: Capture rich, scene-based material for a specific narrative lane. **This is the core storytelling engine.**

**Responsibilities**:
- **Apply Prompt Pack Template**:
  1. **Scene** – "Take me to a specific moment…"
  2. **People** – "Who was there? What were they like?"
  3. **Tension** – "What was uncertain, hard, or unresolved?"
  4. **Change** – "Did anything shift for you?" (optional)
  5. **Meaning** – "Looking back, what do you notice now?" (tri-valent)
- **Respect Boundaries**: Check storyteller_boundary and life_event_boundary before each prompt
- **Extract Scene-Based Material**: Identify scenes vs. summaries, extract sensory details (all 5 senses), emotions, people, places, tension, change, reflection
- **Track Lane Progress**: Update `storyteller_section_status` (prompts_answered, completion_percentage)

**Guardrails**:
- Short answers encouraged
- Voice optional (can type or speak)
- Users may skip any prompt
- Consent check before deepening ("Want to zoom in, or stay broad?")

**Key Outputs**:
- `session_artifact` records (type: scene_capture or summary_capture)
- New/updated `life_event` records with rich detail
- Updated `storyteller_section_status` (progress tracked)
- Potentially unlocked new sections (if prerequisites met)
- Requirements marked as addressed via `submit_requirement_result()` with transcript_segment

**Success Criteria**:
- Rich, scene-based material captured (70%+ showing vs. telling)
- Section progress tracked and updated
- Dependent sections unlocked if appropriate
- Requirements addressed (triggers Analyst Flow in real-time)

---

### 8. ARCHETYPE ASSESSMENT SUBFLOW

**Agent Type**: `archetype_assessment_subflow`

**Parent Flow**: Analyst Flow (one of 8 self-gating subflows)

**Canonical Phase**: story_capture (Phase 3)

**Entry Criteria (Self-Gating)**:
- `session_count >= 4`: Minimum sessions for archetype patterns to emerge
- `assessment_due`: Time for next assessment (every 3rd session starting at session 4)

**Role**: Progressive archetype refinement through multi-archetype tracking. Starts with multiple candidate archetypes (**exploring**), narrows to strong contenders (**narrowing**), resolves to single dominant archetype (**resolved**).

**Philosophy**: Don't settle on one archetype too early. Track multiple candidates, use requirements to gather material that clarifies which pattern is most apt. By composition gate, one archetype must be resolved with >= 0.85 confidence.

**Responsibilities**:
- **Multi-Archetype Agentic Assessment**: Analyze material for multiple narrative patterns with confidence scores
- **Refinement Status Determination**:
  - **exploring**: 3+ viable candidates (confidence > 0.60), pattern unclear
  - **narrowing**: 2 strong contenders emerging
  - **resolved**: Single archetype dominant (confidence >= 0.85)
- **Lodge Strategic Requirements**: Based on refinement status, lodge requirements directly
- **Hidden Observer**: Archetype NOT revealed unless user asks ("what's my story shape?")
- **User Verification** (if revealed): Honest presentation of multiple candidates OR resolved archetype

**Archetype Dimensions** (from process.txt):
- **Identity shift**: Who I was → who I became
- **Relationship to loss**: What was lost, how processed
- **Relationship to agency**: Constraints vs. autonomy
- **Relationship to meaning**: What matters, why

**Candidate Archetypes Tracked**:
- `relationship_to_loss`
- `relationship_to_agency`
- `relationship_to_meaning`
- `identity_shift`
- (Each with confidence score, status, evidence, indicators)

**Key Outputs**:
- `archetype_analysis` record with multi-archetype tracking:
  - `candidate_archetypes` (JSONB array with confidence scores)
  - `refinement_status` (exploring | narrowing | resolved)
  - `dominant_archetype` (NULL until resolved)
  - `dominant_confidence` (must be >= 0.85 for composition gate)
  - `revealed_to_user` (false by default)
- Strategic requirements lodged based on refinement status

**Strategic Requirements** (based on refinement status):
- **IF exploring** → Lodge **discriminating requirements** (help choose between top 2 candidates)
- **IF narrowing** → Lodge **validating requirements** (confirm evidence for candidates)
- **IF resolved** → Lodge **strengthening requirements** (deepen the dominant archetype)

**Success Criteria**:
- Multiple candidate archetypes tracked with confidence scores
- Refinement status determined
- Strategic requirements lodged
- Hidden from user unless they ask
- If revealed, honest presentation with user verification
- Progression: exploring → narrowing → resolved over multiple assessments

**Feeds Into**:
- **CompositionSubflow**: Blocks composition unless `refinement_status = 'resolved'` AND `confidence >= 0.85`

---

### 9. SYNTHESIS SUBFLOW

**Agent Type**: `synthesis_subflow`

**Parent Flow**: Analyst Flow (one of 8 self-gating subflows)

**Canonical Phase**: story_capture (Phase 3)

**Entry Criteria (Self-Gating)**:
- `section_has_sufficient_material`: A section has enough captured material to synthesize into a provisional draft

**Role**: Create visible progress by assembling read-only chapter drafts from captured material.

**Responsibilities**:
- **Assemble Provisional Draft**: Gather session artifacts for section, organize into narrative flow (opening hook → chronological/thematic progression → closing resonance)
- **Generate Provisional Text**: Use LLM to weave story points into coherent narrative (maintain user's voice, preserve exact quotes, add transitions, include sensory details)
- **Label as PROVISIONAL**: Explicitly state "DRAFT - Your Review Needed" and "Raw story inputs remain accessible"
- **Create Collection & Synthesis Record**: Link story points to collection with narrative roles
- **User Verification**: Send provisional draft for review (approve, request changes, or redo)

**Key Outputs**:
- `collection` record (provisional draft)
- `collection_life_event` records (links story points with narrative roles)
- `collection_synthesis` record (synthesized text with metadata)
- User verification request

**Success Criteria**:
- Provisional draft assembled with narrative coherence
- Scene-to-summary ratio appropriate (70-80% scene)
- User notified and given control
- Material remains editable and reversible
- Raw inputs preserved and accessible

---

### 10. COMPOSITION SUBFLOW

**Agent Type**: `composition_subflow`

**Parent Flow**: Analyst Flow (one of 8 self-gating subflows)

**Canonical Phase**: composition (Phase 4)

**Entry Criteria (Self-Gating)**:
- `phase == composition`: Storyteller has reached composition phase
- `sufficiency_gates_passed`: All blocking sufficiency gates have passed

**Role**: Once sufficiency gates passed, assemble material into book-grade narrative manuscript. Runs as **global continuous composition** on every Analyst trigger during composition phase.

**BLOCKING Sufficiency Gates** (checked in entry criteria):
1. **Archetype Resolution Gate** (CRITICAL):
   - `archetype_analysis.refinement_status = 'resolved'`
   - `archetype_analysis.dominant_confidence >= 0.85`
   - If revealed to user: `archetype_analysis.user_confirmed = true`
2. **Material Threshold Gate**: Minimum life events per archetype dimension, scene density >= 70%, sensory details present (3+ senses)
3. **Character Development Gate**: Protagonist arc clear, key relationships developed, character voices distinct
4. **Thematic Coherence Gate**: Themes align with resolved archetype, recurring motifs present, meaning-making evident

**Responsibilities**:
- **Initialize Story Structure**: Create story record with archetype, voice, structure
- **Assemble Chapters from Collections**: Transform collections into chapters with narrative purpose
- **Compose Chapter Content**: Organize into sections (opening hook, body scenes, closing resonance), create detailed scenes with all 5 senses
- **Develop Characters**: Create story_character records with full arcs (introduction, development, resolution)
- **Weave Themes**: Map themes to chapters, identify symbols/motifs
- **Calibrate Tone**: Apply tone based on book type preference (reflective, adventure, legacy, healing)
- **Create Draft Version**: Save snapshot for version history
- **Set needs_quality_review**: Flag content for EditorSubflow on next trigger

**Key Outputs**:
- `story` record (manuscript initialized)
- `story_chapter` records (structured chapters)
- `chapter_section` records (scenes, summaries, transitions)
- `story_scene` records (detailed scene construction)
- `story_character` records (crafted characters with arcs)
- `character_relationship` records (relational dynamics)
- `story_theme` records (thematic threads)
- `story_draft` record (version snapshot)
- `needs_quality_review = true` for EditorSubflow to pick up

**Success Criteria**:
- Full manuscript assembled
- Scene-to-summary ratio maintained (70-80% scene)
- Character arcs tracked and complete
- Themes woven throughout
- Tone calibrated to user preference
- Content flagged for EditorSubflow review

---

## Execution Agents (VAPI)

### 11. VAPI AGENT

**Agent Type**: `vapi_interview_agent`

**Role**: The **voice of the system**. Conducts the actual voice or text interviews with the storyteller during sessions.

**Responsibilities**:
- Initiate outbound call (or wait for inbound)
- Conduct interview following session goal and prompts
- Call `GetStoryPointContext` as needed (dynamic retrieval of prior context)
- Call `SaveStorySegment` to persist key moments in real-time
- Ask about next session timing (call `ScheduleNextSession`)
- Handle call end gracefully

**Key Features**:
- **Dynamic agent configuration**: System prompt with storyteller context, boundaries, scope, life events
- **Real-time tools**: `GetStoryPointContext`, `SaveStorySegment`, `ScheduleNextSession`
- **Streaming transcript**: Backend receives chunks, classifies privacy tier, creates checkpoints
- **Recovery mechanism**: If no end_call_report after 20 minutes, background monitor fetches transcript from VAPI

**Key Interactions**:
- **Input**: Agent config from Session Flow (system prompt, tools, first message, context)
- **Output**: Call report (transcript, recording_url, metadata)
- **Parent Flow**: Session Flow

---

## Support Agents (Potential Future)

### 12. RECOVERY MONITOR AGENT

**Agent Type**: `recovery_monitor_agent`

**Role**: Background agent that monitors for stuck sessions and fetches transcripts if VAPI fails to send end_call_report.

**Responsibilities**:
- Monitor sessions for stuck state (no end_call_report after 20 minutes)
- Fetch transcript from VAPI API
- Send to user for review via webapp
- Mark session for manual review

---

## System Components (Not Agents, But Important)

### REQUIREMENTS TABLES

**Purpose**: The connective tissue between flows. Track what needs to happen and what's been addressed.

#### requirement (Story Capture Requirements)
- **Lodged by**: Analyst Flow subflows (gap analysis, archetype assessment)
- **Addressed by**: Session Flow via `submit_requirement_result()` with transcript_segment
- **Validated by**: Analyst Flow subflows (on next trigger)
- **Types**: `scene_detail`, `character_insight`, `thematic_exploration`, `timeline_clarification`, `emotional_context`, `sensory_detail`, `relationship_dynamic`, `turning_point`
- **Priority**: `critical`, `important`, `optional`
- **Archetype Refinement**: `archetype_refinement_purpose` (discriminate, validate, strengthen)
- **Status Flow**: `pending` → `in_progress` → `addressed` → `resolved`
- **Transcript Payload**: Every requirement result includes `transcript_segment` field

#### edit_requirement (Composition Quality Requirements)
- **Lodged by**: EditorSubflow (quality review within Analyst Flow)
- **Addressed by**: CompositionSubflow (on next Analyst trigger)
- **Types**: `flow`, `pacing`, `clarity`, `consistency`, `sensory_detail`, `theme`, `character_voice`, `timeline`, `tone`, `scene_structure`, `showing_vs_telling`, `repetition`
- **Severity**: `blocking`, `important`, `polish`
- **Status Flow**: `pending` → `in_review` → `resolved`

---

## Flow Patterns

### Pattern 1: Real-Time Analyst Trigger (Core Pattern)

```
Session Flow captures story content
  → Requirement addressed with transcript segment
  → submit_requirement_result(
      storyteller_id="s123",
      requirement_id="req-001",
      transcript_segment="I grew up in a small town in Ohio...",
      result_data={...}
    )
  → IMMEDIATELY triggers run_analyst_flow.delay()
  → Analyst Flow runs ALL 8 self-gating subflows:
      1. TrustBuildingSubflow → check_entry_criteria → execute if met
      2. ContextualGroundingSubflow → check_entry_criteria → execute if met
      3. SectionSelectionSubflow → check_entry_criteria → execute if met
      4. LaneDevelopmentSubflow → check_entry_criteria → execute if met
      5. ArchetypeAssessmentSubflow → check_entry_criteria → execute if met
      6. SynthesisSubflow → check_entry_criteria → execute if met
      7. CompositionSubflow → check_entry_criteria → execute if met
      8. EditorSubflow → check_entry_criteria → execute if met
  → State updated by subflows that executed
  → Ready for next requirement submission
```

**This is the core execution pattern. Analyst runs after EVERY requirement submission, NOT after session completion.**

---

### Pattern 2: Self-Gating Subflow Execution

```
ON every Analyst trigger:
  Load storyteller_state once

  FOR each of 8 subflows:
    subflow.check_entry_criteria(storyteller_state)
    IF criteria NOT met:
      → Return early (no action, no state change)
    ELSE:
      → Execute subflow logic
      → Update storyteller_state for subsequent subflows
      → Lodge requirements if applicable
```

**No selective execution logic in orchestrator. ALL subflows run, each gates itself.**

---

### Pattern 3: Composition Phase Loop

```
Analyst triggered during composition phase
  → CompositionSubflow.check_entry_criteria:
      - phase == composition ✓
      - sufficiency_gates_passed ✓
  → CompositionSubflow.execute:
      → Update global manuscript
      → Set needs_quality_review = true

  → EditorSubflow.check_entry_criteria:
      - has_draft_content ✓
      - needs_quality_review ✓
  → EditorSubflow.execute:
      → Assess quality (0-10 scoring)
      → IF issues found:
          → Lodge edit requirements
          → chapter.status = needs_revision
      → ELSE:
          → Approve chapter
          → IF all approved: story.status = ready_for_export
```

**CompositionSubflow and EditorSubflow both run on every trigger during composition phase.**

---

### Pattern 4: Multi-Archetype Refinement (Progressive Narrowing)

```
ArchetypeAssessmentSubflow.check_entry_criteria:
  - session_count >= 4 ✓
  - assessment_due (every 3rd session) ✓

ArchetypeAssessmentSubflow.execute:
  → Multi-archetype agentic assessment
  → Track multiple candidates with confidence scores
  → Determine refinement_status:
      - EXPLORING (3+ viable candidates)
      - NARROWING (2 strong contenders)
      - RESOLVED (1 dominant >= 0.85 confidence)
  → Save to archetype_analysis table (revealed_to_user = FALSE)
  → Lodge strategic requirements:
      - IF exploring → Lodge DISCRIMINATING requirements
      - IF narrowing → Lodge VALIDATING requirements
      - IF resolved → Lodge STRENGTHENING requirements
  → Next assessment in 3 sessions
      → Progressive refinement: exploring → narrowing → resolved

[OPTIONAL: User asks "what's my story shape?"]
  → Reveal archetype
      → IF resolved: Present dominant archetype confidently
      → IF exploring/narrowing: Present multiple candidates honestly
  → User verification:
      → IF confirms: Proceed with archetype
      → IF disagrees: Immediate pivot → Create user_feedback → Re-run assessment
```

**This pattern ensures archetype refinement happens strategically and progressively, with the storyteller maintaining ultimate authority.**

---

## State Transitions

**4 Phases of the Journey:**

```
[Start]
  → Phase 1: trust_building
      └─ TrustBuildingSubflow (introduction, scope, profile)
      └─ Ends when: trust_complete = true

  → Phase 2: history_building
      └─ ContextualGroundingSubflow (timeline scaffold)
      └─ SectionSelectionSubflow (narrative lanes)
      └─ Ends when: grounding_complete = true && sections_selected = true

  → Phase 3: story_capture ←───────────────────────────────────┐
      └─ LaneDevelopmentSubflow (story capture engine)         │
      └─ ArchetypeAssessmentSubflow (multi-archetype tracking) │
      └─ SynthesisSubflow (provisional drafts) ────────────────┘
      └─ Ends when: sufficiency_gates_passed = true

  → Phase 4: composition ←─────────────────────────────────────┐
      └─ CompositionSubflow (global continuous composition)    │
      └─ EditorSubflow (quality review) ───────────────────────┘
      └─ Ends when: all_chapters_approved = true

  → Book Export
      → [Book Delivered]
```

**Key:** Each phase transition occurs when entry criteria for the next phase's subflows become true.

---

## Agent Hierarchy Summary

```
ORCHESTRATOR FLOWS
├─ Analyst Flow (Decision Maker)
│   └─ Runs ALL 8 self-gating subflows on every trigger
│   └─ Triggered by: submit_requirement_result() (real-time)
│   └─ 4 phases: trust_building → history_building → story_capture → composition
│
└─ Session Flow (Executor)
    └─ Conducts story capture sessions via VAPI
    └─ Calls submit_requirement_result() with transcript_segment
    └─ Triggers Analyst Flow in real-time

8 SELF-GATING SUBFLOWS (All run on every Analyst trigger)
├─ TrustBuildingSubflow (gates on: !trust_complete)
├─ ContextualGroundingSubflow (gates on: trust_complete && !grounding_complete)
├─ SectionSelectionSubflow (gates on: grounding_complete && !sections_selected)
├─ LaneDevelopmentSubflow (gates on: sections_selected && has_pending_requirements)
├─ ArchetypeAssessmentSubflow (gates on: session_count >= 4 && assessment_due)
├─ SynthesisSubflow (gates on: section_has_sufficient_material)
├─ CompositionSubflow (gates on: phase == composition && sufficiency_gates_passed)
└─ EditorSubflow (gates on: has_draft_content && needs_quality_review)

EXECUTION AGENTS
└─ VAPI Agent (Voice Interface)

SUPPORT COMPONENTS
├─ Requirements Table (Story Capture Gaps + Transcript Payloads)
└─ Edit Requirements Table (Composition Quality)
```

---

## Key Design Principles

1. **Storyteller as Author**: Nothing is locked in without approval. System proposes, user decides.
2. **Real-Time Analyst Triggers**: Analyst Flow runs after EVERY `submit_requirement_result()` call, not after session completion.
3. **Self-Gating Subflows**: ALL 8 subflows run on every trigger. Each subflow checks its own entry criteria. No selective execution in orchestrator.
4. **4-Phase Journey**: trust_building → history_building → story_capture → composition with clear progression.
5. **Transcript Payloads**: Every requirement submission includes `transcript_segment` for context.
6. **Requirements-Driven**: Flows communicate via Requirements Tables. Subflows lodge requirements → Session addresses → Analyst validates.
7. **Progressive Unlocking**: Sections unlock as prerequisites are met. Momentum builds naturally.
8. **Archetype Refinement**: Multi-archetype tracking with progressive refinement (exploring → narrowing → resolved). Hidden by default, revealed on request.
9. **Quality Gates**: Sessions and chapters validated before progression. Blocking issues prevent advancement.
10. **Trauma-Aware**: Boundary checks at every prompt. Consent required for deepening.
11. **Scene-Based Craft**: 70-80% scene (showing) vs. 20-30% summary (telling). All 5 senses in key scenes.
12. **Iterative Refinement**: Nothing is one-and-done. Provisional drafts, multiple archetype assessments, revision cycles.

---

## Next Steps: Implementation

1. **Phase 1 (MVP)**: Analyst Flow with all 8 self-gating subflows, Session Flow with `submit_requirement_result()` pattern
2. **Phase 2 (Advanced)**: All subflows fully implemented with entry criteria, gap analysis, archetype assessment
3. **Phase 3 (Composition)**: CompositionSubflow and EditorSubflow with quality scoring
4. **Phase 4 (Optimization)**: Session Recovery, Agent-Driven Scheduling, Multi-User Interviews, Advanced Archetype

---

## Conclusion

The Everbound system is built around a **storyteller** (the author) and a network of intelligent agents that guide, facilitate, and refine their life story into a professional memoir. The architecture emphasizes:

- **Real-Time Analyst Triggers**: Analyst runs after EVERY `submit_requirement_result()` call
- **8 Self-Gating Subflows**: ALL subflows run on every trigger, each checking entry criteria
- **4-Phase Journey**: trust_building → history_building → story_capture → composition
- **Transcript Payloads**: Every requirement submission includes transcript segment context
- **Requirements-Driven Execution**: Gap analysis → Lodge → Address → Validate
- **Progressive Refinement**: Archetype, Sections, Composition
- **User Authority**: Verification loops, immediate pivots

This high-level architecture ensures that the system is both powerful (autonomous decision-making) and safe (trauma-aware, user-controlled).

---

**Document Version:** 1.1
**Last Updated:** 2025-12-22
**Status:** Aligned with Analyst Subflow Execution Pattern
