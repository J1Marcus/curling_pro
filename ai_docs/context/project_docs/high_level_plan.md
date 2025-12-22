# Everbound Backend: High-Level Implementation Plan

**Version:** 1.0
**Date:** 2025-12-21
**Status:** Implementation Ready

---

## CORE DEVELOPMENT ENVIRONMENT

### 1. Launchpad Framework & Docker Setup
**Status:** ✅ COMPLETED
- GenAI Launchpad framework instantiated
- Docker compose configuration for local development
- Base workflow engine operational

### 2. Database Schema & Migrations
**Status:** ✅ COMPLETED
- All SQLAlchemy models defined (storyteller, life_event, session, collection, story, requirement, edit_requirement, archetype_analysis)
- Alembic migrations generated and applied
- Database relationships established

### 3. Base Infrastructure Setup
**Status:** ⚠️ PARTIALLY COMPLETED
- ✅ FastAPI application structure (`app/main.py`, `app/api/`)
- ✅ Celery worker configuration (`app/worker/`)
- ✅ Redis queue setup and integration
- ✅ Logging and monitoring infrastructure (Langfuse integration in `app/core/workflow.py`)
- 🔲 Health check endpoints (`/health`) - Auto-Claude Task #009
- 🔲 Error handling middleware - Auto-Claude Task #010

### 4. Configuration Management
**Status:** ⚠️ PARTIALLY COMPLETED
- ✅ Environment variables configured (.env files)
- ✅ Basic secrets management (environment variables)
- ✅ LLM provider configuration (Pydantic AI service layer approach)
- 🔲 Centralized configuration module (`app/core/config.py`) - Auto-Claude Task #011
- 🔲 API key validation for webhooks - Auto-Claude Task #012
- 🔲 Database connection pooling - Auto-Claude Task #013
- 🔲 VAPI credentials and webhook secrets - User will configure

---

## BUSINESS LOGIC IMPLEMENTATION

---

## PHASE 1: CORE SUBFLOWS & ANALYST FLOW

**CRITICAL: Implementation Order = Bottom-Up (Subflows FIRST, then Orchestrators)**

**GenAI Launchpad Framework Patterns:**
- All workflows inherit from `Workflow` with `WorkflowSchema` definition
- All nodes inherit from `Node`, `AgentNode`, or `BaseRouter`
- Nodes implement: `async def process(self, task_context: TaskContext) -> TaskContext`
- Nodes save output via `self.save_output(output_model)` and retrieve via `self.get_output(NodeClass)`
- Nodes do NOT return `should_stop` values - they call `task_context.stop_workflow()` to halt execution
- WorkflowSchema defines: `event_schema` (Pydantic model), `start` (first node), `nodes` (list of NodeConfig)
- NodeConfig defines: `node` (Node class), `connections` (list of next nodes), `is_router` (bool), `description`
- Router nodes use `is_router=True` and implement `routes` list + `fallback` node

---

### CORE EXECUTION PATTERN: Analyst Runs ALL Subflows

**⚠️ CRITICAL ARCHITECTURAL PRINCIPLE**

The Analyst Flow does NOT selectively choose which subflow to execute. Instead:

1. **Analyst ALWAYS runs ALL subflows** on every invocation
2. **Each subflow self-gates** based on entry criteria
3. If criteria not met → subflow returns early (no-op)
4. If criteria met → subflow assesses state and creates/resolves requirements
5. **Analyst runs after EVERY requirement submission** during a session (real-time)

**Execution Pattern:**
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

**Real-Time Triggering:**
- When VAPI agent calls `submit_requirement_result()` during a session
- Analyst Flow is triggered IMMEDIATELY (not after session completes)
- This creates a real-time feedback loop for responsive requirement generation

**Benefits:**
- ✅ Deterministic & predictable (same sequence every time)
- ✅ Real-time responsive to user progress
- ✅ Modular & self-contained (each subflow owns its gating logic)
- ✅ Easy to add new subflows (just add to sequence)
- ✅ Transparent & auditable

For detailed execution flow with code examples, see [analyst_subflow_execution_pattern.md](analyst_subflow_execution_pattern.md).

---

### 1.1 Trust Building Subflow (IMPLEMENT FIRST)
**Location:** `app/workflows/subflows/trust_building_workflow.py`
**Priority:** 1 - Required by Analyst Flow

**Entry Criteria (Gate):**
- `current_phase IN [NULL, 'trust_building']`
- If gate not met → return early (no-op)
- If gate met → execute workflow

**Event Schema:**
```python
class TrustBuildingEvent(BaseModel):
    storyteller_id: str
    trigger_reason: str  # "initialization"
```

**Workflow Definition:**
```python
class TrustBuildingWorkflow(Workflow):
    workflow_schema = WorkflowSchema(
        description="Onboarding flow to establish trust and scope",
        event_schema=TrustBuildingEvent,
        start=IntroductionNode,
        nodes=[
            NodeConfig(
                node=IntroductionNode,
                connections=[ScopeSelectionNode],
                description="Set user expectations"
            ),
            NodeConfig(
                node=ScopeSelectionNode,
                connections=[GentleProfileNode],
                description="Capture scope choice"
            ),
            NodeConfig(
                node=GentleProfileNode,
                connections=[],  # Final node
                description="Gather boundaries via checkboxes"
            ),
        ],
    )
```

**Nodes to Implement:**

