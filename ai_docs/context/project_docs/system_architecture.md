# Everbound System Architecture

**Version:** 1.1
**Date:** 2025-12-22
**Status:** Aligned with Analyst Subflow Execution Pattern

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Service Architecture](#service-architecture)
4. [Workflow Architecture](#workflow-architecture)
5. [API Design](#api-design)
6. [Integration Architecture](#integration-architecture)
7. [Data Flow & State Management](#data-flow--state-management)
8. [Deployment Architecture](#deployment-architecture)
9. [Security Architecture](#security-architecture)
10. [Implementation Guide](#implementation-guide)

---

## Executive Summary

This document defines the technical system architecture for Everbound, a Python backend that transforms personal memories into professional-quality memoirs through AI-powered, trauma-aware life story capture.

### Core Architecture Decisions

**Foundation:** GenAI Launchpad framework
**Pattern:** Real-time Analyst triggers with self-gating subflows
**Primary Flows:** Analyst (orchestrator), Session (executor), Editor (quality gate)
**Subflows:** 8 self-gating subflows run on every Analyst trigger
**Phases:** trust_building → history_building → story_capture → composition
**Integration:** VAPI for voice capture via webhooks
**Database:** PostgreSQL with event-centric schema
**Deployment:** Docker-based containerization

### Key Architectural Principles

1. **Real-Time Analyst Triggers:** Analyst Flow runs after EVERY `submit_requirement_result()` call
2. **Self-Gating Subflows:** ALL 8 subflows run on every trigger; each subflow gates itself based on entry criteria
3. **Workflow-Based Orchestration:** Flows implemented as Workflows with Nodes (Chain of Responsibility)
4. **Separation of Concerns:** Analyst orchestrates, Session executes, Editor validates
5. **Requirements-Driven Execution:** Gap analysis drives intelligent story capture with transcript segment payloads
6. **User Authority:** Provisional outputs, verification loops, trauma-aware boundaries
7. **4-Phase Journey:** trust_building → history_building → story_capture → composition with clear progression

---

## Architecture Overview

### High-Level System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                             │
│  Phone (VAPI) │ Browser (WebRTC) │ Web UI (Voice-to-Text)      │
└────────────────────────┬────────────────────────────────────────┘
                         │
            ┌────────────▼──────────────┐
            │    VAPI Platform          │
            │  - STT/TTS Engine         │
            │  - Call Management        │
            │  - WebRTC Support         │
            └────────────┬──────────────┘
                         │ Webhooks (POST)
            ┌────────────▼──────────────────────────────────────┐
            │         FastAPI Application                       │
            │  ┌──────────────────────────────────────────┐    │
            │  │  API Layer (app/api/)                    │    │
            │  │  - /webhooks/vapi/*                       │    │
            │  │  - /storytellers/*                        │    │
            │  │  - /sessions/*                            │    │
            │  │  - /stories/*                             │    │
            │  └──────────────┬───────────────────────────┘    │
            │                 │                                 │
            │  ┌──────────────▼───────────────────────────┐    │
            │  │  Event Schemas (app/schemas/)            │    │
            │  │  - VAPIWebhookEvent                       │    │
            │  │  - SessionStartEvent                      │    │
            │  │  - AnalystTriggerEvent                    │    │
            │  └──────────────┬───────────────────────────┘    │
            └─────────────────┼────────────────────────────────┘
                              │ Queue Event
            ┌─────────────────▼────────────────────────────────┐
            │              Redis Task Queue                     │
            └─────────────────┬────────────────────────────────┘
                              │ Consume Event
            ┌─────────────────▼────────────────────────────────┐
            │         Celery Worker (app/worker/)               │
            │  ┌──────────────────────────────────────────┐    │
            │  │  Task Handlers                           │    │
            │  │  - process_vapi_webhook                   │    │
            │  │  - run_analyst_flow (triggered on every   │    │
            │  │      submit_requirement_result() call)    │    │
            │  │  - run_session_flow                       │    │
            │  │  - run_editor_flow                        │    │
            │  └──────────────┬───────────────────────────┘    │
            │                 │                                 │
            │  ┌──────────────▼───────────────────────────┐    │
            │  │  Workflow Engine (app/workflows/)        │    │
            │  │  - AnalystWorkflow (runs ALL 8 subflows)  │    │
            │  │  - SessionWorkflow                        │    │
            │  │  - EditorWorkflow                         │    │
            │  └──────────────┬───────────────────────────┘    │
            │                 │                                 │
            │  ┌──────────────▼───────────────────────────┐    │
            │  │  8 Self-Gating Subflows (app/subflows/)  │    │
            │  │  - TrustBuildingSubflow                   │    │
            │  │  - ContextualGroundingSubflow             │    │
            │  │  - SectionSelectionSubflow                │    │
            │  │  - LaneDevelopmentSubflow                 │    │
            │  │  - ArchetypeAssessmentSubflow             │    │
            │  │  - SynthesisSubflow                       │    │
            │  │  - CompositionSubflow                     │    │
            │  │  - EditorSubflow                          │    │
            │  │  (Each subflow checks entry criteria)     │    │
            │  └──────────────┬───────────────────────────┘    │
            └─────────────────┼────────────────────────────────┘
                              │ DB Operations
            ┌─────────────────▼────────────────────────────────┐
            │         PostgreSQL Database                       │
            │  - storyteller, life_event, session              │
            │  - collection, story, requirement                │
            │  - archetype_analysis, session_artifact          │
            └───────────────────────────────────────────────────┘

            ┌───────────────────────────────────────────────────┐
            │         External Services                         │
            │  - Google Gemini API (LLM)                        │
            │  - VAPI API (agent management)                    │
            │  - Email/SMS (SendGrid, Twilio)                   │
            └───────────────────────────────────────────────────┘
```

---

## Service Architecture

### Component Overview

Everbound uses a **monolithic FastAPI application** with modular internal structure and **Celery-based background workers** for async processing.

#### Why Monolithic + Workers?

**Pros:**
- ✅ Simpler deployment (single application container + worker containers)
- ✅ Faster development (no inter-service communication overhead)
- ✅ Easier debugging and testing
- ✅ Shared codebase for models, utilities, prompts

**Cons:**
- ⚠️ Less granular scaling (but acceptable for MVP with <1000 users)
- ⚠️ Tighter coupling (mitigated by clear module boundaries)

**Trade-off:** Monolith is optimal for MVP. Microservices can be extracted later if specific components need independent scaling.

---

### Service Components

#### 1. FastAPI Application

**Location:** `app/main.py`
**Purpose:** HTTP API layer, webhook handlers, real-time endpoints

**Responsibilities:**
- Accept HTTP requests (REST API, webhooks)
- Validate incoming data (Pydantic schemas)
- Queue background tasks (Celery)
- Return immediate responses (201 Accepted, 200 OK)
- Stream responses for real-time interactions (SSE, WebSocket - future)

**Does NOT:**
- Execute long-running workflows directly
- Block on LLM API calls
- Perform complex business logic synchronously

**Configuration:**
```python
# app/main.py
from fastapi import FastAPI
from api.router import router as api_router
from api.webhooks import router as webhook_router

app = FastAPI(title="Everbound Backend", version="1.0.0")

# API routes
app.include_router(api_router, prefix="/api/v1")

# Webhook routes
app.include_router(webhook_router, prefix="/webhooks")

# Health check
@app.get("/health")
async def health_check():
    return {"status": "healthy"}
```

---

#### 2. Celery Worker

**Location:** `app/worker/`
**Purpose:** Execute background workflows asynchronously

**Responsibilities:**
- Consume tasks from Redis queue
- Execute Workflow instances (Analyst, Session, Editor)
- Handle retries and failures
- Update database with results
- Queue follow-up tasks

**Task Categories:**

**A. Webhook Processing Tasks** (`app/worker/vapi_tasks.py`)
```python
@celery_app.task(name="process_vapi_webhook")
def process_vapi_webhook(webhook_data: dict):
    """Process incoming VAPI webhook."""
    event = VAPIWebhookEvent(**webhook_data)

    # Route to appropriate workflow
    if event.type == "transcript_complete":
        # Trigger SessionWorkflow post-processing
        run_session_processing.delay(
            session_id=event.session_id,
            transcript=event.transcript
        )
    elif event.type == "call_ended":
        # Trigger quality validation
        validate_session_quality.delay(session_id=event.session_id)
```

**B. Workflow Execution Tasks** (`app/worker/workflow_tasks.py`)
```python
@celery_app.task(name="run_analyst_flow")
def run_analyst_flow(storyteller_id: str, requirement_result: dict = None):
    """
    Execute Analyst Flow for storyteller.

    CRITICAL: Triggered in real-time after EVERY submit_requirement_result() call.
    Runs ALL 8 subflows - each subflow self-gates based on entry criteria.
    """
    workflow = AnalystWorkflow(enable_tracing=True)
    event = AnalystTriggerEvent(
        storyteller_id=storyteller_id,
        requirement_result=requirement_result  # Includes transcript_segment
    )
    result = workflow.run(event)

    # Analyst runs ALL 8 subflows with self-gating:
    # 1. TrustBuildingSubflow - gates on: not trust_complete
    # 2. ContextualGroundingSubflow - gates on: trust_complete, not grounding_complete
    # 3. SectionSelectionSubflow - gates on: grounding_complete, not sections_selected
    # 4. LaneDevelopmentSubflow - gates on: sections_selected, has_pending_requirements
    # 5. ArchetypeAssessmentSubflow - gates on: session_count >= 4, assessment_due
    # 6. SynthesisSubflow - gates on: section_has_sufficient_material
    # 7. CompositionSubflow - gates on: phase == composition, sufficiency_gates_passed
    # 8. EditorSubflow - gates on: has_draft_content, needs_quality_review

@celery_app.task(name="submit_requirement_result")
def submit_requirement_result(
    storyteller_id: str,
    requirement_id: str,
    transcript_segment: str,
    result_data: dict
):
    """
    Submit requirement result with transcript segment.
    IMMEDIATELY triggers Analyst Flow after every call.
    """
    # Persist requirement result
    requirements_service = RequirementsService()
    requirements_service.mark_addressed(
        requirement_id=requirement_id,
        transcript_segment=transcript_segment,
        result_data=result_data
    )

    # CRITICAL: Trigger Analyst Flow in real-time
    run_analyst_flow.delay(
        storyteller_id=storyteller_id,
        requirement_result={
            "requirement_id": requirement_id,
            "transcript_segment": transcript_segment,
            "result_data": result_data
        }
    )

@celery_app.task(name="run_session_flow")
def run_session_flow(storyteller_id: str, session_context: dict):
    """Execute Session Flow for story capture."""
    workflow = SessionWorkflow(enable_tracing=True)
    event = SessionStartEvent(
        storyteller_id=storyteller_id,
        session_context=session_context
    )
    result = workflow.run(event)

    # Note: Analyst is triggered by submit_requirement_result() calls,
    # NOT by session completion. Each requirement submission triggers
    # the Analyst in real-time.

@celery_app.task(name="run_editor_flow")
def run_editor_flow(storyteller_id: str, story_id: str):
    """Execute Editor Flow for quality assessment."""
    workflow = EditorWorkflow(enable_tracing=True)
    event = EditorTriggerEvent(
        storyteller_id=storyteller_id,
        story_id=story_id
    )
    result = workflow.run(event)
```

**C. Utility Tasks** (`app/worker/utility_tasks.py`)
```python
@celery_app.task(name="send_verification_email")
def send_verification_email(storyteller_id: str, session_id: str):
    """Send session verification email to storyteller."""
    pass

@celery_app.task(name="generate_pdf_export")
def generate_pdf_export(story_id: str):
    """Generate PDF export of completed story."""
    pass
```

---

#### 3. PostgreSQL Database

**Location:** External managed service (AWS RDS, Railway, Supabase)
**Purpose:** Persistent data storage

**Access Pattern:**
- SQLAlchemy ORM models (`app/database/models/`)
- Repository pattern for data access (`app/database/repository.py`)
- Alembic for migrations (`app/alembic/`)

**Key Tables:** (See [schema/README.md](../source_docs/schema/README.md) for full details)

**Core Entities (User/Storyteller/Subject Distinction):**
- `user` - Account owner who signs up, pays, receives final product
- `storyteller` - Person who provides stories (may be invited by user)
- `subject` - Person the book is about (may differ from storyteller)

**Relationships:**
```
user (1) ──creates──> (N) project
project (1) ──has──> (1) storyteller
project (1) ──about──> (1) subject
storyteller (1) ──participates_in──> (N) session
subject (1) ──has──> (N) life_event
```

**Story Capture Tables:**
- `life_event`, `session`, `session_artifact`, `collection`, `story`
- `requirement`, `edit_requirement` (Requirements Tables)
- `archetype_analysis`

---

#### 4. Redis

**Location:** Containerized or managed service
**Purpose:** Task queue for Celery

**Configuration:**
```python
# app/core/celery_config.py
from celery import Celery

celery_app = Celery(
    "everbound",
    broker="redis://redis:6379/0",
    backend="redis://redis:6379/1"
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)
```

---

### Directory Structure (Implementation)

```
everbound_backend/
├── app/
│   ├── main.py                    # FastAPI application entry
│   ├── api/                       # REST API endpoints
│   │   ├── router.py              # Main API router
│   │   ├── webhooks.py            # VAPI webhook handlers
│   │   ├── storytellers.py        # Storyteller CRUD
│   │   ├── sessions.py            # Session management
│   │   ├── stories.py             # Story/manuscript endpoints
│   │   └── requirements.py        # Requirements table API
│   ├── worker/                    # Celery tasks
│   │   ├── celery_app.py          # Celery configuration
│   │   ├── vapi_tasks.py          # VAPI webhook processing
│   │   ├── workflow_tasks.py      # Workflow execution tasks
│   │   └── utility_tasks.py       # Email, PDF, etc.
│   ├── workflows/                 # Workflow definitions
│   │   ├── workflow_registry.py   # Workflow registry
│   │   ├── analyst_workflow.py    # Analyst Flow
│   │   ├── session_workflow.py    # Session Flow
│   │   └── editor_workflow.py     # Editor Flow
│   ├── core/                      # Workflow engine (from Launchpad)
│   │   ├── workflow.py            # Base Workflow class
│   │   ├── task.py                # TaskContext
│   │   ├── nodes/                 # Node implementations
│   │   │   ├── base.py
│   │   │   ├── agent.py           # LLM agent nodes
│   │   │   └── router.py          # Routing logic
│   │   └── schema.py              # Workflow schema definitions
│   ├── subflows/                  # 8 Self-Gating Subflows
│   │   ├── base.py                # Base subflow with entry criteria check
│   │   ├── trust_building.py      # TrustBuildingSubflow
│   │   ├── contextual_grounding.py # ContextualGroundingSubflow
│   │   ├── section_selection.py   # SectionSelectionSubflow
│   │   ├── lane_development.py    # LaneDevelopmentSubflow
│   │   ├── archetype_assessment.py # ArchetypeAssessmentSubflow
│   │   ├── synthesis.py           # SynthesisSubflow
│   │   ├── composition.py         # CompositionSubflow
│   │   └── editor.py              # EditorSubflow
│   ├── services/                  # Business logic
│   │   ├── storyteller_service.py
│   │   ├── session_service.py
│   │   ├── requirements_service.py
│   │   ├── archetype_service.py
│   │   └── vapi_service.py
│   ├── database/                  # Database layer
│   │   ├── models/                # SQLAlchemy models
│   │   │   ├── storyteller.py
│   │   │   ├── session.py
│   │   │   ├── life_event.py
│   │   │   ├── collection.py
│   │   │   ├── story.py
│   │   │   └── requirement.py
│   │   ├── repository.py          # Repository pattern
│   │   └── session.py             # DB session management
│   ├── schemas/                   # Pydantic schemas
│   │   ├── events.py              # Event schemas
│   │   ├── vapi_schema.py         # VAPI webhook payloads
│   │   ├── storyteller_schema.py  # API request/response
│   │   └── workflow_schemas.py    # Workflow-specific
│   ├── prompts/                   # LLM prompt templates
│   │   ├── analyst/
│   │   ├── session/
│   │   └── editor/
│   ├── alembic/                   # Database migrations
│   └── utils/                     # Utilities
├── docker/                        # Docker configurations
├── tests/                         # Test suite
└── .env                           # Environment variables
```

---

## Workflow Architecture

### GenAI Launchpad Workflow Pattern

**Core Concepts:**

1. **Workflow:** Orchestrator that executes a sequence of Nodes
2. **Node:** Processing unit implementing Chain of Responsibility pattern
3. **TaskContext:** State container passed between Nodes
4. **WorkflowSchema:** Defines start node, node connections, event schema

**Pattern:**
```python
class MyWorkflow(Workflow):
    workflow_schema = WorkflowSchema(
        start=FirstNode,
        event_schema=MyEventSchema,
        nodes=[
            NodeConfig(node=FirstNode, connections=[SecondNode]),
            NodeConfig(node=SecondNode, connections=[ThirdNode]),
            NodeConfig(node=ThirdNode, connections=[])
        ]
    )

class FirstNode(Node):
    async def process(self, task_context: TaskContext) -> TaskContext:
        # Process task
        result = do_something(task_context.event)
        self.save_output(result)
        return task_context
```

---

### Workflow Mapping: Everbound Flows → GenAI Launchpad

| Everbound Flow | Workflow Class | Pattern | Trigger |
|----------------|----------------|---------|---------|
| **Analyst Flow** | `AnalystWorkflow` | Runs ALL 8 subflows on every trigger.<br>Each subflow self-gates based on entry criteria. | After EVERY `submit_requirement_result()` call (real-time) |
| **Session Flow** | `SessionWorkflow` | Prepares context, executes story capture,<br>calls `submit_requirement_result()` with transcript segments | Scheduled session<br>User initiates session |
| **Editor Flow** | `EditorWorkflow` | Quality assessment of composed narrative,<br>lodges edit requirements | Composition gate passed<br>EditorSubflow triggers it |

### 8 Self-Gating Subflows (All Run on Every Analyst Trigger)

| Subflow | Entry Criteria (Self-Gating) | Purpose |
|---------|------------------------------|---------|
| **TrustBuildingSubflow** | `!trust_complete` | Introduction, scope selection, gentle profile |
| **ContextualGroundingSubflow** | `trust_complete && !grounding_complete` | Timeline scaffolding, factual anchors |
| **SectionSelectionSubflow** | `grounding_complete && !sections_selected` | Narrative lane selection |
| **LaneDevelopmentSubflow** | `sections_selected && has_pending_requirements` | Story capture with prompt packs |
| **ArchetypeAssessmentSubflow** | `session_count >= 4 && assessment_due` | Multi-archetype tracking (exploring → narrowing → resolved) |
| **SynthesisSubflow** | `section_has_sufficient_material` | Provisional draft generation |
| **CompositionSubflow** | `phase == composition && sufficiency_gates_passed` | Global continuous composition |
| **EditorSubflow** | `has_draft_content && needs_quality_review` | Quality scoring, edit requirements |

---

### 1. Analyst Workflow

**File:** `app/workflows/analyst_workflow.py`

**Purpose:** Orchestrates ALL 8 self-gating subflows after every requirement result submission

**Trigger Pattern:** Real-time after EVERY `submit_requirement_result()` call

**Event Schema:**
```python
# app/schemas/events.py
class AnalystTriggerEvent(BaseModel):
    storyteller_id: str
    requirement_result: Optional[RequirementResult] = None  # Includes transcript_segment

class RequirementResult(BaseModel):
    requirement_id: str
    transcript_segment: str  # CRITICAL: All submissions include transcript segment
    result_data: dict
```

**Workflow Definition:**
```python
# app/workflows/analyst_workflow.py
from core.workflow import Workflow
from core.schema import WorkflowSchema, NodeConfig
from subflows.trust_building import TrustBuildingSubflow
from subflows.contextual_grounding import ContextualGroundingSubflow
from subflows.section_selection import SectionSelectionSubflow
from subflows.lane_development import LaneDevelopmentSubflow
from subflows.archetype_assessment import ArchetypeAssessmentSubflow
from subflows.synthesis import SynthesisSubflow
from subflows.composition import CompositionSubflow
from subflows.editor import EditorSubflow
from schemas.events import AnalystTriggerEvent

class AnalystWorkflow(Workflow):
    """
    Analyst Flow: Orchestrates ALL 8 self-gating subflows.

    CRITICAL PATTERN:
    - Triggered in real-time after EVERY submit_requirement_result() call
    - Runs ALL 8 subflows on every trigger
    - Each subflow self-gates based on entry criteria
    - No selective execution - all subflows evaluate their entry criteria

    4 Phases: trust_building → history_building → story_capture → composition

    8 Self-Gating Subflows (run in sequence, each checks entry criteria):
    1. TrustBuildingSubflow - gates on: !trust_complete
    2. ContextualGroundingSubflow - gates on: trust_complete && !grounding_complete
    3. SectionSelectionSubflow - gates on: grounding_complete && !sections_selected
    4. LaneDevelopmentSubflow - gates on: sections_selected && has_pending_requirements
    5. ArchetypeAssessmentSubflow - gates on: session_count >= 4 && assessment_due
    6. SynthesisSubflow - gates on: section_has_sufficient_material
    7. CompositionSubflow - gates on: phase == composition && sufficiency_gates_passed
    8. EditorSubflow - gates on: has_draft_content && needs_quality_review
    """

    workflow_schema = WorkflowSchema(
        start=SubflowOrchestratorNode,
        event_schema=AnalystTriggerEvent,
        nodes=[
            NodeConfig(
                node=SubflowOrchestratorNode,
                connections=[]  # Orchestrator runs all subflows internally
            )
        ]
    )

class SubflowOrchestratorNode(Node):
    """Runs ALL 8 subflows, each self-gating based on entry criteria."""

    async def process(self, task_context: TaskContext) -> TaskContext:
        storyteller_id = task_context.event.storyteller_id

        # Load storyteller state once for all subflows
        storyteller_state = load_storyteller_state(storyteller_id)

        # Run ALL 8 subflows - each checks its own entry criteria
        subflows = [
            TrustBuildingSubflow(),
            ContextualGroundingSubflow(),
            SectionSelectionSubflow(),
            LaneDevelopmentSubflow(),
            ArchetypeAssessmentSubflow(),
            SynthesisSubflow(),
            CompositionSubflow(),
            EditorSubflow(),
        ]

        for subflow in subflows:
            # Each subflow checks entry criteria and returns early if not met
            result = await subflow.execute(storyteller_state, task_context)
            if result.actions_taken:
                # Update state for subsequent subflows
                storyteller_state = result.updated_state

        return task_context
```

**Base Subflow with Self-Gating:**
```python
# app/subflows/base.py
from abc import ABC, abstractmethod

class BaseSubflow(ABC):
    """Base class for self-gating subflows."""

    @abstractmethod
    def check_entry_criteria(self, storyteller_state: dict) -> bool:
        """Return True if subflow should execute, False to skip."""
        pass

    @abstractmethod
    async def execute_logic(self, storyteller_state: dict, task_context: TaskContext) -> SubflowResult:
        """Execute subflow logic. Only called if entry criteria met."""
        pass

    async def execute(self, storyteller_state: dict, task_context: TaskContext) -> SubflowResult:
        """Execute subflow if entry criteria are met."""
        if not self.check_entry_criteria(storyteller_state):
            return SubflowResult(actions_taken=False, updated_state=storyteller_state)

        return await self.execute_logic(storyteller_state, task_context)
```

**Example Self-Gating Subflow:**
```python
# app/subflows/lane_development.py
from subflows.base import BaseSubflow

class LaneDevelopmentSubflow(BaseSubflow):
    """Story capture subflow - gates on sections_selected and pending requirements."""

    def check_entry_criteria(self, storyteller_state: dict) -> bool:
        """
        Entry Criteria (self-gating):
        - sections_selected must be True
        - has_pending_requirements must be True
        """
        return (
            storyteller_state.get("sections_selected", False) and
            storyteller_state.get("has_pending_requirements", False)
        )

    async def execute_logic(
        self, storyteller_state: dict, task_context: TaskContext
    ) -> SubflowResult:
        """Execute lane development logic - addresses pending requirements."""
        storyteller_id = task_context.event.storyteller_id

        # Get pending requirements for current section
        requirements = get_pending_requirements(storyteller_id)

        # Generate prompts from requirements
        prompts = generate_prompts_from_requirements(requirements)

        # Lodge session preparation context
        session_context = {
            "prompts": prompts,
            "requirements_to_address": [r.id for r in requirements],
            "section": storyteller_state.get("current_section")
        }

        # Update state
        storyteller_state["session_context"] = session_context

        return SubflowResult(
            actions_taken=True,
            updated_state=storyteller_state
        )
```

**Node Implementations:**

**A. PhaseAssessmentNode**
```python
# app/core/nodes/analyst/phase_assessment_node.py
from core.nodes.base import Node
from core.task import TaskContext
from services.storyteller_service import StorytellerService
from pydantic import BaseModel

class PhaseAssessmentOutput(BaseModel):
    current_phase: str  # trust_building, history_building, story_capture, composition
    is_phase_complete: bool
    next_phase: Optional[str]
    reasoning: str

class PhaseAssessmentNode(Node):
    """Determines storyteller's current phase in canonical process."""

    class OutputType(BaseModel):
        pass  # Uses PhaseAssessmentOutput

    async def process(self, task_context: TaskContext) -> TaskContext:
        storyteller_id = task_context.event.storyteller_id

        # Load storyteller progress
        storyteller_service = StorytellerService()
        progress = storyteller_service.get_progress(storyteller_id)

        # Determine phase
        if not progress.trust_setup_complete:
            output = PhaseAssessmentOutput(
                current_phase="trust_building",
                is_phase_complete=False,
                next_phase=None,
                reasoning="Trust setup not complete"
            )
        elif not progress.contextual_grounding_complete:
            output = PhaseAssessmentOutput(
                current_phase="history_building",
                is_phase_complete=False,
                next_phase=None,
                reasoning="Timeline scaffolding incomplete"
            )
        elif progress.session_count < 10:  # Example threshold
            output = PhaseAssessmentOutput(
                current_phase="story_capture",
                is_phase_complete=False,
                next_phase=None,
                reasoning=f"Story capture in progress ({progress.session_count} sessions)"
            )
        else:
            # Check sufficiency gates for composition
            # (implementation would check archetype resolution, material thresholds)
            output = PhaseAssessmentOutput(
                current_phase="story_capture",
                is_phase_complete=True,
                next_phase="composition",
                reasoning="Sufficient material for composition"
            )

        self.save_output(output)
        task_context.metadata["current_phase"] = output.current_phase

        return task_context
```

**B. GapAnalysisNode (LLM-Powered)**
```python
# app/core/nodes/analyst/gap_analysis_node.py
from core.nodes.agent import AgentNode
from core.task import TaskContext
from services.storyteller_service import StorytellerService
from services.archetype_service import ArchetypeService
from prompts.analyst.gap_analysis_prompt import GAP_ANALYSIS_PROMPT
from pydantic import BaseModel

class Gap(BaseModel):
    gap_type: str  # "missing_scene", "underdeveloped_character", "missing_emotion"
    section: str
    description: str
    priority: str  # "critical", "important", "optional"
    suggested_prompts: List[str]

class GapAnalysisOutput(BaseModel):
    gaps: List[Gap]
    overall_assessment: str

class GapAnalysisNode(AgentNode):
    """LLM-powered gap analysis."""

    async def process(self, task_context: TaskContext) -> TaskContext:
        storyteller_id = task_context.event.storyteller_id
        current_phase = task_context.metadata["current_phase"]

        # Load context
        storyteller_service = StorytellerService()
        life_events = storyteller_service.get_life_events(storyteller_id)
        session_artifacts = storyteller_service.get_session_artifacts(storyteller_id)
        archetype_analysis = ArchetypeService().get_latest_analysis(storyteller_id)

        # Build LLM prompt
        prompt = GAP_ANALYSIS_PROMPT.format(
            current_phase=current_phase,
            life_events=life_events,
            session_artifacts=session_artifacts,
            archetype_analysis=archetype_analysis
        )

        # Call LLM (using AgentNode's built-in LLM call)
        response = await self.call_llm(
            prompt=prompt,
            model="gemini-2.0-flash-exp",
            response_schema=GapAnalysisOutput
        )

        self.save_output(response)
        task_context.metadata["gaps"] = response.gaps

        return task_context
```

**C. ArchetypeAwareRequirementsNode**
```python
# app/core/nodes/analyst/archetype_aware_requirements_node.py
from core.nodes.base import Node
from core.task import TaskContext
from services.archetype_service import ArchetypeService
from pydantic import BaseModel

class StrategicRequirement(BaseModel):
    requirement_type: str
    archetype_lane: Optional[str]
    refinement_purpose: str  # "discriminate", "validate", "strengthen"
    priority: str
    description: str
    suggested_prompts: List[str]

class ArchetypeAwareRequirementsOutput(BaseModel):
    strategic_requirements: List[StrategicRequirement]

class ArchetypeAwareRequirementsNode(Node):
    """Lodges strategic requirements based on archetype refinement status."""

    async def process(self, task_context: TaskContext) -> TaskContext:
        storyteller_id = task_context.event.storyteller_id
        gaps = task_context.metadata.get("gaps", [])

        # Get archetype analysis
        archetype_service = ArchetypeService()
        analysis = archetype_service.get_latest_analysis(storyteller_id)

        strategic_requirements = []

        if analysis and analysis.refinement_status == "exploring":
            # Lodge discriminating requirements
            strategic_requirements.extend(
                self._lodge_discriminating_requirements(analysis, gaps)
            )
        elif analysis and analysis.refinement_status == "narrowing":
            # Lodge validating requirements
            strategic_requirements.extend(
                self._lodge_validating_requirements(analysis, gaps)
            )
        elif analysis and analysis.refinement_status == "resolved":
            # Lodge strengthening requirements
            strategic_requirements.extend(
                self._lodge_strengthening_requirements(analysis, gaps)
            )

        output = ArchetypeAwareRequirementsOutput(
            strategic_requirements=strategic_requirements
        )
        self.save_output(output)
        task_context.metadata["strategic_requirements"] = strategic_requirements

        return task_context

    def _lodge_discriminating_requirements(self, analysis, gaps):
        """Create requirements that discriminate between archetype candidates."""
        # Implementation would identify pivotal events that could clarify which archetype
        pass

    def _lodge_validating_requirements(self, analysis, gaps):
        """Create requirements that validate archetype evidence."""
        pass

    def _lodge_strengthening_requirements(self, analysis, gaps):
        """Create requirements that deepen resolved archetype."""
        pass
```

**D. RequirementsLoggingNode**
```python
# app/core/nodes/analyst/requirements_logging_node.py
from core.nodes.base import Node
from core.task import TaskContext
from services.requirements_service import RequirementsService

class RequirementsLoggingNode(Node):
    """Persists requirements to database."""

    async def process(self, task_context: TaskContext) -> TaskContext:
        storyteller_id = task_context.event.storyteller_id
        gaps = task_context.metadata.get("gaps", [])
        strategic_requirements = task_context.metadata.get("strategic_requirements", [])

        requirements_service = RequirementsService()

        # Convert gaps to requirements
        for gap in gaps:
            requirements_service.create_requirement(
                storyteller_id=storyteller_id,
                requirement_type=gap.gap_type,
                section=gap.section,
                priority=gap.priority,
                description=gap.description,
                suggested_prompts=gap.suggested_prompts,
                status="pending"
            )

        # Log strategic requirements
        for req in strategic_requirements:
            requirements_service.create_requirement(
                storyteller_id=storyteller_id,
                requirement_type=req.requirement_type,
                archetype_lane=req.archetype_lane,
                archetype_refinement_purpose=req.refinement_purpose,
                priority=req.priority,
                description=req.description,
                suggested_prompts=req.suggested_prompts,
                status="pending"
            )

        return task_context
```

**E. NextActionDeterminationNode**
```python
# app/core/nodes/analyst/next_action_node.py
from core.nodes.base import Node
from core.task import TaskContext
from services.requirements_service import RequirementsService
from pydantic import BaseModel

class NextActionOutput(BaseModel):
    next_flow: str  # "session", "editor", "none"
    subflow_type: Optional[str]  # If next_flow=session: which subflow
    reasoning: str

class NextActionDeterminationNode(Node):
    """Determines next action based on phase and requirements."""

    async def process(self, task_context: TaskContext) -> TaskContext:
        storyteller_id = task_context.event.storyteller_id
        current_phase = task_context.metadata["current_phase"]

        # Load pending requirements
        requirements_service = RequirementsService()
        pending_reqs = requirements_service.get_pending_requirements(storyteller_id)

        if current_phase == "trust_building":
            output = NextActionOutput(
                next_flow="session",
                subflow_type="trust_building",
                reasoning="Trust building phase incomplete"
            )
        elif current_phase == "history_building":
            output = NextActionOutput(
                next_flow="session",
                subflow_type="contextual_grounding",
                reasoning="Timeline scaffolding needed"
            )
        elif current_phase == "story_capture":
            # Prioritize critical requirements
            critical_reqs = [r for r in pending_reqs if r.priority == "critical"]
            if critical_reqs:
                # Select highest priority section
                top_section = self._select_top_section(critical_reqs)
                output = NextActionOutput(
                    next_flow="session",
                    subflow_type="lane_development",
                    reasoning=f"Critical requirements in {top_section}"
                )
            else:
                output = NextActionOutput(
                    next_flow="none",
                    subflow_type=None,
                    reasoning="No critical requirements pending"
                )
        elif current_phase == "composition":
            output = NextActionOutput(
                next_flow="editor",
                subflow_type=None,
                reasoning="Ready for composition and quality review"
            )

        self.save_output(output)
        task_context.metadata["next_flow"] = output.next_flow
        task_context.metadata["subflow_type"] = output.subflow_type

        return task_context

    def _select_top_section(self, requirements):
        """Select section with most critical requirements."""
        # Implementation would prioritize sections
        pass
```

---

### 2. Session Workflow

**File:** `app/workflows/session_workflow.py`

**Purpose:** Execute story capture sessions, route to appropriate subflow, extract story points

**Event Schema:**
```python
# app/schemas/events.py
class SessionStartEvent(BaseModel):
    storyteller_id: str
    subflow_type: str  # "trust_building", "contextual_grounding", "lane_development"
    section: Optional[str] = None  # For lane_development
    session_id: Optional[str] = None  # If resuming existing session
```

**Workflow Definition:**
```python
# app/workflows/session_workflow.py
from core.workflow import Workflow
from core.schema import WorkflowSchema, NodeConfig
from core.nodes.session.session_prep_node import SessionPrepNode
from core.nodes.session.subflow_router_node import SubflowRouterNode
from core.nodes.session.trust_building_node import TrustBuildingNode
from core.nodes.session.contextual_grounding_node import ContextualGroundingNode
from core.nodes.session.lane_development_node import LaneDevelopmentNode
from core.nodes.session.story_point_extraction_node import StoryPointExtractionNode
from core.nodes.session.verification_node import VerificationNode
from schemas.events import SessionStartEvent

class SessionWorkflow(Workflow):
    """
    Session Flow: Execute story capture sessions.

    Flow:
    1. SessionPrepNode - Load context, requirements, boundaries
    2. SubflowRouterNode - Route to appropriate subflow node
    3. [SubflowNode] - Trust Building OR Contextual Grounding OR Lane Development
    4. StoryPointExtractionNode - Extract story points from transcript
    5. VerificationNode - Send to user for verification
    """

    workflow_schema = WorkflowSchema(
        start=SessionPrepNode,
        event_schema=SessionStartEvent,
        nodes=[
            NodeConfig(node=SessionPrepNode, connections=[SubflowRouterNode]),
            NodeConfig(node=SubflowRouterNode, connections=[
                TrustBuildingNode,
                ContextualGroundingNode,
                LaneDevelopmentNode
            ]),
            NodeConfig(node=TrustBuildingNode, connections=[StoryPointExtractionNode]),
            NodeConfig(node=ContextualGroundingNode, connections=[StoryPointExtractionNode]),
            NodeConfig(node=LaneDevelopmentNode, connections=[StoryPointExtractionNode]),
            NodeConfig(node=StoryPointExtractionNode, connections=[VerificationNode]),
            NodeConfig(node=VerificationNode, connections=[])
        ]
    )
```

**Key Node: SubflowRouterNode**
```python
# app/core/nodes/session/subflow_router_node.py
from core.nodes.router import BaseRouter
from core.task import TaskContext
from core.nodes.session.trust_building_node import TrustBuildingNode
from core.nodes.session.contextual_grounding_node import ContextualGroundingNode
from core.nodes.session.lane_development_node import LaneDevelopmentNode

class SubflowRouterNode(BaseRouter):
    """Routes to appropriate subflow node based on subflow_type."""

    async def route(self, task_context: TaskContext) -> Type[Node]:
        subflow_type = task_context.event.subflow_type

        routing_map = {
            "trust_building": TrustBuildingNode,
            "contextual_grounding": ContextualGroundingNode,
            "lane_development": LaneDevelopmentNode
        }

        return routing_map.get(subflow_type, LaneDevelopmentNode)
```

**Key Node: LaneDevelopmentNode (Example Subflow)**
```python
# app/core/nodes/session/lane_development_node.py
from core.nodes.agent import AgentNode
from core.task import TaskContext
from services.vapi_service import VAPIService
from services.requirements_service import RequirementsService
from services.storyteller_service import StorytellerService
from prompts.session.lane_development_prompt import LANE_DEVELOPMENT_PROMPT
from pydantic import BaseModel

class VAPIAgentConfig(BaseModel):
    system_prompt: str
    first_message: str
    tools: List[dict]
    model: str = "gemini-2.0-flash-exp"

class LaneDevelopmentOutput(BaseModel):
    vapi_agent_id: str
    vapi_call_id: Optional[str]
    session_id: str

class LaneDevelopmentNode(AgentNode):
    """Executes lane development (story capture) subflow via VAPI."""

    async def process(self, task_context: TaskContext) -> TaskContext:
        storyteller_id = task_context.event.storyteller_id
        section = task_context.event.section

        # Load context
        storyteller_service = StorytellerService()
        storyteller = storyteller_service.get_storyteller(storyteller_id)
        boundaries = storyteller_service.get_boundaries(storyteller_id)
        requirements = RequirementsService().get_requirements_for_section(
            storyteller_id, section
        )

        # Generate prompts from requirements
        prompts = self._generate_prompts_from_requirements(requirements)

        # Build VAPI agent configuration
        system_prompt = LANE_DEVELOPMENT_PROMPT.format(
            storyteller_name=storyteller.name,
            section=section,
            boundaries=boundaries,
            prompts=prompts
        )

        agent_config = VAPIAgentConfig(
            system_prompt=system_prompt,
            first_message=f"Hi {storyteller.name}, let's explore your {section} today.",
            tools=[
                {
                    "type": "function",
                    "function": {
                        "name": "save_story_segment",
                        "description": "Save a key story moment or detail",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "segment": {"type": "string"},
                                "emotion": {"type": "string"}
                            }
                        }
                    }
                }
            ]
        )

        # Create VAPI agent and initiate call
        vapi_service = VAPIService()
        vapi_agent = vapi_service.create_agent(agent_config)

        # Initiate call (outbound or wait for inbound)
        call = vapi_service.create_call(
            agent_id=vapi_agent["id"],
            phone_number=storyteller.phone_number,
            # OR wait for web-based call initiation
        )

        # Create session record
        session_id = storyteller_service.create_session(
            storyteller_id=storyteller_id,
            subflow_type="lane_development",
            section=section,
            vapi_agent_id=vapi_agent["id"],
            vapi_call_id=call.get("id") if call else None,
            status="in_progress"
        )

        output = LaneDevelopmentOutput(
            vapi_agent_id=vapi_agent["id"],
            vapi_call_id=call.get("id") if call else None,
            session_id=session_id
        )

        self.save_output(output)
        task_context.metadata["session_id"] = session_id

        return task_context

    def _generate_prompts_from_requirements(self, requirements):
        """Convert requirements into conversational prompts."""
        # Implementation would transform requirement descriptions into natural prompts
        pass
```

**Key Node: StoryPointExtractionNode**
```python
# app/core/nodes/session/story_point_extraction_node.py
from core.nodes.agent import AgentNode
from core.task import TaskContext
from services.session_service import SessionService
from prompts.session.story_point_extraction_prompt import STORY_POINT_EXTRACTION_PROMPT
from pydantic import BaseModel

class StoryPoint(BaseModel):
    segment: str
    people_mentioned: List[str]
    places_mentioned: List[str]
    time_period: Optional[str]
    emotions: List[str]
    themes: List[str]
    event_type: str

class StoryPointExtractionOutput(BaseModel):
    story_points: List[StoryPoint]

class StoryPointExtractionNode(AgentNode):
    """Extracts structured story points from session transcript."""

    async def process(self, task_context: TaskContext) -> TaskContext:
        session_id = task_context.metadata["session_id"]

        # Load session transcript (fetched from VAPI webhook)
        session_service = SessionService()
        transcript = session_service.get_transcript(session_id)

        # Build extraction prompt
        prompt = STORY_POINT_EXTRACTION_PROMPT.format(
            transcript=transcript
        )

        # Call LLM with structured output
        response = await self.call_llm(
            prompt=prompt,
            model="gemini-2.0-flash-exp",
            response_schema=StoryPointExtractionOutput
        )

        # Save story points to database
        session_service.save_story_points(session_id, response.story_points)

        self.save_output(response)

        return task_context
```

---

### 3. Editor Workflow

**File:** `app/workflows/editor_workflow.py`

**Purpose:** Quality assessment of composed narrative, lodge edit requirements

**Event Schema:**
```python
# app/schemas/events.py
class EditorTriggerEvent(BaseModel):
    storyteller_id: str
    story_id: str
    chapter_ids: Optional[List[str]] = None  # Specific chapters or all
```

**Workflow Definition:**
```python
# app/workflows/editor_workflow.py
from core.workflow import Workflow
from core.schema import WorkflowSchema, NodeConfig
from core.nodes.editor.chapter_quality_node import ChapterQualityNode
from core.nodes.editor.coherence_check_node import CoherenceCheckNode
from core.nodes.editor.pacing_analysis_node import PacingAnalysisNode
from core.nodes.editor.edit_requirements_node import EditRequirementsNode
from core.nodes.editor.approval_gating_node import ApprovalGatingNode
from schemas.events import EditorTriggerEvent

class EditorWorkflow(Workflow):
    """
    Editor Flow: Quality gate for composed narrative.

    Flow:
    1. ChapterQualityNode - Assess each chapter (0-10 across 6 criteria)
    2. CoherenceCheckNode - Check character/timeline consistency
    3. PacingAnalysisNode - Validate scene-to-summary ratio
    4. EditRequirementsNode - Lodge edit requirements for issues
    5. ApprovalGatingNode - Approve or block for revision
    """

    workflow_schema = WorkflowSchema(
        start=ChapterQualityNode,
        event_schema=EditorTriggerEvent,
        nodes=[
            NodeConfig(node=ChapterQualityNode, connections=[CoherenceCheckNode]),
            NodeConfig(node=CoherenceCheckNode, connections=[PacingAnalysisNode]),
            NodeConfig(node=PacingAnalysisNode, connections=[EditRequirementsNode]),
            NodeConfig(node=EditRequirementsNode, connections=[ApprovalGatingNode]),
            NodeConfig(node=ApprovalGatingNode, connections=[])
        ]
    )
```

**Key Node: ChapterQualityNode**
```python
# app/core/nodes/editor/chapter_quality_node.py
from core.nodes.agent import AgentNode
from core.task import TaskContext
from services.story_service import StoryService
from prompts.editor.quality_assessment_prompt import QUALITY_ASSESSMENT_PROMPT
from pydantic import BaseModel

class ChapterScore(BaseModel):
    chapter_id: str
    narrative_coherence: int  # 0-10
    pacing: int  # 0-10
    character_consistency: int  # 0-10
    sensory_details: int  # 0-10
    thematic_integration: int  # 0-10
    emotional_resonance: int  # 0-10
    overall_score: float
    feedback: str

class ChapterQualityOutput(BaseModel):
    chapter_scores: List[ChapterScore]

class ChapterQualityNode(AgentNode):
    """LLM-powered quality assessment of chapters."""

    async def process(self, task_context: TaskContext) -> TaskContext:
        story_id = task_context.event.story_id
        chapter_ids = task_context.event.chapter_ids

        # Load chapters
        story_service = StoryService()
        chapters = story_service.get_chapters(story_id, chapter_ids)

        chapter_scores = []

        for chapter in chapters:
            # Build assessment prompt
            prompt = QUALITY_ASSESSMENT_PROMPT.format(
                chapter_content=chapter.content,
                chapter_number=chapter.chapter_number
            )

            # Call LLM
            score = await self.call_llm(
                prompt=prompt,
                model="gemini-2.0-flash-exp",
                response_schema=ChapterScore
            )

            # Save score to database
            story_service.save_chapter_score(chapter.id, score)

            chapter_scores.append(score)

        output = ChapterQualityOutput(chapter_scores=chapter_scores)
        self.save_output(output)
        task_context.metadata["chapter_scores"] = chapter_scores

        return task_context
```

---

## API Design

### REST API Endpoints

**Base URL:** `/api/v1`

#### Storyteller Endpoints

```python
# app/api/storytellers.py
from fastapi import APIRouter, HTTPException
from schemas.storyteller_schema import StorytellerCreate, StorytellerResponse
from services.storyteller_service import StorytellerService

router = APIRouter(prefix="/storytellers", tags=["Storytellers"])

@router.post("/", response_model=StorytellerResponse, status_code=201)
async def create_storyteller(data: StorytellerCreate):
    """Create new storyteller and initialize progress."""
    service = StorytellerService()
    storyteller = service.create_storyteller(data)

    # Trigger Analyst Flow for initialization
    from worker.workflow_tasks import run_analyst_flow
    run_analyst_flow.delay(
        storyteller_id=storyteller.id,
        trigger_reason="initialization"
    )

    return storyteller

@router.get("/{storyteller_id}", response_model=StorytellerResponse)
async def get_storyteller(storyteller_id: str):
    """Get storyteller by ID."""
    service = StorytellerService()
    storyteller = service.get_storyteller(storyteller_id)
    if not storyteller:
        raise HTTPException(status_code=404, detail="Storyteller not found")
    return storyteller

@router.get("/{storyteller_id}/progress")
async def get_progress(storyteller_id: str):
    """Get storyteller progress dashboard."""
    service = StorytellerService()
    return service.get_progress_dashboard(storyteller_id)

@router.post("/{storyteller_id}/boundaries")
async def update_boundaries(storyteller_id: str, boundaries: BoundaryUpdate):
    """Update storyteller boundaries."""
    service = StorytellerService()
    return service.update_boundaries(storyteller_id, boundaries)
```

#### Session Endpoints

```python
# app/api/sessions.py
from fastapi import APIRouter
from schemas.session_schema import SessionCreate, SessionResponse
from services.session_service import SessionService

router = APIRouter(prefix="/sessions", tags=["Sessions"])

@router.post("/", response_model=SessionResponse, status_code=201)
async def create_session(data: SessionCreate):
    """Create and trigger a new session."""
    service = SessionService()
    session = service.create_session(data)

    # Trigger Session Flow
    from worker.workflow_tasks import run_session_flow
    run_session_flow.delay(
        storyteller_id=data.storyteller_id,
        subflow_type=data.subflow_type
    )

    return session

@router.get("/{session_id}")
async def get_session(session_id: str):
    """Get session details including transcript and artifacts."""
    service = SessionService()
    return service.get_session_details(session_id)

@router.post("/{session_id}/verify")
async def verify_session(session_id: str, verification: SessionVerification):
    """User verifies session content."""
    service = SessionService()
    service.process_verification(session_id, verification)

    # Trigger Analyst Flow after verification
    session = service.get_session(session_id)
    from worker.workflow_tasks import run_analyst_flow
    run_analyst_flow.delay(
        storyteller_id=session.storyteller_id,
        trigger_reason="post_session"
    )

    return {"status": "verified"}
```

#### Requirements Endpoints

```python
# app/api/requirements.py
from fastapi import APIRouter
from services.requirements_service import RequirementsService

router = APIRouter(prefix="/requirements", tags=["Requirements"])

@router.get("/storyteller/{storyteller_id}")
async def get_requirements(storyteller_id: str, status: str = "pending"):
    """Get requirements for storyteller."""
    service = RequirementsService()
    return service.get_requirements(storyteller_id, status)

@router.patch("/{requirement_id}/status")
async def update_requirement_status(requirement_id: str, status: str):
    """Mark requirement as addressed/resolved."""
    service = RequirementsService()
    return service.update_status(requirement_id, status)
```

---

### Webhook Endpoints

#### VAPI Webhooks

```python
# app/api/webhooks.py
from fastapi import APIRouter, Request, HTTPException
from schemas.vapi_schema import VAPIWebhookPayload
from worker.vapi_tasks import process_vapi_webhook

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])

@router.post("/vapi/transcript")
async def vapi_transcript_webhook(request: Request):
    """Receive transcript updates from VAPI."""
    payload = await request.json()

    # Validate webhook signature (VAPI provides signature verification)
    # signature = request.headers.get("x-vapi-signature")
    # validate_vapi_signature(payload, signature)

    # Queue for async processing
    process_vapi_webhook.delay(payload)

    return {"status": "received"}

@router.post("/vapi/call-ended")
async def vapi_call_ended_webhook(request: Request):
    """Receive call end notification from VAPI."""
    payload = await request.json()

    # Extract session info and trigger quality validation
    from worker.vapi_tasks import validate_session_quality
    validate_session_quality.delay(
        session_id=payload["metadata"]["session_id"]
    )

    return {"status": "received"}

@router.post("/vapi/function-call")
async def vapi_function_call_webhook(request: Request):
    """Handle VAPI function calls (e.g., save_story_segment)."""
    payload = await request.json()

    function_name = payload["message"]["function_call"]["name"]
    arguments = payload["message"]["function_call"]["arguments"]

    if function_name == "save_story_segment":
        # Save segment immediately
        from services.session_service import SessionService
        SessionService().save_story_segment(
            session_id=payload["metadata"]["session_id"],
            segment=arguments["segment"],
            emotion=arguments.get("emotion")
        )
        return {"result": "saved"}

    return {"error": "unknown function"}
```

---

## Integration Architecture

### VAPI Integration

**VAPI Role:** Voice conversation platform with STT/TTS, call management, and webhook callbacks

**Integration Points:**

1. **Agent Creation** (Session Flow pre-call prep)
2. **Call Initiation** (Outbound or inbound)
3. **Real-time Transcript Streaming** (Webhook)
4. **Function Calling** (save_story_segment tool)
5. **Call End Report** (Webhook)

**VAPI Service Implementation:**

```python
# app/services/vapi_service.py
import httpx
from typing import Dict, Any
from core.config import settings

class VAPIService:
    """Service for interacting with VAPI API."""

    def __init__(self):
        self.api_key = settings.VAPI_API_KEY
        self.base_url = "https://api.vapi.ai"
        self.client = httpx.AsyncClient(
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
        )

    async def create_agent(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create VAPI agent with custom configuration.

        Args:
            config: {
                "system_prompt": str,
                "first_message": str,
                "model": "gemini-2.0-flash-exp",
                "tools": List[dict]
            }
        """
        payload = {
            "name": f"Everbound Agent - {config.get('session_id')}",
            "model": {
                "provider": "google",
                "model": config.get("model", "gemini-2.0-flash-exp"),
                "messages": [
                    {"role": "system", "content": config["system_prompt"]}
                ]
            },
            "voice": {
                "provider": "elevenlabs",
                "voiceId": "ErXwobaYiN019PkySvjV"  # Configurable
            },
            "firstMessage": config["first_message"],
            "functions": config.get("tools", []),
            "serverUrl": f"{settings.BACKEND_URL}/webhooks/vapi/function-call",
            "serverUrlSecret": settings.VAPI_SERVER_SECRET
        }

        response = await self.client.post(f"{self.base_url}/agent", json=payload)
        response.raise_for_status()
        return response.json()

    async def create_call(self, agent_id: str, phone_number: str = None) -> Dict[str, Any]:
        """
        Initiate outbound call or create web-callable session.

        Args:
            agent_id: VAPI agent ID
            phone_number: If provided, initiate outbound call. Otherwise, return web call URL.
        """
        if phone_number:
            # Outbound call
            payload = {
                "assistantId": agent_id,
                "phoneNumber": phone_number
            }
            response = await self.client.post(f"{self.base_url}/call", json=payload)
        else:
            # Web call (return URL for frontend)
            payload = {
                "assistantId": agent_id,
                "type": "web"
            }
            response = await self.client.post(f"{self.base_url}/call", json=payload)

        response.raise_for_status()
        return response.json()

    async def get_transcript(self, call_id: str) -> Dict[str, Any]:
        """Fetch full transcript for completed call."""
        response = await self.client.get(f"{self.base_url}/call/{call_id}")
        response.raise_for_status()
        return response.json()
```

**VAPI Webhook Payload Examples:**

**Transcript Update:**
```json
{
  "type": "transcript",
  "callId": "call_abc123",
  "metadata": {
    "session_id": "sess_xyz789"
  },
  "transcript": {
    "role": "user",
    "content": "I grew up in a small town in Ohio..."
  }
}
```

**Call Ended:**
```json
{
  "type": "end-of-call-report",
  "callId": "call_abc123",
  "metadata": {
    "session_id": "sess_xyz789"
  },
  "duration": 480,
  "transcript": "Full transcript...",
  "recordingUrl": "https://recordings.vapi.ai/...",
  "endedReason": "assistant-ended-call"
}
```

---

### LLM Integration (Google Gemini)

**Service Implementation:**

```python
# app/services/llm_service.py
import google.generativeai as genai
from typing import Any, Type
from pydantic import BaseModel
from core.config import settings

class LLMService:
    """Service for interacting with Google Gemini API."""

    def __init__(self):
        genai.configure(api_key=settings.GEMINI_API_KEY)
        self.model = genai.GenerativeModel('gemini-2.0-flash-exp')

    async def generate_structured(
        self,
        prompt: str,
        response_schema: Type[BaseModel]
    ) -> BaseModel:
        """
        Generate structured output using Gemini with schema enforcement.

        Args:
            prompt: LLM prompt
            response_schema: Pydantic model defining expected output structure
        """
        # Convert Pydantic schema to JSON schema for Gemini
        json_schema = response_schema.model_json_schema()

        response = await self.model.generate_content(
            prompt,
            generation_config={
                "response_mime_type": "application/json",
                "response_schema": json_schema
            }
        )

        # Parse response into Pydantic model
        return response_schema.model_validate_json(response.text)

    async def generate_text(self, prompt: str) -> str:
        """Generate unstructured text response."""
        response = await self.model.generate_content(prompt)
        return response.text
```

---

## Data Flow & State Management

### Real-Time Analyst Trigger Flow

**Critical Pattern:** Analyst Flow is triggered in real-time after EVERY `submit_requirement_result()` call

```
Session Flow captures story content
  ↓
Requirement addressed with transcript segment
  ↓
submit_requirement_result(
    storyteller_id="s123",
    requirement_id="req-001",
    transcript_segment="I grew up in a small town in Ohio...",
    result_data={...}
)
  ↓
IMMEDIATELY triggers run_analyst_flow.delay()
  ↓
TaskContext created:
{
  "event": AnalystTriggerEvent(
    storyteller_id="s123",
    requirement_result={
      "requirement_id": "req-001",
      "transcript_segment": "I grew up in a small town..."
    }
  ),
  "nodes": {},
  "metadata": {}
}
  ↓
SubflowOrchestratorNode.process(task_context)
  → Loads storyteller_state once
  → Runs ALL 8 subflows in sequence:

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
  ↓
All subflows complete (each self-gated)
  ↓
TaskContext returned with updated state
```

**Key Points:**
- **Real-time trigger**: Analyst runs after EVERY requirement submission, not after session completion
- **Self-gating**: ALL 8 subflows run, but each checks its own entry criteria
- **No selective execution**: The orchestrator doesn't choose which subflow to run
- **Transcript payloads**: Every requirement result includes the transcript segment

---

### Database State Management

**Key Patterns:**

1. **Optimistic Updates:** Workflows assume DB writes succeed, rollback on failure
2. **Idempotency:** Tasks can be retried safely (use unique IDs, check-before-insert)
3. **Event Sourcing (Lite):** Session interactions stored as append-only log
4. **Versioning:** Archetype analyses, story drafts versioned for rollback

**Example: Session Processing State Updates**

```python
# In LaneDevelopmentNode
session = db.create_session(
    storyteller_id=storyteller_id,
    subflow_type="lane_development",
    status="preparing"
)

# VAPI call initiated
db.update_session(session.id, status="in_progress", vapi_call_id=call_id)

# Webhook received: transcript chunk
db.add_session_interaction(session.id, interaction_data)

# Webhook received: call ended
db.update_session(session.id, status="processing")

# StoryPointExtractionNode
story_points = extract_story_points(transcript)
db.save_session_artifacts(session.id, story_points)
db.update_session(session.id, status="awaiting_verification")

# User verifies
db.update_session(session.id, status="verified")

# Analyst Flow triggered
db.update_session(session.id, status="completed")
```

---

## Frontend Architecture Concepts

> **Note:** This section documents frontend page concepts discussed in the 2025-12-22 meeting. The frontend is intentionally simple - backend drives content, frontend renders.

### Design Philosophy

**Backend-Driven UI:** The backend pushes questions and content; the frontend is a thin rendering layer that:
- Displays one question at a time
- Accepts input based on storyteller's interaction preference
- Renders progress dashboards from backend data

### Core Frontend Pages

#### 1. Session Page
**Purpose:** Where storyteller interacts with the session agent

**Behavior:**
- Renders questions one at a time (pushed from backend)
- Input mode adapts to storyteller preference:
  - Voice agent reads question aloud (in_app_voice mode)
  - Question displayed as text (in_app_text mode)
  - Phone callback scheduled (phone_callback mode)
- Minimal UI - question + input area + progress indicator

#### 2. Story Arc Dashboard (Archetype Page)
**Purpose:** Visualize story development once sufficient life events are captured

**Features:**
- Timeline visualization of life events
- Story arc formation display
- Beats, themes, and character development indicators
- Section completion status
- (Optional) Archetype reveal when resolved

**When Available:** After sufficient material collected (gated by backend)

#### 3. Manuscript Editing UI
**Purpose:** Allow storyteller to interact with and edit the forming manuscript

**Features:**
- View synthesized chapters/sections
- Request changes ("this feels too formal, make it warmer")
- Approve/reject provisional drafts
- See how stories are woven together

#### 4. Resolution/Publishing Page
**Purpose:** Finalize and export the completed memoir

**Features:**
- Final manuscript review
- Chapter ordering adjustments
- Export options (PDF for MVP)
- Order printed copies (external service integration)

### API Patterns for Frontend

**Backend pushes content via:**
```
GET /api/v1/storytellers/{id}/next-question
→ Returns: { question, input_type, context, progress }

POST /api/v1/storytellers/{id}/submit-response
→ Body: { question_id, response, transcript_segment }
→ Triggers: Analyst Flow (real-time)

GET /api/v1/storytellers/{id}/story-arc
→ Returns: { life_events, themes, beats, arc_visualization }

GET /api/v1/stories/{id}/manuscript
→ Returns: { chapters, status, edit_requirements }
```

---

## Deployment Architecture

### Docker Compose Setup

**File:** `docker-compose.yml`

```yaml
version: '3.8'

services:
  # FastAPI application
  api:
    build:
      context: .
      dockerfile: docker/Dockerfile.api
    container_name: everbound-api
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/everbound
      - REDIS_URL=redis://redis:6379/0
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - VAPI_API_KEY=${VAPI_API_KEY}
      - BACKEND_URL=https://api.everbound.com
    depends_on:
      - db
      - redis
    volumes:
      - ./app:/app/app
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

  # Celery worker
  worker:
    build:
      context: .
      dockerfile: docker/Dockerfile.worker
    container_name: everbound-worker
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/everbound
      - REDIS_URL=redis://redis:6379/0
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - VAPI_API_KEY=${VAPI_API_KEY}
    depends_on:
      - db
      - redis
    volumes:
      - ./app:/app/app
    command: celery -A app.worker.celery_app worker --loglevel=info

  # PostgreSQL database
  db:
    image: postgres:15
    container_name: everbound-db
    environment:
      - POSTGRES_DB=everbound
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  # Redis for Celery
  redis:
    image: redis:7-alpine
    container_name: everbound-redis
    ports:
      - "6379:6379"

  # Caddy reverse proxy (production)
  caddy:
    image: caddy:2-alpine
    container_name: everbound-caddy
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - api

volumes:
  postgres_data:
  caddy_data:
  caddy_config:
```

---

### Environment Configuration

**File:** `.env`

```bash
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/everbound

# Redis
REDIS_URL=redis://localhost:6379/0

# LLM APIs
GEMINI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_openai_api_key  # Fallback

# VAPI
VAPI_API_KEY=your_vapi_api_key
VAPI_SERVER_SECRET=your_webhook_secret

# Backend
BACKEND_URL=https://api.everbound.com

# Email
SENDGRID_API_KEY=your_sendgrid_key
FROM_EMAIL=noreply@everbound.com

# Monitoring
LANGFUSE_PUBLIC_KEY=your_langfuse_public_key
LANGFUSE_SECRET_KEY=your_langfuse_secret_key
```

---

## Security Architecture

### Authentication & Authorization

**User Authentication:** (Assumed external, e.g., Firebase, Auth0, Supabase Auth)

**API Key Authentication for Webhooks:**
```python
# app/core/security.py
from fastapi import Header, HTTPException

async def verify_vapi_webhook(x_vapi_signature: str = Header(...)):
    """Verify VAPI webhook signature."""
    # Implementation: HMAC verification
    pass

async def verify_api_key(x_api_key: str = Header(...)):
    """Verify API key for non-user endpoints."""
    if x_api_key != settings.INTERNAL_API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API key")
```

---

### Boundary Checking Before Prompt Generation

**Implementation in LaneDevelopmentNode:**

```python
def _generate_prompts_from_requirements(self, requirements, boundaries):
    """Filter requirements based on storyteller boundaries."""
    filtered_prompts = []

    for req in requirements:
        # Check if prompt involves sensitive topics
        if req.involves_trauma:
            if not boundaries.comfortable_discussing_trauma:
                continue  # Skip trauma-related prompt

        if req.involves_romance:
            if not boundaries.comfortable_discussing_romance:
                continue

        # Check event-specific boundaries
        if req.life_event_id:
            event_boundary = get_event_boundary(req.life_event_id)
            if event_boundary and not event_boundary.comfortable_discussing:
                continue  # Skip this event

        filtered_prompts.append(req.suggested_prompts)

    return filtered_prompts
```

---

### Data Encryption

**At Rest:** PostgreSQL encryption (managed service provider handles this)

**In Transit:** HTTPS/TLS for all API communication

**Tier 3 Content (Private):**
```python
# app/services/privacy_service.py
from cryptography.fernet import Fernet

class PrivacyService:
    """Handle Tier 3 (private) content encryption."""

    def __init__(self):
        self.cipher = Fernet(settings.ENCRYPTION_KEY)

    def encrypt_sensitive_content(self, content: str) -> str:
        """Encrypt Tier 3 content before storage."""
        return self.cipher.encrypt(content.encode()).decode()

    def decrypt_sensitive_content(self, encrypted: str) -> str:
        """Decrypt Tier 3 content for authorized access."""
        return self.cipher.decrypt(encrypted.encode()).decode()
```

---

## Implementation Guide

### Phase 1: Foundation (Weeks 1-2)

**Milestone 1.1: Database & Models**

1. **Implement Core Models**
   - `app/database/models/user.py` (account owner)
   - `app/database/models/project.py` (links user, storyteller, subject)
   - `app/database/models/storyteller.py` (includes interaction_preferences)
   - `app/database/models/subject.py` (person the book is about)
   - `app/database/models/life_event.py`
   - `app/database/models/session.py`
   - `app/database/models/requirement.py`

2. **Create Alembic Migrations**
   ```bash
   alembic init app/alembic
   alembic revision --autogenerate -m "Initial schema"
   alembic upgrade head
   ```

3. **Seed Data**
   - Process version from process.txt
   - Sample storyteller for testing

**Milestone 1.2: FastAPI & Celery Setup**

1. **FastAPI Application**
   - `app/main.py` with basic health check
   - `app/api/router.py` with storyteller endpoints

2. **Celery Configuration**
   - `app/worker/celery_app.py`
   - Basic task: `run_analyst_flow`

3. **Docker Compose**
   - API + Worker + DB + Redis containers

**Test:** Create storyteller via API → Analyst workflow triggered → Progress updated

---

### Phase 2: Session Flow (Weeks 3-4)

**Milestone 2.1: VAPI Integration**

1. **VAPI Service**
   - `app/services/vapi_service.py`
   - Agent creation and call initiation

2. **Webhook Handlers**
   - `app/api/webhooks.py`
   - Transcript ingestion, call end report

3. **Session Workflow**
   - `app/workflows/session_workflow.py`
   - Nodes: SessionPrepNode, SubflowRouterNode, LaneDevelopmentNode

**Milestone 2.2: Story Point Extraction**

1. **LLM Service**
   - `app/services/llm_service.py`
   - Gemini structured output

2. **Extraction Node**
   - `app/core/nodes/session/story_point_extraction_node.py`

3. **Verification Workflow**
   - User verification email/web flow

**Test:** Complete end-to-end session → Transcript processed → Story points extracted → User verifies

---

### Phase 3: Analyst Flow (Weeks 5-6)

**Milestone 3.1: Gap Analysis**

1. **Analyst Workflow**
   - `app/workflows/analyst_workflow.py`
   - Nodes: PhaseAssessmentNode, GapAnalysisNode

2. **Requirements Service**
   - `app/services/requirements_service.py`
   - CRUD for requirements table

**Milestone 3.2: Archetype Assessment**

1. **Archetype Service**
   - `app/services/archetype_service.py`
   - Multi-archetype tracking logic

2. **Archetype-Aware Requirements**
   - `app/core/nodes/analyst/archetype_aware_requirements_node.py`
   - Discriminating/validating/strengthening logic

**Test:** Analyst analyzes storyteller → Lodges requirements → Next session focuses on gaps

---

### Phase 4: Editor Flow & Composition (Weeks 7-8)

**Milestone 4.1: Synthesis**

1. **Collection Service**
   - `app/services/collection_service.py`
   - Collection assembly from life events

2. **Provisional Draft Generation**
   - LLM-based prose generation from collections

**Milestone 4.2: Editor Flow**

1. **Editor Workflow**
   - `app/workflows/editor_workflow.py`
   - Quality assessment nodes

2. **Edit Requirements Table**
   - Similar to Requirements Table, for editorial feedback

**Test:** Composition generates chapter → Editor assesses → Edit requirements lodged → Revisions made

---

## Appendices

### A. Prompt Templates

**Location:** `app/prompts/`

**Example: Gap Analysis Prompt**
```python
# app/prompts/analyst/gap_analysis_prompt.py
GAP_ANALYSIS_PROMPT = """
You are analyzing a storyteller's captured material to identify gaps for a complete memoir.

**Storyteller Context:**
- Current Phase: {current_phase}
- Life Events Captured: {life_events}
- Session Artifacts: {session_artifacts}
- Archetype Analysis: {archetype_analysis}

**Your Task:**
Identify specific gaps in the following categories:
1. Missing scenes (pivotal moments not yet captured)
2. Underdeveloped characters (people mentioned but not fleshed out)
3. Missing emotions (events described factually but without emotional depth)
4. Thin themes (potential themes not yet explored)

For each gap, provide:
- Gap type
- Section where gap exists
- Description of what's missing
- Priority (critical, important, optional)
- 2-3 suggested conversational prompts to fill the gap

Output as structured JSON matching GapAnalysisOutput schema.
"""
```

---

### B. Key Configuration Files

**Alembic Configuration** (`app/alembic/env.py`)
```python
from sqlalchemy import engine_from_config, pool
from app.database.models import Base
from app.core.config import settings

target_metadata = Base.metadata

def run_migrations_online():
    configuration = config.get_section(config.config_ini_section)
    configuration["sqlalchemy.url"] = settings.DATABASE_URL
    # ... (standard Alembic setup)
```

---

### C. Testing Strategy

**Unit Tests:**
- Node implementations (mock TaskContext, assert outputs)
- Service methods (mock DB, assert business logic)

**Integration Tests:**
- Full workflow execution (in-memory DB, mock LLM)
- API endpoints (TestClient)

**End-to-End Tests:**
- Full session flow: API → Celery → VAPI → Webhook → DB
- Use staging VAPI account

---

## Summary

This system architecture provides a complete technical specification for implementing Everbound on the GenAI Launchpad framework, aligned with the **Analyst Subflow Execution Pattern**. Key strengths:

✅ **Real-Time Analyst Triggers:** Analyst Flow runs after EVERY `submit_requirement_result()` call
✅ **8 Self-Gating Subflows:** ALL subflows run on every trigger, each checking its own entry criteria
✅ **4-Phase Journey:** trust_building → history_building → story_capture → composition
✅ **Transcript Payloads:** Every requirement submission includes transcript segment context
✅ **Event-Driven:** Celery + Redis for async, scalable processing
✅ **Workflow-Based:** Clean separation of Analyst (orchestrator), Session (executor), Editor (validator)
✅ **VAPI Integration:** Voice-first capture via webhooks
✅ **Requirements-Driven:** Intelligent gap analysis with discriminating, validating, strengthening requirements
✅ **Production-Ready:** Docker deployment, security, monitoring

**Critical Pattern Summary:**
1. Session Flow captures story content and calls `submit_requirement_result()` with transcript segments
2. EVERY call triggers `run_analyst_flow.delay()` in real-time
3. Analyst runs ALL 8 subflows (no selective execution)
4. Each subflow self-gates based on entry criteria
5. Subflows that pass entry criteria execute their logic and update state

**8 Self-Gating Subflows:**
1. TrustBuildingSubflow - Introduction, scope, profile
2. ContextualGroundingSubflow - Timeline scaffolding
3. SectionSelectionSubflow - Narrative lanes
4. LaneDevelopmentSubflow - Story capture engine
5. ArchetypeAssessmentSubflow - Multi-archetype tracking
6. SynthesisSubflow - Provisional drafts
7. CompositionSubflow - Global continuous composition
8. EditorSubflow - Quality scoring, edit requirements

**Next Step:** Begin Phase 1 implementation (Foundation).

---

**Document Version:** 1.1
**Last Updated:** 2025-12-22
**Status:** Aligned with Analyst Subflow Execution Pattern
