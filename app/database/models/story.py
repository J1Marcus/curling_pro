"""
Story and Book Models Module

This module defines SQLAlchemy models for the story/book domain.
These models represent the actual memoir being created from the
storyteller's life events and collections.

Design Philosophy:
- Story = Book: The actual manuscript being created
- Memoir craft: Follows best practices for autobiographical storytelling
- Structured flexibility: Chapters -> Sections -> Scenes with clear purposes
- Character-driven: Real people portrayed as characters with arcs
- Archetype-organized: Overall narrative follows archetypal patterns
- Collection-informed: Chapters draw from collections but are crafted for narrative flow
- Scene-based: Emphasis on showing through scenes vs. telling through summary

Models included:
- Story: The actual book/memoir being created
- StoryChapter: Individual chapters within the book
- ChapterSection: Sections within chapters (scenes, reflections, summaries)
- StoryCollection: Many-to-many relationship between story chapters and collections
- StoryCharacter: People portrayed as characters in the memoir
- CharacterRelationship: Relationships between characters in the story
- CharacterAppearance: Tracks which chapters/sections each character appears in
- StoryTheme: Thematic threads woven throughout the story
- ChapterTheme: Which themes appear in which chapters
- StoryScene: Individual scenes (the building blocks of memoir)
- StoryDraft: Version history of the story and chapters
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
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import relationship

from database.session import Base


class Story(Base):
    """The actual book/memoir being created.

    Contains all high-level information about the story including
    identity, structure, memoir craft elements, audience, themes,
    timeframe, and status.
    """

    __tablename__ = "story"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the story",
    )
    storyteller_id = Column(
        UUID(as_uuid=True),
        ForeignKey("storyteller.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the parent storyteller",
    )

    # Book identity
    title = Column(
        String(300),
        nullable=False,
        doc="Title of the story/book",
    )
    subtitle = Column(
        String(300),
        doc="Subtitle of the story/book",
    )
    working_title = Column(
        String(300),
        doc="Working title (may differ from final title)",
    )

    # Story structure
    overall_archetype = Column(
        String(100),
        doc="Primary archetype: 'loss_to_connection', 'transformation', etc.",
    )
    secondary_archetypes = Column(
        ARRAY(Text),
        doc="Additional archetypal patterns",
    )
    narrative_structure = Column(
        String(100),
        doc="Structure: 'linear', 'non_linear', 'circular', 'braided', 'frame_story', 'mosaic', 'three_act', 'hero_journey'",
    )

    # Memoir craft elements
    point_of_view = Column(
        String(50),
        doc="POV: 'first_person_present', 'first_person_past', 'second_person'",
    )
    narrative_voice = Column(
        String(100),
        doc="Voice: 'reflective', 'immediate', 'conversational', 'literary'",
    )
    tense = Column(
        String(50),
        doc="Tense: 'present', 'past', 'mixed'",
    )
    tone = Column(
        String(100),
        doc="Tone: 'intimate', 'humorous', 'somber', 'hopeful', 'defiant'",
    )

    # Audience & purpose
    intended_audience = Column(
        String(200),
        doc="Audience: 'family', 'descendants', 'general_public', 'specific_community'",
    )
    primary_purpose = Column(
        Text,
        doc="Why this story is being told",
    )

    # Thematic core
    central_question = Column(
        Text,
        doc="The question the memoir explores, e.g., 'How did I find faith after losing everything?'",
    )
    central_themes = Column(
        ARRAY(Text),
        doc="Major themes throughout",
    )

    # Timeframe
    story_timeframe_start = Column(
        Integer,
        doc="Year story begins",
    )
    story_timeframe_end = Column(
        Integer,
        doc="Year story ends",
    )
    uses_flashback = Column(
        Boolean,
        default=False,
        doc="Whether the story uses flashbacks",
    )
    uses_flashforward = Column(
        Boolean,
        default=False,
        doc="Whether the story uses flashforwards",
    )

    # Opening & closing
    opening_strategy = Column(
        String(100),
        doc="Strategy: 'in_medias_res', 'origin_story', 'pivotal_moment', 'frame_present_day', 'atmospheric_scene'",
    )
    closing_strategy = Column(
        String(100),
        doc="Strategy: 'resolution', 'reflection', 'return_to_frame', 'open_ended', 'full_circle'",
    )

    # Status
    status = Column(
        String(50),
        default="planning",
        doc="Status: 'planning', 'drafting', 'revising', 'complete'",
    )
    current_draft_version = Column(
        Integer,
        default=1,
        doc="Current draft version number",
    )

    # Metadata
    estimated_word_count = Column(
        Integer,
        doc="Estimated word count",
    )
    target_word_count = Column(
        Integer,
        doc="Target word count",
    )
    estimated_page_count = Column(
        Integer,
        doc="Estimated page count",
    )

    # Timestamps
    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the story was created",
    )
    updated_at = Column(
        DateTime,
        default=datetime.now,
        onupdate=datetime.now,
        doc="Timestamp when the story was last updated",
    )

    # Relationships
    chapters = relationship(
        "StoryChapter",
        back_populates="story",
        cascade="all, delete-orphan",
    )
    characters = relationship(
        "StoryCharacter",
        back_populates="story",
        cascade="all, delete-orphan",
    )
    character_relationships = relationship(
        "CharacterRelationship",
        back_populates="story",
        cascade="all, delete-orphan",
    )
    themes = relationship(
        "StoryTheme",
        back_populates="story",
        cascade="all, delete-orphan",
    )
    scenes = relationship(
        "StoryScene",
        back_populates="story",
        cascade="all, delete-orphan",
    )
    drafts = relationship(
        "StoryDraft",
        back_populates="story",
        cascade="all, delete-orphan",
    )
    story_collections = relationship(
        "StoryCollection",
        back_populates="story",
        cascade="all, delete-orphan",
    )


# Index for story
Index("idx_story_storyteller", Story.storyteller_id)


class StoryChapter(Base):
    """Individual chapters within the book.

    Contains chapter identity, type, purpose, narrative position,
    memoir craft elements, timeframe, structure, content, and status.
    """

    __tablename__ = "story_chapter"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the chapter",
    )
    story_id = Column(
        UUID(as_uuid=True),
        ForeignKey("story.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the parent story",
    )

    # Chapter identity
    chapter_number = Column(
        Integer,
        nullable=False,
        doc="Chapter number",
    )
    chapter_title = Column(
        String(300),
        doc="Chapter title",
    )
    chapter_subtitle = Column(
        String(300),
        doc="Chapter subtitle",
    )

    # Chapter type
    chapter_type = Column(
        String(100),
        doc="Type: 'scene_chapter', 'reflection_chapter', 'bridge_chapter', 'thematic_chapter', 'chronological_chapter', 'character_chapter', 'place_chapter'",
    )

    # Chapter purpose
    narrative_purpose = Column(
        Text,
        doc="What this chapter accomplishes in the story",
    )
    narrative_position = Column(
        String(50),
        doc="Position: 'opening', 'rising_action', 'midpoint', 'climax', 'falling_action', 'resolution'",
    )

    # Memoir craft
    chapter_arc = Column(
        String(100),
        doc="Arc: 'transformation', 'revelation', 'escalation', 'deepening', 'contrast', 'parallel'",
    )
    emotional_arc = Column(
        Text,
        doc="Description of emotional journey in chapter",
    )
    opening_hook = Column(
        Text,
        doc="How chapter begins - the hook",
    )
    closing_resonance = Column(
        Text,
        doc="How chapter ends - the echo",
    )

    # Timeframe
    chapter_timeframe_start = Column(
        Integer,
        doc="Year this chapter covers (start)",
    )
    chapter_timeframe_end = Column(
        Integer,
        doc="Year this chapter covers (end)",
    )

    # Structure
    primary_mode = Column(
        String(50),
        doc="Mode: 'scene', 'summary', 'reflection', 'mixed'",
    )
    scene_to_summary_ratio = Column(
        Numeric(3, 2),
        doc="0.0 to 1.0 (1.0 = all scene)",
    )

    # Content
    summary = Column(
        Text,
        doc="Chapter summary",
    )
    epigraph = Column(
        Text,
        doc="Optional chapter epigraph",
    )
    epigraph_attribution = Column(
        String(200),
        doc="Attribution for the epigraph",
    )

    # Status
    status = Column(
        String(50),
        default="planned",
        doc="Status: 'planned', 'outlined', 'drafted', 'revised', 'polished'",
    )
    current_draft_version = Column(
        Integer,
        default=1,
        doc="Current draft version number",
    )

    word_count = Column(
        Integer,
        doc="Actual word count",
    )
    estimated_word_count = Column(
        Integer,
        doc="Estimated word count",
    )

    # Ordering
    display_order = Column(
        Integer,
        doc="Actual order in book (may differ from chapter_number if using non-linear structure)",
    )

    # Timestamps
    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the chapter was created",
    )
    updated_at = Column(
        DateTime,
        default=datetime.now,
        onupdate=datetime.now,
        doc="Timestamp when the chapter was last updated",
    )

    # Relationships
    story = relationship(
        "Story",
        back_populates="chapters",
    )
    sections = relationship(
        "ChapterSection",
        back_populates="chapter",
        cascade="all, delete-orphan",
    )
    chapter_themes = relationship(
        "ChapterTheme",
        back_populates="chapter",
        cascade="all, delete-orphan",
    )
    story_collections = relationship(
        "StoryCollection",
        back_populates="chapter",
        cascade="all, delete-orphan",
    )
    character_appearances = relationship(
        "CharacterAppearance",
        back_populates="chapter",
        cascade="all, delete-orphan",
    )
    first_appearance_characters = relationship(
        "StoryCharacter",
        back_populates="first_appearance_chapter",
        foreign_keys="StoryCharacter.first_appearance_chapter_id",
    )
    scenes = relationship(
        "StoryScene",
        back_populates="chapter",
        cascade="all, delete-orphan",
    )
    drafts = relationship(
        "StoryDraft",
        back_populates="chapter",
        cascade="all, delete-orphan",
    )


# Indexes for story_chapter
Index("idx_story_chapter_story", StoryChapter.story_id, StoryChapter.chapter_number)
Index("idx_story_chapter_order", StoryChapter.story_id, StoryChapter.display_order)


class ChapterSection(Base):
    """Sections within chapters (scenes, reflections, summaries).

    Contains section identity, type, scene details, content,
    craft elements, and status.
    """

    __tablename__ = "chapter_section"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the section",
    )
    chapter_id = Column(
        UUID(as_uuid=True),
        ForeignKey("story_chapter.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the parent chapter",
    )

    # Section identity
    section_number = Column(
        Integer,
        nullable=False,
        doc="Section number within the chapter",
    )
    section_title = Column(
        String(200),
        doc="Optional section title",
    )

    # Section type
    section_type = Column(
        String(50),
        doc="Type: 'scene', 'summary', 'reflection', 'dialogue', 'description', 'transition', 'flashback'",
    )

    # Scene details (if section_type = 'scene')
    scene_setting = Column(
        String(500),
        doc="Where and when the scene takes place",
    )
    scene_characters = Column(
        ARRAY(Text),
        doc="Characters present in scene",
    )
    scene_purpose = Column(
        Text,
        doc="What the scene accomplishes",
    )

    # Content
    content = Column(
        Text,
        doc="The actual written content",
    )
    notes = Column(
        Text,
        doc="Writer's notes about this section",
    )

    # Craft elements
    uses_dialogue = Column(
        Boolean,
        default=False,
        doc="Whether the section uses dialogue",
    )
    uses_sensory_details = Column(
        Boolean,
        default=False,
        doc="Whether the section uses sensory details",
    )
    uses_internal_monologue = Column(
        Boolean,
        default=False,
        doc="Whether the section uses internal monologue",
    )
    show_vs_tell = Column(
        String(50),
        doc="Style: 'showing', 'telling', 'mixed'",
    )

    # Status
    status = Column(
        String(50),
        default="outlined",
        doc="Status: 'outlined', 'drafted', 'revised', 'polished'",
    )

    word_count = Column(
        Integer,
        doc="Word count of the section",
    )

    # Ordering
    sequence_order = Column(
        Integer,
        doc="Order position within the chapter",
    )

    # Timestamps
    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the section was created",
    )
    updated_at = Column(
        DateTime,
        default=datetime.now,
        onupdate=datetime.now,
        doc="Timestamp when the section was last updated",
    )

    # Relationships
    chapter = relationship(
        "StoryChapter",
        back_populates="sections",
    )
    character_appearances = relationship(
        "CharacterAppearance",
        back_populates="section",
        cascade="all, delete-orphan",
    )
    scenes = relationship(
        "StoryScene",
        back_populates="section",
    )


# Index for chapter_section
Index("idx_chapter_section_chapter", ChapterSection.chapter_id, ChapterSection.sequence_order)


class StoryCollection(Base):
    """Many-to-many relationship between story chapters and collections.

    Tracks which collections are used in which chapters, how they are
    used, and how the raw material was transformed for narrative.
    """

    __tablename__ = "story_collection"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the story-collection relationship",
    )
    story_id = Column(
        UUID(as_uuid=True),
        ForeignKey("story.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the parent story",
    )
    chapter_id = Column(
        UUID(as_uuid=True),
        ForeignKey("story_chapter.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the chapter",
    )
    collection_id = Column(
        UUID(as_uuid=True),
        ForeignKey("collection.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the collection",
    )

    # Relationship
    usage_type = Column(
        String(50),
        doc="Type: 'primary_source', 'supplementary', 'reference', 'inspiration', 'contrast'",
    )

    # How collection material is used
    material_used = Column(
        Text,
        doc="Description of what from collection appears in chapter",
    )
    transformation_notes = Column(
        Text,
        doc="How raw material was transformed for narrative",
    )

    # Timestamps
    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the relationship was created",
    )

    # Unique constraint
    __table_args__ = (
        UniqueConstraint("story_id", "chapter_id", "collection_id", name="uq_story_collection"),
    )

    # Relationships
    story = relationship(
        "Story",
        back_populates="story_collections",
    )
    chapter = relationship(
        "StoryChapter",
        back_populates="story_collections",
    )
    collection = relationship(
        "Collection",
        backref="story_usages",
    )


# Indexes for story_collection
Index("idx_story_collection_story", StoryCollection.story_id)
Index("idx_story_collection_chapter", StoryCollection.chapter_id)
Index("idx_story_collection_collection", StoryCollection.collection_id)


class StoryCharacter(Base):
    """People portrayed as characters in the memoir.

    Contains character identity, type, description, arc,
    memoir-specific considerations, and status.
    """

    __tablename__ = "story_character"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the character",
    )
    story_id = Column(
        UUID(as_uuid=True),
        ForeignKey("story.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the parent story",
    )
    storyteller_id = Column(
        UUID(as_uuid=True),
        ForeignKey("storyteller.id"),
        nullable=True,
        doc="Links to storyteller if character is the author",
    )

    # Character identity
    character_name = Column(
        String(200),
        nullable=False,
        doc="Name used in story (may be pseudonym)",
    )
    real_name = Column(
        String(200),
        doc="Actual name (if different)",
    )
    is_pseudonym = Column(
        Boolean,
        default=False,
        doc="Whether the character name is a pseudonym",
    )

    # Character type
    character_type = Column(
        String(50),
        doc="Type: 'protagonist', 'antagonist', 'ally', 'mentor', 'foil', 'supporting', 'minor', 'background'",
    )
    relationship_to_protagonist = Column(
        String(100),
        doc="Relationship: 'self', 'parent', 'spouse', 'child', 'friend', 'colleague', 'adversary', 'teacher', 'stranger'",
    )

    # Character description
    physical_description = Column(
        Text,
        doc="How character appears",
    )
    personality_traits = Column(
        ARRAY(Text),
        doc="Key personality characteristics",
    )
    speech_patterns = Column(
        Text,
        doc="How character talks (for dialogue)",
    )
    backstory = Column(
        Text,
        doc="Relevant history",
    )
    motivation = Column(
        Text,
        doc="What drives this character",
    )

    # Character arc
    has_arc = Column(
        Boolean,
        default=False,
        doc="Whether the character has an arc",
    )
    arc_type = Column(
        String(100),
        doc="Arc: 'growth', 'fall', 'redemption', 'corruption', 'static', 'catalyst'",
    )
    arc_description = Column(
        Text,
        doc="Description of the character's arc",
    )
    initial_state = Column(
        Text,
        doc="Character at beginning",
    )
    transformation = Column(
        Text,
        doc="How character changes",
    )
    final_state = Column(
        Text,
        doc="Character at end",
    )

    # Memoir-specific
    degree_of_revelation = Column(
        String(50),
        doc="Revelation: 'full', 'partial', 'minimal', 'composite'",
    )
    privacy_level = Column(
        String(50),
        doc="Privacy: 'full_name', 'first_name_only', 'pseudonym', 'composite_character', 'anonymous'",
    )
    composite_of = Column(
        ARRAY(Text),
        doc="If composite character, who does it represent",
    )

    # First appearance
    first_appearance_chapter_id = Column(
        UUID(as_uuid=True),
        ForeignKey("story_chapter.id"),
        nullable=True,
        doc="Reference to the chapter where character first appears",
    )
    introduction_strategy = Column(
        Text,
        doc="How character is introduced",
    )

    # Status
    is_living = Column(
        Boolean,
        doc="Whether the character is living",
    )
    consent_obtained = Column(
        Boolean,
        default=False,
        doc="Whether consent has been obtained",
    )

    # Timestamps
    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the character was created",
    )
    updated_at = Column(
        DateTime,
        default=datetime.now,
        onupdate=datetime.now,
        doc="Timestamp when the character was last updated",
    )

    # Relationships
    story = relationship(
        "Story",
        back_populates="characters",
    )
    first_appearance_chapter = relationship(
        "StoryChapter",
        back_populates="first_appearance_characters",
        foreign_keys=[first_appearance_chapter_id],
    )
    appearances = relationship(
        "CharacterAppearance",
        back_populates="character",
        cascade="all, delete-orphan",
    )
    relationships_as_a = relationship(
        "CharacterRelationship",
        back_populates="character_a",
        foreign_keys="CharacterRelationship.character_a_id",
        cascade="all, delete-orphan",
    )
    relationships_as_b = relationship(
        "CharacterRelationship",
        back_populates="character_b",
        foreign_keys="CharacterRelationship.character_b_id",
        cascade="all, delete-orphan",
    )


# Indexes for story_character
Index("idx_story_character_story", StoryCharacter.story_id)
Index("idx_story_character_type", StoryCharacter.character_type)


class CharacterRelationship(Base):
    """Relationships between characters in the story.

    Contains the two characters, relationship type, arc,
    and narrative importance.
    """

    __tablename__ = "character_relationship"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the character relationship",
    )
    story_id = Column(
        UUID(as_uuid=True),
        ForeignKey("story.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the parent story",
    )

    # The two characters
    character_a_id = Column(
        UUID(as_uuid=True),
        ForeignKey("story_character.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the first character",
    )
    character_b_id = Column(
        UUID(as_uuid=True),
        ForeignKey("story_character.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the second character",
    )

    # Relationship
    relationship_type = Column(
        String(100),
        doc="Type: 'parent_child', 'romantic', 'friendship', 'rivalry', 'mentor_mentee', 'colleagues', 'adversaries'",
    )
    relationship_description = Column(
        Text,
        doc="Description of the relationship",
    )

    # Relationship arc
    has_arc = Column(
        Boolean,
        default=False,
        doc="Whether the relationship has an arc",
    )
    relationship_arc = Column(
        String(100),
        doc="Arc: 'strengthening', 'deteriorating', 'transforming', 'reconciling', 'separating', 'static'",
    )
    initial_dynamic = Column(
        Text,
        doc="How relationship starts",
    )
    key_conflict = Column(
        Text,
        doc="Central tension in relationship",
    )
    resolution = Column(
        Text,
        doc="How relationship resolves (or doesn't)",
    )

    # Narrative importance
    significance = Column(
        String(50),
        doc="Significance: 'central', 'major', 'supporting', 'background'",
    )

    # Timestamps
    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the relationship was created",
    )

    # Unique constraint
    __table_args__ = (
        UniqueConstraint("character_a_id", "character_b_id", name="uq_character_relationship"),
    )

    # Relationships
    story = relationship(
        "Story",
        back_populates="character_relationships",
    )
    character_a = relationship(
        "StoryCharacter",
        back_populates="relationships_as_a",
        foreign_keys=[character_a_id],
    )
    character_b = relationship(
        "StoryCharacter",
        back_populates="relationships_as_b",
        foreign_keys=[character_b_id],
    )


# Index for character_relationship
Index("idx_character_relationship_story", CharacterRelationship.story_id)


class CharacterAppearance(Base):
    """Tracks which chapters/sections each character appears in.

    Contains appearance details including role, significance,
    and character development notes.
    """

    __tablename__ = "character_appearance"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the character appearance",
    )
    character_id = Column(
        UUID(as_uuid=True),
        ForeignKey("story_character.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the character",
    )
    chapter_id = Column(
        UUID(as_uuid=True),
        ForeignKey("story_chapter.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the chapter",
    )
    section_id = Column(
        UUID(as_uuid=True),
        ForeignKey("chapter_section.id", ondelete="SET NULL"),
        nullable=True,
        doc="Reference to the section (optional)",
    )

    # Appearance details
    role_in_scene = Column(
        String(100),
        doc="Role: 'active', 'present', 'mentioned', 'referenced'",
    )
    significance_in_scene = Column(
        String(50),
        doc="Significance: 'central', 'supporting', 'background', 'cameo'",
    )

    character_development = Column(
        Boolean,
        default=False,
        doc="Does character develop in this appearance?",
    )
    development_notes = Column(
        Text,
        doc="Notes about character development",
    )

    # Timestamps
    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the appearance was created",
    )

    # Relationships
    character = relationship(
        "StoryCharacter",
        back_populates="appearances",
    )
    chapter = relationship(
        "StoryChapter",
        back_populates="character_appearances",
    )
    section = relationship(
        "ChapterSection",
        back_populates="character_appearances",
    )


# Indexes for character_appearance
Index("idx_character_appearance_character", CharacterAppearance.character_id)
Index("idx_character_appearance_chapter", CharacterAppearance.chapter_id)


class StoryTheme(Base):
    """Thematic threads woven throughout the story.

    Contains theme identity, type, thematic elements,
    and how theme develops.
    """

    __tablename__ = "story_theme"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the theme",
    )
    story_id = Column(
        UUID(as_uuid=True),
        ForeignKey("story.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the parent story",
    )

    # Theme identity
    theme_name = Column(
        String(200),
        nullable=False,
        doc="Theme name, e.g., 'Forgiveness', 'Belonging', 'Identity'",
    )
    theme_description = Column(
        Text,
        doc="Description of the theme",
    )

    # Theme type
    theme_type = Column(
        String(50),
        doc="Type: 'central', 'major', 'minor', 'motif'",
    )

    # Thematic elements
    symbols = Column(
        ARRAY(Text),
        doc="Recurring symbols representing theme",
    )
    motifs = Column(
        ARRAY(Text),
        doc="Recurring patterns",
    )
    imagery = Column(
        ARRAY(Text),
        doc="Recurring images",
    )

    # How theme develops
    theme_arc = Column(
        Text,
        doc="How theme evolves through story",
    )

    # Timestamps
    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the theme was created",
    )

    # Relationships
    story = relationship(
        "Story",
        back_populates="themes",
    )
    chapter_themes = relationship(
        "ChapterTheme",
        back_populates="theme",
        cascade="all, delete-orphan",
    )


# Index for story_theme
Index("idx_story_theme_story", StoryTheme.story_id)


class ChapterTheme(Base):
    """Which themes appear in which chapters.

    Contains how the theme appears in the chapter with
    prominence and exploration notes.
    """

    __tablename__ = "chapter_theme"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the chapter theme",
    )
    chapter_id = Column(
        UUID(as_uuid=True),
        ForeignKey("story_chapter.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the chapter",
    )
    theme_id = Column(
        UUID(as_uuid=True),
        ForeignKey("story_theme.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the theme",
    )

    # How theme appears
    prominence = Column(
        String(50),
        doc="Prominence: 'dominant', 'present', 'subtle', 'emerging'",
    )
    how_explored = Column(
        Text,
        doc="How theme is explored in this chapter",
    )

    # Timestamps
    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the chapter theme was created",
    )

    # Unique constraint
    __table_args__ = (
        UniqueConstraint("chapter_id", "theme_id", name="uq_chapter_theme"),
    )

    # Relationships
    chapter = relationship(
        "StoryChapter",
        back_populates="chapter_themes",
    )
    theme = relationship(
        "StoryTheme",
        back_populates="chapter_themes",
    )


# Indexes for chapter_theme
Index("idx_chapter_theme_chapter", ChapterTheme.chapter_id)
Index("idx_chapter_theme_theme", ChapterTheme.theme_id)


class StoryScene(Base):
    """Individual scenes (the building blocks of memoir).

    Contains scene identity, elements, purpose, sensory details,
    craft elements, scene structure, memoir craft, and status.
    """

    __tablename__ = "story_scene"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the scene",
    )
    story_id = Column(
        UUID(as_uuid=True),
        ForeignKey("story.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the parent story",
    )
    chapter_id = Column(
        UUID(as_uuid=True),
        ForeignKey("story_chapter.id"),
        nullable=True,
        doc="Reference to the chapter",
    )
    section_id = Column(
        UUID(as_uuid=True),
        ForeignKey("chapter_section.id"),
        nullable=True,
        doc="Reference to the section",
    )
    life_event_id = Column(
        UUID(as_uuid=True),
        ForeignKey("life_event.id", ondelete="SET NULL"),
        nullable=True,
        doc="Reference to the life event",
    )

    # Scene identity
    scene_name = Column(
        String(200),
        doc="Scene name",
    )
    scene_description = Column(
        Text,
        doc="Scene description",
    )

    # Scene elements (showing vs telling)
    scene_setting = Column(
        Text,
        doc="Specific time and place",
    )
    scene_time = Column(
        String(200),
        doc="Time description, e.g., 'Summer 1967, late afternoon'",
    )
    scene_place = Column(
        String(200),
        doc="Place description, e.g., 'Our kitchen in the Boston apartment'",
    )

    # Scene purpose
    scene_purpose = Column(
        Text,
        doc="What this scene accomplishes",
    )
    reveals_character = Column(
        Text,
        doc="Character revelation",
    )
    advances_plot = Column(
        Text,
        doc="Plot advancement",
    )
    develops_theme = Column(
        Text,
        doc="Thematic development",
    )

    # Sensory details
    visual_details = Column(
        ARRAY(Text),
        doc="Visual details",
    )
    auditory_details = Column(
        ARRAY(Text),
        doc="Auditory details",
    )
    tactile_details = Column(
        ARRAY(Text),
        doc="Tactile details",
    )
    olfactory_details = Column(
        ARRAY(Text),
        doc="Olfactory details",
    )
    gustatory_details = Column(
        ARRAY(Text),
        doc="Gustatory details",
    )

    # Craft elements
    has_dialogue = Column(
        Boolean,
        default=False,
        doc="Whether the scene has dialogue",
    )
    dialogue_snippet = Column(
        Text,
        doc="Key dialogue from scene",
    )
    has_internal_monologue = Column(
        Boolean,
        default=False,
        doc="Whether the scene has internal monologue",
    )
    internal_thoughts = Column(
        Text,
        doc="Internal thoughts",
    )
    emotional_tone = Column(
        String(50),
        doc="Tone: 'tense', 'joyful', 'melancholic', 'anxious'",
    )

    # Scene structure
    opening_image = Column(
        Text,
        doc="How scene opens",
    )
    inciting_action = Column(
        Text,
        doc="What triggers the scene",
    )
    complication = Column(
        Text,
        doc="What makes it complex",
    )
    climax = Column(
        Text,
        doc="Peak moment",
    )
    resolution = Column(
        Text,
        doc="How scene concludes",
    )

    # Memoir craft
    reflection = Column(
        Text,
        doc="Looking-back perspective on this scene",
    )
    meaning_made = Column(
        Text,
        doc="What storyteller understands now",
    )

    # Status
    status = Column(
        String(50),
        default="outlined",
        doc="Status: 'outlined', 'drafted', 'revised', 'polished'",
    )
    word_count = Column(
        Integer,
        doc="Word count",
    )

    # Timestamps
    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the scene was created",
    )
    updated_at = Column(
        DateTime,
        default=datetime.now,
        onupdate=datetime.now,
        doc="Timestamp when the scene was last updated",
    )

    # Relationships
    story = relationship(
        "Story",
        back_populates="scenes",
    )
    chapter = relationship(
        "StoryChapter",
        back_populates="scenes",
    )
    section = relationship(
        "ChapterSection",
        back_populates="scenes",
    )
    life_event = relationship(
        "LifeEvent",
        backref="story_scenes",
    )


# Indexes for story_scene
Index("idx_story_scene_story", StoryScene.story_id)
Index("idx_story_scene_chapter", StoryScene.chapter_id)


class StoryDraft(Base):
    """Version history of the story and chapters.

    Contains draft metadata, content, notes, and status.
    """

    __tablename__ = "story_draft"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier for the draft",
    )
    story_id = Column(
        UUID(as_uuid=True),
        ForeignKey("story.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the parent story",
    )
    chapter_id = Column(
        UUID(as_uuid=True),
        ForeignKey("story_chapter.id", ondelete="CASCADE"),
        nullable=False,
        doc="Reference to the chapter",
    )

    # Draft metadata
    draft_type = Column(
        String(50),
        doc="Type: 'story_level', 'chapter', 'section'",
    )
    draft_version = Column(
        Integer,
        nullable=False,
        doc="Draft version number",
    )
    version_name = Column(
        String(100),
        doc="Version name, e.g., 'First draft', 'Revision after feedback'",
    )

    # Content
    content = Column(
        Text,
        doc="Full text of this draft",
    )
    word_count = Column(
        Integer,
        doc="Word count",
    )

    # Draft notes
    revision_notes = Column(
        Text,
        doc="What changed in this version",
    )
    feedback_received = Column(
        Text,
        doc="Feedback that led to this revision",
    )

    # Status
    is_current = Column(
        Boolean,
        default=False,
        doc="Whether this is the current draft",
    )

    # Timestamps
    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when the draft was created",
    )

    # Relationships
    story = relationship(
        "Story",
        back_populates="drafts",
    )
    chapter = relationship(
        "StoryChapter",
        back_populates="drafts",
    )


# Indexes for story_draft
Index("idx_story_draft_story", StoryDraft.story_id, StoryDraft.draft_version)
Index("idx_story_draft_chapter", StoryDraft.chapter_id, StoryDraft.draft_version)


# Export all models
__all__ = [
    "Story",
    "StoryChapter",
    "ChapterSection",
    "StoryCollection",
    "StoryCharacter",
    "CharacterRelationship",
    "CharacterAppearance",
    "StoryTheme",
    "ChapterTheme",
    "StoryScene",
    "StoryDraft",
]
