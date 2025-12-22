# Schema Design Overview

## Introduction

This document describes the complete database schema for the Everbound life story capture and book formation system. The schema is designed to support the canonical process flow documented in `process.txt`:

**Trust → Scope → Context → Capture → Synthesis → Verification → Book**

The system transforms personal memories into professional-quality memoirs through a structured, ethical, and trauma-aware process.

---

## Core Design Principles

### 1. **Storyteller as Author**
The storyteller maintains authorship at every step. The system proposes, reflects, verifies, and pivots—never imposes.

### 2. **Event-Centric Organization**
Life events are the fundamental unit. Everything else—collections, sessions, stories—builds from events.

### 3. **Process-Driven Flow**
The canonical process (11 phases) guides the entire journey. Process nodes define what happens, sessions execute it, agents facilitate it.

### 4. **Hierarchical Flexibility**
```
Life Events → Collections → Stories (Books)
           → Sessions
           → Chapters → Sections → Scenes
```

### 5. **Privacy & Trauma Awareness**
- Two-level boundaries (storyteller-wide + event-specific)
- Trauma classification with resolution tracking
- Tiered sensitivity (Tier 1: safe, Tier 2: optional, Tier 3: private)
- Consent tracking throughout

### 6. **Provisional by Default**
Synthesis outputs, archetypes, collections, and drafts are provisional until user confirms. Nothing is locked in.

### 7. **Scene-Based Memoir Craft**
Following memoir best practices: 70-80% scene (showing) vs. 20-30% summary (telling), with rich sensory details and reflection.

---

## Schema Files

### Core Schemas

#### [process_schema.md](process_schema.md)
**Purpose**: Defines the canonical process flow that guides storytelling.

**Key Tables**:
- `process_version` - Versionable process definitions
- `process_commitment` - Non-negotiable design principles
- `process_node` - Individual phases (Trust Setup, Scope Selection, etc.)
- `process_flow_edge` - Conditional paths between nodes
- `process_section` - Narrative lanes (Origins, Childhood, Work & Purpose, etc.)
- `process_prompt` - Individual prompts within nodes
- `session_progress` - Tracks storyteller journey through nodes

**Role**: The "operating system" of the entire application. Everything else executes within the process framework.

---

#### [storyteller_schema.md](storyteller_schema.md)
**Purpose**: Defines storytellers and their life events (the raw material).

**Key Tables**:
- `storyteller` - The person (immutable facts only: DOB, birthplace)
- `storyteller_boundary` - General comfort levels
- `storyteller_preference` - Working style and book goals
- `life_event` - Core organizing principle (not timeline!)
- `life_event_timespan` - Events can have multiple timespans
- `life_event_location` - Multiple places per event
- `life_event_participant` - People involved with specific roles
- `life_event_detail` - Flexible key-value facts
- `life_event_trauma` - Trauma classification and resolution
- `life_event_boundary` - Event-specific privacy overrides
- `life_event_media` - Photos, documents, letters

**Role**: Foundation layer. Life events are the raw material that everything builds from.

**Key Design**:
- Storyteller contains ONLY immutable facts
- Life events are NOT organized by timeline—timeline is derived
- Events have flexible hierarchical children (timespans, locations, participants, details)
- Two-level boundaries (general + event-specific)

---

#### [session_schema.md](session_schema.md)
**Purpose**: Discrete goal-oriented exchanges between storyteller and agent.

**Key Tables**:
- `session` - Goal-oriented exchanges with intention, success/completion indicators
- `session_life_event` - Many-to-many: sessions can span multiple events
- `session_interaction` - Individual prompt/response exchanges
- `session_artifact` - Outputs created (scene captures, timeline entries, drafts)
- `session_template` - Reusable session templates
- `session_note` - Observations and insights

**Role**: Execution layer. Sessions are where the actual story capture happens.

**Key Design**:
- Sessions have clear intentions and measurable completion criteria
- Can be scheduled in advance
- Many-to-many with life events (childhood session touches multiple events)
- Tracks every interaction for audit trail
- Produces artifacts (provisional by default)

