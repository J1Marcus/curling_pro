# Story Schema

## Design Philosophy
- **Story = Book**: The actual manuscript being created
- **Memoir craft**: Follows best practices for autobiographical storytelling
- **Structured flexibility**: Chapters → Sections → Scenes with clear purposes
- **Character-driven**: Real people portrayed as characters with arcs
- **Archetype-organized**: Overall narrative follows archetypal patterns
- **Collection-informed**: Chapters draw from collections but are crafted for narrative flow
- **Scene-based**: Emphasis on showing through scenes vs. telling through summary

---

## Core Tables

### story
The actual book/memoir being created.

```sql
CREATE TABLE story (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storyteller_id UUID REFERENCES storyteller(id) ON DELETE CASCADE,

    -- Book identity
    title VARCHAR(300) NOT NULL,
    subtitle VARCHAR(300),
    working_title VARCHAR(300),             -- May differ from final title

    -- Story structure
    overall_archetype VARCHAR(100),         -- Primary archetype: 'loss_to_connection', 'transformation', etc.
    secondary_archetypes TEXT[],            -- Additional archetypal patterns

    narrative_structure VARCHAR(100),       -- 'linear', 'non_linear', 'circular', 'braided',
                                            -- 'frame_story', 'mosaic', 'three_act', 'hero_journey'

    -- Memoir craft elements
    point_of_view VARCHAR(50),              -- 'first_person_present', 'first_person_past', 'second_person'
    narrative_voice VARCHAR(100),           -- 'reflective', 'immediate', 'conversational', 'literary'
    tense VARCHAR(50),                      -- 'present', 'past', 'mixed'

    tone VARCHAR(100),                      -- 'intimate', 'humorous', 'somber', 'hopeful', 'defiant'

    -- Audience & purpose
    intended_audience VARCHAR(200),         -- 'family', 'descendants', 'general_public', 'specific_community'
    primary_purpose TEXT,                   -- Why this story is being told

    -- Thematic core
    central_question TEXT,                  -- The question the memoir explores
                                            -- e.g., "How did I find faith after losing everything?"

    central_themes TEXT[],                  -- Major themes throughout

    -- Timeframe
    story_timeframe_start INTEGER,          -- Year story begins
    story_timeframe_end INTEGER,            -- Year story ends
    uses_flashback BOOLEAN DEFAULT false,
    uses_flashforward BOOLEAN DEFAULT false,

    -- Opening & closing
    opening_strategy VARCHAR(100),          -- 'in_medias_res', 'origin_story', 'pivotal_moment',
                                            -- 'frame_present_day', 'atmospheric_scene'

    closing_strategy VARCHAR(100),          -- 'resolution', 'reflection', 'return_to_frame',
                                            -- 'open_ended', 'full_circle'

    -- Status
    status VARCHAR(50) DEFAULT 'planning',  -- 'planning', 'drafting', 'revising', 'complete'
    current_draft_version INTEGER DEFAULT 1,

    -- Metadata
    estimated_word_count INTEGER,
    target_word_count INTEGER,
    estimated_page_count INTEGER,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_story_storyteller ON story(storyteller_id);
```

---

## Book Structure

### story_chapter
Individual chapters within the book.

