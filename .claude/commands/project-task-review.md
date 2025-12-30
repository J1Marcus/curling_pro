# /task-review - Verify Task Implementation

Run verification checks on a completed task and populate the verification report.

## Arguments

- `$ARGUMENTS` - Task ID (e.g., "TASK-001") or blank for current in_progress task

## Purpose

This is an **independent re-verification** of work that was already self-verified during implementation. The implementing agent should have already checked all constraints and verified the code works before requesting review.

This review catches:
- Issues the implementer missed during self-verification
- Integration problems not visible during implementation
- Constraint violations that slipped through
- A fresh perspective on the implementation

## Process

### Step 1: Load Task

Read `.clarify/tasks.json` and find the specified task (or current in_progress task).

Verify task status is `in_progress` - tasks must be implemented before verification.

Check `implementation_notes` for evidence of self-verification. If missing, flag this in the review.

### Step 2: Initialize Verification Object

Set up the verification structure in the task:

```json
{
  "verification": {
    "status": "in_progress",
    "verified_at": "<current_timestamp>",
    "compiled": { "passed": false, "notes": "" },
    "constraints_check": {
      "passed": false,
      "no_overengineering": { "passed": false, "notes": "" },
      "dry": { "passed": false, "notes": "" },
      "no_roll_your_own": { "passed": false, "notes": "" },
      "no_hallucinations": { "passed": false, "notes": "" },
      "no_silent_failures": { "passed": false, "notes": "" },
      "no_todo_comments": { "passed": false, "notes": "" },
      "no_security_vulnerabilities": { "passed": false, "notes": "" }
    },
    "verification_run": { "passed": false, "input": "", "output": "", "notes": "" },
    "golden_path": { "passed": false, "scenario": "", "result": "", "notes": "" },
    "boundary_check": { "passed": false, "edge_cases_tested": [], "notes": "" }
  }
}
```

### Step 3: Compilation Check

1. Run the build/compile command for the project
2. Record results:

```json
{
  "compiled": {
    "passed": true,
    "notes": "TypeScript compiled with 0 errors"
  }
}
```

**If compilation fails**: Stop here. Fix errors before proceeding.

### Step 4: Constraints Check

Review the implemented code against standing constraints. For each constraint, inspect the code and record whether it was honored.

#### 4.1 No Overengineering
- Is the implementation minimal for the requirements?
- No premature abstractions or unnecessary indirection?
- No excessive configuration for simple features?

#### 4.2 DRY (Don't Repeat Yourself)
- No duplicated code that could use existing abstractions?
- Reusing existing patterns and utilities?

#### 4.3 No Roll-Your-Own
- Using existing libraries where appropriate?
- Not reimplementing functionality that exists in the codebase?
- Not creating custom CSS when theme system exists?

#### 4.4 No Hallucinations
- All function/method calls exist and have correct signatures?
- All API endpoints exist?
- All props/fields match actual definitions?

#### 4.5 No Silent Failures
- All catch blocks log or surface errors?
- No misleading fallback values that hide failures?
- Errors are visible to users or logged appropriately?

#### 4.6 No TODO Comments
Search for unresolved work markers:
```bash
grep -rn "TODO\|FIXME\|HACK\|XXX" <implemented_files>
```

#### 4.7 No Security Vulnerabilities
- Input validated at system boundaries?
- No SQL injection, XSS, command injection risks?
- No hardcoded secrets or credentials?

Record results:

```json
{
  "constraints_check": {
    "passed": true,
    "no_overengineering": { "passed": true, "notes": "Minimal implementation, no unnecessary abstractions" },
    "dry": { "passed": true, "notes": "Reused existing orderUtils for calculations" },
    "no_roll_your_own": { "passed": true, "notes": "Used zod for validation instead of custom" },
    "no_hallucinations": { "passed": true, "notes": "All API calls verified against actual endpoints" },
    "no_silent_failures": { "passed": true, "notes": "All errors logged and surfaced to UI" },
    "no_todo_comments": { "passed": true, "notes": "No TODO/FIXME found in implementation" },
    "no_security_vulnerabilities": { "passed": true, "notes": "Input validated, parameterized queries used" }
  }
}
```

**If any constraint fails**: Document the violation and what needs to be fixed.