---

#### [collection_schema.md](collection_schema.md)
**Purpose**: Groups of life events organized by theme, archetype, timeline, or principle.

**Key Tables**:
- `collection` - Group of events by organizing principle
- `collection_life_event` - Many-to-many with narrative roles
- `collection_grouping` - Collections of collections
- `collection_grouping_member` - Hierarchical organization
- `collection_relationship` - How collections relate to each other
- `collection_synthesis` - AI-generated analysis and drafts
- `collection_tag` - Flexible tagging

**Role**: Synthesis layer. Raw events → meaningful collections.

**Key Design**:
- Flexible organizing principles (theme, archetype, timeline, relationship, place, custom)
- Events can belong to multiple collections (military service in both "1970s" AND "trauma journey")
- Hierarchical: events → collections → groupings
- Archetype patterns from process.txt (loss_to_connection, transformation, endurance, etc.)
- Provisional by default, user approves
- Maps to book chapters/sections

---

#### [story_schema.md](story_schema.md)
**Purpose**: The actual book manuscript with chapters, scenes, and characters.

**Key Tables**:
- `story` - The book with archetype, voice, structure
- `story_chapter` - Chapters with narrative position, arcs, hooks
- `chapter_section` - Sections (scene, summary, reflection, transition)
- `story_collection` - Many-to-many: chapters draw from collections
- `story_character` - Real people as crafted characters with arcs
- `character_relationship` - Relational dynamics
- `character_appearance` - Tracks presence across chapters
- `story_theme` - Thematic threads with symbols/motifs
- `chapter_theme` - Which themes in which chapters
- `story_scene` - Individual scenes with sensory details
- `story_draft` - Version history

**Role**: Manuscript layer. Collections → crafted narrative.

**Key Design**:
- Memoir craft principles embedded (scene-to-summary ratio, showing vs. telling)
- Characters (real people) have full arcs
- Scenes have all five senses + reflection
- Chapters have opening hooks and closing resonance
- Privacy ethics (pseudonyms, composite characters, consent)
- Many-to-many with collections (transforms raw material into narrative)

---

#### [system_operations_schema.md](system_operations_schema.md)
**Purpose**: Operational infrastructure for tracking progress, feedback, agents, and exports.

**Key Tables**:
- `storyteller_progress` - Journey through canonical phases
- `storyteller_section_selection` - Which narrative lanes chosen
- `storyteller_section_status` - Locked → Unlocked → Completed
- `scope_type` - Formal scope definitions with implications
- `archetype_analysis` - AI inference with confidence scores
- `user_feedback` - Centralized feedback on any element
- `agent` - Reusable agent definitions
- `agent_instance` - Agent instantiation for sessions
- `book_export` - Final manuscript generation
- `book_export_delivery` - Delivery tracking

**Role**: Operations layer. Progress tracking, quality control, agent management, and output delivery.

**Key Design**:
- Progressive unlocking based on scope and prerequisites
- Archetype hidden by default, revealed on request (per process.txt)
- User verification with immediate pivot if misaligned
- Agents are reusable definitions, instantiated with context
- Centralized feedback enables learning and improvement

---

## Data Flow: The Complete Journey

### Phase 1-3: Onboarding & Setup

```
User Account Created
↓
Storyteller Record Created
  - Immutable facts: name, DOB, birthplace
  - storyteller_boundary initialized
  - storyteller_preference initialized
  - storyteller_progress initialized (phase: trust_setup)
↓
Scope Selected (whole_life | major_chapter | single_event | unsure)
  - session_scope created
  - scope_type defines implications
  - storyteller_section_status: sections unlocked based on scope
↓
Profile Completed (boundaries, life structure)
  - storyteller_boundary populated
  - Additional sections unlocked based on profile
```

### Phase 4-6: Context & Capture

