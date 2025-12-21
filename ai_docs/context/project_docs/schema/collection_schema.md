# Collection Schema

## Design Philosophy
- **Collections**: Groups of life events organized by theme, meaning, or principle
- **Flexible organizing principles**: Theme, archetype, timeline, storyline, or custom
- **Hierarchical**: Collections can be grouped into higher-order structures
- **Narrative-aware**: Collections understand how events relate in the story
- **Book-oriented**: Collections inform chapter/section structure
- **Evolving**: Collections can be created, refined, merged, split as understanding deepens

---

## Core Tables

### collection
A curated group of life events organized around a principle.

```sql
CREATE TABLE collection (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storyteller_id UUID REFERENCES storyteller(id) ON DELETE CASCADE,

    -- Collection identity
    collection_name VARCHAR(200) NOT NULL,  -- "My faith journey", "Career evolution", "Loss and resilience"
    description TEXT,

    -- Organizing principle
    organizing_principle VARCHAR(100),      -- 'theme', 'archetype', 'timeline', 'storyline',
                                            -- 'relationship', 'place', 'transformation', 'custom'

    organizing_value TEXT,                  -- The specific principle
                                            -- e.g., "faith", "hero's journey", "1960s-1970s",
                                            -- "relationship with father"

    -- Narrative structure
    narrative_arc VARCHAR(100),             -- 'linear', 'cyclical', 'transformation', 'quest',
                                            -- 'tragedy', 'comedy', 'rebirth', 'rags_to_riches'

    archetype_pattern VARCHAR(100),         -- From process.txt: 'loss_to_connection',
                                            -- 'transformation', 'endurance', 'threat_survival',
                                            -- 'identity_shift', 'meaning_making'

    -- Collection metadata
    collection_type VARCHAR(50),            -- 'thematic', 'chronological', 'relational',
                                            -- 'geographical', 'emotional_journey', 'custom'

    -- Status
    is_provisional BOOLEAN DEFAULT true,    -- Still being refined
    is_approved BOOLEAN DEFAULT false,      -- Storyteller confirmed this makes sense
    approved_at TIMESTAMP,

    -- Book usage
    include_in_book BOOLEAN DEFAULT true,
    book_section_type VARCHAR(50),          -- 'chapter', 'part', 'vignette', 'sidebar'
    suggested_title VARCHAR(200),           -- Suggested chapter/section title
    display_order INTEGER,                  -- Order in book

    -- Synthesis
    synthesis_summary TEXT,                 -- AI-generated summary of this collection
    synthesis_themes TEXT[],                -- Key themes across these events
    synthesis_tone VARCHAR(50),             -- Overall emotional tone

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_collection_storyteller ON collection(storyteller_id);
CREATE INDEX idx_collection_principle ON collection(organizing_principle);
CREATE INDEX idx_collection_archetype ON collection(archetype_pattern);
```

---

## Collection Membership

### collection_life_event
Many-to-many relationship between collections and life events.

```sql
CREATE TABLE collection_life_event (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID REFERENCES collection(id) ON DELETE CASCADE,
    life_event_id UUID REFERENCES life_event(id) ON DELETE CASCADE,

    -- Ordering
    sequence_order INTEGER,                 -- Position in collection (if order matters)
    is_anchor_event BOOLEAN DEFAULT false,  -- Is this a pivotal event in the collection?

    -- Narrative role
    narrative_role VARCHAR(100),            -- 'inciting_incident', 'rising_action', 'climax',
                                            -- 'falling_action', 'resolution', 'reflection',
                                            -- 'setup', 'turning_point', 'consequence'

    narrative_function TEXT,                -- How this event functions in the collection story
                                            -- e.g., "Sets the stage for faith crisis",
                                            -- "Shows the moment everything changed"

    -- Thematic connection
    connection_to_theme TEXT,               -- How this event relates to collection theme

    -- Metadata
    added_at TIMESTAMP DEFAULT NOW(),
    added_by VARCHAR(100),                  -- 'system', 'user', 'agent'

    UNIQUE(collection_id, life_event_id)
);

CREATE INDEX idx_collection_life_event_collection ON collection_life_event(collection_id, sequence_order);
CREATE INDEX idx_collection_life_event_event ON collection_life_event(life_event_id);
```

