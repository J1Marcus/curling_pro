"""
Trust Building Gate Node

Self-gating node that determines whether Trust Building work is needed.
If trust is already established (all steps complete), the subflow
stops early via required_stop.
"""

import logging
from datetime import datetime, timezone

from core.nodes.base import Node
from core.task import TaskContext
from schemas.subflow_events import TrustBuildingEvent

logger = logging.getLogger(__name__)


# Trust building steps in order
TRUST_STEPS = [
    "introduction",
    "subject_clarification",
    "scope_selection",
    "gentle_profile",
]


class TrustBuildingGate(Node):
    """Self-gating entry node for Trust Building Subflow.

    This node implements the self-gating pattern:
    - Analyzes current trust state
    - Determines if Trust Building work is needed
    - If not needed, calls required_stop_workflow() to exit early
    - If needed, determines which step to work on next

    Gate Logic:
    1. If ALL trust steps are complete → required_stop (no work needed)
    2. If first session and no introduction → set current_step to 'introduction'
    3. Otherwise → set current_step to next incomplete step
    """

    async def process(self, task_context: TaskContext) -> TaskContext:
        """Process the Trust Building gate check.

        Args:
            task_context: Current task context with TrustBuildingEvent

        Returns:
            TaskContext with gate results and next step determination
        """
        event: TrustBuildingEvent = task_context.event

        logger.info(
            f"Trust Building Gate: Checking trust state for storyteller {event.storyteller_id}"
        )

        # Analyze current trust state
        completed_steps = set(event.completed_trust_steps)
        remaining_steps = [s for s in TRUST_STEPS if s not in completed_steps]

        # Log current state
        logger.info(
            f"Trust state: completed={list(completed_steps)}, "
            f"remaining={remaining_steps}, is_first_session={event.is_first_session}"
        )

        # Self-gating check: Is Trust Building work needed?
        if not remaining_steps:
            # All trust steps complete - no work needed
            logger.info(
                "Trust Building Gate: All trust steps complete. "
                "Self-gating - stopping subflow."
            )

            task_context.update_node(
                "TrustBuildingGate",
                gate_result="not_needed",
                reason="All trust steps already complete",
                completed_steps=list(completed_steps),
                processed_at=datetime.now(timezone.utc).isoformat(),
            )

            # Self-gate: Stop workflow by design (not error)
            task_context.required_stop_workflow()
            return task_context

        # Determine next step to work on
        next_step = remaining_steps[0]

        # Special case: First session always starts with introduction
        if event.is_first_session and "introduction" in remaining_steps:
            next_step = "introduction"

        # Trust Building work is needed
        logger.info(
            f"Trust Building Gate: Work needed. Next step: {next_step}"
        )

        task_context.update_node(
            "TrustBuildingGate",
            gate_result="proceed",
            next_step=next_step,
            remaining_steps=remaining_steps,
            completed_steps=list(completed_steps),
            is_first_session=event.is_first_session,
            processed_at=datetime.now(timezone.utc).isoformat(),
        )

        # Store next step in metadata for downstream nodes
        task_context.metadata["current_trust_step"] = next_step
        task_context.metadata["remaining_trust_steps"] = remaining_steps

        return task_context