```
Contextual Grounding
↓
Life Events Created
  - life_event (the core)
  - life_event_timespan (multiple spans)
  - life_event_location (multiple places)
  - life_event_participant (people with roles)
  - life_event_detail (flexible facts)
  - life_event_trauma (if applicable)
  - life_event_boundary (event-specific privacy)
↓
Sessions Conducted
  - session created with intention & criteria
  - agent_instance created with context
  - session_life_event links to events being explored
  - session_interaction tracks each prompt/response
  - session_artifact creates outputs
  - storyteller_section_status updated (in_progress)
↓
Progressive Unlocking
  - As sections complete, new sections unlock
  - storyteller_section_status: locked → unlocked
```

### Phase 7-9: Synthesis & Collections

```
Events Accumulated
↓
Collections Created (theme, archetype, timeline, relationship)
  - collection organized by principle
  - collection_life_event links events with narrative roles
  - collection_synthesis generates provisional drafts
  - collection_tag for flexible categorization
↓
Collections Grouped
  - collection_grouping (e.g., "Part II: Relationships")
  - collection_grouping_member links collections
↓
Archetype Analysis (hidden by default)
  - archetype_analysis infers patterns
  - confidence_score, supporting_evidence
  - revealed_to_user = false initially
  - User asks "what's my story shape?"
  - System reveals, user verifies
  - If misaligned: user_feedback → immediate reanalysis
```

### Phase 10-11: Story & Book Formation

```
Collections Approved
↓
Story Created (the manuscript)
  - story with overall archetype, voice, structure
  - story_collection links chapters to collections
↓
Chapters Structured
  - story_chapter with narrative position, arcs
  - chapter_section (scene, summary, reflection)
  - story_scene with sensory details + reflection
  - chapter_theme weaves themes throughout
↓
Characters Developed
  - story_character (real people as crafted characters)
  - character_relationship (dynamics)
  - character_appearance (tracking across chapters)
  - Character arcs (growth, transformation)
↓
Drafts & Revisions
  - story_draft tracks versions
  - user_feedback on drafts
  - Iterative refinement
↓
Book Export
  - book_export generated (PDF, EPUB, DOCX, etc.)
  - book_export_delivery tracks delivery
  - Final manuscript delivered
```

---

## Key Relationships & Interplay

### 1. Process Guides Everything

```
process_version (the operating system)
  ↓
process_node (phases: trust, scope, capture, synthesis, etc.)
  ↓
session (executes a specific process node goal)
  ↓
agent_instance (facilitates the session)
  ↓
session_interaction (individual exchanges)
  ↓
session_artifact (outputs)
  ↓
life_event (raw material captured)
```

**The Process is the Backbone**: Every action happens within the process framework. Process nodes define what should happen, sessions execute it, agents facilitate it, and artifacts are produced.

---

### 2. Life Events → Collections → Story

```
life_event (raw material)
  - Military service 1968-1972
  - Deployed to Vietnam 1970-1971
  - PTSD struggles 1972-1985
  ↓
collection (organized by principle)
  - "Military Service and Aftermath" (theme)
  - "The 1970s" (timeline)
  - "Trauma Journey" (archetype: endurance)
  ↓
story_chapter (crafted narrative)
  - Chapter 5: "In Country"
    - Section 1: Scene - Arrival in Saigon (sensory immersion)
    - Section 2: Scene - First patrol (tension, fear)
    - Section 3: Summary - Months of routine and terror
    - Section 4: Reflection - What I didn't know would follow me home
```

**Transformation**: Raw events are organized into collections, which inform chapters. But collections are not chapters—they're transformed through memoir craft into narrative.

---

### 3. Boundaries Flow Down

```
storyteller_boundary (general defaults)
  ↓
life_event_boundary (event-specific overrides)
  ↓
process_prompt.sensitivity_tier (prompt-level sensitivity)
  ↓
Agent checks boundaries before each prompt
```

**Privacy Protection**: System checks multiple levels of boundaries before showing sensitive prompts. Event-specific boundaries override general ones.

---

### 4. Progressive Unlocking

