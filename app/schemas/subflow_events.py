"""
Subflow Event Schemas

This module defines the event schemas for subflow invocations.
Subflows are invoked by the Analyst Flow and receive context about
the storyteller, session, and what requirements need to be addressed.
"""

from typing import Optional, Dict, Any, List
from uuid import UUID
from pydantic import BaseModel, Field


class SubflowEvent(BaseModel):
    """Base event schema for all subflow invocations.

    All subflows receive this context from the Analyst Flow
    to determine what work needs to be done.
    """

    # Core identifiers
    storyteller_id: UUID = Field(
        ...,
        description="The storyteller being worked with",
    )
    session_id: Optional[UUID] = Field(
        None,
        description="The current VAPI session if one is active",
    )

    # Storyteller context
    storyteller_context: Dict[str, Any] = Field(
        default_factory=dict,
        description="Full storyteller context from StorytellerService.get_full_context()",
    )

    # Requirement context
    requirement_id: Optional[UUID] = Field(
        None,
        description="The specific requirement being addressed, if any",
    )
    requirement_type: Optional[str] = Field(
        None,
        description="Type of requirement to address",
    )

    # Session context
    session_context: Optional[Dict[str, Any]] = Field(
        None,
        description="Session context from SessionService.get_session_context() if in session",
    )

    # Recent interactions for conversation context
    recent_interactions: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Recent session interactions for conversation continuity",
    )

    # Analyst decision context
    analyst_reasoning: Optional[str] = Field(
        None,
        description="Why the Analyst chose to invoke this subflow",
    )


class TrustBuildingEvent(SubflowEvent):
    """Event schema for Trust Building Subflow.

    Trust Building establishes comfort and rapport with the storyteller.
    It handles introduction, subject clarification, scope selection,
    and gentle profile building.
    """

    # Trust-specific context
    is_first_session: bool = Field(
        default=True,
        description="Whether this is the storyteller's first session",
    )

    completed_trust_steps: List[str] = Field(
        default_factory=list,
        description="Trust steps already completed: 'introduction', 'subject_clarification', 'scope_selection', 'gentle_profile'",
    )

    # Current trust state
    current_trust_step: Optional[str] = Field(
        None,
        description="The current trust step to work on",
    )

    # Boundary context (already captured or defaults)
    known_boundaries: Optional[Dict[str, Any]] = Field(
        None,
        description="Known boundaries from storyteller profile",
    )


class ContextualGroundingEvent(SubflowEvent):
    """Event schema for Contextual Grounding Subflow.

    Contextual Grounding surfaces life events and builds the
    storyteller's timeline and life map.
    """

    # Already identified life events
    known_life_events: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Life events already captured",
    )

    # Focus area if specified
    focus_area: Optional[str] = Field(
        None,
        description="Specific area to explore: 'childhood', 'career', 'family', etc.",
    )


class SectionSelectionEvent(SubflowEvent):
    """Event schema for Section Selection Subflow.

    Section Selection uses archetype analysis to choose which
    story sections to focus on.
    """

    # Archetype context
    detected_archetypes: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Archetypes detected from previous sessions",
    )

    # Sections already selected
    selected_sections: List[str] = Field(
        default_factory=list,
        description="Sections already selected for the book",
    )


class LaneDevelopmentEvent(SubflowEvent):
    """Event schema for Lane Development Subflow.

    Lane Development is THE ENGINE - it runs VAPI sessions
    to capture deep story content for specific sections.
    """

    # Target section
    target_section: str = Field(
        ...,
        description="The section being developed",
    )

    # Life event to explore
    life_event_id: Optional[UUID] = Field(
        None,
        description="Specific life event to explore",
    )

    # Development depth
    development_depth: str = Field(
        default="exploration",
        description="Depth: 'introduction', 'exploration', 'deep_dive', 'completion'",
    )

    # VAPI session config
    vapi_session_duration_minutes: int = Field(
        default=30,
        description="Target session duration",
    )
