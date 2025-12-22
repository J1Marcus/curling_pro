# Storyteller Schema

## Design Philosophy
- **Storyteller**: Immutable facts only (DOB, birthplace, name)
- **Life Events**: Core organizing principle (not timeline)
- **Hierarchical**: Proper parent/child relationships for flexibility
- **Event-specific boundaries**: Privacy at both storyteller and event level
- **Trauma-aware**: Classification and resolution tracking
- **Privacy-first**: Sensitive data encrypted at rest, GDPR compliant

---

## Core Tables

### storyteller
The person whose life story is being captured. Immutable biographical facts only.

```sql
CREATE TABLE storyteller (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Account relationship
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    relationship_to_user VARCHAR(50),    -- 'self', 'parent', 'grandparent', 'spouse', 'friend', 'client'

    -- Identity (immutable)
    first_name VARCHAR(100),
    middle_name VARCHAR(100),
    last_name VARCHAR(100),
    preferred_name VARCHAR(100),         -- What they like to be called

    -- Birth (immutable)
    birth_year INTEGER,
    birth_month INTEGER,
    birth_day INTEGER,
    birth_place VARCHAR(200),            -- City, State/Country

    -- Current state
    is_living BOOLEAN DEFAULT true,
    current_location VARCHAR(200),       -- Can change but tracks current

    -- Consent
    consent_given BOOLEAN DEFAULT false, -- Explicit consent for story capture
    consent_date TIMESTAMP,

    -- Profile
    profile_image_url TEXT,

    -- Status
    is_active BOOLEAN DEFAULT true,

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP                 -- Soft delete
);

CREATE INDEX idx_storyteller_user ON storyteller(user_id, is_active);
```

---

## Life Events (Core Organizing Principle)

### life_event
The fundamental unit of story organization. Not constrained by single timeline.

```sql
CREATE TABLE life_event (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storyteller_id UUID REFERENCES storyteller(id) ON DELETE CASCADE,

    -- Event identification
    event_type VARCHAR(100),             -- 'childhood', 'education', 'career_period', 'relationship',
                                         -- 'military_service', 'faith_journey', 'parenthood',
                                         -- 'caregiving', 'illness', 'loss', 'adventure', 'custom'

    event_name VARCHAR(200) NOT NULL,    -- "My time in the Navy", "Faith crisis in college",
                                         -- "Marriage to Sarah", "Career as engineer"

    description TEXT,                    -- Brief summary

    -- Categorization
    category VARCHAR(100),               -- 'origins', 'family', 'work', 'relationships', 'health',
                                         -- 'spiritual', 'adventure', 'loss', 'transformation'

    -- Significance
    significance_level VARCHAR(50),      -- 'formative', 'major', 'notable', 'minor'

    -- Emotional tone (optional, can be inferred later)
    emotional_tone VARCHAR(50),          -- 'joyful', 'difficult', 'mixed', 'neutral', 'transformative'

    -- Narrative role
    is_turning_point BOOLEAN DEFAULT false,
    is_ongoing BOOLEAN DEFAULT false,

    -- Story inclusion
    include_in_story BOOLEAN DEFAULT true,
    include_level VARCHAR(50),           -- 'full_detail', 'summary', 'mention', 'omit'

    -- Ordering (for display, not structure)
    display_order INTEGER,

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_life_event_storyteller ON life_event(storyteller_id);
CREATE INDEX idx_life_event_type ON life_event(event_type);
```

---

## Life Event Children (Flexible Components)

### life_event_timespan
Events can have multiple timespans (not just one).

```sql
CREATE TABLE life_event_timespan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    life_event_id UUID REFERENCES life_event(id) ON DELETE CASCADE,

    -- Time definition
    timespan_type VARCHAR(50),           -- 'primary', 'secondary', 'recurring', 'specific_moment'

    start_year INTEGER,
    start_month INTEGER,
    start_day INTEGER,
    start_approximate BOOLEAN DEFAULT false,

    end_year INTEGER,
    end_month INTEGER,
    end_day INTEGER,
    end_approximate BOOLEAN DEFAULT false,

    is_ongoing BOOLEAN DEFAULT false,

    -- Context
    description TEXT,                    -- "Served 1968-1972, deployed to Vietnam 1970-1971"

    order_index INTEGER,

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_life_event_timespan ON life_event_timespan(life_event_id);
```

### life_event_location
Events can happen in multiple places.