```sql
CREATE TABLE story_chapter (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID REFERENCES story(id) ON DELETE CASCADE,

    -- Chapter identity
    chapter_number INTEGER NOT NULL,
    chapter_title VARCHAR(300),
    chapter_subtitle VARCHAR(300),

    -- Chapter type
    chapter_type VARCHAR(100),              -- 'scene_chapter', 'reflection_chapter', 'bridge_chapter',
                                            -- 'thematic_chapter', 'chronological_chapter',
                                            -- 'character_chapter', 'place_chapter'

    -- Chapter purpose
    narrative_purpose TEXT,                 -- What this chapter accomplishes in the story
                                            -- e.g., "Establishes the world before crisis",
                                            -- "Shows the turning point in father relationship"

    narrative_position VARCHAR(50),         -- 'opening', 'rising_action', 'midpoint', 'climax',
                                            -- 'falling_action', 'resolution'

    -- Memoir craft
    chapter_arc VARCHAR(100),               -- 'transformation', 'revelation', 'escalation',
                                            -- 'deepening', 'contrast', 'parallel'

    emotional_arc TEXT,                     -- Description of emotional journey in chapter

    opening_hook TEXT,                      -- How chapter begins - the hook
    closing_resonance TEXT,                 -- How chapter ends - the echo

    -- Timeframe
    chapter_timeframe_start INTEGER,        -- Year this chapter covers (start)
    chapter_timeframe_end INTEGER,          -- Year this chapter covers (end)

    -- Structure
    primary_mode VARCHAR(50),               -- 'scene', 'summary', 'reflection', 'mixed'
    scene_to_summary_ratio DECIMAL(3,2),    -- 0.0 to 1.0 (1.0 = all scene)

    -- Content
    summary TEXT,                           -- Chapter summary
    epigraph TEXT,                          -- Optional chapter epigraph
    epigraph_attribution VARCHAR(200),

    -- Status
    status VARCHAR(50) DEFAULT 'planned',   -- 'planned', 'outlined', 'drafted', 'revised', 'polished'
    current_draft_version INTEGER DEFAULT 1,

    word_count INTEGER,
    estimated_word_count INTEGER,

    -- Ordering
    display_order INTEGER,                  -- Actual order in book (may differ from chapter_number
                                            -- if using non-linear structure)

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_story_chapter_story ON story_chapter(story_id, chapter_number);
CREATE INDEX idx_story_chapter_order ON story_chapter(story_id, display_order);
```

### chapter_section
Sections within chapters (scenes, reflections, summaries).

```sql
CREATE TABLE chapter_section (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_id UUID REFERENCES story_chapter(id) ON DELETE CASCADE,

    -- Section identity
    section_number INTEGER NOT NULL,
    section_title VARCHAR(200),             -- Optional section title

    -- Section type
    section_type VARCHAR(50),               -- 'scene', 'summary', 'reflection', 'dialogue',
                                            -- 'description', 'transition', 'flashback'

    -- Scene details (if section_type = 'scene')
    scene_setting VARCHAR(500),             -- Where and when the scene takes place
    scene_characters TEXT[],                -- Characters present in scene
    scene_purpose TEXT,                     -- What the scene accomplishes

    -- Content
    content TEXT,                           -- The actual written content
    notes TEXT,                             -- Writer's notes about this section

    -- Craft elements
    uses_dialogue BOOLEAN DEFAULT false,
    uses_sensory_details BOOLEAN DEFAULT false,
    uses_internal_monologue BOOLEAN DEFAULT false,

    show_vs_tell VARCHAR(50),               -- 'showing', 'telling', 'mixed'

    -- Status
    status VARCHAR(50) DEFAULT 'outlined',  -- 'outlined', 'drafted', 'revised', 'polished'

    word_count INTEGER,

    -- Ordering
    sequence_order INTEGER,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_chapter_section_chapter ON chapter_section(chapter_id, sequence_order);
```

---

## Story-Collection Integration

### story_collection
Many-to-many relationship between story chapters and collections.

```sql
CREATE TABLE story_collection (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID REFERENCES story(id) ON DELETE CASCADE,
    chapter_id UUID REFERENCES story_chapter(id) ON DELETE CASCADE,
    collection_id UUID REFERENCES collection(id) ON DELETE CASCADE,

    -- Relationship
    usage_type VARCHAR(50),                 -- 'primary_source', 'supplementary', 'reference',
                                            -- 'inspiration', 'contrast'

    -- How collection material is used
    material_used TEXT,                     -- Description of what from collection appears in chapter
    transformation_notes TEXT,              -- How raw material was transformed for narrative

    created_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(story_id, chapter_id, collection_id)
);

CREATE INDEX idx_story_collection_story ON story_collection(story_id);
CREATE INDEX idx_story_collection_chapter ON story_collection(chapter_id);
CREATE INDEX idx_story_collection_collection ON story_collection(collection_id);
```

