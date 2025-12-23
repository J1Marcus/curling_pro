"""
Session Service Module

Provides service layer operations for session management.
Sessions are discrete, goal-oriented exchanges between storytellers and agents,
driven by VAPI voice interactions.
"""

import logging
from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import select, and_
from sqlalchemy.orm import Session, joinedload

from database.models import (
    StorytellerSession,
    SessionProgress,
    SessionInteraction,
    SessionArtifact,
    SessionScope,
)

logger = logging.getLogger(__name__)


class SessionService:
    """Service for managing storyteller sessions.

    Sessions represent discrete voice interactions driven by VAPI.
    This service handles session lifecycle, progress tracking,
    and interaction recording.
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

    STATUS_SCHEDULED = "scheduled"
    STATUS_IN_PROGRESS = "in_progress"
    STATUS_COMPLETED = "completed"
    STATUS_CANCELLED = "cancelled"
    STATUS_PAUSED = "paused"

    # =========================================================================
    # Core CRUD Operations
    # =========================================================================

    def create(
        self,
        *,
        storyteller_id: UUID,
        intention: str,
        session_name: Optional[str] = None,
        scheduled_at: Optional[datetime] = None,
        scheduled_duration_minutes: Optional[int] = None,
        process_version_id: Optional[UUID] = None,
    ) -> StorytellerSession:
        """Create a new session.

        Args:
            storyteller_id: Storyteller UUID
            intention: What we're trying to accomplish
            session_name: Optional friendly name
            scheduled_at: When session is planned
            scheduled_duration_minutes: Expected length
            process_version_id: Optional process version

        Returns:
            Created StorytellerSession instance
        """
        session = StorytellerSession(
            storyteller_id=storyteller_id,
            intention=intention,
            session_name=session_name,
            scheduled_at=scheduled_at,
            scheduled_duration_minutes=scheduled_duration_minutes,
            process_version_id=process_version_id,
            status=self.STATUS_SCHEDULED,
        )

        self.db.add(session)
        self.db.flush()

        # Create progress record
        progress = SessionProgress(
            session_id=session.id,
            overall_progress_percentage=0,
            goals_completed=0,
            prompts_asked=0,
            prompts_answered=0,
        )
        self.db.add(progress)
        self.db.flush()

        logger.info(f"Created session {session.id} for storyteller {storyteller_id}")
        return session

    def get_by_id(
        self,
        session_id: UUID,
        *,
        include_progress: bool = False,
        include_interactions: bool = False,
        include_scope: bool = False,
    ) -> Optional[StorytellerSession]:
        """Get session by ID with optional related data.

        Args:
            session_id: Session UUID
            include_progress: Load progress relationship
            include_interactions: Load interactions relationship
            include_scope: Load scope relationship

        Returns:
            StorytellerSession instance or None
        """
        query = select(StorytellerSession).where(
            StorytellerSession.id == session_id
        )

        if include_progress:
            query = query.options(joinedload(StorytellerSession.progress))
        if include_interactions:
            query = query.options(joinedload(StorytellerSession.interactions))
        if include_scope:
            query = query.options(joinedload(StorytellerSession.scope))

        result = self.db.execute(query)
        return result.unique().scalar_one_or_none()

    def get_by_storyteller(
        self,
        storyteller_id: UUID,
        *,
        status: Optional[str] = None,
        limit: int = 50,
    ) -> list[StorytellerSession]:
        """Get sessions for a storyteller.

        Args:
            storyteller_id: Storyteller UUID
            status: Optional status filter
            limit: Maximum number of sessions to return

        Returns:
            List of StorytellerSession instances
        """
        query = select(StorytellerSession).where(
            StorytellerSession.storyteller_id == storyteller_id
        )

        if status is not None:
            query = query.where(StorytellerSession.status == status)

        query = query.order_by(StorytellerSession.created_at.desc()).limit(limit)

        result = self.db.execute(query)
        return list(result.scalars().all())

    def get_active_session(
        self,
        storyteller_id: UUID,
    ) -> Optional[StorytellerSession]:
        """Get the current active (in_progress) session for a storyteller.

        Args:
            storyteller_id: Storyteller UUID

        Returns:
            Active StorytellerSession or None
        """
        query = select(StorytellerSession).where(
            and_(
                StorytellerSession.storyteller_id == storyteller_id,
                StorytellerSession.status == self.STATUS_IN_PROGRESS,
            )
        )

        result = self.db.execute(query)
        return result.scalar_one_or_none()

    def get_latest_session(
        self,
        storyteller_id: UUID,
    ) -> Optional[StorytellerSession]:
        """Get the most recent session for a storyteller.

        Args:
            storyteller_id: Storyteller UUID

        Returns:
            Most recent StorytellerSession or None
        """
        query = (
            select(StorytellerSession)
            .where(StorytellerSession.storyteller_id == storyteller_id)
            .order_by(StorytellerSession.created_at.desc())
            .limit(1)
        )

        result = self.db.execute(query)
        return result.scalar_one_or_none()

    # =========================================================================
    # Session Lifecycle
    # =========================================================================

    def start(self, session_id: UUID) -> Optional[StorytellerSession]:
        """Start a session (transition to in_progress).

        Args:
            session_id: Session UUID

        Returns:
            Updated StorytellerSession or None
        """
        session = self.get_by_id(session_id)
        if not session:
            return None

        if session.status not in [self.STATUS_SCHEDULED, self.STATUS_PAUSED]:
            logger.warning(
                f"Cannot start session {session_id}, "
                f"current status: {session.status}"
            )
            return session

        session.status = self.STATUS_IN_PROGRESS
        session.started_at = datetime.now()
        self.db.flush()

        logger.info(f"Started session {session_id}")
        return session

    def pause(self, session_id: UUID) -> Optional[StorytellerSession]:
        """Pause a session.

        Args:
            session_id: Session UUID

        Returns:
            Updated StorytellerSession or None
        """
        session = self.get_by_id(session_id)
        if not session:
            return None

        if session.status != self.STATUS_IN_PROGRESS:
            logger.warning(
                f"Cannot pause session {session_id}, "
                f"current status: {session.status}"
            )
            return session

        session.status = self.STATUS_PAUSED
        self.db.flush()

        logger.info(f"Paused session {session_id}")
        return session

    def complete(
        self,
        session_id: UUID,
        *,
        summary: Optional[str] = None,
        success_rating: Optional[int] = None,
        completion_percentage: Optional[int] = None,
        needs_followup: bool = False,
        followup_notes: Optional[str] = None,
    ) -> Optional[StorytellerSession]:
        """Complete a session.

        Args:
            session_id: Session UUID
            summary: Post-session summary
            success_rating: 1-5 rating
            completion_percentage: 0-100 percentage
            needs_followup: Whether follow-up is needed
            followup_notes: Notes about follow-up

        Returns:
            Updated StorytellerSession or None
        """
        session = self.get_by_id(session_id, include_progress=True)
        if not session:
            return None

        session.status = self.STATUS_COMPLETED
        session.ended_at = datetime.now()

        # Calculate duration if we have start time
        if session.started_at:
            duration = session.ended_at - session.started_at
            session.actual_duration_minutes = int(duration.total_seconds() / 60)

        if summary:
            session.summary = summary
        if success_rating:
            session.success_rating = success_rating
        if completion_percentage:
            session.completion_percentage = completion_percentage

        session.needs_followup = needs_followup
        if followup_notes:
            session.followup_notes = followup_notes

        self.db.flush()

        logger.info(f"Completed session {session_id}")
        return session

    def cancel(
        self,
        session_id: UUID,
        reason: Optional[str] = None,
    ) -> Optional[StorytellerSession]:
        """Cancel a session.

        Args:
            session_id: Session UUID
            reason: Reason for cancellation

        Returns:
            Updated StorytellerSession or None
        """
        session = self.get_by_id(session_id)
        if not session:
            return None

        session.status = self.STATUS_CANCELLED
        session.ended_at = datetime.now()
        if reason:
            session.summary = f"Cancelled: {reason}"

        self.db.flush()

        logger.info(f"Cancelled session {session_id}")
        return session

    # =========================================================================
    # Scope Management
    # =========================================================================

    def set_scope(
        self,
        session_id: UUID,
        *,
        scope_type: str,
        scope_description: Optional[str] = None,
        focus_areas: Optional[list[str]] = None,
        excluded_areas: Optional[list[str]] = None,
        start_year: Optional[int] = None,
        end_year: Optional[int] = None,
    ) -> Optional[SessionScope]:
        """Set or update session scope.

        Args:
            session_id: Session UUID
            scope_type: Type of scope (whole_life, major_chapter, etc.)
            scope_description: User description of scope
            focus_areas: Areas to focus on
            excluded_areas: Areas to exclude
            start_year: Start year if time-bounded
            end_year: End year if time-bounded

        Returns:
            SessionScope instance or None
        """
        # Check if scope already exists
        query = select(SessionScope).where(SessionScope.session_id == session_id)
        result = self.db.execute(query)
        scope = result.scalar_one_or_none()

        if scope:
            # Update existing
            scope.scope_type = scope_type
            if scope_description:
                scope.scope_description = scope_description
            if focus_areas:
                scope.focus_areas = focus_areas
            if excluded_areas:
                scope.excluded_areas = excluded_areas
            if start_year:
                scope.start_year = start_year
            if end_year:
                scope.end_year = end_year
        else:
            # Create new
            scope = SessionScope(
                session_id=session_id,
                scope_type=scope_type,
                scope_description=scope_description,
                focus_areas=focus_areas,
                excluded_areas=excluded_areas,
                start_year=start_year,
                end_year=end_year,
            )
            self.db.add(scope)

        self.db.flush()
        logger.info(f"Set scope for session {session_id}: {scope_type}")
        return scope

    # =========================================================================
    # Interaction Recording
    # =========================================================================

    def record_interaction(
        self,
        session_id: UUID,
        *,
        agent_prompt: str,
        storyteller_response: Optional[str] = None,
        interaction_type: str = "prompt",
        prompt_category: Optional[str] = None,
        response_method: str = "voice",
        life_event_id: Optional[UUID] = None,
        duration_seconds: Optional[int] = None,
    ) -> SessionInteraction:
        """Record an interaction in the session.

        Args:
            session_id: Session UUID
            agent_prompt: What the agent asked
            storyteller_response: What the storyteller said
            interaction_type: Type of interaction
            prompt_category: Category of prompt
            response_method: How response was given
            life_event_id: Optional linked life event
            duration_seconds: How long interaction took

        Returns:
            Created SessionInteraction instance
        """
        # Get the next sequence number
        query = (
            select(SessionInteraction)
            .where(SessionInteraction.session_id == session_id)
            .order_by(SessionInteraction.interaction_sequence.desc())
            .limit(1)
        )
        result = self.db.execute(query)
        last = result.scalar_one_or_none()
        next_sequence = (last.interaction_sequence + 1) if last else 1

        interaction = SessionInteraction(
            session_id=session_id,
            interaction_sequence=next_sequence,
            interaction_type=interaction_type,
            agent_prompt=agent_prompt,
            storyteller_response=storyteller_response,
            prompt_category=prompt_category,
            response_method=response_method,
            life_event_id=life_event_id,
            duration_seconds=duration_seconds,
        )

        self.db.add(interaction)
        self.db.flush()

        # Update progress
        self._update_interaction_counts(session_id, has_response=bool(storyteller_response))

        logger.debug(f"Recorded interaction {next_sequence} for session {session_id}")
        return interaction

    def get_interactions(
        self,
        session_id: UUID,
        *,
        limit: Optional[int] = None,
    ) -> list[SessionInteraction]:
        """Get interactions for a session.

        Args:
            session_id: Session UUID
            limit: Optional limit

        Returns:
            List of SessionInteraction instances
        """
        query = (
            select(SessionInteraction)
            .where(SessionInteraction.session_id == session_id)
            .order_by(SessionInteraction.interaction_sequence)
        )

        if limit:
            query = query.limit(limit)

        result = self.db.execute(query)
        return list(result.scalars().all())

    def get_last_interaction(
        self,
        session_id: UUID,
    ) -> Optional[SessionInteraction]:
        """Get the last interaction in a session.

        Args:
            session_id: Session UUID

        Returns:
            Last SessionInteraction or None
        """
        query = (
            select(SessionInteraction)
            .where(SessionInteraction.session_id == session_id)
            .order_by(SessionInteraction.interaction_sequence.desc())
            .limit(1)
        )

        result = self.db.execute(query)
        return result.scalar_one_or_none()

    # =========================================================================
    # Artifact Management
    # =========================================================================

    def create_artifact(
        self,
        session_id: UUID,
        *,
        artifact_type: str,
        content: str,
        artifact_name: Optional[str] = None,
        structured_data: Optional[dict] = None,
        life_event_id: Optional[UUID] = None,
    ) -> SessionArtifact:
        """Create a session artifact.

        Args:
            session_id: Session UUID
            artifact_type: Type of artifact
            content: Artifact content
            artifact_name: Optional name
            structured_data: Optional structured data
            life_event_id: Optional linked life event

        Returns:
            Created SessionArtifact instance
        """
        artifact = SessionArtifact(
            session_id=session_id,
            artifact_type=artifact_type,
            content=content,
            artifact_name=artifact_name,
            structured_data=structured_data,
            life_event_id=life_event_id,
            is_provisional=True,
            is_approved=False,
        )

        self.db.add(artifact)
        self.db.flush()

        logger.info(f"Created artifact {artifact.id} for session {session_id}")
        return artifact

    def get_artifacts(
        self,
        session_id: UUID,
        *,
        artifact_type: Optional[str] = None,
    ) -> list[SessionArtifact]:
        """Get artifacts for a session.

        Args:
            session_id: Session UUID
            artifact_type: Optional type filter

        Returns:
            List of SessionArtifact instances
        """
        query = select(SessionArtifact).where(
            SessionArtifact.session_id == session_id
        )

        if artifact_type:
            query = query.where(SessionArtifact.artifact_type == artifact_type)

        result = self.db.execute(query)
        return list(result.scalars().all())

    def approve_artifact(
        self,
        artifact_id: UUID,
    ) -> Optional[SessionArtifact]:
        """Approve a session artifact.

        Args:
            artifact_id: Artifact UUID

        Returns:
            Updated SessionArtifact or None
        """
        query = select(SessionArtifact).where(SessionArtifact.id == artifact_id)
        result = self.db.execute(query)
        artifact = result.scalar_one_or_none()

        if not artifact:
            return None

        artifact.is_approved = True
        artifact.is_provisional = False
        artifact.approved_at = datetime.now()
        self.db.flush()

        return artifact

    # =========================================================================
    # Progress Tracking
    # =========================================================================

    def get_progress(self, session_id: UUID) -> Optional[SessionProgress]:
        """Get session progress record.

        Args:
            session_id: Session UUID

        Returns:
            SessionProgress instance or None
        """
        query = select(SessionProgress).where(
            SessionProgress.session_id == session_id
        )
        result = self.db.execute(query)
        return result.scalar_one_or_none()

    def update_progress(
        self,
        session_id: UUID,
        *,
        overall_progress_percentage: Optional[int] = None,
        goals_completed: Optional[int] = None,
        goals_total: Optional[int] = None,
        current_node_id: Optional[UUID] = None,
    ) -> Optional[SessionProgress]:
        """Update session progress.

        Args:
            session_id: Session UUID
            overall_progress_percentage: Progress percentage
            goals_completed: Number of completed goals
            goals_total: Total number of goals
            current_node_id: Current process node

        Returns:
            Updated SessionProgress or None
        """
        progress = self.get_progress(session_id)
        if not progress:
            return None

        if overall_progress_percentage is not None:
            progress.overall_progress_percentage = overall_progress_percentage
        if goals_completed is not None:
            progress.goals_completed = goals_completed
        if goals_total is not None:
            progress.goals_total = goals_total
        if current_node_id is not None:
            progress.current_node_id = current_node_id

        progress.last_activity_at = datetime.now()
        self.db.flush()

        return progress

    def _update_interaction_counts(
        self,
        session_id: UUID,
        has_response: bool = False,
    ) -> None:
        """Update interaction counts in progress record.

        Args:
            session_id: Session UUID
            has_response: Whether there was a response
        """
        progress = self.get_progress(session_id)
        if not progress:
            return

        progress.prompts_asked = (progress.prompts_asked or 0) + 1
        if has_response:
            progress.prompts_answered = (progress.prompts_answered or 0) + 1

        progress.last_activity_at = datetime.now()
        self.db.flush()

    # =========================================================================
    # Query Helpers
    # =========================================================================

    def get_session_context(self, session_id: UUID) -> Optional[dict]:
        """Get full session context for workflows.

        Returns session with scope, progress, and recent interactions
        as a dictionary suitable for workflow context.

        Args:
            session_id: Session UUID

        Returns:
            Dictionary with session context or None
        """
        session = self.get_by_id(
            session_id,
            include_progress=True,
            include_scope=True,
        )

        if not session:
            return None

        # Get recent interactions
        interactions = self.get_interactions(session_id, limit=10)

        return {
            "session": {
                "id": str(session.id),
                "storyteller_id": str(session.storyteller_id),
                "intention": session.intention,
                "status": session.status,
                "started_at": session.started_at.isoformat() if session.started_at else None,
            },
            "scope": {
                "scope_type": session.scope.scope_type if session.scope else None,
                "focus_areas": session.scope.focus_areas if session.scope else [],
            }
            if session.scope
            else None,
            "progress": {
                "overall_progress_percentage": session.progress.overall_progress_percentage
                if session.progress
                else 0,
                "prompts_asked": session.progress.prompts_asked
                if session.progress
                else 0,
                "prompts_answered": session.progress.prompts_answered
                if session.progress
                else 0,
            }
            if session.progress
            else None,
            "recent_interactions": [
                {
                    "sequence": i.interaction_sequence,
                    "agent_prompt": i.agent_prompt,
                    "storyteller_response": i.storyteller_response,
                }
                for i in interactions[-5:]  # Last 5
            ],
        }

    def count_sessions(
        self,
        storyteller_id: UUID,
        *,
        status: Optional[str] = None,
    ) -> int:
        """Count sessions for a storyteller.

        Args:
            storyteller_id: Storyteller UUID
            status: Optional status filter

        Returns:
            Number of sessions
        """
        sessions = self.get_by_storyteller(
            storyteller_id,
            status=status,
            limit=1000,
        )
        return len(sessions)
