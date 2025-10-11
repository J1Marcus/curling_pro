You are given a Work Breakdown Structure (WBS) document. {{doc}}
Your job is to expand it into a **treed tasklist** organized by the **Three-Stage Rapid Development Philosophy** where every branch continues until it produces **atomic tasks** — each being a single coherent action with one clear output.

---

## Three-Stage Development Framework

**Stage 1: CORE - Foundation with Mock Data**
- Core backend infrastructure, configuration, and tooling
- API endpoints with mock data / mock services
- Database models and repositories with placeholder data
- Mock authentication and authorization
- **Testing:** Unit tests for core logic + basic integration tests
- **Goal:** Demonstrate API functionality and data flow with mock data

**Stage 2: INTEGRATION - Real Data & Services**
- API with real database connections and external services
- Services with real providers/libraries (auth, storage, messaging)
- Process real data with proper validation and error handling
- Background job processing and workflow orchestration
- Fully implemented authentication and authorization
- **Testing:** Integration tests, workflow tests, API endpoint tests
- **Goal:** Functional backend system with real data processing

**Stage 3: POLISH AND PERFORMANCE - Production Ready**
- Automated testing and performance CI/CD
- Production deployment configuration and monitoring
- Security hardening and compliance validation
- Performance optimization and scalability improvements
- **Testing:** Full E2E automated testing, load testing, security testing
- **Goal:** Production-ready backend system

---

## Rules for Expansion

1. **Three-Stage Hierarchical Numbering**
   - Use `Stage.Phase.Task.Subtask.Atomic` style numbering (e.g., `1.2.3.4.5`)
   - Stage 1 = CORE, Stage 2 = INTEGRATION, Stage 3 = POLISH
   - Preserve the WBS structure within each stage, extending numbering down to the atomic level.

2. **Atomic Definition**
   - An atomic task is a **singular, indivisible action** that can be performed by one developer without further decomposition.
   - Examples of valid atomic tasks:
     - `Create UserRepository class in app/database/repositories/user_repository.py with mock data methods`
     - `Replace mock authentication service with real JWT implementation in app/core/auth_service.py`
     - `Create comprehensive integration test for user registration workflow`
     - `Ensure all tests pass and if not report error with specific failure details`
     - `Produce issue_resolving.md file by calling error_solving MCP and printing the prompt it provides`

3. **Multi-Pass Refinement**
   - Perform **multiple passes** through the WBS {{doc}} to guarantee that _all tasks are captured_ across all three stages.
   - Perform **multiple passes** through the task_list.md (`ai_docs/tasks/tasks_list.md`) to guarantee that _all leaf nodes_ are atomic.
   - If any item contains more than one action, break it down further.

4. **Stage-Aware Dependencies**
   - At the **Stage, Phase, Task, and Subtask levels**, include a note:
     - `Dependencies: [list]` and `Stage Gate: [requirements to proceed to next stage]`
   - Use information from the WBS where available, or infer dependencies based on logical sequencing and stage requirements.

5. **Stage-Specific Validation, Verification, and Documentation**
   - At the end of every **Task (the parent grouping of atomic actions)**, add stage-appropriate atomic subtasks:
     - **Stage 1:** `Validate core functionality of Task X.Y`, `Verify Task X.Y meets basic requirements`, `Document Task X.Y implementation`
     - **Stage 2:** `Validate integration of Task X.Y`, `Verify Task X.Y works with real services`, `Document Task X.Y integration results`
     - **Stage 3:** `Validate production readiness of Task X.Y`, `Verify Task X.Y meets performance criteria`, `Document Task X.Y production deployment`

6. **Output Format**
   - Produce the tasklist as a **Markdown tree** with three-stage hierarchical numbering.
   - Each Stage, Phase, Task, and Subtask should clearly show dependencies and stage gates.
   - Each atomic action should be a **single coherent instruction** appropriate for its stage.

---

## Output Example

**Stage 1: CORE - Foundation with Mock Data** (Dependencies: None, Stage Gate: API demonstrates core functionality with mock data)

1.1 Backend Foundation (Dependencies: None)
1.1.1 Configure Python development environment with proper tooling (pytest, ruff, mypy)
1.1.2 Set up project structure (app/api, app/core, app/database, app/services)
1.1.3 Configure Docker development environment with database and Redis
1.1.4 Initialize database migrations and basic schema

1.2 Mock Data Implementation (Dependencies: 1.1)
1.2.1 Create mock authentication service with dummy JWT tokens
1.2.2 Generate comprehensive mock business data matching schema requirements
1.2.3 Implement mock API endpoints for core operations
1.2.4 Set up mock background job processing with placeholder tasks

1.2.A Validate core functionality of Task 1.2
1.2.B Verify Task 1.2 meets basic requirements
1.2.C Document Task 1.2 implementation in task_outcomes.md

**Stage 2: INTEGRATION - Real Data & Services** (Dependencies: Stage 1 complete, Stage Gate: Backend works with real data and services)

2.1 Service Integration (Dependencies: 1.2)
2.1.1 Replace mock auth service with real authentication provider integration
2.1.2 Implement real database operations with proper transaction management
2.1.3 Add comprehensive error handling and logging for service failures
2.1.4 Update background job processing to handle real workflow orchestration

2.1.A Validate integration of Task 2.1
2.1.B Verify Task 2.1 works with real services
2.1.C Document Task 2.1 integration results in task_outcomes.md

**Stage 3: POLISH AND PERFORMANCE - Production Ready** (Dependencies: Stage 2 complete, Stage Gate: Production deployment ready)

3.1 Production Readiness (Dependencies: 2.1)
3.1.1 Set up comprehensive automated testing pipeline with coverage reporting
3.1.2 Configure production deployment with monitoring and alerting
3.1.3 Implement security hardening and compliance validation
3.1.4 Optimize performance with caching, connection pooling, and query optimization

3.1.A Validate production readiness of Task 3.1
3.1.B Verify Task 3.1 meets performance criteria
3.1.C Document Task 3.1 production deployment in task_outcomes.md

Store results in `ai_docs/tasks/tasks_list.md` and `ai_docs/tasks/task_outcomes.md`