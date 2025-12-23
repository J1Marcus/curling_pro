"""
Analyst Gate Node

Entry gate for the Analyst Flow.
Loads storyteller context and validates the event.
"""

import logging
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from core.nodes.base import Node
from core.task import TaskContext
from schemas.analyst_events import AnalystEvent
from database.session import SessionLocal
from services import StorytellerService, RequirementService

logger = logging.getLogger(__name__)


class AnalystGate(Node):
    """Entry gate for Analyst Flow.

    This node:
    1. Validates the incoming analyst event
    2. Loads full storyteller context if not provided
    3. Loads pending requirements
    4. Sets up context for subflow execution

    The gate ensures all necessary context is available
    before running subflows.
    """

    async def process(self, task_context: TaskContext) -> TaskContext:
        """Process the Analyst gate.

        Args:
            task_context: Current task context with AnalystEvent

        Returns:
            TaskContext with loaded context
        """
        event: AnalystEvent = task_context.event

        logger.info(
            f"AnalystGate: Processing for storyteller {event.storyteller_id}, "
            f"trigger={event.trigger_type}"
        )

        # Get database session
        db: Session = SessionLocal()

        try:
            # Load storyteller context if not provided
            if not event.storyteller_context:
                storyteller_svc = StorytellerService(db)
                storyteller_context = storyteller_svc.get_full_context(
                    event.storyteller_id
                )

                if not storyteller_context:
                    logger.error(
                        f"AnalystGate: Storyteller {event.storyteller_id} not found"
                    )
                    task_context.update_node(
                        "AnalystGate",
                        gate_result="failed",
                        error="Storyteller not found",
                        processed_at=datetime.now(timezone.utc).isoformat(),
                    )
                    task_context.stop_workflow()
                    return task_context

                # Store in metadata for subflows
                task_context.metadata["storyteller_context"] = storyteller_context
                logger.info("AnalystGate: Loaded storyteller context")
            else:
                task_context.metadata["storyteller_context"] = event.storyteller_context

            # Load pending requirements
            requirement_svc = RequirementService(db)
            pending_reqs = requirement_svc.get_pending(event.storyteller_id)
            pending_req_data = [
                {
                    "id": str(req.id),
                    "name": req.requirement_name,
                    "type": req.requirement_type,
                    "priority": req.priority,
                }
                for req in pending_reqs
            ]
            task_context.metadata["pending_requirements"] = pending_req_data

            # Get requirement stats
            req_stats = requirement_svc.get_stats(event.storyteller_id)
            task_context.metadata["requirement_stats"] = req_stats

            logger.info(
                f"AnalystGate: Loaded {len(pending_reqs)} pending requirements"
            )

            # Determine current phase from storyteller progress
            storyteller_context = task_context.metadata["storyteller_context"]
            progress = storyteller_context.get("progress", {})
            current_phase = progress.get("current_phase", "trust_setup")

            task_context.metadata["current_phase"] = current_phase
            task_context.metadata["storyteller_id"] = str(event.storyteller_id)
            task_context.metadata["session_id"] = str(event.session_id) if event.session_id else None

            task_context.update_node(
                "AnalystGate",
                gate_result="passed",
                current_phase=current_phase,
                pending_requirements_count=len(pending_reqs),
                trigger_type=event.trigger_type,
                processed_at=datetime.now(timezone.utc).isoformat(),
            )

            logger.info(
                f"AnalystGate: Context loaded successfully. "
                f"Phase={current_phase}, Pending reqs={len(pending_reqs)}"
            )

            return task_context

        finally:
            db.close()
