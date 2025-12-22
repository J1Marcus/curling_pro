# Everbound Implementation Plan
## Work Breakdown Structure & Sprint Planning

**Document Version**: 1.0
**Created**: 2025-12-21
**Project Timeline**: 12-18 weeks (MVP)
**Methodology**: Agile with 2-week sprints

---

## Executive Summary

This Work Breakdown Structure (WBS) provides a comprehensive implementation roadmap for the Everbound AI-powered memoir platform. The project is organized into three major phases across 6-9 sprints, prioritizing foundation, core flows, and refinement.

**Key Metrics**:
- Total estimated story points: ~280
- Sprint duration: 2 weeks
- Team velocity assumption: 30-40 story points per sprint
- Critical path: GenAI Launchpad → Database → Analyst Flow → Session Flow → VAPI Integration

---

## 1. Work Breakdown Structure

### Phase 1: Foundation & Infrastructure (Weeks 1-6, Sprints 1-3)

#### 1.1 Development Environment Setup
- **1.1.1** Docker Compose Infrastructure
  - PostgreSQL database container configuration
  - Redis container for Celery backend
  - FastAPI application container
  - Celery worker container configuration
  - Caddy reverse proxy setup
  - Health check endpoints
  - **Estimated Effort**: 5 story points

- **1.1.2** Local Development Tooling
  - Poetry dependency management setup
  - Pre-commit hooks (black, ruff, mypy)
  - pytest configuration and test structure
  - Environment variable management (.env templates)
  - Database migration tooling (Alembic)
  - **Estimated Effort**: 3 story points

- **1.1.3** CI/CD Pipeline Foundation
  - GitHub Actions workflow setup
  - Docker image build automation
  - Test automation on PR
  - Code quality checks (linting, type checking)
  - **Estimated Effort**: 5 story points

#### 1.2 GenAI Launchpad Framework Core
- **1.2.1** Workflow Engine Implementation
  - WorkflowSchema base class with validation
  - Workflow executor with state management
  - Node base classes (Node, AgentNode, ConcurrentNode, BaseRouter)
  - TaskContext state management
  - Event schema validation layer
  - **Estimated Effort**: 13 story points

- **1.2.2** Node Type Implementations
  - Sequential node execution
  - Concurrent node parallel execution
  - Router node conditional logic
  - Agent node with LLM integration hooks
  - Error handling and retry logic
  - **Estimated Effort**: 8 story points

- **1.2.3** Workflow Storage & Retrieval
  - Workflow definition persistence
  - Workflow execution history tracking
  - TaskContext serialization/deserialization
  - Workflow version management
  - **Estimated Effort**: 5 story points

#### 1.3 Database Schema & Models
- **1.3.1** Core Entity Models
  - Storyteller model with demographics
  - Collection model (life periods)
  - Story model with versions
  - LifeEvent model with temporal data
  - Session model with conversation state
  - **Estimated Effort**: 8 story points

- **1.3.2** Workflow & Requirements Tables
  - Process model for workflow execution state
  - Requirements table (two-tier: capture + edit)
  - ArchetypeCandidate for multi-archetype refinement
  - ArtifactStore for generated content
  - **Estimated Effort**: 5 story points

- **1.3.3** Alembic Migration System
  - Initial schema migration
  - Migration testing strategy
  - Seed data for development
  - Data validation constraints
  - **Estimated Effort**: 3 story points

#### 1.4 Core Services Layer
- **1.4.1** LLM Service (Gemini Integration)
  - Google Generative AI SDK integration
  - Structured output with Pydantic schemas
  - Prompt template management
  - Token usage tracking
  - Error handling and fallbacks
  - **Estimated Effort**: 8 story points

- **1.4.2** Repository Pattern Implementation
  - Base repository with CRUD operations
  - Storyteller repository
  - Session repository
  - Collection repository
  - Story repository with versioning
  - **Estimated Effort**: 5 story points

- **1.4.3** Event Bus (Celery + Redis)
  - Celery task registration
  - Task retry policies
  - Dead letter queue handling
  - Task monitoring and logging
  - **Estimated Effort**: 5 story points

**Phase 1 Total**: 73 story points

---

### Phase 2: Core Workflows (Weeks 7-12, Sprints 4-6)

#### 2.1 Analyst Flow Implementation
- **2.1.1** Onboarding Subflow
  - Welcome node with storyteller creation
  - Demographics capture validation
  - Consent and privacy acknowledgment
  - Collection scaffolding logic
  - **Estimated Effort**: 8 story points

- **2.1.2** Phase Assessment Subflow
  - Gap analysis node implementation
  - Coverage assessment logic
  - Priority recommendation engine
  - Requirements generation for capture
  - **Estimated Effort**: 13 story points

- **2.1.3** Session Planning Subflow
  - Session template creation
  - Question generation based on gaps
  - Session context preparation
  - Handoff to Session Flow orchestration
  - **Estimated Effort**: 8 story points

- **2.1.4** Post-Session Analysis Subflow
  - Session transcript processing
  - Life event extraction
  - Story candidate identification
  - Multi-archetype assessment
  - Requirements update logic
  - **Estimated Effort**: 13 story points

- **2.1.5** Composition Trigger Subflow
  - Composition readiness evaluation
  - Edit requirements generation
  - Story selection for composition
  - Handoff to Editor Flow
  - **Estimated Effort**: 5 story points

