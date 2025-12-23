"""
Introduction Node

Handles the introduction step of Trust Building.
This node manages the warm welcome and initial rapport building
when a storyteller first engages with the system.
"""

import logging
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from pydantic import BaseModel

from core.nodes.base import Node
from core.task import TaskContext
from schemas.subflow_events import TrustBuildingEvent

logger = logging.getLogger(__name__)


class IntroductionOutput(BaseModel):
    """Output from Introduction Node."""

    step_completed: bool
    storyteller_name: Optional[str]
    preferred_name: Optional[str]
    relationship_established: bool
    introduction_message: Optional[str]
    notes: Optional[str]
    processed_at: str


class IntroductionNode(Node):
    """Handles the introduction step of Trust Building.

    This node:
    1. Extracts storyteller name and preferred name
    2. Creates a warm welcome message
    3. Establishes initial rapport context
    4. Creates a requirement for "introduction complete" if not already done

    In a full implementation, this would integrate with VAPI to
    conduct the actual introduction conversation. For now, it
    sets up the context and creates the requirement.
    """

    async def process(self, task_context: TaskContext) -> TaskContext:
        """Process the introduction step.

        Args:
            task_context: Current task context with TrustBuildingEvent

        Returns:
            TaskContext with introduction results
        """
        event: TrustBuildingEvent = task_context.event

        # Check if this is the right step
        current_step = task_context.metadata.get("current_trust_step")
        if current_step != "introduction":
            logger.info(
                f"IntroductionNode: Skipping - current step is '{current_step}'"
            )
            task_context.update_node(
                "IntroductionNode",
                skipped=True,
                reason=f"Current step is '{current_step}', not 'introduction'",
            )
            return task_context

        logger.info(
            f"IntroductionNode: Processing introduction for storyteller {event.storyteller_id}"
        )

        # Extract storyteller info from context
        storyteller_context = event.storyteller_context or {}
        storyteller_info = storyteller_context.get("storyteller", {})

        first_name = storyteller_info.get("first_name")
        preferred_name = storyteller_info.get("preferred_name") or first_name

        # Build introduction context
        # In a real implementation, this would be passed to VAPI
        # for the actual voice conversation
        introduction_message = self._build_introduction_message(
            preferred_name=preferred_name,
            is_first_session=event.is_first_session,
        )

        logger.info(
            f"IntroductionNode: Built introduction for '{preferred_name}'"
        )

        # Create output
        output = IntroductionOutput(
            step_completed=True,
            storyteller_name=first_name,
            preferred_name=preferred_name,
            relationship_established=True,
            introduction_message=introduction_message,
            notes=f"Introduction prepared for {'first session' if event.is_first_session else 'returning'} storyteller",
            processed_at=datetime.now(timezone.utc).isoformat(),
        )

        # Save output to context
        self.save_output(output)

        # Also update node with flattened data for easy access
        task_context.update_node(
            "IntroductionNode",
            step_completed=True,
            preferred_name=preferred_name,
            introduction_ready=True,
            processed_at=datetime.now(timezone.utc).isoformat(),
        )

        # Store requirement to create (for the orchestrator to handle)
        task_context.metadata["requirement_to_create"] = {
            "requirement_name": "Introduction Complete",
            "requirement_type": "trust_building",
            "description": f"Warm introduction with {preferred_name or 'storyteller'}",
            "priority": "high",
        }

        logger.info("IntroductionNode: Introduction step completed successfully")
        return task_context

    def _build_introduction_message(
        self,
        preferred_name: Optional[str],
        is_first_session: bool,
    ) -> str:
        """Build the introduction message for VAPI.

        Args:
            preferred_name: The storyteller's preferred name
            is_first_session: Whether this is their first session

        Returns:
            Introduction message text
        """
        name_greeting = f", {preferred_name}" if preferred_name else ""

        if is_first_session:
            return (
                f"Hello{name_greeting}! I'm so glad you've decided to share your story. "
                f"I'm here to help you capture the moments and memories that matter most to you. "
                f"There's no rush, and we'll go at whatever pace feels comfortable for you. "
                f"Before we begin, I'd love to learn a little bit about what brought you here today."
            )
        else:
            return (
                f"Welcome back{name_greeting}! It's wonderful to continue our conversation. "
                f"Last time we made great progress, and I'm looking forward to learning more "
                f"about your story today."
            )