---

## Characters

### story_character
People portrayed as characters in the memoir.

```sql
CREATE TABLE story_character (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID REFERENCES story(id) ON DELETE CASCADE,
    storyteller_id UUID REFERENCES storyteller(id),  -- Links to storyteller if character is the author

    -- Character identity
    character_name VARCHAR(200) NOT NULL,    -- Name used in story (may be pseudonym)
    real_name VARCHAR(200),                  -- Actual name (if different)
    is_pseudonym BOOLEAN DEFAULT false,

    -- Character type
    character_type VARCHAR(50),              -- 'protagonist', 'antagonist', 'ally', 'mentor',
                                             -- 'foil', 'supporting', 'minor', 'background'

    relationship_to_protagonist VARCHAR(100), -- 'self', 'parent', 'spouse', 'child', 'friend',
                                              -- 'colleague', 'adversary', 'teacher', 'stranger'

    -- Character description
    physical_description TEXT,               -- How character appears
    personality_traits TEXT[],               -- Key personality characteristics
    speech_patterns TEXT,                    -- How character talks (for dialogue)

    backstory TEXT,                          -- Relevant history
    motivation TEXT,                         -- What drives this character

    -- Character arc
    has_arc BOOLEAN DEFAULT false,
    arc_type VARCHAR(100),                   -- 'growth', 'fall', 'redemption', 'corruption',
                                             -- 'static', 'catalyst'
    arc_description TEXT,

    initial_state TEXT,                      -- Character at beginning
    transformation TEXT,                     -- How character changes
    final_state TEXT,                        -- Character at end

    -- Memoir-specific
    degree_of_revelation VARCHAR(50),        -- 'full', 'partial', 'minimal', 'composite'
                                             -- How much is revealed about this person

    privacy_level VARCHAR(50),               -- 'full_name', 'first_name_only', 'pseudonym',
                                             -- 'composite_character', 'anonymous'

    composite_of TEXT[],                     -- If composite character, who does it represent

    -- First appearance
    first_appearance_chapter_id UUID REFERENCES story_chapter(id),
    introduction_strategy TEXT,              -- How character is introduced

    -- Status
    is_living BOOLEAN,
    consent_obtained BOOLEAN DEFAULT false,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_story_character_story ON story_character(story_id);
CREATE INDEX idx_story_character_type ON story_character(character_type);
```

### character_relationship
Relationships between characters in the story.

```sql
CREATE TABLE character_relationship (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID REFERENCES story(id) ON DELETE CASCADE,

    -- The two characters
    character_a_id UUID REFERENCES story_character(id) ON DELETE CASCADE,
    character_b_id UUID REFERENCES story_character(id) ON DELETE CASCADE,

    -- Relationship
    relationship_type VARCHAR(100),          -- 'parent_child', 'romantic', 'friendship', 'rivalry',
                                             -- 'mentor_mentee', 'colleagues', 'adversaries'

    relationship_description TEXT,

    -- Relationship arc
    has_arc BOOLEAN DEFAULT false,
    relationship_arc VARCHAR(100),           -- 'strengthening', 'deteriorating', 'transforming',
                                             -- 'reconciling', 'separating', 'static'

    initial_dynamic TEXT,                    -- How relationship starts
    key_conflict TEXT,                       -- Central tension in relationship
    resolution TEXT,                         -- How relationship resolves (or doesn't)

    -- Narrative importance
    significance VARCHAR(50),                -- 'central', 'major', 'supporting', 'background'

    created_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(character_a_id, character_b_id)
);

CREATE INDEX idx_character_relationship_story ON character_relationship(story_id);
```

### character_appearance
Tracks which chapters/sections each character appears in.

