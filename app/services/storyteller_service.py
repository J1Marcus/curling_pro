"""
Storyteller Service Module

Provides service layer operations for storyteller management including
CRUD operations, boundary management, preference handling, and progress tracking.
"""

import logging
from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from database.models import (
    Storyteller,
    StorytellerBoundary,
    StorytellerPreference,
    StorytellerProgress,
)

logger = logging.getLogger(__name__)


class StorytellerService:
    """Service for managing storyteller operations.

    Provides methods for creating, reading, updating, and managing
    storytellers including their boundaries, preferences, and progress.
    """

    def __init__(self, db: Session):
        """Initialize service with database session.

        Args:
            db: SQLAlchemy database session
        """
        self.db = db

    # =========================================================================
    # Core CRUD Operations
    # =========================================================================

    def create(
        self,
        *,
        user_id: Optional[UUID] = None,
        first_name: Optional[str] = None,
        last_name: Optional[str] = None,
        preferred_name: Optional[str] = None,
        birth_year: Optional[int] = None,
        birth_place: Optional[str] = None,
        relationship_to_user: str = "self",
    ) -> Storyteller:
        """Create a new storyteller.

        Args:
            user_id: Optional user ID who owns this storyteller
            first_name: First name
            last_name: Last name
            preferred_name: What they like to be called
            birth_year: Year of birth
            birth_place: Birth location
            relationship_to_user: Relationship type (self, parent, etc.)

        Returns:
            Created Storyteller instance
        """
        storyteller = Storyteller(
            user_id=user_id,
            first_name=first_name,
            last_name=last_name,
            preferred_name=preferred_name,
            birth_year=birth_year,
            birth_place=birth_place,
            relationship_to_user=relationship_to_user,
        )

        self.db.add(storyteller)
        self.db.flush()

        # Create default boundary
        boundary = StorytellerBoundary(storyteller_id=storyteller.id)
        self.db.add(boundary)

        # Create default preference
        preference = StorytellerPreference(storyteller_id=storyteller.id)
        self.db.add(preference)

        # Create initial progress record
        progress = StorytellerProgress(
            storyteller_id=storyteller.id,
            current_phase="trust_setup",
            phase_status="not_started",
            overall_completion_percentage=0,
        )
        self.db.add(progress)

        self.db.flush()

        logger.info(f"Created storyteller {storyteller.id}")
        return storyteller

    def get_by_id(
        self,
        storyteller_id: UUID,
        *,
        include_boundary: bool = False,
        include_preference: bool = False,
        include_progress: bool = False,
    ) -> Optional[Storyteller]:
        """Get storyteller by ID with optional related data.

        Args:
            storyteller_id: Storyteller UUID
            include_boundary: Load boundary relationship
            include_preference: Load preference relationship
            include_progress: Load progress relationship

        Returns:
            Storyteller instance or None if not found
        """
        query = select(Storyteller).where(
            Storyteller.id == storyteller_id,
            Storyteller.deleted_at.is_(None),
        )

        if include_boundary:
            query = query.options(joinedload(Storyteller.boundary))
        if include_preference:
            query = query.options(joinedload(Storyteller.preference))
        if include_progress:
            query = query.options(joinedload(Storyteller.progress))

        result = self.db.execute(query)
        return result.unique().scalar_one_or_none()

    def get_by_user_id(
        self,
        user_id: UUID,
        *,
        include_inactive: bool = False,
    ) -> list[Storyteller]:
        """Get all storytellers for a user.

        Args:
            user_id: User UUID
            include_inactive: Include inactive storytellers

        Returns:
            List of Storyteller instances
        """
        query = select(Storyteller).where(
            Storyteller.user_id == user_id,
            Storyteller.deleted_at.is_(None),
        )

        if not include_inactive:
            query = query.where(Storyteller.is_active.is_(True))

        result = self.db.execute(query)
        return list(result.scalars().all())

    def update(
        self,
        storyteller_id: UUID,
        **updates,
    ) -> Optional[Storyteller]:
        """Update storyteller fields.

        Args:
            storyteller_id: Storyteller UUID
            **updates: Field updates to apply

        Returns:
            Updated Storyteller instance or None if not found
        """
        storyteller = self.get_by_id(storyteller_id)
        if not storyteller:
            return None

        allowed_fields = {
            "first_name",
            "middle_name",
            "last_name",
            "preferred_name",
            "birth_year",
            "birth_month",
            "birth_day",
            "birth_place",
            "is_living",
            "current_location",
            "profile_image_url",
            "is_active",
        }

        for field, value in updates.items():
            if field in allowed_fields:
                setattr(storyteller, field, value)

        self.db.flush()
        logger.info(f"Updated storyteller {storyteller_id}")
        return storyteller

    def soft_delete(self, storyteller_id: UUID) -> bool:
        """Soft delete a storyteller.

        Args:
            storyteller_id: Storyteller UUID

        Returns:
            True if deleted, False if not found
        """
        storyteller = self.get_by_id(storyteller_id)
        if not storyteller:
            return False

        storyteller.deleted_at = datetime.now()
        storyteller.is_active = False
        self.db.flush()

        logger.info(f"Soft deleted storyteller {storyteller_id}")
        return True

    # =========================================================================
    # Consent Management
    # =========================================================================

    def record_consent(self, storyteller_id: UUID) -> Optional[Storyteller]:
        """Record that storyteller gave consent.

        Args:
            storyteller_id: Storyteller UUID

        Returns:
            Updated Storyteller or None if not found
        """
        storyteller = self.get_by_id(storyteller_id)
        if not storyteller:
            return None

        storyteller.consent_given = True
        storyteller.consent_date = datetime.now()
        self.db.flush()

        logger.info(f"Recorded consent for storyteller {storyteller_id}")
        return storyteller

    # =========================================================================
    # Boundary Management
    # =========================================================================

    def get_boundary(self, storyteller_id: UUID) -> Optional[StorytellerBoundary]:
        """Get storyteller's boundary settings.

        Args:
            storyteller_id: Storyteller UUID

        Returns:
            StorytellerBoundary instance or None
        """
        query = select(StorytellerBoundary).where(
            StorytellerBoundary.storyteller_id == storyteller_id
        )
        result = self.db.execute(query)
        return result.scalar_one_or_none()

    def update_boundary(
        self,
        storyteller_id: UUID,
        **updates,
    ) -> Optional[StorytellerBoundary]:
        """Update storyteller boundary settings.

        Args:
            storyteller_id: Storyteller UUID
            **updates: Boundary field updates

        Returns:
            Updated StorytellerBoundary or None
        """
        boundary = self.get_boundary(storyteller_id)
        if not boundary:
            return None

        allowed_fields = {
            "comfortable_discussing_romance",
            "comfortable_discussing_intimacy",
            "comfortable_discussing_loss",
            "comfortable_discussing_trauma",
            "comfortable_discussing_illness",
            "comfortable_discussing_conflict",
            "comfortable_discussing_faith",
            "comfortable_discussing_finances",
            "prefers_some_private",
            "wants_explicit_warnings",
            "off_limit_topics",
            "maximum_tier_comfortable",
            "additional_notes",
        }

        for field, value in updates.items():
            if field in allowed_fields:
                setattr(boundary, field, value)

        self.db.flush()
        logger.info(f"Updated boundary for storyteller {storyteller_id}")
        return boundary

    def add_off_limit_topic(
        self,
        storyteller_id: UUID,
        topic: str,
    ) -> Optional[StorytellerBoundary]:
        """Add a topic to off-limits list.

        Args:
            storyteller_id: Storyteller UUID
            topic: Topic to add

        Returns:
            Updated StorytellerBoundary or None
        """
        boundary = self.get_boundary(storyteller_id)
        if not boundary:
            return None

        current_topics = boundary.off_limit_topics or []
        if topic not in current_topics:
            boundary.off_limit_topics = current_topics + [topic]
            self.db.flush()

        return boundary

    # =========================================================================
    # Preference Management
    # =========================================================================

    def get_preference(self, storyteller_id: UUID) -> Optional[StorytellerPreference]:
        """Get storyteller's preferences.

        Args:
            storyteller_id: Storyteller UUID

        Returns:
            StorytellerPreference instance or None
        """
        query = select(StorytellerPreference).where(
            StorytellerPreference.storyteller_id == storyteller_id
        )
        result = self.db.execute(query)
        return result.scalar_one_or_none()

    def update_preference(
        self,
        storyteller_id: UUID,
        **updates,
    ) -> Optional[StorytellerPreference]:
        """Update storyteller preferences.

        Args:
            storyteller_id: Storyteller UUID
            **updates: Preference field updates

        Returns:
            Updated StorytellerPreference or None
        """
        preference = self.get_preference(storyteller_id)
        if not preference:
            return None

        allowed_fields = {
            "preferred_input_method",
            "session_length_preference",
            "desired_book_tone",
            "desired_book_length",
            "wants_photos_included",
            "wants_documents_included",
            "wants_letters_quotes_included",
            "intended_audience",
            "primary_language",
            "additional_preferences",
        }

        for field, value in updates.items():
            if field in allowed_fields:
                setattr(preference, field, value)

        self.db.flush()
        logger.info(f"Updated preference for storyteller {storyteller_id}")
        return preference

    # =========================================================================
    # Progress Tracking
    # =========================================================================

    def get_progress(self, storyteller_id: UUID) -> Optional[StorytellerProgress]:
        """Get storyteller's progress record.

        Args:
            storyteller_id: Storyteller UUID

        Returns:
            StorytellerProgress instance or None
        """
        query = select(StorytellerProgress).where(
            StorytellerProgress.storyteller_id == storyteller_id
        )
        result = self.db.execute(query)
        return result.scalar_one_or_none()

    def update_progress(
        self,
        storyteller_id: UUID,
        *,
        current_phase: Optional[str] = None,
        phase_status: Optional[str] = None,
        overall_completion_percentage: Optional[int] = None,
        suggested_next_phase: Optional[str] = None,
        suggested_next_action: Optional[str] = None,
    ) -> Optional[StorytellerProgress]:
        """Update storyteller progress.

        Args:
            storyteller_id: Storyteller UUID
            current_phase: Current phase name
            phase_status: Phase status
            overall_completion_percentage: Completion percentage
            suggested_next_phase: Suggested next phase
            suggested_next_action: Suggested next action

        Returns:
            Updated StorytellerProgress or None
        """
        progress = self.get_progress(storyteller_id)
        if not progress:
            return None

        if current_phase is not None:
            progress.current_phase = current_phase
        if phase_status is not None:
            progress.phase_status = phase_status
        if overall_completion_percentage is not None:
            progress.overall_completion_percentage = overall_completion_percentage
        if suggested_next_phase is not None:
            progress.suggested_next_phase = suggested_next_phase
        if suggested_next_action is not None:
            progress.suggested_next_action = suggested_next_action

        progress.last_active_at = datetime.now()
        self.db.flush()

        logger.info(f"Updated progress for storyteller {storyteller_id}")
        return progress

    def mark_phase_completed(
        self,
        storyteller_id: UUID,
        phase: str,
    ) -> Optional[StorytellerProgress]:
        """Mark a phase as completed.

        Args:
            storyteller_id: Storyteller UUID
            phase: Phase name to mark complete

        Returns:
            Updated StorytellerProgress or None
        """
        progress = self.get_progress(storyteller_id)
        if not progress:
            return None

        current_completed = progress.phases_completed or []
        if phase not in current_completed:
            progress.phases_completed = current_completed + [phase]

        progress.last_active_at = datetime.now()
        self.db.flush()

        logger.info(f"Marked phase {phase} completed for storyteller {storyteller_id}")
        return progress

    def increment_session_count(
        self,
        storyteller_id: UUID,
    ) -> Optional[StorytellerProgress]:
        """Increment the session count.

        Args:
            storyteller_id: Storyteller UUID

        Returns:
            Updated StorytellerProgress or None
        """
        progress = self.get_progress(storyteller_id)
        if not progress:
            return None

        progress.total_sessions_count = (progress.total_sessions_count or 0) + 1
        progress.last_active_at = datetime.now()

        if not progress.first_session_at:
            progress.first_session_at = datetime.now()

        self.db.flush()
        return progress

    def increment_interactions_count(
        self,
        storyteller_id: UUID,
        count: int = 1,
    ) -> Optional[StorytellerProgress]:
        """Increment the interactions count.

        Args:
            storyteller_id: Storyteller UUID
            count: Number to increment by

        Returns:
            Updated StorytellerProgress or None
        """
        progress = self.get_progress(storyteller_id)
        if not progress:
            return None

        progress.total_interactions_count = (
            progress.total_interactions_count or 0
        ) + count
        progress.last_active_at = datetime.now()
        self.db.flush()

        return progress

    # =========================================================================
    # Query Helpers
    # =========================================================================

    def get_full_context(self, storyteller_id: UUID) -> Optional[dict]:
        """Get full storyteller context for workflows.

        Returns storyteller with boundary, preference, and progress
        as a dictionary suitable for workflow context.

        Args:
            storyteller_id: Storyteller UUID

        Returns:
            Dictionary with storyteller context or None
        """
        storyteller = self.get_by_id(
            storyteller_id,
            include_boundary=True,
            include_preference=True,
            include_progress=True,
        )

        if not storyteller:
            return None

        return {
            "storyteller": {
                "id": str(storyteller.id),
                "first_name": storyteller.first_name,
                "last_name": storyteller.last_name,
                "preferred_name": storyteller.preferred_name,
                "birth_year": storyteller.birth_year,
                "is_living": storyteller.is_living,
                "consent_given": storyteller.consent_given,
            },
            "boundary": {
                "comfortable_discussing_romance": storyteller.boundary.comfortable_discussing_romance
                if storyteller.boundary
                else True,
                "comfortable_discussing_intimacy": storyteller.boundary.comfortable_discussing_intimacy
                if storyteller.boundary
                else False,
                "comfortable_discussing_loss": storyteller.boundary.comfortable_discussing_loss
                if storyteller.boundary
                else True,
                "comfortable_discussing_trauma": storyteller.boundary.comfortable_discussing_trauma
                if storyteller.boundary
                else False,
                "off_limit_topics": storyteller.boundary.off_limit_topics
                if storyteller.boundary
                else [],
                "maximum_tier_comfortable": storyteller.boundary.maximum_tier_comfortable
                if storyteller.boundary
                else 2,
            }
            if storyteller.boundary
            else None,
            "preference": {
                "preferred_input_method": storyteller.preference.preferred_input_method
                if storyteller.preference
                else "voice",
                "session_length_preference": storyteller.preference.session_length_preference
                if storyteller.preference
                else "medium",
                "desired_book_tone": storyteller.preference.desired_book_tone
                if storyteller.preference
                else "conversational",
            }
            if storyteller.preference
            else None,
            "progress": {
                "current_phase": storyteller.progress[0].current_phase
                if storyteller.progress
                else "trust_setup",
                "phase_status": storyteller.progress[0].phase_status
                if storyteller.progress
                else "not_started",
                "overall_completion_percentage": storyteller.progress[
                    0
                ].overall_completion_percentage
                if storyteller.progress
                else 0,
            }
            if storyteller.progress
            else None,
        }