```sql
CREATE TABLE life_event_location (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    life_event_id UUID REFERENCES life_event(id) ON DELETE CASCADE,

    -- Location
    location_name VARCHAR(200),          -- "San Francisco, CA" or "Vietnam" or "Our home on Oak Street"
    location_type VARCHAR(50),           -- 'city', 'country', 'region', 'specific_place'

    -- Significance
    is_primary_location BOOLEAN DEFAULT false,
    description TEXT,                    -- Additional context

    order_index INTEGER,

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_life_event_location ON life_event_location(life_event_id);
```

### life_event_participant
People involved in this event, with roles.

```sql
CREATE TABLE life_event_participant (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    life_event_id UUID REFERENCES life_event(id) ON DELETE CASCADE,

    -- Person identification
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    nickname VARCHAR(100),

    -- Relationship & role
    relationship_type VARCHAR(100),      -- 'spouse', 'child', 'parent', 'friend', 'colleague', 'mentor'
    role_in_event VARCHAR(200),          -- "My commanding officer", "The friend who got me through",
                                         -- "My first love"

    -- Significance to event
    significance VARCHAR(50),            -- 'central', 'supporting', 'mentioned'

    -- Privacy
    use_real_name BOOLEAN DEFAULT true,
    pseudonym VARCHAR(100),

    -- Status
    is_deceased BOOLEAN DEFAULT false,

    notes TEXT,

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_life_event_participant ON life_event_participant(life_event_id);
```

### life_event_detail
Flexible key-value storage for event-specific facts.

```sql
CREATE TABLE life_event_detail (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    life_event_id UUID REFERENCES life_event(id) ON DELETE CASCADE,

    -- Detail definition
    detail_key VARCHAR(100) NOT NULL,    -- 'occupation', 'rank', 'denomination', 'illness_type',
                                         -- 'school_name', 'company_name', etc.

    detail_value TEXT NOT NULL,
    detail_type VARCHAR(50),             -- 'text', 'number', 'date', 'boolean', 'list'

    -- Display
    display_label VARCHAR(200),          -- User-friendly label
    display_order INTEGER,

    -- Privacy
    is_private BOOLEAN DEFAULT false,    -- Can capture but not publish

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_life_event_detail ON life_event_detail(life_event_id);
CREATE INDEX idx_life_event_detail_key ON life_event_detail(life_event_id, detail_key);
```

---

## Trauma Classification

### life_event_trauma
Trauma markers and resolution tracking.

```sql
CREATE TABLE life_event_trauma (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    life_event_id UUID REFERENCES life_event(id) ON DELETE CASCADE UNIQUE,

    -- Trauma identification
    is_trauma BOOLEAN DEFAULT true,      -- Any event where individual struggled to make sense,
                                         -- felt shame/fear/anger, struggled to speak about

    trauma_type VARCHAR(100),            -- 'loss', 'abuse', 'violence', 'betrayal', 'illness',
                                         -- 'accident', 'combat', 'natural_disaster', 'other'

    -- Resolution status
    trauma_status VARCHAR(50) NOT NULL,  -- 'resolved', 'ongoing', 'partially_resolved'

    -- Resolved = event now makes sense, no overwhelming emotions, spoken without distress
    resolution_notes TEXT,

    -- Capture approach
    requires_explicit_consent BOOLEAN DEFAULT true,
    consent_given BOOLEAN DEFAULT false,
    consent_date TIMESTAMP,

    -- Therapeutic considerations
    recommends_professional_support BOOLEAN DEFAULT false,
    support_notes TEXT,

    -- Privacy defaults
    default_privacy_level VARCHAR(50) DEFAULT 'private',  -- 'private', 'limited', 'full'

    -- Assessment metadata
    assessed_by VARCHAR(100),            -- 'user_indicated', 'system_inferred', 'professional'
    assessed_at TIMESTAMP DEFAULT NOW(),

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_life_event_trauma ON life_event_trauma(life_event_id);
```

---

## Boundaries (Two Levels)

### storyteller_boundary
General comfort levels across all topics (storyteller-wide defaults).

