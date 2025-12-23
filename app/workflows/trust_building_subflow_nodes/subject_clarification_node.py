"""
Subject Clarification Node

Handles the subject clarification step of Trust Building.
This node clarifies who the book/story is about - it may differ
from the storyteller (e.g., capturing a parent's story).
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel

from core.nodes.base import Node
from core.task import TaskContext
from schemas.subflow_events import TrustBuildingEvent

logger = logging.getLogger(__name__)


class SubjectClarificationOutput(BaseModel):
    """Output from Subject Clarification Node."""

    step_completed: bool
    subject_is_storyteller: bool
    subject_name: Optional[str]
    subject_relationship: Optional[str]
    clarification_message: Optional[str]
    notes: Optional[str]
    processed_at: str


class SubjectClarificationNode(Node):
    """Handles the subject clarification step of Trust Building.

    This node:
    1. Asks if the memoir is about the storyteller or someone else
    2. If someone else, captures who (name and relationship)
    3. Sets up context for story capture appropriate to the subject
    4. Creates a requirement for subject clarification if not complete

    Subject Types:
    - self: The storyteller is writing about their own life
    - other: The storyteller is capturing someone else's story
              (e.g., interviewing a parent, spouse, or friend)

    In a full implementation, this would integrate with VAPI to
    conduct the actual clarification conversation.
    """

    async def process(self, task_context: TaskContext) -> TaskContext:
        """Process the subject clarification step.

        Args:
            task_context: Current task context with TrustBuildingEvent

        Returns:
            TaskContext with subject clarification results
        """
        event: TrustBuildingEvent = task_context.event

        # Check if this is the right step
        current_step = task_context.metadata.get("current_trust_step")
        if current_step != "subject_clarification":
            logger.info(
                f"SubjectClarificationNode: Skipping - current step is '{current_step}'"
            )
            task_context.update_node(
                "SubjectClarificationNode",
                skipped=True,
                reason=f"Current step is '{current_step}', not 'subject_clarification'",
            )
            return task_context

        logger.info(
            f"SubjectClarificationNode: Processing subject clarification "
            f"for storyteller {event.storyteller_id}"
        )

        # Extract storyteller info from context
        storyteller_context = event.storyteller_context or {}
        storyteller_info = storyteller_context.get("storyteller", {})

        # Check if subject already determined
        session_context = event.session_context or {}
        existing_subject = session_context.get("subject", {})

        subject_is_storyteller = existing_subject.get("subject_is_storyteller", True)
        subject_name = existing_subject.get("subject_name")
        subject_relationship = existing_subject.get("subject_relationship")

        # Build clarification message for VAPI
        clarification_message = self._build_clarification_message(
            storyteller_name=storyteller_info.get("preferred_name")
            or storyteller_info.get("first_name")
        )

        # For now, we prepare the context for subject clarification
        # In a real implementation, VAPI would conduct this conversation
        output = SubjectClarificationOutput(
            step_completed=False,  # Will be True after VAPI conversation
            subject_is_storyteller=subject_is_storyteller,
            subject_name=subject_name,
            subject_relationship=subject_relationship,
            clarification_message=clarification_message,
            notes="Awaiting clarification from storyteller",
            processed_at=datetime.now(timezone.utc).isoformat(),
        )

        self.save_output(output)

        task_context.update_node(
            "SubjectClarificationNode",
            clarification_presented=True,
            awaiting_response=True,
            subject_is_storyteller=subject_is_storyteller,
            processed_at=datetime.now(timezone.utc).isoformat(),
        )

        # Store context for VAPI session
        task_context.metadata["subject_clarification_message"] = clarification_message
        task_context.metadata["subject_options"] = [
            {
                "type": "self",
                "label": "My Own Story",
                "description": "This memoir is about my own life and experiences",
            },
            {
                "type": "other",
                "label": "Someone Else's Story",
                "description": "I'm helping capture another person's life story",
            },
        ]

        logger.info(
            "SubjectClarificationNode: Clarification prepared, awaiting response"
        )
        return task_context

    def _build_clarification_message(
        self,
        storyteller_name: Optional[str],
    ) -> str:
        """Build the subject clarification message for VAPI.

        Args:
            storyteller_name: The storyteller's name

        Returns:
            Clarification message text
        """
        name_part = f", {storyteller_name}" if storyteller_name else ""

        return (
            f"Thank you{name_part}. Before we go further, I'd love to understand "
            f"whose story we'll be capturing today. Are we going to be exploring "
            f"your own life story, or are you here to help preserve someone else's "
            f"memories - perhaps a parent, grandparent, or someone close to you?"
        )