**IntroductionNode** (Standard Node - DB write + logic)
```python
class IntroductionNode(Node):
    class OutputType(BaseModel):
        storyteller_id: str
        introduction_message: str

    async def process(self, task_context: TaskContext) -> TaskContext:
        event: TrustBuildingEvent = task_context.event

        # Load storyteller
        storyteller = await StorytellerService.get_by_id(event.storyteller_id)

        # Set expectations message
        intro_message = "We'll build an outline first. You can skip anything."

        # Update state
        await StorytellerService.update_progress(
            storyteller_id=event.storyteller_id,
            trust_setup_started=True
        )

        self.save_output(self.OutputType(
            storyteller_id=event.storyteller_id,
            introduction_message=intro_message
        ))

        return task_context
```

**ScopeSelectionNode** (Standard Node - VAPI + DB write)
```python
class ScopeSelectionNode(Node):
    class OutputType(BaseModel):
        scope_type: str
        sections_enabled: List[str]

    async def process(self, task_context: TaskContext) -> TaskContext:
        intro_output = self.get_output(IntroductionNode)

        # VAPI interaction to gather scope
        scope_type = "whole_life"  # TODO: Get from VAPI

        # Enable sections
        sections = await SectionService.enable_sections_for_scope(
            storyteller_id=intro_output.storyteller_id,
            scope_type=scope_type
        )

        self.save_output(self.OutputType(
            scope_type=scope_type,
            sections_enabled=sections
        ))

        return task_context
```

**GentleProfileNode** (Standard Node - VAPI + DB write)
```python
class GentleProfileNode(Node):
    class OutputType(BaseModel):
        boundaries_set: List[str]
        preferences_set: Dict[str, Any]

    async def process(self, task_context: TaskContext) -> TaskContext:
        intro_output = self.get_output(IntroductionNode)

        # VAPI interaction for boundaries/preferences
        boundaries = []  # TODO: Get from VAPI
        preferences = {}  # TODO: Get from VAPI

        # Save boundaries and preferences
        await BoundaryService.set_boundaries(
            storyteller_id=intro_output.storyteller_id,
            boundaries=boundaries
        )

        # Mark trust setup complete
        await StorytellerService.update_progress(
            storyteller_id=intro_output.storyteller_id,
            trust_setup_complete=True
        )

        self.save_output(self.OutputType(
            boundaries_set=boundaries,
            preferences_set=preferences
        ))

        # Final node - workflow stops naturally
        return task_context
```

**Tasks:**
- [ ] Create `app/workflows/subflows/trust_building_workflow.py`
- [ ] Create `app/workflows/subflows/trust_building_nodes/introduction_node.py`
- [ ] Create `app/workflows/subflows/trust_building_nodes/scope_selection_node.py`
- [ ] Create `app/workflows/subflows/trust_building_nodes/gentle_profile_node.py`
- [ ] Create event JSON: `requests/events/trust_building_event.json`
- [ ] Create playground: `playground/trust_building_playground.py`
- [ ] Test until issue-free

---

### 1.2 Contextual Grounding Subflow (IMPLEMENT SECOND)
**Location:** `app/workflows/subflows/contextual_grounding_workflow.py`
**Priority:** 2 - Required by Analyst Flow

**Entry Criteria (Gate):**
- `current_phase == 'history_building'`
- If gate not met → return early (no-op)
- If gate met → execute workflow

See corrected implementation pattern in section 1.1 (Trust Building). Follow same GenAI Launchpad patterns:
- Workflow with WorkflowSchema
- 3 nodes: ScopeDeterminationNode → TimelineScaffoldingNode → MemoryAnchorsNode
- All nodes inherit from Node, implement `async def process()`
- Final node has `connections=[]`

**Tasks:**
- [ ] Create workflow + 3 node files
- [ ] Create event JSON + playground
- [ ] Test until issue-free

---

### 1.3 Section Selection Subflow (IMPLEMENT THIRD)
**Location:** `app/workflows/subflows/section_selection_workflow.py`
**Priority:** 3 - Required by Analyst Flow

**Entry Criteria (Gate):**
- `current_phase == 'history_building' AND contextual_grounding_complete == TRUE`
- If gate not met → return early (no-op)
- If gate met → execute workflow

See corrected implementation pattern in section 1.1. Follow same GenAI Launchpad patterns:
- 2 nodes: AvailableSectionsNode → UserSelectionNode

**Tasks:**
- [ ] Create workflow + 2 node files
- [ ] Create event JSON + playground
- [ ] Test until issue-free

---

### 1.4 Lane Development Subflow - THE ENGINE (IMPLEMENT FOURTH)
**Location:** `app/workflows/subflows/lane_development_workflow.py`
**Priority:** 4 - Required by Analyst Flow

**Entry Criteria (Gate):**
- `current_phase == 'story_capture' AND sections_selected == TRUE`
- If gate not met → return early (no-op)
- If gate met → execute workflow

**Critical Node:** StoryPointExtractionNode inherits from `AgentNode` (LLM-powered)

See corrected implementation pattern in section 1.1. Follow same GenAI Launchpad patterns:
- 9 nodes in sequence (see flow_architecture_diagrams.md)
- StoryPointExtractionNode uses AgentConfig with Gemini model

**Tasks:**
- [ ] Create workflow + 9 node files
- [ ] Create LLM prompt for StoryPointExtractionNode
- [ ] Create event JSON + playground
- [ ] Test until issue-free

