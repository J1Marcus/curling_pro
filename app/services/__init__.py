"""
Services Package

This package provides the service layer for the Everbound backend.
Services encapsulate business logic and database operations,
providing a clean interface for workflows and API endpoints.

Usage:
    from services import StorytellerService, RequirementService

    # With a database session
    storyteller_service = StorytellerService(db)
    storyteller = storyteller_service.create(
        first_name="John",
        last_name="Doe",
    )

Services:
    - StorytellerService: Storyteller CRUD, boundaries, preferences, progress
    - RequirementService: Requirement management for analyst flow
    - SessionService: VAPI session lifecycle and interaction tracking
    - LifeEventService: Life event CRUD with related data
"""

from services.storyteller_service import StorytellerService
from services.requirement_service import RequirementService
from services.session_service import SessionService
from services.life_event_service import LifeEventService

__all__ = [
    "StorytellerService",
    "RequirementService",
    "SessionService",
    "LifeEventService",
]
