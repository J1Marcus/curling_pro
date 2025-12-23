---
description: Generate and Update Task List from project docs
---

Generate or update a comprehensive task list by analyzing project documentation and codebase.

## Behavior

**If `.clarify/tasks.json` exists:**
1. Load existing tasks and preserve their status/implementation_notes
2. Scan for NEW tasks from documentation
3. Add only tasks that don't already exist (match by name similarity)
4. Update task priorities if dependencies have changed
5. Report: "X existing tasks preserved, Y new tasks added"

**If `.clarify/tasks.json` does NOT exist:**
1. Generate full task list from documentation
2. Create new `.clarify/tasks.json`
3. Report: "Created X tasks"

**Force regeneration:** Use `/tasks --regenerate` to rebuild from scratch (warns before overwriting)

## Process

### Step 1: Check for Existing Tasks
```python
if exists('.clarify/tasks.json'):
    existing_tasks = load_json('.clarify/tasks.json')
    preserve_completed = [t for t in existing_tasks if t['status'] != 'pending']
else:
    existing_tasks = None
```

### Step 2: Review Project Documentation
Scan for work breakdown structure (WBS) files and project documentation:
- Check for `**/*wbs*` files first
- If no WBS found, scan `ai_docs/context/project_docs/` for:
  - `high_level_plan.md` (primary task source)
  - `prd.md` (requirements)
  - `system_architecture.md` (technical specs)
  - Any other planning/requirements documents

### Step 2: Search for TODO Comments
Search the codebase for incomplete work markers:
```
grep -rn "TODO\|FIXME\|XXX\|HACK" --include="*.py" --include="*.ts" --include="*.js" app/
```

### Step 3: Analyze Implementation Gaps
Compare documented requirements against existing code:
- Glob for existing files in `app/workflows/`, `app/services/`, `app/api/`
- Identify what's documented but not implemented
- Identify what's partially implemented

### Step 4: Organize Tasks by Order of Operation
Prioritize tasks based on dependencies:
1. **CRITICAL**: Foundation tasks that other tasks depend on
2. **HIGH**: Core functionality needed for MVP
3. **MEDIUM**: Important but not blocking
4. **LOW**: Nice-to-have, post-MVP features

### Step 5: Generate .clarify/tasks.json
Create or update `.clarify/tasks.json` with task objects containing:

```json
{
  "version": "1.0",
  "generated_at": "<current_date>",
  "standing_constraints": [
    "Do not overengineer. Handle rare edge cases as they come up, not during development. Develop for speed and for needs of 85% of users.",
    "DRY - Do Not Repeat Yourself. Reuse existing code, patterns, and abstractions.",
    "Do Not Roll-Your-Own. Leverage existing services, APIs, functions, libraries. If excellent libraries exist but are not implemented, use the library over custom code.",
    "Post task execution: verify no hallucinated endpoints, function names, props, API fields, or value structures.",
    "Tasks must update this JSON on completion.",
    "No unit testing, integration testing, or E2E testing during development. Ensure code imports and compiles."
  ],
  "tasks": [
    {
      "id": "TASK-XXX",
      "name": "Task name",
      "status": "pending|in_progress|completed",
      "priority": "critical|high|medium|low",
      "requirements": [
        "Step 1",
        "Step 2"
      ],
      "constraints": [
        "Specific constraint for this task"
      ],
      "context": {
        "reference_files": ["path/to/file.py"],
        "dependencies": ["ServiceName", "OtherTask"],
        "role_in_system": "Brief description of what this component does"
      },
      "implementation_notes": ""
    }
  ]
}
```

## Standing Constraints (Apply to ALL Tasks)

1. **No Overengineering**: Handle rare edge cases as they come up, not during development. Build for speed and 85% of users.

2. **DRY (Don't Repeat Yourself)**: Reuse existing code, patterns, and abstractions.

3. **Don't Roll-Your-Own**: Leverage existing services, APIs, functions, libraries. If excellent libraries exist but aren't implemented, use the library over custom code.

4. **Verify After Implementation**: Post task execution, verify no hallucinated endpoints, function names, props, API fields, or value structures exist.

5. **Update Task Status**: Tasks are required to update the JSON on completion.

6. **No Testing During Development**: No unit testing, integration testing, or E2E testing during development. Ensure code imports and compiles.

## Output Location

Tasks are written to: `.clarify/tasks.json`

## Usage

Run this command to:
- Generate initial task list for a new project
- Update task list when documentation changes
- Re-prioritize tasks based on current progress
- Add new tasks discovered during development

## Example Invocation

```
/tasks
```

Or with arguments to filter:
```
/tasks --priority=critical
/tasks --status=pending
/tasks --update  # Only add new tasks, don't regenerate
```
