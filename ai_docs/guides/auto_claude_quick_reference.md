# Auto-Claude Quick Reference Card

**Fast lookup for common Auto-Claude operations**

---

## Create New Task (Minimum Setup)

```bash
# 1. Create directory
mkdir -p .auto-claude/specs/NNN-task-name

# 2. Create 3 required files
cd .auto-claude/specs/NNN-task-name

# requirements.json
cat > requirements.json << 'EOF'
{
  "task_description": "Your task description",
  "workflow_type": "feature"
}
EOF

# task_metadata.json
cat > task_metadata.json << 'EOF'
{
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
  },
  "estimatedStoryPoints": 5,
  "relatedDocs": []
}
EOF

# implementation_plan.json
cat > implementation_plan.json << 'EOF'
{
  "feature": "Task Name",
  "description": "Task description",
  "created_at": "2025-12-21T00:00:00.000Z",
  "updated_at": "2025-12-21T00:00:00.000Z",
  "status": "pending",
  "phases": []
}
EOF
```

---

## Model Selection Cheat Sheet

| Complexity | Spec | Planning | Coding | QA | Cost |
|------------|------|----------|--------|-----|------|
| **Trivial** | Sonnet | Haiku | Haiku | Haiku | $ |
| **Simple** | Sonnet | Sonnet | Sonnet | Haiku | $$ |
| **Standard** | Opus | Sonnet | Sonnet | Sonnet | $$$ |
| **Complex** | Opus | Opus | Opus | Sonnet | $$$$ |

**Rule:** Start with Sonnet, upgrade to Opus only when needed.

---

## Thinking Levels

| Level | Use For | Cost Impact |
|-------|---------|-------------|
| `low` | Simple tasks, well-defined work | Minimal |
| `medium` | Standard features | Moderate |
| `high` | Complex logic, important decisions | Significant |
| `ultrathink` | Novel problems, critical planning | Maximum |

**Rule:** Use `ultrathink` only for spec/planning of complex tasks.

---

## Field Quick Reference

### Workflow Types
- `feature` - New functionality
- `bug` - Bug fixes
- `refactor` - Code restructuring
- `docs` - Documentation
- `test` - Testing

### Priority Levels
- `low` - Nice-to-have
- `medium` - Standard work
- `high` - Core functionality
- `critical` - Production issues

### Complexity Levels
- `trivial` - <2 hours, 1 file
- `simple` - 2-8 hours, few files
- `standard` - 1-3 days, multiple files
- `complex` - 3+ days, many files, novel

### Impact Levels
- `low` - Minor improvement
- `medium` - Standard feature
- `high` - Core business value

---

## Common Commands

```bash
# Run a task
auto-claude run --spec NNN-task-name

# Run with parallelism
auto-claude run --spec NNN-task-name --parallel 2

# Resume a task
auto-claude run --spec NNN-task-name --resume

# Stop execution
auto-claude stop

# Check status
cat .auto-claude/.auto-claude-status

# View logs
cat .auto-claude/specs/NNN-task-name/task_logs.json

# Validate JSON
python -m json.tool file.json
```

---

## Phase Types

- `setup` - Initial configuration
- `implementation` - Core development
- `integration` - Connecting components
- `testing` - Quality assurance

---

## Verification Types

```json
{
  "verification": {
    "type": "command",
    "command": "pytest tests/test_file.py",
    "expected": "All tests pass"
  }
}
```

**Types:** `command`, `unit_test`, `integration_test`, `e2e_test`

---

## Subtask Template

```json
{
  "id": "subtask-1-1",
  "description": "Clear, actionable task description",
  "service": "main",
  "files_to_create": ["path/to/new/file.py"],
  "files_to_modify": ["path/to/existing/file.py"],
  "patterns_from": ["path/to/pattern/file.py"],
  "status": "pending",
  "verification": {
    "type": "command",
    "command": "python -c 'import module; print(\"OK\")'",
    "expected": "OK"
  }
}
```

---

## Phase Template

