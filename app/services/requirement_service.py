"""
Requirement Service Module

Provides service layer operations for requirement management.
Requirements drive the analyst flow by tracking what needs to be
captured, validated, or processed during story collection.
"""

import logging
from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import select, and_, or_
from sqlalchemy.orm import Session

from database.models import Requirement

logger = logging.getLogger(__name__)


class RequirementService:
    """Service for managing requirements.

    Requirements are the core work items that drive the analyst flow.
    Each subflow creates requirements that need to be fulfilled,
    and the analyst determines which requirements to work on next.
    """

    def __init__(self, db: Session):
        """Initialize service with database session.

        Args:
            db: SQLAlchemy database session
        """
        self.db = db

    # =========================================================================
    # Status Constants
    # =========================================================================

    STATUS_PENDING = "pending"
    STATUS_IN_PROGRESS = "in_progress"
    STATUS_COMPLETED = "completed"
    STATUS_SKIPPED = "skipped"

    PRIORITY_CRITICAL = "critical"
    PRIORITY_HIGH = "high"
    PRIORITY_MEDIUM = "medium"
    PRIORITY_LOW = "low"

    PRIORITY_ORDER = {
        PRIORITY_CRITICAL: 0,
        PRIORITY_HIGH: 1,
        PRIORITY_MEDIUM: 2,
        PRIORITY_LOW: 3,
    }

    # =========================================================================
    # Core CRUD Operations
    # =========================================================================

    def create(
        self,
        *,
        storyteller_id: UUID,
        requirement_name: str,
        requirement_type: Optional[str] = None,
        description: Optional[str] = None,
        priority: str = "medium",
        is_required: bool = True,
        process_section_id: Optional[UUID] = None,
        life_event_id: Optional[UUID] = None,
        collection_id: Optional[UUID] = None,
        session_id: Optional[UUID] = None,
    ) -> Requirement:
        """Create a new requirement.

        Args:
            storyteller_id: Storyteller UUID
            requirement_name: Name/title of the requirement
            requirement_type: Type classification
            description: Detailed description
            priority: Priority level (critical, high, medium, low)
            is_required: Whether this is mandatory
            process_section_id: Optional linked process section
            life_event_id: Optional linked life event
            collection_id: Optional linked collection
            session_id: Optional linked session

        Returns:
            Created Requirement instance
        """
        requirement = Requirement(
            storyteller_id=storyteller_id,
            requirement_name=requirement_name,
            requirement_type=requirement_type,
            description=description,
            priority=priority,
            is_required=is_required,
            status=self.STATUS_PENDING,
            process_section_id=process_section_id,
            life_event_id=life_event_id,
            collection_id=collection_id,
            session_id=session_id,
        )

        self.db.add(requirement)
        self.db.flush()

        logger.info(
            f"Created requirement {requirement.id}: {requirement_name} "
            f"for storyteller {storyteller_id}"
        )
        return requirement

    def get_by_id(self, requirement_id: UUID) -> Optional[Requirement]:
        """Get requirement by ID.

        Args:
            requirement_id: Requirement UUID

        Returns:
            Requirement instance or None
        """
        query = select(Requirement).where(Requirement.id == requirement_id)
        result = self.db.execute(query)
        return result.scalar_one_or_none()

    def update(
        self,
        requirement_id: UUID,
        **updates,
    ) -> Optional[Requirement]:
        """Update requirement fields.

        Args:
            requirement_id: Requirement UUID
            **updates: Field updates to apply

        Returns:
            Updated Requirement or None
        """
        requirement = self.get_by_id(requirement_id)
        if not requirement:
            return None

        allowed_fields = {
            "requirement_name",
            "requirement_type",
            "description",
            "priority",
            "is_required",
            "completion_notes",
        }

        for field, value in updates.items():
            if field in allowed_fields:
                setattr(requirement, field, value)

        self.db.flush()
        logger.info(f"Updated requirement {requirement_id}")
        return requirement

    def delete(self, requirement_id: UUID) -> bool:
        """Delete a requirement.

        Args:
            requirement_id: Requirement UUID

        Returns:
            True if deleted, False if not found
        """
        requirement = self.get_by_id(requirement_id)
        if not requirement:
            return False

        self.db.delete(requirement)
        self.db.flush()

        logger.info(f"Deleted requirement {requirement_id}")
        return True

    # =========================================================================
    # Status Transitions
    # =========================================================================

    def mark_in_progress(
        self,
        requirement_id: UUID,
    ) -> Optional[Requirement]:
        """Mark requirement as in progress.

        Args:
            requirement_id: Requirement UUID

        Returns:
            Updated Requirement or None
        """
        requirement = self.get_by_id(requirement_id)
        if not requirement:
            return None

        if requirement.status != self.STATUS_PENDING:
            logger.warning(
                f"Requirement {requirement_id} is not pending, "
                f"current status: {requirement.status}"
            )

        requirement.status = self.STATUS_IN_PROGRESS
        self.db.flush()

        logger.info(f"Marked requirement {requirement_id} as in_progress")
        return requirement

    def mark_completed(
        self,
        requirement_id: UUID,
        completion_notes: Optional[str] = None,
    ) -> Optional[Requirement]:
        """Mark requirement as completed.

        Args:
            requirement_id: Requirement UUID
            completion_notes: Optional notes about completion

        Returns:
            Updated Requirement or None
        """
        requirement = self.get_by_id(requirement_id)
        if not requirement:
            return None

        requirement.status = self.STATUS_COMPLETED
        requirement.completed_at = datetime.now()
        if completion_notes:
            requirement.completion_notes = completion_notes

        self.db.flush()

        logger.info(f"Marked requirement {requirement_id} as completed")
        return requirement

    def mark_skipped(
        self,
        requirement_id: UUID,
        reason: Optional[str] = None,
    ) -> Optional[Requirement]:
        """Mark requirement as skipped.

        Args:
            requirement_id: Requirement UUID
            reason: Reason for skipping

        Returns:
            Updated Requirement or None
        """
        requirement = self.get_by_id(requirement_id)
        if not requirement:
            return None

        requirement.status = self.STATUS_SKIPPED
        requirement.completed_at = datetime.now()
        if reason:
            requirement.completion_notes = f"Skipped: {reason}"

        self.db.flush()

        logger.info(f"Marked requirement {requirement_id} as skipped")
        return requirement

    def reset_to_pending(
        self,
        requirement_id: UUID,
    ) -> Optional[Requirement]:
        """Reset requirement back to pending status.

        Args:
            requirement_id: Requirement UUID

        Returns:
            Updated Requirement or None
        """
        requirement = self.get_by_id(requirement_id)
        if not requirement:
            return None

        requirement.status = self.STATUS_PENDING
        requirement.completed_at = None
        requirement.completion_notes = None
        self.db.flush()

        logger.info(f"Reset requirement {requirement_id} to pending")
        return requirement

    # =========================================================================
    # Query Methods
    # =========================================================================

    def get_by_storyteller(
        self,
        storyteller_id: UUID,
        *,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        requirement_type: Optional[str] = None,
        is_required: Optional[bool] = None,
    ) -> list[Requirement]:
        """Get requirements for a storyteller with optional filters.

        Args:
            storyteller_id: Storyteller UUID
            status: Filter by status
            priority: Filter by priority
            requirement_type: Filter by type
            is_required: Filter by required flag

        Returns:
            List of matching Requirements
        """
        query = select(Requirement).where(
            Requirement.storyteller_id == storyteller_id
        )

        if status is not None:
            query = query.where(Requirement.status == status)
        if priority is not None:
            query = query.where(Requirement.priority == priority)
        if requirement_type is not None:
            query = query.where(Requirement.requirement_type == requirement_type)
        if is_required is not None:
            query = query.where(Requirement.is_required == is_required)

        query = query.order_by(Requirement.created_at)

        result = self.db.execute(query)
        return list(result.scalars().all())

    def get_pending(
        self,
        storyteller_id: UUID,
        *,
        priority: Optional[str] = None,
        requirement_type: Optional[str] = None,
    ) -> list[Requirement]:
        """Get pending requirements for a storyteller.

        Args:
            storyteller_id: Storyteller UUID
            priority: Optional priority filter
            requirement_type: Optional type filter

        Returns:
            List of pending Requirements
        """
        return self.get_by_storyteller(
            storyteller_id,
            status=self.STATUS_PENDING,
            priority=priority,
            requirement_type=requirement_type,
        )

    def get_in_progress(
        self,
        storyteller_id: UUID,
    ) -> list[Requirement]:
        """Get in-progress requirements for a storyteller.

        Args:
            storyteller_id: Storyteller UUID

        Returns:
            List of in-progress Requirements
        """
        return self.get_by_storyteller(
            storyteller_id,
            status=self.STATUS_IN_PROGRESS,
        )

    def get_next_requirement(
        self,
        storyteller_id: UUID,
        *,
        requirement_type: Optional[str] = None,
    ) -> Optional[Requirement]:
        """Get the next highest priority pending requirement.

        Priority order: critical > high > medium > low
        Within same priority, oldest first.

        Args:
            storyteller_id: Storyteller UUID
            requirement_type: Optional type filter

        Returns:
            Next Requirement to work on or None
        """
        pending = self.get_pending(
            storyteller_id,
            requirement_type=requirement_type,
        )

        if not pending:
            return None

        # Sort by priority (using PRIORITY_ORDER) then by created_at
        sorted_requirements = sorted(
            pending,
            key=lambda r: (
                self.PRIORITY_ORDER.get(r.priority, 99),
                r.created_at or datetime.min,
            ),
        )

        return sorted_requirements[0] if sorted_requirements else None

    def get_by_section(
        self,
        storyteller_id: UUID,
        process_section_id: UUID,
        *,
        status: Optional[str] = None,
    ) -> list[Requirement]:
        """Get requirements linked to a specific process section.

        Args:
            storyteller_id: Storyteller UUID
            process_section_id: Process section UUID
            status: Optional status filter

        Returns:
            List of Requirements for that section
        """
        query = select(Requirement).where(
            and_(
                Requirement.storyteller_id == storyteller_id,
                Requirement.process_section_id == process_section_id,
            )
        )

        if status is not None:
            query = query.where(Requirement.status == status)

        result = self.db.execute(query)
        return list(result.scalars().all())

    def get_by_session(
        self,
        session_id: UUID,
        *,
        status: Optional[str] = None,
    ) -> list[Requirement]:
        """Get requirements created in a specific session.

        Args:
            session_id: Session UUID
            status: Optional status filter

        Returns:
            List of Requirements from that session
        """
        query = select(Requirement).where(Requirement.session_id == session_id)

        if status is not None:
            query = query.where(Requirement.status == status)

        result = self.db.execute(query)
        return list(result.scalars().all())

    # =========================================================================
    # Batch Operations
    # =========================================================================

    def create_batch(
        self,
        storyteller_id: UUID,
        requirements: list[dict],
    ) -> list[Requirement]:
        """Create multiple requirements at once.

        Args:
            storyteller_id: Storyteller UUID
            requirements: List of requirement dicts with fields:
                - requirement_name (required)
                - requirement_type
                - description
                - priority
                - is_required
                - process_section_id
                - life_event_id
                - collection_id
                - session_id

        Returns:
            List of created Requirements
        """
        created = []
        for req_data in requirements:
            req = self.create(
                storyteller_id=storyteller_id,
                requirement_name=req_data["requirement_name"],
                requirement_type=req_data.get("requirement_type"),
                description=req_data.get("description"),
                priority=req_data.get("priority", self.PRIORITY_MEDIUM),
                is_required=req_data.get("is_required", True),
                process_section_id=req_data.get("process_section_id"),
                life_event_id=req_data.get("life_event_id"),
                collection_id=req_data.get("collection_id"),
                session_id=req_data.get("session_id"),
            )
            created.append(req)

        logger.info(
            f"Created {len(created)} requirements for storyteller {storyteller_id}"
        )
        return created

    def complete_all_of_type(
        self,
        storyteller_id: UUID,
        requirement_type: str,
        completion_notes: Optional[str] = None,
    ) -> int:
        """Mark all requirements of a type as completed.

        Args:
            storyteller_id: Storyteller UUID
            requirement_type: Type to complete
            completion_notes: Optional notes

        Returns:
            Number of requirements completed
        """
        requirements = self.get_by_storyteller(
            storyteller_id,
            requirement_type=requirement_type,
            status=self.STATUS_PENDING,
        )

        for req in requirements:
            self.mark_completed(req.id, completion_notes)

        logger.info(
            f"Completed {len(requirements)} requirements of type {requirement_type} "
            f"for storyteller {storyteller_id}"
        )
        return len(requirements)

    # =========================================================================
    # Statistics
    # =========================================================================

    def get_stats(self, storyteller_id: UUID) -> dict:
        """Get requirement statistics for a storyteller.

        Args:
            storyteller_id: Storyteller UUID

        Returns:
            Dictionary with requirement stats
        """
        all_reqs = self.get_by_storyteller(storyteller_id)

        stats = {
            "total": len(all_reqs),
            "pending": 0,
            "in_progress": 0,
            "completed": 0,
            "skipped": 0,
            "by_priority": {
                self.PRIORITY_CRITICAL: 0,
                self.PRIORITY_HIGH: 0,
                self.PRIORITY_MEDIUM: 0,
                self.PRIORITY_LOW: 0,
            },
            "required_pending": 0,
        }

        for req in all_reqs:
            # Count by status
            if req.status == self.STATUS_PENDING:
                stats["pending"] += 1
                if req.is_required:
                    stats["required_pending"] += 1
            elif req.status == self.STATUS_IN_PROGRESS:
                stats["in_progress"] += 1
            elif req.status == self.STATUS_COMPLETED:
                stats["completed"] += 1
            elif req.status == self.STATUS_SKIPPED:
                stats["skipped"] += 1

            # Count pending by priority
            if req.status == self.STATUS_PENDING and req.priority:
                if req.priority in stats["by_priority"]:
                    stats["by_priority"][req.priority] += 1

        # Calculate completion percentage
        completable = stats["total"] - stats["skipped"]
        if completable > 0:
            stats["completion_percentage"] = round(
                (stats["completed"] / completable) * 100, 1
            )
        else:
            stats["completion_percentage"] = 100.0

        return stats

    def has_pending_critical(self, storyteller_id: UUID) -> bool:
        """Check if there are any pending critical requirements.

        Args:
            storyteller_id: Storyteller UUID

        Returns:
            True if there are pending critical requirements
        """
        pending = self.get_pending(
            storyteller_id,
            priority=self.PRIORITY_CRITICAL,
        )
        return len(pending) > 0

    def has_pending_required(self, storyteller_id: UUID) -> bool:
        """Check if there are any pending required requirements.

        Args:
            storyteller_id: Storyteller UUID

        Returns:
            True if there are pending required requirements
        """
        pending = self.get_by_storyteller(
            storyteller_id,
            status=self.STATUS_PENDING,
            is_required=True,
        )
        return len(pending) > 0