#### 2.2 Session Flow Implementation
- **2.2.1** VAPI Agent Configuration
  - Agent persona creation (warm, curious, trauma-informed)
  - Function call definitions for workflow communication
  - Voice selection and configuration
  - Conversation guardrails
  - **Estimated Effort**: 8 story points

- **2.2.2** Session Execution Engine
  - Session initialization with context injection
  - Real-time conversation state tracking
  - Function call handling (context_request, sufficient_detail)
  - Session completion detection
  - **Estimated Effort**: 13 story points

- **2.2.3** Multi-Modal Support
  - Outbound call orchestration
  - Inbound call handling
  - WebRTC session management
  - UI-based text conversation fallback
  - **Estimated Effort**: 8 story points

- **2.2.4** Transcript Processing
  - Real-time transcript capture
  - Speaker diarization
  - Emotion/tone annotation
  - Trauma indicator detection
  - **Estimated Effort**: 8 story points

#### 2.3 Editor Flow Implementation
- **2.3.1** Story Composition Engine
  - Template selection based on story type
  - Multi-event story weaving
  - Voice consistency enforcement
  - Composite character creation (trauma-safe)
  - **Estimated Effort**: 13 story points

- **2.3.2** Quality Gate System
  - Accuracy validation against source events
  - Style consistency checks
  - Trauma-informed content review
  - User voice preservation validation
  - **Estimated Effort**: 8 story points

- **2.3.3** Iterative Refinement
  - Edit requirements application
  - Multi-archetype narrowing (exploring → narrowing → resolved)
  - Story versioning and comparison
  - Approval workflow
  - **Estimated Effort**: 8 story points

#### 2.4 API Endpoints & Integration
- **2.4.1** Storyteller Management APIs
  - POST /storytellers (onboarding)
  - GET /storytellers/{id}
  - PATCH /storytellers/{id}
  - GET /storytellers/{id}/collections
  - **Estimated Effort**: 5 story points

- **2.4.2** Session Management APIs
  - POST /sessions (create session)
  - GET /sessions/{id}
  - POST /sessions/{id}/start (VAPI integration)
  - GET /sessions/{id}/transcript
  - **Estimated Effort**: 5 story points

- **2.4.3** Story & Collection APIs
  - GET /collections/{id}/stories
  - GET /stories/{id}
  - POST /stories/{id}/refine
  - GET /stories/{id}/versions
  - **Estimated Effort**: 5 story points

- **2.4.4** Workflow Trigger Endpoints
  - POST /workflows/analyst/start
  - POST /workflows/session/execute
  - POST /workflows/editor/compose
  - GET /workflows/{id}/status
  - **Estimated Effort**: 3 story points

**Phase 2 Total**: 131 story points

---

### Phase 3: Refinement & Production Readiness (Weeks 13-18, Sprints 7-9)

#### 3.1 VAPI Production Integration
- **3.1.1** Phone Number Provisioning
  - Twilio integration for inbound calls
  - Number assignment to storytellers
  - Call routing configuration
  - **Estimated Effort**: 5 story points

- **3.1.2** WebRTC Real-Time Communication
  - WebRTC signaling implementation
  - Client SDK integration guidance
  - Connection quality monitoring
  - **Estimated Effort**: 8 story points

- **3.1.3** Call Analytics & Monitoring
  - Call duration tracking
  - Audio quality metrics
  - Cost tracking per session
  - **Estimated Effort**: 3 story points

#### 3.2 Advanced Features
- **3.2.1** Global Composition Model
  - Living manuscript generation
  - Cross-story narrative threads
  - Thematic organization
  - Timeline-based chapter structuring
  - **Estimated Effort**: 13 story points

- **3.2.2** Trauma-Informed Safeguards
  - Boundary detection in conversations
  - Composite character system
  - Content warning generation
  - Crisis resource integration
  - **Estimated Effort**: 8 story points

- **3.2.3** User Feedback Loop
  - Story rating system
  - Refinement request workflow
  - Satisfaction tracking (target: 4.5/5+)
  - **Estimated Effort**: 5 story points

#### 3.3 Performance & Scalability
- **3.3.1** Database Optimization
  - Query performance tuning
  - Index optimization
  - Connection pooling configuration
  - **Estimated Effort**: 5 story points

- **3.3.2** Caching Strategy
  - Redis caching for LLM responses
  - Session state caching
  - Story version caching
  - **Estimated Effort**: 5 story points

- **3.3.3** Async Task Optimization
  - Celery worker autoscaling
  - Task priority queues
  - Background job monitoring
  - **Estimated Effort**: 5 story points

#### 3.4 Security & Compliance
- **3.4.1** Authentication & Authorization
  - JWT-based auth system
  - Role-based access control
  - API rate limiting
  - **Estimated Effort**: 8 story points

- **3.4.2** Data Privacy & HIPAA Considerations
  - Data encryption at rest
  - Secure transmission (TLS)
  - PII handling procedures
  - Data retention policies
  - **Estimated Effort**: 8 story points

- **3.4.3** Audit Logging
  - User action logging
  - Workflow execution auditing
  - Security event tracking
  - **Estimated Effort**: 3 story points

#### 3.5 Monitoring & Observability
- **3.5.1** Application Logging
  - Structured logging implementation
  - Log aggregation setup
  - Error tracking (Sentry integration)
  - **Estimated Effort**: 5 story points

- **3.5.2** Metrics & Dashboards
  - Prometheus metrics export
  - Grafana dashboard creation
  - SLA monitoring (80%+ session completion)
  - **Estimated Effort**: 5 story points

