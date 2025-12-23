---
description: Start Working on a Task (project)
argument-hint: [TASK-ID or "next"]
---

Begin work on a specific task from `.clarify/tasks.json`.

## Arguments

- `$ARGUMENTS` - Task ID (e.g., "TASK-001") or "next" for highest priority pending task

## Process

### Step 1: Load Task
Read `.clarify/tasks.json` and find the specified task.
- If "next" is specified, select the highest priority pending task

### Step 2: Update Status
Set task status to "in_progress":
```json
{
  "status": "in_progress"
}
```

### Step 3: Load Context
Read all reference files listed in the task's context.

### Step 4: Display Task Brief
Output:
```
## Starting: TASK-XXX - Task Name

Priority: critical | Status: in_progress

### Requirements:
1. Step 1
2. Step 2

### Constraints:
- Constraint 1
- Constraint 2

### Standing Constraints (Always Apply):
1. No overengineering - build for 85% of users
2. DRY - reuse existing code
3. Don't roll-your-own - use existing libraries
4. Verify no hallucinations post-implementation
5. No testing during development - just ensure it compiles

### Reference Files Loaded:
- path/to/file.py (XXX lines)

### Dependencies:
- ServiceName
- OtherTask

### Role in System:
Brief description of what this component does

---
Ready to implement. Proceed with first requirement.
```

### Step 5: Save Updated Tasks
Write the updated task status back to `.clarify/tasks.json`.

## Example Usage

```
/task-start TASK-001      # Start specific task
/task-start next          # Start highest priority pending task
/task-start               # Same as "next"
```

## Notes

- Only one task should be "in_progress" at a time
- If another task is already in_progress, prompt to complete or pause it first
- Reference files are automatically loaded into context
