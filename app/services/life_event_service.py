"""
Life Event Service Module

Provides service layer operations for life event management.
Life events are the fundamental units of story organization,
representing significant periods, experiences, or themes.
"""

import logging
from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from database.models import (
    LifeEvent,
    LifeEventTimespan,
    LifeEventLocation,
    LifeEventParticipant,
    LifeEventDetail,
    LifeEventBoundary,
)

logger = logging.getLogger(__name__)


class LifeEventService:
    """Service for managing life events.

    Life events are the core organizing principle for story collection.
    They represent significant periods, experiences, or themes in
    the storyteller's life.
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
        storyteller_id: UUID,
        event_name: str,
        event_type: Optional[str] = None,
        description: Optional[str] = None,
        category: Optional[str] = None,
        significance_level: str = "notable",
        emotional_tone: str = "neutral",
        include_in_story: bool = True,
    ) -> LifeEvent:
        """Create a new life event.

        Args:
            storyteller_id: Storyteller UUID
            event_name: Name of the event
            event_type: Type classification
            description: Brief description
            category: Category (origins, family, work, etc.)
            significance_level: formative, major, notable, minor
            emotional_tone: joyful, difficult, mixed, neutral, transformative
            include_in_story: Whether to include in story

        Returns:
            Created LifeEvent instance
        """
        event = LifeEvent(
            storyteller_id=storyteller_id,
            event_name=event_name,
            event_type=event_type,
            description=description,
            category=category,
            significance_level=significance_level,
            emotional_tone=emotional_tone,
            include_in_story=include_in_story,
        )

        self.db.add(event)
        self.db.flush()

        logger.info(f"Created life event {event.id}: {event_name}")
        return event

    def get_by_id(
        self,
        event_id: UUID,
        *,
        include_timespans: bool = False,
        include_locations: bool = False,
        include_participants: bool = False,
        include_details: bool = False,
        include_boundary: bool = False,
    ) -> Optional[LifeEvent]:
        """Get life event by ID with optional related data.

        Args:
            event_id: Life event UUID
            include_timespans: Load timespan relationships
            include_locations: Load location relationships
            include_participants: Load participant relationships
            include_details: Load detail relationships
            include_boundary: Load boundary relationship

        Returns:
            LifeEvent instance or None
        """
        query = select(LifeEvent).where(LifeEvent.id == event_id)

        if include_timespans:
            query = query.options(joinedload(LifeEvent.timespans))
        if include_locations:
            query = query.options(joinedload(LifeEvent.locations))
        if include_participants:
            query = query.options(joinedload(LifeEvent.participants))
        if include_details:
            query = query.options(joinedload(LifeEvent.details))
        if include_boundary:
            query = query.options(joinedload(LifeEvent.boundary))

        result = self.db.execute(query)
        return result.unique().scalar_one_or_none()

    def get_by_storyteller(
        self,
        storyteller_id: UUID,
        *,
        event_type: Optional[str] = None,
        category: Optional[str] = None,
        significance_level: Optional[str] = None,
        include_in_story: Optional[bool] = None,
    ) -> list[LifeEvent]:
        """Get life events for a storyteller.

        Args:
            storyteller_id: Storyteller UUID
            event_type: Optional type filter
            category: Optional category filter
            significance_level: Optional significance filter
            include_in_story: Optional inclusion filter

        Returns:
            List of LifeEvent instances
        """
        query = select(LifeEvent).where(
            LifeEvent.storyteller_id == storyteller_id
        )

        if event_type is not None:
            query = query.where(LifeEvent.event_type == event_type)
        if category is not None:
            query = query.where(LifeEvent.category == category)
        if significance_level is not None:
            query = query.where(LifeEvent.significance_level == significance_level)
        if include_in_story is not None:
            query = query.where(LifeEvent.include_in_story == include_in_story)

        query = query.order_by(LifeEvent.display_order, LifeEvent.created_at)

        result = self.db.execute(query)
        return list(result.scalars().all())

    def update(
        self,
        event_id: UUID,
        **updates,
    ) -> Optional[LifeEvent]:
        """Update life event fields.

        Args:
            event_id: Life event UUID
            **updates: Field updates to apply

        Returns:
            Updated LifeEvent or None
        """
        event = self.get_by_id(event_id)
        if not event:
            return None

        allowed_fields = {
            "event_name",
            "event_type",
            "description",
            "category",
            "significance_level",
            "emotional_tone",
            "is_turning_point",
            "is_ongoing",
            "include_in_story",
            "include_level",
            "display_order",
        }

        for field, value in updates.items():
            if field in allowed_fields:
                setattr(event, field, value)

        self.db.flush()
        logger.info(f"Updated life event {event_id}")
        return event

    def delete(self, event_id: UUID) -> bool:
        """Delete a life event.

        Args:
            event_id: Life event UUID

        Returns:
            True if deleted, False if not found
        """
        event = self.get_by_id(event_id)
        if not event:
            return False

        self.db.delete(event)
        self.db.flush()

        logger.info(f"Deleted life event {event_id}")
        return True

    # =========================================================================
    # Timespan Management
    # =========================================================================

    def add_timespan(
        self,
        event_id: UUID,
        *,
        start_year: Optional[int] = None,
        start_month: Optional[int] = None,
        end_year: Optional[int] = None,
        end_month: Optional[int] = None,
        timespan_type: str = "primary",
        is_ongoing: bool = False,
        description: Optional[str] = None,
    ) -> Optional[LifeEventTimespan]:
        """Add a timespan to a life event.

        Args:
            event_id: Life event UUID
            start_year: Start year
            start_month: Start month
            end_year: End year
            end_month: End month
            timespan_type: primary, secondary, recurring, specific_moment
            is_ongoing: Whether this timespan is ongoing
            description: Description of timespan

        Returns:
            Created LifeEventTimespan or None
        """
        event = self.get_by_id(event_id)
        if not event:
            return None

        # Get next order index
        query = (
            select(LifeEventTimespan)
            .where(LifeEventTimespan.life_event_id == event_id)
            .order_by(LifeEventTimespan.order_index.desc())
            .limit(1)
        )
        result = self.db.execute(query)
        last = result.scalar_one_or_none()
        next_order = (last.order_index + 1) if last and last.order_index else 1

        timespan = LifeEventTimespan(
            life_event_id=event_id,
            timespan_type=timespan_type,
            start_year=start_year,
            start_month=start_month,
            end_year=end_year,
            end_month=end_month,
            is_ongoing=is_ongoing,
            description=description,
            order_index=next_order,
        )

        self.db.add(timespan)
        self.db.flush()

        return timespan

    def get_timespans(self, event_id: UUID) -> list[LifeEventTimespan]:
        """Get all timespans for a life event.

        Args:
            event_id: Life event UUID

        Returns:
            List of LifeEventTimespan instances
        """
        query = (
            select(LifeEventTimespan)
            .where(LifeEventTimespan.life_event_id == event_id)
            .order_by(LifeEventTimespan.order_index)
        )
        result = self.db.execute(query)
        return list(result.scalars().all())

    # =========================================================================
    # Location Management
    # =========================================================================

    def add_location(
        self,
        event_id: UUID,
        *,
        location_name: str,
        location_type: str = "city",
        is_primary_location: bool = False,
        description: Optional[str] = None,
    ) -> Optional[LifeEventLocation]:
        """Add a location to a life event.

        Args:
            event_id: Life event UUID
            location_name: Name of location
            location_type: city, country, region, specific_place
            is_primary_location: Whether this is the main location
            description: Additional context

        Returns:
            Created LifeEventLocation or None
        """
        event = self.get_by_id(event_id)
        if not event:
            return None

        # Get next order index
        query = (
            select(LifeEventLocation)
            .where(LifeEventLocation.life_event_id == event_id)
            .order_by(LifeEventLocation.order_index.desc())
            .limit(1)
        )
        result = self.db.execute(query)
        last = result.scalar_one_or_none()
        next_order = (last.order_index + 1) if last and last.order_index else 1

        location = LifeEventLocation(
            life_event_id=event_id,
            location_name=location_name,
            location_type=location_type,
            is_primary_location=is_primary_location,
            description=description,
            order_index=next_order,
        )

        self.db.add(location)
        self.db.flush()

        return location

    def get_locations(self, event_id: UUID) -> list[LifeEventLocation]:
        """Get all locations for a life event.

        Args:
            event_id: Life event UUID

        Returns:
            List of LifeEventLocation instances
        """
        query = (
            select(LifeEventLocation)
            .where(LifeEventLocation.life_event_id == event_id)
            .order_by(LifeEventLocation.order_index)
        )
        result = self.db.execute(query)
        return list(result.scalars().all())

    # =========================================================================
    # Participant Management
    # =========================================================================

    def add_participant(
        self,
        event_id: UUID,
        *,
        first_name: Optional[str] = None,
        last_name: Optional[str] = None,
        relationship_type: Optional[str] = None,
        role_in_event: Optional[str] = None,
        significance: str = "mentioned",
        use_real_name: bool = True,
    ) -> Optional[LifeEventParticipant]:
        """Add a participant to a life event.

        Args:
            event_id: Life event UUID
            first_name: First name
            last_name: Last name
            relationship_type: spouse, child, parent, friend, etc.
            role_in_event: Role description
            significance: central, supporting, mentioned
            use_real_name: Whether to use real name in story

        Returns:
            Created LifeEventParticipant or None
        """
        event = self.get_by_id(event_id)
        if not event:
            return None

        participant = LifeEventParticipant(
            life_event_id=event_id,
            first_name=first_name,
            last_name=last_name,
            relationship_type=relationship_type,
            role_in_event=role_in_event,
            significance=significance,
            use_real_name=use_real_name,
        )

        self.db.add(participant)
        self.db.flush()

        return participant

    def get_participants(self, event_id: UUID) -> list[LifeEventParticipant]:
        """Get all participants for a life event.

        Args:
            event_id: Life event UUID

        Returns:
            List of LifeEventParticipant instances
        """
        query = select(LifeEventParticipant).where(
            LifeEventParticipant.life_event_id == event_id
        )
        result = self.db.execute(query)
        return list(result.scalars().all())

    # =========================================================================
    # Detail Management
    # =========================================================================

    def add_detail(
        self,
        event_id: UUID,
        *,
        detail_key: str,
        detail_value: str,
        detail_type: str = "text",
        display_label: Optional[str] = None,
        is_private: bool = False,
    ) -> Optional[LifeEventDetail]:
        """Add a detail to a life event.

        Args:
            event_id: Life event UUID
            detail_key: Key for the detail
            detail_value: Value of the detail
            detail_type: text, number, date, boolean, list
            display_label: User-friendly label
            is_private: Whether this is private (not for book)

        Returns:
            Created LifeEventDetail or None
        """
        event = self.get_by_id(event_id)
        if not event:
            return None

        # Get next display order
        query = (
            select(LifeEventDetail)
            .where(LifeEventDetail.life_event_id == event_id)
            .order_by(LifeEventDetail.display_order.desc())
            .limit(1)
        )
        result = self.db.execute(query)
        last = result.scalar_one_or_none()
        next_order = (last.display_order + 1) if last and last.display_order else 1

        detail = LifeEventDetail(
            life_event_id=event_id,
            detail_key=detail_key,
            detail_value=detail_value,
            detail_type=detail_type,
            display_label=display_label,
            is_private=is_private,
            display_order=next_order,
        )

        self.db.add(detail)
        self.db.flush()

        return detail

    def get_details(
        self,
        event_id: UUID,
        *,
        include_private: bool = True,
    ) -> list[LifeEventDetail]:
        """Get all details for a life event.

        Args:
            event_id: Life event UUID
            include_private: Include private details

        Returns:
            List of LifeEventDetail instances
        """
        query = select(LifeEventDetail).where(
            LifeEventDetail.life_event_id == event_id
        )

        if not include_private:
            query = query.where(LifeEventDetail.is_private.is_(False))

        query = query.order_by(LifeEventDetail.display_order)

        result = self.db.execute(query)
        return list(result.scalars().all())

    def get_detail_by_key(
        self,
        event_id: UUID,
        detail_key: str,
    ) -> Optional[LifeEventDetail]:
        """Get a specific detail by key.

        Args:
            event_id: Life event UUID
            detail_key: Key to find

        Returns:
            LifeEventDetail or None
        """
        query = select(LifeEventDetail).where(
            LifeEventDetail.life_event_id == event_id,
            LifeEventDetail.detail_key == detail_key,
        )
        result = self.db.execute(query)
        return result.scalar_one_or_none()

    def update_detail(
        self,
        event_id: UUID,
        detail_key: str,
        detail_value: str,
    ) -> Optional[LifeEventDetail]:
        """Update a detail value by key.

        Args:
            event_id: Life event UUID
            detail_key: Key to update
            detail_value: New value

        Returns:
            Updated LifeEventDetail or None
        """
        detail = self.get_detail_by_key(event_id, detail_key)
        if not detail:
            return None

        detail.detail_value = detail_value
        self.db.flush()

        return detail

    # =========================================================================
    # Boundary Management
    # =========================================================================

    def set_boundary(
        self,
        event_id: UUID,
        *,
        privacy_level: str = "limited",
        comfortable_discussing: Optional[bool] = None,
        can_mention_but_not_detail: bool = False,
        requires_pseudonyms: bool = False,
        off_limit_aspects: Optional[list[str]] = None,
    ) -> Optional[LifeEventBoundary]:
        """Set or update event-specific boundary.

        Args:
            event_id: Life event UUID
            privacy_level: public, limited, private, never_publish
            comfortable_discussing: Override storyteller default
            can_mention_but_not_detail: Mention only, no details
            requires_pseudonyms: Require pseudonyms for participants
            off_limit_aspects: Specific aspects that are off-limits

        Returns:
            LifeEventBoundary instance or None
        """
        event = self.get_by_id(event_id)
        if not event:
            return None

        # Check if boundary exists
        query = select(LifeEventBoundary).where(
            LifeEventBoundary.life_event_id == event_id
        )
        result = self.db.execute(query)
        boundary = result.scalar_one_or_none()

        if boundary:
            # Update existing
            boundary.privacy_level = privacy_level
            boundary.override_storyteller_default = True
            if comfortable_discussing is not None:
                boundary.comfortable_discussing = comfortable_discussing
            boundary.can_mention_but_not_detail = can_mention_but_not_detail
            boundary.requires_pseudonyms = requires_pseudonyms
            if off_limit_aspects:
                boundary.off_limit_aspects = off_limit_aspects
        else:
            # Create new
            boundary = LifeEventBoundary(
                life_event_id=event_id,
                override_storyteller_default=True,
                privacy_level=privacy_level,
                comfortable_discussing=comfortable_discussing,
                can_mention_but_not_detail=can_mention_but_not_detail,
                requires_pseudonyms=requires_pseudonyms,
                off_limit_aspects=off_limit_aspects,
            )
            self.db.add(boundary)

        self.db.flush()
        return boundary

    def get_boundary(self, event_id: UUID) -> Optional[LifeEventBoundary]:
        """Get event-specific boundary.

        Args:
            event_id: Life event UUID

        Returns:
            LifeEventBoundary or None
        """
        query = select(LifeEventBoundary).where(
            LifeEventBoundary.life_event_id == event_id
        )
        result = self.db.execute(query)
        return result.scalar_one_or_none()

    # =========================================================================
    # Query Helpers
    # =========================================================================

    def count_events(
        self,
        storyteller_id: UUID,
        *,
        include_in_story: Optional[bool] = None,
    ) -> int:
        """Count life events for a storyteller.

        Args:
            storyteller_id: Storyteller UUID
            include_in_story: Optional filter

        Returns:
            Number of events
        """
        events = self.get_by_storyteller(
            storyteller_id,
            include_in_story=include_in_story,
        )
        return len(events)

    def get_turning_points(
        self,
        storyteller_id: UUID,
    ) -> list[LifeEvent]:
        """Get all turning point events for a storyteller.

        Args:
            storyteller_id: Storyteller UUID

        Returns:
            List of turning point LifeEvent instances
        """
        query = select(LifeEvent).where(
            LifeEvent.storyteller_id == storyteller_id,
            LifeEvent.is_turning_point.is_(True),
        )
        result = self.db.execute(query)
        return list(result.scalars().all())

    def get_formative_events(
        self,
        storyteller_id: UUID,
    ) -> list[LifeEvent]:
        """Get all formative events for a storyteller.

        Args:
            storyteller_id: Storyteller UUID

        Returns:
            List of formative LifeEvent instances
        """
        return self.get_by_storyteller(
            storyteller_id,
            significance_level="formative",
        )

    def get_full_event(self, event_id: UUID) -> Optional[dict]:
        """Get full life event with all related data.

        Args:
            event_id: Life event UUID

        Returns:
            Dictionary with full event data or None
        """
        event = self.get_by_id(
            event_id,
            include_timespans=True,
            include_locations=True,
            include_participants=True,
            include_details=True,
            include_boundary=True,
        )

        if not event:
            return None

        return {
            "id": str(event.id),
            "event_name": event.event_name,
            "event_type": event.event_type,
            "description": event.description,
            "category": event.category,
            "significance_level": event.significance_level,
            "emotional_tone": event.emotional_tone,
            "is_turning_point": event.is_turning_point,
            "include_in_story": event.include_in_story,
            "timespans": [
                {
                    "start_year": t.start_year,
                    "end_year": t.end_year,
                    "description": t.description,
                }
                for t in event.timespans
            ]
            if event.timespans
            else [],
            "locations": [
                {
                    "location_name": loc.location_name,
                    "is_primary": loc.is_primary_location,
                }
                for loc in event.locations
            ]
            if event.locations
            else [],
            "participants": [
                {
                    "first_name": p.first_name,
                    "relationship_type": p.relationship_type,
                    "significance": p.significance,
                }
                for p in event.participants
            ]
            if event.participants
            else [],
            "details": {
                d.detail_key: d.detail_value
                for d in event.details
                if not d.is_private
            }
            if event.details
            else {},
            "boundary": {
                "privacy_level": event.boundary.privacy_level
                if event.boundary
                else "limited",
                "comfortable_discussing": event.boundary.comfortable_discussing
                if event.boundary
                else None,
            }
            if event.boundary
            else None,
        }