```sql
CREATE TABLE character_appearance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID REFERENCES story_character(id) ON DELETE CASCADE,
    chapter_id UUID REFERENCES story_chapter(id) ON DELETE CASCADE,
    section_id UUID REFERENCES chapter_section(id) ON DELETE SET NULL,

    -- Appearance details
    role_in_scene VARCHAR(100),              -- 'active', 'present', 'mentioned', 'referenced'
    significance_in_scene VARCHAR(50),       -- 'central', 'supporting', 'background', 'cameo'

    character_development BOOLEAN DEFAULT false, -- Does character develop in this appearance?
    development_notes TEXT,

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_character_appearance_character ON character_appearance(character_id);
CREATE INDEX idx_character_appearance_chapter ON character_appearance(chapter_id);
```

---

## Thematic Elements

### story_theme
Thematic threads woven throughout the story.

```sql
CREATE TABLE story_theme (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID REFERENCES story(id) ON DELETE CASCADE,

    -- Theme identity
    theme_name VARCHAR(200) NOT NULL,        -- "Forgiveness", "Belonging", "Identity"
    theme_description TEXT,

    -- Theme type
    theme_type VARCHAR(50),                  -- 'central', 'major', 'minor', 'motif'

    -- Thematic elements
    symbols TEXT[],                          -- Recurring symbols representing theme
    motifs TEXT[],                           -- Recurring patterns
    imagery TEXT[],                          -- Recurring images

    -- How theme develops
    theme_arc TEXT,                          -- How theme evolves through story

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_story_theme_story ON story_theme(story_id);
```

### chapter_theme
Which themes appear in which chapters.

```sql
CREATE TABLE chapter_theme (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_id UUID REFERENCES story_chapter(id) ON DELETE CASCADE,
    theme_id UUID REFERENCES story_theme(id) ON DELETE CASCADE,

    -- How theme appears
    prominence VARCHAR(50),                  -- 'dominant', 'present', 'subtle', 'emerging'
    how_explored TEXT,                       -- How theme is explored in this chapter

    created_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(chapter_id, theme_id)
);

CREATE INDEX idx_chapter_theme_chapter ON chapter_theme(chapter_id);
CREATE INDEX idx_chapter_theme_theme ON chapter_theme(theme_id);
```

---

## Scenes

### story_scene
Individual scenes (the building blocks of memoir).

```sql
CREATE TABLE story_scene (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID REFERENCES story(id) ON DELETE CASCADE,
    chapter_id UUID REFERENCES story_chapter(id),
    section_id UUID REFERENCES chapter_section(id),
    life_event_id UUID REFERENCES life_event(id) ON DELETE SET NULL,

    -- Scene identity
    scene_name VARCHAR(200),
    scene_description TEXT,

    -- Scene elements (showing vs telling)
    scene_setting TEXT,                      -- Specific time and place
    scene_time VARCHAR(200),                 -- "Summer 1967, late afternoon"
    scene_place VARCHAR(200),                -- "Our kitchen in the Boston apartment"

    -- Scene purpose
    scene_purpose TEXT,                      -- What this scene accomplishes
    reveals_character TEXT,                  -- Character revelation
    advances_plot TEXT,                      -- Plot advancement
    develops_theme TEXT,                     -- Thematic development

    -- Sensory details
    visual_details TEXT[],
    auditory_details TEXT[],
    tactile_details TEXT[],
    olfactory_details TEXT[],
    gustatory_details TEXT[],

    -- Craft elements
    has_dialogue BOOLEAN DEFAULT false,
    dialogue_snippet TEXT,                   -- Key dialogue from scene

    has_internal_monologue BOOLEAN DEFAULT false,
    internal_thoughts TEXT,

    emotional_tone VARCHAR(50),              -- 'tense', 'joyful', 'melancholic', 'anxious'

    -- Scene structure
    opening_image TEXT,                      -- How scene opens
    inciting_action TEXT,                    -- What triggers the scene
    complication TEXT,                       -- What makes it complex
    climax TEXT,                             -- Peak moment
    resolution TEXT,                         -- How scene concludes

    -- Memoir craft
    reflection TEXT,                         -- Looking-back perspective on this scene
    meaning_made TEXT,                       -- What storyteller understands now

    -- Status
    status VARCHAR(50) DEFAULT 'outlined',   -- 'outlined', 'drafted', 'revised', 'polished'
    word_count INTEGER,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_story_scene_story ON story_scene(story_id);
CREATE INDEX idx_story_scene_chapter ON story_scene(chapter_id);
```