- **3.5.3** Alerting & Incident Response
  - Alert rule configuration
  - On-call rotation setup
  - Incident response playbooks
  - **Estimated Effort**: 3 story points

**Phase 3 Total**: 88 story points

---

## 2. User Stories with Acceptance Criteria

### Epic 1: Platform Foundation (Phase 1)

#### US-1.1: Development Environment Setup
**As a** developer
**I want** a fully configured local development environment
**So that** I can run and test the application locally

**Acceptance Criteria**:
- [ ] `docker-compose up` starts all services (API, Worker, DB, Redis, Caddy)
- [ ] Health check endpoints return 200 OK for all services
- [ ] Database migrations run automatically on startup
- [ ] Hot reload works for code changes
- [ ] Environment variables are documented in .env.example

**Priority**: P0 (Critical)
**Story Points**: 5
**Sprint**: Sprint 1

---

#### US-1.2: GenAI Launchpad Workflow Execution
**As a** backend developer
**I want** to define and execute workflows using the GenAI Launchpad framework
**So that** I can orchestrate complex multi-step AI processes

**Acceptance Criteria**:
- [ ] Can define a WorkflowSchema with multiple nodes
- [ ] Can execute workflow with TaskContext state management
- [ ] Sequential nodes execute in order
- [ ] Concurrent nodes execute in parallel
- [ ] Router nodes make conditional decisions
- [ ] Workflow execution history is persisted
- [ ] Failed workflows can be retried from last successful node

**Priority**: P0 (Critical)
**Story Points**: 21
**Sprint**: Sprint 1-2

---

#### US-1.3: Database Schema Implementation
**As a** backend developer
**I want** a complete database schema for Everbound entities
**So that** I can persist storyteller data, sessions, and stories

**Acceptance Criteria**:
- [ ] All tables created via Alembic migrations
- [ ] Foreign key constraints properly defined
- [ ] Indexes created for common query patterns
- [ ] Seed data script for development testing
- [ ] Repository classes provide CRUD operations
- [ ] Can rollback migrations without data loss

**Priority**: P0 (Critical)
**Story Points**: 16
**Sprint**: Sprint 2

---

#### US-1.4: LLM Service Integration
**As a** backend developer
**I want** a reusable service for Google Gemini interactions
**So that** I can generate structured outputs from prompts

**Acceptance Criteria**:
- [ ] Can send prompts to Gemini 3 Flash model
- [ ] Receives structured Pydantic model responses
- [ ] Handles API errors with retries
- [ ] Tracks token usage per request
- [ ] Supports temperature and top_p configuration
- [ ] Can use custom system instructions

**Priority**: P0 (Critical)
**Story Points**: 8
**Sprint**: Sprint 2

---

### Epic 2: Analyst Flow (Phase 2)

#### US-2.1: Storyteller Onboarding
**As a** new user
**I want** to complete onboarding and create my profile
**So that** I can start sharing my life stories

**Acceptance Criteria**:
- [ ] Can provide name, age, and basic demographics
- [ ] Consent form is presented and acknowledged
- [ ] Initial life period collections are scaffolded (childhood, adolescence, etc.)
- [ ] Storyteller record is created in database
- [ ] Welcome message confirms successful onboarding
- [ ] Process completes in <30 seconds

**Priority**: P0 (Critical)
**Story Points**: 8
**Sprint**: Sprint 4

---

#### US-2.2: Automated Phase Assessment
**As a** storyteller
**I want** the system to analyze my story coverage
**So that** it can recommend what to talk about next

**Acceptance Criteria**:
- [ ] System identifies gaps in life period coverage
- [ ] Generates priority recommendations (high/medium/low)
- [ ] Creates story capture requirements based on gaps
- [ ] Assessment considers existing life events and stories
- [ ] Results stored in requirements table
- [ ] Assessment completes in <60 seconds

**Priority**: P0 (Critical)
**Story Points**: 13
**Sprint**: Sprint 4

---

#### US-2.3: Session Planning
**As a** system
**I want** to automatically plan conversation sessions
**So that** I can guide storytellers through structured conversations

**Acceptance Criteria**:
- [ ] Session template created with target collection
- [ ] Opening questions generated based on requirements
- [ ] Session context includes relevant prior stories
- [ ] Session goal is clearly defined
- [ ] Session handed off to Session Flow for execution
- [ ] Planning completes in <45 seconds

**Priority**: P0 (Critical)
**Story Points**: 8
**Sprint**: Sprint 4

---

#### US-2.4: Post-Session Analysis
**As a** system
**I want** to extract life events and stories from session transcripts
**So that** I can build the storyteller's memoir content

**Acceptance Criteria**:
- [ ] Life events extracted with dates, locations, and people
- [ ] Story candidates identified from transcript
- [ ] Multi-archetype assessment performed (exploring/narrowing/resolved)
- [ ] Requirements table updated with new context
- [ ] Extracted data linked to correct collection
- [ ] Analysis completes in <90 seconds for 30-minute session

**Priority**: P0 (Critical)
**Story Points**: 13
**Sprint**: Sprint 5

---

#### US-2.5: Composition Triggering
**As a** system
**I want** to determine when a story is ready for composition
**So that** I can generate polished memoir content at the right time

**Acceptance Criteria**:
- [ ] Evaluates if sufficient detail exists for story
- [ ] Generates edit requirements for composition
- [ ] Selects source life events for story
- [ ] Triggers Editor Flow with necessary context
- [ ] Updates story status to "composing"
- [ ] Evaluation completes in <30 seconds

