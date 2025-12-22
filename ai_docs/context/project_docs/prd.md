# Product Requirements Document (PRD)
## Everbound: AI-Powered Memoir Platform

---

## Document Information

**Version:** 1.0
**Date:** 2025-12-20
**Status:** Draft for Review
**Author:** Requirements Definition Consultant
**Stakeholders:** Development Team, Product Owner, Editorial Reviewers

**Document Purpose:** This PRD defines the comprehensive requirements for the Everbound Core Complete MVP - an AI-powered platform that transforms life stories into professional-quality memoirs through trauma-aware, voice-first interactions.

---

## Executive Summary

### Product Overview

**Everbound** is a Python-based backend system that transforms personal memories into professional-quality memoirs through an AI-powered, trauma-aware life story capture platform. The system uses intelligent agent orchestration to guide storytellers (primarily 65+ years old) through a structured process from initial trust-building through final book composition, with storyteller authorship and consent maintained at every step.

### Primary Goal

Build a robust Python backend that orchestrates AI agents, manages complex workflow state, processes story material through multiple phases, and enables flexible voice/text interaction modalities for capturing life stories.

### Target Users

- **Primary:** Individuals 65+ seeking to preserve their life stories with minimal technical friction
- **Secondary:** 45-64 demographics creating memoirs for parents or themselves
- **Tertiary:** Memorial/legacy services, senior living facilities

### Core Innovation

**Requirements-driven agent orchestration system** that uses multi-archetype analysis and gap identification to intelligently guide story capture toward book-grade narrative material, while maintaining trauma-aware boundaries and user authority at every step.

### Key Differentiators

1. **Multi-Archetype Refinement** - Progressive narrowing (exploring → narrowing → resolved) with strategic requirements lodging
2. **Global Composition Model** - Living manuscript that evolves continuously as material develops
3. **Trauma-Informed Design** - Clinical-level trauma detection, composite character creation, narrative truthfulness
4. **Voice-First Architecture** - VAPI integration with multiple modalities (phone, WebRTC, UI)
5. **Progressive Depth** - Sections unlock by depth (factual → events → enriched), not by sequence

---

## Product Vision Statement

Enable anyone to transform their life experiences into a professionally crafted memoir through conversational AI, regardless of their writing ability, by providing an intelligent backend system that:

- Orchestrates multi-agent workflows through 4 phases (trust_building → history_building → story_capture → composition)
- Maintains trauma-aware boundaries and privacy controls
- Supports multiple input modalities (voice via VAPI, text, UI-based voice-to-text)
- Produces book-grade narrative from conversational responses
- Preserves user authority at every decision point
- Creates a living manuscript that evolves organically throughout the journey

---

## Business Objectives

### Primary Objectives

1. **Enable Memoir Creation for Non-Writers**
   - Transform conversational responses into professional narrative prose
   - Eliminate barriers of technical writing skill
   - **Success Metric:** 80%+ session completion rate, 4.5/5+ user comfort rating

2. **Ensure Psychological Safety**
   - Trauma-aware prompt generation with boundary checking
   - Two-level privacy controls (general + event-specific)
   - Provisional-by-default outputs with user verification
   - **Success Metric:** Zero trauma-related complaints, 90%+ approval of provisional drafts

3. **Produce Professional-Quality Output**
   - 70-80% scene-based (showing vs telling) narrative
   - Rich sensory details, character development, thematic coherence
   - **Success Metric:** Human editorial review scores >8/10, publishable quality

4. **Build Scalable Backend Infrastructure**
   - Support concurrent multi-user story capture sessions
   - Efficient agent orchestration with minimal latency
   - **Success Metric:** <2s agent response time, support 100+ concurrent users

### Secondary Objectives

5. **Enable Multiple Voice Modalities**
   - VAPI phone-based interaction
   - WebRTC browser-based voice
   - UI with voice-to-text transcription
   - **Success Metric:** <15% modality-related session failures

6. **Maintain Cost Efficiency**
   - Optimize LLM API calls through strategic model selection
   - Smart caching and context management
   - **Success Metric:** <$15 per completed memoir

---

## Core Design Commitments (Non-Negotiable)

From existing process documentation, these principles guide all architectural decisions:

1. **Context before meaning** - Memory retrieval precedes narrative interpretation
2. **Scope before structure** - Users choose what they're telling before how much
3. **Archetypes are structural, not prescriptive** - Hidden by default, revealed only on request
4. **User remains the author at every step** - System proposes, user decides
5. **Build outline first, not book** - Incremental, reversible book formation
6. **Trauma-informed at every layer** - Clinical-level awareness, boundary enforcement, user safety paramount
7. **Progressive depth, not sequential sections** - Users explore sections by deepening (factual → enriched), not by unlocking order
8. **Global composition** - Living manuscript evolves continuously, not chapter-by-chapter batch processing

---

## MVP Scope Definition

### Core Complete (B) - What's Included

This PRD defines the **Core Complete MVP** which includes:

#### Agent Orchestration
- ✅ **Full Analyst Flow** with gap analysis and requirements lodging (discriminating, validating, strengthening)
- ✅ **Complete Session Flow** with all phases (pre-call prep, execution, post-processing, quality validation, user verification)
- ✅ **Basic Editor Flow** with quality scoring (0-10 scale across 6 criteria) and requirement lodging

#### Subflows (All 8)
- ✅ Trust Building (introduction, scope, profile)
- ✅ Contextual Grounding (factual timeline)
- ✅ Section Selection (narrative lanes)
- ✅ Lane Development (story capture engine with prompt packs)
- ✅ Archetype Assessment (multi-archetype tracking: exploring → narrowing → resolved)
- ✅ Synthesis (provisional drafts with user approval)
- ✅ Composition (global continuous composition model)
- ✅ Editor (quality scoring and edit requirements)

#### Core Features
- ✅ Multi-archetype tracking with progressive refinement
- ✅ Requirements system (story capture + edit requirements tables)
- ✅ Global composition (living manuscript that evolves with each session)
- ✅ Trauma-informed design (detection, boundaries, composite characters)
- ✅ User verification workflows (provisional drafts, archetype reveals, transcript review)
- ✅ Progressive depth unlocking (factual → events → enriched)
- ✅ Session recovery mechanisms
- ✅ PDF export with professional memoir formatting

#### Voice & LLM Architecture
- ✅ VAPI integration (outbound, inbound, WebRTC, UI-based)
- ✅ Gemini 3 Flash (primary backend model)
- ✅ Gemini 2.5 Flash (VAPI conversational agent)
- ✅ Single provider architecture (Google)

### Phased Validation Approach

**Phase 1: Core Complete Development** (12-18 weeks)
- Build all Core Complete features
- Internal testing and iteration

**Phase 2: Beta Validation** (4-6 weeks)
- Deploy to 10-20 friendly test users
- Gather feedback on functionality, UX, quality
- Measure success metrics (completion rate, comfort rating, quality scores)
- Iterate based on findings

**Phase 3: Expansion to Feature-Rich Launch** (post-validation)
- Multi-user interviews (family perspectives)
- Advanced archetype patterns
- Multiple export formats (EPUB, DOCX, audiobook)
- Agent-driven scheduling
- Session recovery enhancements

### Out of Scope (Feature-Rich Launch - Post-MVP)

The following features are **NOT** included in Core Complete MVP but documented for future expansion:

- ❌ Multi-user interviews (family member perspectives)
- ❌ Multi-lingual support (capture in native language)
- ❌ Audiobook generation with voice cloning
- ❌ EPUB/DOCX export formats (PDF only for MVP)
- ❌ Advanced archetype patterns (section-level archetypes, multiple concurrent archetypes)
- ❌ Agent-driven scheduling optimization
- ❌ Local LLM options (Llama for privacy classification)
- ❌ Custom memoir themes and formatting options
- ❌ Collaborative editing features
- ❌ Integration with genealogy platforms

---

## Success Criteria for MVP

The Core Complete MVP is considered successful when:

### Functional Completeness
- ✅ All 8 subflows operational end-to-end (self-gating based on entry criteria)
- ✅ Analyst Flow successfully lodges and tracks requirements
- ✅ Multi-archetype tracking reaches "resolved" status (0.85+ confidence)
- ✅ Global composition produces coherent manuscript
- ✅ Editor Flow identifies quality issues and lodges edit requirements
- ✅ Users can complete full journey: onboarding → capture → synthesis → composition → PDF export

### Quality Metrics
- ✅ 80%+ session completion rate
- ✅ 4.5/5+ user comfort rating (post-session survey)
- ✅ 8/10+ editorial quality scores on final manuscripts
- ✅ 70-80% scene-to-summary ratio maintained
- ✅ 90%+ user approval rate on provisional drafts

### Technical Metrics
- ✅ <2s agent response time (Analyst Flow decisions)
- ✅ <500ms webhook processing latency
- ✅ 99.5%+ system uptime
- ✅ 95%+ session recovery rate (for dropped calls)
- ✅ Zero critical security vulnerabilities

### User Safety Metrics
- ✅ Zero trauma-related complaints
- ✅ 100% boundary enforcement (no prompts violating user boundaries)
- ✅ 100% user approval before final content inclusion

### Beta Validation Success
- ✅ 10-20 users complete full journey
- ✅ Average time to completed memoir: <90 days
- ✅ Cost per memoir: <$15
- ✅ Positive qualitative feedback on experience and output quality

---

**End of Section 1**

---

## Section 2: User Personas & Journeys

### Primary User Persona: The Storyteller

**Demographics:**
- **Age:** Primarily 65+ years old
- **Tech Comfort:** Low to moderate (prefers voice over typing)
- **Motivation:** Preserve life story for family, leave a legacy, process life experiences
- **Writing Ability:** Little to none; wants professional quality without writing skills
- **Time Availability:** Flexible, but prefers short sessions (8-12 minutes)
- **Communication Preference:** Voice (phone call or browser-based), minimal typing

**Goals:**
1. Share life story in a safe, trauma-aware environment
2. See progress without overwhelming commitment
3. Maintain control over what's included/excluded
4. Receive professional-quality memoir that family will treasure
5. Complete journey at own pace without technical friction

**Pain Points:**
1. Don't know where to start with life story
2. Fear of being overwhelmed by scope ("tell me everything")
3. Anxiety about revisiting traumatic events
4. Worry about writing quality and narrative structure
5. Uncertainty about privacy (who sees what)
6. Technology intimidation (complicated interfaces)

**Comfort Needs:**
- Clear boundaries around sensitive topics
- Ability to skip or postpone difficult subjects
- Reassurance that nothing is "locked in" until approved
- Visible progress without premature commitment
- Simple, voice-first interaction
- Professional guidance without judgment

**Authority Level:** **HIGHEST** - Nothing proceeds without storyteller approval. System proposes, user decides.

---

### Secondary User Persona: Family Member (Future - Post-MVP)

**Role:** Provide additional perspective on shared events (multi-user interviews)

**Goals:**
- Contribute memories about primary storyteller
- Preserve own perspective on shared experiences
- Honor storyteller's vision while adding depth

**Needs:**
- Consent workflows
- Clear attribution (whose perspective)
- Privacy controls (what primary storyteller sees)

*Note: Multi-user interviews are out of scope for Core Complete MVP but documented for Feature-Rich Launch.*

---

### Supporting Personas

**Editorial Reviewer (Internal):**
- Role: Validate narrative quality against craft standards
- Needs: Chapter drafts, quality metrics, assessment criteria
- Authority: Advisory only (Editor Flow provides scores, user approves final content)

**Development Team:**
- Role: Build and maintain Python backend
- Needs: Clear technical specifications, schema documentation, API definitions
- Authority: Implementation decisions within requirements constraints

---

## User Journeys

### Journey 1: Complete Memoir Creation (Whole Life Scope)

**Persona:** Mary, 72, retired teacher, wants to leave life story for grandchildren

**Journey Overview:** Trust Building → Contextual Grounding → Story Capture (multiple sections) → Synthesis → Composition → Export

#### Phase 1: Onboarding & Trust (Sessions 1-2)

**Session 1: Trust Building (10 mins)**
1. Mary receives phone call from VAPI agent
2. Agent introduces system: "We'll build an outline first, nothing is locked in"
3. Mary selects scope: "My whole life story"
4. Agent gathers profile (boundaries, life structure)
5. Mary marks one event as "traumatic, unresolved" → System will not explore
6. Profile complete, sections available

**Outcome:** Mary feels safe, understands process, ready to proceed

#### Phase 2: Context Building (Session 3)