---

## Drafts & Versions

### story_draft
Version history of the story and chapters.

```sql
CREATE TABLE story_draft (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID REFERENCES story(id) ON DELETE CASCADE,
    chapter_id UUID REFERENCES story_chapter(id) ON DELETE CASCADE,

    -- Draft metadata
    draft_type VARCHAR(50),                  -- 'story_level', 'chapter', 'section'
    draft_version INTEGER NOT NULL,
    version_name VARCHAR(100),               -- "First draft", "Revision after feedback"

    -- Content
    content TEXT,                            -- Full text of this draft
    word_count INTEGER,

    -- Draft notes
    revision_notes TEXT,                     -- What changed in this version
    feedback_received TEXT,                  -- Feedback that led to this revision

    -- Status
    is_current BOOLEAN DEFAULT false,

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_story_draft_story ON story_draft(story_id, draft_version);
CREATE INDEX idx_story_draft_chapter ON story_draft(chapter_id, draft_version);
```

---

## Relationships Summary

```
story (the book)
    ├── storyteller (many:1)
    │
    ├── story_chapter (1:many)
    │   ├── chapter_section (1:many)
    │   │   └── Scenes, summaries, reflections
    │   │
    │   ├── chapter_theme (many:many join) → story_theme
    │   └── story_collection (many:many join) → collection
    │
    ├── story_character (1:many)
    │   ├── character_relationship (many:many)
    │   └── character_appearance (1:many) → chapters/sections
    │
    ├── story_theme (1:many)
    │   └── chapter_theme (1:many) → chapters
    │
    ├── story_scene (1:many)
    │   └── Links to chapters, sections, life_events
    │
    └── story_draft (1:many)
        └── Version history
```

---

## Memoir Craft Best Practices (Embedded in Schema)

### 1. Scene vs. Summary
- `chapter_section.section_type` distinguishes scene from summary
- `story_chapter.scene_to_summary_ratio` tracks balance
- `story_scene` table emphasizes scene-based storytelling

### 2. Character Development
- `story_character` with arc tracking
- `character_relationship` for relational dynamics
- `character_appearance` tracks presence throughout story

### 3. Thematic Weaving
- `story_theme` and `chapter_theme` ensure themes recur
- Symbols, motifs, imagery tracked explicitly

### 4. Narrative Arc
- Story-level: `story.overall_archetype`, `narrative_structure`
- Chapter-level: `story_chapter.narrative_position`, `chapter_arc`
- Character-level: `story_character.arc_type`

### 5. Showing vs. Telling
- `chapter_section.show_vs_tell` field
- `story_scene` emphasizes sensory details
- Dialogue and internal monologue flags

### 6. Opening & Closing Strategies
- `story.opening_strategy` and `closing_strategy`
- `story_chapter.opening_hook` and `closing_resonance`

### 7. Reflection & Meaning-Making
- `story_scene.reflection` - looking-back perspective
- `story_scene.meaning_made` - understanding gained
- Balance of immediate experience and reflective distance

### 8. Privacy & Ethics
- `story_character.privacy_level` and `is_pseudonym`
- `story_character.composite_of` for composite characters
- `story_character.consent_obtained`

---

## Usage Patterns

### 1. Creating a Story from Collections

```python
def create_story_from_collections(storyteller_id):
    """
    Initialize a story structure from approved collections
    """
    # Get overall archetype from most significant collection
    primary_collection = get_primary_collection(storyteller_id)

    story = create_story(
        storyteller_id=storyteller_id,
        title=generate_working_title(storyteller_id),
        overall_archetype=primary_collection.archetype_pattern,
        narrative_structure='three_act',

        point_of_view='first_person_past',
        narrative_voice='reflective',
        tense='past',

        opening_strategy='pivotal_moment',
        closing_strategy='reflection'
    )

    # Create chapters from collections
    collections = get_approved_collections(storyteller_id, include_in_book=True)

    for i, collection in enumerate(collections, start=1):
        chapter = create_chapter(
            story_id=story.id,
            chapter_number=i,
            chapter_title=collection.suggested_title,
            chapter_type='thematic_chapter',
            narrative_purpose=collection.description,
            status='planned'
        )

        # Link collection to chapter
        link_collection_to_chapter(story.id, chapter.id, collection.id)

    return story
```