**Priority**: P1 (High)
**Story Points**: 5
**Sprint**: Sprint 5

---

### Epic 3: Session Flow (Phase 2)

#### US-3.1: VAPI Voice Agent Configuration
**As a** system administrator
**I want** to configure VAPI agents with appropriate personas
**So that** storytellers have natural, empathetic conversations

**Acceptance Criteria**:
- [ ] Agent created with warm, curious persona
- [ ] Voice configured (age-appropriate, clear pronunciation)
- [ ] Function calls defined for workflow communication
- [ ] Trauma-informed guardrails configured
- [ ] Test conversation completes successfully
- [ ] Agent responds within 1-2 seconds

**Priority**: P0 (Critical)
**Story Points**: 8
**Sprint**: Sprint 5

---

#### US-3.2: Voice Session Execution
**As a** storyteller
**I want** to have a phone or web-based conversation
**So that** I can share my stories in a natural way

**Acceptance Criteria**:
- [ ] Session starts with personalized greeting
- [ ] Conversation follows planned session goals
- [ ] Agent asks follow-up questions for detail
- [ ] Agent detects when sufficient detail is captured
- [ ] Session can be paused and resumed
- [ ] Transcript captured in real-time
- [ ] Session ends gracefully with summary

**Priority**: P0 (Critical)
**Story Points**: 13
**Sprint**: Sprint 5-6

---

#### US-3.3: Multi-Modal Session Support
**As a** storyteller
**I want** to choose how I engage (phone, web call, or text)
**So that** I can use the modality that's most comfortable

**Acceptance Criteria**:
- [ ] Can receive outbound phone call
- [ ] Can call inbound phone number
- [ ] Can join WebRTC session from browser
- [ ] Can fall back to text-based conversation
- [ ] All modalities produce equivalent transcripts
- [ ] Session state persists across modality switches

**Priority**: P1 (High)
**Story Points**: 8
**Sprint**: Sprint 6

---

### Epic 4: Editor Flow (Phase 2)

#### US-4.1: Story Composition
**As a** storyteller
**I want** my raw conversations turned into polished memoir stories
**So that** I can share my experiences in readable form

**Acceptance Criteria**:
- [ ] Story composed from multiple life events
- [ ] Maintains storyteller's authentic voice
- [ ] Uses appropriate narrative structure (chronological, thematic, etc.)
- [ ] Composite characters created when needed for privacy
- [ ] Story includes sensory details from transcript
- [ ] Composition completes in <120 seconds

**Priority**: P0 (Critical)
**Story Points**: 13
**Sprint**: Sprint 6

---

#### US-4.2: Quality Gate Validation
**As a** storyteller
**I want** composed stories to be accurate and well-written
**So that** I can trust the memoir represents my experiences

**Acceptance Criteria**:
- [ ] Factual accuracy validated against source events
- [ ] Style consistency checked
- [ ] Trauma-informed review performed
- [ ] Voice preservation validated
- [ ] Stories flagged for issues rejected for revision
- [ ] Validation completes in <30 seconds

**Priority**: P0 (Critical)
**Story Points**: 8
**Sprint**: Sprint 6

---

#### US-4.3: Iterative Story Refinement
**As a** storyteller
**I want** to refine stories through multiple versions
**So that** I can get the story exactly as I want it

**Acceptance Criteria**:
- [ ] Can request refinements with specific feedback
- [ ] Edit requirements applied to new version
- [ ] Multi-archetype narrowing progresses (exploring → narrowing → resolved)
- [ ] Can compare versions side-by-side
- [ ] Can approve final version
- [ ] Refinement completes in <90 seconds

**Priority**: P1 (High)
**Story Points**: 8
**Sprint**: Sprint 6

---

### Epic 5: Production Readiness (Phase 3)

#### US-5.1: Production VAPI Integration
**As a** storyteller
**I want** to receive calls at my personal phone number
**So that** I can participate in sessions without special apps

**Acceptance Criteria**:
- [ ] Phone numbers provisioned via Twilio
- [ ] Inbound calls route to correct VAPI agent
- [ ] WebRTC sessions work from browser
- [ ] Call quality metrics tracked
- [ ] Reconnection handling for dropped calls

**Priority**: P1 (High)
**Story Points**: 13
**Sprint**: Sprint 7

---

#### US-5.2: Global Composition (Living Manuscript)
**As a** storyteller
**I want** a cohesive manuscript generated from all my stories
**So that** I can see my memoir as a complete work

**Acceptance Criteria**:
- [ ] Stories organized into chapters by theme/timeline
- [ ] Narrative threads woven across stories
- [ ] Table of contents generated
- [ ] Consistent voice throughout manuscript
- [ ] Can export as PDF or EPUB
- [ ] Manuscript regenerates when new stories added

**Priority**: P1 (High)
**Story Points**: 13
**Sprint**: Sprint 7-8

---

#### US-5.3: Trauma-Informed Safeguards
**As a** storyteller
**I want** the system to handle sensitive topics carefully
**So that** I feel safe sharing difficult experiences

**Acceptance Criteria**:
- [ ] Agent detects boundary signals in conversation
- [ ] Composite character system protects identities
- [ ] Content warnings generated for sensitive stories
- [ ] Crisis resources provided when needed
- [ ] Storyteller can skip or pause sensitive topics
- [ ] All safeguards respect storyteller's agency

