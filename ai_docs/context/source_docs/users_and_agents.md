# Users & Agents: High-Level Architecture

## Overview

The Everbound system is built around a **storyteller** (the human user) and a sophisticated network of **orchestrator flows** and **specialized subflows** that guide the storyteller through the journey from initial trust-building to final book publication.

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

**Role**: The **decision-making brain** of the system. Continuously assesses storyteller state to determine what needs to happen next.

**Primary Responsibilities**:
- **Phase Assessment**: Determine current phase in canonical process (trust → scope → context → capture → synthesis → composition)
- **Completeness Check**: Evaluate material against phase requirements
- **Gap Identification**: Identify missing context, scenes, characters, themes, sensory details
- **Requirements Lodging**: Create/update requirements in the Requirements Table (critical, important, optional)
- **Next Action Determination**: Decide which subflow should execute next
- **Section Unlocking**: Progressively unlock new narrative lanes as prerequisites are met
- **Archetype-Aware Strategy**: Lodge discriminating, validating, or strengthening requirements based on archetype refinement status

**Key Interactions**:
- **Input**: Storyteller state, progress, life events, session artifacts, requirements table, archetype analysis
- **Output**: Updated requirements, next subflow instruction, section status updates, progress state
- **Triggers**: After session completion, on new storyteller initialization, when user requests next steps, periodically (e.g., after 7 days inactivity)

**Decision Logic**:
```
IF phase = null → lodge "complete_trust_setup" → RETURN trust_building
IF phase = trust_building AND complete → transition to history_building → RETURN contextual_grounding
IF phase = history_building AND timeline ready → transition to story_capture → RETURN lane_development
IF phase = story_capture → evaluate sections → lodge requirements → RETURN lane_development (next section)
  └─ ALSO: every 3rd session → trigger archetype_assessment
  └─ IF archetype exploring → lodge discriminating requirements
  └─ IF archetype narrowing → lodge validating requirements
  └─ IF archetype resolved → lodge strengthening requirements
IF phase = composition → RETURN editor_orchestrator
```

**Flow Pattern**: **Analyst → Requirements → Session → Analyst (Loop)**

---

### 2. SESSION FLOW

**Agent Type**: `session_orchestrator`

**Role**: The **executor**. Conducts goal-oriented story capture sessions with the storyteller through VAPI integration.

**Primary Responsibilities**:
- **Pre-Call Preparation**: Load storyteller context, determine session goal, fetch requirements, generate prompts, create VAPI agent
- **Call Execution**: VAPI conducts interview with dynamic agent (voice or text)
- **Post-Call Processing**: Organize transcript, extract story points, tag metadata (people, places, emotions, themes)
- **Quality Validation**: Check session quality before finalizing (duration, engagement, sentiment)
- **User Verification**: Send session summary for user review/approval
- **Progress Update**: Update storyteller state and section completion
- **Trigger Analyst**: Kick off Analyst Flow to determine next steps

**Key Interactions**:
- **Input**: Session task ID, storyteller ID, subflow type (from Analyst), requirements table, user context
- **Output**: Session record, session artifacts, life events, updated section status, trigger to Analyst Flow
- **Triggers**: Scheduled session reaches time, user manually initiates, system-initiated follow-up

**Execution Phases** (Sequential):
1. **Pre-Call Preparation** → Load context, determine goal, generate prompts, create VAPI agent
2. **Call Execution** → VAPI conducts interview
3. **Quality Validation** → Check completeness, engagement, sentiment
4. **Post-Call Processing** → Extract story points, create/update life events, create artifacts
5. **User Verification** → Send summary for approval
6. **Trigger Next Steps** → Update progress, mark requirements addressed, trigger Analyst

**Flow Pattern**: **Session executes → Updates state → Marks requirements addressed → Triggers Analyst**

---

### 3. EDITOR FLOW

**Agent Type**: `editor_orchestrator`

**Role**: The **quality gate**. Reviews composed narrative material for craft standards, coherence, and quality.

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
- **Output**: Chapter status updates, edit requirements, quality reports, next subflow instruction
- **Triggers**: Analyst Flow determines sufficiency gates passed, after composition subflow creates chapters, user requests review, periodically during composition phase

