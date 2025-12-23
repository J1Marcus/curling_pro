---
description: View Task List Status (project)
argument-hint: [filter]
---

Display current status of all tasks in `.clarify/tasks.json`.

## Arguments

- `$ARGUMENTS` - Optional filter: "pending", "critical", "high", or specific task ID

## Process

### Step 1: Load Tasks
Read `.clarify/tasks.json`.

### Step 2: Generate Summary
Output a formatted summary:

```
## Task Status Summary

Generated: <date>
Total Tasks: X
- Completed: X (XX%)
- In Progress: X
- Pending: X

### By Priority:
- Critical: X pending / X total
- High: X pending / X total
- Medium: X pending / X total
- Low: X pending / X total

### Next Tasks (Critical Priority):
1. TASK-XXX: Task name
2. TASK-XXX: Task name

### Recently Completed:
- TASK-XXX: Task name
```

### Step 3: Show Filtered View (if argument provided)
If a filter argument is provided, show only matching tasks with full details.

## Example Usage

```
/task-status              # Full summary
/task-status pending      # Show all pending tasks
/task-status critical     # Show all critical tasks
/task-status TASK-005     # Show specific task details
```

## Output Format

For individual tasks, show:
```
## TASK-XXX: Task Name

Status: pending | Priority: critical

### Requirements:
1. Step 1
2. Step 2

### Dependencies:
- ServiceName
- OtherTask

### Reference Files:
- path/to/file.py
```
