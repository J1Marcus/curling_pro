# Update Workflow Documentation

READ the workflow documentation files from `ai_docs/workflows/`.
ANALYZE recent git commits to detect implemented features and workflow changes.
CHECK `ai_docs/tasks/` outcome files for completed implementations that impact workflows.
UPDATE the workflow documentation with evidence-based changes reflecting actual system capabilities.

Update workflows based on:

$ARGUMENTS

Identify if user specifies a commit count, time range, or specific task outcomes in the arguments.
Default: Analyze last 7 days of commits and all task outcome files if no specific scope specified.

## Process

1. **Read Current Workflow Documentation**
   - Use the Read tool to examine `ai_docs/workflows/feature_workflows.md`
   - Use the Read tool to examine `ai_docs/workflows/user_role_workflows.md`
   - Note existing workflow descriptions, integration points, and system capabilities

2. **Analyze Recent Development Activity**

   ```bash
   # If user specifies: "last 30 commits"
   git log --oneline -30

   # Default: last 7 days
   git log --since="7 days ago" --oneline

   # Show which files changed most (feature indicators)
   git log --since="7 days ago" --name-only --pretty=format: | \
     sort | uniq -c | sort -nr | head -15

   # Focus on workflow-relevant changes
   git log --since="7 days ago" --grep="feat\|implement\|add\|complete" --oneline
   ```

3. **Review Task Outcome Files**

   ```bash
   # Find all task outcome files
   find ai_docs/tasks -name "*outcome*.md" -type f

   # Check for recently modified task files
   find ai_docs/tasks -name "*.md" -mtime -7 -type f
   ```

4. **Map Implementation Evidence to Workflows**
   - Read task outcome files to identify completed features
   - Match commit messages to workflow components
   - Identify new capabilities not documented in workflows
   - Find workflow steps that are now fully implemented

5. **Interactive Workflow Validation**
   When implementation evidence exists, ask specific questions:
   - "I found commits implementing authentication flow. Should I update the Authentication Workflow with actual implementation details?"
   - "Task outcomes show job status tracking is complete. Should I mark this workflow as 'IMPLEMENTED' and add technical details?"
   - "New components were added for time tracking. Should I update the Time Tracking Workflow with the actual UI components?"

## Key Implementation Signals to Detect

### Completed Features

- Commits with "feat:", "implement", "complete", "add" + workflow keywords
- Task outcome files showing "✅ COMPLETED" status
- New component files matching workflow descriptions
- Test files validating workflow functionality

### Enhanced Capabilities

- New API endpoints → Update integration points
- New UI components → Update user interaction flows
- Database schema changes → Update data requirements
- Service worker updates → Update offline capabilities

### Technical Implementation Details

- Authentication mechanisms → Update auth workflow with actual JWT handling
- State management → Update workflows with Zustand store integration
- Offline functionality → Update sync workflows with IndexedDB details
- PWA features → Update workflows with service worker capabilities

## Update Format

```markdown
## 1. Authentication Workflow - IMPLEMENTED ✅

### Implementation Status
- **Status**: Fully Implemented (Phase 1, Tasks 6-8)
- **Components**: LoginForm, AuthStore, JWT handling
- **Last Updated**: 2025-01-19
- **Evidence**: Tasks 6-8 completed, commits a1b2c3, d4e5f6

### Technical Implementation Details

**Actual Components:**
- `src/components/auth/LoginForm.jsx` - Complete form with validation
- `src/stores/authStore.js` - Zustand store with session management
- JWT token storage using localStorage with 24-hour expiration

**Integration Points (Implemented):**
- Material-UI form components with custom theme
- Zustand state management for session persistence
- Error handling with toast notifications
- Mobile-first responsive design

### Workflow Diagram (Updated)
[Keep existing diagram but add implementation notes]

### Implementation Evidence
- **Commits**: 
  - a1b2c3: "feat: implement LoginForm component with validation"
  - d4e5f6: "feat: add JWT authentication with authStore"
- **Task Outcomes**: Task 6 ✅ COMPLETED, Task 8 ✅ COMPLETED
- **Test Coverage**: Unit tests for form validation, integration tests for auth flow
```

## Workflow Status Classifications

### Status Indicators
- **PLANNED** 📋 - Workflow designed but not implemented
- **IN PROGRESS** 🔄 - Partial implementation with evidence
- **IMPLEMENTED** ✅ - Fully implemented with test coverage
- **ENHANCED** ⚡ - Implemented with additional capabilities beyond original design