---

## Collection Groupings (Collections of Collections)

### collection_grouping
Higher-order organization of multiple collections.

```sql
CREATE TABLE collection_grouping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storyteller_id UUID REFERENCES storyteller(id) ON DELETE CASCADE,

    -- Grouping identity
    grouping_name VARCHAR(200) NOT NULL,    -- "My spiritual evolution", "Relationships across time"
    grouping_description TEXT,

    -- Grouping type
    grouping_type VARCHAR(100),             -- 'archetype', 'storyline', 'timeline', 'thematic_meta',
                                            -- 'book_part', 'narrative_thread', 'custom'

    grouping_principle TEXT,                -- The overarching principle
                                            -- e.g., "Shows progression from loss to meaning",
                                            -- "All the major relationships in my life"

    -- Book usage
    book_part_type VARCHAR(50),             -- 'part', 'section', 'act', 'book'
    suggested_part_title VARCHAR(200),

    -- Ordering
    display_order INTEGER,

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_collection_grouping_storyteller ON collection_grouping(storyteller_id);
```

### collection_grouping_member
Which collections belong to which groupings.

```sql
CREATE TABLE collection_grouping_member (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grouping_id UUID REFERENCES collection_grouping(id) ON DELETE CASCADE,
    collection_id UUID REFERENCES collection(id) ON DELETE CASCADE,

    -- Ordering within grouping
    sequence_order INTEGER,

    -- Relationship context
    relationship_to_grouping TEXT,          -- How this collection fits in the grouping
                                            -- e.g., "First phase of transformation",
                                            -- "The inciting relationships"

    created_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(grouping_id, collection_id)
);

CREATE INDEX idx_collection_grouping_member_grouping ON collection_grouping_member(grouping_id, sequence_order);
CREATE INDEX idx_collection_grouping_member_collection ON collection_grouping_member(collection_id);
```

---

## Collection Relationships

### collection_relationship
How collections relate to each other (without formal grouping).

```sql
CREATE TABLE collection_relationship (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- The two collections
    source_collection_id UUID REFERENCES collection(id) ON DELETE CASCADE,
    target_collection_id UUID REFERENCES collection(id) ON DELETE CASCADE,

    -- Relationship type
    relationship_type VARCHAR(100),         -- 'leads_to', 'contrasts_with', 'parallels',
                                            -- 'causes', 'influenced_by', 'mirrors',
                                            -- 'precedes', 'resolves', 'complicates'

    relationship_description TEXT,          -- Explain the connection

    -- Strength
    strength VARCHAR(50),                   -- 'strong', 'moderate', 'weak', 'subtle'

    -- Bidirectional or not
    is_bidirectional BOOLEAN DEFAULT false,

    created_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(source_collection_id, target_collection_id, relationship_type)
);

CREATE INDEX idx_collection_relationship_source ON collection_relationship(source_collection_id);
CREATE INDEX idx_collection_relationship_target ON collection_relationship(target_collection_id);
```

---

## Supporting Tables

### collection_tag
Flexible tagging for collections.

```sql
CREATE TABLE collection_tag (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID REFERENCES collection(id) ON DELETE CASCADE,

    -- Tag details
    tag_category VARCHAR(100),              -- 'emotion', 'theme', 'location', 'era', 'relationship'
    tag_value VARCHAR(200),                 -- The actual tag

    -- Context
    relevance_note TEXT,                    -- Why this tag applies

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_collection_tag_collection ON collection_tag(collection_id);
CREATE INDEX idx_collection_tag_category ON collection_tag(tag_category, tag_value);
```

### collection_synthesis
AI-generated analysis and synthesis of a collection.

```sql
CREATE TABLE collection_synthesis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID REFERENCES collection(id) ON DELETE CASCADE,

    -- Synthesis content
    synthesis_type VARCHAR(50),             -- 'summary', 'theme_analysis', 'arc_analysis',
                                            -- 'character_development', 'draft_chapter'

    synthesis_version INTEGER DEFAULT 1,
    content TEXT NOT NULL,
    structured_data JSONB,                  -- Additional structured insights

    -- Quality
    is_provisional BOOLEAN DEFAULT true,
    is_approved BOOLEAN DEFAULT false,
    approved_at TIMESTAMP,

    -- User feedback
    user_feedback TEXT,
    needs_revision BOOLEAN DEFAULT false,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_collection_synthesis ON collection_synthesis(collection_id, synthesis_version);
```