**Priority**: P0 (Critical)
**Story Points**: 8
**Sprint**: Sprint 8

---

#### US-5.4: Security & Authentication
**As a** platform owner
**I want** secure authentication and data protection
**So that** storyteller data remains private and safe

**Acceptance Criteria**:
- [ ] JWT-based authentication implemented
- [ ] API rate limiting configured
- [ ] Data encrypted at rest and in transit
- [ ] RBAC prevents unauthorized access
- [ ] Audit logs track all data access
- [ ] Security headers configured correctly

**Priority**: P0 (Critical)
**Story Points**: 19
**Sprint**: Sprint 8-9

---

#### US-5.5: Monitoring & Observability
**As a** DevOps engineer
**I want** comprehensive monitoring and alerting
**So that** I can maintain system reliability

**Acceptance Criteria**:
- [ ] Structured logging to centralized system
- [ ] Metrics exported to Prometheus
- [ ] Grafana dashboards for key SLAs
- [ ] Alerts configured for critical failures
- [ ] Error tracking via Sentry
- [ ] 80%+ session completion rate visible

**Priority**: P1 (High)
**Story Points**: 13
**Sprint**: Sprint 9

---

## 3. Sprint Plan

### Sprint 1 (Weeks 1-2): Environment & Framework Foundation

**Sprint Goal**: Establish development environment and GenAI Launchpad core

**Stories**:
- US-1.1: Development Environment Setup (5 pts)
- US-1.2: GenAI Launchpad Workflow Execution (12 pts of 21)

**Deliverables**:
- Docker Compose working locally
- CI/CD pipeline functional
- Workflow engine partially implemented

**Total Points**: 17
**Team Capacity**: 30-40 pts (underutilized to account for setup overhead)

---

### Sprint 2 (Weeks 3-4): Database & Services

**Sprint Goal**: Complete framework core and implement data layer

**Stories**:
- US-1.2: GenAI Launchpad Workflow Execution (remaining 9 pts)
- US-1.3: Database Schema Implementation (16 pts)
- US-1.4: LLM Service Integration (8 pts)

**Deliverables**:
- Full workflow execution capability
- Database schema deployed
- Gemini integration functional

**Total Points**: 33
**Team Capacity**: 30-40 pts

---

### Sprint 3 (Weeks 5-6): Framework Polish & Testing

**Sprint Goal**: Complete Phase 1 foundation with robust testing

**Stories**:
- Event bus implementation (Celery + Redis) (5 pts)
- Workflow storage & retrieval (5 pts)
- Integration test suite for framework (8 pts)
- Documentation for framework usage (3 pts)

**Deliverables**:
- Async task processing operational
- Workflow persistence working
- Framework fully tested

**Total Points**: 21
**Team Capacity**: 30-40 pts (buffer for tech debt)

---

### Sprint 4 (Weeks 7-8): Analyst Flow Core

**Sprint Goal**: Implement onboarding and session planning

**Stories**:
- US-2.1: Storyteller Onboarding (8 pts)
- US-2.2: Automated Phase Assessment (13 pts)
- US-2.3: Session Planning (8 pts)
- API endpoints for storyteller management (5 pts)

**Deliverables**:
- End-to-end onboarding working
- Session planning automated
- Phase assessment functional

**Total Points**: 34
**Team Capacity**: 30-40 pts

---

### Sprint 5 (Weeks 9-10): Session Flow & VAPI

**Sprint Goal**: Enable voice-based story capture

**Stories**:
- US-2.4: Post-Session Analysis (13 pts)
- US-3.1: VAPI Voice Agent Configuration (8 pts)
- US-3.2: Voice Session Execution (13 pts)

**Deliverables**:
- Full session execution capability
- VAPI agent configured
- Post-session analysis working

**Total Points**: 34
**Team Capacity**: 30-40 pts

---

### Sprint 6 (Weeks 11-12): Editor Flow

**Sprint Goal**: Transform conversations into polished stories

**Stories**:
- US-2.5: Composition Triggering (5 pts)
- US-3.3: Multi-Modal Session Support (8 pts)
- US-4.1: Story Composition (13 pts)
- US-4.2: Quality Gate Validation (8 pts)
- US-4.3: Iterative Story Refinement (8 pts)

**Deliverables**:
- Complete Analyst → Session → Editor flow
- Story composition working end-to-end
- Multi-modal sessions supported

**Total Points**: 42
**Team Capacity**: 30-40 pts (may need to defer US-4.3 to Sprint 7)

---

### Sprint 7 (Weeks 13-14): Production VAPI & Advanced Features

**Sprint Goal**: Production telephony and living manuscript

**Stories**:
- US-5.1: Production VAPI Integration (13 pts)
- US-5.2: Global Composition (Living Manuscript) (13 pts)
- Performance optimization (database, caching) (15 pts)

**Deliverables**:
- Phone number provisioning working
- Global manuscript generation
- Performance targets met

**Total Points**: 41
**Team Capacity**: 30-40 pts (stretch sprint)

---

### Sprint 8 (Weeks 15-16): Security & Safeguards

**Sprint Goal**: Production-grade security and trauma-informed features

**Stories**:
- US-5.3: Trauma-Informed Safeguards (8 pts)
- US-5.4: Security & Authentication (19 pts)
- User feedback system (5 pts)

**Deliverables**:
- Authentication and authorization complete
- Trauma safeguards operational
- Feedback loop functional

**Total Points**: 32
**Team Capacity**: 30-40 pts

