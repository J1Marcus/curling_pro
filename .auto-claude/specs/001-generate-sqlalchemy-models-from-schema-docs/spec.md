# Specification: Generate SQLAlchemy Models from Schema Documentation

## Overview

This task involves generating comprehensive SQLAlchemy ORM models for the Everbound life story capture and book formation system based on detailed schema documentation located in `ai_docs/context/source_docs/schema/`. The schema defines 63 database tables organized across six domain areas: Process Management, Storyteller & Life Events, Sessions, Collections, Story/Book, and System Operations. Once models are created, Alembic migrations will be generated and applied to populate a local Supabase (PostgreSQL) database running in Docker.

## Workflow Type

**Type**: feature

**Rationale**: This is a significant new feature implementation that adds the complete data layer for the Everbound application. It requires creating new model files, following established patterns, and integrating with the existing Alembic migration infrastructure.

## Task Scope

### Services Involved
- **main** (primary) - FastAPI backend service where all database models reside

### This Task Will:
- [ ] Create SQLAlchemy models matching all tables defined in schema documentation
- [ ] Organize models into logical module files following existing patterns
- [ ] Update Alembic env.py to import all new models for autogenerate support
- [ ] Generate Alembic migration via `app/makemigration.sh`
- [ ] Apply migration to local Supabase via `app/migrate.sh`
- [ ] Verify all tables exist in the database

### Out of Scope:
- API endpoints for the new models
- Business logic implementation
- Seed data population
- Row-level security (RLS) policies
- Application-level encryption
- Repository classes for new models

## Service Context

### Main Backend Service

**Tech Stack:**
- Language: Python
- Framework: FastAPI
- ORM: SQLAlchemy (declarative base)
- Migrations: Alembic
- Database: PostgreSQL (Supabase)
- Package Manager: pip
- Linting: Ruff

**Entry Point:** `app/`

**How to Run:**
```bash
cd app && ./migrate.sh
```

**Port:** 8000

**Key Directories:**
- `app/database/` - Database models and utilities
- `app/alembic/` - Migration configuration and versions

## Files to Modify

| File | Service | What to Change |
|------|---------|---------------|
| `app/database/__init__.py` | main | Export all new model modules |
| `app/alembic/env.py` | main | Add imports for all new model modules for autogenerate support |

## Files to Create

| File | Service | Purpose |
|------|---------|---------|
| `app/database/models/__init__.py` | main | Module init with all model exports |
| `app/database/models/base.py` | main | Shared mixins (TimestampMixin, etc.) |
| `app/database/models/process.py` | main | Process management models (10 tables) |
| `app/database/models/storyteller.py` | main | Storyteller and life event models (12 tables) |
| `app/database/models/session_models.py` | main | Session and interaction models (12 tables) |
| `app/database/models/collection.py` | main | Collection and grouping models (7 tables) |
| `app/database/models/story.py` | main | Story, chapter, scene, character models (11 tables) |
| `app/database/models/operations.py` | main | Progress, feedback, agent, export models (12 tables) |

## Files to Reference

These files show patterns to follow:

| File | Pattern to Copy |
|------|----------------|
| `app/database/event.py` | SQLAlchemy model structure, UUID primary key, JSON columns, datetime columns |
| `app/database/session.py` | Base class declaration, engine/session setup |
| `app/database/database_utils.py` | Connection string pattern |
| `app/alembic/env.py` | Model import pattern for autogenerate |

## Patterns to Follow

### Model Definition Pattern

From `app/database/event.py`:

```python
import uuid
from datetime import datetime

from sqlalchemy import JSON, Column, DateTime, String, Boolean, Integer, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship

from database.session import Base


class ModelName(Base):
    """Docstring describing the model purpose."""

    __tablename__ = "table_name"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid1,
        doc="Unique identifier",
    )
    # Other columns...

    created_at = Column(
        DateTime,
        default=datetime.now,
        doc="Timestamp when record was created"
    )
    updated_at = Column(
        DateTime,
        default=datetime.now,
        onupdate=datetime.now,
        doc="Timestamp when record was last updated",
    )
```

**Key Points:**
- Use `UUID(as_uuid=True)` for primary keys with `uuid.uuid1` default
- Include `created_at` and `updated_at` columns on all models
- Use `doc=` parameter for column documentation
- Import `Base` from `database.session`
- Use `ARRAY` from `sqlalchemy.dialects.postgresql` for TEXT[] columns

### Foreign Key Pattern

```python
storyteller_id = Column(
    UUID(as_uuid=True),
    ForeignKey("storyteller.id", ondelete="CASCADE"),
    nullable=False,
    doc="Reference to parent storyteller",
)

# Define relationship for ORM access
storyteller = relationship("Storyteller", back_populates="life_events")
```