**Session 3: Contextual Grounding (10 mins)**
1. Agent asks factual questions: birth year, where grew up, major moves, work phases
2. Mary provides chronological scaffold (minimal detail)
3. System creates life events at Level 1 (factual timeline)
4. Multiple sections now have basic context

**Outcome:** Timeline established, memory retrieval anchors in place

#### Phase 3: Section Selection (Between Sessions)

1. Mary reviews available sections in web app
2. Selects: Childhood, Teen Years, Early Adulthood, Work & Purpose, Love & Partnership, Parenthood, Lessons & Legacy
3. System marks sections as "available" (no locking)

**Outcome:** Mary has chosen which life areas to explore

#### Phase 4: Story Capture (Sessions 4-15)

**Session 4: Childhood - Level 2 (Events) (10 mins)**
1. Agent uses prompt pack: "Take me to a specific moment from your childhood..."
2. Mary describes Sunday afternoons at grandmother's house
3. Agent asks: "Who was there?" → People captured
4. System creates life event with basic narrative

**Session 5: Childhood - Level 3 (Enriched) (10 mins)**
1. Agent deepens: "What did your grandmother's house smell like?"
2. Mary provides sensory details (baking bread, old wood floors)
3. Agent asks about tension: "Was there anything uncertain or hard?"
4. Mary reveals subtle tension (grandmother's declining health)
5. System creates scene-based artifact with emotional context

**Sessions 6-7: Childhood continues** (Level 3 enrichment)
- Multiple scenes captured
- Childhood section reaches 80% completion

**Session 8: Archetype Assessment Trigger**
- Post-session, Analyst Flow triggers Archetype Assessment
- System analyzes 4 sessions of material
- Detects multiple candidates: "relationship_to_loss" (0.68), "identity_shift" (0.55)
- Refinement status: EXPLORING
- Analyst lodges discriminating requirements for next sessions

**Sessions 9-11: Work & Purpose section** (Mary chooses to switch focus)
- Mary decides to work on career stories
- System respects user preference (priority #1)
- Agent addresses critical requirements for Work section
- Also addresses discriminating requirement: "Was leaving teaching about loss or transformation?"

**Session 12: Archetype Assessment #2**
- Refinement status: NARROWING
- "relationship_to_loss" (0.78), "identity_shift" (0.42)
- Analyst lodges validating requirements to strengthen loss archetype

**Sessions 13-15: Multiple sections** (Mary explores Love & Partnership, Parenthood)
- Agent addresses validating requirements
- Material richness increases across sections

#### Phase 5: Synthesis (After Session 15)

**Synthesis Checkpoint: Childhood**
1. Analyst determines Childhood section has sufficient material for provisional draft
2. Synthesis Subflow creates provisional chapter from session artifacts
3. Email sent to Mary with link to web app
4. Mary reviews draft in web app:
   - Sees synthesized narrative
   - Recognizes her stories woven together
   - Notices tone feels slightly off
5. Mary requests change: "This feels too formal, I want it warmer"
6. System creates requirement record: "Adjust tone to warmer, more conversational"
7. Requirement becomes available for future session review

**Outcome:** Mary sees visible progress, feels in control

#### Phase 6: Continued Capture & Global Composition (Sessions 16-20)

**Session 16: Archetype Assessment #3**
- Refinement status: RESOLVED
- "relationship_to_loss" (0.87), dominant archetype confirmed
- Archetype gates: ✅ PASS (confidence 0.87 ≥ 0.85)

**Material/Character/Thematic Gates Check:**
- Material gate: ✅ PASS (semantic sufficiency for coherent narrative)
- Character gate: ✅ PASS (protagonist arc clear, relationships developed)
- Thematic gate: ✅ PASS (loss themes align with archetype, motifs present)

**Composition Begins (Global Model):**
1. All 4 sufficiency gates pass → Story record created
2. System begins weaving material into manuscript globally
3. Initial chapters emerge from approved collections
4. Chapter structure fluid (Analyst determines natural narrative arcs)

**Sessions 17-20: Capture continues**
- Mary continues deepening Teen Years, Early Adulthood
- After each session:
  - New material automatically woven into existing chapters
  - Chapters expand organically
  - Editor Flow reviews changes, lodges edit requirements if needed

**Outcome:** Living manuscript evolves continuously

#### Phase 7: Editor Review & Refinement (Ongoing)

**Editor Flow Continuous Review:**
1. After Session 17 adds Teen Years material, Editor reviews Chapter 3 changes
2. Quality scoring:
   - Narrative Coherence: 8/10
   - Pacing: 7/10
   - Character Consistency: 9/10
   - Sensory Details: 6/10 (blocking)
   - Thematic Integration: 8/10
   - Emotional Resonance: 7/10
3. Sensory Details < 6 → Blocking issue
4. Editor lodges edit requirement: "Chapter 3 Teen Years section needs more sensory details in school scenes"
5. Requirement routed to Analyst Flow
6. Session 18 addresses requirement (agent prompts for sensory details in school memories)
7. Editor re-reviews Chapter 3: Sensory Details now 8/10 → Blocking resolved

**Outcome:** Quality continuously maintained

#### Phase 8: Final Review & Export (After Session 20)

**Final Manuscript Review:**
1. Mary reviews complete manuscript in web app
2. All chapters approved by Mary
3. Editor Flow confirms all quality scores ≥ 6 (no blocking issues)
4. Mary requests one final change to Lessons & Legacy chapter
5. Requirement addressed in mini-revision cycle
6. Mary gives final approval

**PDF Export:**
1. System generates professional memoir PDF:
   - Cover page with Mary's name
   - Table of contents
   - Full manuscript text with chapter titles
   - Standard memoir formatting (12pt serif font, 1.5 line spacing, appropriate margins)
2. PDF delivered via email + downloadable from web app
3. Mary receives printed bound copy (external service, out of scope for backend)

**Outcome:** Professional-quality memoir delivered, Mary is thrilled

**Journey Metrics:**
- Total sessions: 20
- Total duration: ~200 minutes (~3.3 hours of actual storytelling)
- Time span: 8 weeks (2-3 sessions per week)
- Cost: ~$10 (VAPI + LLM)
- User satisfaction: 5/5

---

### Journey 2: Single Event Memoir (Focused Scope)

**Persona:** Robert, 68, veteran, wants to document deployment experience without exploring childhood trauma

**Journey Overview:** Trust Building → Contextual Grounding (narrow scope) → Story Capture (single section) → Synthesis → Composition → Export

#### Abbreviated Journey:

**Session 1: Trust Building**
- Robert selects scope: "A specific life event or period"
- Specifies: Military deployment 1970-1971
- Profile: Marks childhood abuse as "traumatic, unresolved" → System will NOT explore
- Agent affirms: "We'll focus only on your deployment. Everything before and after stays private unless you choose to share."

**Session 2: Contextual Grounding (Narrow)**
- Factual questions about deployment: dates, location, unit, role
- What preceded deployment (minimal)
- Timeline scaffold for 1970-1971 period only

**Sessions 3-8: Story Capture (Deployment Section)**
- Deep, scene-based capture of deployment experiences
- Multiple scenes: arrival, first patrol, relationships with unit, key moments
- Archetype assessment after Session 5: "endurance" pattern emerges

**Session 9: Synthesis**
- Provisional draft of deployment narrative
- Robert reviews, approves with minor tone adjustment

**Sessions 10-11: Final enrichment**
- Address edit requirements
- Final scenes captured

**Session 12: Composition & Export**
- All gates pass (archetype resolved: "endurance", material sufficient)
- Manuscript composed (shorter, focused narrative)
- PDF exported

**Outcome:** Robert has documented deployment without reopening childhood trauma. Journey complete in 6 weeks, 12 sessions.

**Journey Metrics:**
- Total sessions: 12
- Time span: 6 weeks
- Focus maintained on chosen scope
- Trauma boundaries honored 100%

---

### Journey 3: Archetype Reveal & User Disagreement

**Persona:** Linda, 70, believes her story is about "overcoming adversity" but system detects "loss" pattern

**Critical Interaction:**

**Session 10: User asks during call**
- Linda: "What's the shape of my story? How does it all fit together?"
- Agent: "Great question. Let me prepare that analysis for you. I'll send it via email after our call."

**Post-Session: Archetype Reveal**
- System sends email with archetype analysis
- Multiple candidates presented:
  - "Relationship to loss" (0.75 confidence)
  - "Relationship to agency" (0.58 confidence)
- Description: "Your story currently reads as a journey through loss - the absence of your mother, the ending of your first marriage, the distance from your daughter. These themes recur throughout. However, there's also an agency pattern - moments where your choices were constrained. As we continue, we'll clarify which feels most true to your experience."

**Linda's Response:**
- Disagrees: "This isn't about loss. It's about resilience and choosing to move forward."
- Provides feedback via web app
- System creates requirement record: "User views story as resilience/transformation, not loss. Re-analyze with transformation archetype lens."

**Session 11: Reanalysis**
- Analyst Flow incorporates user feedback
- Archetype Assessment re-runs with user input
- Detects "transformation" pattern (0.72) now visible
- Lodges requirements to explore transformation themes in future sessions

**Outcome:** User authority preserved, system pivots immediately, narrative direction adjusted

---

### Key Journey Takeaways

1. **User-Driven Pacing:** Mary explores sections in her chosen order, Robert maintains narrow focus
2. **Progressive Depth:** All users start factual → events → enriched within each section
3. **Continuous Composition:** Manuscript evolves with each session (not batch at end)
4. **Trauma Boundaries Honored:** Robert's childhood never explored, Mary's traumatic event omitted
5. **User Authority:** Linda disagrees with archetype, system pivots immediately
6. **Visible Progress:** Provisional drafts show users their story taking shape throughout journey

---

**End of Section 2**

---

## Section 3: Technical Foundation & Architecture

### Voice Architecture - VAPI Integration

**Provider:** VAPI (primary and sole voice provider for MVP)

**Supported Modalities (Backend enables all, frontend decides which to expose):**

1. **Outbound VAPI** (Phone calls initiated by system)
   - System places scheduled calls to user's phone number
   - Use case: Scheduled story capture sessions
   - VAPI handles: Dialing, STT, TTS, call management

2. **Inbound VAPI** (Phone calls initiated by user)
   - User calls designated phone number to start session
   - Use case: User-initiated sessions, "call me back" requests
   - VAPI handles: Call routing, context loading, session continuation

3. **WebRTC via VAPI SDK** (Browser-based voice)
   - User clicks "Start Voice Session" in web app
   - Browser-to-VAPI connection (no phone required)
   - Use case: Users comfortable with computer/tablet, prefer not using phone minutes
   - VAPI SDK handles: WebRTC connection, real-time audio streaming

4. **UI-Based** (Text chat with optional voice-to-text)
   - User types responses in web app OR uses browser voice-to-text
   - Use case: Users who prefer typing, accessibility needs, public settings
   - Backend processes text input identically to voice transcripts

**Technical Implementation:**
- Backend provides unified webhook endpoints for all modalities
- VAPI sends transcripts/events to same processing pipeline
- Session orchestration agnostic to input modality
- Voice/text toggle seamless from user perspective

---

### LLM Strategy

**Primary Provider:** Google (single provider for MVP)

#### Model Allocation

**Gemini 3 Flash** (Backend operations)
- **Use cases:**
  - Analyst Flow (gap analysis, requirements lodging)
  - Session Flow (context loading, prompt generation)
  - Archetype Assessment (multi-archetype inference)
  - Synthesis Subflow (provisional draft generation)
  - Editor Flow (quality scoring, edit requirements)
  - Composition Subflow (manuscript weaving)
  - Privacy classification (Tier 1/2/3 determination)
- **Rationale:** Fast, cost-effective, sufficient quality for all backend reasoning tasks

**Gemini 2.5 Flash** (VAPI conversational agent)
- **Use cases:**
  - Real-time conversation during sessions
  - Dynamic prompt delivery based on session context
  - Natural language interaction with storyteller
  - Function calling (saveStorySegment, scheduleNextSession)
- **Rationale:** Optimized for conversational AI, low latency, integrates with VAPI

**Cost Optimization:**
- Single provider reduces integration complexity
- Flash models balance quality and cost
- Strategic context management (only pass relevant data to LLM)
- Caching for frequently accessed data (boundaries, section definitions)

**Fallback Strategy:**
- For MVP: No automatic fallback (single provider)
- Manual failover if Google experiences outage (admin intervention)
- Post-MVP: Consider multi-provider architecture (OpenAI as secondary)

---

### Data Model Overview

**Architecture:** Event-Centric with Progressive Composition

**Core Principle:** Life events are the fundamental unit. Everything builds from events.

#### Entity Hierarchy

```
storyteller
  ├─ storyteller_boundary (general comfort levels)
  ├─ storyteller_preference (book type, working style)
  ├─ storyteller_progress (current phase, completion %)
  └─ storyteller_section_status (section depth: factual/events/enriched)

life_event (raw material)
  ├─ life_event_timespan (multiple spans per event)
  ├─ life_event_location (multiple places per event)
  ├─ life_event_participant (people with roles)
  ├─ life_event_detail (flexible key-value facts)
  ├─ life_event_trauma (trauma classification, resolution status)
  ├─ life_event_boundary (event-specific privacy overrides)
  └─ life_event_media (photos, documents, letters)

session (goal-oriented exchanges)
  ├─ session_life_event (many-to-many: sessions touch multiple events)
  ├─ session_interaction (individual prompt/response pairs)
  └─ session_artifact (outputs: scene captures, timeline entries)

requirement (story capture requirements)
  ├─ requirement_type (scene_detail, character_insight, emotional_context)
  ├─ priority (critical, important, optional)
  ├─ archetype_refinement_purpose (discriminate, validate, strengthen)
  └─ status (pending, addressed, resolved)

collection (organized groups of events)
  ├─ collection_life_event (many-to-many with narrative roles)
  ├─ collection_synthesis (provisional drafts)
  └─ collection_tag (flexible categorization)

story (manuscript)
  ├─ story_chapter (chapters with fluid structure)
  │   ├─ chapter_section (scene, summary, reflection, transition)
  │   └─ chapter_theme (which themes in which chapters)
  ├─ story_character (real people as crafted characters)
  │   ├─ character_relationship (relational dynamics)
  │   └─ character_appearance (tracking across chapters)
  ├─ story_scene (detailed scenes with sensory details)
  ├─ story_theme (thematic threads)
  └─ story_draft (version history)

archetype_analysis (multi-archetype tracking)
  ├─ candidate_archetypes (JSONB array with confidence scores)
  ├─ refinement_status (exploring, narrowing, resolved)
  ├─ dominant_archetype (NULL until resolved)
  └─ revealed_to_user (false by default)

edit_requirement (composition quality requirements)
  ├─ issue_type (flow, pacing, clarity, sensory_detail)
  └─ severity (blocking, important, polish)
```

**Key Relationships:**
- `life_event` → `collection` (many-to-many via `collection_life_event`)
- `collection` → `story_chapter` (many-to-many via `story_collection`)
- `session` → `life_event` (many-to-many via `session_life_event`)
- `requirement` → `session` (requirements addressed in sessions)
- `storyteller` → everything (all entities belong to storyteller)

**Detailed Schema Documentation:**
- See [ai_docs/context/source_docs/schema/README.md](../source_docs/schema/README.md) for complete schema definitions
- Individual schema files: `storyteller_schema.md`, `session_schema.md`, `collection_schema.md`, `story_schema.md`, `process_schema.md`, `system_operations_schema.md`

---

### System Architecture Components

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT LAYER                         │
│  Phone (VAPI) | WebRTC Browser | UI + Voice-to-Text    │
└─────────────────────┬───────────────────────────────────┘
                      │
         ┌────────────▼──────────────┐
         │   VAPI Voice Platform     │
         │   - Conversation Engine   │
         │   - STT/TTS               │
         │   - Call Management       │
         └────────────┬──────────────┘
                      │ Webhooks
         ┌────────────▼──────────────┐
         │   Python Backend (FastAPI)│
         │   ┌──────────────────────┐│
         │   │  Webhook Handlers    ││
         │   │  - VAPI callbacks    ││
         │   │  - Transcript ingress││
         │   └──────────────────────┘│
         │   ┌──────────────────────┐│
         │   │  Agent Orchestration ││
         │   │  - Analyst Flow      ││
         │   │  - Session Flow      ││
         │   │  - Editor Flow       ││
         │   └──────────────────────┘│
         │   ┌──────────────────────┐│
         │   │  Subflows            ││
         │   │  - Trust Building    ││
         │   │  - Contextual Ground.││
         │   │  - Lane Development  ││
         │   │  - Archetype Assess. ││
         │   │  - Synthesis         ││
         │   │  - Composition       ││
         │   └──────────────────────┘│
         │   ┌──────────────────────┐│
         │   │  Requirements System ││
         │   │  - Lodging           ││
         │   │  - Tracking          ││
         │   │  - Prioritization    ││
         │   └──────────────────────┘│
         └────────────┬──────────────┘
                      │
         ┌────────────▼──────────────┐
         │   Data Layer (PostgreSQL) │
         │   - Storyteller tables    │
         │   - Life events           │
         │   - Sessions              │
         │   - Requirements          │
         │   - Collections           │
         │   - Story (manuscript)    │
         │   - Archetype analysis    │
         └────────────┬──────────────┘
                      │
         ┌────────────▼──────────────┐
         │   External Services       │
         │   - Google Gemini API     │
         │   - VAPI API              │
         │   - Email delivery        │
         │   - PDF generation        │
         └───────────────────────────┘
```

---

### Agent Orchestration Architecture

#### Primary Flows (Orchestrators)

**1. Analyst Flow** (`analyst_orchestrator`)
- **Role:** Decision-making brain of the system
- **Responsibilities:**
  - Phase assessment (trust → history → capture → composition)
  - Gap identification (missing scenes, characters, emotions, themes)
  - Requirements lodging (discriminating, validating, strengthening)
  - Next subflow determination
  - Section depth progression tracking
  - Archetype-aware strategy

- **Inputs:**
  - Storyteller ID
  - Current progress state
  - All life events
  - All session artifacts
  - Current requirements table
  - Archetype analysis (if available)
  - **Transcript segment** (from `submit_requirement_result()` payload - includes latest session content)

- **Outputs:**
  - Updated requirements table
  - Next subflow instruction
  - Section status updates
  - Progress state updates

- **Triggers:**
  - **Real-time after every `submit_requirement_result()` call** (primary trigger)
  - On new storyteller initialization
  - When user requests next steps

- **Execution Model:**
  - **Runs ALL 8 subflows on every trigger** (no selective execution)
  - Each subflow **self-gates** based on entry criteria
  - Subflows that don't meet entry criteria exit immediately with no-op
  - This ensures consistent state evaluation across all dimensions

**2. Session Flow** (`session_orchestrator`)
- **Role:** Executor - conducts story capture sessions
- **Responsibilities:**
  - Pre-call preparation (context loading, prompt generation)
  - VAPI agent configuration
  - Post-call processing (transcript → story points)
  - Quality validation (duration, engagement, sentiment)
  - User verification (session summary review)
  - Progress updates
  - Trigger Analyst Flow

- **Phases (Sequential):**
  1. Pre-Call Preparation
  2. Call Execution (VAPI-managed)
  3. Quality Validation
  4. Post-Call Processing
  5. User Verification
  6. Trigger Next Steps

- **Inputs:**
  - Session task ID
  - Storyteller ID
  - Subflow type (from Analyst)
  - Requirements table
  - User context (boundaries, scope, prior sessions)

- **Outputs:**
  - Session record (status: completed)
  - Session interactions (transcript)
  - Session artifacts (story points, scenes)
  - New/updated life events
  - Updated section status
  - Analyst Flow triggered

**3. Editor Flow** (`editor_orchestrator`)
- **Role:** Quality gate - reviews composed narrative
- **Responsibilities:**
  - Chapter quality assessment (0-10 scoring across 6 criteria)
  - Coherence checking (character arcs, timeline, themes)
  - Pacing analysis (scene-to-summary ratio)
  - Edit requirements lodging (blocking, important, polish)
  - Approval gating

- **Assessment Criteria (0-10 scale):**
  1. Narrative Coherence (flow, transitions, chronology)
  2. Pacing (scene-to-summary ratio 70-80%, balance)
  3. Character Consistency (voice, actions, relationships)
  4. Sensory Details (all 5 senses, showing vs telling)
  5. Thematic Integration (themes present, motifs)
  6. Emotional Resonance (reflection, hooks, closing)

- **Blocking Threshold:** Any score < 6 = blocking issue

- **Inputs:**
  - Storyteller ID
  - Story ID
  - Story chapters (composed)
  - Collections (source material)
  - Current archetype

- **Outputs:**
  - Chapter status updates
  - Edit requirements table
  - Quality reports
  - Next action (composition or export)

- **Triggers:**
  - After composition creates/updates chapters
  - Periodically during composition phase
  - User requests review

#### Specialized Subflows (All 8 - Self-Gating)

Each subflow runs on every Analyst trigger but **self-gates** based on entry criteria. If criteria not met, subflow exits with no-op.

**1. Trust Building Subflow** (Phase: trust_building)
- **Entry Criteria:** `storyteller_progress.trust_setup_complete = false`
- Introduction & trust setup
- Scope selection (whole_life, major_chapter, single_event)
- Gentle profile (boundaries, life structure)

**2. Contextual Grounding Subflow** (Phase: history_building)
- **Entry Criteria:** `trust_setup_complete = true AND contextual_grounding_complete = false`
- Factual timeline building
- Scope-dependent depth (whole_life vs single_event)

**3. Section Selection Subflow** (Phase: history_building)
- **Entry Criteria:** `contextual_grounding_complete = true AND sections_selected = false`
- Present available sections (all sections available, no locking)
- Capture user selections

**4. Lane Development Subflow** (Phase: story_capture)
- **Entry Criteria:** `sections_selected = true AND has_pending_lane_requirements = true`
- Apply prompt pack template (Scene → People → Tension → Change → Meaning)
- Respect boundaries (two-level checking)
- Extract scene-based material (sensory details, emotions)
- Track section depth progression (factual → events → enriched)

**5. Archetype Assessment Subflow** (Phase: story_capture)
- **Entry Criteria:** `session_count >= 4 AND session_count % 3 == 0` OR `user_requests_story_shape = true`
- Multi-archetype agentic assessment
- Track multiple candidates with confidence scores
- Determine refinement status (exploring → narrowing → resolved)
- Signal Analyst Flow for strategic requirements
- Hidden by default, revealed only on request

**6. Synthesis Subflow** (Phase: story_capture)
- **Entry Criteria:** `section_has_sufficient_material = true AND provisional_draft_needed = true`
- Assemble provisional drafts from session artifacts
- Create collections with narrative roles
- User verification workflow

**7. Composition Subflow** (Phase: composition)
- **Entry Criteria:** All 4 sufficiency gates pass (archetype + material + character + thematic)
- **Global Composition Model** (NOT chapter-by-chapter)
- Automatically weaves new material into existing chapters
- Chapters expand organically
- Chapter structure fluid (determined by natural narrative arcs)

**8. Editor Subflow** (Phase: composition)
- **Entry Criteria:** `story.status = 'in_composition' AND has_uncommitted_changes = true`
- Quality scoring (0-10 scale across 6 criteria)
- Edit requirements lodging (blocking, important, polish)
- Approval gating for chapters

---

### Flow Patterns & Loops

#### Pattern 1: Real-Time Analyst Trigger Loop (Story Capture)

```
submit_requirement_result() called (with transcript segment)
  ↓
Analyst Flow triggered IMMEDIATELY
  ↓
Runs ALL 8 subflows (self-gating)
  ↓
Each subflow checks entry criteria:
  - Met → Execute subflow logic
  - Not met → Exit with no-op
  ↓
Subflows that execute:
  - Lodge requirements in Requirements Table
  - Update storyteller state
  - Determine next session focus
  ↓
Session Flow prepares next session
  ↓
Session Flow executes (VAPI call)
  ↓
Post-call: submit_requirement_result() called
  ↓
[LOOP - Analyst triggers again with transcript segment]
```

#### Pattern 2: Multi-Archetype Refinement (Progressive Narrowing)

```
Session 4, 7, 10, 13... (every 3 sessions starting at session 4)
  ↓
Analyst Flow triggers Archetype Assessment Subflow
  ↓
Multi-archetype agentic assessment
  ↓
Track multiple candidates with confidence scores
  ↓
Determine refinement status:
  - EXPLORING (3+ viable candidates)
  - NARROWING (2 strong contenders)
  - RESOLVED (1 dominant >= 0.85 confidence)
  ↓
Save to archetype_analysis table (revealed_to_user = FALSE)
  ↓
Signal Analyst Flow:
  - IF exploring → Lodge DISCRIMINATING requirements
  - IF narrowing → Lodge VALIDATING requirements
  - IF resolved → Lodge STRENGTHENING requirements
  ↓
Continue normal flow (archetype hidden)
  ↓
Next assessment in 3 sessions
  ↓
[Progressive refinement: exploring → narrowing → resolved]
```

#### Pattern 3: Global Composition Loop (Continuous Manuscript Evolution)

```
All 4 gates pass (archetype + material + character + thematic)
  ↓
Story record created
  ↓
Initial chapters emerge from approved collections
  ↓
Chapter structure fluid (Analyst determines natural arcs)
  ↓
After each subsequent session:
  ↓
Session adds new material
  ↓
Composition Subflow AUTOMATICALLY weaves into existing chapters
  ↓
Chapters expand organically
  ↓
Editor Flow reviews CHANGES incrementally
  ↓
IF quality issues:
  Lodge edit requirement → Back to Analyst Flow → Addressed in session
  ↓
ELSE:
  Continue with next session
  ↓
[LOOP until user gives final approval]
```

#### Pattern 4: Editor → Composition → Editor Loop (Quality Refinement)

```
Editor Flow reviews chapter changes
  ↓
Quality scoring (6 criteria, 0-10 scale)
  ↓
IF any score < 6 (blocking):
  Lodge edit requirement (severity: blocking)
  chapter.status = needs_revision
  ↓
  Edit requirement routed to Analyst Flow
  ↓
  Next session addresses requirement
  ↓
  Composition weaves updated material
  ↓
  Editor re-reviews
  ↓
  [LOOP until all scores >= 6]
  ↓
ELSE:
  chapter.status = approved
  Continue
```

---

### Technology Stack

**Backend Framework:**
- Python 3.11+
- FastAPI (async, high-performance, WebSocket support)
- SQLAlchemy (ORM)
- Alembic (database migrations)
- Pydantic (data validation)

**Database:**
- PostgreSQL 14+ (JSONB support for flexible metadata)
- pgvector extension (for semantic search on story points - optional for MVP)

**AI/LLM:**
- Google Gemini 3 Flash (backend operations)
- Google Gemini 2.5 Flash (VAPI conversational agent)
- Single provider architecture for MVP

**Voice Services:**
- VAPI (phone-based, browser-based, webhook-based)
- Supports outbound, inbound, WebRTC, UI text modes

**Infrastructure:**
- Docker + docker-compose (local development)
- Cloud deployment (AWS ECS, Railway, or Render)
- PostgreSQL managed service (AWS RDS, Railway, or Supabase)
- Redis (session caching, task queue - optional for MVP)
- Celery (async task processing - optional for MVP)

**Export:**
- PDF generation library (ReportLab or WeasyPrint)
- Standard memoir formatting (12pt serif, 1.5 line spacing, appropriate margins)

**Communication:**
- Email delivery (SendGrid, AWS SES, or SMTP)
- SMS (Twilio - optional for reminders)

---

**End of Section 3**

---

## Section 4: Functional Requirements - Onboarding & Story Capture

This section defines detailed functional requirements for the onboarding journey and story capture process.

---

### FR-1: Trust Building & Onboarding

**Feature:** Initial storyteller onboarding through Trust Building Subflow (Phases 1-3)

**User Story:** As a storyteller, I want to be gently introduced to the system so I feel safe sharing my life story without overwhelming commitment.

#### FR-1.1: Introduction & Trust Setup

**Requirements:**

1. **Welcome Message**
   - System initiates contact (phone call or web app message)
   - Warm, reassuring tone: "We'll build an outline first, not the book"
   - Key messages:
     - "You can skip anything"
     - "You decide how much of your life we focus on"
     - "Nothing is locked in"
   - Duration: ~2 minutes

2. **Expectation Setting**
   - Explain session structure: short (8-12 minute) conversations
   - Clarify that storyteller maintains control at every step
   - Emphasize provisional outputs (all drafts reviewable and changeable)

**Acceptance Criteria:**
- ✅ User receives welcome message via chosen modality (phone/web)
- ✅ Trust setup messages delivered in sequence
- ✅ User acknowledges and expresses willingness to proceed
- ✅ `storyteller_progress.trust_setup_complete = true` after completion

#### FR-1.2: Scope Selection

**Requirements:**

1. **Scope Options Presented**
   - Option 1: "My whole life story"
   - Option 2: "One major chapter of my life"
   - Option 3: "A specific life event or period"
   - Option 4: "I'm not sure yet" (system provides recommendation)

2. **Scope Record Creation**
   - User selection captured in `storyteller_scope`
   - `scope_type` determines section availability (but no section locking)
   - If "unsure," system recommends starting with "single event" and expanding later

3. **Scope Implications**
   - All scope types: All sections available (no locking)
   - Depth of contextual grounding varies by scope (whole_life = comprehensive, single_event = narrow)

**Acceptance Criteria:**
- ✅ User presented with 4 scope options
- ✅ User selection captured in database
- ✅ System acknowledges scope and explains what happens next
- ✅ Scope type stored correctly in `storyteller_scope`

#### FR-1.3: Gentle Profile (Boundaries & Life Structure)

**Requirements:**

1. **Trauma Detection Questions (Self-Report)**
   - "Are there life events you experienced that you feel were traumatic?"
   - If YES: "Are they still sources of discomfort?"
   - If YES: "Would you prefer to focus on areas that do not include this event(s)?"
   - If user wants to discuss: "Are you confident you can discuss them without triggering significant mental distress or harm?"
   - All responses captured in `life_event_trauma` table

2. **General Boundaries**
   - Checkbox-only questions (no essays)
   - Domains:
     - Romance/relationships: Comfortable discussing? (yes/no)
     - Loss/grief: Comfortable exploring? (yes/no)
     - Trauma/difficulty: Comfortable exploring? (yes/no)
     - Privacy: Prefer certain people remain anonymous? (yes/no)
   - Responses stored in `storyteller_boundary`

3. **Life Structure**
   - Checkbox questions:
     - Relationships: Have you been in significant relationships? (yes/no)
     - Children: Do you have children? (yes/no)
     - Military service: Have you served? (yes/no)
     - Faith/spirituality: Is this an important part of your life? (yes/no)
     - Major moves: Have you lived in multiple places? (yes/no)
   - Responses inform section availability and depth

4. **Book Type Preference**
   - Options:
     - Reflective (introspection, meaning-making)
     - Adventure (action, forward momentum)
     - Legacy (life lessons, passing on wisdom)
     - Healing (gentle, trauma-aware, therapeutic)
   - Stored in `storyteller_preference.book_type`

**Acceptance Criteria:**
- ✅ All profile questions asked as checkboxes (no typing required)
- ✅ Trauma self-report captured with resolution status
- ✅ Boundaries recorded in `storyteller_boundary`
- ✅ Life structure responses inform section configuration
- ✅ Book type preference captured
- ✅ Session completes in <10 minutes

---

### FR-2: Voice & Session Management

**Feature:** Multi-modality voice/text session orchestration via VAPI

#### FR-2.1: Outbound VAPI (Phone Calls Initiated by System)

**Requirements:**

1. **Scheduled Call Execution**
   - Analyst Flow creates session task with scheduled time
   - At scheduled time, backend calls VAPI API to initiate outbound call
   - VAPI dials user's phone number
   - User answers → Session begins

2. **VAPI Agent Configuration**
   - System prompt includes:
     - Storyteller context (name, boundaries, scope, current section)
     - Session goal (from subflow type)
     - Relevant prompts (from requirements table)
     - Prior session summary
   - Voice settings: Warm, patient tone suitable for 65+
   - Model: Gemini 2.5 Flash

3. **Function Calling**
   - `saveStorySegment`: VAPI calls backend to save story content in real-time
   - `scheduleNextSession`: Agent asks user about next session timing
   - Backend provides function implementation via webhook

**Acceptance Criteria:**
- ✅ Backend initiates call via VAPI API at scheduled time
- ✅ VAPI successfully dials user
- ✅ Agent configured with correct context and prompts
- ✅ Function calls work correctly (backend receives and processes)
- ✅ Session record created with status: "in_progress"

#### FR-2.2: Inbound VAPI (User-Initiated Calls)

**Requirements:**

1. **Call Reception**
   - User calls designated VAPI phone number
   - VAPI routes to backend webhook with user identifier
   - Backend loads most recent session context or creates new session
   - Session resumes or starts

2. **Context Loading**
   - If continuing previous session: Load incomplete session artifacts
   - If new session: Analyst determines next subflow

**Acceptance Criteria:**
- ✅ User can call in and session starts correctly
- ✅ Context loaded appropriately (resume or new)
- ✅ VAPI agent configured dynamically based on session state

#### FR-2.3: WebRTC via VAPI SDK (Browser-Based Voice)

**Requirements:**

1. **Web App Integration**
   - User clicks "Start Voice Session" button in web app
   - VAPI Web SDK initializes connection
   - Audio streaming between browser and VAPI
   - Backend receives same webhooks as phone-based sessions

2. **Seamless Experience**
   - Same agent configuration as phone calls
   - Same processing pipeline
   - Transcript/audio quality equivalent

**Acceptance Criteria:**
- ✅ Web app can initiate WebRTC session via VAPI SDK
- ✅ Audio quality sufficient for conversation
- ✅ Backend processes WebRTC sessions identically to phone sessions

#### FR-2.4: UI-Based Text/Voice-to-Text

**Requirements:**

1. **Text Input**
   - User types responses in web app chat interface
   - Backend processes text as if it were transcript

2. **Browser Voice-to-Text (Optional)**
   - User clicks microphone icon
   - Browser native voice-to-text captures response
   - Text sent to backend

**Acceptance Criteria:**
- ✅ User can type responses in chat interface
- ✅ Text processed through same pipeline as voice transcripts
- ✅ Optional browser voice-to-text works if implemented

#### FR-2.5: Session Recovery

**Requirements:**

1. **No Answer Handling**
   - System places outbound call
   - User doesn't answer
   - Wait 5 minutes → Call back
   - User still doesn't answer → Wait 5 minutes → Call back again
   - If still no answer → Send email:
     - "We tried to reach you. You can call in, continue online, or reschedule via web app."
   - Session marked as "no_answer"

2. **Call Drop/VAPI Failure**
   - If call drops mid-session or VAPI doesn't send end_call_report after 20 minutes:
   - Background monitor fetches transcript from VAPI API
   - Partial session analyzed and incorporated (same as normal session)
   - Analyst removes fulfilled requirements, reasserts missing requirements
   - User notified via email with partial transcript for review

**Acceptance Criteria:**
- ✅ No answer: Two callbacks attempted with 5-minute intervals
- ✅ Email sent after failed callbacks with options
- ✅ Call drop: Background monitor fetches transcript after 20 min
- ✅ Partial session processed normally
- ✅ Requirements updated based on partial content

---

### FR-3: Story Capture (Lane Development)

**Feature:** Scene-based story capture through Lane Development Subflow (Phase 6)

**User Story:** As a storyteller, I want to share specific moments from my life in a safe, guided way that captures rich details without overwhelming me.

#### FR-3.1: Prompt Pack Template

**Requirements:**

1. **Five-Step Prompt Sequence**
   - **Step 1 - Scene:** "Take me to a specific moment when [context]..."
   - **Step 2 - People:** "Who was there? What were they like?"
   - **Step 3 - Tension:** "What was uncertain, hard, or unresolved?"
   - **Step 4 - Change (optional):** "Did anything shift for you?"
   - **Step 5 - Meaning (tri-valent):** "Looking back, what do you notice now?"

2. **Prompt Personalization**
   - Use storyteller's name
   - Reference prior material ("Last time you mentioned...")
   - Respect boundaries (skip prompts that violate boundaries)
   - Address requirements from Analyst Flow

3. **Short Answers Encouraged**
   - Agent reassures: "A few sentences is great"
   - No pressure for long responses
   - User can skip any prompt

**Acceptance Criteria:**
- ✅ Prompt pack template used in Lane Development sessions
- ✅ Prompts personalized with storyteller context
- ✅ All five steps executed unless boundary violated
- ✅ User comfortable with prompt pacing (measured via post-session survey)

#### FR-3.2: Progressive Depth Progression

**Requirements:**

1. **Three Depth Levels Per Section**

   **Level 1: Factual Timeline (Contextual Grounding)**
   - Prompts: "What year?", "Where?", "Who was involved?"
   - Output: `life_event` with type="contextual_anchor"
   - Stored: timespan, location, participants (basic facts only)

   **Level 2: Events (Basic Narrative)**
   - Prompts: "What happened?", "Tell me about [event]"
   - Output: `life_event` with basic narrative content
   - Stored: Event sequence, summary (not yet enriched)

   **Level 3: Enriched Description (Deep Scene-Based)**
   - Prompts: Prompt pack template (Scene → People → Tension → Change → Meaning)
   - Output: `session_artifact` type="scene_capture" with full sensory details
   - Stored: Visual, auditory, tactile, olfactory details + emotions + reflection

2. **Depth Tracking**
   - `storyteller_section_status.depth_level` tracks current depth per section
   - User can work on multiple sections at different depths simultaneously
   - Analyst recommends completing shallower sections before deepening others (but user can override)

**Acceptance Criteria:**
- ✅ Each section progresses through 3 depth levels
- ✅ Depth level tracked per section in database
- ✅ User can switch between sections at any depth
- ✅ Analyst recommends depth progression but doesn't enforce

#### FR-3.3: Boundary Enforcement

**Requirements:**

1. **Two-Level Boundary Checking**
   - Before each prompt, system checks:
     - `storyteller_boundary` (general comfort levels)
     - `life_event_boundary` (event-specific overrides)
   - If boundaries conflict, event-specific takes precedence

2. **Prompt Modification**
   - If prompt involves trauma AND `comfortable_discussing_trauma = false`:
     - Skip prompt entirely, OR
     - Offer gentler version, OR
     - Ask permission first: "This might touch on difficult topics. Want to continue or skip?"

3. **Mid-Session Detection**
   - If user shows distress during session (detected via language, tone, explicit statement):
   - Agent responds immediately: "I notice this might be difficult. We can skip this entirely, or just note it happened without details. What feels right?"
   - User choice honored immediately

**Acceptance Criteria:**
- ✅ Boundary check executed before every prompt
- ✅ Event-specific boundaries override general boundaries
- ✅ Prompts skipped or modified if boundaries violated
- ✅ Mid-session distress detected and addressed in real-time
- ✅ Zero trauma-related complaints in beta testing

#### FR-3.4: Story Point Extraction

**Requirements:**

1. **Scene vs Summary Classification**
   - System classifies each response as:
     - Scene (showing): Specific moment, sensory details, dialogue, action
     - Summary (telling): General overview, time compression, reflection

2. **Sensory Detail Extraction**
   - For scene-based responses, extract:
     - Visual details (what did you see?)
     - Auditory details (what did you hear?)
     - Tactile details (what did you feel physically?)
     - Olfactory details (what smells?)
     - Taste details (if applicable)

3. **Emotional Context Extraction**
   - Emotions mentioned or implied: joy, fear, grief, anger, confusion, love, etc.
   - Stored in `session_artifact.metadata.emotions`

4. **People, Places, Time Extraction**
   - Extract mentioned people → Create/update `life_event_participant`
   - Extract locations → Create/update `life_event_location`
   - Extract time markers → Create/update `life_event_timespan`

5. **Tension & Change Extraction**
   - What was at stake? (tension)
   - What shifted? (transformation)
   - Stored in `session_artifact.metadata`

**Acceptance Criteria:**
- ✅ Scene vs summary classification accurate (>80%)
- ✅ Sensory details extracted and stored
- ✅ Emotions tagged correctly
- ✅ People, places, times extracted and linked to life events
- ✅ Tension and change captured when present

---

### FR-4: Requirements System

**Feature:** Requirements-driven agent orchestration with strategic lodging

#### FR-4.1: Requirements Table Schema

**Requirements:**

1. **Requirement Record Fields**
   - `requirement_id` (UUID, primary key)
   - `storyteller_id` (FK to storyteller)
   - `requirement_type` (scene_detail, character_insight, emotional_context, thematic_exploration, timeline_clarification)
   - `priority` (critical, important, optional)
   - `section_id` (FK to process_section, nullable)
   - `archetype_lane` (which archetype dimension OR "discriminating" for multi-archetype)
   - `archetype_refinement_purpose` (discriminate, validate, strengthen, NULL)
   - `discriminates_between` (JSONB array: ["loss", "agency"] for discriminating requirements)
   - `expected_archetype_outcomes` (JSONB: describes what each archetype would reveal)
   - `requirement_description` (TEXT: human-readable description)
   - `suggested_prompts` (JSONB array: prompts to address this requirement)
   - `status` (pending, addressed, resolved)
   - `created_at`, `addressed_at`, `created_by`

**Acceptance Criteria:**
- ✅ Requirements table implemented per schema
- ✅ All fields properly typed and indexed
- ✅ JSONB fields support flexible metadata

#### FR-4.2: Analyst Flow - Requirements Lodging

**Requirements:**

1. **Real-Time Trigger After Every `submit_requirement_result()` Call**
   - Analyst Flow triggered immediately with transcript segment payload
   - Runs ALL 8 subflows (self-gating based on entry criteria)
   - Assesses new material captured
   - Identifies gaps:
     - Missing sensory details in scenes
     - Underdeveloped characters
     - Unclear emotional context
     - Weak thematic elements
     - Timeline gaps

2. **Requirement Creation**
   - For each identified gap, create `requirement` record
   - Assign priority based on impact:
     - **Critical:** Blocks meaningful narrative (missing protagonist motivation)
     - **Important:** Weakens narrative quality (missing sensory details)
     - **Optional:** Enrichment opportunities (additional scenes)

3. **Archetype-Aware Requirements**
   - Based on archetype refinement status, lodge strategic requirements:

   **If EXPLORING (3+ candidates):**
   - Lodge **discriminating** requirements
   - Focus on pivotal events that differentiate archetypes
   - Example: "Father's departure - is this loss (absence) or agency (constraints)?"

   **If NARROWING (2 candidates):**
   - Lodge **validating** requirements
   - Gather evidence to strengthen or weaken candidates
   - Example: "Need more evidence for 'loss' archetype - currently missing grief processing"

   **If RESOLVED (1 dominant >= 0.85):**
   - Lodge **strengthening** requirements
   - Deepen the dominant archetype with richness
   - Example: "Add sensory details to loss-related scenes to deepen emotional resonance"

**Acceptance Criteria:**
- ✅ Analyst Flow triggers in real-time after every `submit_requirement_result()` call
- ✅ All 8 subflows run with self-gating (entry criteria checked)
- ✅ Gap analysis identifies missing material
- ✅ Requirements created with correct priority
- ✅ Archetype refinement status determines requirement type
- ✅ Discriminating requirements clearly specify what they discriminate between

#### FR-4.3: Session Planning Priority

**Requirements:**

1. **Priority Hierarchy (Ranked)**
   - Priority 1: **User preference** (which section user wants to work on next)
   - Priority 2: **Critical requirements** (blocking gaps)
   - Priority 3: **Archetype refinement** (discriminating/validating requirements)
   - Priority 4: **Section depth** (complete shallow before deep)
   - Priority 5: **Important/optional requirements** (enhancements)

2. **Next Session Focus Determination**
   - Analyst evaluates all requirements
   - If user has stated preference: Honor it (Priority 1)
   - Else: Select section with most critical requirements (Priority 2)
   - If no critical requirements: Address archetype requirements (Priority 3)
   - If no archetype requirements: Progress section depth (Priority 4)
   - Else: Address important/optional requirements (Priority 5)

**Acceptance Criteria:**
- ✅ Priority hierarchy enforced in session planning
- ✅ User preference always honored when stated
- ✅ System recommends next focus based on priorities
- ✅ Requirements drive session content

#### FR-4.4: Requirement Status Tracking

**Requirements:**

1. **Status Flow**
   - `pending`: Requirement created, not yet addressed
   - `addressed`: Session captured material related to requirement
   - `resolved`: Analyst confirms requirement fully met

2. **Post-Session Updates**
   - After session, Analyst reviews addressed requirements
   - If material sufficient: Mark `status = "resolved"`, set `addressed_at`
   - If material insufficient: Keep `status = "addressed"`, may create new refined requirement

3. **Requirement Removal**
   - When resolved, requirement removed from active consideration
   - Historical record preserved for audit trail

**Acceptance Criteria:**
- ✅ Requirements progress through status flow correctly
- ✅ Analyst accurately determines when requirements resolved
- ✅ Addressed but unresolved requirements tracked for follow-up

---

**End of Section 4**

---

## Section 5: Functional Requirements - Synthesis & Composition

This section defines requirements for archetype assessment, provisional synthesis, global composition, and quality review.

---

### FR-5: Archetype Assessment

**Feature:** Multi-archetype tracking with progressive refinement (exploring → narrowing → resolved)

**User Story:** As the system, I want to identify the storyteller's narrative archetype progressively through strategic material gathering, while keeping the analysis hidden unless the user requests it.

#### FR-5.1: Multi-Archetype Tracking

**Requirements:**

1. **Archetype Dimensions**
   - Track 4 primary archetype patterns:
     - **Relationship to Loss** (absence, grief, mourning, adaptation)
     - **Relationship to Agency** (constraints vs. autonomy, choice, control)
     - **Relationship to Meaning** (what matters, purpose, values)
     - **Identity Shift** (who I was → who I became, transformation)

2. **Candidate Archetype Records**
   - `archetype_analysis.candidate_archetypes` (JSONB array):
     ```json
     [
       {
         "archetype": "relationship_to_loss",
         "confidence": 0.78,
         "evidence": ["mother's absence themes", "unprocessed grief in teen years", "recurring loss motifs"],
         "indicators": ["avoidance of relationships", "protective distance"]
       },
       {
         "archetype": "relationship_to_agency",
         "confidence": 0.42,
         "evidence": ["military constraints", "limited career choices"],
         "indicators": ["brief mentions of constraint"]
       }
     ]
     ```

3. **Confidence Scoring**
   - Each candidate scored 0.0 - 1.0
   - Multiple candidates can coexist during exploration
   - Confidence increases/decreases as evidence accumulates

**Acceptance Criteria:**
- ✅ System tracks multiple archetype candidates simultaneously
- ✅ Confidence scores updated after each assessment
- ✅ Evidence and indicators captured in JSONB for transparency

#### FR-5.2: Refinement Status Determination

**Requirements:**

1. **Three Refinement Statuses**

   **EXPLORING (3+ viable candidates with confidence > 0.60):**
   - Pattern unclear
   - Multiple archetypes plausible
   - Need discriminating material to choose between candidates

   **NARROWING (2 strong contenders emerging):**
   - Pattern becoming clearer
   - Top 2 candidates with confidence > 0.65
   - Need validating material to confirm or eliminate

   **RESOLVED (Single dominant archetype, confidence >= 0.85):**
   - Clear pattern emerges
   - One archetype dominant
   - Ready for composition gate

2. **Status Transitions**
   - `exploring` → `narrowing` (when candidates reduce to 2)
   - `narrowing` → `resolved` (when one reaches 0.85+ confidence)
   - Can regress if new material contradicts (e.g., `narrowing` → `exploring` if third candidate emerges)

**Acceptance Criteria:**
- ✅ Refinement status accurately reflects candidate count and confidence levels
- ✅ Status transitions correctly as material accumulates
- ✅ System handles regression if contradictory evidence emerges

#### FR-5.3: Assessment Triggers

**Requirements:**

1. **Fixed Schedule: Sessions 4, 7, 10, 13...** (every 3 sessions starting at session 4)
   - Predictable assessment rhythm
   - Allows material to accumulate between assessments

2. **Dynamic Trigger: Major Breakthrough Material**
   - If Analyst detects:
     - Significant trauma disclosure
     - Major life transition event (death, divorce, career change)
     - Clear archetype signal (strong loss language, agency assertions)
   - Trigger immediate archetype assessment

3. **User Request: "What's my story shape?"**
   - User asks during session or via web app
   - Trigger assessment immediately
   - Prepare reveal email

**Acceptance Criteria:**
- ✅ Assessments trigger every 3 sessions starting at session 4
- ✅ Dynamic triggers work for breakthrough material
- ✅ User requests trigger immediate assessment and reveal

#### FR-5.4: Hidden by Default, Revealed on Request

**Requirements:**

1. **Default Behavior: Hidden**
   - `archetype_analysis.revealed_to_user = false` by default
   - System uses archetype internally for requirements lodging
   - User never sees archetype unless they ask

2. **Reveal Trigger**
   - User asks: "What's my story shape?", "How does this fit together?", "What pattern do you see?"
   - VAPI agent responds: "Great question. Let me prepare that analysis for you. I'll send it via email after our call."
   - System triggers archetype assessment (if not recent)
   - Email sent with analysis

3. **Reveal Content**

   **If EXPLORING or NARROWING (multiple candidates):**
   - Present ALL candidates with confidence scores
   - Honest description of each pattern
   - Explain what fits and what doesn't
   - Example:
     ```
     Your story currently shows two possible patterns:

     1. Relationship to Loss (75% confidence)
        Your story reads as a journey through loss - the absence of your
        mother, the ending of your first marriage, the distance from your
        daughter. These themes recur throughout.

     2. Relationship to Agency (58% confidence)
        There's also an agency pattern - moments where your choices were
        constrained by circumstance, family obligations, societal expectations.

     As we continue, we'll clarify which feels most true to your experience.
     ```

   **If RESOLVED (single dominant):**
   - Present dominant archetype confidently
   - Explain supporting evidence
   - Invite user verification

4. **User Disagreement Handling**
   - User provides feedback: "This isn't about loss. It's about resilience."
   - System creates `user_feedback` record
   - Creates requirement: "Re-analyze with [user's suggested archetype] lens"
   - Next assessment incorporates user input
   - Analyst lodges requirements to explore user's interpretation

**Acceptance Criteria:**
- ✅ Archetype hidden by default (revealed_to_user = false)
- ✅ System uses archetype internally for strategic requirements
- ✅ Reveal only happens when user asks
- ✅ Multiple candidates presented honestly if exploring/narrowing
- ✅ User disagreement triggers immediate pivot and reanalysis

#### FR-5.5: Strategic Requirements Lodging

**Requirements:**

1. **Signal to Analyst Flow**
   - After each assessment, Archetype Assessment Subflow signals Analyst
   - Provides refinement status and strategic guidance

2. **Discriminating Requirements (if EXPLORING)**
   - Focus on pivotal events that differentiate top 2-3 archetypes
   - Example requirement:
     ```json
     {
       "archetype_refinement_purpose": "discriminate",
       "discriminates_between": ["loss", "agency"],
       "requirement_description": "Father's departure - is this loss (absence, grief) or agency (forced changes, constraint)?",
       "suggested_prompts": [
         "When your father left, what did you miss most?",
         "How did your life change after he was gone?",
         "Did you feel you had choices, or were things decided for you?"
       ],
       "expected_archetype_outcomes": {
         "loss": "Focus on absence, grief, what was missing",
         "agency": "Focus on constraints, forced changes, lack of control"
       }
     }
     ```

3. **Validating Requirements (if NARROWING)**
   - Gather evidence to strengthen or weaken top 2 candidates
   - Example: "Need more evidence for 'loss' archetype - currently missing grief processing scenes"

4. **Strengthening Requirements (if RESOLVED)**
   - Deepen the dominant archetype with richness
   - Example: "Add sensory details to loss-related scenes to deepen emotional resonance"

**Acceptance Criteria:**
- ✅ Analyst receives signal with refinement status
- ✅ Discriminating requirements clearly specify what they discriminate between
- ✅ Requirements include expected outcomes for each archetype
- ✅ Suggested prompts address the strategic need

---

### FR-6: Synthesis (Provisional Drafts)

**Feature:** Create provisional chapter drafts from session artifacts with user verification

**User Story:** As a storyteller, I want to see my stories woven into coherent narrative drafts so I can track progress and maintain control over how my story is told.

#### FR-6.1: Synthesis Trigger

**Requirements:**

1. **Analyst Determines Section Sufficiency**
   - After session, Analyst checks section status
   - If section has:
     - Multiple scene-based artifacts (Level 3 depth)
     - Coherent time/place/people structure
     - Semantic sufficiency for draft
   - Mark section as ready for synthesis

2. **Synthesis Subflow Execution**
   - Analyst triggers Synthesis Subflow for ready section
   - Synthesis creates provisional draft
   - Draft sent to user for review

**Acceptance Criteria:**
- ✅ Analyst accurately determines when section ready for synthesis
- ✅ Synthesis Subflow triggered automatically when ready
- ✅ User notified of provisional draft availability

#### FR-6.2: Draft Assembly

**Requirements:**

1. **Gather Session Artifacts**
   - Query all `session_artifact` records for section
   - Include:
     - Scene captures (type: "scene_capture")
     - Summary captures (type: "summary_capture")
     - Timeline entries
     - Character details

2. **Organize Narrative Flow**
   - **Opening Hook:** Compelling scene or question
   - **Chronological/Thematic Progression:** Events in logical order
   - **Closing Resonance:** Reflection or meaning-making

3. **Generate Provisional Text**
   - Use Gemini 3 Flash to weave artifacts into coherent narrative
   - Maintain storyteller's voice (direct quotes preserved)
   - Add transitions between scenes
   - Include sensory details from artifacts
   - Balance scene (70-80%) vs. summary (20-30%)

4. **Create Collection Record**
   - `collection` record created
   - `collection_life_event` links events with narrative roles:
     - opening_hook
     - rising_action
     - climax
     - resolution
     - reflection
   - `collection_synthesis` stores provisional text with metadata

**Acceptance Criteria:**
- ✅ All relevant artifacts gathered for section
- ✅ Narrative flow logical (hook → progression → resonance)
- ✅ Storyteller's voice preserved
- ✅ Scene-to-summary ratio 70-80%
- ✅ Collection records created with proper linkages

#### FR-6.3: Provisional Labeling

**Requirements:**

1. **Explicit Provisional Markers**
   - Email subject: "📖 DRAFT: [Section Name] - Your Review Needed"
   - Banner in web app: "⚠️ PROVISIONAL DRAFT - Awaiting Your Approval"
   - Footer text: "This is a working draft. All material remains editable. Your raw story inputs are preserved and accessible."

2. **User Control Messaging**
   - "You decide if this captures your story accurately"
   - "Request changes, approve, or redo entirely"
   - "Nothing is locked in"

**Acceptance Criteria:**
- ✅ Provisional status clearly communicated
- ✅ User understands draft is not final
- ✅ Control messaging reassures user authority

#### FR-6.4: User Verification Workflow

**Requirements:**

1. **Delivery**
   - Email with link to web app: "Review [Section] Draft"
   - In-app notification badge

2. **Review Interface (Web App)**
   - Display provisional draft
   - Show linked source material (which sessions contributed)
   - Provide action buttons:
     - ✅ **Approve** (mark as non-provisional)
     - 📝 **Request Changes** (open feedback form)
     - 🔄 **Redo** (reject draft, keep artifacts)

3. **User Actions**

   **APPROVE:**
   - Mark `collection.is_provisional = false`
   - `collection.user_approved_at = NOW()`
   - Material available for composition

   **REQUEST CHANGES:**
   - User provides feedback text: "This feels too formal, I want it warmer"
   - System creates `requirement` record:
     ```json
     {
       "requirement_type": "synthesis_adjustment",
       "priority": "important",
       "requirement_description": "User feedback on [Section] synthesis: 'This feels too formal, I want it warmer'",
       "suggested_prompts": ["Explore tone preferences", "Capture more conversational moments"]
     }
     ```
   - Requirement routed to Analyst for future session addressing

   **REDO:**
   - Mark `collection.status = "rejected"`
   - Keep artifacts, discard synthesis text
   - Analyst determines if more material needed or different approach

4. **Timeout Behavior**
   - If no response after 7 days:
     - Send reminder email
     - Auto-approve with notification: "We've marked [Section] as approved. You can still request changes anytime."

**Acceptance Criteria:**
- ✅ User receives email + in-app notification
- ✅ Review interface shows draft and source material
- ✅ All 3 action options functional
- ✅ Approve marks as non-provisional correctly
- ✅ Request Changes creates requirement record
- ✅ Redo rejects draft but preserves artifacts
- ✅ 7-day auto-approve with notification

---

### FR-7: Global Composition

**Feature:** Continuous manuscript evolution with automatic weaving of new material

**User Story:** As a storyteller, I want my memoir to grow organically as I share more stories, seeing my manuscript evolve throughout the journey rather than waiting until the end.

#### FR-7.1: Composition Gates (Blocking)

**Requirements:**

All 4 gates must PASS before composition begins:

1. **Archetype Resolution Gate (CRITICAL)**
   - `archetype_analysis.refinement_status = 'resolved'`
   - `archetype_analysis.dominant_confidence >= 0.85`
   - If revealed to user: `archetype_analysis.user_confirmed = true`

2. **Material Threshold Gate**
   - Semantic sufficiency for coherent narrative (LLM assessment)
   - Guidelines (not hard numbers):
     - Multiple sections at Level 3 depth (enriched)
     - Enough material to construct protagonist arc
     - Recurring themes/patterns evident
     - Character development present

3. **Character Development Gate**
   - Protagonist arc clear (who I was → who I became)
   - Key relationships developed (with depth, not just mentioned)
   - Character voices distinct

4. **Thematic Coherence Gate**
   - Themes align with resolved archetype
   - Recurring motifs present
   - Meaning-making evident (reflection, interpretation)

**If any gate FAILS:**
- Composition does NOT start
- Analyst continues lodging requirements
- Story capture continues

**If all gates PASS:**
- `story` record created
- Composition begins

**Acceptance Criteria:**
- ✅ All 4 gates checked before composition starts
- ✅ Archetype gate enforces 0.85 confidence threshold
- ✅ Material/character/thematic gates use semantic assessment (not hard counts)
- ✅ Composition blocked if any gate fails
- ✅ Story record created only when all gates pass

#### FR-7.2: Initial Story Record Creation

**Requirements:**

1. **Story Record Fields**
   - `storyteller_id` (FK)
   - `dominant_archetype` (from archetype_analysis)
   - `story_title` (generated or user-provided)
   - `book_type` (from storyteller_preference)
   - `overall_tone` (calibrated to book_type: reflective, adventure, legacy, healing)
   - `status` (active, completed, exported)
   - `created_at`

2. **Initial Chapter Structure**
   - Analyst determines natural narrative arcs from approved collections
   - Creates initial `story_chapter` records
   - Chapter structure **fluid** (can be combined/split as material grows)
   - Initial chapters mapped from collections

**Acceptance Criteria:**
- ✅ Story record created with correct archetype and tone
- ✅ Initial chapter structure determined from collections
- ✅ Chapters fluid, not locked

#### FR-7.3: Automatic Material Weaving (Continuous)

**Requirements:**

1. **After Each `submit_requirement_result()` Call (Post-Composition Start)**
   - Session adds new material (artifacts, events) with transcript segment
   - Analyst triggers ALL 8 subflows (self-gating)
   - Composition Subflow entry criteria met → executes weaving
   - New material woven into existing chapters

2. **Weaving Logic**
   - Identify which chapters new material relates to (chronology, theme, section)
   - **Expand existing chapters** with new scenes/details
   - Do NOT create new chapters automatically (Analyst determines structure changes)
   - Preserve existing narrative flow
   - Insert new material at appropriate points

3. **Chapter Expansion**
   - New `chapter_section` records added (scene, summary, transition)
   - New `story_scene` records created with sensory details
   - Existing chapter text updated to include new material
   - `story_chapter.word_count` updated

4. **Version Tracking**
   - Each significant update creates `story_draft` record (snapshot)
   - Version number incremented
   - Timestamp captured

**Acceptance Criteria:**
- ✅ New material automatically woven after each session
- ✅ Chapters expand organically (no manual intervention)
- ✅ Narrative flow preserved during expansion
- ✅ Version snapshots created for audit trail

#### FR-7.4: Chapter Structure Evolution

**Requirements:**

1. **Fluid Chapter Boundaries**
   - Initially: Chapters determined by collections (Childhood, Teen Years, etc.)
   - As material grows: Analyst may recommend:
     - **Combining chapters** (if material thin)
     - **Splitting chapters** (if material dense)
     - **Reordering chapters** (if thematic flow improves)

2. **Analyst Determines Structure Changes**
   - Not automatic - Analyst evaluates after significant material additions
   - Creates `user_feedback` request: "Chapter 3 (Teen Years) is becoming very long. Would you like to split it into 'Early High School' and 'Senior Year'?"
   - User approves or rejects structural changes

3. **Natural Narrative Arcs**
   - Chapters follow narrative arc principles:
     - Opening hook (draws reader in)
     - Rising action (building tension/interest)
     - Climax/turning point (key moment or realization)
     - Resolution (what happened, what changed)
     - Reflection (meaning, lessons, looking back)

**Acceptance Criteria:**
- ✅ Chapter structure fluid, not locked
- ✅ Analyst recommends structure changes when appropriate
- ✅ User approval required for major structural changes
- ✅ Chapters follow narrative arc principles

---

### FR-8: Editor Flow (Quality Review)

**Feature:** Continuous quality assessment with requirement lodging for improvements

**User Story:** As the system, I want to maintain professional narrative quality by identifying issues incrementally and lodging requirements for improvement.

#### FR-8.1: Editor Trigger

**Requirements:**

1. **After Composition Creates/Updates Chapters**
   - Composition Subflow weaves new material
   - Editor Flow automatically triggered
   - Reviews CHANGES only (incremental review, not full manuscript)

2. **Periodic Full Review**
   - Every 5 sessions (after composition starts)
   - Full manuscript review to check holistic coherence

**Acceptance Criteria:**
- ✅ Editor triggered after each composition update
- ✅ Reviews changes incrementally
- ✅ Periodic full review every 5 sessions

#### FR-8.2: Quality Scoring (6 Criteria, 0-10 Scale)

**Requirements:**

ALL 6 criteria assessed for each chapter:

1. **Narrative Coherence (0-10)**
   - Flow and transitions smooth?
   - Chronology clear?
   - Logical progression?
   - Scoring:
     - 0-3: Confusing, disjointed
     - 4-6: Functional but choppy
     - 7-8: Smooth, coherent
     - 9-10: Exceptional flow

2. **Pacing (0-10)**
   - Scene-to-summary ratio 70-80%?
   - Balance of showing vs. telling?
   - Reader engagement maintained?
   - Scoring based on deviation from target ratio

3. **Character Consistency (0-10)**
   - Character voices distinct and consistent?
   - Actions align with established personality?
   - Relationships developed realistically?
   - Scoring: consistency across appearances

4. **Sensory Details (0-10)**
   - All 5 senses present in key scenes?
   - Showing vs. telling balance?
   - Vivid, immersive details?
   - Scoring:
     - <6: Missing senses, too much telling
     - 6-8: Adequate sensory details
     - 9-10: Rich, immersive sensory experience

5. **Thematic Integration (0-10)**
   - Themes woven throughout?
   - Recurring motifs present?
   - Archetype alignment?
   - Scoring: consistency of thematic elements

6. **Emotional Resonance (0-10)**
   - Opening hook compelling?
   - Reflection present and meaningful?
   - Closing resonance impactful?
   - Emotional authenticity?
   - Scoring: reader emotional engagement

**Acceptance Criteria:**
- ✅ All 6 criteria scored 0-10 for each chapter
- ✅ Scoring criteria clearly defined
- ✅ Scores stored in database for tracking

#### FR-8.3: Issue Identification & Blocking Threshold

**Requirements:**

1. **Blocking Threshold: Score < 6**
   - ANY criterion scoring < 6 = BLOCKING issue
   - Chapter marked `status = "needs_revision"`
   - Composition paused for that chapter until resolved

2. **Important Threshold: Score < 8**
   - Criterion scores 6-7 = IMPORTANT issue
   - Not blocking, but needs attention
   - Logged for improvement

3. **Polish Threshold: Score 8-9**
   - Good quality, minor improvements possible
   - Optional polish

**Acceptance Criteria:**
- ✅ Blocking issues (< 6) prevent chapter approval
- ✅ Important issues (6-7) tracked but non-blocking
- ✅ Polish opportunities (8-9) logged as optional

#### FR-8.4: Edit Requirements Lodging

**Requirements:**

1. **Create Edit Requirement Record**
   - For each issue found (blocking or important):
     ```json
     {
       "storyteller_id": "...",
       "story_id": "...",
       "chapter_id": "...",
       "issue_type": "sensory_detail",
       "severity": "blocking",
       "requirement_description": "Chapter 3 Teen Years section needs more sensory details in school scenes. Currently missing auditory and tactile details.",
       "suggested_prompts": [
         "What did the school hallways sound like?",
         "What did you feel when you walked into the cafeteria?"
       ],
       "status": "pending"
     }
     ```

2. **Route to Analyst Flow**
   - Edit requirement added to Analyst's consideration
   - Analyst includes in next session planning (based on priority hierarchy)

3. **Requirement Resolution**
   - Session addresses edit requirement (new material captured)
   - Composition weaves new material into chapter
   - Editor re-reviews chapter
   - If score now >= 6: Mark requirement `status = "resolved"`
   - If still < 6: Keep blocking, may create refined requirement

**Acceptance Criteria:**
- ✅ Edit requirements created for all blocking/important issues
- ✅ Requirements routed to Analyst Flow correctly
- ✅ Requirements include specific issue description and suggested prompts
- ✅ Re-review happens after requirement addressed
- ✅ Blocking issues prevent chapter approval until resolved

#### FR-8.5: Chapter Approval

**Requirements:**

1. **Approval Criteria**
   - ALL scores >= 6 (no blocking issues)
   - User must still review and approve (Editor approval is internal only)

2. **Chapter Status Progression**
   - `needs_revision` → `pending_user_review` → `approved`
   - User approval required even if Editor scores are high

3. **Final Manuscript Approval**
   - All chapters: Editor approved (scores >= 6) AND user approved
   - Ready for export

**Acceptance Criteria:**
- ✅ Chapter not approved until all scores >= 6
- ✅ User approval required even if Editor approves
- ✅ Final export only when all chapters fully approved

---

**End of Section 5**

---

## Section 6: Functional Requirements - Privacy, Trauma & Export

This section defines trauma-informed design, privacy controls, composite character creation, and export functionality.

---

### FR-9: Trauma-Informed Design

**Feature:** Clinical-level trauma detection and response protocols

**User Story:** As a storyteller with traumatic experiences, I want the system to recognize and respect my trauma boundaries, offering safe alternatives without forcing me to relive painful events.

#### FR-9.1: Trauma Event Definition

**Requirements:**

**Trauma Event Criteria** (situation or series of events that exhibit):

1. **Significant Emotion**: Elicits shame, fear, disgust/contempt (self or others)
2. **Still Triggers**: Discussing still triggers strong emotions
3. **Lack of Coherence**: Events seem disjointed, narrative breaks down
4. **Dissociation**: User experiences dissociation while discussing (self-described)

**Trauma Resolution Status:**
- `ongoing`: Active source of distress
- `partially_resolved`: Working through with professional
- `resolved`: Processed, can discuss without triggering

**Storage:** `life_event_trauma` table with classification and resolution tracking

**Acceptance Criteria:**
- ✅ Trauma criteria clearly defined in system documentation
- ✅ Resolution status tracked per event
- ✅ Status influences prompt generation strategy

#### FR-9.2: Trauma Detection (Profile Self-Report)

**Requirements:**

**During Trust Building (Profile):**

1. **Question Sequence:**
   - "Are there life events you experienced that you feel were traumatic?"
   - IF YES: "Are they still sources of discomfort?"
   - IF YES: "Would you prefer to focus on areas that do not include this event(s)?"
   - IF user wants to discuss: "Are you confident you can discuss them without triggering significant mental distress or harm?"

2. **Response Capture:**
   - Mark specific events with `life_event_trauma.resolution_status`
   - If unresolved AND user prefers to avoid → Set boundary: `life_event_boundary.exclude_from_sessions = true`

3. **System Affirmation:**
   - "We'll focus only on [chosen areas]. Everything else stays private unless you choose to share."
   - "You can change this anytime."

**Acceptance Criteria:**
- ✅ Trauma questions asked during profile
- ✅ User responses captured in database
- ✅ Boundaries set automatically based on responses
- ✅ System affirms boundaries clearly

#### FR-9.3: Mid-Session Trauma Detection

**Requirements:**

**Real-Time Detection Indicators:**
- User uses trauma language (explicit: "this was traumatic", "I can't talk about this")
- Emotional distress signals (voice tone changes, long pauses, fragmented speech)
- Dissociation indicators (detachment, confusion about details)

**Agent Response (Immediate):**
- Agent: "I notice this might be difficult. We can skip this entirely, or just note it happened without details. What feels right?"
- User chooses:
  - Skip → Move to next prompt, mark topic as boundary
  - Note only → Record minimal facts, no emotional exploration
  - Continue → Proceed gently

**Post-Session:**
- System flags potential trauma event for review
- Creates `life_event_trauma` record if not already tracked
- Analyst avoids topic in future sessions unless user explicitly revisits

**Acceptance Criteria:**
- ✅ Agent detects distress signals in real-time
- ✅ Offers escape hatch immediately
- ✅ User choice honored without question
- ✅ Topic marked as boundary for future sessions

#### FR-9.4: Unresolved Trauma = NO EXPLORATION

**Requirements:**

**Blocking Rule:**
- IF `life_event_trauma.resolution_status = 'ongoing'` OR `'partially_resolved'`
- AND `life_event_boundary.exclude_from_sessions = true`
- THEN: System will NOT explore this event in any session

**Boundary Check:**
- Before each prompt, system checks event-specific boundaries
- If prompt relates to excluded trauma event → Skip prompt entirely

**Professional Support Referral:**
- When unresolved trauma detected, display message (web app):
  - "Consider working with a trained professional before exploring this further. We're here when you're ready."
- Notify admin for follow-up support (manual, empathetic outreach)

**Scope Adjustment Encouragement:**
- If significant life events are traumatic/unresolved, system suggests:
  1. Omit the event entirely (focus on other periods)
  2. Shift scope (whole life → specific non-traumatic period)
  3. Allusion only (reference past event without details)

**Example:** "Tell riveting childhood adventure story, never discuss war deployment"

**Acceptance Criteria:**
- ✅ Unresolved trauma events excluded from session prompts
- ✅ Boundary checks prevent accidental exploration
- ✅ Professional support message displayed appropriately
- ✅ Admin notified for follow-up
- ✅ Scope adjustment suggestions offered

---

### FR-10: Privacy & Composite Characters

**Feature:** Narrative truthfulness with identity protection through composite character creation

**User Story:** As a storyteller, I want to preserve the narrative significance of sensitive events while protecting the identity and dignity of people involved.

#### FR-10.1: Privacy Classification (Post-Session)

**Requirements:**

**When:** After session ends, during post-call processing

**Classification Logic (Gemini 3 Flash):**

1. **Tier 1 (Publishable):** Safe for inclusion in final memoir
   - No identifying details of vulnerable people
   - No sensitive personal information
   - General life events appropriate for publication

2. **Tier 2 (Conditional):** May require anonymization
   - Mentions specific people who might prefer anonymity
   - Sensitive but not traumatic
   - User preference-dependent (romance, relationships)

3. **Tier 3 (Private):** Narrative significance only
   - Highly sensitive content
   - User explicitly marks as private
   - Event explains character motivation but details should not be published

**Storage:** `session_artifact.privacy_tier` (1, 2, or 3)

**Acceptance Criteria:**
- ✅ Classification happens post-session automatically
- ✅ Privacy tier stored with each artifact
- ✅ Tier 3 content flagged for composite character treatment

#### FR-10.2: Composite Character Creation

**Requirements:**

**Trigger:** User marks content as private OR requests anonymization during draft review

**Workflow:**

1. **User Request:**
   - During provisional draft review: "Make this person unidentifiable"
   - OR during profile: Marks event as private

2. **Analyst Evaluation:**
   - Determine narrative significance: Why is this event important to the story?
   - What motivation, character development, or theme does it serve?

3. **Composition Creates Fictional Alternative:**
   - Preserve **narrative truth** (meaning, motivation, emotional impact)
   - Change **factual details** (names, places, circumstances)
   - Create composite character (combine multiple people into one)
   - Reverse identifying aspects (gender, age, relationship)

**Example:**
```
Original (Tier 3, Private):
"My uncle molested me when I was 12, which explains why I avoid intimacy in relationships."

Composed Alternative (Narratively Truthful):
"A traumatic experience in my early teens left me wary of closeness, a pattern I wouldn't recognize for decades."

OR (if more detail needed):
"A teacher I trusted violated that trust when I was in middle school. The betrayal taught me to keep people at arm's length."
```

**Key Principle:** "Narratively truthful" (preserves meaning) while events may be fictional (protects dignity)

**Acceptance Criteria:**
- ✅ User can request anonymization at any point
- ✅ Analyst identifies narrative significance before creating alternative
- ✅ Fictional alternative preserves motivation/theme
- ✅ Identifying details removed or reversed
- ✅ User approves composite character treatment

#### FR-10.3: Narrative Truthfulness Principle

**Requirements:**

**Definition:** Events may be fictional, but the **meaning** is authentic

**Application:**
- If Event A explains Character Motivation B, but Event A is private:
  - Create Fictional Event C that derives same Motivation B
  - Event C need not be factually true, but emotional/thematic truth is preserved

**User Transparency:**
- Memoir includes author's note (optional): "Some details and characters have been changed to protect privacy, but the emotional and thematic truth of my story remains intact."

**Acceptance Criteria:**
- ✅ System can generate fictional events that preserve meaning
- ✅ Narrative coherence maintained despite factual changes
- ✅ User understands and approves approach

---

### FR-11: Transcript Review & Editing

**Feature:** User ability to review and revise session transcripts via web app

**User Story:** As a storyteller, I want to review what was transcribed from my sessions and correct any errors or clarify my words.

#### FR-11.1: Transcript Access

**Requirements:**

1. **Web App Only** (not during voice calls)
   - User logs into web app
   - Navigates to "Sessions" tab
   - Selects past session
   - Views full transcript with timestamps

2. **Transcript Display:**
   - Speaker labels (User, Agent)
   - Timestamps
   - Edit button per transcript segment

**Acceptance Criteria:**
- ✅ User can view all past session transcripts
- ✅ Transcripts displayed with speaker labels and timestamps
- ✅ Edit functionality available

#### FR-11.2: Transcript Editing

**Requirements:**

1. **User Edits Transcript:**
   - Click edit button
   - Modify text inline
   - Save changes

2. **System Response:**
   - Updated transcript saved
   - Session artifacts RE-PROCESSED with updated transcript
   - Analyst re-evaluates material with corrections
   - Requirements updated if needed

3. **Version History:**
   - Original transcript preserved
   - Edited version marked with timestamp
   - Audit trail maintained

**Acceptance Criteria:**
- ✅ User can edit transcripts
- ✅ Changes saved and re-processed
- ✅ Original transcript preserved for audit
- ✅ Session artifacts updated based on edits

---

### FR-12: PDF Export

**Feature:** Professional memoir PDF generation

**User Story:** As a storyteller, I want to receive my completed memoir as a beautifully formatted PDF that I can print, share, or have professionally bound.

#### FR-12.1: Export Trigger

**Requirements:**

**Prerequisites:**
- All chapters: Editor approved (scores >= 6) AND user approved
- `story.status = 'completed'`

**User Initiates:**
- Web app: "Export Memoir" button
- System confirms: "Your memoir is ready for export. Generate PDF?"

**Acceptance Criteria:**
- ✅ Export only available when all chapters approved
- ✅ User initiates export via web app
- ✅ Confirmation dialog prevents accidental export

#### FR-12.2: PDF Generation

**Requirements:**

**Library:** ReportLab or WeasyPrint (Python PDF generation)

**PDF Contents:**

1. **Cover Page:**
   - Story title (from `story.story_title`)
   - Storyteller name (from `storyteller.full_name`)
   - Subtitle (optional, user-provided)
   - Generation date

2. **Copyright/Disclaimer Page:**
   - "© [Year] [Storyteller Name]. All rights reserved."
   - Optional: "Some details and characters have been changed to protect privacy."

3. **Table of Contents:**
   - Chapter titles with page numbers
   - Auto-generated from `story_chapter` records

4. **Manuscript Body:**
   - Chapter titles (from `story_chapter.chapter_title`)
   - Chapter text (from composed `chapter_section` records)
   - Scene breaks (visual separators between scenes)
   - Page numbers

**Formatting Standards:**

- **Font:** Garamond or Baskerville (serif, 12pt body text, 16pt chapter titles)
- **Line Spacing:** 1.5
- **Margins:** 1 inch all sides
- **Alignment:** Justified text
- **Page Numbers:** Bottom center, starting after TOC
- **Chapter Breaks:** Each chapter starts on new page

**Acceptance Criteria:**
- ✅ PDF includes cover, copyright, TOC, full manuscript
- ✅ Professional memoir formatting applied
- ✅ Page numbers accurate
- ✅ Chapter breaks on new pages

#### FR-12.3: Export Delivery

**Requirements:**

1. **Delivery Methods:**
   - Email with PDF attachment
   - Web app download link (7-day expiration)

2. **Export Record:**
   - Create `book_export` record:
     - `storyteller_id`, `story_id`
     - `export_format`: "pdf"
     - `file_path`: S3/storage URL
     - `export_date`
     - `delivery_method`: "email"
     - `delivery_status`: "sent"

3. **User Notification:**
   - Email subject: "🎉 Your Memoir is Ready!"
   - Body: "Your memoir '[Title]' has been generated. Download it from the link below or find it attached."
   - Attachment: PDF (if < 25MB)
   - Link: Web app download (always)

**Acceptance Criteria:**
- ✅ PDF delivered via email with attachment
- ✅ Download link available in web app
- ✅ Export record created for tracking
- ✅ User notified via email

---

**End of Section 6**

---

## Section 7: Non-Functional Requirements & Acceptance

### NFR-1: Performance Requirements

**System Response Times:**
- **Analyst Flow Decision:** < 2 seconds
- **Webhook Processing (VAPI):** < 500ms
- **Session Artifact Extraction:** < 5 seconds per session
- **Archetype Assessment:** < 30 seconds
- **Synthesis Generation:** < 60 seconds per section
- **Composition Weaving:** < 45 seconds per session
- **Editor Quality Scoring:** < 20 seconds per chapter
- **PDF Generation:** < 2 minutes for full manuscript

**Concurrent Users:**
- Support 100+ concurrent active sessions
- Database queries optimized for < 100ms response

**Acceptance Criteria:**
- ✅ 95th percentile response times meet targets
- ✅ System handles 100 concurrent users without degradation

---

### NFR-2: Security & Privacy

**Data Encryption:**
- **At Rest:** PostgreSQL encryption enabled
- **In Transit:** HTTPS/TLS for all API calls
- **Transcripts:** Encrypted before storage (AES-256)

**Authentication:**
- User authentication via secure token (JWT or session-based)
- VAPI webhooks authenticated via signature verification

**Privacy Compliance:**
- User data deletion on request (GDPR/CCPA compliant)
- Audit trail for all data access
- No data sharing with third parties without explicit consent

**Acceptance Criteria:**
- ✅ All data encrypted at rest and in transit
- ✅ Webhook signatures verified
- ✅ User deletion workflow functional

---

### NFR-3: Reliability & Availability

**Uptime Target:** 99.5% (allowing ~3.6 hours downtime/month)

**Error Handling:**
- LLM API failures: Retry with exponential backoff (3 attempts)
- VAPI webhook failures: Queue for reprocessing
- Database connection failures: Connection pooling with retry logic

**Session Recovery:**
- Partial transcripts recovered from VAPI after 20 min
- Session state preserved for resume

**Acceptance Criteria:**
- ✅ System achieves 99.5% uptime in production
- ✅ Failed operations retried automatically
- ✅ Session recovery successful in 95%+ cases

---

### NFR-4: Scalability

**Database:**
- PostgreSQL with connection pooling (pgBouncer)
- Indexes on high-query fields (storyteller_id, session_id, status)
- JSONB fields for flexible metadata without schema changes

**LLM API:**
- Rate limiting with backoff
- Context window management (truncate to 32k tokens for Gemini)
- Batch operations where possible

**Future Scaling:**
- Horizontal scaling via load balancer
- Database read replicas for reporting
- CDN for PDF downloads

**Acceptance Criteria:**
- ✅ System handles 500 storytellers concurrently
- ✅ Database queries optimized (< 100ms avg)

---

### NFR-5: Maintainability

**Code Quality:**
- Python 3.11+ with type hints
- Pydantic models for data validation
- Comprehensive docstrings
- Unit tests for business logic (70%+ coverage)

**Documentation:**
- API documentation (OpenAPI/Swagger)
- Schema documentation (existing source_docs)
- Deployment runbook

**Logging:**
- Structured logging (JSON format)
- Log levels: DEBUG, INFO, WARNING, ERROR
- Centralized logging (CloudWatch, Datadog, or self-hosted)

**Acceptance Criteria:**
- ✅ Code follows style guide (Black, flake8)
- ✅ 70%+ test coverage
- ✅ API documentation auto-generated

---

## Section 8: Appendices

### Appendix A: Requirement Examples

**Discriminating Requirement (EXPLORING):**
```json
{
  "archetype_refinement_purpose": "discriminate",
  "discriminates_between": ["loss", "agency"],
  "requirement_description": "Father's departure - clarify if this is loss (absence, grief) or agency (constraints, forced changes)",
  "suggested_prompts": [
    "When your father left, what did you miss most?",
    "How did your life change after he was gone?",
    "Did you feel you had choices, or were things decided for you?"
  ],
  "expected_archetype_outcomes": {
    "loss": "User focuses on absence, grief, what was missing emotionally",
    "agency": "User focuses on constraints imposed, lack of control, forced adaptations"
  }
}
```

**Validating Requirement (NARROWING):**
```json
{
  "archetype_refinement_purpose": "validate",
  "requirement_description": "Need more evidence for 'loss' archetype - currently missing grief processing scenes from teen years",
  "suggested_prompts": [
    "After your mother passed, who did you talk to about your feelings?",
    "Was there a moment when the loss really hit you?"
  ]
}
```

**Strengthening Requirement (RESOLVED):**
```json
{
  "archetype_refinement_purpose": "strengthen",
  "requirement_description": "Loss archetype confirmed - deepen sensory and emotional resonance in key loss-related scenes",
  "suggested_prompts": [
    "Take me back to that moment - what did the room look like?",
    "What did you feel in your body when you realized they were gone?"
  ]
}
```

---

### Appendix B: Prompt Pack Template Example

**Section:** Childhood
**Level 3 (Enriched) Prompt Sequence:**

1. **SCENE:** "Take me to a specific moment from your childhood - maybe a Sunday afternoon, or a time you remember clearly. Where were you?"

2. **PEOPLE:** "Who was there with you? What were they like?"

3. **TENSION:** "Was there anything uncertain, hard, or unresolved in that moment?"

4. **CHANGE (optional):** "Did anything shift for you during that time?"

5. **MEANING:** "Looking back now, what do you notice about that moment that you might not have seen then?"

---

### Appendix C: Success Metrics Dashboard

**For Beta Validation (10-20 users):**

| Metric | Target | Measurement |
|--------|--------|-------------|
| Session Completion Rate | 80%+ | Sessions completed / Sessions scheduled |
| User Comfort Rating | 4.5/5+ | Post-session survey |
| Editorial Quality Score | 8/10+ | Human reviewer assessment |
| Scene-to-Summary Ratio | 70-80% | Automated analysis |
| Provisional Draft Approval | 90%+ | Approvals / Total drafts |
| Agent Response Time | < 2s | 95th percentile latency |
| System Uptime | 99.5%+ | Monitoring dashboard |
| Session Recovery Rate | 95%+ | Recovered / Dropped calls |
| Cost per Memoir | < $15 | VAPI + LLM costs |
| Time to Completion | < 90 days | Onboarding → Export |
| Trauma Safety | Zero complaints | User feedback |

---

### Appendix D: Phase Transition Checklist

**Trust Building → Contextual Grounding:**
- ✅ `storyteller_progress.trust_setup_complete = true`
- ✅ Scope selected and stored
- ✅ Boundaries captured
- ✅ Profile complete

**Contextual Grounding → Story Capture:**
- ✅ Timeline scaffold established (multiple life events at Level 1)
- ✅ Sections selected by user

**Story Capture → Composition:**
- ✅ Archetype resolved (confidence >= 0.85)
- ✅ Material sufficient (semantic assessment)
- ✅ Character development present
- ✅ Thematic coherence established

**Composition → Export:**
- ✅ All chapters Editor approved (scores >= 6)
- ✅ All chapters user approved
- ✅ Final manuscript review complete

---

## Conclusion

This Product Requirements Document defines the **Everbound Core Complete MVP** - a comprehensive AI-powered memoir platform with:

✅ **Full Agent Orchestration:** Analyst, Session, and Editor Flows
✅ **8 Specialized Subflows (Self-Gating):** Trust Building, Contextual Grounding, Section Selection, Lane Development, Archetype Assessment, Synthesis, Composition, Editor
✅ **Multi-Archetype Tracking:** Progressive refinement (exploring → narrowing → resolved)
✅ **Requirements-Driven System:** Strategic lodging with priority hierarchy
✅ **Global Composition Model:** Living manuscript with continuous evolution
✅ **Trauma-Informed Design:** Clinical-level detection, boundaries, composite characters
✅ **Voice Architecture:** VAPI with all modalities (outbound, inbound, WebRTC, UI)
✅ **Professional Output:** PDF export with memoir formatting

**Next Steps:**
1. Review and approve this PRD with stakeholders
2. Begin technical implementation (12-18 week timeline)
3. Deploy to beta users (10-20 storytellers)
4. Validate success metrics and iterate
5. Expand to Feature-Rich Launch

---

**Document Version:** 1.0
**Status:** Ready for Review
**Date:** 2025-12-20

**Storage Location:** [ai_docs/context/project_docs/prd.md](prd.md)