```
Scope Selection
  ↓
scope_type.enabled_sections
  ↓
storyteller_section_status: locked → unlocked
  ↓
User works on section
  ↓
section completes (prompts_answered >= threshold)
  ↓
storyteller_section_status: completed
  ↓
Check prerequisites on other sections
  ↓
process_section.unlock_after_section_id met
  ↓
storyteller_section_status: locked → unlocked (new sections)
```

**Momentum Building**: Sections unlock progressively to avoid overwhelm. Each completion unlocks new possibilities.

---

### 5. Archetype Verification Loop

```
Material accumulated
  ↓
archetype_analysis runs (AI inference)
  - inferred_archetype: "loss_to_connection"
  - confidence_score: 0.85
  - supporting_evidence: {...}
  - revealed_to_user: false (hidden!)
  ↓
User asks "what's my story shape?"
  ↓
System reveals archetype
  ↓
User responds:
  - Confirms → user_confirmed = true → Apply to collection/story
  - Disagrees → user_feedback created → Reanalyze immediately
```

**User Authority**: Archetype is inferred but not imposed. User verification is essential. Immediate pivot if misaligned.

---

### 6. Agent Context Assembly

```
session created
  ↓
agent selected (capture_agent, synthesis_agent, etc.)
  ↓
agent_instance created with context:
  {
    storyteller: {name, birth_year, ...},
    boundaries: {comfortable_discussing_trauma: false, ...},
    scope: {scope_type: "whole_life", timeframe: ...},
    current_section: {section_name: "Childhood", ...},
    life_events: [{event_name: "Growing up in Boston", ...}, ...],
    progress: {current_phase: "story_capture", completion: 45%, ...}
  }
  ↓
Agent uses context to:
  - Personalize prompts
  - Respect boundaries
  - Focus on relevant events
  - Track toward session goals
```

**Smart Agents**: Agents receive rich context about storyteller, boundaries, scope, and progress to provide personalized, safe guidance.

---

### 7. Feedback Improves System

```
user_feedback created on:
  - Prompt (too invasive)
  - Synthesis (tone feels off)
  - Archetype (doesn't resonate)
  - Chapter draft (missing key moment)
  ↓
feedback.resolution_status: pending
  ↓
Agent/system responds
  ↓
resolution_status: resolved
  ↓
feedback.used_for_improvement = true
  ↓
Update prompts, synthesis logic, archetype inference
```

**Learning Loop**: Centralized feedback enables continuous improvement across all system elements.

---

## Critical Design Decisions

### 1. **Events Over Timeline**

**Decision**: Life events are NOT organized by timeline. Timeline is derived from events.

**Rationale**:
- Faith journey spans decades with multiple phases
- Military service has overlapping deployment periods
- Events are organized by meaning, not just chronology

**Implementation**: `life_event_timespan` allows multiple timespans per event. Timeline views are computed on-demand.

---

### 2. **Collections Bridge Events and Story**

**Decision**: Collections are the intermediate layer between raw events and crafted narrative.

**Rationale**:
- Events are factual and flexible
- Stories require narrative structure
- Collections organize events by theme/archetype/meaning before crafting into chapters

**Implementation**: Collections have archetype patterns and narrative arcs. `story_collection` links chapters to collections, but transformation happens (raw material → crafted scenes).

---

### 3. **Two-Level Boundaries**

**Decision**: Boundaries exist at both storyteller level (general) and event level (specific).

**Rationale**:
- "I'm okay discussing loss generally, but not my daughter's death"
- Need granular control for trauma-aware storytelling

**Implementation**: `storyteller_boundary` sets defaults, `life_event_boundary` overrides per event. System checks both before prompting.

---

### 4. **Trauma Classification**

**Decision**: Explicit trauma markers with resolution tracking.

**Rationale**:
- Trauma requires different handling
- Resolution status changes approach (gentle vs. normal)
- Consent required for deepening

**Implementation**: `life_event_trauma` with status (ongoing | resolved | partially_resolved). Business logic adjusts agent tone, requires consent, tracks carefully.

---