### Step 5: Verification Run

Execute the actual code path with realistic data. No mocks.

1. Identify the primary function/endpoint/component implemented
2. Call it with realistic input data
3. Record the actual output

```json
{
  "verification_run": {
    "passed": true,
    "input": "createOrder({ items: [{ id: 'prod-1', qty: 2 }], userId: 'user-123' })",
    "output": "{ orderId: 'ord-456', status: 'created', total: 49.98 }",
    "notes": "Order created successfully with correct total calculation"
  }
}
```

**Examples by implementation type:**

- **API endpoint**: `curl -X POST /api/orders -d '{"items": [...]}' → response`
- **Function**: `functionName(input) → output`
- **Component**: Render with props, capture rendered output
- **Service**: Call method with real dependencies, show result

### Step 6: Golden Path Verification

Verify the feature works end-to-end in the running application.

1. Describe a realistic user scenario
2. Execute that scenario
3. Document the result

```json
{
  "golden_path": {
    "passed": true,
    "scenario": "User adds item to cart, proceeds to checkout, submits order",
    "result": "Order confirmation displayed with order ID ord-456",
    "notes": "Full flow works. Cart cleared after order submission."
  }
}
```

### Step 7: Boundary Check

Test behavior at edges - empty input, null values, invalid data.

1. Identify 2-3 edge cases relevant to this task
2. Test each one
3. Document behavior

```json
{
  "boundary_check": {
    "passed": true,
    "edge_cases_tested": [
      "Empty items array → Returns error 'Order must have items'",
      "Invalid userId → Returns error 'User not found'",
      "Negative quantity → Returns error 'Quantity must be positive'"
    ],
    "notes": "All edge cases handled with appropriate error messages"
  }
}
```

### Step 8: Determine Overall Status

Set verification status based on results:

- **passed**: All checks passed
- **failed**: Any check failed

```json
{
  "verification": {
    "status": "passed",
    ...
  }
}
```

### Step 9: Update Task

1. Write verification results to task in `.clarify/tasks.json`
2. If all checks passed, task can be marked `completed`
3. If any check failed, task remains `in_progress`

### Step 10: Display Verification Report

Output summary for user:

```
## Verification Report: TASK-XXX

### ✅ Compilation
TypeScript compiled with 0 errors

### ✅ Constraints Check
| Constraint | Status | Notes |
|------------|--------|-------|
| No Overengineering | ✅ | Minimal implementation |
| DRY | ✅ | Reused orderUtils |
| No Roll-Your-Own | ✅ | Used zod for validation |
| No Hallucinations | ✅ | All APIs verified |
| No Silent Failures | ✅ | Errors logged and surfaced |
| No TODO Comments | ✅ | None found |
| No Security Vulns | ✅ | Input validated |

### ✅ Verification Run
**Input**: createOrder({ items: [{ id: 'prod-1', qty: 2 }], userId: 'user-123' })
**Output**: { orderId: 'ord-456', status: 'created', total: 49.98 }
Order created successfully with correct total calculation

### ✅ Golden Path
**Scenario**: User adds item to cart, proceeds to checkout, submits order
**Result**: Order confirmation displayed with order ID ord-456
Full flow works. Cart cleared after order submission.

### ✅ Boundary Check
- Empty items array → Returns error 'Order must have items'
- Invalid userId → Returns error 'User not found'
- Negative quantity → Returns error 'Quantity must be positive'

---
**Status**: PASSED ✅
Task ready to mark as completed.
```

## Example Usage

```
/task-review TASK-001      # Review specific task
/task-review               # Review current in_progress task
```

## Failure Handling

If any check fails:

1. Document what failed and why
2. Keep task status as `in_progress`
3. Output actionable feedback:

```
## Verification Report: TASK-001

### ✅ Compilation
Passed

### ❌ Verification Run
**Input**: createOrder({ items: [], userId: 'user-123' })
**Output**: { orderId: 'ord-789', status: 'created', total: 0 }
**Issue**: Empty order was created instead of returning an error

### Action Required
Fix empty order validation before marking task complete.
```

## Notes

- This replaces traditional code review with proof-of-execution
- No mocks - use real code paths and real dependencies
- Failed verification blocks task completion
- Verification results persist in tasks.json for UI rendering
