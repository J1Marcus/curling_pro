"""
Collection Models Module

This module defines SQLAlchemy models for the collection domain.
Collections are curated groups of life events organized around a principle
such as theme, archetype, timeline, or relationship.

Design Philosophy:
- Flexible organizing principles: Theme, archetype, timeline, relationship, place, or custom
- Narrative-aware: Collections understand story structure (setup, climax, resolution)
- Hierarchical: Events -> Collections -> Groupings (flexible nesting)
- Relational: Collections can reference and relate to each other
- Provisional by default: Collections evolve as understanding deepens
- Book-oriented: Collections map to chapters/sections/parts
- Multi-membership: Events can belong to multiple collections
- Synthesis-generating: Collections produce AI analysis and drafts

Models included:
- Collection: A curated group of life events organized around a principle
- CollectionLifeEvent: Many-to-many relationship between collections and life events
- CollectionGrouping: Higher-order organization of multiple collections
- CollectionGroupingMember: Which collections belong to which groupings
- CollectionRelationship: How collections relate to each other
- CollectionTag: Flexible tagging for collections
- CollectionSynthesis: AI-generated analysis and synthesis of a collection
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
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import relationship

from database.session import Base


class Collection(Base):
    """A curated group of life events organized around a principle.

    Collections group life events by theme, meaning, or principle. They
    support flexible organizing principles including theme, archetype,
    timeline, storyline, relationship, place, transformation, or custom.
    Collections are narrative-aware and can inform book chapter/section structure.
    """

    __tablename__ = "collection"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the collection",
    )
    storyteller_id = Column(
        UUID(as_uuid=True),
        ForeignKey("storyteller.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the parent storyteller",
    )

    # Collection identity
    collection_name = Column(
        String(200),
        nullable=False,
        doc="Collection name, e.g., 'My faith journey', 'Career evolution'",
    )
    description = Column(
        Text,
        doc="Description of the collection",
    )

    # Organizing principle
    organizing_principle = Column(
        String(100),
        doc="Principle: 'theme', 'archetype', 'timeline', 'storyline', 'relationship', 'place', 'transformation', 'custom'",
    )
    organizing_value = Column(
        Text,
        doc="The specific principle value, e.g., 'faith', 'hero's journey', '1960s-1970s'",
    )

    # Narrative structure
    narrative_arc = Column(
        String(100),
        doc="Arc: 'linear', 'cyclical', 'transformation', 'quest', 'tragedy', 'comedy', 'rebirth', 'rags_to_riches'",
    )
    archetype_pattern = Column(
        String(100),
        doc="Pattern: 'loss_to_connection', 'transformation', 'endurance', 'threat_survival', 'identity_shift', 'meaning_making'",
    )

    # Collection metadata
    collection_type = Column(
        String(50),
        doc="Type: 'thematic', 'chronological', 'relational', 'geographical', 'emotional_journey', 'custom'",
    )

    # Status
    is_provisional = Column(
        Boolean,
        default=True,
        doc="Whether the collection is still being refined",
    )
    is_approved = Column(
        Boolean,
        default=False,
        doc="Whether the storyteller confirmed this collection makes sense",
    )
    approved_at = Column(
        DateTime,
        nullable=True,
        doc="Timestamp when the collection was approved",
    )

    # Book usage
    include_in_book = Column(
        Boolean,
        default=True,
        doc="Whether to include this collection in the book",
    )
    book_section_type = Column(
        String(50),
        doc="Section type: 'chapter', 'part', 'vignette', 'sidebar'",
    )
    suggested_title = Column(
        String(200),
        doc="Suggested chapter/section title",
    )
    display_order = Column(
        Integer,
        doc="Order in book",
    )

    # Synthesis
    synthesis_summary = Column(
        Text,
        doc="AI-generated summary of this collection",
    )
    synthesis_themes = Column(
        ARRAY(Text),
        doc="Key themes across these events",
    )
    synthesis_tone = Column(
        String(50),
        doc="Overall emotional tone",
    )

    # Timestamps
    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the collection was created",
    )
    updated_at = Column(
        DateTime,
        default=datetime.now,
        onupdate=datetime.now,
        doc="Timestamp when the collection was last updated",
    )

    # Relationships
    life_events = relationship(
        "CollectionLifeEvent",
        back_populates="collection",
        cascade="all, delete-orphan",
    )
    grouping_memberships = relationship(
        "CollectionGroupingMember",
        back_populates="collection",
        cascade="all, delete-orphan",
    )
    source_relationships = relationship(
        "CollectionRelationship",
        back_populates="source_collection",
        foreign_keys="CollectionRelationship.source_collection_id",
        cascade="all, delete-orphan",
    )
    target_relationships = relationship(
        "CollectionRelationship",
        back_populates="target_collection",
        foreign_keys="CollectionRelationship.target_collection_id",
        cascade="all, delete-orphan",
    )
    tags = relationship(
        "CollectionTag",
        back_populates="collection",
        cascade="all, delete-orphan",
    )
    syntheses = relationship(
        "CollectionSynthesis",
        back_populates="collection",
        cascade="all, delete-orphan",
    )


# Indexes for collection
Index("idx_collection_storyteller", Collection.storyteller_id)
Index("idx_collection_principle", Collection.organizing_principle)
Index("idx_collection_archetype", Collection.archetype_pattern)


class CollectionLifeEvent(Base):
    """Many-to-many relationship between collections and life events.

    Tracks which life events belong to which collections, along with
    ordering, narrative role, and thematic connection information.
    """

    __tablename__ = "collection_life_event"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the collection-life event relationship",
    )
    collection_id = Column(
        UUID(as_uuid=True),
        ForeignKey("collection.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the parent collection",
    )
    life_event_id = Column(
        UUID(as_uuid=True),
        ForeignKey("life_event.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the life event",
    )

    # Ordering
    sequence_order = Column(
        Integer,
        doc="Position in collection (if order matters)",
    )
    is_anchor_event = Column(
        Boolean,
        default=False,
        doc="Whether this is a pivotal event in the collection",
    )

    # Narrative role
    narrative_role = Column(
        String(100),
        doc="Role: 'inciting_incident', 'rising_action', 'climax', 'falling_action', 'resolution', 'reflection', 'setup', 'turning_point', 'consequence'",
    )
    narrative_function = Column(
        Text,
        doc="How this event functions in the collection story",
    )

    # Thematic connection
    connection_to_theme = Column(
        Text,
        doc="How this event relates to collection theme",
    )

    # Metadata
    added_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the event was added to the collection",
    )
    added_by = Column(
        String(100),
        doc="Who added: 'system', 'user', 'agent'",
    )

    # Unique constraint
    __table_args__ = (
        UniqueConstraint("collection_id", "life_event_id", name="uq_collection_life_event"),
    )

    # Relationships
    collection = relationship(
        "Collection",
        back_populates="life_events",
    )
    life_event = relationship(
        "LifeEvent",
        backref="collection_memberships",
    )


# Indexes for collection_life_event
Index("idx_collection_life_event_collection", CollectionLifeEvent.collection_id, CollectionLifeEvent.sequence_order)
Index("idx_collection_life_event_event", CollectionLifeEvent.life_event_id)


class CollectionGrouping(Base):
    """Higher-order organization of multiple collections.

    Allows grouping related collections together for book structure
    (e.g., parts, sections, acts) or thematic meta-organization.
    """

    __tablename__ = "collection_grouping"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the collection grouping",
    )
    storyteller_id = Column(
        UUID(as_uuid=True),
        ForeignKey("storyteller.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the parent storyteller",
    )

    # Grouping identity
    grouping_name = Column(
        String(200),
        nullable=False,
        doc="Grouping name, e.g., 'My spiritual evolution', 'Relationships across time'",
    )
    grouping_description = Column(
        Text,
        doc="Description of the grouping",
    )

    # Grouping type
    grouping_type = Column(
        String(100),
        doc="Type: 'archetype', 'storyline', 'timeline', 'thematic_meta', 'book_part', 'narrative_thread', 'custom'",
    )
    grouping_principle = Column(
        Text,
        doc="The overarching principle, e.g., 'Shows progression from loss to meaning'",
    )

    # Book usage
    book_part_type = Column(
        String(50),
        doc="Part type: 'part', 'section', 'act', 'book'",
    )
    suggested_part_title = Column(
        String(200),
        doc="Suggested part title",
    )

    # Ordering
    display_order = Column(
        Integer,
        doc="Order in book/display",
    )

    # Timestamps
    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the grouping was created",
    )
    updated_at = Column(
        DateTime,
        default=datetime.now,
        onupdate=datetime.now,
        doc="Timestamp when the grouping was last updated",
    )

    # Relationships
    members = relationship(
        "CollectionGroupingMember",
        back_populates="grouping",
        cascade="all, delete-orphan",
    )


# Index for collection_grouping
Index("idx_collection_grouping_storyteller", CollectionGrouping.storyteller_id)


class CollectionGroupingMember(Base):
    """Which collections belong to which groupings.

    Defines the membership of collections within groupings,
    including ordering and relationship context.
    """

    __tablename__ = "collection_grouping_member"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the grouping membership",
    )
    grouping_id = Column(
        UUID(as_uuid=True),
        ForeignKey("collection_grouping.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the parent grouping",
    )
    collection_id = Column(
        UUID(as_uuid=True),
        ForeignKey("collection.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the collection",
    )

    # Ordering within grouping
    sequence_order = Column(
        Integer,
        doc="Order position within the grouping",
    )

    # Relationship context
    relationship_to_grouping = Column(
        Text,
        doc="How this collection fits in the grouping, e.g., 'First phase of transformation'",
    )

    # Timestamps
    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the membership was created",
    )

    # Unique constraint
    __table_args__ = (
        UniqueConstraint("grouping_id", "collection_id", name="uq_collection_grouping_member"),
    )

    # Relationships
    grouping = relationship(
        "CollectionGrouping",
        back_populates="members",
    )
    collection = relationship(
        "Collection",
        back_populates="grouping_memberships",
    )


# Indexes for collection_grouping_member
Index("idx_collection_grouping_member_grouping", CollectionGroupingMember.grouping_id, CollectionGroupingMember.sequence_order)
Index("idx_collection_grouping_member_collection", CollectionGroupingMember.collection_id)


class CollectionRelationship(Base):
    """How collections relate to each other (without formal grouping).

    Tracks relationships like 'leads_to', 'contrasts_with', 'parallels',
    etc. between collections.
    """

    __tablename__ = "collection_relationship"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the collection relationship",
    )

    # The two collections
    source_collection_id = Column(
        UUID(as_uuid=True),
        ForeignKey("collection.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the source collection",
    )
    target_collection_id = Column(
        UUID(as_uuid=True),
        ForeignKey("collection.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the target collection",
    )

    # Relationship type
    relationship_type = Column(
        String(100),
        doc="Type: 'leads_to', 'contrasts_with', 'parallels', 'causes', 'influenced_by', 'mirrors', 'precedes', 'resolves', 'complicates'",
    )
    relationship_description = Column(
        Text,
        doc="Explanation of the connection",
    )

    # Strength
    strength = Column(
        String(50),
        doc="Strength: 'strong', 'moderate', 'weak', 'subtle'",
    )

    # Bidirectional or not
    is_bidirectional = Column(
        Boolean,
        default=False,
        doc="Whether the relationship goes both ways",
    )

    # Timestamps
    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the relationship was created",
    )

    # Unique constraint
    __table_args__ = (
        UniqueConstraint("source_collection_id", "target_collection_id", "relationship_type", name="uq_collection_relationship"),
    )

    # Relationships
    source_collection = relationship(
        "Collection",
        back_populates="source_relationships",
        foreign_keys=[source_collection_id],
    )
    target_collection = relationship(
        "Collection",
        back_populates="target_relationships",
        foreign_keys=[target_collection_id],
    )


# Indexes for collection_relationship
Index("idx_collection_relationship_source", CollectionRelationship.source_collection_id)
Index("idx_collection_relationship_target", CollectionRelationship.target_collection_id)


class CollectionTag(Base):
    """Flexible tagging for collections.

    Provides a flexible tagging system with categories like
    emotion, theme, location, era, relationship, etc.
    """

    __tablename__ = "collection_tag"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the collection tag",
    )
    collection_id = Column(
        UUID(as_uuid=True),
        ForeignKey("collection.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the parent collection",
    )

    # Tag details
    tag_category = Column(
        String(100),
        doc="Category: 'emotion', 'theme', 'location', 'era', 'relationship'",
    )
    tag_value = Column(
        String(200),
        doc="The actual tag value",
    )

    # Context
    relevance_note = Column(
        Text,
        doc="Why this tag applies",
    )

    # Timestamps
    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the tag was created",
    )

    # Relationships
    collection = relationship(
        "Collection",
        back_populates="tags",
    )


# Indexes for collection_tag
Index("idx_collection_tag_collection", CollectionTag.collection_id)
Index("idx_collection_tag_category", CollectionTag.tag_category, CollectionTag.tag_value)


class CollectionSynthesis(Base):
    """AI-generated analysis and synthesis of a collection.

    Stores various types of synthesis including summaries,
    theme analysis, arc analysis, character development, and draft chapters.
    """

    __tablename__ = "collection_synthesis"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the collection synthesis",
    )
    collection_id = Column(
        UUID(as_uuid=True),
        ForeignKey("collection.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the parent collection",
    )

    # Synthesis content
    synthesis_type = Column(
        String(50),
        doc="Type: 'summary', 'theme_analysis', 'arc_analysis', 'character_development', 'draft_chapter'",
    )
    synthesis_version = Column(
        Integer,
        default=1,
        doc="Version number of the synthesis",
    )
    content = Column(
        Text,
        nullable=False,
        doc="The synthesis content",
    )
    structured_data = Column(
        JSONB,
        doc="Additional structured insights",
    )

    # Quality
    is_provisional = Column(
        Boolean,
        default=True,
        doc="Whether the synthesis is still provisional",
    )
    is_approved = Column(
        Boolean,
        default=False,
        doc="Whether the synthesis has been approved",
    )
    approved_at = Column(
        DateTime,
        nullable=True,
        doc="Timestamp when the synthesis was approved",
    )

    # User feedback
    user_feedback = Column(
        Text,
        doc="User feedback on the synthesis",
    )
    needs_revision = Column(
        Boolean,
        default=False,
        doc="Whether the synthesis needs revision",
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
    collection = relationship(
        "Collection",
        back_populates="syntheses",
    )


# Index for collection_synthesis
Index("idx_collection_synthesis", CollectionSynthesis.collection_id, CollectionSynthesis.synthesis_version)


# Export all models
__all__ = [
    "Collection",
    "CollectionLifeEvent",
    "CollectionGrouping",
    "CollectionGroupingMember",
    "CollectionRelationship",
    "CollectionTag",
    "CollectionSynthesis",
]