---

### Sprint 9 (Weeks 17-18): Observability & MVP Launch

**Sprint Goal**: Production monitoring and MVP readiness

**Stories**:
- US-5.5: Monitoring & Observability (13 pts)
- Load testing and performance validation (8 pts)
- Production deployment automation (5 pts)
- MVP launch preparation (5 pts)

**Deliverables**:
- Monitoring dashboards operational
- Production deployment process documented
- MVP launched to pilot users

**Total Points**: 31
**Team Capacity**: 30-40 pts

---

## 4. Testing & Quality Assurance Strategy

### 4.1 Testing Pyramid

**Unit Tests** (70% of test coverage)
- All repository methods
- LLM service functions
- Workflow node logic
- Utility functions
- Target: 80%+ code coverage

**Integration Tests** (20% of test coverage)
- Workflow end-to-end execution
- Database migrations
- API endpoint responses
- Celery task execution
- VAPI mock integration

**End-to-End Tests** (10% of test coverage)
- Complete Analyst Flow (onboarding → session planning)
- Complete Session Flow (session execution → transcript)
- Complete Editor Flow (composition → refinement)
- Full user journey (onboarding → first story)

### 4.2 Testing Tools & Frameworks

- **pytest**: Primary testing framework
- **pytest-asyncio**: Async test support
- **Factory Boy**: Test data generation
- **Freezegun**: Time-based test control
- **VCR.py**: LLM API response recording/playback
- **pytest-cov**: Coverage reporting
- **Locust**: Load testing

### 4.3 Quality Gates

**Pre-Commit**:
- Black code formatting
- Ruff linting (no errors)
- MyPy type checking (strict mode)
- Tests pass locally

**PR Merge Requirements**:
- All CI checks pass
- Code coverage ≥ 80%
- At least 1 approval
- No unresolved comments
- Branch up-to-date with main

**Release Requirements**:
- All integration tests pass
- E2E tests pass in staging environment
- Performance benchmarks met
- Security scan clean (no high/critical vulnerabilities)
- Manual QA sign-off

### 4.4 Test Data Strategy

**Development**:
- Seed data script with 3 sample storytellers
- Pre-generated sessions with transcripts
- Sample life events and stories
- Anonymized real-world data for LLM prompts

**Staging**:
- Production-like data volume (1000+ storytellers)
- Realistic conversation transcripts
- Load testing with 100 concurrent users

**Production**:
- Anonymized telemetry for debugging
- Feature flags for gradual rollout
- Canary deployments (5% → 50% → 100%)

---

## 5. CI/CD Pipeline

### 5.1 Pipeline Stages

**Stage 1: Build** (2-3 minutes)
- Checkout code
- Setup Python 3.11 environment
- Install dependencies with Poetry
- Build Docker images
- Push images to registry (tagged with commit SHA)

**Stage 2: Test** (5-7 minutes)
- Run unit tests with coverage
- Run integration tests
- Run linting and type checks
- Upload coverage reports to Codecov

**Stage 3: Security** (3-5 minutes)
- Dependency vulnerability scan (Safety)
- Docker image scan (Trivy)
- SAST scan (Bandit)

**Stage 4: Deploy** (Conditional)
- **On merge to main**: Deploy to staging
- **On tag push**: Deploy to production
- Run smoke tests post-deployment
- Rollback on failure

### 5.2 Deployment Strategy

**Staging Environment**:
- Auto-deploy on merge to main
- Uses staging VAPI account
- Reduced resource allocation
- Data retention: 7 days

**Production Environment**:
- Manual approval required for deployment
- Blue-green deployment strategy
- Health check validation before traffic switch
- Automatic rollback on 5xx error rate > 1%
- Database migrations run pre-deployment with rollback plan

### 5.3 GitHub Actions Workflows

**Workflow 1: PR Validation** (.github/workflows/pr.yml)
```yaml
on: [pull_request]
jobs:
  - lint-and-type-check
  - unit-tests
  - integration-tests
  - security-scan
```

**Workflow 2: Main Branch** (.github/workflows/main.yml)
```yaml
on:
  push:
    branches: [main]
jobs:
  - build-and-push-images
  - deploy-to-staging
  - run-smoke-tests
```

**Workflow 3: Release** (.github/workflows/release.yml)
```yaml
on:
  push:
    tags: ['v*']
jobs:
  - create-release-notes
  - deploy-to-production
  - notify-stakeholders
```

---

## 6. Risk Assessment & Mitigation

### 6.1 Technical Risks

#### Risk T-1: GenAI Launchpad Framework Complexity
**Likelihood**: Medium
**Impact**: High
**Description**: Custom workflow framework may be over-engineered or difficult to debug

**Mitigation**:
- Invest heavily in Sprint 1-2 framework testing
- Create comprehensive documentation with examples
- Consider fallback to simpler state machine if complexity becomes blocker
- Pair programming for framework-critical features

**Contingency**: If framework proves unworkable by end of Sprint 3, pivot to Temporal.io or Prefect

---

#### Risk T-2: LLM Output Reliability
**Likelihood**: High
**Impact**: Medium
**Description**: Gemini structured outputs may not always match schema, leading to parsing failures

**Mitigation**:
- Implement robust retry logic with exponential backoff
- Use JSON schema validation before Pydantic parsing
- Build fallback prompts for common failure modes
- Monitor LLM success rate (target: 95%+ first-attempt success)