**Assessment Criteria** (per chapter, 0-10 scale):
- Narrative Coherence (flow, transitions, chronology)
- Pacing (scene-to-summary ratio, balance)
- Character Consistency (voice, actions, relationships)
- Sensory Details (all 5 senses, showing vs. telling)
- Thematic Integration (themes present, motifs, arc)
- Emotional Resonance (reflection, opening hook, closing resonance)

**Decision Logic**:
```
FOR each chapter:
  IF any_score < 6 → lodge edit_requirement (severity: blocking) → chapter.status = needs_revision
  IF any_score < 8 → lodge edit_requirement (severity: important) → chapter.status = needs_polish
  ELSE → chapter.status = approved

IF all_chapters_approved → story.status = ready_for_export → RETURN book_export
ELSE → RETURN composition (address edit requirements)
```

**Flow Pattern**: **Editor reviews → Lodges edit requirements → Composition addresses → Editor re-reviews (Loop)**

---

## Specialized Subflows (Execution Agents)

These are narrow-scope execution agents called by orchestrator flows. They have specific goals and clear success criteria.

---

### 4. TRUST BUILDING SUBFLOW

**Agent Type**: `trust_building_subflow`

**Parent Flow**: Session Flow (executed by)

**Canonical Phase**: Phase 1-3 (Introduction & Trust Setup, Scope Selection, Gentle Profile)

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
- Ready to transition to history building phase

---

### 5. CONTEXTUAL GROUNDING SUBFLOW

**Agent Type**: `contextual_grounding_subflow`

**Parent Flow**: Session Flow

**Canonical Phase**: Phase 4 (Facts Before Story)

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
- Ready for section selection and deep story capture

---

### 6. SECTION SELECTION SUBFLOW

**Agent Type**: `section_selection_subflow`

**Parent Flow**: Session Flow

**Canonical Phase**: Phase 5 (Narrative Lanes)

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
- Ready to start lane development

---

### 7. LANE DEVELOPMENT SUBFLOW

**Agent Type**: `lane_development_subflow`

**Parent Flow**: Session Flow

**Canonical Phase**: Phase 6 (Guided Story Capture - The Engine)

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
- Requirements marked as addressed

**Success Criteria**:
- Rich, scene-based material captured (70%+ showing vs. telling)
- Section progress tracked and updated
- Dependent sections unlocked if appropriate
- Requirements addressed

---

### 8. ARCHETYPE ASSESSMENT SUBFLOW

**Agent Type**: `archetype_assessment_subflow`

**Parent Flow**: Analyst Flow (NOT Session Flow—this is analysis, not capture)

**Canonical Phase**: Phase 10 (Archetype Inference - Multi-Archetype Refinement)

**Role**: Progressive archetype refinement through multi-archetype tracking. Starts with multiple candidate archetypes (**exploring**), narrows to strong contenders (**narrowing**), resolves to single dominant archetype (**resolved**).

**Philosophy**: Don't settle on one archetype too early. Track multiple candidates, use requirements to gather material that clarifies which pattern is most apt. By composition gate, one archetype must be resolved with >= 0.85 confidence.

**Responsibilities**:
- **Multi-Archetype Agentic Assessment**: Analyze material for multiple narrative patterns with confidence scores
- **Refinement Status Determination**:
  - **exploring**: 3+ viable candidates (confidence > 0.60), pattern unclear
  - **narrowing**: 2 strong contenders emerging
  - **resolved**: Single archetype dominant (confidence >= 0.85)
- **Signal Analyst Flow**: Return refinement status so Analyst can lodge strategic requirements
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
- Signal to Analyst Flow about strategic requirements to lodge

**Analyst Flow Response** (based on refinement status):
- **IF exploring** → Lodge **discriminating requirements** (help choose between top 2 candidates)
- **IF narrowing** → Lodge **validating requirements** (confirm evidence for candidates)
- **IF resolved** → Lodge **strengthening requirements** (deepen the dominant archetype)

**Triggers**:
- Session count >= 4 AND session_count % 3 == 0 (every 3rd session starting at session 4)
- User asks "what's my story shape?" or "how does this fit together?"
- Before composition gate (must validate archetype resolved)
- Manual trigger by admin

**Success Criteria**:
- Multiple candidate archetypes tracked with confidence scores
- Refinement status determined
- Hidden from user unless they ask
- If revealed, honest presentation with user verification
- Analyst Flow signaled with strategic guidance
- Progression: exploring → narrowing → resolved over multiple assessments