### 5. **Archetype Hidden by Default**

**Decision**: Archetype analysis happens internally but is hidden unless user asks.

**Rationale** (from process.txt):
- Archetypes are structural, not prescriptive
- Meaning always belongs to user
- Avoid imposing interpretation

**Implementation**: `archetype_analysis.revealed_to_user = false` by default. Revealed only when user asks for "story map" or "narrative shape". User verification required.

---

### 6. **Provisional Everything**

**Decision**: Synthesis outputs, collections, drafts are provisional until confirmed.

**Rationale**:
- Nothing is locked in (process.txt commitment)
- User remains author at every step
- System proposes, user decides

**Implementation**: `is_provisional` flags throughout. Explicit approval workflow. Raw inputs remain accessible.

---

### 7. **Scene-Based Craft**

**Decision**: Memoir emphasizes scenes (showing) over summary (telling).

**Rationale**:
- Memoir craft best practice: 70-80% scene
- Scenes are immersive, engaging, memorable
- Summary provides pacing and context

**Implementation**: `chapter_section.section_type` distinguishes scene vs. summary. `story_chapter.scene_to_summary_ratio` tracked. `story_scene` emphasizes sensory details.

---

### 8. **Agent Reusability**

**Decision**: Agents are reusable definitions, instantiated per session with context.

**Rationale**:
- Don't redefine agents for each storyteller
- Consistent behavior across users
- Context personalizes without rebuilding

**Implementation**: `agent` table defines reusable agents. `agent_instance` instantiates with storyteller-specific context. Multiple instances can run concurrently.

---

## Data Access Patterns

### Common Queries

#### Get Storyteller Dashboard
```sql
-- Progress overview
SELECT sp.current_phase, sp.overall_completion_percentage, sp.last_active_at
FROM storyteller_progress sp
WHERE sp.storyteller_id = ?;

-- Section status
SELECT ps.section_name, sss.status, sss.completion_percentage
FROM storyteller_section_status sss
JOIN process_section ps ON sss.process_section_id = ps.id
WHERE sss.storyteller_id = ?
ORDER BY ps.order_index;

-- Recent sessions
SELECT s.session_name, s.scheduled_at, s.status
FROM session s
WHERE s.storyteller_id = ?
ORDER BY s.scheduled_at DESC LIMIT 5;
```

#### Get Life Events for Collection
```sql
-- Events in collection with narrative roles
SELECT le.*, cle.narrative_role, cle.sequence_order
FROM life_event le
JOIN collection_life_event cle ON le.id = cle.life_event_id
WHERE cle.collection_id = ?
ORDER BY cle.sequence_order;
```

#### Check Boundaries Before Prompt
```sql
-- Get combined boundaries
SELECT
  sb.comfortable_discussing_trauma as general_comfortable,
  leb.comfortable_discussing as event_specific,
  COALESCE(leb.comfortable_discussing, sb.comfortable_discussing_trauma) as effective_comfortable
FROM storyteller_boundary sb
LEFT JOIN life_event_boundary leb ON leb.life_event_id = ?
WHERE sb.storyteller_id = ?;
```

#### Get Chapter with Full Structure
```sql
-- Chapter with sections and scenes
SELECT
  sc.chapter_title,
  cs.section_type,
  cs.content,
  ss.scene_setting,
  ss.visual_details
FROM story_chapter sc
LEFT JOIN chapter_section cs ON cs.chapter_id = sc.id
LEFT JOIN story_scene ss ON ss.section_id = cs.id
WHERE sc.id = ?
ORDER BY cs.sequence_order;
```

---

## Performance Considerations

### Indexing Strategy

**Heavy Read Tables**:
- `life_event` - Index on storyteller_id, event_type
- `session` - Index on storyteller_id, status, scheduled_at
- `story_chapter` - Index on story_id, chapter_number, display_order

**Junction Tables**:
- `collection_life_event` - Composite index on (collection_id, sequence_order)
- `story_collection` - Index on story_id, chapter_id, collection_id
- `session_life_event` - Index on both sides

