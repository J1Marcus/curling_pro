"""
Storyteller and Life Event Models Module

This module defines SQLAlchemy models for the storyteller domain.
Storytellers are the people whose life stories are being captured.
Life events are the core organizing principle for story organization.

Design Philosophy:
- Storyteller: Immutable facts only (DOB, birthplace, name)
- Life Events: Core organizing principle (not timeline)
- Hierarchical: Proper parent/child relationships for flexibility
- Event-specific boundaries: Privacy at both storyteller and event level
- Trauma-aware: Classification and resolution tracking
- Privacy-first: Sensitive data encrypted at rest, GDPR compliant

Models included:
- Storyteller: The person whose life story is being captured
- StorytellerBoundary: General comfort levels across all topics
- StorytellerPreference: General working preferences and book goals
- LifeEvent: The fundamental unit of story organization
- LifeEventTimespan: Events can have multiple timespans
- LifeEventLocation: Events can happen in multiple places
- LifeEventParticipant: People involved in events with roles
- LifeEventDetail: Flexible key-value storage for event-specific facts
- LifeEventTrauma: Trauma markers and resolution tracking
- LifeEventBoundary: Event-specific privacy and comfort overrides
- LifeEventMedia: Media linked to specific events
- LifeEventPreference: Event-specific capture and handling preferences
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import relationship

from database.session import Base


class Storyteller(Base):
    """The person whose life story is being captured.

    Contains immutable biographical facts only. Current state and
    preferences are stored in related tables.
    """

    __tablename__ = "storyteller"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the storyteller",
    )

    # Account relationship
    user_id = Column(
        UUID(as_uuid=True),
        nullable=True,
        doc="Reference to the user who owns this storyteller",
    )
    relationship_to_user = Column(
        String(50),
        doc="Relationship: 'self', 'parent', 'grandparent', 'spouse', 'friend', 'client'",
    )

    # Identity (immutable)
    first_name = Column(
        String(100),
        doc="First name of the storyteller",
    )
    middle_name = Column(
        String(100),
        doc="Middle name of the storyteller",
    )
    last_name = Column(
        String(100),
        doc="Last name of the storyteller",
    )
    preferred_name = Column(
        String(100),
        doc="What they like to be called",
    )

    # Birth (immutable)
    birth_year = Column(
        Integer,
        doc="Year of birth",
    )
    birth_month = Column(
        Integer,
        doc="Month of birth (1-12)",
    )
    birth_day = Column(
        Integer,
        doc="Day of birth (1-31)",
    )
    birth_place = Column(
        String(200),
        doc="Birth location: City, State/Country",
    )

    # Current state
    is_living = Column(
        Boolean,
        default=True,
        doc="Whether the storyteller is living",
    )
    current_location = Column(
        String(200),
        doc="Current location, can change but tracks current",
    )

    # Consent
    consent_given = Column(
        Boolean,
        default=False,
        doc="Explicit consent for story capture",
    )
    consent_date = Column(
        DateTime,
        doc="Timestamp when consent was given",
    )

    # Profile
    profile_image_url = Column(
        Text,
        doc="URL to profile image",
    )

    # Status
    is_active = Column(
        Boolean,
        default=True,
        doc="Whether the storyteller is active",
    )

    # Metadata
    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the storyteller was created",
    )
    updated_at = Column(
        DateTime,
        default=datetime.now,
        onupdate=datetime.now,
        doc="Timestamp when the storyteller was last updated",
    )
    deleted_at = Column(
        DateTime,
        nullable=True,
        doc="Soft delete timestamp",
    )

    # Relationships
    boundary = relationship(
        "StorytellerBoundary",
        back_populates="storyteller",
        uselist=False,
        cascade="all, delete-orphan",
    )
    preference = relationship(
        "StorytellerPreference",
        back_populates="storyteller",
        uselist=False,
        cascade="all, delete-orphan",
    )
    life_events = relationship(
        "LifeEvent",
        back_populates="storyteller",
        cascade="all, delete-orphan",
    )


# Index for storyteller
Index("idx_storyteller_user", Storyteller.user_id, Storyteller.is_active)


class StorytellerBoundary(Base):
    """General comfort levels across all topics (storyteller-wide defaults).

    These are default boundaries that can be overridden at the
    life event level using LifeEventBoundary.
    """

    __tablename__ = "storyteller_boundary"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the boundary record",
    )
    storyteller_id = Column(
        UUID(as_uuid=True),
        ForeignKey("storyteller.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        doc="Reference to the parent storyteller",
    )

    # General topic comfort (defaults)
    comfortable_discussing_romance = Column(
        Boolean,
        default=True,
        doc="Comfortable discussing romance topics",
    )
    comfortable_discussing_intimacy = Column(
        Boolean,
        default=False,
        doc="Comfortable discussing intimacy topics",
    )
    comfortable_discussing_loss = Column(
        Boolean,
        default=True,
        doc="Comfortable discussing loss topics",
    )
    comfortable_discussing_trauma = Column(
        Boolean,
        default=False,
        doc="Comfortable discussing trauma topics",
    )
    comfortable_discussing_illness = Column(
        Boolean,
        default=True,
        doc="Comfortable discussing illness topics",
    )
    comfortable_discussing_conflict = Column(
        Boolean,
        default=True,
        doc="Comfortable discussing conflict topics",
    )
    comfortable_discussing_faith = Column(
        Boolean,
        default=True,
        doc="Comfortable discussing faith topics",
    )
    comfortable_discussing_finances = Column(
        Boolean,
        default=False,
        doc="Comfortable discussing finances topics",
    )

    # Content preferences
    prefers_some_private = Column(
        Boolean,
        default=False,
        doc="Will capture things not for book",
    )
    wants_explicit_warnings = Column(
        Boolean,
        default=True,
        doc="Wants warnings before sensitive questions",
    )

    # Off-limit topics (general)
    off_limit_topics = Column(
        ARRAY(Text),
        doc="Array of off-limit topic strings",
    )

    # Tier comfort level
    maximum_tier_comfortable = Column(
        Integer,
        default=2,
        doc="Maximum tier: 1=safe, 2=optional, 3=private",
    )

    # Additional notes
    additional_notes = Column(
        Text,
        doc="Additional boundary notes",
    )

    # Timestamps
    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the boundary was created",
    )
    updated_at = Column(
        DateTime,
        default=datetime.now,
        onupdate=datetime.now,
        doc="Timestamp when the boundary was last updated",
    )

    # Relationships
    storyteller = relationship(
        "Storyteller",
        back_populates="boundary",
    )


class StorytellerPreference(Base):
    """General working preferences and book goals.

    Defines how the storyteller prefers to work and what kind of
    book they want to create.
    """

    __tablename__ = "storyteller_preference"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the preference record",
    )
    storyteller_id = Column(
        UUID(as_uuid=True),
        ForeignKey("storyteller.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        doc="Reference to the parent storyteller",
    )

    # Capture method
    preferred_input_method = Column(
        String(50),
        doc="Preferred input: 'text', 'voice', 'mixed'",
    )
    session_length_preference = Column(
        String(50),
        doc="Session length: 'short' (15min), 'medium' (30min), 'long' (45min+)",
    )

    # Book style
    desired_book_tone = Column(
        String(50),
        doc="Tone: 'reflective', 'conversational', 'literary', 'straightforward'",
    )
    desired_book_length = Column(
        String(50),
        doc="Length: 'concise', 'moderate', 'comprehensive'",
    )

    # Content preferences
    wants_photos_included = Column(
        Boolean,
        default=True,
        doc="Include photos in book",
    )
    wants_documents_included = Column(
        Boolean,
        default=True,
        doc="Include documents in book",
    )
    wants_letters_quotes_included = Column(
        Boolean,
        default=True,
        doc="Include letters and quotes in book",
    )

    # Audience
    intended_audience = Column(
        String(100),
        doc="Audience: 'family', 'descendants', 'friends', 'public', 'self'",
    )

    # Language
    primary_language = Column(
        String(50),
        default="en",
        doc="Primary language code",
    )

    # Additional preferences
    additional_preferences = Column(
        JSONB,
        doc="Additional preferences as JSON",
    )

    # Timestamps
    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the preference was created",
    )
    updated_at = Column(
        DateTime,
        default=datetime.now,
        onupdate=datetime.now,
        doc="Timestamp when the preference was last updated",
    )

    # Relationships
    storyteller = relationship(
        "Storyteller",
        back_populates="preference",
    )


class LifeEvent(Base):
    """The fundamental unit of story organization.

    Life events are not constrained by a single timeline. They represent
    significant periods, experiences, or themes in the storyteller's life.
    """

    __tablename__ = "life_event"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the life event",
    )
    storyteller_id = Column(
        UUID(as_uuid=True),
        ForeignKey("storyteller.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the parent storyteller",
    )

    # Event identification
    event_type = Column(
        String(100),
        doc="Type: 'childhood', 'education', 'career_period', 'relationship', etc.",
    )
    event_name = Column(
        String(200),
        nullable=False,
        doc="Event name, e.g., 'My time in the Navy'",
    )
    description = Column(
        Text,
        doc="Brief summary of the event",
    )

    # Categorization
    category = Column(
        String(100),
        doc="Category: 'origins', 'family', 'work', 'relationships', 'health', etc.",
    )

    # Significance
    significance_level = Column(
        String(50),
        doc="Level: 'formative', 'major', 'notable', 'minor'",
    )

    # Emotional tone
    emotional_tone = Column(
        String(50),
        doc="Tone: 'joyful', 'difficult', 'mixed', 'neutral', 'transformative'",
    )

    # Narrative role
    is_turning_point = Column(
        Boolean,
        default=False,
        doc="Whether this is a turning point in their life",
    )
    is_ongoing = Column(
        Boolean,
        default=False,
        doc="Whether this event is ongoing",
    )

    # Story inclusion
    include_in_story = Column(
        Boolean,
        default=True,
        doc="Whether to include in the story",
    )
    include_level = Column(
        String(50),
        doc="Level: 'full_detail', 'summary', 'mention', 'omit'",
    )

    # Ordering
    display_order = Column(
        Integer,
        doc="Order for display, not structure",
    )

    # Timestamps
    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the event was created",
    )
    updated_at = Column(
        DateTime,
        default=datetime.now,
        onupdate=datetime.now,
        doc="Timestamp when the event was last updated",
    )

    # Relationships
    storyteller = relationship(
        "Storyteller",
        back_populates="life_events",
    )
    timespans = relationship(
        "LifeEventTimespan",
        back_populates="life_event",
        cascade="all, delete-orphan",
    )
    locations = relationship(
        "LifeEventLocation",
        back_populates="life_event",
        cascade="all, delete-orphan",
    )
    participants = relationship(
        "LifeEventParticipant",
        back_populates="life_event",
        cascade="all, delete-orphan",
    )
    details = relationship(
        "LifeEventDetail",
        back_populates="life_event",
        cascade="all, delete-orphan",
    )
    trauma = relationship(
        "LifeEventTrauma",
        back_populates="life_event",
        uselist=False,
        cascade="all, delete-orphan",
    )
    boundary = relationship(
        "LifeEventBoundary",
        back_populates="life_event",
        uselist=False,
        cascade="all, delete-orphan",
    )
    media = relationship(
        "LifeEventMedia",
        back_populates="life_event",
        cascade="all, delete-orphan",
    )
    preference = relationship(
        "LifeEventPreference",
        back_populates="life_event",
        uselist=False,
        cascade="all, delete-orphan",
    )


# Indexes for life_event
Index("idx_life_event_storyteller", LifeEvent.storyteller_id)
Index("idx_life_event_type", LifeEvent.event_type)


class LifeEventTimespan(Base):
    """Events can have multiple timespans (not just one).

    Allows capturing complex temporal relationships like a military
    career with multiple deployments.
    """

    __tablename__ = "life_event_timespan"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the timespan",
    )
    life_event_id = Column(
        UUID(as_uuid=True),
        ForeignKey("life_event.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the parent life event",
    )

    # Time definition
    timespan_type = Column(
        String(50),
        doc="Type: 'primary', 'secondary', 'recurring', 'specific_moment'",
    )

    start_year = Column(
        Integer,
        doc="Start year",
    )
    start_month = Column(
        Integer,
        doc="Start month (1-12)",
    )
    start_day = Column(
        Integer,
        doc="Start day (1-31)",
    )
    start_approximate = Column(
        Boolean,
        default=False,
        doc="Whether start date is approximate",
    )

    end_year = Column(
        Integer,
        doc="End year",
    )
    end_month = Column(
        Integer,
        doc="End month (1-12)",
    )
    end_day = Column(
        Integer,
        doc="End day (1-31)",
    )
    end_approximate = Column(
        Boolean,
        default=False,
        doc="Whether end date is approximate",
    )

    is_ongoing = Column(
        Boolean,
        default=False,
        doc="Whether this timespan is ongoing",
    )

    # Context
    description = Column(
        Text,
        doc="Description, e.g., 'Served 1968-1972, deployed to Vietnam 1970-1971'",
    )

    order_index = Column(
        Integer,
        doc="Order position among timespans",
    )

    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the timespan was created",
    )

    # Relationships
    life_event = relationship(
        "LifeEvent",
        back_populates="timespans",
    )


# Index for life_event_timespan
Index("idx_life_event_timespan", LifeEventTimespan.life_event_id)


class LifeEventLocation(Base):
    """Events can happen in multiple places.

    Tracks locations associated with a life event, supporting both
    specific places and broader regions.
    """

    __tablename__ = "life_event_location"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the location",
    )
    life_event_id = Column(
        UUID(as_uuid=True),
        ForeignKey("life_event.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the parent life event",
    )

    # Location
    location_name = Column(
        String(200),
        doc="Location name, e.g., 'San Francisco, CA' or 'Our home on Oak Street'",
    )
    location_type = Column(
        String(50),
        doc="Type: 'city', 'country', 'region', 'specific_place'",
    )

    # Significance
    is_primary_location = Column(
        Boolean,
        default=False,
        doc="Whether this is the primary location",
    )
    description = Column(
        Text,
        doc="Additional context",
    )

    order_index = Column(
        Integer,
        doc="Order position among locations",
    )

    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the location was created",
    )

    # Relationships
    life_event = relationship(
        "LifeEvent",
        back_populates="locations",
    )


# Index for life_event_location
Index("idx_life_event_location", LifeEventLocation.life_event_id)


class LifeEventParticipant(Base):
    """People involved in this event, with roles.

    Tracks individuals who were part of or influenced the life event.
    """

    __tablename__ = "life_event_participant"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the participant",
    )
    life_event_id = Column(
        UUID(as_uuid=True),
        ForeignKey("life_event.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the parent life event",
    )

    # Person identification
    first_name = Column(
        String(100),
        doc="First name of the participant",
    )
    last_name = Column(
        String(100),
        doc="Last name of the participant",
    )
    nickname = Column(
        String(100),
        doc="Nickname of the participant",
    )

    # Relationship & role
    relationship_type = Column(
        String(100),
        doc="Type: 'spouse', 'child', 'parent', 'friend', 'colleague', 'mentor'",
    )
    role_in_event = Column(
        String(200),
        doc="Role, e.g., 'My commanding officer', 'The friend who got me through'",
    )

    # Significance to event
    significance = Column(
        String(50),
        doc="Significance: 'central', 'supporting', 'mentioned'",
    )

    # Privacy
    use_real_name = Column(
        Boolean,
        default=True,
        doc="Whether to use real name in story",
    )
    pseudonym = Column(
        String(100),
        doc="Pseudonym to use if not using real name",
    )

    # Status
    is_deceased = Column(
        Boolean,
        default=False,
        doc="Whether the participant is deceased",
    )

    notes = Column(
        Text,
        doc="Additional notes about the participant",
    )

    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the participant was created",
    )

    # Relationships
    life_event = relationship(
        "LifeEvent",
        back_populates="participants",
    )


# Index for life_event_participant
Index("idx_life_event_participant", LifeEventParticipant.life_event_id)


class LifeEventDetail(Base):
    """Flexible key-value storage for event-specific facts.

    Allows capturing arbitrary details about events without
    requiring schema changes for new fact types.
    """

    __tablename__ = "life_event_detail"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the detail",
    )
    life_event_id = Column(
        UUID(as_uuid=True),
        ForeignKey("life_event.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the parent life event",
    )

    # Detail definition
    detail_key = Column(
        String(100),
        nullable=False,
        doc="Key: 'occupation', 'rank', 'denomination', 'illness_type', etc.",
    )
    detail_value = Column(
        Text,
        nullable=False,
        doc="The value for this detail",
    )
    detail_type = Column(
        String(50),
        doc="Type: 'text', 'number', 'date', 'boolean', 'list'",
    )

    # Display
    display_label = Column(
        String(200),
        doc="User-friendly label for display",
    )
    display_order = Column(
        Integer,
        doc="Order position for display",
    )

    # Privacy
    is_private = Column(
        Boolean,
        default=False,
        doc="Can capture but not publish",
    )

    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the detail was created",
    )

    # Relationships
    life_event = relationship(
        "LifeEvent",
        back_populates="details",
    )


# Indexes for life_event_detail
Index("idx_life_event_detail", LifeEventDetail.life_event_id)
Index("idx_life_event_detail_key", LifeEventDetail.life_event_id, LifeEventDetail.detail_key)


class LifeEventTrauma(Base):
    """Trauma markers and resolution tracking.

    Identifies events that involve trauma and tracks resolution status
    for trauma-aware handling during story capture.
    """

    __tablename__ = "life_event_trauma"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the trauma record",
    )
    life_event_id = Column(
        UUID(as_uuid=True),
        ForeignKey("life_event.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        doc="Reference to the parent life event",
    )

    # Trauma identification
    is_trauma = Column(
        Boolean,
        default=True,
        doc="Whether this event involves trauma",
    )
    trauma_type = Column(
        String(100),
        doc="Type: 'loss', 'abuse', 'violence', 'betrayal', 'illness', etc.",
    )

    # Resolution status
    trauma_status = Column(
        String(50),
        nullable=False,
        doc="Status: 'resolved', 'ongoing', 'partially_resolved'",
    )
    resolution_notes = Column(
        Text,
        doc="Notes about resolution",
    )

    # Capture approach
    requires_explicit_consent = Column(
        Boolean,
        default=True,
        doc="Whether explicit consent is required",
    )
    consent_given = Column(
        Boolean,
        default=False,
        doc="Whether consent has been given",
    )
    consent_date = Column(
        DateTime,
        doc="Timestamp when consent was given",
    )

    # Therapeutic considerations
    recommends_professional_support = Column(
        Boolean,
        default=False,
        doc="Whether professional support is recommended",
    )
    support_notes = Column(
        Text,
        doc="Notes about support recommendations",
    )

    # Privacy defaults
    default_privacy_level = Column(
        String(50),
        default="private",
        doc="Default privacy: 'private', 'limited', 'full'",
    )

    # Assessment metadata
    assessed_by = Column(
        String(100),
        doc="Assessed by: 'user_indicated', 'system_inferred', 'professional'",
    )
    assessed_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when assessment was made",
    )

    # Timestamps
    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the trauma record was created",
    )
    updated_at = Column(
        DateTime,
        default=datetime.now,
        onupdate=datetime.now,
        doc="Timestamp when the trauma record was last updated",
    )

    # Relationships
    life_event = relationship(
        "LifeEvent",
        back_populates="trauma",
    )


# Index for life_event_trauma
Index("idx_life_event_trauma", LifeEventTrauma.life_event_id)


class LifeEventBoundary(Base):
    """Event-specific privacy and comfort overrides.

    Allows overriding storyteller-wide boundary defaults for
    specific life events.
    """

    __tablename__ = "life_event_boundary"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the event boundary",
    )
    life_event_id = Column(
        UUID(as_uuid=True),
        ForeignKey("life_event.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        doc="Reference to the parent life event",
    )

    # Event-specific overrides
    override_storyteller_default = Column(
        Boolean,
        default=False,
        doc="Whether to override storyteller defaults",
    )

    # Comfort level for THIS event
    comfortable_discussing = Column(
        Boolean,
        nullable=True,
        doc="Comfortable discussing, null = use storyteller default",
    )

    # Privacy for THIS event
    privacy_level = Column(
        String(50),
        doc="Level: 'public', 'limited', 'private', 'never_publish'",
    )

    # Specific constraints
    can_mention_but_not_detail = Column(
        Boolean,
        default=False,
        doc="Can mention but not go into detail",
    )
    requires_pseudonyms = Column(
        Boolean,
        default=False,
        doc="Whether pseudonyms are required",
    )
    requires_location_anonymization = Column(
        Boolean,
        default=False,
        doc="Whether locations should be anonymized",
    )

    # Consent for deepening
    consent_to_deepen = Column(
        Boolean,
        default=False,
        doc="Willing to go beyond surface level",
    )
    consent_date = Column(
        DateTime,
        doc="Timestamp when consent was given",
    )

    # Off-limit aspects for THIS event
    off_limit_aspects = Column(
        ARRAY(Text),
        doc="Array of off-limit aspects for this event",
    )

    # Notes
    boundary_notes = Column(
        Text,
        doc="Additional boundary notes",
    )

    # Timestamps
    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the boundary was created",
    )
    updated_at = Column(
        DateTime,
        default=datetime.now,
        onupdate=datetime.now,
        doc="Timestamp when the boundary was last updated",
    )

    # Relationships
    life_event = relationship(
        "LifeEvent",
        back_populates="boundary",
    )


class LifeEventMedia(Base):
    """Media linked to specific events.

    Tracks photos, documents, letters, audio, and video associated
    with life events.
    """

    __tablename__ = "life_event_media"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the media",
    )
    life_event_id = Column(
        UUID(as_uuid=True),
        ForeignKey("life_event.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the parent life event",
    )

    # Media details
    media_type = Column(
        String(50),
        doc="Type: 'photo', 'document', 'letter', 'audio', 'video'",
    )
    file_url = Column(
        Text,
        nullable=False,
        doc="URL to the media file",
    )
    thumbnail_url = Column(
        Text,
        doc="URL to thumbnail image",
    )

    # Description
    title = Column(
        String(200),
        doc="Title of the media",
    )
    description = Column(
        Text,
        doc="Description of the media",
    )
    caption = Column(
        Text,
        doc="Caption for use in book",
    )

    # Context
    approximate_date = Column(
        Date,
        doc="Approximate date of the media",
    )
    location = Column(
        String(200),
        doc="Location where media was created",
    )
    people_in_media = Column(
        ARRAY(Text),
        doc="Names of people in photo/document",
    )

    # Rights & usage
    has_usage_rights = Column(
        Boolean,
        default=True,
        doc="Whether usage rights are available",
    )
    can_publish = Column(
        Boolean,
        default=True,
        doc="Whether media can be published",
    )

    # Organization
    tags = Column(
        ARRAY(Text),
        doc="Array of tag strings",
    )

    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the media was created",
    )

    # Relationships
    life_event = relationship(
        "LifeEvent",
        back_populates="media",
    )


# Index for life_event_media
Index("idx_life_event_media", LifeEventMedia.life_event_id)


class LifeEventPreference(Base):
    """Event-specific capture and handling preferences.

    Defines how a specific life event should be captured and
    handled during story collection.
    """

    __tablename__ = "life_event_preference"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the event preference",
    )
    life_event_id = Column(
        UUID(as_uuid=True),
        ForeignKey("life_event.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        doc="Reference to the parent life event",
    )

    # How to capture THIS event
    preferred_depth = Column(
        String(50),
        doc="Depth: 'headline_only', 'summary', 'detailed', 'exhaustive'",
    )
    preferred_approach = Column(
        String(50),
        doc="Approach: 'chronological', 'thematic', 'impressionistic'",
    )

    # Pacing for THIS event
    wants_multiple_sessions = Column(
        Boolean,
        default=False,
        doc="Whether multiple sessions are wanted",
    )
    estimated_sessions_needed = Column(
        Integer,
        doc="Estimated number of sessions needed",
    )

    # Prompting style for THIS event
    prefers_specific_prompts = Column(
        Boolean,
        default=True,
        doc="Prefers specific prompts vs open-ended",
    )
    prefers_voice_for_this = Column(
        Boolean,
        nullable=True,
        doc="Override default input method for this event",
    )

    # Book treatment
    should_be_chapter = Column(
        Boolean,
        default=False,
        doc="Whether this should be its own chapter",
    )
    suggested_chapter_title = Column(
        String(200),
        doc="Suggested title if this becomes a chapter",
    )
    merge_with_other_event_id = Column(
        UUID(as_uuid=True),
        ForeignKey("life_event.id"),
        nullable=True,
        doc="Reference to another event to merge with",
    )

    # Agent behavior
    agent_should_be_gentle = Column(
        Boolean,
        default=False,
        doc="Whether agent should be gentle",
    )
    agent_should_validate_facts = Column(
        Boolean,
        default=True,
        doc="Whether agent should validate facts",
    )

    notes = Column(
        Text,
        doc="Additional notes",
    )

    # Timestamps
    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the preference was created",
    )
    updated_at = Column(
        DateTime,
        default=datetime.now,
        onupdate=datetime.now,
        doc="Timestamp when the preference was last updated",
    )

    # Relationships
    life_event = relationship(
        "LifeEvent",
        back_populates="preference",
    )
    merge_with_event = relationship(
        "LifeEvent",
        foreign_keys=[merge_with_other_event_id],
    )


# Export all models
__all__ = [
    "Storyteller",
    "StorytellerBoundary",
    "StorytellerPreference",
    "LifeEvent",
    "LifeEventTimespan",
    "LifeEventLocation",
    "LifeEventParticipant",
    "LifeEventDetail",
    "LifeEventTrauma",
    "LifeEventBoundary",
    "LifeEventMedia",
    "LifeEventPreference",
]