### PostgreSQL-Specific Types

```python
from sqlalchemy import ARRAY, Text, Numeric
from sqlalchemy.dialects.postgresql import UUID, JSONB

# Arrays
tags = Column(ARRAY(Text), doc="Array of text values")

# JSONB for flexible JSON storage
structured_data = Column(JSONB, doc="Structured JSON data")

# Decimal for confidence scores (0.00 to 1.00)
confidence_score = Column(Numeric(3, 2), doc="Confidence score")
```

### Index Creation Pattern

```python
from sqlalchemy import Index

class StorytellerSession(Base):
    __tablename__ = "session"
    # ... columns ...

# Create indexes after class definition
Index("idx_session_storyteller", StorytellerSession.storyteller_id, StorytellerSession.status)
```

### Alembic Import Pattern

From `app/alembic/env.py`:

```python
# This import is required for autogenerate support
from database.event import *
from database.models.process import *
from database.models.storyteller import *
from database.models.session_models import *
from database.models.collection import *
from database.models.story import *
from database.models.operations import *
```

## Requirements

### Functional Requirements

1. **Process Management Models**
   - Description: Models for process_version, process_commitment, process_node_type, process_node, process_flow_edge, process_section, process_prompt, prompt_pack_template, prompt_pack_prompt, section_prompt
   - Acceptance: All tables created with correct columns, relationships, and indexes

2. **Storyteller Models**
   - Description: Models for storyteller, storyteller_boundary, storyteller_preference, life_event, life_event_timespan, life_event_location, life_event_participant, life_event_detail, life_event_trauma, life_event_boundary, life_event_media, life_event_preference
   - Acceptance: All tables with proper foreign keys and cascading deletes

3. **Session Models**
   - Description: Models for session (renamed to StorytellerSession to avoid conflict), session_scope, session_profile, session_progress, session_section_status, session_synthesis, session_archetype, session_life_event, session_interaction, session_artifact, session_template, session_note
   - Acceptance: All session-related tables with JSONB columns for flexible data

4. **Collection Models**
   - Description: Models for collection, collection_life_event, collection_grouping, collection_grouping_member, collection_relationship, collection_tag, collection_synthesis
   - Acceptance: Many-to-many relationships properly defined

5. **Story Models**
   - Description: Models for story, story_chapter, chapter_section, story_collection, story_character, character_relationship, character_appearance, story_theme, chapter_theme, story_scene, story_draft
   - Acceptance: Complex hierarchical relationships properly modeled

6. **Operations Models**
   - Description: Models for storyteller_progress, storyteller_section_selection, storyteller_section_status, scope_type, archetype_analysis, user_feedback, agent, agent_instance, requirement, edit_requirement, book_export, book_export_delivery
   - Acceptance: All operational infrastructure tables created

### Edge Cases

1. **Circular Foreign Keys** - Use `post_update=True` or string references for circular dependencies (e.g., `process_section.unlock_after_section_id` self-reference)
2. **ARRAY Columns** - PostgreSQL-specific, use `ARRAY(Text)` or `ARRAY(UUID(as_uuid=True))`
3. **JSONB Columns** - Use `JSONB` from `sqlalchemy.dialects.postgresql` for optimal PostgreSQL performance
4. **Unique Constraints** - Handle compound unique constraints via `UniqueConstraint` or `Index(..., unique=True)`
5. **Self-Referential Foreign Keys** - Use string table names for self-references
6. **Session Name Conflict** - The model file `app/database/session.py` already exists for SQLAlchemy session management; name the Session model class `StorytellerSession`

## Implementation Notes

### DO
- Follow the existing `Event` model pattern exactly for consistency
- Use `UUID(as_uuid=True)` for all UUID columns including foreign keys
- Include proper indexes as specified in schema documentation
- Create composite unique constraints where specified
- Use `ARRAY(Text)` for TEXT[] columns
- Define `back_populates` on both sides of relationships
- Use `ondelete="CASCADE"` or `ondelete="SET NULL"` as specified in schemas
- Use `JSONB` instead of `JSON` for PostgreSQL optimization

### DON'T
- Don't use `Integer` for primary keys - use UUID
- Don't forget to add `__tablename__` to each model
- Don't create models that conflict with Python reserved words (e.g., rename `session` model to `StorytellerSession`)
- Don't forget to update alembic/env.py with imports for autogenerate to work
- Don't use `backref` - use explicit `back_populates` for clarity
- Don't create a `users` table - it's assumed to exist externally (Supabase Auth); make `user_id` foreign keys nullable or omit them
- Don't use `datetime.utcnow` - use `datetime.now` per existing pattern
- Don't use `mapped_column` - use traditional `Column` syntax per existing pattern

## Implementation Order

Based on foreign key dependencies, models should be created in this order:

### Phase 1 - Core Foundation (no foreign key dependencies):
- `process_version`
- `process_node_type`
- `storyteller` (note: references `users` table - make FK nullable or omit)
- `scope_type`
- `agent`
- `prompt_pack_template`

### Phase 2 - Process Framework:
- `process_commitment` (depends on process_version)
- `process_node` (depends on process_version, process_node_type)
- `process_flow_edge` (depends on process_version, process_node)
- `process_section` (depends on process_version, self-ref for unlock_after)
- `process_prompt` (depends on process_node)
- `prompt_pack_prompt` (depends on prompt_pack_template)
- `section_prompt` (depends on process_section, process_prompt)

### Phase 3 - Storyteller & Life Events:
- `storyteller_boundary` (depends on storyteller)
- `storyteller_preference` (depends on storyteller)
- `life_event` (depends on storyteller)
- `life_event_timespan` (depends on life_event)
- `life_event_location` (depends on life_event)
- `life_event_participant` (depends on life_event)
- `life_event_detail` (depends on life_event)
- `life_event_trauma` (depends on life_event)
- `life_event_boundary` (depends on life_event)
- `life_event_media` (depends on life_event)
- `life_event_preference` (depends on life_event)

### Phase 4 - Sessions:
- `storyteller_session` (renamed, depends on storyteller, process_version, process_node)
- `session_scope` (depends on storyteller_session)
- `session_profile` (depends on storyteller_session)
- `session_progress` (depends on storyteller_session, process_node)
- `session_section_status` (depends on storyteller_session, process_section)
- `session_synthesis` (depends on storyteller_session, process_section)
- `session_archetype` (depends on storyteller_session)
- `session_life_event` (depends on storyteller_session, life_event)
- `session_interaction` (depends on storyteller_session, life_event)
- `session_artifact` (depends on storyteller_session, life_event)
- `session_template` (depends on process_version)
- `session_note` (depends on storyteller_session)

### Phase 5 - Collections:
- `collection` (depends on storyteller)
- `collection_life_event` (depends on collection, life_event)
- `collection_grouping` (depends on storyteller)
- `collection_grouping_member` (depends on collection_grouping, collection)
- `collection_relationship` (depends on collection)
- `collection_tag` (depends on collection)
- `collection_synthesis` (depends on collection)

### Phase 6 - Story:
- `story` (depends on storyteller)
- `story_chapter` (depends on story)
- `chapter_section` (depends on story_chapter)
- `story_collection` (depends on story, story_chapter, collection)
- `story_character` (depends on story, storyteller, story_chapter)
- `character_relationship` (depends on story, story_character)
- `character_appearance` (depends on story_character, story_chapter, chapter_section)
- `story_theme` (depends on story)
- `chapter_theme` (depends on story_chapter, story_theme)
- `story_scene` (depends on story, story_chapter, chapter_section, life_event)
- `story_draft` (depends on story, story_chapter)

### Phase 7 - Operations:
- `storyteller_progress` (depends on storyteller, process_version)
- `storyteller_section_selection` (depends on storyteller, process_section)
- `storyteller_section_status` (depends on storyteller, process_section)
- `archetype_analysis` (depends on storyteller, collection, story, self-ref)
- `user_feedback` (depends on storyteller)
- `agent_instance` (depends on agent, storyteller_session, storyteller)
- `requirement` (depends on storyteller, process_section, life_event, collection, storyteller_session)
- `edit_requirement` (depends on story, storyteller, story_chapter, chapter_section, story_character, story_theme)
- `book_export` (depends on story, storyteller)
- `book_export_delivery` (depends on book_export, storyteller)

## Development Environment

### Start Services

```bash
# Start local Supabase (Docker) - assumed already running
cd docker && docker-compose up -d

# Generate migration
cd app && ./makemigration.sh

# Apply migration
cd app && ./migrate.sh
```

### Service URLs
- Supabase (PostgreSQL): localhost:5432
- API (if running): http://localhost:8000
- API Docs: http://localhost:8000/docs
- Supabase Studio: http://localhost:54323 (typical local Supabase port)

### Required Environment Variables
- `DATABASE_HOST`: localhost or Docker container name
- `DATABASE_PORT`: 5432
- `DATABASE_NAME`: postgres
- `DATABASE_USER`: postgres
- `DATABASE_PASSWORD`: postgres

## Success Criteria

The task is complete when:

1. [ ] All 63 SQLAlchemy models are created matching schema documentation
2. [ ] Models organized into logical module files in `app/database/models/`
3. [ ] `app/alembic/env.py` updated to import all models
4. [ ] Alembic migration generated successfully via `./makemigration.sh`
5. [ ] Migration applied successfully via `./migrate.sh`
6. [ ] All tables verified in local Supabase database
7. [ ] No console errors during migration
8. [ ] Existing `events` table preserved
9. [ ] All foreign key relationships properly established
10. [ ] All indexes created as specified in schema docs

