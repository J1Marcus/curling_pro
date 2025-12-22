# Everbound Development Guides

This directory contains comprehensive guides for working with the Everbound project.

## Available Guides

### 🤖 [Working with Auto-Claude](./working_with_auto_claude.md)
**Complete guide to using Auto-Claude for automated development**

Topics covered:
- Task structure and creation
- Model selection and configuration
- Running and monitoring tasks
- Best practices and optimization
- Troubleshooting common issues
- Advanced topics (templates, CI/CD integration)

**When to use:** First time using Auto-Claude, or when you need detailed reference.

---

### ⚡ [Auto-Claude Quick Reference](./auto_claude_quick_reference.md)
**One-page cheat sheet for common Auto-Claude operations**

Quick lookup for:
- Minimum task setup
- Model selection matrix
- Common commands
- Troubleshooting one-liners
- Field reference
- Cost optimization tips

**When to use:** Quick lookups while working, print and keep handy.

---

## Quick Start

### Create a New Task (Interactive)

Use the provided script for quick task creation:

```bash
# Simple task
./scripts/create_auto_claude_task.sh 008 user-authentication

# Complex task with options
./scripts/create_auto_claude_task.sh 009 phase-assessment \
  --description "Implement phase assessment with gap analysis" \
  --complexity complex \
  --priority high \
  --story-points 13 \
  --wbs "2.1.2" \
  --related-docs "ai_docs/context/source_docs/flow_architecture.md,ai_docs/context/project_docs/wbs.md"
```

**Script options:**
- `--description` - Task description
- `--complexity` - trivial|simple|standard|complex
- `--priority` - low|medium|high|critical
- `--story-points` - Fibonacci estimate (1,2,3,5,8,13,21)
- `--category` - feature|bug|refactor|docs|test
- `--wbs` - WBS reference (e.g., "2.1.3")
- `--related-docs` - Comma-separated doc paths

### Run a Task

```bash
# Standard execution
auto-claude run --spec 008-user-authentication

# With parallelism
auto-claude run --spec 008-user-authentication --parallel 2

# Resume after interruption
auto-claude run --spec 008-user-authentication --resume
```

---

## Learning Path

### 1. Complete Beginners
**Start here if you've never used Auto-Claude**

1. Read [Working with Auto-Claude](./working_with_auto_claude.md) - Overview & Getting Started sections
2. Review [Task 002 (Sample Task)](../../.auto-claude/specs/002-sample-task/) - Minimal example
3. Create your first task using the script:
   ```bash
   ./scripts/create_auto_claude_task.sh 008 my-first-task \
     --description "My first Auto-Claude task" \
     --complexity simple
   ```