---

### 1.5 Session Flow Orchestrator (IMPLEMENT FIFTH - AFTER SUBFLOWS)
**Location:** `app/workflows/session_workflow.py`
**Priority:** 5 - Manages VAPI sessions and requirement submissions

**⚠️ CRITICAL: Real-Time Analyst Triggering**

During VAPI sessions, when the agent calls `submit_requirement_result()`:
1. Requirement status updated (pending → addressed)
2. Side effects applied (e.g., update storyteller progress, unlock sections)
3. **Analyst Flow triggered IMMEDIATELY** (not after session completes)
4. Analyst runs ALL subflows to reassess state
5. Session continues with updated requirements

This creates a real-time feedback loop for responsive requirement generation.

**Event Schema:**
```python
class SessionStartEvent(BaseModel):
    storyteller_id: str
    subflow_type: str  # "trust_building", "contextual_grounding", "section_selection", "lane_development"
    section: Optional[str] = None
```

**Key Tool: submit_requirement_result()**
```python
async def submit_requirement_result(
    requirement_id: str,
    status: str,  # "addressed", "partially_addressed", "skipped"
    result: dict,  # Structured data from user response
    transcript_segment: dict  # Transcript payload with agent/user utterances
):
    # 1. Update requirement
    await RequirementService.mark_addressed(requirement_id, status, result, transcript_segment)

    # 2. Apply side effects (update storyteller, unlock sections, etc.)
    await apply_side_effects(requirement_id, result)

    # 3. TRIGGER ANALYST FLOW IMMEDIATELY
    await run_analyst_flow(storyteller_id, trigger_reason="requirement_submission")

    return {"success": True}
```

**Router Implementation:**
```python
class SubflowRouterNode(BaseRouter):
    def __init__(self, task_context: TaskContext = None):
        super().__init__(task_context=task_context)
        self.routes = [
            RouteToTrustBuilding(),
            RouteToContextualGrounding(),
            RouteToSectionSelection(),
            RouteToLaneDevelopment(),
        ]
        self.fallback = None

class RouteToTrustBuilding(RouterNode):
    def determine_next_node(self, task_context: TaskContext) -> Optional[Node]:
        event: SessionStartEvent = task_context.event
        if event.subflow_type == "trust_building":
            return TrustBuildingWorkflow()  # Instantiate subworkflow
        return None
```

**Nodes:** SessionPrepNode → SubflowRouterNode → QualityValidationNode → ProgressUpdateNode → VerificationNode → AnalystTriggerNode

**Tasks:**
- [ ] Create SessionWorkflow with router
- [ ] Implement 6 nodes + router logic
- [ ] Implement `submit_requirement_result()` tool with Analyst triggering
- [ ] Create event JSON + playground
- [ ] Test until issue-free

---

### 1.6 Analyst Flow Orchestrator (IMPLEMENT SIXTH - FINAL ORCHESTRATOR)
**Location:** `app/workflows/analyst_workflow.py`
**Priority:** 6 - Top-level orchestrator

**⚠️ CRITICAL: Analyst Runs ALL Subflows**

The Analyst Flow does NOT have its own assessment nodes. Instead, it:
1. **Runs ALL subflows sequentially** (Trust Building → Contextual Grounding → Section Selection → Lane Development → Archetype Assessment → Synthesis → Composition → Editor)
2. Each subflow **self-gates** (checks entry criteria, returns early if not met)
3. After all subflows run, determines next action based on state

**Event Schema:**
```python
class AnalystTriggerEvent(BaseModel):
    storyteller_id: str
    trigger_reason: str  # "requirement_submission", "session_completion", "storyteller_created", "periodic"
    requirement_id: Optional[str] = None  # If triggered by requirement submission
    session_id: Optional[str] = None
```

