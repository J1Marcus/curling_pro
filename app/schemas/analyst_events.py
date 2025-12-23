"""
Analyst Flow Event Schemas

This module defines the event schemas for Analyst Flow invocations.
The Analyst Flow is triggered after each session interaction and
determines which subflows need to run.
"""

from typing import Optional, Dict, Any, List
from uuid import UUID
from pydantic import BaseModel, Field


class AnalystEvent(BaseModel):
    """Event schema for Analyst Flow invocation.

    The Analyst Flow receives this context to determine what
    subflows should run and what requirements to create.
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

    # Trigger context
    trigger_type: str = Field(
        default="session_end",
        description="What triggered the Analyst: 'session_end', 'requirement_submitted', 'manual'",
    )
    trigger_data: Optional[Dict[str, Any]] = Field(
        None,
        description="Data from the trigger (e.g., submitted requirement)",
    )

    # Storyteller context (loaded by Analyst)
    storyteller_context: Optional[Dict[str, Any]] = Field(
        None,
        description="Full storyteller context - loaded during processing if not provided",
    )

    # Session context
    session_context: Optional[Dict[str, Any]] = Field(
        None,
        description="Session context if in active session",
    )

    # Requirement context
    pending_requirements: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Current pending requirements for this storyteller",
    )

    # Progress context
    current_phase: Optional[str] = Field(
        None,
        description="Current phase: 'trust_setup', 'grounding', 'collection', 'synthesis'",
    )
    phases_completed: List[str] = Field(
        default_factory=list,
        description="Phases already completed",
    )