**Contingency**: Implement schema-constrained generation (Gemini's response_schema feature) to enforce structure

---

#### Risk T-3: VAPI Integration Challenges
**Likelihood**: Medium
**Impact**: High
**Description**: VAPI function calling or real-time conversation state management may have edge cases

**Mitigation**:
- Build comprehensive VAPI test harness in Sprint 5
- Use VCR.py to record/replay VAPI interactions
- Start with WebRTC (easier to debug) before phone calls
- Allocate Sprint 7 buffer for VAPI production issues

**Contingency**: Fallback to text-based conversations if VAPI proves unreliable; defer phone calls to post-MVP

---

#### Risk T-4: Database Performance at Scale
**Likelihood**: Low
**Impact**: Medium
**Description**: Complex queries on requirements table or story versioning may not scale

**Mitigation**:
- Design indexes upfront based on expected query patterns
- Load test with 10k+ storytellers in staging
- Implement query monitoring in production
- Use PostgreSQL EXPLAIN for optimization

**Contingency**: Introduce read replicas or caching layer if queries exceed 500ms

---

### 6.2 Schedule Risks

#### Risk S-1: Sprint Velocity Overestimation
**Likelihood**: Medium
**Impact**: Medium
**Description**: Team may not achieve 30-40 story points per sprint consistently

**Mitigation**:
- Track actual velocity in Sprint 1-2 and adjust planning
- Build 2-week buffer into 18-week timeline
- Prioritize P0 stories; defer P1/P2 to post-MVP if needed
- Daily standups to identify blockers early

**Contingency**: Extend timeline to 20 weeks or reduce scope (defer Global Composition to v1.1)

---

#### Risk S-2: External Dependency Delays
**Likelihood**: Low
**Impact**: Medium
**Description**: VAPI account setup, Twilio provisioning, or Google Cloud approvals may delay integration

**Mitigation**:
- Request VAPI and Twilio accounts in Week 1
- Use sandbox/test environments until production access granted
- Build mock integrations for development
- Parallel track production setup during Phase 1

**Contingency**: Launch MVP with WebRTC-only sessions if phone provisioning delayed

---

### 6.3 Product Risks

#### Risk P-1: User Acceptance of Voice Conversations
**Likelihood**: Low
**Impact**: High
**Description**: Target demographic (65+) may not be comfortable with AI voice conversations

**Mitigation**:
- Conduct user testing in Sprint 6-7 with pilot storytellers
- Provide onboarding tutorial for voice sessions
- Offer text-based fallback for all sessions
- Monitor session completion rate (target: 80%+)

**Contingency**: Pivot to text-first experience with optional voice if adoption < 50%

---

#### Risk P-2: Story Quality Below Expectations
**Likelihood**: Medium
**Impact**: High
**Description**: Composed stories may not feel authentic or may lose storyteller's voice

**Mitigation**:
- Build quality gate with multiple validation checks
- Implement feedback loop for refinement
- Target 4.5/5+ satisfaction rating
- A/B test different composition prompts

**Contingency**: Add human review step for MVP if quality consistently poor

---

#### Risk P-3: Trauma-Informed Safeguards Insufficient
**Likelihood**: Low
**Impact**: Critical
**Description**: System may mishandle sensitive topics, causing harm to storytellers

**Mitigation**:
- Consult with trauma-informed care experts during Sprint 8
- Implement multiple layers of safeguards (boundary detection, composite characters, content warnings)
- Pilot with clinical reviewers before public launch
- Provide crisis resources prominently

**Contingency**: Delay launch until clinical validation complete; add human moderators if needed

---

### 6.4 Resource Risks

#### Risk R-1: LLM API Costs Exceed Budget
**Likelihood**: Medium
**Impact**: Medium
**Description**: Token usage for Gemini calls may exceed $15 per memoir target

**Mitigation**:
- Track token usage per workflow in Sprint 2
- Optimize prompts for conciseness
- Implement caching for repeated queries
- Use Gemini Flash (cheaper) where possible

**Contingency**: Reduce number of refinement iterations or switch to cheaper model for non-critical tasks

---

#### Risk R-2: VAPI Costs Exceed Budget
**Likelihood**: Medium
**Impact**: Medium
**Description**: Voice conversation costs may be prohibitive at scale

**Mitigation**:
- Monitor per-session costs starting Sprint 5
- Optimize conversation length (target: 15-30 min sessions)
- Consider tiered pricing (text free, voice premium)
- Negotiate volume discounts with VAPI

**Contingency**: Limit voice sessions per storyteller or introduce paid tiers

---

## 7. Progress Tracking & Reporting

### 7.1 Metrics Dashboard

**Development Metrics**:
- Sprint velocity (actual vs. planned story points)
- Sprint burndown chart
- Code coverage percentage
- Open PR count and age
- CI/CD pipeline success rate

**Product Metrics** (post-Sprint 6):
- Session completion rate (target: 80%+)
- Average session duration
- Stories composed per storyteller
- User satisfaction rating (target: 4.5/5+)
- Cost per memoir (target: <$15)

**System Metrics** (post-Sprint 9):
- API response time (p50, p95, p99)
- Workflow execution success rate
- LLM API success rate (target: 95%+)
- Database query performance
- Error rate (target: <0.5%)

### 7.2 Reporting Cadence

**Daily**:
- Standup updates (Slack or 15-min sync)
- Blocker identification and resolution

**Weekly**:
- Sprint progress review (burndown chart)
- Metrics review (coverage, velocity)
- Risk register update

**Bi-Weekly**:
- Sprint retrospective
- Sprint planning for next iteration
- Demo to stakeholders

**Monthly**:
- Executive summary report
- Budget review (LLM/VAPI costs)
- Roadmap adjustment if needed

### 7.3 Success Criteria for MVP Launch

**Must-Have (P0)**:
- [ ] Full Analyst → Session → Editor flow functional
- [ ] Voice sessions working via VAPI (WebRTC minimum)
- [ ] Story composition meets 4.0/5+ satisfaction in pilot
- [ ] 80%+ session completion rate in pilot
- [ ] Security audit passed (auth, encryption, RBAC)
- [ ] Trauma-informed safeguards validated by clinical expert
- [ ] Production monitoring operational
- [ ] Cost per memoir <$20 (target: $15)

**Nice-to-Have (P1)**:
- [ ] Phone call support (inbound/outbound)
- [ ] Global composition (living manuscript)
- [ ] Advanced caching for cost optimization
- [ ] 95%+ LLM success rate

**Post-MVP (P2)**:
- [ ] Mobile app support
- [ ] Multi-language support
- [ ] Advanced analytics dashboard
- [ ] Tiered pricing model

---

## 8. Dependencies & Assumptions

### 8.1 External Dependencies

1. **VAPI Account**: Requires active account with API access by Sprint 5
2. **Google Cloud Project**: Gemini API access configured by Sprint 2
3. **Twilio Account**: Phone number provisioning by Sprint 7 (optional for MVP)
4. **Infrastructure**: AWS/GCP account for staging and production deployment
5. **Domain & SSL**: Domain registered and SSL certificates provisioned

### 8.2 Assumptions

1. **Team Composition**: 2-3 full-time developers with Python/FastAPI experience
2. **Velocity**: Team can sustainably deliver 30-40 story points per 2-week sprint
3. **Technical**: Gemini 3 Flash provides sufficient quality for story composition
4. **Product**: Target demographic (65+) has access to phone or web browser
5. **Budget**: $5k-10k allocated for LLM/VAPI costs during development/pilot
6. **Timeline**: No major holidays or team vacations during 18-week timeline
7. **Legal**: Privacy policy and terms of service reviewed by legal counsel before launch

### 8.3 Critical Path

```
Sprint 1-2: GenAI Launchpad Framework
    ↓
Sprint 2-3: Database Schema + LLM Service
    ↓
Sprint 4: Analyst Flow (Onboarding → Session Planning)
    ↓
Sprint 5: Session Flow (VAPI Integration)
    ↓
Sprint 6: Editor Flow (Story Composition)
    ↓
Sprint 7-8: Production Readiness (Security, VAPI Production)
    ↓
Sprint 9: Monitoring & MVP Launch
```

**Blockers on Critical Path**:
- GenAI Launchpad complexity could delay Sprint 2-3
- VAPI integration issues could delay Sprint 5-6
- Story quality issues could delay Sprint 6-7

---

## 9. Definition of Done

### For User Stories
- [ ] Acceptance criteria met and validated
- [ ] Unit tests written (80%+ coverage for new code)
- [ ] Integration tests written where applicable
- [ ] Code reviewed and approved
- [ ] Documentation updated (inline and README)
- [ ] Deployed to staging and smoke tested
- [ ] Product owner sign-off

### For Sprints
- [ ] All committed stories meet Definition of Done
- [ ] Sprint retrospective completed
- [ ] Demo delivered to stakeholders
- [ ] No P0 bugs open
- [ ] Code coverage maintained at 80%+
- [ ] CI/CD pipeline green

### For Phases
- [ ] All phase objectives met
- [ ] Integration testing across phase features
- [ ] Performance benchmarks met
- [ ] Documentation complete
- [ ] Stakeholder approval for next phase

### For MVP Launch
- [ ] All P0 success criteria met (see Section 7.3)
- [ ] Pilot user testing complete with 4.5/5+ satisfaction
- [ ] Security audit passed
- [ ] Production monitoring operational
- [ ] Incident response plan documented
- [ ] Legal/compliance sign-off complete

---

## 10. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-12-21 | Implementation Planning Consultant | Initial WBS creation |

---

## Appendix A: Story Point Estimation Guide

- **1 point**: Trivial change, <2 hours (e.g., config update)
- **2 points**: Simple feature, <4 hours (e.g., basic CRUD endpoint)
- **3 points**: Moderate feature, 4-8 hours (e.g., repository class)
- **5 points**: Complex feature, 1-2 days (e.g., workflow node implementation)
- **8 points**: Very complex, 2-3 days (e.g., LLM service integration)
- **13 points**: Epic-level, 4-5 days (e.g., complete subflow implementation)
- **21+ points**: Break down into smaller stories

---

## Appendix B: Technology Stack Reference

**Backend**:
- Python 3.11+
- FastAPI (web framework)
- Pydantic (data validation)
- SQLAlchemy (ORM)
- Alembic (migrations)

**Task Queue**:
- Celery (async task execution)
- Redis (message broker)

**Database**:
- PostgreSQL 14+

**AI/ML**:
- Google Generative AI (Gemini 3 Flash)
- VAPI (voice conversation platform)

**DevOps**:
- Docker + Docker Compose
- GitHub Actions (CI/CD)
- Caddy (reverse proxy)
- Prometheus + Grafana (monitoring)

**Testing**:
- pytest
- Factory Boy
- VCR.py
- Locust

---

**End of Work Breakdown Structure**