**Workflow Implementation:**
```python
class AnalystWorkflow(Workflow):
    async def run(self, storyteller_id: str, trigger_reason: str):
        """
        Analyst Flow ALWAYS runs ALL subflows.
        Each subflow self-gates based on entry criteria.
        """
        storyteller = await load_storyteller(storyteller_id)

        # Run ALL subflows (in order)
        trust_result = await TrustBuildingWorkflow.run(storyteller_id)
        grounding_result = await ContextualGroundingWorkflow.run(storyteller_id)
        selection_result = await SectionSelectionWorkflow.run(storyteller_id)
        lane_result = await LaneDevelopmentWorkflow.run(storyteller_id)
        archetype_result = await ArchetypeAssessmentWorkflow.run(storyteller_id)
        synthesis_result = await SynthesisWorkflow.run(storyteller_id)
        composition_result = await CompositionWorkflow.run(storyteller_id)
        editor_result = await EditorWorkflow.run(storyteller_id)

        # Determine next action based on state after all subflows run
        next_action = await self.determine_next_action(storyteller_id)
        return next_action

    async def determine_next_action(self, storyteller_id: str):
        """
        Based on current state after all subflows run, determine what happens next.
        """
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

**Nodes:**
1. **SubflowOrchestratorNode** - Runs all 8 subflows sequentially
2. **NextActionDeterminationNode** - Determines action based on state

**Next Action Priority Hierarchy:**
1. Pending requirements exist → Schedule session
2. No requirements + composition phase → Check story status
3. No requirements + incomplete → Review needed

**Tasks:**
- [ ] Create AnalystWorkflow with subflow orchestration
- [ ] Implement SubflowOrchestratorNode (calls all subflows)
- [ ] Implement NextActionDeterminationNode
- [ ] Create event JSON + playground
- [ ] Test until issue-free (verify all subflows run, gating works correctly)

---

### 1.7 Archetype Assessment Subflow (IMPLEMENT LATER - NOT BLOCKING)
**Location:** `app/workflows/subflows/archetype_assessment_workflow.py`
**Priority:** 7 - Can be implemented after MVP

**Entry Criteria (Gate):**
- `current_phase == 'story_capture' AND session_count >= 4 AND session_count % 3 == 0`
- If gate not met → return early (no-op)
- If gate met → execute workflow

Follow GenAI Launchpad patterns. See flow_architecture_diagrams.md for complete flow.

---

### 1.8 Synthesis Subflow (IMPLEMENT LATER - NOT BLOCKING)
**Location:** `app/workflows/subflows/synthesis_workflow.py`
**Priority:** 8 - Can be implemented after MVP

**Entry Criteria (Gate):**
- `current_phase == 'story_capture' AND any_section_has_sufficient_material == TRUE`
- If gate not met → return early (no-op)
- If gate met → execute workflow

Follow GenAI Launchpad patterns. See flow_architecture_diagrams.md for complete flow.

---

**IMPLEMENTATION ORDER SUMMARY:**
1. Trust Building Subflow (1.1) ✓
2. Contextual Grounding Subflow (1.2)
3. Section Selection Subflow (1.3)
4. Lane Development Subflow (1.4) ← THE ENGINE
5. Session Flow Orchestrator (1.5) ← Routes to subflows
6. Analyst Flow Orchestrator (1.6) ← Top-level orchestrator
7. Archetype Assessment (1.7) - Later
8. Synthesis (1.8) - Later

---

## PHASE 3: COMPOSITION & EDITOR FLOWS

### 3.1 Composition Subflow (Global Model)
**Location:** `app/workflows/subflows/composition_workflow.py`

**Entry Criteria (Gate):**
- All sufficiency gates passed:
  1. Archetype resolved (confidence >= 0.85)
  2. Material threshold (semantic sufficiency for coherent narrative)
  3. Character development (protagonist arc clear, relationships developed)
  4. Thematic coherence (themes align with archetype, motifs present)
- If any gate fails → return early (no-op)
- If all gates pass → execute workflow

**Workflow Structure:**
```
CompositionWorkflow (Subflow)
├─ SufficiencyGatesNode
│  └─ Function: Check all 4 gates (archetype, material, character, thematic)
│  └─ Type: Logic node with LLM assessment
│  └─ Gates:
│     1. Archetype resolved (confidence >= 0.85)
│     2. Material threshold (semantic sufficiency for coherent narrative)
│     3. Character development (protagonist arc clear, relationships developed)
│     4. Thematic coherence (themes align with archetype, motifs present)
│  └─ Output: all_gates_pass (boolean), gate_results{}
│  └─ should_stop: If any gate fails, stop and continue story capture
│
├─ StoryRecordCreationNode
│  └─ Function: Create story record (triggered when all gates pass)
│  └─ Type: DB write node
│  └─ Output: story_id, dominant_archetype, status="active"
│  └─ should_stop: False
│
├─ ChapterStructureDeterminationNode
│  └─ Function: Analyst determines natural narrative arcs from approved collections
│  └─ Type: AgentNode (LLM)
│  └─ Input: collections[], archetype, book_type
│  └─ Output: chapter_structure[] (fluid, not fixed)
│  └─ should_stop: False
│
├─ InitialChapterCompositionNode
│  └─ Function: Generate initial chapters from chapter structure
│  └─ Type: AgentNode (LLM)
│  └─ Input: chapter_structure, collections, storyteller voice
│  └─ Output: story_chapters[] with prose
│  └─ should_stop: False
│
├─ CharacterDevelopmentNode
│  └─ Function: Create story_character records with arcs
│  └─ Type: DB write + LLM node
│  └─ Output: story_characters[], character_relationships[]
│  └─ should_stop: False
│
├─ ThemeWeavingNode
│  └─ Function: Weave themes across chapters
│  └─ Type: DB write node
│  └─ Output: story_themes[], chapter_themes[]
│  └─ should_stop: False
│
├─ GlobalUpdateNode
│  └─ Function: After each subsequent session, weave new material into existing chapters
│  └─ Type: AgentNode (LLM)
│  └─ Input: new_session_artifacts, existing_chapters
│  └─ Output: updated_chapters[] (expanded organically)
│  └─ should_stop: False
│
└─ EditorTriggerNode
   └─ Function: Trigger Editor Flow to review changes
   └─ Type: Event emission node
   └─ Output: editor_triggered
   └─ should_stop: True (workflow complete, Editor Flow takes over)
