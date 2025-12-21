"""
Session Models Module

This module defines SQLAlchemy models for the session domain.
Sessions are discrete, goal-oriented exchanges between storytellers and agents.

Design Philosophy:
- Goal-oriented: Each session has clear intention and success criteria
- Discrete exchanges: Sessions are bounded interactions, not continuous
- Multi-event: Sessions can span multiple life events (many-to-many)
- Schedulable: Sessions can be planned in advance
- Summarizable: Each session produces a summary of what was accomplished
- Process-aware: Sessions track position in the overall process flow

Models included:
- StorytellerSession: Discrete goal-oriented exchange (renamed from Session)
- SessionScope: Scope selection for the session
- SessionProfile: Profile data captured during session
- SessionProgress: Progress tracking within session
- SessionSectionStatus: Section status within session context
- SessionSynthesis: Synthesis of session section content
- SessionArchetype: Archetype data detected in session
- SessionLifeEvent: Many-to-many between sessions and life events
- SessionInteraction: Individual prompts and responses
- SessionArtifact: Outputs created during session
- SessionTemplate: Reusable session templates
- SessionNote: Additional observations and insights
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import relationship

from database.session import Base


class StorytellerSession(Base):
    """Discrete goal-oriented exchanges between storyteller and agent.

    This model is named StorytellerSession (not Session) to avoid conflict
    with app/database/session.py which handles SQLAlchemy session management.
    """

    __tablename__ = "session"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the session",
    )

    # Relationships
    storyteller_id = Column(
        UUID(as_uuid=True),
        ForeignKey("storyteller.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the parent storyteller",
    )
    process_version_id = Column(
        UUID(as_uuid=True),
        ForeignKey("process_version.id"),
        nullable=True,
        doc="Reference to the process version",
    )
    current_process_node_id = Column(
        UUID(as_uuid=True),
        ForeignKey("process_node.id"),
        nullable=True,
        doc="Reference to the current process node",
    )

    # Session definition
    session_name = Column(
        String(200),
        doc="Session name, e.g., 'Childhood memories capture'",
    )
    intention = Column(
        Text,
        nullable=False,
        doc="What we're trying to accomplish in this session",
    )

    # Success & completion criteria
    success_indicators = Column(
        JSONB,
        doc="Array of success criteria as JSON",
    )
    completion_indicators = Column(
        JSONB,
        doc="Array of completion criteria as JSON",
    )

    # Constraints & guidance
    constraints = Column(
        ARRAY(Text),
        doc="Guardrails, boundaries, things to avoid",
    )
    procedure_notes = Column(
        Text,
        doc="Optional guidance on how to conduct session",
    )

    # Scheduling
    scheduled_at = Column(
        DateTime,
        doc="When session is planned",
    )
    scheduled_duration_minutes = Column(
        Integer,
        doc="Expected length in minutes",
    )

    # Actual timing
    started_at = Column(
        DateTime,
        doc="When session actually started",
    )
    ended_at = Column(
        DateTime,
        doc="When session actually ended",
    )
    actual_duration_minutes = Column(
        Integer,
        doc="Actual duration in minutes",
    )

    # Status
    status = Column(
        String(50),
        default="scheduled",
        doc="Status: 'scheduled', 'in_progress', 'completed', 'cancelled', 'paused'",
    )

    # Outcomes
    summary = Column(
        Text,
        doc="Post-session summary of what was accomplished",
    )
    success_rating = Column(
        Integer,
        doc="1-5 scale, how well did the session go",
    )
    completion_percentage = Column(
        Integer,
        doc="0-100, how complete is the goal",
    )

    # Next steps
    needs_followup = Column(
        Boolean,
        default=False,
        doc="Whether the session needs follow-up",
    )
    followup_notes = Column(
        Text,
        doc="Notes about what follow-up is needed",
    )
    next_session_suggestion = Column(
        Text,
        doc="Suggestion for next session",
    )

    # Timestamps
    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the session was created",
    )
    updated_at = Column(
        DateTime,
        default=datetime.now,
        onupdate=datetime.now,
        doc="Timestamp when the session was last updated",
    )

    # Relationships
    storyteller = relationship(
        "Storyteller",
        backref="sessions",
    )
    process_version = relationship(
        "ProcessVersion",
        backref="sessions",
    )
    current_process_node = relationship(
        "ProcessNode",
        backref="sessions",
    )
    scope = relationship(
        "SessionScope",
        back_populates="session",
        uselist=False,
        cascade="all, delete-orphan",
    )
    profile = relationship(
        "SessionProfile",
        back_populates="session",
        uselist=False,
        cascade="all, delete-orphan",
    )
    progress = relationship(
        "SessionProgress",
        back_populates="session",
        uselist=False,
        cascade="all, delete-orphan",
    )
    section_statuses = relationship(
        "SessionSectionStatus",
        back_populates="session",
        cascade="all, delete-orphan",
    )
    syntheses = relationship(
        "SessionSynthesis",
        back_populates="session",
        cascade="all, delete-orphan",
    )
    archetypes = relationship(
        "SessionArchetype",
        back_populates="session",
        cascade="all, delete-orphan",
    )
    life_events = relationship(
        "SessionLifeEvent",
        back_populates="session",
        cascade="all, delete-orphan",
    )
    interactions = relationship(
        "SessionInteraction",
        back_populates="session",
        cascade="all, delete-orphan",
    )
    artifacts = relationship(
        "SessionArtifact",
        back_populates="session",
        cascade="all, delete-orphan",
    )
    notes = relationship(
        "SessionNote",
        back_populates="session",
        cascade="all, delete-orphan",
    )


# Indexes for session
Index("idx_session_storyteller", StorytellerSession.storyteller_id, StorytellerSession.status)
Index("idx_session_scheduled", StorytellerSession.scheduled_at)
Index("idx_session_status", StorytellerSession.status)


class SessionScope(Base):
    """Scope selection for the session.

    Tracks which scope type was selected for this session and
    any session-specific scope parameters.
    """

    __tablename__ = "session_scope"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the session scope",
    )
    session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("session.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        doc="Reference to the parent session",
    )

    # Scope selection
    scope_type = Column(
        String(50),
        doc="Scope type: 'whole_life', 'major_chapter', 'single_event', 'unsure'",
    )
    scope_description = Column(
        Text,
        doc="User-provided description of scope",
    )

    # Scope parameters
    focus_areas = Column(
        ARRAY(Text),
        doc="Specific areas to focus on in this session",
    )
    excluded_areas = Column(
        ARRAY(Text),
        doc="Areas to exclude from this session",
    )

    # Time bounds for scope
    start_year = Column(
        Integer,
        doc="Start year for scope if time-bounded",
    )
    end_year = Column(
        Integer,
        doc="End year for scope if time-bounded",
    )

    # Additional context
    scope_notes = Column(
        Text,
        doc="Additional notes about scope selection",
    )

    # Timestamps
    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the scope was created",
    )
    updated_at = Column(
        DateTime,
        default=datetime.now,
        onupdate=datetime.now,
        doc="Timestamp when the scope was last updated",
    )

    # Relationships
    session = relationship(
        "StorytellerSession",
        back_populates="scope",
    )


class SessionProfile(Base):
    """Profile data captured during session.

    Captures contextual profile information that was gathered
    or updated during the session.
    """

    __tablename__ = "session_profile"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the session profile",
    )
    session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("session.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        doc="Reference to the parent session",
    )

    # Profile data captured
    profile_data = Column(
        JSONB,
        doc="Structured profile data captured in session",
    )

    # Context gathered
    contextual_facts = Column(
        JSONB,
        doc="Contextual facts gathered during session",
    )

    # Key people mentioned
    people_mentioned = Column(
        JSONB,
        doc="People mentioned during session with roles",
    )

    # Key places mentioned
    places_mentioned = Column(
        JSONB,
        doc="Places mentioned during session",
    )

    # Key dates/periods mentioned
    time_periods_mentioned = Column(
        JSONB,
        doc="Time periods mentioned during session",
    )

    # Additional notes
    profile_notes = Column(
        Text,
        doc="Additional notes about profile data",
    )

    # Timestamps
    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the profile was created",
    )
    updated_at = Column(
        DateTime,
        default=datetime.now,
        onupdate=datetime.now,
        doc="Timestamp when the profile was last updated",
    )

    # Relationships
    session = relationship(
        "StorytellerSession",
        back_populates="profile",
    )


class SessionProgress(Base):
    """Progress tracking within session.

    Tracks the progress through the session goals and
    process nodes during a session.
    """

    __tablename__ = "session_progress"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the session progress",
    )
    session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("session.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        doc="Reference to the parent session",
    )
    current_node_id = Column(
        UUID(as_uuid=True),
        ForeignKey("process_node.id"),
        nullable=True,
        doc="Reference to the current process node",
    )

    # Progress metrics
    overall_progress_percentage = Column(
        Integer,
        default=0,
        doc="Overall progress percentage (0-100)",
    )
    goals_completed = Column(
        Integer,
        default=0,
        doc="Number of goals completed",
    )
    goals_total = Column(
        Integer,
        doc="Total number of goals",
    )

    # Interaction metrics
    prompts_asked = Column(
        Integer,
        default=0,
        doc="Number of prompts asked",
    )
    prompts_answered = Column(
        Integer,
        default=0,
        doc="Number of prompts answered",
    )
    prompts_skipped = Column(
        Integer,
        default=0,
        doc="Number of prompts skipped",
    )

    # Time tracking
    active_time_seconds = Column(
        Integer,
        default=0,
        doc="Active time in seconds",
    )
    idle_time_seconds = Column(
        Integer,
        default=0,
        doc="Idle time in seconds",
    )

    # Node progression
    nodes_visited = Column(
        ARRAY(UUID(as_uuid=True)),
        doc="Array of visited node IDs",
    )
    nodes_completed = Column(
        ARRAY(UUID(as_uuid=True)),
        doc="Array of completed node IDs",
    )

    # Status tracking
    last_activity_at = Column(
        DateTime,
        doc="Timestamp of last activity",
    )
    progress_notes = Column(
        Text,
        doc="Notes about session progress",
    )

    # Timestamps
    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the progress was created",
    )
    updated_at = Column(
        DateTime,
        default=datetime.now,
        onupdate=datetime.now,
        doc="Timestamp when the progress was last updated",
    )

    # Relationships
    session = relationship(
        "StorytellerSession",
        back_populates="progress",
    )
    current_node = relationship(
        "ProcessNode",
    )


class SessionSectionStatus(Base):
    """Section status within session context.

    Tracks the status of process sections during a specific session.
    """

    __tablename__ = "session_section_status"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the session section status",
    )
    session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("session.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the parent session",
    )
    process_section_id = Column(
        UUID(as_uuid=True),
        ForeignKey("process_section.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the process section",
    )

    # Status
    status = Column(
        String(50),
        default="not_started",
        doc="Status: 'not_started', 'in_progress', 'completed', 'skipped'",
    )

    # Progress within section
    prompts_completed = Column(
        Integer,
        default=0,
        doc="Number of prompts completed in this section",
    )
    prompts_total = Column(
        Integer,
        doc="Total prompts in this section",
    )
    completion_percentage = Column(
        Integer,
        default=0,
        doc="Completion percentage (0-100)",
    )

    # Timing
    started_at = Column(
        DateTime,
        doc="When this section was started",
    )
    completed_at = Column(
        DateTime,
        doc="When this section was completed",
    )

    # Notes
    section_notes = Column(
        Text,
        doc="Notes about this section in this session",
    )

    # Timestamps
    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the status was created",
    )
    updated_at = Column(
        DateTime,
        default=datetime.now,
        onupdate=datetime.now,
        doc="Timestamp when the status was last updated",
    )

    # Relationships
    session = relationship(
        "StorytellerSession",
        back_populates="section_statuses",
    )
    process_section = relationship(
        "ProcessSection",
    )

    __table_args__ = (
        UniqueConstraint("session_id", "process_section_id", name="uq_session_section"),
    )


# Index for session_section_status
Index("idx_session_section_status_session", SessionSectionStatus.session_id)
Index("idx_session_section_status_section", SessionSectionStatus.process_section_id)


class SessionSynthesis(Base):
    """Synthesis of session section content.

    Captures synthesized content from session sections, including
    summaries and key insights.
    """

    __tablename__ = "session_synthesis"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the session synthesis",
    )
    session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("session.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the parent session",
    )
    process_section_id = Column(
        UUID(as_uuid=True),
        ForeignKey("process_section.id", ondelete="SET NULL"),
        nullable=True,
        doc="Reference to the process section if applicable",
    )

    # Synthesis content
    synthesis_type = Column(
        String(50),
        doc="Type: 'section_summary', 'session_summary', 'theme_summary', 'insight'",
    )
    title = Column(
        String(200),
        doc="Title for this synthesis",
    )
    content = Column(
        Text,
        nullable=False,
        doc="The synthesized content",
    )

    # Structured data
    key_themes = Column(
        ARRAY(Text),
        doc="Key themes extracted",
    )
    key_insights = Column(
        ARRAY(Text),
        doc="Key insights extracted",
    )
    key_facts = Column(
        JSONB,
        doc="Key facts in structured form",
    )

    # Quality metrics
    confidence_score = Column(
        Numeric(3, 2),
        doc="Confidence score (0.00 to 1.00)",
    )
    is_verified = Column(
        Boolean,
        default=False,
        doc="Whether the synthesis has been verified",
    )
    verified_at = Column(
        DateTime,
        doc="When the synthesis was verified",
    )

    # Usage tracking
    included_in_story = Column(
        Boolean,
        default=False,
        doc="Whether this synthesis is included in story",
    )

    # Timestamps
    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the synthesis was created",
    )
    updated_at = Column(
        DateTime,
        default=datetime.now,
        onupdate=datetime.now,
        doc="Timestamp when the synthesis was last updated",
    )

    # Relationships
    session = relationship(
        "StorytellerSession",
        back_populates="syntheses",
    )
    process_section = relationship(
        "ProcessSection",
    )


# Index for session_synthesis
Index("idx_session_synthesis_session", SessionSynthesis.session_id)


class SessionArchetype(Base):
    """Archetype data detected in session.

    Tracks archetype patterns and themes detected during
    the session for later analysis.
    """

    __tablename__ = "session_archetype"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the session archetype",
    )
    session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("session.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the parent session",
    )

    # Archetype detection
    detected_archetype = Column(
        String(100),
        doc="Primary archetype detected in session",
    )
    confidence_score = Column(
        Numeric(3, 2),
        doc="Confidence score (0.00 to 1.00)",
    )

    # Supporting evidence
    supporting_themes = Column(
        ARRAY(Text),
        doc="Themes that support the archetype",
    )
    supporting_patterns = Column(
        JSONB,
        doc="Patterns that support the archetype",
    )
    supporting_interactions = Column(
        ARRAY(UUID(as_uuid=True)),
        doc="Interaction IDs that support the archetype",
    )

    # Alternative archetypes
    alternative_archetypes = Column(
        JSONB,
        doc="Alternative archetypes with scores",
    )

    # Analysis notes
    analysis_notes = Column(
        Text,
        doc="Notes about the archetype analysis",
    )

    # Timestamps
    analyzed_at = Column(
        DateTime,
        default=datetime.now,
        doc="When the analysis was performed",
    )
    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the archetype record was created",
    )

    # Relationships
    session = relationship(
        "StorytellerSession",
        back_populates="archetypes",
    )


# Index for session_archetype
Index("idx_session_archetype_session", SessionArchetype.session_id)


class SessionLifeEvent(Base):
    """Many-to-many relationship between sessions and life events.

    Tracks which life events are covered in each session and
    the nature of coverage.
    """

    __tablename__ = "session_life_event"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the session life event link",
    )
    session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("session.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the parent session",
    )
    life_event_id = Column(
        UUID(as_uuid=True),
        ForeignKey("life_event.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the life event",
    )

    # Relationship context
    is_primary_focus = Column(
        Boolean,
        default=False,
        doc="Whether this is the main event for the session",
    )
    coverage_level = Column(
        String(50),
        doc="Coverage: 'introduction', 'exploration', 'deep_dive', 'completion'",
    )

    # Progress tracking
    prompts_completed = Column(
        Integer,
        default=0,
        doc="Number of prompts completed for this event",
    )
    notes = Column(
        Text,
        doc="Session-specific notes about this event",
    )

    # Timestamps
    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the link was created",
    )

    # Relationships
    session = relationship(
        "StorytellerSession",
        back_populates="life_events",
    )
    life_event = relationship(
        "LifeEvent",
    )

    __table_args__ = (
        UniqueConstraint("session_id", "life_event_id", name="uq_session_life_event"),
    )


# Indexes for session_life_event
Index("idx_session_life_event_session", SessionLifeEvent.session_id)
Index("idx_session_life_event_event", SessionLifeEvent.life_event_id)


class SessionInteraction(Base):
    """Individual exchanges within a session.

    Tracks agent prompts and storyteller responses during
    the session.
    """

    __tablename__ = "session_interaction"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the interaction",
    )
    session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("session.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the parent session",
    )
    life_event_id = Column(
        UUID(as_uuid=True),
        ForeignKey("life_event.id", ondelete="SET NULL"),
        nullable=True,
        doc="Reference to the related life event",
    )

    # Interaction sequence
    interaction_sequence = Column(
        Integer,
        nullable=False,
        doc="Order within the session",
    )

    # Content
    interaction_type = Column(
        String(50),
        doc="Type: 'prompt', 'response', 'clarification', 'reflection'",
    )

    # Agent side
    agent_prompt = Column(
        Text,
        doc="What the agent asked/said",
    )
    prompt_category = Column(
        String(100),
        doc="Category: 'scene', 'people', 'tension', 'change', 'meaning'",
    )

    # Storyteller side
    storyteller_response = Column(
        Text,
        doc="What the storyteller said/wrote",
    )
    response_method = Column(
        String(50),
        doc="Method: 'text', 'voice', 'skip'",
    )

    # Analysis
    sentiment = Column(
        String(50),
        doc="Sentiment: 'positive', 'neutral', 'difficult', 'emotional'",
    )
    key_themes = Column(
        ARRAY(Text),
        doc="Extracted themes from this interaction",
    )
    mentions_people = Column(
        ARRAY(Text),
        doc="People mentioned in this interaction",
    )
    mentions_places = Column(
        ARRAY(Text),
        doc="Places mentioned in this interaction",
    )

    # Metadata
    duration_seconds = Column(
        Integer,
        doc="How long this interaction took",
    )
    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the interaction was created",
    )

    # Relationships
    session = relationship(
        "StorytellerSession",
        back_populates="interactions",
    )
    life_event = relationship(
        "LifeEvent",
    )


# Indexes for session_interaction
Index(
    "idx_session_interaction_session",
    SessionInteraction.session_id,
    SessionInteraction.interaction_sequence,
)
Index("idx_session_interaction_event", SessionInteraction.life_event_id)


class SessionArtifact(Base):
    """Outputs and artifacts created during the session.

    Tracks tangible outputs like scene captures, timeline entries,
    and draft paragraphs.
    """

    __tablename__ = "session_artifact"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the artifact",
    )
    session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("session.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the parent session",
    )
    life_event_id = Column(
        UUID(as_uuid=True),
        ForeignKey("life_event.id", ondelete="SET NULL"),
        nullable=True,
        doc="Reference to the related life event",
    )

    # Artifact details
    artifact_type = Column(
        String(50),
        doc="Type: 'scene_capture', 'timeline_entry', 'relationship_mapping', 'draft_paragraph', 'photo_annotation'",
    )
    artifact_name = Column(
        String(200),
        doc="Name of the artifact",
    )
    content = Column(
        Text,
        doc="The actual artifact content",
    )
    structured_data = Column(
        JSONB,
        doc="Structured components of the artifact",
    )

    # Status
    is_provisional = Column(
        Boolean,
        default=True,
        doc="Whether this is provisional (not yet confirmed)",
    )
    is_approved = Column(
        Boolean,
        default=False,
        doc="Whether the storyteller approved this artifact",
    )
    approved_at = Column(
        DateTime,
        doc="When the artifact was approved",
    )

    # Usage
    included_in_synthesis = Column(
        Boolean,
        default=False,
        doc="Whether this is included in synthesis",
    )

    # Timestamps
    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the artifact was created",
    )
    updated_at = Column(
        DateTime,
        default=datetime.now,
        onupdate=datetime.now,
        doc="Timestamp when the artifact was last updated",
    )

    # Relationships
    session = relationship(
        "StorytellerSession",
        back_populates="artifacts",
    )
    life_event = relationship(
        "LifeEvent",
    )


# Indexes for session_artifact
Index("idx_session_artifact_session", SessionArtifact.session_id)
Index("idx_session_artifact_type", SessionArtifact.artifact_type)


class SessionTemplate(Base):
    """Reusable session templates for common goals.

    Provides templates that can be used to create sessions
    with predefined intentions, success criteria, and procedures.
    """

    __tablename__ = "session_template"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the template",
    )
    process_version_id = Column(
        UUID(as_uuid=True),
        ForeignKey("process_version.id", ondelete="CASCADE"),
        nullable=True,
        doc="Reference to the process version",
    )

    # Template definition
    template_name = Column(
        String(200),
        nullable=False,
        doc="Template name, e.g., 'Childhood exploration'",
    )
    template_description = Column(
        Text,
        doc="Description of the template",
    )

    # Suggested for
    suggested_for_event_types = Column(
        ARRAY(Text),
        doc="Which life event types this works well for",
    )
    suggested_for_process_nodes = Column(
        ARRAY(UUID(as_uuid=True)),
        doc="Which process nodes this aligns with",
    )

    # Template content (defaults for new sessions)
    default_intention = Column(
        Text,
        doc="Default intention for sessions using this template",
    )
    default_success_indicators = Column(
        JSONB,
        doc="Default success indicators",
    )
    default_completion_indicators = Column(
        JSONB,
        doc="Default completion indicators",
    )
    default_constraints = Column(
        ARRAY(Text),
        doc="Default constraints",
    )
    default_procedure_notes = Column(
        Text,
        doc="Default procedure notes",
    )
    default_duration_minutes = Column(
        Integer,
        doc="Default duration in minutes",
    )

    # Metadata
    is_active = Column(
        Boolean,
        default=True,
        doc="Whether this template is active",
    )
    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the template was created",
    )
    updated_at = Column(
        DateTime,
        default=datetime.now,
        onupdate=datetime.now,
        doc="Timestamp when the template was last updated",
    )

    # Relationships
    process_version = relationship(
        "ProcessVersion",
    )


class SessionNote(Base):
    """Additional notes and observations during/after session.

    Captures observations, concerns, and insights that arise
    during or after a session.
    """

    __tablename__ = "session_note"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the note",
    )
    session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("session.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the parent session",
    )

    # Note details
    note_type = Column(
        String(50),
        doc="Type: 'observation', 'concern', 'insight', 'technical'",
    )
    note_content = Column(
        Text,
        nullable=False,
        doc="The content of the note",
    )

    # Context
    noted_at_interaction_sequence = Column(
        Integer,
        doc="Which interaction prompted this note",
    )

    # Flagging
    is_important = Column(
        Boolean,
        default=False,
        doc="Whether this note is important",
    )
    requires_followup = Column(
        Boolean,
        default=False,
        doc="Whether this note requires follow-up",
    )

    # Attribution
    noted_by = Column(
        String(100),
        doc="Who noted this: 'agent', 'system', 'user'",
    )

    # Timestamps
    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the note was created",
    )

    # Relationships
    session = relationship(
        "StorytellerSession",
        back_populates="notes",
    )


# Index for session_note
Index("idx_session_note_session", SessionNote.session_id)


# Export all models
__all__ = [
    "StorytellerSession",
    "SessionScope",
    "SessionProfile",
    "SessionProgress",
    "SessionSectionStatus",
    "SessionSynthesis",
    "SessionArchetype",
    "SessionLifeEvent",
    "SessionInteraction",
    "SessionArtifact",
    "SessionTemplate",
    "SessionNote",
]