```json
{
  "id": "phase-1-setup",
  "name": "Setup Infrastructure",
  "type": "setup",
  "description": "Create base files",
  "depends_on": [],
  "parallel_safe": false,
  "status": "pending",
  "subtasks": [...]
}
```

**Dependencies:**
- `depends_on: []` - No dependencies, can start immediately
- `depends_on: ["phase-1"]` - Wait for phase-1 to complete
- `parallel_safe: true` - Can run concurrently with other phases

---

## Troubleshooting One-Liners

```bash
# Task not appearing? Check JSON syntax
for f in .auto-claude/specs/NNN-*/*.json; do python -m json.tool "$f" > /dev/null || echo "❌ $f"; done

# Task stuck? Check current status
cat .auto-claude/specs/NNN-task-name/implementation_plan.json | jq '.phases[].status'

# High costs? Check thinking levels
grep -r "thinkingLevel" .auto-claude/specs/NNN-task-name/

# Need to restart? Kill and resume
auto-claude stop && auto-claude run --spec NNN-task-name --resume

# Verification failing? Test manually
cd app && python -c 'import your.module; print("OK")'
```

---

## Cost Optimization Tips

1. **Use Haiku for QA** unless complex validation needed
2. **Start with Sonnet** for coding, upgrade if quality issues
3. **Reserve Opus** for architecture, critical planning
4. **Lower thinking** for straightforward tasks
5. **Add verification** to catch errors early (cheaper than reruns)
6. **Break large tasks** into smaller chunks

---

## Best Practices Checklist

- [ ] Task name follows `NNN-descriptive-name` format
- [ ] All 3 required files present (requirements, metadata, plan)
- [ ] `relatedDocs` includes relevant context
- [ ] `patterns_from` references existing code to follow
- [ ] Phases have clear dependencies
- [ ] Subtasks include verification commands
- [ ] Model selection matches complexity
- [ ] Thinking levels appropriate for each phase
- [ ] Story points estimated (Fibonacci: 1,2,3,5,8,13,21)
- [ ] WBS reference included (if applicable)

---

## File Structure

```
.auto-claude/specs/NNN-task-name/
├── requirements.json          ✅ Required
├── task_metadata.json         ✅ Required
├── implementation_plan.json   ✅ Required
├── spec.md                    ⭐ Recommended (complex tasks)
├── complexity_assessment.json 🤖 Auto-generated
├── context.json               🤖 Auto-generated
├── task_logs.json            🤖 Auto-generated
├── review_state.json         🤖 Auto-generated
└── memory/                    🤖 Auto-generated
    ├── codebase_map.json
    ├── attempt_history.json
    └── session_insights/
        ├── session_001.json
        └── ...
```

---

## Example: Standard Feature Task

```json
// task_metadata.json for a standard 8-point feature
{
  "sourceType": "manual",
  "category": "feature",
  "priority": "high",
  "complexity": "standard",
  "impact": "high",
  "model": "sonnet",
  "thinkingLevel": "medium",
  "isAutoProfile": true,
  "phaseModels": {
    "spec": "opus",      // Invest in good planning
    "planning": "sonnet", // Standard planning
    "coding": "sonnet",   // Cost-effective coding
    "qa": "sonnet"        // Thorough QA
  },
  "phaseThinking": {
    "spec": "high",       // Think through architecture
    "planning": "medium", // Standard deliberation
    "coding": "medium",   // Moderate thinking while coding
    "qa": "low"           // Simple validation
  },
  "estimatedStoryPoints": 8,
  "wbsReference": "2.1.1",
  "relatedDocs": [
    "ai_docs/context/project_docs/wbs.md",
    "ai_docs/context/source_docs/flow_architecture.md"
  ]
}
```

---

## Resources

- **Full Guide:** [ai_docs/guides/working_with_auto_claude.md](./working_with_auto_claude.md)
- **Auto-Claude Repo:** https://github.com/AndyMik90/Auto-Claude.git
- **Project Examples:** `.auto-claude/specs/001-*` through `.auto-claude/specs/007-*`

---

**Print this card and keep it handy! 📋**
