---
description: Mark Task as Completed (project)
argument-hint: [TASK-ID]
---

Mark a task as completed in `.clarify/tasks.json` and add implementation notes.

## Arguments

- `$ARGUMENTS` - Task ID (e.g., "TASK-001") or task name pattern

## Process

### Step 1: Load Current Tasks
Read `.clarify/tasks.json` and find the specified task.

### Step 2: Verify Implementation
Before marking complete, verify:
- Code imports without errors
- No hallucinated endpoints, function names, or API fields
- Implementation matches the task requirements

### Step 3: Update Task Status
Update the task object:
```json
{
  "status": "completed",
  "implementation_notes": "<summary of what was implemented and any deviations from plan>"
}
```

### Step 4: Save Updated Tasks
Write the updated tasks back to `.clarify/tasks.json`.

### Step 5: Report
Output:
- Task ID and name
- What was verified
- Any notes or warnings

## Example Usage

```
/task-complete TASK-001
/task-complete "Trust Building"
```

## Verification Checklist

Before marking complete, ensure:
- [ ] All requirements in the task are addressed
- [ ] Code compiles/imports without errors
- [ ] No placeholder or TODO comments left in new code
- [ ] Follows existing patterns in the codebase
- [ ] Uses existing services/libraries (no roll-your-own)