```sql
CREATE TABLE storyteller_boundary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storyteller_id UUID REFERENCES storyteller(id) ON DELETE CASCADE UNIQUE,

    -- General topic comfort (defaults)
    comfortable_discussing_romance BOOLEAN DEFAULT true,
    comfortable_discussing_intimacy BOOLEAN DEFAULT false,
    comfortable_discussing_loss BOOLEAN DEFAULT true,
    comfortable_discussing_trauma BOOLEAN DEFAULT false,
    comfortable_discussing_illness BOOLEAN DEFAULT true,
    comfortable_discussing_conflict BOOLEAN DEFAULT true,
    comfortable_discussing_faith BOOLEAN DEFAULT true,
    comfortable_discussing_finances BOOLEAN DEFAULT false,

    -- Content preferences
    prefers_some_private BOOLEAN DEFAULT false,  -- Will capture things not for book
    wants_explicit_warnings BOOLEAN DEFAULT true, -- Before sensitive questions

    -- Off-limit topics (general)
    off_limit_topics TEXT[],             -- e.g., ["specific family conflict", "medical details"]

    -- Tier comfort level
    maximum_tier_comfortable INTEGER DEFAULT 2,  -- 1=safe, 2=optional, 3=private

    -- Additional notes
    additional_notes TEXT,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### life_event_boundary
Event-specific privacy and comfort overrides.

```sql
CREATE TABLE life_event_boundary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    life_event_id UUID REFERENCES life_event(id) ON DELETE CASCADE UNIQUE,

    -- Event-specific overrides
    override_storyteller_default BOOLEAN DEFAULT false,

    -- Comfort level for THIS event
    comfortable_discussing BOOLEAN,      -- null = use storyteller default

    -- Privacy for THIS event
    privacy_level VARCHAR(50),           -- 'public', 'limited', 'private', 'never_publish'

    -- Specific constraints
    can_mention_but_not_detail BOOLEAN DEFAULT false,
    requires_pseudonyms BOOLEAN DEFAULT false,
    requires_location_anonymization BOOLEAN DEFAULT false,

    -- Consent for deepening
    consent_to_deepen BOOLEAN DEFAULT false,  -- Willing to go beyond surface level
    consent_date TIMESTAMP,

    -- Off-limit aspects for THIS event
    off_limit_aspects TEXT[],            -- e.g., ["specific medical details", "name of person involved"]

    -- Notes
    boundary_notes TEXT,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## Supporting Tables

### life_event_media
Media linked to specific events.

```sql
CREATE TABLE life_event_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    life_event_id UUID REFERENCES life_event(id) ON DELETE CASCADE,

    -- Media details
    media_type VARCHAR(50),              -- 'photo', 'document', 'letter', 'audio', 'video'
    file_url TEXT NOT NULL,
    thumbnail_url TEXT,

    -- Description
    title VARCHAR(200),
    description TEXT,
    caption TEXT,                        -- For use in book

    -- Context
    approximate_date DATE,
    location VARCHAR(200),
    people_in_media TEXT[],              -- Names of people in photo/document

    -- Rights & usage
    has_usage_rights BOOLEAN DEFAULT true,
    can_publish BOOLEAN DEFAULT true,

    -- Organization
    tags TEXT[],

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_life_event_media ON life_event_media(life_event_id);
```

### storyteller_preference
General working preferences and book goals.