**Feeds Into**:
- **Analyst Flow**: Uses refinement status to lodge discriminating/validating/strengthening requirements
- **Composition Gate**: Blocks composition unless `refinement_status = 'resolved'` AND `confidence >= 0.85`

---

### 9. SYNTHESIS SUBFLOW

**Agent Type**: `synthesis_subflow`

**Parent Flow**: Analyst Flow

**Canonical Phase**: Phase 9 (Synthesis Checkpoints - Provisional)

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

**Parent Flow**: Editor Flow

**Canonical Phase**: Phase 12 (Story Writing - Composition)

**Role**: Once sufficiency gates passed, assemble material into book-grade narrative manuscript.

**BLOCKING Sufficiency Gates** (must ALL pass before composition begins):
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

**Key Outputs**:
- `story` record (manuscript initialized)
- `story_chapter` records (structured chapters)
- `chapter_section` records (scenes, summaries, transitions)
- `story_scene` records (detailed scene construction)
- `story_character` records (crafted characters with arcs)
- `character_relationship` records (relational dynamics)
- `story_theme` records (thematic threads)
- `story_draft` record (version snapshot)
- Editor Flow triggered for quality review

**Success Criteria**:
- Full manuscript assembled
- Scene-to-summary ratio maintained (70-80% scene)
- Character arcs tracked and complete
- Themes woven throughout
- Tone calibrated to user preference
- Ready for Editor Flow review

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
- **Lodged by**: Analyst Flow (gap analysis)
- **Addressed by**: Session Flow (during lane development)
- **Validated by**: Analyst Flow (confirm resolution)
- **Types**: `scene_detail`, `character_insight`, `thematic_exploration`, `timeline_clarification`, `emotional_context`, `sensory_detail`, `relationship_dynamic`, `turning_point`
- **Priority**: `critical`, `important`, `optional`
- **Archetype Refinement**: `archetype_refinement_purpose` (discriminate, validate, strengthen)
- **Status Flow**: `pending` → `in_progress` → `addressed` → `resolved`

#### edit_requirement (Composition Quality Requirements)
- **Lodged by**: Editor Flow (quality review)
- **Addressed by**: Composition Subflow (revision cycle)
- **Types**: `flow`, `pacing`, `clarity`, `consistency`, `sensory_detail`, `theme`, `character_voice`, `timeline`, `tone`, `scene_structure`, `showing_vs_telling`, `repetition`
- **Severity**: `blocking`, `important`, `polish`
- **Status Flow**: `pending` → `in_review` → `resolved`

---

## Flow Patterns

### Pattern 1: Analyst → Session → Analyst Loop

```
Analyst Flow (assess state)
  → Lodge requirements in Requirements Table
  → Determine next subflow
  → Trigger Session Flow
      → Session Flow executes subflow (e.g., lane_development)
      → Updates storyteller state
      → Marks requirements as "addressed"
  → Trigger Analyst Flow
      → Analyst validates if requirements are "resolved"
      → Determine next action (loop or transition to next phase)
```

**This is the primary loop during story capture phase.**

---

### Pattern 2: Editor → Composition → Editor Loop

```
Analyst Flow (sufficiency gates passed)
  → Trigger Composition Subflow
      → Assemble chapters from collections
      → Generate manuscript
  → Trigger Editor Flow
      → Review chapters for quality
      → Assess craft standards (0-10 scoring)
      → IF issues found:
          → Lodge edit requirements in Edit Requirements Table
          → IF blocking: chapter.status = needs_revision
          → Return to Composition Subflow
              → Address requirements
              → Create revised draft
          → Re-trigger Editor Flow (iterative refinement)
      → ELSE:
          → Approve chapter
          → Continue to next chapter
  → IF all chapters approved:
      → Transition to Book Export
```

**This is the primary loop during composition phase.**

---

### Pattern 3: Multi-Archetype Refinement (Progressive Narrowing)