---

## Relationships Summary

```
collection (group of events by principle)
    ├── storyteller (many:1)
    │
    ├── collection_life_event (many:many join) → life_event
    │   └── Events in this collection with narrative roles
    │
    ├── collection_grouping_member (many:many join) → collection_grouping
    │   └── This collection can belong to multiple groupings
    │
    ├── collection_relationship (many:many)
    │   └── How this collection relates to other collections
    │
    ├── collection_tag (1:many)
    │   └── Flexible tagging
    │
    └── collection_synthesis (1:many)
        └── AI-generated analysis and drafts
```

---

## Predefined Organizing Principles

### Archetype Patterns (from process.txt)

```python
ARCHETYPE_PATTERNS = {
    'loss_to_connection': {
        'description': 'Journey from loss toward connection and belonging',
        'narrative_arc': 'transformation',
        'typical_sequence': ['loss_event', 'isolation', 'search', 'connection', 'integration']
    },
    'transformation': {
        'description': 'Fundamental identity shift through challenge',
        'narrative_arc': 'rebirth',
        'typical_sequence': ['old_self', 'crisis', 'dissolution', 'emergence', 'new_self']
    },
    'endurance': {
        'description': 'Sustained resilience through prolonged difficulty',
        'narrative_arc': 'quest',
        'typical_sequence': ['onset', 'struggle', 'adaptation', 'perseverance', 'survival']
    },
    'threat_survival': {
        'description': 'Overcoming immediate danger or crisis',
        'narrative_arc': 'tragedy_to_triumph',
        'typical_sequence': ['threat', 'response', 'confrontation', 'survival', 'aftermath']
    },
    'identity_shift': {
        'description': 'Evolving sense of self across life phases',
        'narrative_arc': 'linear',
        'typical_sequence': ['origin_identity', 'questioning', 'exploration', 'integration', 'new_identity']
    },
    'meaning_making': {
        'description': 'Finding or creating meaning from experience',
        'narrative_arc': 'quest',
        'typical_sequence': ['confusion', 'search', 'insight', 'integration', 'wisdom']
    }
}
```

### Theme-Based Collections

```python
COMMON_THEMES = [
    'faith_spiritual_journey',
    'career_professional_identity',
    'family_relationships',
    'romantic_partnerships',
    'parenthood',
    'loss_grief',
    'health_body_relationship',
    'creativity_expression',
    'place_belonging',
    'service_contribution',
    'learning_growth',
    'conflict_resolution'
]
```

### Timeline-Based Collections

```python
TIMELINE_TYPES = [
    'decade',           # Events from the 1960s
    'era',              # College years, child-raising years
    'life_phase',       # Childhood, adolescence, young adult, middle age, elder
    'historical_period' # During the war, depression era, civil rights movement
]
```

---

## Usage Patterns

### 1. Creating a Thematic Collection

```python
# Create "Faith Journey" collection
collection = create_collection(
    storyteller_id=storyteller.id,
    collection_name="My Journey with Faith",
    description="How my understanding and practice of spirituality evolved across my life",

    organizing_principle='theme',
    organizing_value='faith_spiritual_journey',

    narrative_arc='transformation',
    archetype_pattern='meaning_making',

    collection_type='thematic',
    is_provisional=True
)

# Add relevant life events
add_to_collection(
    collection.id,
    childhood_catholic_event.id,
    sequence_order=1,
    narrative_role='setup',
    narrative_function='Establishes traditional religious foundation',
    connection_to_theme='Initial formation of faith identity'
)

add_to_collection(
    collection.id,
    college_faith_crisis_event.id,
    sequence_order=2,
    narrative_role='turning_point',
    narrative_function='Questioning and dismantling of inherited beliefs',
    connection_to_theme='Crisis that forced deeper examination',
    is_anchor_event=True
)

add_to_collection(
    collection.id,
    india_trip_event.id,
    sequence_order=3,
    narrative_role='climax',
    narrative_function='Moment of profound realization and shift',
    connection_to_theme='Discovery of new spiritual framework',
    is_anchor_event=True
)

add_to_collection(
    collection.id,
    current_practice_event.id,
    sequence_order=4,
    narrative_role='resolution',
    narrative_function='Integration of new understanding into daily life',
    connection_to_theme='Mature, evolved faith practice'
)
```

