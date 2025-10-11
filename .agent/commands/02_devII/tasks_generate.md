You are given a Work Breakdown Structure (WBS) document. {{doc}}
Your job is to expand it into a **treed tasklist** organized by the **Three-Stage Rapid Development Philosophy** where every branch continues until it produces **atomic tasks** — each being a single coherent action with one clear output.

---

## Three-Stage Development Framework

**Stage 1: CORE - Foundation with Mock Data**
- Core project tech stack, state management, etc.
- API with mock data / mock services
- UI/UX and business logic with dummy/placeholder data tied into main render
- Mock auth
- **Testing:** Builds and ESLint ONLY + User Journey via Playwright
- **Goal:** Demonstrate UI/workflow against source docs (especially workflow docs)

**Stage 2: INTEGRATION - Real Data & Services**
- API with backend data/services
- Services with real providers/libraries
- Render real data
- Error logging
- Fully implemented auth
- **Testing:** Integration Tests. Unit Tests (As needed to troubleshoot integration or the like - sparse)
- **Goal:** Usable App/project/feature

**Stage 3: POLISH AND PERFORMANCE - Production Ready**
- Automated Testing and performance CI/CD
- Finalize Deployment Pathways
- Other typical production readiness tasks
- **Testing:** Full E2E automated
- **Goal:** Ready to deploy and put into production

---

## Rules for Expansion

1. **Three-Stage Hierarchical Numbering**
   - Use `Stage.Phase.Task.Subtask.Atomic` style numbering (e.g., `1.2.3.4.5`)
   - Stage 1 = CORE, Stage 2 = INTEGRATION, Stage 3 = POLISH
   - Preserve the WBS structure within each stage, extending numbering down to the atomic level.

2. **Atomic Definition**
   - An atomic task is a **singular, indivisible action** that can be performed by one developer without further decomposition.
   - Examples of valid atomic tasks:
     - `Create X component in a new file New_Component.JSX with mock data`
     - `Replace mock service calls with real API integration in awesome_service.py`
     - `Create comprehensive E2E test for user journey`
     - `Ensure project builds and if not report error`
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
     - **Stage 1:** `Validate UI/workflow of Task X.Y`, `Verify Task X.Y meets design specs`, `Document Task X.Y results`
     - **Stage 2:** `Validate integration of Task X.Y`, `Verify Task X.Y works with real data`, `Document Task X.Y integration results`
     - **Stage 3:** `Validate production readiness of Task X.Y`, `Verify Task X.Y meets performance criteria`, `Document Task X.Y production results`

6. **Output Format**
   - Produce the tasklist as a **Markdown tree** with three-stage hierarchical numbering.
   - Each Stage, Phase, Task, and Subtask should clearly show dependencies and stage gates.
   - Each atomic action should be a **single coherent instruction** appropriate for its stage.

---

## Output Example

**Stage 1: CORE - Foundation with Mock Data** (Dependencies: None, Stage Gate: UI demonstrates workflows with mock data)

1.1 Project Foundation (Dependencies: None)
1.1.1 Create React project with Vite and TypeScript setup
1.1.2 Configure ESLint and Prettier for code quality
1.1.3 Set up basic folder structure (src/components, src/stores, src/services)
1.1.4 Initialize Git repository and commit initial setup

1.1.A Validate UI/workflow of Task 1.1
1.1.B Verify Task 1.1 meets design specs
1.1.C Document Task 1.1 results in task_outcomes.md

1.2 Mock Data Implementation (Dependencies: 1.1)
1.2.1 Create mock authentication service with dummy tokens
1.2.2 Generate comprehensive mock job data matching FileMaker schema
1.2.3 Implement mock API endpoints for job operations
1.2.4 Set up Zustand stores with mock data integration

1.2.A Validate UI/workflow of Task 1.2
1.2.B Verify Task 1.2 meets design specs
1.2.C Document Task 1.2 results in task_outcomes.md

**Stage 2: INTEGRATION - Real Data & Services** (Dependencies: Stage 1 complete, Stage Gate: App works with real backend data)

2.1 Backend Integration (Dependencies: 1.2)
2.1.1 Replace mock auth service with FileMaker Data API authentication
2.1.2 Implement real API calls for job data retrieval
2.1.3 Add error logging and retry logic for API failures
2.1.4 Update stores to handle real data and error states

2.1.A Validate integration of Task 2.1
2.1.B Verify Task 2.1 works with real data
2.1.C Document Task 2.1 integration results in task_outcomes.md

**Stage 3: POLISH AND PERFORMANCE - Production Ready** (Dependencies: Stage 2 complete, Stage Gate: Production deployment ready)

3.1 Production Readiness (Dependencies: 2.1)
3.1.1 Set up comprehensive E2E test suite with Playwright
3.1.2 Configure CI/CD pipeline for automated testing and deployment
3.1.3 Implement performance monitoring and error tracking
3.1.4 Finalize Vercel deployment configuration

3.1.A Validate production readiness of Task 3.1
3.1.B Verify Task 3.1 meets performance criteria
3.1.C Document Task 3.1 production results in task_outcomes.md

Store results in `ai_docs/tasks/tasks_list.md` and `ai_docs/tasks/task_outcomes.md`
