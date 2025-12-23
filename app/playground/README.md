# Workflow Playground

Test and debug workflows with sample events.

## Usage

Run from the `app/` directory:

```bash
# Run Trust Building subflow
uv run playground/playground.py TRUST_BUILDING

# Run Analyst flow (orchestrates all subflows)
uv run playground/playground.py ANALYST

# Use a custom event file
uv run playground/playground.py TRUST_BUILDING --event playground_requests/custom_event.json

# Verbose logging
uv run playground/playground.py TRUST_BUILDING -v

# Don't save result to file
uv run playground/playground.py TRUST_BUILDING --no-save
```

## Available Workflows

Workflows are registered in `workflows/workflow_registry.py`:

| Workflow | Description |
|----------|-------------|
| `TRUST_BUILDING` | Trust Building subflow - establishes rapport with storyteller |
| `ANALYST` | Analyst flow - orchestrates all subflows, determines next action |

## Sample Events

Sample event files are stored in `playground_requests/`:

- `trust_building_event_sample.json` - Sample TrustBuildingEvent
- `analyst_event_sample.json` - Sample AnalystEvent

## Output

Results are saved to `playground_requests/<workflow>_result_<timestamp>.json`

Example output structure:
```json
{
  "workflow": "TRUST_BUILDING",
  "timestamp": "2024-12-23T10:30:00",
  "status": "completed",
  "should_stop": false,
  "required_stop": false,
  "nodes": {
    "TrustBuildingGate": {
      "gate_result": "proceed",
      "next_step": "introduction"
    },
    "IntroductionNode": {
      "step_completed": true,
      "preferred_name": "Maggie"
    }
  },
  "metadata": {}
}
```

## Adding New Workflows

1. Create your workflow in `workflows/`
2. Register it in `workflows/workflow_registry.py`:
   ```python
   class WorkflowRegistry(Enum):
       MY_WORKFLOW = MyWorkflow
   ```
3. Add a sample event in `playground_requests/`:
   ```
   playground_requests/my_workflow_event_sample.json
   ```
4. Update `DEFAULT_EVENTS` in `playground.py`:
   ```python
   DEFAULT_EVENTS = {
       "MY_WORKFLOW": PLAYGROUND_REQUESTS_DIR / "my_workflow_event_sample.json",
   }
   ```

## Workflow Statuses

| Status | Meaning |
|--------|---------|
| `completed` | Workflow finished successfully |
| `stopped` | Workflow stopped by design (self-gating) |
| `error` | Workflow stopped due to error |
| `initializing` | Workflow still running |