### 2. Creating a Timeline Collection

```python
# Create "The Sixties" collection
sixties = create_collection(
    storyteller_id=storyteller.id,
    collection_name="The 1960s",
    description="My experiences during a transformative decade in America",

    organizing_principle='timeline',
    organizing_value='1960-1969',

    collection_type='chronological',
    narrative_arc='linear'
)

# Add all events from that decade
events_1960s = get_events_in_timeframe(storyteller.id, 1960, 1969)
for i, event in enumerate(events_1960s):
    add_to_collection(
        sixties.id,
        event.id,
        sequence_order=i + 1,
        narrative_role='chronological_entry'
    )
```

### 3. Creating Relationship-Based Collection

```python
# Create "Relationship with Father" collection
father_collection = create_collection(
    storyteller_id=storyteller.id,
    collection_name="My Father and Me",
    description="The complex, evolving relationship with my father",

    organizing_principle='relationship',
    organizing_value='father',

    collection_type='relational',
    narrative_arc='transformation',
    archetype_pattern='loss_to_connection'
)

# Add events where father was significant
add_to_collection(
    father_collection.id,
    childhood_with_dad_event.id,
    narrative_role='setup',
    narrative_function='Early idolization and dependence'
)

add_to_collection(
    father_collection.id,
    teenage_conflict_event.id,
    narrative_role='rising_action',
    narrative_function='Growing tension and rebellion',
    is_anchor_event=True
)

add_to_collection(
    father_collection.id,
    estrangement_event.id,
    narrative_role='climax',
    narrative_function='Breaking point and separation'
)

add_to_collection(
    father_collection.id,
    reconciliation_event.id,
    narrative_role='falling_action',
    narrative_function='Adult understanding and forgiveness'
)

add_to_collection(
    father_collection.id,
    father_death_event.id,
    narrative_role='resolution',
    narrative_function='Final peace and integration'
)
```

### 4. Creating Collection Groupings

```python
# Create a grouping for "All My Relationships"
relationships_grouping = create_grouping(
    storyteller_id=storyteller.id,
    grouping_name="The People Who Shaped Me",
    grouping_description="Key relationships that defined who I became",

    grouping_type='thematic_meta',
    grouping_principle='Explores how different relationships influenced identity formation',

    book_part_type='part',
    suggested_part_title='Part II: Connections'
)

# Add relationship collections
add_collection_to_grouping(relationships_grouping.id, father_collection.id, sequence_order=1,
    relationship_to_grouping="First formative relationship - authority and identity")

add_collection_to_grouping(relationships_grouping.id, mother_collection.id, sequence_order=2,
    relationship_to_grouping="Source of emotional intelligence and nurturing")

add_collection_to_grouping(relationships_grouping.id, first_love_collection.id, sequence_order=3,
    relationship_to_grouping="Discovery of intimacy and vulnerability")

add_collection_to_grouping(relationships_grouping.id, marriage_collection.id, sequence_order=4,
    relationship_to_grouping="Partnership and co-creation of life")
```

### 5. Linking Related Collections

```python
# Create relationship between collections
create_collection_relationship(
    source_collection_id=faith_journey_collection.id,
    target_collection_id=father_relationship_collection.id,

    relationship_type='influenced_by',
    relationship_description="""
        Father's rigid religiosity directly influenced my faith crisis.
        Rejecting his approach was part of finding my own path.
    """,
    strength='strong'
)

create_collection_relationship(
    source_collection_id=military_service_collection.id,
    target_collection_id=ptsd_healing_collection.id,

    relationship_type='leads_to',
    relationship_description="Combat experiences directly led to decades-long healing journey",
    strength='strong'
)

create_collection_relationship(
    source_collection_id=career_collection.id,
    target_collection_id=parenthood_collection.id,

    relationship_type='contrasts_with',
    relationship_description="Professional ambition vs. family time - constant tension",
    strength='moderate'
)
```

