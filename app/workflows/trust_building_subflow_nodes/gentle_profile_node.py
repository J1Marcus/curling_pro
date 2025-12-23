"""
Gentle Profile Node

Handles the gentle profile step of Trust Building.
This node gathers boundaries and preferences without pressure,
creating a comfortable starting point for story capture.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from pydantic import BaseModel

from core.nodes.base import Node
from core.task import TaskContext
from schemas.subflow_events import TrustBuildingEvent

logger = logging.getLogger(__name__)


class GentleProfileOutput(BaseModel):
    """Output from Gentle Profile Node."""

    step_completed: bool
    boundaries_captured: bool
    preferences_captured: bool
    off_limit_topics: List[str]
    comfort_levels: Dict[str, bool]
    session_preferences: Dict[str, Any]
    profile_message: Optional[str]
    notes: Optional[str]
    processed_at: str


class GentleProfileNode(Node):
    """Handles the gentle profile step of Trust Building.

    This node:
    1. Presents boundary options in a non-intrusive way
    2. Captures comfort levels for various topic areas
    3. Gathers session preferences (length, frequency, etc.)
    4. Creates requirements for any profile elements needing follow-up

    This is the final step of Trust Building. Once complete,
    the storyteller is ready for Contextual Grounding.

    Boundary Areas:
    - Romance/relationships
    - Intimacy
    - Loss/grief
    - Trauma
    - Illness
    - Family conflict
    - Faith/spirituality
    - Finances

    In a full implementation, this would integrate with VAPI to
    conduct the boundary-setting conversation.
    """

    async def process(self, task_context: TaskContext) -> TaskContext:
        """Process the gentle profile step.

        Args:
            task_context: Current task context with TrustBuildingEvent

        Returns:
            TaskContext with gentle profile results
        """
        event: TrustBuildingEvent = task_context.event

        # Check if this is the right step
        current_step = task_context.metadata.get("current_trust_step")
        if current_step != "gentle_profile":
            logger.info(
                f"GentleProfileNode: Skipping - current step is '{current_step}'"
            )
            task_context.update_node(
                "GentleProfileNode",
                skipped=True,
                reason=f"Current step is '{current_step}', not 'gentle_profile'",
            )
            return task_context

        logger.info(
            f"GentleProfileNode: Processing gentle profile "
            f"for storyteller {event.storyteller_id}"
        )

        # Extract any existing boundary/preference data
        storyteller_context = event.storyteller_context or {}
        boundary_info = storyteller_context.get("boundary", {})
        preference_info = storyteller_context.get("preference", {})

        # Extract existing comfort levels
        comfort_levels = {
            "romance": boundary_info.get("comfortable_discussing_romance", True),
            "intimacy": boundary_info.get("comfortable_discussing_intimacy", False),
            "loss": boundary_info.get("comfortable_discussing_loss", True),
            "trauma": boundary_info.get("comfortable_discussing_trauma", False),
            "illness": boundary_info.get("comfortable_discussing_illness", True),
            "conflict": boundary_info.get("comfortable_discussing_conflict", True),
            "faith": boundary_info.get("comfortable_discussing_faith", True),
            "finances": boundary_info.get("comfortable_discussing_finances", True),
        }

        off_limit_topics = boundary_info.get("off_limit_topics", [])

        # Extract session preferences
        session_preferences = {
            "input_method": preference_info.get("preferred_input_method", "voice"),
            "session_length": preference_info.get("session_length_preference", "medium"),
            "book_tone": preference_info.get("desired_book_tone", "conversational"),
        }

        # Build profile guidance message
        profile_message = self._build_profile_message()

        # For now, prepare the context for gentle profile conversation
        output = GentleProfileOutput(
            step_completed=False,  # Will be True after VAPI conversation
            boundaries_captured=len(off_limit_topics) > 0 or any(
                not v for v in comfort_levels.values()
            ),
            preferences_captured=bool(preference_info),
            off_limit_topics=off_limit_topics,
            comfort_levels=comfort_levels,
            session_preferences=session_preferences,
            profile_message=profile_message,
            notes="Awaiting boundary and preference input",
            processed_at=datetime.now(timezone.utc).isoformat(),
        )

        self.save_output(output)

        task_context.update_node(
            "GentleProfileNode",
            profile_options_presented=True,
            awaiting_input=True,
            boundaries_loaded=True,
            preferences_loaded=True,
            processed_at=datetime.now(timezone.utc).isoformat(),
        )

        # Store context for VAPI session
        task_context.metadata["profile_message"] = profile_message
        task_context.metadata["boundary_options"] = self._get_boundary_options()
        task_context.metadata["preference_options"] = self._get_preference_options()

        logger.info("GentleProfileNode: Profile options prepared, awaiting input")
        return task_context

    def _build_profile_message(self) -> str:
        """Build the gentle profile guidance message.

        Returns:
            Profile message text for VAPI
        """
        return (
            "Before we start exploring your story, I want to make sure you feel "
            "completely comfortable with our conversations. Everyone has topics "
            "that are more personal or sensitive, and it's perfectly okay to have "
            "boundaries. Are there any areas of life you'd prefer we avoid or "
            "approach carefully? For example, some people prefer not to discuss "
            "certain relationships, health matters, or financial topics. "
            "Whatever feels right for you is what we'll do."
        )

    def _get_boundary_options(self) -> List[Dict[str, Any]]:
        """Get the list of boundary options.

        Returns:
            List of boundary option dictionaries
        """
        return [
            {
                "key": "romance",
                "label": "Romance & Relationships",
                "description": "Stories about romantic relationships and dating",
                "default": True,
            },
            {
                "key": "intimacy",
                "label": "Intimacy",
                "description": "More personal or intimate aspects of relationships",
                "default": False,
            },
            {
                "key": "loss",
                "label": "Loss & Grief",
                "description": "Experiences with death and grieving",
                "default": True,
            },
            {
                "key": "trauma",
                "label": "Difficult Experiences",
                "description": "Traumatic or very challenging life events",
                "default": False,
            },
            {
                "key": "illness",
                "label": "Health & Illness",
                "description": "Medical issues and health challenges",
                "default": True,
            },
            {
                "key": "conflict",
                "label": "Family Conflict",
                "description": "Disagreements and tensions within family",
                "default": True,
            },
            {
                "key": "faith",
                "label": "Faith & Spirituality",
                "description": "Religious beliefs and spiritual experiences",
                "default": True,
            },
            {
                "key": "finances",
                "label": "Finances",
                "description": "Money, career success, and financial struggles",
                "default": True,
            },
        ]

    def _get_preference_options(self) -> Dict[str, List[Dict[str, str]]]:
        """Get the list of preference options.

        Returns:
            Dictionary of preference categories with options
        """
        return {
            "session_length": [
                {"value": "short", "label": "Short (15-20 minutes)"},
                {"value": "medium", "label": "Medium (30-45 minutes)"},
                {"value": "long", "label": "Long (60+ minutes)"},
            ],
            "book_tone": [
                {"value": "formal", "label": "Formal & Literary"},
                {"value": "conversational", "label": "Conversational & Warm"},
                {"value": "humorous", "label": "Light & Humorous"},
            ],
            "input_method": [
                {"value": "voice", "label": "Voice Conversations"},
                {"value": "text", "label": "Text Chat"},
                {"value": "mixed", "label": "Mix of Both"},
            ],
        }