```
Session 4+ completed
  → Analyst Flow (every 3rd session)
      → Trigger Archetype Assessment Subflow
          → Multi-archetype agentic assessment
          → Track multiple candidates with confidence scores
          → Determine refinement status:
              - EXPLORING (3+ viable candidates)
              - NARROWING (2 strong contenders)
              - RESOLVED (1 dominant >= 0.85 confidence)
          → Save to archetype_analysis table (revealed_to_user = FALSE)
          → Signal Analyst Flow:
              - IF exploring → Lodge DISCRIMINATING requirements
              - IF narrowing → Lodge VALIDATING requirements
              - IF resolved → Lodge STRENGTHENING requirements
      → Analyst lodges strategic requirements in Requirements Table
      → Continue normal flow (archetype hidden)
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

```
[Start]
  → Trust Building (Phases 1-3)
      → History Building (Phase 4)
          → Story Capture (Phase 6) ←─┐
              ↓                        │
              ├─→ Synthesis (Phase 9) ─┘ (Provisional drafts)
              │
              ↓ (Sufficiency gates passed)
          → Composition (Phase 12) ←─┐
              ↓                      │
          → Editing ─────────────────┘ (Iterative refinement)
              ↓ (All chapters approved)
          → Export (Phase 13)
              → [Book Delivered]
```

---

## Agent Hierarchy Summary

```
ORCHESTRATORS (Primary Flows)
├─ Analyst Flow (Decision Maker)
│   └─ Lodges requirements
│   └─ Triggers subflows
│   └─ Determines next actions
│
├─ Session Flow (Executor)
│   └─ Executes subflows
│   └─ Conducts sessions via VAPI
│   └─ Addresses requirements
│
└─ Editor Flow (Quality Gate)
    └─ Reviews chapters
    └─ Lodges edit requirements
    └─ Approves or blocks progression

SUBFLOWS (Specialized Execution)
├─ Trust Building Subflow
├─ Contextual Grounding Subflow
├─ Section Selection Subflow
├─ Lane Development Subflow (The Engine)
├─ Archetype Assessment Subflow (Hidden Observer)
├─ Synthesis Subflow (Provisional Drafts)
└─ Composition Subflow (Final Manuscript)

EXECUTION AGENTS
└─ VAPI Agent (Voice Interface)

SUPPORT COMPONENTS
├─ Requirements Table (Story Capture Gaps)
└─ Edit Requirements Table (Composition Quality)
```

---

## Key Design Principles

1. **Storyteller as Author**: Nothing is locked in without approval. System proposes, user decides.
2. **Orchestrators + Subflows**: Clear separation between decision-making (orchestrators) and execution (subflows).
3. **Requirements-Driven**: Flows communicate via Requirements Tables. Analyst identifies gaps → Sessions address → Analyst validates.
4. **Progressive Unlocking**: Sections unlock as prerequisites are met. Momentum builds naturally.
5. **Archetype Refinement**: Multi-archetype tracking with progressive refinement (exploring → narrowing → resolved). Hidden by default, revealed on request.
6. **Quality Gates**: Sessions and chapters validated before progression. Blocking issues prevent advancement.
7. **Feedback Loops**: Analyst → Session → Analyst (story capture), Editor → Composition → Editor (manuscript refinement).
8. **Trauma-Aware**: Boundary checks at every prompt. Consent required for deepening.
9. **Scene-Based Craft**: 70-80% scene (showing) vs. 20-30% summary (telling). All 5 senses in key scenes.
10. **Iterative Refinement**: Nothing is one-and-done. Provisional drafts, multiple archetype assessments, revision cycles.

---

## Next Steps: Implementation

1. **Phase 1 (MVP)**: Analyst Flow (basic), Session Flow (complete), Trust Building, Contextual Grounding, Section Selection, Lane Development (basic)
2. **Phase 2 (Advanced)**: Analyst Flow (gap analysis + requirements), Lane Development (advanced), Archetype Assessment, Synthesis
3. **Phase 3 (Composition)**: Editor Flow, Composition Subflow, Book Export
4. **Phase 4 (Optimization)**: Session Recovery, Agent-Driven Scheduling, Multi-User Interviews, Advanced Archetype

---

## Conclusion

The Everbound system is built around a **storyteller** (the author) and a network of intelligent agents that guide, facilitate, and refine their life story into a professional memoir. The architecture emphasizes:

- **Orchestration** (Analyst, Session, Editor Flows)
- **Specialization** (Subflows with narrow scope)
- **Requirements-Driven Execution** (Gap analysis → Lodge → Address → Validate)
- **Progressive Refinement** (Archetype, Sections, Composition)
- **User Authority** (Verification loops, immediate pivots)

This high-level architecture ensures that the system is both powerful (autonomous decision-making) and safe (trauma-aware, user-controlled).
