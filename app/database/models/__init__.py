"""
Database Models Package

This package provides SQLAlchemy models for the Everbound backend.
All models are exported from their respective modules for convenient imports.

Usage:
    from database.models import Storyteller, Story, Collection, Agent

Modules:
    - base: Shared mixins (UUIDMixin, TimestampMixin, BaseModelMixin)
    - storyteller: Storyteller and life event models
    - story: Story/book and chapter models
    - collection: Collection organization models
    - session_models: Session and interaction models
    - process: Process flow and prompt models
    - operations: System operations and tracking models
"""

# Base mixins
from database.models.base import (
    BaseModelMixin,
    TimestampMixin,
    UUIDMixin,
)

# Storyteller models
from database.models.storyteller import (
    LifeEvent,
    LifeEventBoundary,
    LifeEventDetail,
    LifeEventLocation,
    LifeEventMedia,
    LifeEventParticipant,
    LifeEventPreference,
    LifeEventTimespan,
    LifeEventTrauma,
    Storyteller,
    StorytellerBoundary,
    StorytellerPreference,
)

# Story models
from database.models.story import (
    ChapterSection,
    ChapterTheme,
    CharacterAppearance,
    CharacterRelationship,
    Story,
    StoryChapter,
    StoryCharacter,
    StoryCollection,
    StoryDraft,
    StoryScene,
    StoryTheme,
)

# Collection models
from database.models.collection import (
    Collection,
    CollectionGrouping,
    CollectionGroupingMember,
    CollectionLifeEvent,
    CollectionRelationship,
    CollectionSynthesis,
    CollectionTag,
)

# Session models
from database.models.session_models import (
    SessionArchetype,
    SessionArtifact,
    SessionInteraction,
    SessionLifeEvent,
    SessionNote,
    SessionProfile,
    SessionProgress,
    SessionScope,
    SessionSectionStatus,
    SessionSynthesis,
    SessionTemplate,
    StorytellerSession,
)

# Process models
from database.models.process import (
    ProcessCommitment,
    ProcessFlowEdge,
    ProcessNode,
    ProcessNodeType,
    ProcessPrompt,
    ProcessSection,
    ProcessVersion,
    PromptPackPrompt,
    PromptPackTemplate,
    SectionPrompt,
)

# Operations models
from database.models.operations import (
    Agent,
    AgentInstance,
    ArchetypeAnalysis,
    BookExport,
    BookExportDelivery,
    EditRequirement,
    Requirement,
    ScopeType,
    StorytellerProgress,
    StorytellerSectionSelection,
    StorytellerSectionStatus,
    UserFeedback,
)

__all__ = [
    # Base mixins
    "UUIDMixin",
    "TimestampMixin",
    "BaseModelMixin",
    # Storyteller models
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
    # Story models
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
    # Collection models
    "Collection",
    "CollectionLifeEvent",
    "CollectionGrouping",
    "CollectionGroupingMember",
    "CollectionRelationship",
    "CollectionTag",
    "CollectionSynthesis",
    # Session models
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
    # Process models
    "ProcessVersion",
    "ProcessCommitment",
    "ProcessNodeType",
    "ProcessNode",
    "ProcessFlowEdge",
    "ProcessPrompt",
    "PromptPackTemplate",
    "PromptPackPrompt",
    "ProcessSection",
    "SectionPrompt",
    # Operations models
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