### 2. Creating Scenes from Life Events

```python
def create_scene_from_event(life_event_id, chapter_id):
    """
    Transform a life event into a crafted scene
    """
    event = get_life_event(life_event_id)
    timespans = get_event_timespans(life_event_id)
    locations = get_event_locations(life_event_id)
    participants = get_event_participants(life_event_id)
    details = get_event_details(life_event_id)

    # Find the most specific moment
    primary_timespan = get_primary_timespan(timespans)
    primary_location = get_primary_location(locations)

    scene = create_scene(
        chapter_id=chapter_id,
        life_event_id=life_event_id,

        scene_name=event.event_name,
        scene_time=format_scene_time(primary_timespan),
        scene_place=primary_location.location_name,

        scene_purpose=f"Show {event.narrative_function}",
        emotional_tone=event.emotional_tone,

        # Prompt for sensory details
        visual_details=[],  # To be filled during drafting
        auditory_details=[],

        status='outlined'
    )

    # Add characters from participants
    for participant in participants:
        character = get_or_create_character(participant)
        add_character_to_scene(scene.id, character.id)

    return scene
```

### 3. Building Character Arcs

```python
def build_character_arc(story_id, character_id):
    """
    Analyze and structure a character's arc through the story
    """
    character = get_character(character_id)
    appearances = get_character_appearances(character_id)

    # Analyze appearances chronologically
    chapters_with_character = [a.chapter_id for a in appearances]
    sorted_chapters = sort_chapters_by_order(chapters_with_character)

    # Identify arc type
    initial_chapter = sorted_chapters[0]
    final_chapter = sorted_chapters[-1]

    initial_portrayal = analyze_character_in_chapter(character_id, initial_chapter)
    final_portrayal = analyze_character_in_chapter(character_id, final_chapter)

    if significant_change(initial_portrayal, final_portrayal):
        arc_type = determine_arc_type(initial_portrayal, final_portrayal)

        update_character(
            character_id,
            has_arc=True,
            arc_type=arc_type,
            initial_state=initial_portrayal.summary,
            final_state=final_portrayal.summary,
            transformation=describe_transformation(initial_portrayal, final_portrayal)
        )
```

### 4. Weaving Themes Through Chapters

```python
def weave_theme_through_story(story_id, theme_id):
    """
    Ensure a theme appears appropriately throughout the story
    """
    theme = get_theme(theme_id)
    chapters = get_story_chapters(story_id)

    if theme.theme_type == 'central':
        # Central theme should appear in 70%+ of chapters
        target_chapters = int(len(chapters) * 0.7)
    elif theme.theme_type == 'major':
        # Major theme in 40-60% of chapters
        target_chapters = int(len(chapters) * 0.5)
    else:
        # Minor theme in 20-30% of chapters
        target_chapters = int(len(chapters) * 0.25)

    # Identify which chapters should carry this theme
    relevant_chapters = identify_theme_chapters(story_id, theme)

    for chapter in relevant_chapters[:target_chapters]:
        add_theme_to_chapter(
            chapter.id,
            theme.id,
            prominence='dominant' if theme.theme_type == 'central' else 'present',
            how_explored=generate_theme_exploration_note(chapter, theme)
        )
```

### 5. Structuring a Chapter

