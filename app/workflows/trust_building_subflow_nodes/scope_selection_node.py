"""
Scope Selection Node

Handles the scope selection step of Trust Building.
This node helps the storyteller define what scope of their life
they want to capture: whole life, major chapter, or single event.
"""

import logging
from datetime import datetime, timezone
from typing import Optional, List

from pydantic import BaseModel

from core.nodes.base import Node
from core.task import TaskContext
from schemas.subflow_events import TrustBuildingEvent

logger = logging.getLogger(__name__)


class ScopeSelectionOutput(BaseModel):
    """Output from Scope Selection Node."""

    step_completed: bool
    scope_type: Optional[str]
    scope_description: Optional[str]
    focus_areas: List[str]
    guidance_message: Optional[str]
    processed_at: str


class ScopeSelectionNode(Node):
    """Handles the scope selection step of Trust Building.

    This node:
    1. Presents scope options to the storyteller
    2. Captures their scope preference
    3. Records focus areas they want to explore
    4. Creates context for subsequent story capture

    Scope Types:
    - whole_life: Complete life story from birth to present
    - major_chapter: Significant period (career, marriage, etc.)
    - single_event: One specific meaningful event
    - unsure: Let the process guide scope discovery

    In a full implementation, this would integrate with VAPI to
    conduct the scope selection conversation.
    """

    async def process(self, task_context: TaskContext) -> TaskContext:
        """Process the scope selection step.

        Args:
            task_context: Current task context with TrustBuildingEvent

        Returns:
            TaskContext with scope selection results
        """
        event: TrustBuildingEvent = task_context.event

        # Check if this is the right step
        current_step = task_context.metadata.get("current_trust_step")
        if current_step != "scope_selection":
            logger.info(
                f"ScopeSelectionNode: Skipping - current step is '{current_step}'"
            )
            task_context.update_node(
                "ScopeSelectionNode",
                skipped=True,
                reason=f"Current step is '{current_step}', not 'scope_selection'",
            )
            return task_context

        logger.info(
            f"ScopeSelectionNode: Processing scope selection for storyteller {event.storyteller_id}"
        )

        # Extract any existing scope from session context
        session_context = event.session_context or {}
        existing_scope = session_context.get("scope", {})

        # Build scope guidance message
        guidance_message = self._build_scope_guidance()

        # For now, we prepare the context for scope selection
        # In a real implementation, VAPI would conduct this conversation
        # and call back with the storyteller's selection

        output = ScopeSelectionOutput(
            step_completed=False,  # Will be True after VAPI conversation
            scope_type=existing_scope.get("scope_type"),
            scope_description=existing_scope.get("scope_description"),
            focus_areas=existing_scope.get("focus_areas", []),
            guidance_message=guidance_message,
            processed_at=datetime.now(timezone.utc).isoformat(),
        )

        self.save_output(output)

        task_context.update_node(
            "ScopeSelectionNode",
            scope_options_presented=True,
            awaiting_selection=True,
            guidance_ready=True,
            processed_at=datetime.now(timezone.utc).isoformat(),
        )

        # Store context for VAPI session
        task_context.metadata["scope_guidance"] = guidance_message
        task_context.metadata["scope_options"] = [
            {
                "type": "whole_life",
                "label": "My Whole Life Story",
                "description": "From childhood to now, capturing the full journey",
            },
            {
                "type": "major_chapter",
                "label": "A Major Chapter",
                "description": "A significant period like career, family life, or adventure",
            },
            {
                "type": "single_event",
                "label": "One Special Moment",
                "description": "A specific event that changed everything",
            },
            {
                "type": "unsure",
                "label": "I'm Not Sure Yet",
                "description": "Let's explore together and see what emerges",
            },
        ]

        logger.info("ScopeSelectionNode: Scope options prepared, awaiting selection")
        return task_context

    def _build_scope_guidance(self) -> str:
        """Build the scope selection guidance message.

        Returns:
            Guidance message text for VAPI
        """
        return (
            "Now I'd love to understand what scope of your story you'd like to capture. "
            "There's no wrong answer here - every story is valuable. "
            "Would you like to share your whole life journey, focus on a major chapter "
            "like your career or family life, or perhaps there's one special moment "
            "that you'd like to explore deeply? "
            "If you're not sure yet, that's perfectly okay too - we can discover together."
        )