```

**Continuous Evolution Pattern:**
- After session N adds new material → Composition automatically weaves into existing chapters
- Chapters expand organically (not batch processing)
- Editor reviews incremental changes

**Tasks:**
- [ ] Define CompositionWorkflow
- [ ] Implement SufficiencyGatesNode with all 4 gates
- [ ] Implement StoryRecordCreationNode
- [ ] Implement ChapterStructureDeterminationNode with LLM prompt
- [ ] Implement InitialChapterCompositionNode with LLM prompt
- [ ] Implement CharacterDevelopmentNode
- [ ] Implement ThemeWeavingNode
- [ ] Implement GlobalUpdateNode (continuous weaving)
- [ ] Implement EditorTriggerNode
- [ ] Create event JSON: `requests/events/composition_event.json`
- [ ] Create playground: `playground/composition_playground.py` → outputs to `requests/composition/composition_output_<timestamp>.json`
- [ ] Test until issue-free

---

### 3.2 Editor Workflow Definition
**Location:** `app/workflows/editor_workflow.py`

**Entry Criteria (Gate):**
- `story_exists == TRUE AND chapters_created == TRUE`
- If gate not met → return early (no-op)
- If gate met → execute workflow

**Workflow Structure:**
```
EditorWorkflow (Main Flow)
├─ ChapterLoadNode
│  └─ Function: Load chapters for review
│  └─ Type: DB read node
│  └─ Output: chapters[]
│  └─ should_stop: False
│
├─ ChapterQualityAssessmentNode
│  └─ Function: LLM-powered quality scoring (0-10 across 6 criteria)
│  └─ Type: AgentNode (LLM)
│  └─ Criteria:
│     1. Narrative Coherence (flow, transitions, chronology)
│     2. Pacing (scene-to-summary ratio 70-80%)
│     3. Character Consistency (voice, actions, relationships)
│     4. Sensory Details (all 5 senses, showing vs telling)
│     5. Thematic Integration (themes present, motifs)
│     6. Emotional Resonance (reflection, hooks, closing)
│  └─ Blocking Threshold: Any score < 6 = blocking issue
│  └─ Output: chapter_scores[] (ChapterScore per chapter)
│  └─ should_stop: False
│
├─ CoherenceCheckNode
│  └─ Function: Check character arcs, timeline consistency, theme continuity
│  └─ Type: Logic + LLM node
│  └─ Output: coherence_issues[]
│  └─ should_stop: False
│
├─ PacingAnalysisNode
│  └─ Function: Validate scene-to-summary ratio
│  └─ Type: Logic node
│  └─ Output: pacing_ratio, pacing_pass (boolean)
│  └─ should_stop: False
│
├─ EditRequirementsLoggingNode
│  └─ Function: Lodge edit_requirement records for issues
│  └─ Type: DB write node
│  └─ Input: chapter_scores, coherence_issues, pacing_issues
│  └─ Output: edit_requirements[] (blocking, important, polish)
│  └─ should_stop: False
│
└─ ApprovalGatingNode
   └─ Function: Approve or block for revision
   └─ Type: Logic node
   └─ Logic:
│     - IF any blocking issues (score < 6): chapter.status = "needs_revision", route to Composition
│     - ELSE IF important issues: chapter.status = "needs_polish", continue
│     - ELSE: chapter.status = "approved"
   └─ Output: approval_status, next_action (composition/export/none)
   └─ should_stop: True (workflow complete)
