# /task-start - Start Working on a Task

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
6. No silent failures - log or surface errors to users
7. No incomplete work markers - resolve all TODO/FIXME before completing
8. No security vulnerabilities - validate inputs, avoid injection
9. Verification run required - execute actual code with real data
10. Type safety - strict TypeScript, no `any`
11. Golden path verification - prove it works end-to-end

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

## Before Completing: Self-Verification Required

Before marking a task ready for review, you MUST verify all standing constraints were followed. This is a self-check that happens during implementation, not during review.

### Completion Checklist

Run through each constraint and document in `implementation_notes`:

1. **No Overengineering** - Is the implementation minimal? No premature abstractions?
2. **DRY** - Did you reuse existing code/patterns? No duplication?
3. **No Roll-Your-Own** - Used existing libraries? No custom implementations of solved problems?
4. **No Hallucinations** - Verify all function calls, endpoints, props exist and have correct signatures
5. **No Silent Failures** - All errors logged or surfaced? No empty catch blocks?
6. **No TODO Comments** - Run: `grep -rn "TODO\|FIXME\|HACK\|XXX" <your_files>`
7. **No Security Vulnerabilities** - Input validated? No injection risks?
8. **Compilation** - Does it compile with no errors?
9. **Verification Run** - Execute the code with real data. Does it work?
10. **Golden Path** - Run the feature end-to-end. Does the user flow work?

### After Self-Verification

Update the task's `implementation_notes` with verification results:

```json
{
  "implementation_notes": "Implemented order creation endpoint. Self-verification: all constraints passed. Verified with POST /api/orders → 201 response. End-to-end checkout flow works."
}
```

Then run `/task-review` for independent verification.

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