## QA Acceptance Criteria

**CRITICAL**: These criteria must be verified by the QA Agent before sign-off.

### Unit Tests
| Test | File | What to Verify |
|------|------|----------------|
| Model Import Test | `app/database/models/__init__.py` | All models can be imported without errors |
| Base Inheritance | All model files | All models inherit from Base |
| Column Types | All model files | UUID, JSONB, ARRAY types use PostgreSQL dialect |

### Integration Tests
| Test | Services | What to Verify |
|------|----------|----------------|
| Migration Generation | Alembic ↔ Database | `makemigration.sh` completes without errors |
| Migration Application | Alembic ↔ Supabase | `migrate.sh` creates all tables |
| Foreign Keys | Database | CASCADE deletes work properly |

### End-to-End Tests
| Flow | Steps | Expected Outcome |
|------|-------|------------------|
| Migration Flow | 1. Run makemigration.sh 2. Run migrate.sh | All tables created in database |

### Database Verification
| Check | Query/Command | Expected |
|-------|---------------|----------|
| Tables exist | `SELECT tablename FROM pg_tables WHERE schemaname = 'public';` | All 63+ tables listed |
| Indexes exist | `SELECT indexname FROM pg_indexes WHERE schemaname = 'public';` | All specified indexes created |
| FK constraints | `SELECT constraint_name FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY';` | All foreign key relationships exist |
| Events table preserved | `SELECT * FROM events LIMIT 1;` | Existing table still accessible |

### QA Sign-off Requirements
- [ ] All SQLAlchemy models compile without import errors
- [ ] Migration generation completes successfully
- [ ] Migration application creates all tables
- [ ] All foreign key relationships exist in database
- [ ] All indexes created as specified
- [ ] No regressions - existing Event table still works
- [ ] Code follows existing `app/database/event.py` patterns
- [ ] No security vulnerabilities introduced

## Table Count Summary

From schema documentation:

| Schema File | Tables |
|-------------|--------|
| process_schema.md | 10 |
| storyteller_schema.md | 12 |
| session_schema.md | 12 |
| collection_schema.md | 7 |
| story_schema.md | 11 |
| system_operations_schema.md | 12 |
| **Total** | **64** (including existing events) |

## Model Summary by Module

### process.py (10 models)
- ProcessVersion
- ProcessCommitment
- ProcessNodeType
- ProcessNode
- ProcessFlowEdge
- ProcessSection
- ProcessPrompt
- PromptPackTemplate
- PromptPackPrompt
- SectionPrompt

### storyteller.py (12 models)
- Storyteller
- StorytellerBoundary
- StorytellerPreference
- LifeEvent
- LifeEventTimespan
- LifeEventLocation
- LifeEventParticipant
- LifeEventDetail
- LifeEventTrauma
- LifeEventBoundary
- LifeEventMedia
- LifeEventPreference

### session_models.py (12 models)
- StorytellerSession (renamed from Session to avoid conflict)
- SessionScope
- SessionProfile
- SessionProgress
- SessionSectionStatus
- SessionSynthesis
- SessionArchetype
- SessionLifeEvent
- SessionInteraction
- SessionArtifact
- SessionTemplate
- SessionNote

### collection.py (7 models)
- Collection
- CollectionLifeEvent
- CollectionGrouping
- CollectionGroupingMember
- CollectionRelationship
- CollectionTag
- CollectionSynthesis

### story.py (11 models)
- Story
- StoryChapter
- ChapterSection
- StoryCollection
- StoryCharacter
- CharacterRelationship
- CharacterAppearance
- StoryTheme
- ChapterTheme
- StoryScene
- StoryDraft

### operations.py (12 models)
- StorytellerProgress
- StorytellerSectionSelection
- StorytellerSectionStatus
- ScopeType
- ArchetypeAnalysis
- UserFeedback
- Agent
- AgentInstance
- Requirement
- EditRequirement
- BookExport
- BookExportDelivery

**Total: 64 models across 6 modules** (63 new + 1 existing Event)

## Notes

- The schema references a `users` table that may not exist yet. Make `user_id` foreign keys nullable or omit them entirely if Supabase Auth handles users externally.
- The existing `session` module in `app/database/session.py` handles SQLAlchemy session management - the new Session model from schema should be named `StorytellerSession`.
- DECIMAL types should use `Numeric(precision, scale)` in SQLAlchemy.
- PostgreSQL-specific types like `JSONB` should use `from sqlalchemy.dialects.postgresql import JSONB`.
- Self-referential foreign keys (like `process_section.unlock_after_section_id` and `archetype_analysis.previous_analysis_id`) need special handling with string references.
