"""
System Operations Models Module

This module defines SQLAlchemy models for the system operations domain.
System operations handle progress tracking, section management, archetype
inference, feedback loops, agent management, and book export functionality.

Design Philosophy:
- Progress tracking: Monitor storyteller journey through process phases
- Section management: Track which narrative lanes are selected and unlocked
- Archetype inference: AI analysis of narrative patterns with verification
- Feedback loop: Centralized user feedback for learning and improvement
- Agent management: Reusable agent definitions and instance tracking
- Export management: Book publication and format generation
- Scope definitions: Formal definitions of scope types and their implications

Models included:
- StorytellerProgress: Overall progress through the canonical process flow
- StorytellerSectionSelection: Which narrative lanes the storyteller chose
- StorytellerSectionStatus: Detailed status of each section for a storyteller
- ScopeType: Formal definitions of scope types and their implications
- ArchetypeAnalysis: AI inference of narrative archetypes with verification
- UserFeedback: Centralized feedback on any system element
- Agent: Reusable agent definitions
- AgentInstance: Specific instantiation of an agent for a session
- Requirement: Requirements for story capture process
- EditRequirement: Requirements for story editing process
- BookExport: Final manuscript exports in various formats
- BookExportDelivery: Track delivery of exports to storyteller
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger,
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


class StorytellerProgress(Base):
    """Overall progress through the canonical process flow.

    Tracks the storyteller's journey through process phases including
    current phase, completion metrics, milestones, and activity.
    """

    __tablename__ = "storyteller_progress"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the progress record",
    )
    storyteller_id = Column(
        UUID(as_uuid=True),
        ForeignKey("storyteller.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        doc="Reference to the parent storyteller",
    )
    process_version_id = Column(
        UUID(as_uuid=True),
        ForeignKey("process_version.id"),
        nullable=True,
        doc="Reference to the process version",
    )

    # Current phase (from process.txt canonical flow)
    current_phase = Column(
        String(100),
        doc="Current phase: 'trust_setup', 'scope_selection', 'profile', 'contextual_grounding', 'section_selection', 'story_capture', 'synthesis', 'archetype_inference', 'book_formation'",
    )
    phase_status = Column(
        String(50),
        doc="Phase status: 'not_started', 'in_progress', 'completed'",
    )

    # Progress metrics
    overall_completion_percentage = Column(
        Integer,
        default=0,
        doc="Overall completion percentage (0-100)",
    )
    phases_completed = Column(
        ARRAY(Text),
        doc="Array of completed phase keys",
    )
    phases_skipped = Column(
        ARRAY(Text),
        doc="Phases deliberately skipped",
    )

    # Milestones
    first_session_at = Column(
        DateTime,
        doc="Timestamp of first session",
    )
    first_capture_at = Column(
        DateTime,
        doc="Timestamp of first capture",
    )
    first_synthesis_at = Column(
        DateTime,
        doc="Timestamp of first synthesis",
    )
    book_started_at = Column(
        DateTime,
        doc="Timestamp when book was started",
    )
    book_completed_at = Column(
        DateTime,
        doc="Timestamp when book was completed",
    )

    # Activity
    last_active_at = Column(
        DateTime,
        doc="Timestamp of last activity",
    )
    total_sessions_count = Column(
        Integer,
        default=0,
        doc="Total number of sessions",
    )
    total_interactions_count = Column(
        Integer,
        default=0,
        doc="Total number of interactions",
    )
    total_artifacts_count = Column(
        Integer,
        default=0,
        doc="Total number of artifacts",
    )

    # Next steps
    suggested_next_phase = Column(
        String(100),
        doc="Suggested next phase",
    )
    suggested_next_action = Column(
        Text,
        doc="Suggested next action",
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
    storyteller = relationship(
        "Storyteller",
        backref="progress",
    )
    process_version = relationship(
        "ProcessVersion",
    )


# Indexes for storyteller_progress
Index("idx_storyteller_progress", StorytellerProgress.storyteller_id)
Index("idx_storyteller_progress_phase", StorytellerProgress.current_phase, StorytellerProgress.phase_status)


class StorytellerSectionSelection(Base):
    """Which narrative lanes (sections) the storyteller chose to work on.

    Tracks section selection context, priority, and user notes about
    why they want to work on specific sections.
    """

    __tablename__ = "storyteller_section_selection"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the section selection",
    )
    storyteller_id = Column(
        UUID(as_uuid=True),
        ForeignKey("storyteller.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the parent storyteller",
    )
    process_section_id = Column(
        UUID(as_uuid=True),
        ForeignKey("process_section.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the process section",
    )

    # Selection context
    selected_during_phase = Column(
        String(50),
        doc="Phase: 'initial_selection', 'progressive_unlock'",
    )
    selection_reason = Column(
        String(100),
        doc="Reason: 'user_choice', 'scope_enabled', 'profile_enabled', 'prerequisite_met', 'agent_suggested'",
    )

    # Priority
    priority_level = Column(
        String(50),
        doc="Priority: 'high', 'medium', 'low'",
    )
    is_required = Column(
        Boolean,
        default=False,
        doc="Required by scope",
    )

    # User context
    selected_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the section was selected",
    )
    user_notes = Column(
        Text,
        doc="Why storyteller wants to work on this",
    )

    # Unique constraint
    __table_args__ = (
        UniqueConstraint("storyteller_id", "process_section_id", name="uq_section_selection"),
    )

    # Relationships
    storyteller = relationship(
        "Storyteller",
        backref="section_selections",
    )
    process_section = relationship(
        "ProcessSection",
    )


# Index for storyteller_section_selection
Index("idx_section_selection_storyteller", StorytellerSectionSelection.storyteller_id)


class StorytellerSectionStatus(Base):
    """Detailed status of each section for a storyteller.

    Tracks section status including unlock logic, progress,
    and prerequisite information.
    """

    __tablename__ = "storyteller_section_status"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the section status",
    )
    storyteller_id = Column(
        UUID(as_uuid=True),
        ForeignKey("storyteller.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the parent storyteller",
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
        default="locked",
        doc="Status: 'locked', 'unlocked', 'in_progress', 'completed', 'skipped'",
    )

    # Unlock logic
    unlocked_at = Column(
        DateTime,
        doc="Timestamp when the section was unlocked",
    )
    unlocked_by = Column(
        String(100),
        doc="Unlocked by: 'scope', 'profile', 'prerequisite', 'manual'",
    )
    unlock_reason = Column(
        Text,
        doc="Reason for unlocking",
    )

    # Progress
    started_at = Column(
        DateTime,
        doc="Timestamp when the section was started",
    )
    completed_at = Column(
        DateTime,
        doc="Timestamp when the section was completed",
    )
    skipped_at = Column(
        DateTime,
        doc="Timestamp when the section was skipped",
    )
    skip_reason = Column(
        Text,
        doc="Reason for skipping",
    )

    # Content metrics
    prompts_answered = Column(
        Integer,
        default=0,
        doc="Number of prompts answered",
    )
    prompts_total = Column(
        Integer,
        doc="Total number of prompts",
    )
    scenes_captured = Column(
        Integer,
        default=0,
        doc="Number of scenes captured",
    )
    life_events_created = Column(
        Integer,
        default=0,
        doc="Number of life events created",
    )
    completion_percentage = Column(
        Integer,
        default=0,
        doc="Completion percentage (0-100)",
    )

    # Prerequisites
    prerequisite_sections_met = Column(
        Boolean,
        default=False,
        doc="Whether prerequisite sections are met",
    )
    prerequisite_notes = Column(
        Text,
        doc="Notes about prerequisites",
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

    # Unique constraint
    __table_args__ = (
        UniqueConstraint("storyteller_id", "process_section_id", name="uq_section_status"),
    )

    # Relationships
    storyteller = relationship(
        "Storyteller",
        backref="section_statuses",
    )
    process_section = relationship(
        "ProcessSection",
    )


# Indexes for storyteller_section_status
Index("idx_section_status_storyteller", StorytellerSectionStatus.storyteller_id, StorytellerSectionStatus.status)
Index("idx_section_status_section", StorytellerSectionStatus.process_section_id)


class ScopeType(Base):
    """Formal definitions of scope types and their implications.

    Defines scope types like 'whole_life', 'major_chapter', 'single_event'
    with their requirements, enabled sections, and completion criteria.
    """

    __tablename__ = "scope_type"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the scope type",
    )
    process_version_id = Column(
        UUID(as_uuid=True),
        ForeignKey("process_version.id", ondelete="CASCADE"),
        nullable=True,
        doc="Reference to the process version",
    )

    # Scope identity
    scope_key = Column(
        String(50),
        unique=True,
        nullable=False,
        doc="Scope key: 'whole_life', 'major_chapter', 'single_event', 'unsure'",
    )
    scope_name = Column(
        String(200),
        nullable=False,
        doc="Scope name, e.g., 'My whole life story'",
    )
    scope_description = Column(
        Text,
        doc="Description of the scope type",
    )

    # User-facing
    user_facing_label = Column(
        String(200),
        doc="User-facing label",
    )
    user_facing_description = Column(
        Text,
        doc="User-facing description",
    )
    example_use_cases = Column(
        ARRAY(Text),
        doc="Example use cases",
    )

    # System implications
    required_context_fields = Column(
        JSONB,
        doc="What context must be gathered, e.g., {'birth_year': true, 'major_moves': true}",
    )
    enabled_sections = Column(
        ARRAY(Text),
        doc="Which process sections are enabled",
    )
    suggested_sections = Column(
        ARRAY(Text),
        doc="Which sections are suggested",
    )
    minimum_life_events = Column(
        Integer,
        doc="Minimum events to consider complete",
    )
    estimated_sessions = Column(
        Integer,
        doc="Rough estimate of sessions needed",
    )

    # Completion criteria
    completion_criteria = Column(
        JSONB,
        doc="What defines 'complete' for this scope, e.g., {'sections_completed': 5, 'events_captured': 10}",
    )

    # Defaults
    default_narrative_structure = Column(
        String(100),
        doc="Default narrative structure: 'linear', 'thematic', etc.",
    )

    # Ordering
    display_order = Column(
        Integer,
        doc="Display order",
    )

    # Status
    is_active = Column(
        Boolean,
        default=True,
        doc="Whether the scope type is active",
    )

    # Timestamps
    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the scope type was created",
    )
    updated_at = Column(
        DateTime,
        default=datetime.now,
        onupdate=datetime.now,
        doc="Timestamp when the scope type was last updated",
    )

    # Relationships
    process_version = relationship(
        "ProcessVersion",
    )


# Index for scope_type
Index("idx_scope_type_key", ScopeType.scope_key)


class ArchetypeAnalysis(Base):
    """AI inference of narrative archetypes with confidence scoring and verification.

    Stores archetype analysis results including primary and secondary archetypes,
    supporting evidence, identity analysis, and user verification.
    """

    __tablename__ = "archetype_analysis"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the archetype analysis",
    )
    storyteller_id = Column(
        UUID(as_uuid=True),
        ForeignKey("storyteller.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the parent storyteller",
    )

    # Analysis scope
    analysis_scope = Column(
        String(50),
        doc="Scope: 'whole_story', 'collection', 'story_book'",
    )
    collection_id = Column(
        UUID(as_uuid=True),
        ForeignKey("collection.id", ondelete="CASCADE"),
        nullable=True,
        doc="Reference to the collection if applicable",
    )
    story_id = Column(
        UUID(as_uuid=True),
        ForeignKey("story.id", ondelete="CASCADE"),
        nullable=True,
        doc="Reference to the story if applicable",
    )

    # Analysis version
    analysis_version = Column(
        Integer,
        default=1,
        doc="Reanalysis creates new version",
    )
    analyzed_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the analysis was performed",
    )

    # Primary archetype inference
    inferred_archetype = Column(
        String(100),
        doc="Primary archetype: 'loss_to_connection', 'transformation', 'endurance', 'threat_survival', 'identity_shift', 'meaning_making'",
    )
    confidence_score = Column(
        Numeric(3, 2),
        doc="Confidence score (0.00 to 1.00)",
    )

    # Supporting analysis
    supporting_evidence = Column(
        JSONB,
        doc="Structured evidence with indicators",
    )
    narrative_patterns = Column(
        ARRAY(Text),
        doc="Detected patterns",
    )
    thematic_indicators = Column(
        ARRAY(Text),
        doc="Themes that support archetype",
    )
    emotional_arc_description = Column(
        Text,
        doc="Description of emotional journey",
    )
    character_development_notes = Column(
        Text,
        doc="How protagonist (storyteller) changes",
    )

    # Alternative archetypes
    secondary_archetype = Column(
        String(100),
        doc="Second-best fit archetype",
    )
    secondary_confidence = Column(
        Numeric(3, 2),
        doc="Confidence score for secondary archetype",
    )
    alternative_archetypes = Column(
        JSONB,
        doc="Other considered archetypes with scores",
    )

    # Identity analysis
    identity_before = Column(
        Text,
        doc="Identity at story beginning",
    )
    identity_after = Column(
        Text,
        doc="Identity at story end",
    )
    identity_shift_type = Column(
        String(100),
        doc="Shift type: 'radical', 'gradual', 'cyclical', 'static'",
    )

    # Relationship to loss/agency/meaning
    relationship_to_loss = Column(
        Text,
        doc="Relationship to loss",
    )
    relationship_to_agency = Column(
        Text,
        doc="Relationship to agency",
    )
    relationship_to_meaning = Column(
        Text,
        doc="Relationship to meaning",
    )

    # User interaction
    revealed_to_user = Column(
        Boolean,
        default=False,
        doc="Hidden by default (process.txt Phase 10)",
    )
    revealed_at = Column(
        DateTime,
        doc="Timestamp when revealed to user",
    )
    user_feedback_received = Column(
        Boolean,
        default=False,
        doc="Whether user feedback was received",
    )
    user_confirmed = Column(
        Boolean,
        doc="User agreed with inference",
    )
    user_reframed_as = Column(
        String(100),
        doc="User's preferred framing",
    )
    user_reframe_notes = Column(
        Text,
        doc="User's reframe notes",
    )

    # System notes
    analysis_method = Column(
        String(100),
        doc="Method: 'ai_inference', 'user_specified', 'hybrid'",
    )
    analysis_notes = Column(
        Text,
        doc="Analysis notes",
    )

    # Self-reference for previous analysis
    previous_analysis_id = Column(
        UUID(as_uuid=True),
        ForeignKey("archetype_analysis.id"),
        nullable=True,
        doc="Reference to previous analysis version",
    )

    # Timestamps
    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the analysis was created",
    )
    updated_at = Column(
        DateTime,
        default=datetime.now,
        onupdate=datetime.now,
        doc="Timestamp when the analysis was last updated",
    )

    # Relationships
    storyteller = relationship(
        "Storyteller",
        backref="archetype_analyses",
    )
    collection = relationship(
        "Collection",
    )
    story = relationship(
        "Story",
    )
    previous_analysis = relationship(
        "ArchetypeAnalysis",
        remote_side=[id],
        foreign_keys=[previous_analysis_id],
    )


# Indexes for archetype_analysis
Index("idx_archetype_analysis_storyteller", ArchetypeAnalysis.storyteller_id)
Index("idx_archetype_analysis_collection", ArchetypeAnalysis.collection_id)
Index("idx_archetype_analysis_story", ArchetypeAnalysis.story_id)
Index("idx_archetype_analysis_revealed", ArchetypeAnalysis.revealed_to_user)


class UserFeedback(Base):
    """Centralized feedback on any system element for learning and improvement.

    Tracks feedback on collections, syntheses, archetypes, drafts, chapters,
    prompts, sections, agent interactions, and system elements.
    """

    __tablename__ = "user_feedback"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the user feedback",
    )
    storyteller_id = Column(
        UUID(as_uuid=True),
        ForeignKey("storyteller.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the parent storyteller",
    )
    user_id = Column(
        UUID(as_uuid=True),
        nullable=True,
        doc="Reference to the user who gave feedback",
    )

    # What is this feedback on?
    feedback_on_type = Column(
        String(50),
        doc="Type: 'collection', 'synthesis', 'archetype', 'draft', 'chapter', 'prompt', 'section', 'agent_interaction', 'system'",
    )
    feedback_on_id = Column(
        UUID(as_uuid=True),
        doc="ID of the thing (polymorphic)",
    )
    feedback_on_name = Column(
        String(200),
        doc="Human-readable name",
    )

    # Feedback type
    feedback_type = Column(
        String(50),
        doc="Type: 'approval', 'correction', 'rejection', 'revision_request', 'suggestion', 'concern'",
    )
    feedback_category = Column(
        String(100),
        doc="Category: 'accuracy', 'tone', 'completeness', 'privacy', 'relevance', 'quality'",
    )

    # Feedback content
    feedback_text = Column(
        Text,
        nullable=False,
        doc="The feedback text",
    )
    specific_issue = Column(
        Text,
        doc="What specifically is the problem",
    )
    suggested_change = Column(
        Text,
        doc="What should be different",
    )

    # Sentiment
    sentiment = Column(
        String(50),
        doc="Sentiment: 'positive', 'neutral', 'negative'",
    )

    # Priority
    priority = Column(
        String(50),
        doc="Priority: 'critical', 'important', 'minor'",
    )
    requires_immediate_action = Column(
        Boolean,
        default=False,
        doc="Whether immediate action is required",
    )

    # Response
    agent_response = Column(
        Text,
        doc="Agent response to feedback",
    )
    resolution_status = Column(
        String(50),
        doc="Status: 'pending', 'acknowledged', 'resolved', 'cannot_resolve', 'wont_fix'",
    )
    resolved_at = Column(
        DateTime,
        doc="Timestamp when resolved",
    )
    resolution_notes = Column(
        Text,
        doc="Resolution notes",
    )

    # Learning
    used_for_improvement = Column(
        Boolean,
        default=False,
        doc="Whether used for improvement",
    )
    improvement_notes = Column(
        Text,
        doc="Improvement notes",
    )

    # Timestamps
    feedback_given_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when feedback was given",
    )
    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the feedback was created",
    )

    # Relationships
    storyteller = relationship(
        "Storyteller",
        backref="user_feedbacks",
    )


# Indexes for user_feedback
Index("idx_user_feedback_storyteller", UserFeedback.storyteller_id)
Index("idx_user_feedback_type", UserFeedback.feedback_on_type, UserFeedback.feedback_on_id)
Index("idx_user_feedback_resolution", UserFeedback.resolution_status)
Index("idx_user_feedback_priority", UserFeedback.priority, UserFeedback.requires_immediate_action)


class Agent(Base):
    """Reusable agent definitions that can be instantiated across storytellers.

    Contains agent identity, purpose, behavior configuration, capabilities,
    process integration, and prompt templates.
    """

    __tablename__ = "agent"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the agent",
    )

    # Agent identity
    agent_key = Column(
        String(100),
        unique=True,
        nullable=False,
        doc="Agent key: 'capture_agent', 'synthesis_agent', 'reflection_agent'",
    )
    agent_name = Column(
        String(200),
        nullable=False,
        doc="Agent name, e.g., 'Story Capture Agent'",
    )
    agent_description = Column(
        Text,
        doc="Description of the agent",
    )

    # Agent purpose
    agent_type = Column(
        String(50),
        doc="Type: 'capture', 'synthesis', 'reflection', 'analysis', 'guidance', 'editor'",
    )
    primary_objective = Column(
        Text,
        doc="Core goal of this agent",
    )
    secondary_objectives = Column(
        ARRAY(Text),
        doc="Additional goals",
    )

    # Agent behavior
    base_constraints = Column(
        ARRAY(Text),
        doc="Universal constraints for this agent type",
    )
    default_tone = Column(
        String(50),
        doc="Tone: 'empathetic', 'neutral', 'encouraging', 'analytical'",
    )
    persona_description = Column(
        Text,
        doc="How agent presents itself",
    )
    communication_style = Column(
        Text,
        doc="How agent communicates",
    )

    # Capabilities
    can_create_artifacts = Column(
        Boolean,
        default=True,
        doc="Whether agent can create artifacts",
    )
    can_analyze_content = Column(
        Boolean,
        default=True,
        doc="Whether agent can analyze content",
    )
    can_generate_prompts = Column(
        Boolean,
        default=True,
        doc="Whether agent can generate prompts",
    )
    can_provide_feedback = Column(
        Boolean,
        default=True,
        doc="Whether agent can provide feedback",
    )

    # Process integration
    used_in_process_phases = Column(
        ARRAY(Text),
        doc="Which phases this agent is used in",
    )
    suggested_for_node_types = Column(
        ARRAY(Text),
        doc="Which process node types",
    )

    # Prompt templates
    system_prompt_template = Column(
        Text,
        doc="Base system prompt",
    )
    greeting_template = Column(
        Text,
        doc="How agent introduces itself",
    )
    closing_template = Column(
        Text,
        doc="How agent concludes",
    )

    # Configuration
    default_model = Column(
        String(50),
        doc="Default model: 'gpt-4', 'claude-3', etc.",
    )
    temperature = Column(
        Numeric(2, 1),
        doc="Temperature setting",
    )
    max_tokens = Column(
        Integer,
        doc="Maximum tokens",
    )
    configuration = Column(
        JSONB,
        doc="Additional configuration",
    )

    # Status
    is_active = Column(
        Boolean,
        default=True,
        doc="Whether the agent is active",
    )
    version = Column(
        Integer,
        default=1,
        doc="Version number",
    )

    # Timestamps
    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the agent was created",
    )
    updated_at = Column(
        DateTime,
        default=datetime.now,
        onupdate=datetime.now,
        doc="Timestamp when the agent was last updated",
    )

    # Relationships
    instances = relationship(
        "AgentInstance",
        back_populates="agent",
        cascade="all, delete-orphan",
    )


# Indexes for agent
Index("idx_agent_key", Agent.agent_key)
Index("idx_agent_type", Agent.agent_type)


class AgentInstance(Base):
    """Specific instantiation of an agent for a session.

    Contains instance configuration, context, overrides, lifecycle,
    performance metrics, and quality information.
    """

    __tablename__ = "agent_instance"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the agent instance",
    )
    agent_id = Column(
        UUID(as_uuid=True),
        ForeignKey("agent.id", ondelete="SET NULL"),
        nullable=True,
        doc="Reference to the parent agent",
    )
    session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("session.id", ondelete="CASCADE"),
        nullable=True,
        doc="Reference to the session",
    )
    storyteller_id = Column(
        UUID(as_uuid=True),
        ForeignKey("storyteller.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the storyteller",
    )

    # Instance configuration
    instance_objective = Column(
        Text,
        doc="Specific objective for this instance",
    )
    instance_constraints = Column(
        ARRAY(Text),
        doc="Additional constraints for this instance",
    )

    # Context passed to agent
    agent_context = Column(
        JSONB,
        doc="Context including storyteller, boundaries, scope, current_section, life_events",
    )

    # Overrides
    tone_override = Column(
        String(50),
        doc="Override default tone",
    )
    model_override = Column(
        String(50),
        doc="Override default model",
    )
    temperature_override = Column(
        Numeric(2, 1),
        doc="Override temperature",
    )

    # Instance lifecycle
    status = Column(
        String(50),
        default="active",
        doc="Status: 'active', 'completed', 'paused', 'failed'",
    )
    started_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the instance started",
    )
    completed_at = Column(
        DateTime,
        doc="Timestamp when the instance completed",
    )
    paused_at = Column(
        DateTime,
        doc="Timestamp when the instance was paused",
    )
    failed_at = Column(
        DateTime,
        doc="Timestamp when the instance failed",
    )
    failure_reason = Column(
        Text,
        doc="Reason for failure",
    )

    # Performance
    total_interactions = Column(
        Integer,
        default=0,
        doc="Total number of interactions",
    )
    total_artifacts_created = Column(
        Integer,
        default=0,
        doc="Total artifacts created",
    )
    average_response_time_ms = Column(
        Integer,
        doc="Average response time in milliseconds",
    )

    # Quality
    user_satisfaction_rating = Column(
        Integer,
        doc="User satisfaction rating (1-5)",
    )
    flagged_for_review = Column(
        Boolean,
        default=False,
        doc="Whether flagged for review",
    )
    review_notes = Column(
        Text,
        doc="Review notes",
    )

    # Timestamps
    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the instance was created",
    )
    updated_at = Column(
        DateTime,
        default=datetime.now,
        onupdate=datetime.now,
        doc="Timestamp when the instance was last updated",
    )

    # Relationships
    agent = relationship(
        "Agent",
        back_populates="instances",
    )
    session = relationship(
        "StorytellerSession",
        backref="agent_instances",
    )
    storyteller = relationship(
        "Storyteller",
        backref="agent_instances",
    )


# Indexes for agent_instance
Index("idx_agent_instance_agent", AgentInstance.agent_id)
Index("idx_agent_instance_session", AgentInstance.session_id)
Index("idx_agent_instance_storyteller", AgentInstance.storyteller_id)
Index("idx_agent_instance_status", AgentInstance.status)


class Requirement(Base):
    """Requirements for story capture process.

    Tracks requirements that need to be fulfilled during the story
    capture process, linked to storytellers, sections, events, etc.
    """

    __tablename__ = "requirement"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the requirement",
    )
    storyteller_id = Column(
        UUID(as_uuid=True),
        ForeignKey("storyteller.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the storyteller",
    )
    process_section_id = Column(
        UUID(as_uuid=True),
        ForeignKey("process_section.id", ondelete="SET NULL"),
        nullable=True,
        doc="Reference to the process section",
    )
    life_event_id = Column(
        UUID(as_uuid=True),
        ForeignKey("life_event.id", ondelete="SET NULL"),
        nullable=True,
        doc="Reference to the life event",
    )
    collection_id = Column(
        UUID(as_uuid=True),
        ForeignKey("collection.id", ondelete="SET NULL"),
        nullable=True,
        doc="Reference to the collection",
    )
    session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("session.id", ondelete="SET NULL"),
        nullable=True,
        doc="Reference to the session",
    )

    # Requirement details
    requirement_type = Column(
        String(100),
        doc="Type of requirement",
    )
    requirement_name = Column(
        String(200),
        nullable=False,
        doc="Name of the requirement",
    )
    description = Column(
        Text,
        doc="Description of what is required",
    )

    # Priority
    priority = Column(
        String(50),
        doc="Priority: 'critical', 'high', 'medium', 'low'",
    )
    is_required = Column(
        Boolean,
        default=True,
        doc="Whether this requirement is mandatory",
    )

    # Status
    status = Column(
        String(50),
        default="pending",
        doc="Status: 'pending', 'in_progress', 'completed', 'skipped'",
    )
    completed_at = Column(
        DateTime,
        doc="Timestamp when completed",
    )
    completion_notes = Column(
        Text,
        doc="Notes about completion",
    )

    # Timestamps
    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the requirement was created",
    )
    updated_at = Column(
        DateTime,
        default=datetime.now,
        onupdate=datetime.now,
        doc="Timestamp when the requirement was last updated",
    )

    # Relationships
    storyteller = relationship(
        "Storyteller",
        backref="requirements",
    )
    process_section = relationship(
        "ProcessSection",
    )
    life_event = relationship(
        "LifeEvent",
    )
    collection = relationship(
        "Collection",
    )
    session = relationship(
        "StorytellerSession",
        backref="requirements",
    )


# Indexes for requirement
Index("idx_requirement_storyteller", Requirement.storyteller_id)
Index("idx_requirement_status", Requirement.status)


class EditRequirement(Base):
    """Requirements for story editing process.

    Tracks editing requirements for the story, chapters, sections,
    characters, and themes.
    """

    __tablename__ = "edit_requirement"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the edit requirement",
    )
    story_id = Column(
        UUID(as_uuid=True),
        ForeignKey("story.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the story",
    )
    storyteller_id = Column(
        UUID(as_uuid=True),
        ForeignKey("storyteller.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the storyteller",
    )
    chapter_id = Column(
        UUID(as_uuid=True),
        ForeignKey("story_chapter.id", ondelete="SET NULL"),
        nullable=True,
        doc="Reference to the chapter",
    )
    section_id = Column(
        UUID(as_uuid=True),
        ForeignKey("chapter_section.id", ondelete="SET NULL"),
        nullable=True,
        doc="Reference to the chapter section",
    )
    character_id = Column(
        UUID(as_uuid=True),
        ForeignKey("story_character.id", ondelete="SET NULL"),
        nullable=True,
        doc="Reference to the story character",
    )
    theme_id = Column(
        UUID(as_uuid=True),
        ForeignKey("story_theme.id", ondelete="SET NULL"),
        nullable=True,
        doc="Reference to the story theme",
    )

    # Edit requirement details
    edit_type = Column(
        String(100),
        doc="Type: 'structural', 'content', 'style', 'consistency', 'factual'",
    )
    requirement_name = Column(
        String(200),
        nullable=False,
        doc="Name of the edit requirement",
    )
    description = Column(
        Text,
        doc="Description of what needs to be edited",
    )
    specific_changes = Column(
        Text,
        doc="Specific changes required",
    )

    # Priority
    priority = Column(
        String(50),
        doc="Priority: 'critical', 'high', 'medium', 'low'",
    )

    # Source
    source = Column(
        String(100),
        doc="Source: 'user_feedback', 'ai_analysis', 'consistency_check', 'editor_review'",
    )

    # Status
    status = Column(
        String(50),
        default="pending",
        doc="Status: 'pending', 'in_progress', 'completed', 'rejected'",
    )
    completed_at = Column(
        DateTime,
        doc="Timestamp when completed",
    )
    completion_notes = Column(
        Text,
        doc="Notes about completion or rejection",
    )

    # Timestamps
    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the edit requirement was created",
    )
    updated_at = Column(
        DateTime,
        default=datetime.now,
        onupdate=datetime.now,
        doc="Timestamp when the edit requirement was last updated",
    )

    # Relationships
    story = relationship(
        "Story",
        backref="edit_requirements",
    )
    storyteller = relationship(
        "Storyteller",
        backref="edit_requirements",
    )
    chapter = relationship(
        "StoryChapter",
    )
    section = relationship(
        "ChapterSection",
    )
    character = relationship(
        "StoryCharacter",
    )
    theme = relationship(
        "StoryTheme",
    )


# Indexes for edit_requirement
Index("idx_edit_requirement_story", EditRequirement.story_id)
Index("idx_edit_requirement_storyteller", EditRequirement.storyteller_id)
Index("idx_edit_requirement_status", EditRequirement.status)


class BookExport(Base):
    """Final manuscript exports in various formats.

    Tracks export generation for different formats like PDF, EPUB,
    DOCX, etc., including status, output files, and expiry.
    """

    __tablename__ = "book_export"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the book export",
    )
    story_id = Column(
        UUID(as_uuid=True),
        ForeignKey("story.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the story",
    )
    storyteller_id = Column(
        UUID(as_uuid=True),
        ForeignKey("storyteller.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the storyteller",
    )

    # Export details
    export_format = Column(
        String(50),
        doc="Format: 'pdf', 'epub', 'mobi', 'docx', 'print_ready', 'html', 'markdown'",
    )
    export_version = Column(
        Integer,
        default=1,
        doc="Version number of this export",
    )

    # Export scope
    export_scope = Column(
        String(50),
        doc="Scope: 'full_book', 'chapter', 'collection', 'preview'",
    )
    chapter_ids = Column(
        ARRAY(UUID(as_uuid=True)),
        doc="If exporting specific chapters",
    )
    collection_ids = Column(
        ARRAY(UUID(as_uuid=True)),
        doc="If exporting specific collections",
    )

    # Format options
    format_options = Column(
        JSONB,
        doc="Format options like page_size, font, include_images, include_toc",
    )

    # Status
    export_status = Column(
        String(50),
        default="queued",
        doc="Status: 'queued', 'generating', 'ready', 'failed', 'expired'",
    )

    # Generation
    generation_started_at = Column(
        DateTime,
        doc="Timestamp when generation started",
    )
    generation_completed_at = Column(
        DateTime,
        doc="Timestamp when generation completed",
    )
    generation_duration_seconds = Column(
        Integer,
        doc="Duration of generation in seconds",
    )

    # Output
    file_url = Column(
        Text,
        doc="URL to download file",
    )
    file_size_bytes = Column(
        BigInteger,
        doc="File size in bytes",
    )
    file_checksum = Column(
        String(64),
        doc="File checksum",
    )
    page_count = Column(
        Integer,
        doc="Page count",
    )
    word_count = Column(
        Integer,
        doc="Word count",
    )

    # Expiry
    expires_at = Column(
        DateTime,
        doc="Export files auto-expire",
    )
    downloaded_count = Column(
        Integer,
        default=0,
        doc="Number of times downloaded",
    )
    last_downloaded_at = Column(
        DateTime,
        doc="Timestamp of last download",
    )

    # Errors
    failed_at = Column(
        DateTime,
        doc="Timestamp when failed",
    )
    failure_reason = Column(
        Text,
        doc="Reason for failure",
    )
    error_log = Column(
        Text,
        doc="Error log",
    )

    # Metadata
    generated_by = Column(
        String(100),
        doc="Generated by: 'user_request', 'scheduled', 'preview'",
    )
    generation_notes = Column(
        Text,
        doc="Generation notes",
    )

    # Timestamps
    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the export was created",
    )

    # Relationships
    story = relationship(
        "Story",
        backref="exports",
    )
    storyteller = relationship(
        "Storyteller",
        backref="book_exports",
    )
    deliveries = relationship(
        "BookExportDelivery",
        back_populates="book_export",
        cascade="all, delete-orphan",
    )


# Indexes for book_export
Index("idx_book_export_story", BookExport.story_id)
Index("idx_book_export_storyteller", BookExport.storyteller_id)
Index("idx_book_export_status", BookExport.export_status)
Index("idx_book_export_expires", BookExport.expires_at)


class BookExportDelivery(Base):
    """Track delivery of exports to storyteller.

    Tracks delivery methods like download, email, cloud storage,
    or print service, along with delivery status.
    """

    __tablename__ = "book_export_delivery"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the delivery",
    )
    book_export_id = Column(
        UUID(as_uuid=True),
        ForeignKey("book_export.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the book export",
    )
    storyteller_id = Column(
        UUID(as_uuid=True),
        ForeignKey("storyteller.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the storyteller",
    )

    # Delivery method
    delivery_method = Column(
        String(50),
        doc="Method: 'download', 'email', 'cloud_storage', 'print_service'",
    )

    # Delivery details
    delivered_to = Column(
        String(300),
        doc="Email address, storage path, etc.",
    )
    delivery_status = Column(
        String(50),
        doc="Status: 'pending', 'sent', 'delivered', 'failed'",
    )

    # Tracking
    delivered_at = Column(
        DateTime,
        doc="Timestamp when delivered",
    )
    opened_at = Column(
        DateTime,
        doc="If email, when opened",
    )
    downloaded_at = Column(
        DateTime,
        doc="Timestamp when downloaded",
    )

    failure_reason = Column(
        Text,
        doc="Reason for failure",
    )

    # Timestamps
    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the delivery was created",
    )

    # Relationships
    book_export = relationship(
        "BookExport",
        back_populates="deliveries",
    )
    storyteller = relationship(
        "Storyteller",
        backref="export_deliveries",
    )


# Indexes for book_export_delivery
Index("idx_book_export_delivery_export", BookExportDelivery.book_export_id)
Index("idx_book_export_delivery_status", BookExportDelivery.delivery_status)


# Export all models
__all__ = [
    "StorytellerProgress",
    "StorytellerSectionSelection",
    "StorytellerSectionStatus",
    "ScopeType",
    "ArchetypeAnalysis",
    "UserFeedback",
    "Agent",
    "AgentInstance",
    "Requirement",
    "EditRequirement",
    "BookExport",
    "BookExportDelivery",
]
