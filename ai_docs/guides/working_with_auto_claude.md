# Working with Auto-Claude

**A comprehensive guide to using Auto-Claude for automated software development**

## Table of Contents

- [Overview](#overview)
- [Getting Started](#getting-started)
- [Task Structure](#task-structure)
- [Creating Tasks](#creating-tasks)
- [Task Metadata & Configuration](#task-metadata--configuration)
- [Running Tasks](#running-tasks)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Overview

Auto-Claude is an automated development framework that uses Claude AI to execute complex software engineering tasks. It manages tasks through a kanban-style workflow with automated planning, coding, and quality assurance phases.

### Key Features

- **Automated Task Execution**: Claude autonomously completes development tasks
- **Kanban Workflow**: Visual task management through planning → spec → coding → QA → done
- **Phase-Based Execution**: Tasks progress through structured phases (spec, planning, coding, qa)
- **Model Selection**: Choose different Claude models (Opus, Sonnet, Haiku) per phase
- **Parallel Execution**: Run multiple subtasks concurrently when dependencies allow
- **Memory & Context**: Auto-Claude maintains session memory and codebase understanding

---

## Getting Started

### Prerequisites

1. **Auto-Claude installed** from https://github.com/AndyMik90/Auto-Claude.git
2. **API Keys configured** in `.env`:
   ```bash
   ANTHROPIC_API_KEY=your_key_here
   ```
3. **Project setup** with `.auto-claude/` directory

### Directory Structure

```
.auto-claude/
├── specs/
│   ├── 001-task-name/
│   │   ├── requirements.json          # Task description
│   │   ├── task_metadata.json         # Priority, complexity, model config
│   │   ├── implementation_plan.json   # Phases and subtasks
│   │   ├── spec.md                    # Detailed specification (optional)
│   │   ├── complexity_assessment.json # Risk analysis (optional)
│   │   └── memory/                    # Session insights (auto-generated)
│   ├── 002-another-task/
│   └── ...
├── .auto-claude-status               # Current execution state
└── file_evolution.json               # File change tracking
```

---

## Task Structure

Each task requires **3 core files** to appear in the kanban:

### 1. `requirements.json` (Required)

Simple task description and workflow type.

```json
{
  "task_description": "Clear description of what needs to be built",
  "workflow_type": "feature"
}
```

**Workflow Types:**
- `feature` - New functionality
- `bug` - Bug fixes
- `refactor` - Code restructuring
- `docs` - Documentation updates
- `test` - Test implementation

### 2. `task_metadata.json` (Required)

Task configuration and execution settings.

```json
{
  "sourceType": "manual",
  "category": "feature",
  "priority": "high",
  "complexity": "standard",
  "impact": "high",
  "model": "opus",
  "thinkingLevel": "high",
  "isAutoProfile": true,
  "phaseModels": {
    "spec": "opus",
    "planning": "opus",
    "coding": "sonnet",
    "qa": "sonnet"
  },
  "phaseThinking": {
    "spec": "ultrathink",
    "planning": "high",
    "coding": "medium",
    "qa": "low"
  },
  "estimatedStoryPoints": 8,
  "wbsReference": "2.1.1",
  "relatedDocs": [
    "ai_docs/context/project_docs/wbs.md",
    "ai_docs/context/source_docs/flow_architecture.md"
  ]
}
```

**Field Definitions:**

| Field | Values | Description |
|-------|--------|-------------|
| `sourceType` | `manual`, `auto` | How task was created |
| `category` | `feature`, `bug`, `refactor`, `docs`, `test` | Task category |
| `priority` | `low`, `medium`, `high`, `critical` | Task priority |
| `complexity` | `trivial`, `simple`, `standard`, `complex` | Implementation complexity |
| `impact` | `low`, `medium`, `high` | Business impact |
| `model` | `haiku`, `sonnet`, `opus` | Default Claude model |
| `thinkingLevel` | `low`, `medium`, `high`, `ultrathink` | Extended thinking depth |
| `isAutoProfile` | `true`, `false` | Auto-adjust model per phase |
| `phaseModels` | Object | Model per phase (spec/planning/coding/qa) |
| `phaseThinking` | Object | Thinking level per phase |
| `estimatedStoryPoints` | Number | Effort estimate (Fibonacci scale) |
| `wbsReference` | String | Reference to WBS section |
| `relatedDocs` | Array | Relevant documentation files |

### 3. `implementation_plan.json` (Required)

Structured breakdown of phases and subtasks.

```json
{
  "feature": "Feature Name",
  "description": "Detailed description of the feature",
  "created_at": "2025-12-21T00:00:00.000Z",
  "updated_at": "2025-12-21T00:00:00.000Z",
  "status": "pending",
  "workflow_type": "feature",
  "workflow_rationale": "Why this workflow approach",
  "phases": [
    {
      "id": "phase-1-setup",
      "name": "Setup Infrastructure",
      "type": "setup",
      "description": "Create base files and configuration",
      "depends_on": [],
      "parallel_safe": false,
      "status": "pending",
      "subtasks": [
        {
          "id": "subtask-1-1",
          "description": "Create directory structure",
          "service": "main",
          "files_to_create": ["app/new_feature/"],
          "files_to_modify": [],
          "patterns_from": ["app/existing_pattern/"],
          "status": "pending",
          "verification": {
            "type": "command",
            "command": "test -d app/new_feature && echo 'OK'",
            "expected": "OK"
          }
        }
      ]
    }
  ],
  "summary": {
    "total_phases": 5,
    "total_subtasks": 12,
    "services_involved": ["main"],
    "estimated_story_points": 8
  }
}
```

**Phase Structure:**

| Field | Description |
|-------|-------------|
| `id` | Unique phase identifier |
| `name` | Human-readable phase name |
| `type` | `setup`, `implementation`, `integration`, `testing` |
| `description` | What this phase accomplishes |
| `depends_on` | Array of phase IDs that must complete first |
| `parallel_safe` | `true` if can run concurrently with other phases |
| `status` | `pending`, `in_progress`, `completed` |
| `subtasks` | Array of granular tasks |

**Subtask Structure:**

| Field | Description |
|-------|-------------|
| `id` | Unique subtask identifier |
| `description` | Clear, actionable task description |
| `service` | Which service this affects (e.g., "main", "api") |
| `files_to_create` | Array of new file paths |
| `files_to_modify` | Array of existing file paths to edit |
| `patterns_from` | Reference files to follow patterns from |
| `status` | `pending`, `in_progress`, `completed` |
| `verification` | Optional verification command |

### Optional Files

#### `spec.md` (Recommended for Complex Tasks)

Comprehensive specification document with:
- Overview and scope
- Patterns to follow (with code examples)
- Files to modify/create/reference
- Requirements and acceptance criteria
- Edge cases
- Implementation notes (DO/DON'T)
- Development environment setup
- Success criteria

See [Task 001 spec.md](../../.auto-claude/specs/001-generate-sqlalchemy-models-from-schema-docs/spec.md) for an example.

#### `complexity_assessment.json` (Auto-Generated)

Risk and complexity analysis:
- Scope analysis (estimated files, services, cross-cutting concerns)
- Integration requirements (external services, dependencies)
- Infrastructure needs (docker, database, config changes)
- Knowledge assessment (existing patterns, research needed)
- Risk analysis (level, concerns, mitigation strategies)

---

## Creating Tasks

### Method 1: Manual Creation (UI)

1. Open Auto-Claude UI
2. Click "Create New Task" in planning lane
3. Fill in task details:
   - Task name
   - Description
   - Priority, complexity, impact
   - Model selection
4. Save - task appears in planning lane

**Limitation:** UI may not support all fields (like `relatedDocs`)

### Method 2: Programmatic Creation (Recommended)

Create task files directly in `.auto-claude/specs/` directory.

**Step-by-step:**

```bash
# 1. Create task directory (use sequential numbering)
mkdir -p .auto-claude/specs/008-your-feature-name

# 2. Create requirements.json
cat > .auto-claude/specs/008-your-feature-name/requirements.json << 'EOF'
{
  "task_description": "Your task description here",
  "workflow_type": "feature"
}
EOF

# 3. Create task_metadata.json
cat > .auto-claude/specs/008-your-feature-name/task_metadata.json << 'EOF'
{
  "sourceType": "manual",
  "category": "feature",
  "priority": "high",
  "complexity": "standard",
  "impact": "high",
  "model": "opus",
  "thinkingLevel": "high",
  "isAutoProfile": true,
  "phaseModels": {
    "spec": "opus",
    "planning": "opus",
    "coding": "sonnet",
    "qa": "sonnet"
  },
  "phaseThinking": {
    "spec": "ultrathink",
    "planning": "high",
    "coding": "medium",
    "qa": "low"
  },
  "estimatedStoryPoints": 8,
  "relatedDocs": [
    "ai_docs/context/project_docs/wbs.md"
  ]
}
EOF

# 4. Create implementation_plan.json
cat > .auto-claude/specs/008-your-feature-name/implementation_plan.json << 'EOF'
{
  "feature": "Your Feature Name",
  "description": "Detailed description",
  "created_at": "2025-12-21T00:00:00.000Z",
  "updated_at": "2025-12-21T00:00:00.000Z",
  "status": "pending",
  "phases": []
}
EOF
```

**Using Code (Python/Node):**

See [analyst_flow_tasks.md](../analyst_flow_tasks.md) for examples of programmatic task creation used in this project.

### Method 3: Template-Based Creation

Create a task template script:

```bash
#!/bin/bash
# create_task.sh

TASK_ID=$1
TASK_NAME=$2
DESCRIPTION=$3
COMPLEXITY=${4:-standard}
PRIORITY=${5:-medium}
STORY_POINTS=${6:-5}

TASK_DIR=".auto-claude/specs/${TASK_ID}-${TASK_NAME}"
mkdir -p "$TASK_DIR"

# Create requirements.json
cat > "$TASK_DIR/requirements.json" << EOF
{
  "task_description": "$DESCRIPTION",
  "workflow_type": "feature"
}
EOF

# Create task_metadata.json (with sensible defaults)
cat > "$TASK_DIR/task_metadata.json" << EOF
{
  "sourceType": "manual",
  "category": "feature",
  "priority": "$PRIORITY",
  "complexity": "$COMPLEXITY",
  "impact": "medium",
  "model": "sonnet",
  "thinkingLevel": "medium",
  "isAutoProfile": true,
  "phaseModels": {
    "spec": "opus",
    "planning": "sonnet",
    "coding": "sonnet",
    "qa": "sonnet"
  },
  "phaseThinking": {
    "spec": "high",
    "planning": "medium",
    "coding": "medium",
    "qa": "low"
  },
  "estimatedStoryPoints": $STORY_POINTS
}
EOF

# Create minimal implementation_plan.json
cat > "$TASK_DIR/implementation_plan.json" << EOF
{
  "feature": "$TASK_NAME",
  "description": "$DESCRIPTION",
  "created_at": "$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")",
  "updated_at": "$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")",
  "status": "pending",
  "phases": []
}
EOF

echo "✅ Task created: $TASK_DIR"
```

**Usage:**
```bash
chmod +x create_task.sh
./create_task.sh 008 user-authentication "Implement JWT auth" complex high 13
```

---

## Task Metadata & Configuration

### Model Selection Strategy

Choose models based on task complexity and cost considerations:

| Model | Speed | Cost | Best For |
|-------|-------|------|----------|
| **Haiku** | Fastest | Lowest | Simple tasks, repetitive operations, QA checks |
| **Sonnet** | Fast | Medium | Standard features, most coding tasks |
| **Opus** | Slower | Highest | Complex architecture, critical planning, novel problems |

**Recommended Configurations:**

**Simple Task (trivial/simple complexity):**
```json
{
  "model": "sonnet",
  "thinkingLevel": "low",
  "phaseModels": {
    "spec": "sonnet",
    "planning": "sonnet",
    "coding": "sonnet",
    "qa": "haiku"
  },
  "phaseThinking": {
    "spec": "medium",
    "planning": "low",
    "coding": "low",
    "qa": "low"
  }
}
```

**Standard Task (standard complexity):**
```json
{
  "model": "sonnet",
  "thinkingLevel": "medium",
  "phaseModels": {
    "spec": "opus",
    "planning": "sonnet",
    "coding": "sonnet",
    "qa": "sonnet"
  },
  "phaseThinking": {
    "spec": "high",
    "planning": "medium",
    "coding": "medium",
    "qa": "low"
  }
}
```

**Complex Task (complex complexity):**
```json
{
  "model": "opus",
  "thinkingLevel": "ultrathink",
  "phaseModels": {
    "spec": "opus",
    "planning": "opus",
    "coding": "opus",
    "qa": "sonnet"
  },
  "phaseThinking": {
    "spec": "ultrathink",
    "planning": "ultrathink",
    "coding": "high",
    "qa": "medium"
  }
}
```

### Thinking Levels

| Level | Description | Use When |
|-------|-------------|----------|
| `low` | Minimal extended thinking | Simple, well-defined tasks |
| `medium` | Moderate deliberation | Standard features with some complexity |
| `high` | Extensive thinking | Complex logic, architectural decisions |
| `ultrathink` | Maximum deliberation | Novel problems, critical planning, high-risk tasks |

**Cost vs. Quality Trade-off:**
- Higher thinking = better quality, more thorough analysis
- Higher thinking = slower execution, higher API costs
- Use `ultrathink` sparingly for critical phases only

### Priority Levels

| Priority | When to Use |
|----------|-------------|
| `low` | Nice-to-have improvements, non-urgent tasks |
| `medium` | Standard features, typical development work |
| `high` | Core functionality, blocking other work |
| `critical` | Production issues, security vulnerabilities |

### Complexity Levels

| Complexity | Characteristics | Examples |
|------------|-----------------|----------|
| `trivial` | < 2 hours, single file, no dependencies | Config changes, simple bug fixes |
| `simple` | 2-8 hours, few files, minimal logic | CRUD endpoints, basic components |
| `standard` | 1-3 days, multiple files, moderate complexity | Feature implementation, workflow nodes |
| `complex` | 3+ days, many files, novel solutions | Core architecture, LLM integration, complex algorithms |

---

## Running Tasks

### Starting a Task

1. **Via Auto-Claude CLI:**
   ```bash
   cd /path/to/project
   auto-claude run --spec 003-onboarding-subflow
   ```

2. **With Parallelism:**
   ```bash
   auto-claude run --spec 004-phase-assessment --parallel 2
   ```

3. **Via UI:**
   - Drag task from planning → spec lane
   - Auto-Claude begins spec phase

### Task Lifecycle

```
planning → spec → coding → qa → done
   ↓         ↓       ↓       ↓      ↓
pending → planning → building → review → completed
```

**Phases Explained:**

1. **Planning/Spec Phase:**
   - Auto-Claude analyzes requirements
   - Creates detailed specification
   - Identifies files to create/modify
   - Generates complexity assessment
   - Outputs: `spec.md`, `complexity_assessment.json`

2. **Coding Phase:**
   - Executes implementation plan
   - Progresses through phases sequentially (unless `parallel_safe: true`)
   - Updates subtask statuses
   - Creates/modifies files
   - Runs verification commands
   - Outputs: Code changes, `build-progress.txt`

3. **QA Phase:**
   - Reviews code quality
   - Runs tests (if specified)
   - Validates acceptance criteria
   - Checks for issues
   - Outputs: `review_state.json`, test results

4. **Done:**
   - Task completed successfully
   - All subtasks marked complete
   - Ready for human review/merge

### Monitoring Progress

1. **Check `.auto-claude-status`:**
   ```bash
   cat .auto-claude/.auto-claude-status
   ```
   Shows: active task, current phase, subtasks completed, session number

2. **View Task Logs:**
   ```bash
   cat .auto-claude/specs/003-onboarding-subflow/task_logs.json
   ```

3. **Review Build Progress:**
   ```bash
   cat .auto-claude/specs/003-onboarding-subflow/build-progress.txt
   ```

4. **Check Session Insights:**
   ```bash
   ls .auto-claude/specs/003-onboarding-subflow/memory/session_insights/
   cat .auto-claude/specs/003-onboarding-subflow/memory/session_insights/session_001.json
   ```

### Resuming Tasks

Auto-Claude automatically resumes from the last checkpoint:
- Session insights preserved
- Codebase map maintained
- Attempt history tracked

If task fails or is interrupted:
```bash
auto-claude run --spec 003-onboarding-subflow --resume
```

---

## Best Practices

### 1. Task Granularity

**✅ Good:**
- Task: "Implement onboarding workflow nodes"
- Scope: 5-15 files, 1-3 days of work
- Clear boundaries and dependencies

**❌ Bad:**
- Task: "Build entire Analyst Flow"
- Scope: Too broad, multiple weeks
- Should be split into 5 subtasks

**Rule of Thumb:**
- 1 task = 1 epic or feature area
- 5-20 story points per task
- 3-6 phases maximum
- 8-20 subtasks total

### 2. Dependency Management

**Define Clear Dependencies:**
```json
{
  "phases": [
    {
      "id": "phase-1-models",
      "depends_on": [],
      "parallel_safe": false
    },
    {
      "id": "phase-2-repositories",
      "depends_on": ["phase-1-models"],
      "parallel_safe": false
    },
    {
      "id": "phase-3-api",
      "depends_on": ["phase-2-repositories"],
      "parallel_safe": false
    }
  ]
}
```

**Enable Parallelism When Safe:**
```json
{
  "id": "phase-2-nodes",
  "depends_on": ["phase-1-setup"],
  "parallel_safe": true,  // These nodes can be built concurrently
  "subtasks": [
    { "id": "subtask-2-1", "description": "Create WelcomeNode" },
    { "id": "subtask-2-2", "description": "Create DemographicsNode" },
    { "id": "subtask-2-3", "description": "Create ConsentNode" }
  ]
}
```

### 3. Reference Documentation

**Always include `relatedDocs`:**
```json
{
  "relatedDocs": [
    "ai_docs/context/project_docs/wbs.md",
    "ai_docs/context/source_docs/flow_architecture.md",
    "ai_docs/context/source_docs/schema/storyteller_schema.md",
    "app/database/event.py"  // Pattern to follow
  ]
}
```

This helps Auto-Claude understand:
- Project context
- Existing patterns
- Requirements
- Data models

### 4. Verification Commands

Add verification to subtasks for quality assurance:

```json
{
  "subtask": {
    "description": "Create WelcomeNode",
    "files_to_create": ["app/workflows/nodes/welcome_node.py"],
    "verification": {
      "type": "command",
      "command": "python -c 'from workflows.nodes.welcome_node import WelcomeNode; print(\"OK\")'",
      "expected": "OK"
    }
  }
}
```

**Verification Types:**
- `command` - Shell command execution
- `unit_test` - pytest test execution
- `integration_test` - Integration test suite
- `e2e_test` - End-to-end test

### 5. Model Cost Optimization

**Start Conservative:**
```json
{
  "model": "sonnet",  // Default to mid-tier
  "phaseModels": {
    "spec": "opus",    // Invest in good planning
    "planning": "sonnet",
    "coding": "sonnet",
    "qa": "haiku"      // Simple checks don't need Opus
  }
}
```

**Upgrade for Complex Tasks:**
- Use Opus for novel problems, architecture decisions
- Use Sonnet for standard implementations
- Use Haiku for repetitive operations, simple tests

**Thinking Level Strategy:**
- Use `ultrathink` only for spec/planning of complex tasks
- Use `high` for critical implementation phases
- Use `medium` or `low` for straightforward work

### 6. Pattern References

Always reference existing code patterns:

```json
{
  "subtask": {
    "description": "Create PhaseAssessmentEngine service",
    "files_to_create": ["app/services/assessment/phase_assessment_engine.py"],
    "patterns_from": [
      "app/services/llm_service.py",  // LLM integration pattern
      "app/database/event.py"          // Database pattern
    ]
  }
}
```

This ensures:
- Consistent code style
- Following project conventions
- Reusing proven patterns

### 7. Incremental Complexity

Start simple, add complexity:

**Phase 1:** Core functionality
```json
{
  "id": "phase-1-core",
  "subtasks": [
    { "description": "Basic workflow execution" },
    { "description": "Simple node types" }
  ]
}
```

**Phase 2:** Add features
```json
{
  "id": "phase-2-features",
  "depends_on": ["phase-1-core"],
  "subtasks": [
    { "description": "Add validation" },
    { "description": "Add error handling" }
  ]
}
```

**Phase 3:** Integration
```json
{
  "id": "phase-3-integration",
  "depends_on": ["phase-2-features"],
  "subtasks": [
    { "description": "API endpoints" },
    { "description": "E2E tests" }
  ]
}
```

### 8. Clear Acceptance Criteria

Define success criteria in `spec.md`:

```markdown
## Success Criteria

The task is complete when:

1. [ ] All 5 workflow nodes are implemented
2. [ ] API endpoints return 200 OK
3. [ ] Workflow completes in <30s (per WBS requirement)
4. [ ] Unit test coverage >80%
5. [ ] E2E test passes without errors
6. [ ] No console errors during execution
```

### 9. WBS Integration

Link tasks to your Work Breakdown Structure:

```json
{
  "wbsReference": "2.1.2",
  "estimatedStoryPoints": 13,
  "notes": "Implements WBS section 2.1.2: Phase Assessment Subflow"
}
```

This provides:
- Traceability to project plan
- Story point alignment
- Sprint planning integration

### 10. Session Management

Auto-Claude creates session insights - review them:

```bash
# Check what Auto-Claude learned
cat .auto-claude/specs/003-onboarding-subflow/memory/session_insights/session_001.json
```

Sessions track:
- Codebase understanding
- Patterns discovered
- Decisions made
- Challenges encountered

Use this to:
- Improve future task definitions
- Understand Auto-Claude's approach
- Debug issues

---

## Troubleshooting

### Task Not Appearing in Kanban

**Check:**
1. Directory naming: `NNN-task-name` format
2. Required files present: `requirements.json`, `task_metadata.json`, `implementation_plan.json`
3. Valid JSON syntax: `python -m json.tool file.json`
4. Refresh Auto-Claude UI

**Fix:**
```bash
# Validate JSON
for file in .auto-claude/specs/003-*/*.json; do
  echo "Checking $file"
  python -m json.tool "$file" > /dev/null || echo "❌ Invalid JSON"
done
```

### Task Stuck in Phase

**Causes:**
- Verification command failing
- Infinite loop in subtask
- Resource exhaustion
- API rate limiting

**Fix:**
1. Check task logs: `task_logs.json`
2. Review current subtask status in `implementation_plan.json`
3. Kill and restart:
   ```bash
   auto-claude stop
   auto-claude run --spec 003-onboarding-subflow --resume
   ```

### High API Costs

**Optimize:**
1. Reduce thinking levels: `ultrathink` → `high` → `medium`
2. Use cheaper models: `opus` → `sonnet` → `haiku`
3. Simplify task scope: Break into smaller tasks
4. Add verification commands to catch errors early

**Monitor costs:**
```bash
# Check token usage in session insights
grep -r "token" .auto-claude/specs/*/memory/
```

### Poor Code Quality

**Causes:**
- Insufficient context (missing `relatedDocs`)
- Wrong model selection (Haiku for complex task)
- Low thinking level
- Vague task description

**Fix:**
1. Add pattern references: `patterns_from`
2. Include related documentation: `relatedDocs`
3. Upgrade model for complex phases
4. Increase thinking level for planning/spec
5. Write detailed `spec.md` with examples

### Verification Failures

**Debug:**
```bash
# Run verification command manually
cd app
python -c 'from workflows.nodes.welcome_node import WelcomeNode; print("OK")'
```

**Common Issues:**
- Import path incorrect
- Missing dependencies
- Syntax errors
- Environment not activated

### Task Keeps Restarting

**Causes:**
- Circular dependencies in phases
- `depends_on` references non-existent phase
- Subtask verification always failing

**Fix:**
1. Review phase dependencies - ensure DAG (no cycles)
2. Validate phase IDs match in `depends_on`
3. Check verification commands work manually

---

## Advanced Topics

### Custom Task Types

Define custom workflow types beyond `feature`:

```json
{
  "workflow_type": "migration",
  "category": "infrastructure",
  "notes": "Database migration task - requires extra caution"
}
```

### Multi-Service Tasks

For microservices architecture:

```json
{
  "summary": {
    "services_involved": ["api", "worker", "database"],
    "total_subtasks": 25
  },
  "phases": [
    {
      "id": "phase-1-api",
      "subtasks": [
        {
          "service": "api",
          "files_to_create": ["api/endpoints/new_endpoint.py"]
        }
      ]
    },
    {
      "id": "phase-2-worker",
      "subtasks": [
        {
          "service": "worker",
          "files_to_create": ["worker/tasks/new_task.py"]
        }
      ]
    }
  ]
}
```

### Task Templates

Create reusable task templates for common patterns:

**Template: API Endpoint**
```bash
# templates/api_endpoint_task.sh
ENDPOINT_NAME=$1
cat > ".auto-claude/specs/$TASK_ID-$ENDPOINT_NAME-endpoint/requirements.json" << EOF
{
  "task_description": "Implement $ENDPOINT_NAME API endpoint with CRUD operations",
  "workflow_type": "feature"
}
EOF
# ... rest of template
```

### Integration with CI/CD

Run Auto-Claude in CI pipeline:

```yaml
# .github/workflows/auto-claude.yml
name: Auto-Claude Development

on:
  workflow_dispatch:
    inputs:
      task_id:
        description: 'Task ID to execute'
        required: true

jobs:
  auto-claude:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run Auto-Claude
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          auto-claude run --spec ${{ github.event.inputs.task_id }}
      - name: Create PR
        uses: peter-evans/create-pull-request@v4
        with:
          title: "Auto-Claude: ${{ github.event.inputs.task_id }}"
          branch: "auto-claude/${{ github.event.inputs.task_id }}"
```

---

## Examples

See real examples in this project:

- **Simple Task:** [002-sample-task](../../.auto-claude/specs/002-sample-task/)
- **Complex Task:** [001-generate-sqlalchemy-models](../../.auto-claude/specs/001-generate-sqlalchemy-models-from-schema-docs/)
- **Standard Task:** [003-onboarding-subflow](../../.auto-claude/specs/003-onboarding-subflow/)
- **Programmatic Creation:** [analyst_flow_tasks.md](../analyst_flow_tasks.md)

---

## Resources

- **Auto-Claude GitHub:** https://github.com/AndyMik90/Auto-Claude.git
- **Project WBS:** [ai_docs/context/project_docs/wbs.md](../context/project_docs/wbs.md)
- **Flow Architecture:** [ai_docs/context/source_docs/flow_architecture.md](../context/source_docs/flow_architecture.md)
- **Anthropic API Docs:** https://docs.anthropic.com/

---

## Quick Reference

### Minimum Task Setup (3 files)

```bash
# Create task directory
mkdir -p .auto-claude/specs/NNN-task-name

# Create requirements.json
echo '{
  "task_description": "Task description",
  "workflow_type": "feature"
}' > .auto-claude/specs/NNN-task-name/requirements.json

# Create task_metadata.json
echo '{
  "sourceType": "manual",
  "category": "feature",
  "priority": "medium",
  "complexity": "standard",
  "impact": "medium",
  "model": "sonnet",
  "thinkingLevel": "medium",
  "isAutoProfile": true,
  "phaseModels": {
    "spec": "opus",
    "planning": "sonnet",
    "coding": "sonnet",
    "qa": "sonnet"
  },
  "phaseThinking": {
    "spec": "high",
    "planning": "medium",
    "coding": "medium",
    "qa": "low"
  }
}' > .auto-claude/specs/NNN-task-name/task_metadata.json

# Create implementation_plan.json
echo '{
  "feature": "Task Name",
  "description": "Task description",
  "created_at": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'",
  "updated_at": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'",
  "status": "pending",
  "phases": []
}' > .auto-claude/specs/NNN-task-name/implementation_plan.json
```

### Model/Thinking Quick Reference

| Task Type | Spec | Planning | Coding | QA | Thinking (Spec) | Thinking (Coding) |
|-----------|------|----------|--------|----|-----------------|--------------------|
| **Trivial** | Sonnet | Haiku | Haiku | Haiku | Low | Low |
| **Simple** | Sonnet | Sonnet | Sonnet | Haiku | Medium | Low |
| **Standard** | Opus | Sonnet | Sonnet | Sonnet | High | Medium |
| **Complex** | Opus | Opus | Opus | Sonnet | Ultrathink | High |

---

**Last Updated:** 2025-12-21
**Version:** 1.0
**Maintainer:** Everbound Development Team