**Temporal Tables**:
- `session_interaction` - Index on (session_id, interaction_sequence)
- `story_draft` - Index on (story_id, draft_version)

### Denormalization Opportunities

**Consider denormalizing**:
- `storyteller_progress.total_sessions_count` - Avoid counting frequently
- `story_chapter.word_count` - Avoid recalculating
- `collection.synthesis_summary` - Cache instead of regenerating

**Do NOT denormalize**:
- Boundaries (need real-time checks)
- Progress percentages (derived from multiple sources)
- Archetype confidence (changes with new material)

---

## Migration Strategy

### Recommended Order

1. **Core Foundation**:
   - Users & authentication (assumed existing)
   - `storyteller`
   - `storyteller_boundary`
   - `storyteller_preference`

2. **Process Framework**:
   - `process_version`
   - `process_commitment`
   - `process_node_type`
   - `process_node`
   - `process_flow_edge`
   - `process_section`
   - `process_prompt`
   - `prompt_pack_template`

3. **Life Events**:
   - `life_event`
   - `life_event_timespan`
   - `life_event_location`
   - `life_event_participant`
   - `life_event_detail`
   - `life_event_trauma`
   - `life_event_boundary`
   - `life_event_media`

4. **Operations**:
   - `storyteller_progress`
   - `scope_type`
   - `storyteller_section_selection`
   - `storyteller_section_status`

5. **Sessions**:
   - `agent`
   - `session`
   - `session_life_event`
   - `session_interaction`
   - `session_artifact`
   - `agent_instance`

6. **Collections**:
   - `collection`
   - `collection_life_event`
   - `collection_grouping`
   - `collection_grouping_member`
   - `collection_synthesis`
   - `archetype_analysis`

7. **Story**:
   - `story`
   - `story_chapter`
   - `chapter_section`
   - `story_collection`
   - `story_character`
   - `character_relationship`
   - `story_theme`
   - `story_scene`
   - `story_draft`

8. **Export & Feedback**:
   - `user_feedback`
   - `book_export`
   - `book_export_delivery`

---

## Next Steps

### To Implement This Schema

1. **Review & Validate**: Review all schemas with team, validate against use cases
2. **ORM Models**: Create SQLAlchemy/Django models from schema definitions
3. **Seed Data**: Create initial process version from process.txt
4. **Migrations**: Write Alembic migrations in order listed above
5. **API Layer**: Build RESTful API endpoints for each resource
6. **Business Logic**: Implement progressive unlocking, archetype inference, boundary checks
7. **Agent Integration**: Connect agent framework to agent_instance system
8. **Testing**: Unit tests for boundaries, integration tests for full journey

### Open Questions to Resolve

1. **Voice support**: Schema ready but need voice recording storage details
2. **Composite characters**: Need workflow for creating composites from multiple people
3. **Section templates**: Should sections have reusable templates like agents?
4. **Export formats**: Which formats are MVP vs. later?
5. **Archetype reanalysis**: How often to rerun as material grows?
6. **Agent model selection**: How to choose between GPT-4, Claude, etc. per agent?
7. **Progress calculation**: Validate the weighted formula for overall completion

---

## Conclusion

This schema design supports the complete journey from initial storyteller onboarding through final book export. Key strengths:

✅ **Event-centric** - Life events as fundamental unit
✅ **Process-driven** - Canonical flow guides everything
✅ **Trauma-aware** - Two-level boundaries, explicit trauma classification
✅ **Flexible & hierarchical** - Events → Collections → Story
✅ **Provisional by default** - User authority at every step
✅ **Memoir craft** - Scene-based storytelling, character arcs, themes
✅ **Operational infrastructure** - Progress tracking, feedback loops, agent management

The schema embodies the core design commitments from process.txt:
1. ✅ Context before meaning
2. ✅ Scope before structure
3. ✅ Archetypes are structural, not prescriptive
4. ✅ User remains the author at every step
5. ✅ System builds an outline first, not a book

**The schema is ready for implementation.**