```

**Iterative Refinement Pattern:**
- Editor reviews chapter → Lodges edit_requirements → Composition addresses → Editor re-reviews
- Loop until all chapters approved

**Event Schema:** `EditorTriggerEvent`
- storyteller_id (required)
- story_id (required)
- chapter_ids (optional, specific chapters or all)

**Tasks:**
- [ ] Define EditorWorkflow
- [ ] Implement ChapterLoadNode
- [ ] Implement ChapterQualityAssessmentNode with LLM prompt (`app/prompts/editor/quality_assessment_prompt.py`)
- [ ] Implement CoherenceCheckNode
- [ ] Implement PacingAnalysisNode
- [ ] Implement EditRequirementsLoggingNode
- [ ] Implement ApprovalGatingNode
- [ ] Create event JSON: `requests/events/editor_event.json`
- [ ] Create playground: `playground/editor_workflow_playground.py` → outputs to `requests/editor/editor_output_<timestamp>.json`
- [ ] Test until issue-free

---

## PHASE 4: SERVICES LAYER

### 4.1 Core Services

**Tasks:**
- [ ] **StorytellerService** (`app/services/storyteller_service.py`)
  - CRUD operations for storyteller
  - Progress tracking methods
  - Boundary management
  - Section status methods

- [ ] **SessionService** (`app/services/session_service.py`)
  - Session creation and management
  - Transcript storage
  - Story point saving
  - Verification workflow

- [ ] **RequirementsService** (`app/services/requirements_service.py`)
  - Create, read, update requirements
  - Status transitions (pending → addressed → resolved)
  - Priority-based querying
  - Strategic requirements lodging

- [ ] **ArchetypeService** (`app/services/archetype_service.py`)
  - Multi-archetype tracking
  - Refinement status determination
  - User feedback integration
  - Archetype reveal logic

- [ ] **CollectionService** (`app/services/collection_service.py`)
  - Collection assembly from life events
  - Narrative role assignment
  - Synthesis management
  - User verification workflow

- [ ] **StoryService** (`app/services/story_service.py`)
  - Story record management
  - Chapter CRUD
  - Character tracking
  - Theme management
  - Draft versioning

---

### 4.2 Integration Services

**Tasks:**
- [ ] **VAPIService** (`app/services/vapi_service.py`)
  - Agent creation (configuration, system prompt, tools)
  - Call initiation (outbound, inbound, WebRTC)
  - Transcript fetching (for session recovery)
  - Webhook signature validation

- [ ] **LLMService** (`app/services/llm_service.py`)
  - Gemini API integration
  - Structured output generation (Pydantic schema enforcement)
  - Unstructured text generation
  - Error handling and retries
  - Prompt template management

- [ ] **EmailService** (`app/services/email_service.py`)
  - Verification emails (session summaries)
  - Notification emails (provisional drafts, archetype reveals)
  - Template rendering
  - SendGrid/AWS SES integration

- [ ] **PDFService** (`app/services/pdf_service.py`)
  - Memoir PDF generation
  - Standard formatting (12pt serif, 1.5 line spacing, margins)
  - Cover page, table of contents
  - Chapter assembly

---

## PHASE 5: API ENDPOINTS & WEBHOOKS

### 5.1 Core API Endpoints

**All flows triggered via `/api/v1/events/` endpoint (NOT individual endpoints per flow)**

**Tasks:**
- [ ] **Events Endpoint** (`app/api/events.py`)
  - POST `/api/v1/events/` (single endpoint for all flows)
  - Request body: `{"event_type": "analyst_trigger", "payload": {...}}`
  - Routes to appropriate Celery task based on event_type
  - Returns: `{"status": "queued", "task_id": "..."}`

- [ ] **Storytellers Endpoints** (`app/api/storytellers.py`)
  - POST `/api/v1/storytellers/` (create storyteller, triggers Analyst initialization)
  - GET `/api/v1/storytellers/{id}` (get storyteller details)
  - GET `/api/v1/storytellers/{id}/progress` (progress dashboard)
  - PATCH `/api/v1/storytellers/{id}/boundaries` (update boundaries)

- [ ] **Sessions Endpoints** (`app/api/sessions.py`)
  - GET `/api/v1/sessions/{id}` (session details with transcript and artifacts)
  - POST `/api/v1/sessions/{id}/verify` (user verification)

- [ ] **Requirements Endpoints** (`app/api/requirements.py`)
  - GET `/api/v1/storytellers/{id}/requirements` (pending requirements)
  - PATCH `/api/v1/requirements/{id}/status` (mark addressed/resolved)

- [ ] **Stories Endpoints** (`app/api/stories.py`)
  - GET `/api/v1/stories/{id}` (story with chapters)
  - GET `/api/v1/stories/{id}/chapters/{chapter_id}` (specific chapter)
  - POST `/api/v1/stories/{id}/export` (trigger PDF generation)

---

### 5.2 Webhook Endpoints

**Tasks:**
- [ ] **VAPI Webhooks** (`app/api/webhooks.py`)
  - POST `/webhooks/vapi/transcript` (real-time transcript streaming)
  - POST `/webhooks/vapi/call-ended` (end_call_report)
  - POST `/webhooks/vapi/function-call` (save_story_segment tool)
  - Signature verification for all webhooks

---

## PHASE 6: CELERY TASK HANDLERS

**Tasks:**
- [ ] **Workflow Tasks** (`app/worker/workflow_tasks.py`)
  - `run_analyst_flow(storyteller_id, trigger_reason)`
  - `run_session_flow(storyteller_id, subflow_type, section)`
  - `run_editor_flow(storyteller_id, story_id, chapter_ids)`
  - `run_archetype_assessment(storyteller_id)`
  - `run_synthesis(storyteller_id, section)`
  - `run_composition(storyteller_id, story_id)`

- [ ] **VAPI Tasks** (`app/worker/vapi_tasks.py`)
  - `process_vapi_webhook(webhook_data)` (routes based on webhook type)
  - `validate_session_quality(session_id)`
  - `fetch_transcript_after_timeout(call_id)` (session recovery)

- [ ] **Utility Tasks** (`app/worker/utility_tasks.py`)
  - `send_verification_email(storyteller_id, session_id)`
  - `send_archetype_reveal_email(storyteller_id, analysis_id)`
  - `send_provisional_draft_email(storyteller_id, collection_id)`
  - `generate_pdf_export(story_id)`
  - `handle_no_answer_callback(session_id, attempt_number)`

---

## PHASE 7: PROMPT TEMPLATES

**Tasks:**
- [ ] **Analyst Prompts** (`app/prompts/analyst/`)
  - `gap_analysis_prompt.py` (GapAnalysisNode)
  - Inputs: current_phase, life_events, session_artifacts, archetype_analysis
  - Output schema: GapAnalysisOutput

- [ ] **Session Prompts** (`app/prompts/session/`)
  - `story_point_extraction_prompt.py` (StoryPointExtractionNode)
  - Inputs: transcript
  - Output schema: StoryPointExtractionOutput

- [ ] **Archetype Prompts** (`app/prompts/archetype/`)
  - `multi_archetype_inference_prompt.py` (MultiArchetypeInferenceNode)
  - Inputs: life_events, session_artifacts, prior_analysis
  - Output schema: MultiArchetypeInferenceOutput

- [ ] **Synthesis Prompts** (`app/prompts/synthesis/`)
  - `draft_generation_prompt.py` (ProvisionalDraftGenerationNode)
  - Inputs: organized_structure, storyteller_voice, book_type
  - Output: prose text

- [ ] **Composition Prompts** (`app/prompts/composition/`)
  - `chapter_structure_prompt.py` (ChapterStructureDeterminationNode)
  - `chapter_composition_prompt.py` (InitialChapterCompositionNode)
  - `global_weaving_prompt.py` (GlobalUpdateNode)
  - Inputs: collections, archetype, book_type, existing_chapters
  - Outputs: structured chapters

- [ ] **Editor Prompts** (`app/prompts/editor/`)
  - `quality_assessment_prompt.py` (ChapterQualityAssessmentNode)
  - Inputs: chapter_content, chapter_number
  - Output schema: ChapterScore

---

## PHASE 8: SESSION RECOVERY & ERROR HANDLING

**Tasks:**
- [ ] **No Answer Handling** (`app/core/nodes/session/no_answer_handler_node.py`)
  - Wait 5 mins → callback attempt 1
  - Wait 5 mins → callback attempt 2
  - If still no answer → send email with reschedule options
  - Mark session as "no_answer"

- [ ] **Call Drop Recovery** (`app/core/nodes/session/call_drop_recovery_node.py`)
  - Monitor: If no end_call_report after 20 minutes
  - Fetch transcript from VAPI API
  - Process partial session normally
  - Analyst removes fulfilled requirements, reasserts missing
  - Notify user via email with partial transcript for review

- [ ] **Quality Failure Handling** (`app/core/nodes/session/quality_failure_node.py`)
  - Detect: Duration too short, engagement too low, sentiment negative
  - Offer reschedule to user
  - Mark session as "quality_failed"

---

## PHASE 9: INTEGRATION TESTING

### 9.1 End-to-End Flow Tests

**Tasks:**
- [ ] **Onboarding Journey Test**
  - POST /api/v1/storytellers/ → Analyst triggered
  - Analyst → trust_building
  - Session Flow → TrustBuilding → scope selected, boundaries set
  - Analyst → contextual_grounding
  - Session Flow → ContextualGrounding → timeline scaffolded
  - Verify: storyteller_progress, life_events created

- [ ] **Story Capture Journey Test**
  - Analyst → lane_development
  - Session Flow → LaneDevelopment → VAPI agent configured
  - Simulate VAPI webhook → transcript received
  - StoryPointExtraction → life_events created
  - Requirements marked addressed
  - Analyst triggered → new requirements lodged
  - Verify: session_artifacts, life_events, requirements flow

- [ ] **Archetype Refinement Journey Test**
  - Complete 4 sessions
  - Analyst triggers ArchetypeAssessment (session 4)
  - MultiArchetypeInference → candidate_archetypes
  - RefinementStatus = EXPLORING → discriminating requirements lodged
  - Complete 3 more sessions (session 7)
  - ArchetypeAssessment → RefinementStatus = NARROWING → validating requirements
  - Complete 3 more sessions (session 10)
  - ArchetypeAssessment → RefinementStatus = RESOLVED → strengthening requirements
  - Verify: archetype_analysis progression, requirement types

- [ ] **Composition & Editor Journey Test**
  - All sufficiency gates pass
  - Composition → story_record created → chapters generated
  - Editor → quality assessment → blocking issue found (sensory details < 6)
  - EditRequirementsLogging → edit_requirement created
  - Composition → GlobalUpdate → addresses edit requirement
  - Editor → re-review → all scores >= 6 → chapter approved
  - Verify: story, story_chapters, edit_requirements, chapter status transitions

- [ ] **Full Journey Test (Minimal Memoir)**
  - New storyteller → onboarding → contextual grounding
  - 10 sessions of story capture across 3 sections
  - 3 archetype assessments (sessions 4, 7, 10) → resolved
  - Synthesis → provisional drafts for 2 sections
  - Composition gates pass → story created
  - Editor → all chapters approved
  - PDF export
  - Verify: Complete data lineage from storyteller → PDF

---

### 9.2 VAPI Integration Tests

**Tasks:**
- [ ] **Mock VAPI Tests**
  - Mock VAPI agent creation
  - Mock call initiation
  - Simulate webhook payloads (transcript, call-ended, function-call)
  - Verify: LaneDevelopmentNode handles webhooks correctly

- [ ] **Staging VAPI Tests** (with real VAPI account)
  - Create real VAPI agent
  - Initiate test call
  - Conduct test interview
  - Verify: Transcript received, story points extracted

---

### 9.3 LLM Integration Tests

**Tasks:**
- [ ] **Mock LLM Tests**
  - Mock Gemini API responses
  - Test structured output parsing
  - Verify: All LLM nodes handle mocked responses

- [ ] **Live LLM Tests** (with real Gemini API)
  - Test GapAnalysisNode
  - Test MultiArchetypeInferenceNode
  - Test StoryPointExtractionNode
  - Test ProvisionalDraftGenerationNode
  - Test ChapterCompositionNode
  - Test ChapterQualityAssessmentNode
  - Verify: Response quality, schema compliance

---

## PHASE 10: PERFORMANCE & OPTIMIZATION

### 10.1 Performance Benchmarks

**Tasks:**
- [ ] **Workflow Execution Benchmarks**
  - Analyst Flow: <2s average execution
  - Session Flow: <500ms webhook processing
  - Editor Flow: <5s per chapter assessment
  - Composition Flow: <10s for initial chapter generation

- [ ] **Database Query Optimization**
  - Index critical foreign keys
  - Optimize JSONB queries (archetype_analysis.candidate_archetypes)
  - Connection pooling tuning
  - Query profiling (identify N+1 queries)

- [ ] **LLM Call Optimization**
  - Cache frequently accessed data (boundaries, section definitions)
  - Batch LLM calls where possible
  - Prompt compression strategies
  - Strategic model selection (Gemini 3 Flash vs 2.5 Flash)

---

### 10.2 Monitoring & Observability

**Tasks:**
- [ ] **Langfuse Integration**
  - Trace all LLM calls
  - Track workflow execution times
  - Monitor token usage and costs
  - Dashboard setup

- [ ] **Application Logging**
  - Structured logging (JSON format)
  - Log levels: DEBUG, INFO, WARNING, ERROR
  - Workflow execution traces
  - Error tracking and alerting

- [ ] **Health Checks & Metrics**
  - Database connection health
  - Redis connection health
  - VAPI API availability
  - Gemini API availability
  - Celery worker status
  - Queue depth monitoring

---

## PHASE 11: SECURITY HARDENING

**Tasks:**
- [ ] **Webhook Security**
  - VAPI signature verification
  - Rate limiting on webhook endpoints
  - Request size limits

- [ ] **Data Encryption**
  - Tier 3 content encryption (at-rest)
  - HTTPS/TLS for all external communication
  - Environment variable secrets management

- [ ] **Boundary Enforcement Audit**
  - Code review: All prompt generation checks boundaries
  - Test: Boundary violation scenarios
  - Verify: No sensitive prompts bypass boundaries

- [ ] **User Data Privacy**
  - GDPR compliance checklist
  - Data export functionality
  - Data deletion functionality
  - Consent tracking

---

## PHASE 12: DEPLOYMENT & PRODUCTION READINESS

### 12.1 Deployment Configuration

**Tasks:**
- [ ] **Production Docker Compose** (`docker-compose.prod.yml`)
  - Environment-specific configs
  - Resource limits (CPU, memory)
  - Restart policies
  - Volume mounts for persistence

- [ ] **Reverse Proxy Setup** (Caddy)
  - HTTPS/TLS certificates
  - Rate limiting
  - Request routing
  - Static file serving

- [ ] **Database Backup Strategy**
  - Automated daily backups
  - Point-in-time recovery
  - Backup retention policy

---

### 12.2 Production Testing

**Tasks:**
- [ ] **Load Testing**
  - Concurrent users: 100+
  - Concurrent sessions: 50+
  - Database connection pool stress test
  - Celery worker capacity test

- [ ] **Failure Scenario Testing**
  - Database connection loss
  - Redis connection loss
  - VAPI API outage
  - Gemini API outage
  - Worker process crash
  - Verify: Graceful degradation, error messages, retry logic

---

### 12.3 Documentation

**Tasks:**
- [ ] **API Documentation** (OpenAPI/Swagger)
  - All endpoints documented
  - Request/response schemas
  - Authentication requirements
  - Example payloads

- [ ] **Deployment Runbook**
  - Environment setup instructions
  - Migration procedures
  - Rollback procedures
  - Troubleshooting guide

- [ ] **Developer Onboarding Guide**
  - Local development setup
  - Running tests
  - Workflow development patterns
  - Code contribution guidelines

---

## SUMMARY: PHASE DEPENDENCIES

```
CORE ENVIRONMENT (1-5)
  ↓
