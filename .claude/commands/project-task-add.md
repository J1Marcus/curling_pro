---
description: Add a New Task to Project (project)
argument-hint: [task description]
---

Add a new task to `.clarify/tasks.json` with conflict detection and proper categorization.

## Arguments

- `$ARGUMENTS` - Optional task description. If not provided, prompt the user for details.

## Process

### Step 1: Gather Task Information

**If `$ARGUMENTS` is empty or not provided:**
Use the AskUserQuestion tool to ask:
```
What task would you like to add? Please describe:
- What needs to be done
- Any specific requirements or constraints
- Expected priority (critical/high/medium/low)
```

**If `$ARGUMENTS` is provided:**
Use the provided text as the initial task description. Ask clarifying questions if the description is ambiguous or incomplete:
- If priority is unclear, ask
- If requirements are vague, ask for specifics
- If dependencies are mentioned but not clear, clarify

### Step 2: Load Existing Tasks

Read `.clarify/tasks.json` and analyze:
1. Get list of all existing task names and descriptions
2. Note the current task ID sequence (highest TASK-XXX number)
3. Identify tasks with similar scope or overlapping requirements

### Step 3: Conflict Detection

Check for conflicts with existing tasks:

**Types of conflicts:**
1. **Duplicate** - Task with nearly identical name/requirements exists
2. **Overlap** - Task covers similar functionality with different scope
3. **Dependency conflict** - New task depends on something that contradicts existing task
4. **Supersedes** - New task would replace or make another task obsolete

**For each conflict found, categorize as:**
- `duplicate` - Exact or near-exact match
- `overlap` - Partial overlap in scope
- `supersedes` - New task makes old task obsolete

### Step 4: Handle Conflicts

**If conflicts are detected:**
Use AskUserQuestion to present the conflicts and ask:

```
Potential conflicts detected:

1. [TASK-XXX] "Task Name" - [conflict_type]
   - Existing: [brief description of existing task]
   - Conflict: [explanation of how it conflicts]

How would you like to proceed?

Options:
- Archive conflicting tasks (mark as "archived" status)
- Cancel (stop adding this task)
- Continue anyway (add task despite conflicts)
```

**Based on user response:**
- **Archive**: Set conflicting tasks' status to "archived" and add `archived_reason` to their metadata
- **Cancel**: Stop the process, do not add the task
- **Continue**: Proceed to add the task without modifying existing tasks

### Step 5: Determine Task Placement

Analyze the new task to determine:

1. **Priority Level** - Based on:
   - User-specified priority
   - Dependencies on other tasks
   - Whether other tasks depend on this capability
   - Criticality to system function

2. **Task ID** - Generate next sequential ID (TASK-XXX)

3. **Dependencies** - Identify which existing tasks must complete first

4. **Reference Files** - Scan codebase to identify relevant files:
   - Search for files matching task keywords
   - Include files referenced by similar existing tasks
   - Check for existing implementations to extend

### Step 6: Construct Task Object

Build the task object following the schema:

```json
{
  "id": "TASK-XXX",
  "name": "Concise task name",
  "status": "pending",
  "priority": "critical|high|medium|low",
  "requirements": [
    "Specific requirement 1",
    "Specific requirement 2"
  ],
  "constraints": [
    "Task-specific constraint"
  ],
  "context": {
    "reference_files": ["path/to/file.py"],
    "dependencies": ["TASK-YYY", "ServiceName"],
    "role_in_system": "Brief description of component's purpose"
  },
  "implementation_notes": ""
}
```

### Step 7: Validate Task

Before adding, verify:
1. All reference_files exist in the codebase
2. All task dependencies (TASK-XXX format) exist in tasks.json
3. No circular dependencies would be created
4. Task name is unique
5. Requirements are actionable and specific

**If validation fails:**
Report the issue and ask user how to proceed (fix or cancel).

### Step 8: Add Task to tasks.json

1. Insert task in appropriate position (sorted by priority, then ID)
2. Write updated tasks.json

### Step 9: Confirm Addition

Output summary:
```
## Task Added Successfully

**TASK-XXX**: Task Name
**Priority**: high
**Status**: pending

### Requirements:
1. Requirement 1
2. Requirement 2

### Dependencies:
- TASK-YYY (must complete first)

### Reference Files:
- path/to/file.py

---
Task added to `.clarify/tasks.json`

To start working on this task, run:
/project-task-start TASK-XXX
```

## Example Usage

```
/project-task-add Add rate limiting to API endpoints

/project-task-add
> (prompts for task details)

/project-task-add Refactor authentication to use JWT tokens with refresh capability
```

## Conflict Resolution Examples

**Duplicate detected:**
```
Conflict: TASK-005 "Add JWT Authentication" appears to be a duplicate.
- Your task: "Implement JWT token auth"
- Existing: "Add JWT Authentication" (status: pending)

These tasks appear to cover the same functionality.
```

**Supersedes detected:**
```
Conflict: TASK-003 "Basic session auth" would be superseded.
- Your task: "Replace session auth with JWT"
- Existing: "Basic session auth" (status: pending)

Your new task would make TASK-003 obsolete.
```

## Notes

- Task IDs are auto-generated and sequential
- Priority is validated against allowed values: critical, high, medium, low
- Status is always set to "pending" for new tasks
- Archived tasks remain in the file but are excluded from active task lists
- Reference files are validated to exist before task is added