```sql
CREATE TABLE storyteller_preference (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storyteller_id UUID REFERENCES storyteller(id) ON DELETE CASCADE UNIQUE,

    -- Capture method
    preferred_input_method VARCHAR(50),   -- 'text', 'voice', 'mixed'
    session_length_preference VARCHAR(50),-- 'short' (15min), 'medium' (30min), 'long' (45min+)

    -- Book style
    desired_book_tone VARCHAR(50),        -- 'reflective', 'conversational', 'literary', 'straightforward'
    desired_book_length VARCHAR(50),      -- 'concise', 'moderate', 'comprehensive'

    -- Content preferences
    wants_photos_included BOOLEAN DEFAULT true,
    wants_documents_included BOOLEAN DEFAULT true,
    wants_letters_quotes_included BOOLEAN DEFAULT true,

    -- Audience
    intended_audience VARCHAR(100),       -- 'family', 'descendants', 'friends', 'public', 'self'

    -- Language
    primary_language VARCHAR(50) DEFAULT 'en',

    -- Additional preferences
    additional_preferences JSONB,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### life_event_preference (Optional)
Event-specific capture and handling preferences.

```sql
CREATE TABLE life_event_preference (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    life_event_id UUID REFERENCES life_event(id) ON DELETE CASCADE UNIQUE,

    -- How to capture THIS event
    preferred_depth VARCHAR(50),          -- 'headline_only', 'summary', 'detailed', 'exhaustive'
    preferred_approach VARCHAR(50),       -- 'chronological', 'thematic', 'impressionistic'

    -- Pacing for THIS event
    wants_multiple_sessions BOOLEAN DEFAULT false,
    estimated_sessions_needed INTEGER,

    -- Prompting style for THIS event
    prefers_specific_prompts BOOLEAN DEFAULT true,  -- vs open-ended
    prefers_voice_for_this BOOLEAN,      -- Override default input method

    -- Book treatment
    should_be_chapter BOOLEAN DEFAULT false,
    suggested_chapter_title VARCHAR(200),
    merge_with_other_event_id UUID REFERENCES life_event(id),

    -- Agent behavior
    agent_should_be_gentle BOOLEAN DEFAULT false,
    agent_should_validate_facts BOOLEAN DEFAULT true,

    notes TEXT,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**Note**: This table is optional initially. Can add later when needed for complex events.

---

## Relationships Summary

```
storyteller (immutable facts)
    ├── storyteller_boundary (general comfort levels)
    ├── storyteller_preference (working style)
    │
    └── life_event (core organizing principle)
        ├── life_event_timespan (multiple possible)
        ├── life_event_location (multiple possible)
        ├── life_event_participant (people with roles)
        ├── life_event_detail (flexible key-value facts)
        ├── life_event_boundary (event-specific privacy)
        ├── life_event_trauma (trauma classification)
        ├── life_event_media (photos, documents)
        └── life_event_preference (event-specific handling) [optional]
```

---

## Usage Patterns

### 1. Onboarding New Storyteller

```python
# Create storyteller (immutable facts only)
storyteller = create_storyteller(
    user_id=current_user.id,
    relationship_to_user='self',
    first_name='Margaret',
    preferred_name='Maggie',
    birth_year=1945,
    birth_place='Boston, MA',
    consent_given=True
)

# Initialize related records
create_storyteller_boundary(storyteller.id)
create_storyteller_preference(storyteller.id)
```

### 2. Creating Life Event with Flexible Structure

```python
# Create military service event
event = create_life_event(
    storyteller_id=storyteller.id,
    event_type='military_service',
    event_name='Navy service and Vietnam',
    category='service',
    significance_level='formative'
)

# Add multiple timespans
add_timespan(
    life_event_id=event.id,
    timespan_type='primary',
    start_year=1968,
    end_year=1972,
    description='Overall service period'
)

add_timespan(
    life_event_id=event.id,
    timespan_type='secondary',
    start_year=1970,
    end_year=1971,
    description='Vietnam deployment'
)

# Add locations
add_location(event.id, 'San Diego, CA', is_primary_location=True)
add_location(event.id, 'Vietnam', location_type='country')
add_location(event.id, 'Mekong Delta', location_type='region')

# Add participants
add_participant(
    event.id,
    first_name='Mike',
    last_name='Johnson',
    relationship_type='friend',
    role_in_event='Best friend and fellow sailor',
    significance='central'
)

# Add flexible details
add_detail(event.id, 'rank', 'Petty Officer Second Class')
add_detail(event.id, 'ship_name', 'USS Enterprise')
add_detail(event.id, 'specialty', 'Electronics Technician')

# Mark as trauma if applicable
if is_trauma:
    create_trauma_marker(
        event.id,
        trauma_type='combat',
        trauma_status='partially_resolved',
        requires_explicit_consent=True
    )
```

### 3. Faith Journey (Changes Over Time)

```python
# Faith as evolving event, not static fact
event = create_life_event(
    storyteller_id=storyteller.id,
    event_type='faith_journey',
    event_name='My relationship with faith',
    category='spiritual',
    is_ongoing=True
)

# Multiple timespans for different phases
add_timespan(event.id, timespan_type='primary',
    start_year=1950, end_year=1965,
    description='Childhood Catholic upbringing')

add_timespan(event.id, timespan_type='secondary',
    start_year=1965, end_year=1975,
    description='College crisis and doubt')

add_timespan(event.id, timespan_type='primary',
    start_year=1980, is_ongoing=True,
    description='Return to spirituality, different form')

# Details capture evolution
add_detail(event.id, 'childhood_tradition', 'Catholic')
add_detail(event.id, 'current_practice', 'Buddhist meditation')
add_detail(event.id, 'turning_point', 'Trip to India in 1979')
```

### 4. Checking Event-Specific Boundaries

```python
def can_deepen_on_event(life_event_id):
    # Check storyteller-wide boundaries
    storyteller_boundary = get_storyteller_boundary(storyteller_id)

    # Check event-specific boundaries
    event_boundary = get_life_event_boundary(life_event_id)

    if event_boundary and event_boundary.override_storyteller_default:
        return event_boundary.consent_to_deepen

    # Check for trauma
    trauma = get_trauma_marker(life_event_id)
    if trauma and trauma.trauma_status == 'ongoing':
        return trauma.consent_given

    # Fall back to storyteller default
    return True
```

### 5. Building Timeline View (Derived)

```python
def get_chronological_timeline(storyteller_id):
    """Timeline is derived from events, not the organizing structure"""
    events = get_all_life_events(storyteller_id)

    timeline = []
    for event in events:
        timespans = get_event_timespans(event.id)
        for span in timespans:
            timeline.append({
                'year': span.start_year,
                'event': event,
                'timespan': span,
                'locations': get_event_locations(event.id),
                'participants': get_event_participants(event.id)
            })

    return sorted(timeline, key=lambda x: x['year'])
```

### 6. Contextual Prompting

```python
def generate_contextual_prompt(life_event_id):
    """Use event details for rich prompting"""
    event = get_life_event(life_event_id)
    timespans = get_event_timespans(life_event_id)
    locations = get_event_locations(life_event_id)
    participants = get_event_participants(life_event_id)

    prompt = f"During your {event.event_name}"

    if timespans:
        primary = [t for t in timespans if t.timespan_type == 'primary'][0]
        prompt += f" ({primary.start_year}-{primary.end_year or 'present'})"

    if locations:
        primary_loc = [l for l in locations if l.is_primary_location]
        if primary_loc:
            prompt += f" in {primary_loc[0].location_name}"

    if participants:
        prompt += f", you mentioned {participants[0].first_name}..."

    return prompt
```

---

## Privacy & Security Considerations

### Encryption
- Sensitive fields (especially in `storyteller_boundary` and `life_event_trauma`) should be encrypted at rest
- Consider using PostgreSQL `pgcrypto` or application-level encryption
- Encrypt: off_limit_topics, trauma details, private event details

### Access Control
- Users can only access storytellers they created or are explicitly granted access to
- Implement row-level security (RLS) in PostgreSQL
- Never expose storyteller data across user boundaries

### Consent Management
- `consent_given` must be true before any story capture begins
- Log consent timestamp
- Allow consent withdrawal (soft delete storyteller)
- Trauma events require explicit consent before deepening

### GDPR/Privacy Compliance
- **Right to access**: Export all storyteller data
- **Right to erasure**: Soft delete with `deleted_at`
- **Right to portability**: JSON export capability
- **Right to rectification**: Allow editing of all captured data
- **Data minimization**: Only capture what's necessary
- **Purpose limitation**: Story capture and book creation only

---

## Design Principles

1. **Events, not timeline** - Timeline is derived from events, not the organizing structure
2. **Proper hierarchy** - Parent/child relationships for flexibility
3. **Change over time** - Faith, relationships, identity can evolve across events
4. **Two-level boundaries** - General defaults + event-specific overrides
5. **Trauma-aware** - Explicit classification and resolution tracking
6. **Flexible details** - Key-value storage allows any event-specific facts
7. **Multiple spans/locations/people** - Events aren't always simple or linear
8. **Immutable core** - Storyteller table contains only facts that don't change
9. **Privacy by default** - Multiple privacy controls at every level

---

## Next Steps

1. **Integrate with Process Schema**
   - Link `session` to `storyteller`
   - Use life events to inform node prompts
   - Map process sections to life event categories

2. **Validation Rules**
   - Birth year reasonable range (1900-present)
   - Event timespans don't overlap illogically
   - Consent required before session creation
   - Trauma consent required before deepening

3. **API Endpoints**
   - CRUD for storyteller
   - CRUD for life events and children
   - Boundary management
   - Media upload
   - Timeline view generation

4. **Agent Context**
   - Pass storyteller + current event to agent
   - Dynamic prompt generation using event details
   - Boundary checking before each prompt
   - Trauma-aware tone adjustment

5. **Questions to Resolve**
   - **life_event_preference**: Include now or add later?
   - **Trauma business logic**: What happens when trauma_status='ongoing'?
   - **Event relationships**: Should events link to each other causally?
   - **Timeline caching**: Compute on-the-fly or cache derived views?