PHASE 1: Analyst + Core Subflows (1.1-1.7)
  ↓
PHASE 2: Session Orchestration (2.1)
  ↓
PHASE 3: Composition + Editor (3.1-3.2)
  ↓
PHASE 4: Services Layer (4.1-4.2) [Can parallelize with Phase 1-3]
  ↓
PHASE 5: API + Webhooks (5.1-5.2)
  ↓
PHASE 6: Celery Tasks (6) [Depends on Phase 1-5]
  ↓
PHASE 7: Prompt Templates (7) [Can parallelize with Phase 1-3]
  ↓
PHASE 8: Session Recovery (8)
  ↓
PHASE 9: Integration Testing (9.1-9.3)
  ↓
PHASE 10: Performance & Optimization (10.1-10.2)
  ↓
PHASE 11: Security Hardening (11)
  ↓
PHASE 12: Deployment & Production (12.1-12.3)
```

---

## CRITICAL SUCCESS FACTORS

1. **Workflow Node Design**: All nodes must properly use `should_stop` flag per GenAI Launchpad patterns
2. **Event-Driven Architecture**: All flows triggered via `/events/` endpoint, NOT individual endpoints
3. **Requirements System**: Central to intelligent orchestration - must be implemented correctly
4. **Archetype Refinement**: Progressive narrowing (exploring → narrowing → resolved) drives strategic requirements
5. **Boundary Enforcement**: Two-level checking (general + event-specific) at every prompt generation
6. **Global Composition**: Living manuscript that evolves continuously, NOT batch chapter generation
7. **Testing Rigor**: Each subflow tested independently before integration
8. **Prompt Quality**: LLM prompts must be carefully crafted with clear output schemas
9. **VAPI Integration**: Webhook handling must be robust (signature verification, retry logic)
10. **User Authority**: Provisional outputs with verification loops at every decision point

---

**END OF HIGH-LEVEL IMPLEMENTATION PLAN**

This plan provides complete coverage of all flows, subflows, nodes, services, API endpoints, and integration points defined in the project documentation. Each phase builds systematically on previous phases, ensuring a robust, scalable, and maintainable implementation of the Everbound backend system.