### Implementation Evidence Requirements
- **PLANNED**: Design documentation only
- **IN PROGRESS**: Some commits + partial task completion
- **IMPLEMENTED**: Complete task outcomes + working code + tests
- **ENHANCED**: Implemented + additional features discovered in commits

## Update Sections to Modify

### Feature Workflows (`feature_workflows.md`)

1. **Workflow Status Headers**
   - Add implementation status to each workflow section
   - Include evidence summary and last update date

2. **Technical Implementation Details**
   - Add actual component names and file paths
   - Include real API endpoints and data structures
   - Document actual integration patterns used

3. **Implementation Evidence**
   - Link to specific commits that implemented features
   - Reference completed task outcomes
   - Include test coverage information

### User Role Workflows (`user_role_workflows.md`)

1. **Role Implementation Status**
   - Mark which user roles are fully supported
   - Document actual UI components for each role

2. **Interaction Patterns**
   - Update with actual component interactions
   - Include real navigation patterns implemented

3. **Cross-Role Integration**
   - Document actual data sharing mechanisms
   - Include real notification systems implemented

## Critical Instructions

1. **EVIDENCE-BASED UPDATES**: Only update workflows with concrete evidence from commits or task outcomes
2. **PRESERVE DESIGN INTENT**: Keep original workflow design while adding implementation details
3. **STATUS ACCURACY**: Only mark workflows as "IMPLEMENTED" if there's clear evidence of completion
4. **TECHNICAL PRECISION**: Use actual component names, file paths, and API endpoints from the codebase
5. **MAINTAIN STRUCTURE**: Keep existing workflow organization while enhancing with implementation details
6. **CROSS-REFERENCE**: Link workflow updates to specific commits and task outcomes

## Implementation Discovery Patterns

### Component Evidence
```bash
# Find implemented components mentioned in workflows
find src/components -name "*.jsx" | grep -E "(auth|job|time|status)"

# Check for store implementations
find src/stores -name "*.js" | head -10

# Look for API integration files
find src -name "*api*" -o -name "*service*" | head -10
```

### Test Evidence
```bash
# Find test files that validate workflows
find tests -name "*.spec.js" | grep -E "(journey|workflow|e2e)"

# Check for component tests
find src -name "*.test.js" -o -name "*.spec.js" | head -10
```

## Where to Save Updates

**ALWAYS update existing workflow files**: 
- `ai_docs/workflows/feature_workflows.md`
- `ai_docs/workflows/user_role_workflows.md`

- NEVER create new versions or duplicate files
- Maintain change log within each workflow document
- Add implementation evidence sections to existing workflows

## Change Log Format

Add to each updated workflow:

```markdown
## Implementation History

### 2025-01-19 Update - Phase 1 Completion

**Evidence Source**: Tasks 1-25 completed, commits from last 30 days
**Key Implementation Changes**:

- Authentication Workflow: PLANNED → IMPLEMENTED ✅
  - Evidence: LoginForm component, authStore, JWT handling
  - Commits: a1b2c3 (LoginForm), d4e5f6 (authStore)
  - Tests: Unit tests for validation, integration tests for auth flow

- Job Management Workflow: PLANNED → IMPLEMENTED ✅
  - Evidence: JobCard, JobList, StatusButton components
  - Commits: e7f8g9 (JobCard), h1i2j3 (JobList)
  - Tests: Journey tests for job selection and status updates

**Technical Discoveries**:
- Zustand stores provide better state management than originally planned
- Material-UI integration exceeded design expectations
- PWA capabilities fully implemented with service worker
```

## Focus on Actual Implementation

Every workflow update must reference:

- **Specific component files**: `src/components/auth/LoginForm.jsx`
- **Actual store implementations**: `src/stores/authStore.js`
- **Real API patterns**: Zustand actions, localStorage integration
- **Concrete test evidence**: `tests/e2e/journeys/login-route-job-journey.spec.js`
- **Commit references**: Specific SHA hashes and commit messages

## Value as Living Documentation

This workflow update process serves as:

- **Implementation Tracker**: Evidence-based status of all workflows
- **Technical Reference**: Actual components and patterns used
- **Progress Documentation**: Clear record of what's been built
- **Integration Guide**: Real examples of how systems work together
- **Onboarding Resource**: Accurate documentation for new team members

Remember: Workflows should reflect the actual implemented system, not just the original design. Update with precision and evidence.