### 6. Generating Collection Synthesis

```python
def generate_collection_synthesis(collection_id):
    collection = get_collection(collection_id)
    events = get_collection_events(collection_id, ordered=True)

    # Analyze the collection
    synthesis_content = analyze_collection_narrative(collection, events)

    synthesis = create_synthesis(
        collection_id=collection_id,
        synthesis_type='theme_analysis',
        content=synthesis_content,
        structured_data={
            'event_count': len(events),
            'timespan': calculate_timespan(events),
            'key_themes': extract_themes(events),
            'emotional_arc': map_emotional_journey(events),
            'turning_points': identify_anchor_events(events),
            'narrative_structure': analyze_narrative_structure(collection, events)
        },
        is_provisional=True
    )

    return synthesis
```

### 7. Using Collections for Book Structure

```python
def generate_book_outline(storyteller_id):
    """
    Use collections and groupings to create book structure
    """
    # Get approved collections
    collections = get_collections(storyteller_id, is_approved=True, include_in_book=True)

    # Group by book_section_type
    chapters = [c for c in collections if c.book_section_type == 'chapter']
    vignettes = [c for c in collections if c.book_section_type == 'vignette']

    # Get groupings (book parts)
    groupings = get_groupings(storyteller_id)

    book_structure = {
        'title': f"{storyteller.preferred_name}'s Story",
        'parts': []
    }

    for grouping in sorted(groupings, key=lambda g: g.display_order):
        part_collections = get_grouping_collections(grouping.id)

        part = {
            'part_title': grouping.suggested_part_title,
            'part_description': grouping.grouping_description,
            'chapters': []
        }

        for coll_member in sorted(part_collections, key=lambda m: m.sequence_order):
            collection = coll_member.collection
            events = get_collection_events(collection.id)

            chapter = {
                'chapter_title': collection.suggested_title,
                'chapter_summary': collection.synthesis_summary,
                'event_count': len(events),
                'themes': collection.synthesis_themes
            }

            part['chapters'].append(chapter)

        book_structure['parts'].append(part)

    return book_structure
```

---

## Design Principles

1. **Flexible organizing principles** - Theme, archetype, timeline, relationship, place, or custom
2. **Narrative-aware** - Collections understand story structure (setup, climax, resolution)
3. **Hierarchical** - Events → Collections → Groupings (flexible nesting)
4. **Relational** - Collections can reference and relate to each other
5. **Provisional by default** - Collections evolve as understanding deepens
6. **Book-oriented** - Collections map to chapters/sections/parts
7. **Multi-membership** - Events can belong to multiple collections (faith journey AND 1960s timeline)
8. **Synthesis-generating** - Collections produce AI analysis and drafts
9. **Archetype-aware** - Leverages narrative patterns from process.txt
10. **User-confirmable** - Storyteller approves collections that resonate

---

## Integration Points

### With Life Events
```python
# An event can belong to multiple collections
get_collections_for_event(event_id) → [faith_collection, sixties_timeline, father_relationship]
```

### With Process Schema
```python
# Process node might suggest creating a collection
if node.node_type == 'synthesis':
    suggested_collections = infer_collections_from_events(storyteller_id)
```

### With Session Schema
```python
# A session might focus on building out a specific collection
session.intention = f"Flesh out the {collection.collection_name} collection"
```

### With Book Generation
```python
# Collections become the scaffold for book structure
book = generate_book_from_collections(storyteller_id)
```

---

## Questions to Resolve

1. **Auto-collection vs manual** - Should system automatically suggest collections, or user-initiated only?
2. **Collection evolution** - How do we handle splitting/merging collections as story evolves?
3. **Optimal collection size** - Minimum/maximum events per collection?
4. **Cross-storyteller patterns** - Do we learn common collection patterns across all users?
5. **Collection templates** - Should we have pre-built collection templates for common narratives?
6. **Synthesis timing** - When do we generate synthesis? After each event added? On demand?