4. Study [Task Structure](./working_with_auto_claude.md#task-structure) section

### 2. Getting Productive
**Once you understand the basics**

1. Study [Creating Tasks](./working_with_auto_claude.md#creating-tasks) section
2. Review existing tasks for patterns:
   - [003-onboarding-subflow](../../.auto-claude/specs/003-onboarding-subflow/) - Standard task
   - [004-phase-assessment-subflow](../../.auto-claude/specs/004-phase-assessment-subflow/) - Complex task
3. Learn [Best Practices](./working_with_auto_claude.md#best-practices)
4. Keep [Quick Reference](./auto_claude_quick_reference.md) handy

### 3. Advanced Usage
**Optimizing for efficiency and cost**

1. Master [Model Selection](./working_with_auto_claude.md#task-metadata--configuration)
2. Understand [Cost Optimization](./auto_claude_quick_reference.md#cost-optimization-tips)
3. Create custom task templates
4. Explore [Advanced Topics](./working_with_auto_claude.md#advanced-topics)

---

## Common Workflows

### Adding a New Feature

```bash
# 1. Create task from WBS
./scripts/create_auto_claude_task.sh 010 new-feature \
  --description "Implement XYZ feature from WBS" \
  --complexity standard \
  --story-points 8 \
  --wbs "2.3.5" \
  --related-docs "ai_docs/context/project_docs/wbs.md"

# 2. Edit task files to add phases/subtasks
vim .auto-claude/specs/010-new-feature/implementation_plan.json

# 3. Run the task
auto-claude run --spec 010-new-feature

# 4. Monitor progress
watch -n 5 cat .auto-claude/.auto-claude-status

# 5. Review results and commit
git add .
git commit -m "feat: implement XYZ feature via Auto-Claude"
```

### Fixing a Bug

```bash
# 1. Create bug fix task
./scripts/create_auto_claude_task.sh 011 fix-auth-bug \
  --description "Fix authentication token expiry bug" \
  --category bug \
  --complexity simple \
  --priority high \
  --story-points 3

# 2. Run immediately (bugs are urgent)
auto-claude run --spec 011-fix-auth-bug

# 3. Test the fix
pytest tests/auth/test_token.py

# 4. Create PR
git checkout -b fix/auth-token-expiry
git add .
git commit -m "fix: resolve auth token expiry issue"
git push origin fix/auth-token-expiry
```

### Batch Creating Tasks

```bash
# Create multiple tasks from WBS sections
tasks=(
  "012:session-flow-implementation:Implement Session Flow for VAPI:complex:13:2.2"
  "013:editor-flow-implementation:Implement Editor Flow for composition:complex:13:2.3"
  "014:vapi-integration:Integrate VAPI for voice sessions:standard:8:2.2.1"
)

for task in "${tasks[@]}"; do
  IFS=':' read -r id name desc complexity points wbs <<< "$task"
  ./scripts/create_auto_claude_task.sh "$id" "$name" \
    --description "$desc" \
    --complexity "$complexity" \
    --story-points "$points" \
    --wbs "$wbs"
done
```

---

## Tips & Best Practices

### ✅ DO
- ✅ Start with `standard` complexity and `sonnet` model
- ✅ Include `relatedDocs` for context
- ✅ Reference existing patterns in `patterns_from`
- ✅ Add verification commands to subtasks
- ✅ Break large tasks into 5-15 subtasks
- ✅ Use `parallel_safe: true` when possible
- ✅ Review Auto-Claude's work before committing

### ❌ DON'T
- ❌ Use `opus` + `ultrathink` for everything (expensive!)
- ❌ Create tasks with >20 subtasks (split them)
- ❌ Skip the spec phase (leads to poor results)
- ❌ Forget to add dependencies between phases
- ❌ Leave `relatedDocs` empty (context is key)
- ❌ Use `trivial` complexity unless truly trivial (<2 hours)

---

## Cost Management

### Estimated Costs per Task

| Complexity | Model Config | Typical Cost | Duration |
|------------|--------------|--------------|----------|
| **Trivial** | Haiku/Sonnet | $0.50-$2 | 15-30 min |
| **Simple** | Sonnet | $2-$5 | 30-60 min |
| **Standard** | Opus/Sonnet | $5-$15 | 1-3 hours |
| **Complex** | Opus | $15-$50 | 3-8 hours |

**Note:** Costs vary based on:
- Thinking levels used
- Number of iterations/retries
- Codebase size
- Complexity of verification commands

### Cost Optimization Strategies

1. **Use verification commands** - Catch errors early (cheaper than reruns)
2. **Start conservative** - Begin with Sonnet, upgrade if needed
3. **Lower thinking for QA** - Simple validation doesn't need ultrathink
4. **Break large tasks** - Multiple small tasks cheaper than one huge task
5. **Reuse patterns** - Reference existing code reduces exploration

---

## Troubleshooting

Quick fixes for common issues:

```bash
# Task not appearing in kanban?
python3 -m json.tool .auto-claude/specs/NNN-task/*.json  # Validate JSON

# Task stuck in a phase?
cat .auto-claude/specs/NNN-task/task_logs.json  # Check logs
auto-claude stop && auto-claude run --spec NNN-task --resume

# High API costs?
grep -r "thinkingLevel" .auto-claude/specs/NNN-task/  # Check if ultrathink overused

# Poor code quality?
vim .auto-claude/specs/NNN-task/task_metadata.json  # Add relatedDocs
vim .auto-claude/specs/NNN-task/implementation_plan.json  # Add patterns_from

# Verification failing?
cd app && python3 -c 'import module; print("OK")'  # Test manually
```

For detailed troubleshooting, see [Working with Auto-Claude - Troubleshooting](./working_with_auto_claude.md#troubleshooting).

---

## Project-Specific Examples

Real examples from this project:

### Analyst Flow Implementation (47 story points)
- [003-onboarding-subflow](../../.auto-claude/specs/003-onboarding-subflow/) - 8 pts, standard
- [004-phase-assessment-subflow](../../.auto-claude/specs/004-phase-assessment-subflow/) - 13 pts, complex
- [005-session-planning-subflow](../../.auto-claude/specs/005-session-planning-subflow/) - 8 pts, standard
- [006-post-session-analysis-subflow](../../.auto-claude/specs/006-post-session-analysis-subflow/) - 13 pts, complex
- [007-composition-trigger-subflow](../../.auto-claude/specs/007-composition-trigger-subflow/) - 5 pts, standard

### Database Models Implementation (64 models)
- [001-generate-sqlalchemy-models](../../.auto-claude/specs/001-generate-sqlalchemy-models-from-schema-docs/) - Complex multi-phase task
- Shows: Detailed spec.md, complexity assessment, 9 phases with dependencies

---

## Resources

### Internal Documentation
- [Project WBS](../context/project_docs/wbs.md) - Work breakdown structure
- [Flow Architecture](../context/source_docs/flow_architecture.md) - System architecture
- [Database Schema](../context/source_docs/schema/) - Database design

### External Resources
- [Auto-Claude Repository](https://github.com/AndyMik90/Auto-Claude.git)
- [Anthropic API Docs](https://docs.anthropic.com/)
- [Claude Models Overview](https://www.anthropic.com/claude)

---

## Getting Help

1. **Check the guides**
   - Full guide: [working_with_auto_claude.md](./working_with_auto_claude.md)
   - Quick reference: [auto_claude_quick_reference.md](./auto_claude_quick_reference.md)

2. **Review examples**
   - Browse `.auto-claude/specs/` for real task examples
   - Study completed tasks for patterns

3. **Validate your setup**
   ```bash
   # Ensure all required files present
   ls .auto-claude/specs/NNN-task/

   # Validate JSON syntax
   for f in .auto-claude/specs/NNN-task/*.json; do
     python3 -m json.tool "$f" > /dev/null && echo "✓ $(basename $f)";
   done
   ```

4. **Ask questions**
   - Check Auto-Claude issues: https://github.com/AndyMik90/Auto-Claude/issues
   - Review this project's commit history for patterns

---

**Last Updated:** 2025-12-21
**Version:** 1.0
**Maintainer:** Everbound Development Team

**Happy coding with Auto-Claude! 🤖✨**