```python
def structure_chapter(chapter_id):
    """
    Create chapter structure following memoir craft principles
    """
    chapter = get_chapter(chapter_id)
    collection = get_chapter_primary_collection(chapter_id)
    events = get_collection_events(collection.id)

    # Identify key scenes
    anchor_events = [e for e in events if e.is_anchor_event]

    # Create opening scene (hook)
    opening_event = select_opening_event(events)
    opening_section = create_section(
        chapter_id=chapter_id,
        section_number=1,
        section_type='scene',
        scene_purpose='Hook reader with compelling moment',
        sequence_order=1
    )

    # Create body sections (mix of scene and summary)
    section_num = 2
    for event in events:
        if event in anchor_events:
            # Major events become full scenes
            create_section(
                chapter_id=chapter_id,
                section_number=section_num,
                section_type='scene',
                scene_purpose=event.narrative_function,
                sequence_order=section_num
            )
        else:
            # Minor events become summary or brief scene
            create_section(
                chapter_id=chapter_id,
                section_number=section_num,
                section_type='summary',
                sequence_order=section_num
            )
        section_num += 1

    # Create closing reflection
    create_section(
        chapter_id=chapter_id,
        section_number=section_num,
        section_type='reflection',
        scene_purpose='Meaning-making, bridge to next chapter',
        sequence_order=section_num
    )

    # Update chapter metadata
    update_chapter(
        chapter_id,
        opening_hook=generate_opening_hook(opening_event),
        closing_resonance=generate_closing_reflection(chapter, events)
    )
```

### 6. Tracking Scene-to-Summary Ratio

```python
def calculate_scene_summary_ratio(chapter_id):
    """
    Memoir craft principle: aim for 70-80% scene, 20-30% summary/reflection
    """
    sections = get_chapter_sections(chapter_id)

    scene_word_count = sum(s.word_count for s in sections if s.section_type == 'scene')
    total_word_count = sum(s.word_count for s in sections)

    ratio = scene_word_count / total_word_count if total_word_count > 0 else 0

    update_chapter(chapter_id, scene_to_summary_ratio=ratio)

    if ratio < 0.6:
        return {
            'warning': 'Too much summary/telling. Consider converting summaries to scenes.',
            'recommendation': 'Identify moments that could be shown through specific scenes.'
        }
    elif ratio > 0.85:
        return {
            'warning': 'May need more reflection/context.',
            'recommendation': 'Add brief summaries or reflective passages for pacing.'
        }
    else:
        return {'status': 'Good balance of scene and summary'}
```

---

## Design Principles

1. **Scene-based storytelling** - Emphasis on showing through scenes vs. telling
2. **Character-driven** - Real people as fully-realized characters with arcs
3. **Thematic coherence** - Themes woven consistently throughout
4. **Archetype-organized** - Overall story follows archetypal patterns
5. **Memoir ethics** - Privacy, consent, pseudonyms, composite characters
6. **Craft-conscious** - Embeds best practices (opening hooks, scene structure, etc.)
7. **Flexible structure** - Supports linear and non-linear narratives
8. **Reflection-integrated** - Balance of immediate experience and looking-back perspective
9. **Collection-informed** - Draws from collections but crafts for narrative flow
10. **Draft-tracked** - Version history for iterative refinement

---

## Integration Points

### With Collections
```python
# Collections provide raw material, story crafts it into narrative
chapter_collections = get_chapter_collections(chapter_id)
events = get_collection_events(chapter_collections[0].id)
scenes = transform_events_to_scenes(events)
```

### With Life Events
```python
# Life events become scenes with craft applied
event = get_life_event(event_id)
scene = craft_scene_from_event(event, add_sensory_details=True)
```

### With Sessions
```python
# Sessions might focus on developing specific chapters or scenes
session.intention = f"Draft opening scene for Chapter {chapter.chapter_number}"
```

---

## Questions to Resolve

1. **Auto-scene generation** - Should system auto-generate scene outlines from life events?
2. **Character consistency** - How do we track character portrayal consistency across chapters?
3. **Theme tracking** - Automatic detection when theme is underrepresented?
4. **Draft workflow** - How does drafting/revision workflow work in practice?
5. **Feedback integration** - How do we capture and act on reader/editor feedback?
6. **Word count targets** - Should we enforce min/max word counts per chapter?
7. **Voice consistency** - How do we ensure narrative voice remains consistent?
