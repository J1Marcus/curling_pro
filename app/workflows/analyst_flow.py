"""
Analyst Flow

The Analyst Flow is the central orchestrator that runs after each
session interaction. It:

1. Loads storyteller context
2. Runs ALL subflows (each self-gates if not needed)
3. Determines the next action based on subflow results

This implements the "Analyst runs ALL subflows on every invocation"
pattern from the high-level plan. Each subflow has self-gating logic
that stops early if no work is needed.

Trigger Points:
- After a VAPI session ends
- When a requirement result is submitted
- Manual invocation for analysis

Flow:
1. AnalystGate → Load context, validate event
2. SubflowRunner → Run all subflows (Trust, Grounding, Selection, Lane)
3. NextActionDeterminer → Analyze results, determine next action
"""

from core.schema import WorkflowSchema, NodeConfig
from core.workflow import Workflow
from schemas.analyst_events import AnalystEvent

from workflows.analyst_flow_nodes.analyst_gate import AnalystGate
from workflows.analyst_flow_nodes.subflow_runner import SubflowRunner
from workflows.analyst_flow_nodes.next_action_determiner import NextActionDeterminer


class AnalystFlow(Workflow):
    """Analyst Flow - Central orchestrator for story capture.

    The Analyst runs after each session and determines what needs
    to happen next. It invokes all subflows (which self-gate) and
    then decides on the next action.

    Key Behaviors:
    - Runs ALL subflows every time (no pre-checking)
    - Subflows self-gate if their work is not needed
    - Creates requirements for work that needs to be done
    - Determines next action (start session, wait, etc.)
    """

    workflow_schema = WorkflowSchema(
        description="Analyst Flow: Orchestrate subflows and determine next actions",
        event_schema=AnalystEvent,
        start=AnalystGate,
        nodes=[
            NodeConfig(
                node=AnalystGate,
                connections=[SubflowRunner],
                description="Load storyteller context and validate event",
            ),
            NodeConfig(
                node=SubflowRunner,
                connections=[NextActionDeterminer],
                description="Run all subflows (each self-gates if not needed)",
            ),
            NodeConfig(
                node=NextActionDeterminer,
                connections=[],
                description="Analyze results and determine next action",
            ),
        ],
    )
