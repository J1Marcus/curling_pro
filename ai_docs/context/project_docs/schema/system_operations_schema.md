# System Operations Schema

## Design Philosophy
- **Progress tracking**: Monitor storyteller journey through process phases
- **Section management**: Track which narrative lanes are selected and unlocked
- **Archetype inference**: AI analysis of narrative patterns with verification
- **Feedback loop**: Centralized user feedback for learning and improvement
- **Agent management**: Reusable agent definitions and instance tracking
- **Export management**: Book publication and format generation
- **Scope definitions**: Formal definitions of scope types and their implications

---

## Progress & Status Tracking

### storyteller_progress
Overall progress through the canonical process flow.

```sql
CREATE TABLE storyteller_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storyteller_id UUID REFERENCES storyteller(id) ON DELETE CASCADE UNIQUE,
    process_version_id UUID REFERENCES process_version(id),

    -- Current phase (from process.txt canonical flow)
    current_phase VARCHAR(100),             -- 'trust_setup', 'scope_selection', 'profile',
                                            -- 'contextual_grounding', 'section_selection',
                                            -- 'story_capture', 'synthesis', 'archetype_inference',
                                            -- 'book_formation'

    phase_status VARCHAR(50),               -- 'not_started', 'in_progress', 'completed'

    -- Progress metrics
    overall_completion_percentage INTEGER DEFAULT 0,  -- 0-100

    phases_completed TEXT[],                -- Array of completed phase keys
    phases_skipped TEXT[],                  -- Phases deliberately skipped

    -- Milestones
    first_session_at TIMESTAMP,
    first_capture_at TIMESTAMP,
    first_synthesis_at TIMESTAMP,
    book_started_at TIMESTAMP,
    book_completed_at TIMESTAMP,

    -- Activity
    last_active_at TIMESTAMP,
    total_sessions_count INTEGER DEFAULT 0,
    total_interactions_count INTEGER DEFAULT 0,
    total_artifacts_count INTEGER DEFAULT 0,

    -- Next steps
    suggested_next_phase VARCHAR(100),
    suggested_next_action TEXT,

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_storyteller_progress ON storyteller_progress(storyteller_id);
CREATE INDEX idx_storyteller_progress_phase ON storyteller_progress(current_phase, phase_status);
```

---

## Section Selection & Status

### storyteller_section_selection
Which narrative lanes (sections) the storyteller chose to work on.

```sql
CREATE TABLE storyteller_section_selection (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storyteller_id UUID REFERENCES storyteller(id) ON DELETE CASCADE,
    process_section_id UUID REFERENCES process_section(id),

    -- Selection context
    selected_during_phase VARCHAR(50),      -- 'initial_selection', 'progressive_unlock'
    selection_reason VARCHAR(100),          -- 'user_choice', 'scope_enabled', 'profile_enabled',
                                            -- 'prerequisite_met', 'agent_suggested'

    -- Priority
    priority_level VARCHAR(50),             -- 'high', 'medium', 'low'
    is_required BOOLEAN DEFAULT false,      -- Required by scope

    -- User context
    selected_at TIMESTAMP DEFAULT NOW(),
    user_notes TEXT,                        -- Why storyteller wants to work on this

    UNIQUE(storyteller_id, process_section_id)
);

CREATE INDEX idx_section_selection_storyteller ON storyteller_section_selection(storyteller_id);
```

### storyteller_section_status
Detailed status of each section for a storyteller.

```sql
CREATE TABLE storyteller_section_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storyteller_id UUID REFERENCES storyteller(id) ON DELETE CASCADE,
    process_section_id UUID REFERENCES process_section(id),

    -- Status
    status VARCHAR(50) DEFAULT 'locked',    -- 'locked', 'unlocked', 'in_progress',
                                            -- 'completed', 'skipped'

    -- Unlock logic
    unlocked_at TIMESTAMP,
    unlocked_by VARCHAR(100),               -- 'scope', 'profile', 'prerequisite', 'manual'
    unlock_reason TEXT,

    -- Progress
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    skipped_at TIMESTAMP,
    skip_reason TEXT,

    -- Content metrics
    prompts_answered INTEGER DEFAULT 0,
    prompts_total INTEGER,
    scenes_captured INTEGER DEFAULT 0,
    life_events_created INTEGER DEFAULT 0,

    completion_percentage INTEGER DEFAULT 0, -- 0-100

    -- Prerequisites
    prerequisite_sections_met BOOLEAN DEFAULT false,
    prerequisite_notes TEXT,

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(storyteller_id, process_section_id)
);

CREATE INDEX idx_section_status_storyteller ON storyteller_section_status(storyteller_id, status);
CREATE INDEX idx_section_status_section ON storyteller_section_status(process_section_id);
```

---

## Scope Definitions

### scope_type
Formal definitions of scope types and their implications.

```sql
CREATE TABLE scope_type (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    process_version_id UUID REFERENCES process_version(id) ON DELETE CASCADE,

    -- Scope identity
    scope_key VARCHAR(50) UNIQUE NOT NULL,  -- 'whole_life', 'major_chapter', 'single_event', 'unsure'
    scope_name VARCHAR(200) NOT NULL,       -- "My whole life story"
    scope_description TEXT,

    -- User-facing
    user_facing_label VARCHAR(200),
    user_facing_description TEXT,
    example_use_cases TEXT[],

    -- System implications
    required_context_fields JSONB,          -- What context must be gathered
                                            -- e.g., {"birth_year": true, "major_moves": true}

    enabled_sections TEXT[],                -- Which process sections are enabled
    suggested_sections TEXT[],              -- Which sections are suggested

    minimum_life_events INTEGER,            -- Minimum events to consider complete
    estimated_sessions INTEGER,             -- Rough estimate of sessions needed

    -- Completion criteria
    completion_criteria JSONB,              -- What defines "complete" for this scope
                                            -- e.g., {"sections_completed": 5, "events_captured": 10}

    -- Defaults
    default_narrative_structure VARCHAR(100), -- 'linear', 'thematic', etc.

    -- Ordering
    display_order INTEGER,

    -- Status
    is_active BOOLEAN DEFAULT true,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_scope_type_key ON scope_type(scope_key);
```

---

## Archetype Analysis

### archetype_analysis
AI inference of narrative archetypes with confidence scoring and verification.

```sql
CREATE TABLE archetype_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storyteller_id UUID REFERENCES storyteller(id) ON DELETE CASCADE,

    -- Analysis scope
    analysis_scope VARCHAR(50),             -- 'whole_story', 'collection', 'story_book'
    collection_id UUID REFERENCES collection(id) ON DELETE CASCADE,
    story_id UUID REFERENCES story(id) ON DELETE CASCADE,

    -- Analysis version
    analysis_version INTEGER DEFAULT 1,     -- Reanalysis creates new version
    analyzed_at TIMESTAMP DEFAULT NOW(),

    -- Primary archetype inference
    inferred_archetype VARCHAR(100),        -- 'loss_to_connection', 'transformation',
                                            -- 'endurance', 'threat_survival',
                                            -- 'identity_shift', 'meaning_making'

    confidence_score DECIMAL(3,2),          -- 0.00 to 1.00

    -- Supporting analysis
    supporting_evidence JSONB,              -- Structured evidence
                                            -- e.g., {
                                            --   "loss_indicators": ["event_123", "event_456"],
                                            --   "connection_indicators": ["event_789"],
                                            --   "transformation_points": ["event_234"]
                                            -- }

    narrative_patterns TEXT[],              -- Detected patterns
    thematic_indicators TEXT[],             -- Themes that support archetype

    emotional_arc_description TEXT,         -- Description of emotional journey
    character_development_notes TEXT,       -- How protagonist (storyteller) changes

    -- Alternative archetypes
    secondary_archetype VARCHAR(100),       -- Second-best fit
    secondary_confidence DECIMAL(3,2),

    alternative_archetypes JSONB,           -- Other considered archetypes with scores

    -- Identity analysis (from process.txt)
    identity_before TEXT,                   -- Identity at story beginning
    identity_after TEXT,                    -- Identity at story end
    identity_shift_type VARCHAR(100),       -- 'radical', 'gradual', 'cyclical', 'static'

    -- Relationship to loss/agency/meaning
    relationship_to_loss TEXT,
    relationship_to_agency TEXT,
    relationship_to_meaning TEXT,

    -- User interaction
    revealed_to_user BOOLEAN DEFAULT false, -- Hidden by default (process.txt Phase 10)
    revealed_at TIMESTAMP,

    user_feedback_received BOOLEAN DEFAULT false,
    user_confirmed BOOLEAN,                 -- User agreed with inference
    user_reframed_as VARCHAR(100),          -- User's preferred framing
    user_reframe_notes TEXT,

    -- System notes
    analysis_method VARCHAR(100),           -- 'ai_inference', 'user_specified', 'hybrid'
    analysis_notes TEXT,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_archetype_analysis_storyteller ON archetype_analysis(storyteller_id);
CREATE INDEX idx_archetype_analysis_collection ON archetype_analysis(collection_id);
CREATE INDEX idx_archetype_analysis_story ON archetype_analysis(story_id);
CREATE INDEX idx_archetype_analysis_revealed ON archetype_analysis(revealed_to_user);
```

---

## User Feedback

### user_feedback
Centralized feedback on any system element for learning and improvement.

```sql
CREATE TABLE user_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storyteller_id UUID REFERENCES storyteller(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,

    -- What is this feedback on?
    feedback_on_type VARCHAR(50),           -- 'collection', 'synthesis', 'archetype',
                                            -- 'draft', 'chapter', 'prompt', 'section',
                                            -- 'agent_interaction', 'system'

    feedback_on_id UUID,                    -- ID of the thing (polymorphic)
    feedback_on_name VARCHAR(200),          -- Human-readable name

    -- Feedback type
    feedback_type VARCHAR(50),              -- 'approval', 'correction', 'rejection',
                                            -- 'revision_request', 'suggestion', 'concern'

    feedback_category VARCHAR(100),         -- 'accuracy', 'tone', 'completeness',
                                            -- 'privacy', 'relevance', 'quality'

    -- Feedback content
    feedback_text TEXT NOT NULL,
    specific_issue TEXT,                    -- What specifically is the problem
    suggested_change TEXT,                  -- What should be different

    -- Sentiment
    sentiment VARCHAR(50),                  -- 'positive', 'neutral', 'negative'

    -- Priority
    priority VARCHAR(50),                   -- 'critical', 'important', 'minor'
    requires_immediate_action BOOLEAN DEFAULT false,

    -- Response
    agent_response TEXT,
    resolution_status VARCHAR(50),          -- 'pending', 'acknowledged', 'resolved',
                                            -- 'cannot_resolve', 'wont_fix'
    resolved_at TIMESTAMP,
    resolution_notes TEXT,

    -- Learning
    used_for_improvement BOOLEAN DEFAULT false,
    improvement_notes TEXT,

    -- Metadata
    feedback_given_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_feedback_storyteller ON user_feedback(storyteller_id);
CREATE INDEX idx_user_feedback_type ON user_feedback(feedback_on_type, feedback_on_id);
CREATE INDEX idx_user_feedback_resolution ON user_feedback(resolution_status);
CREATE INDEX idx_user_feedback_priority ON user_feedback(priority, requires_immediate_action);
```

---

## Agent Management

### agent
Reusable agent definitions that can be instantiated across storytellers.

```sql
CREATE TABLE agent (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Agent identity
    agent_key VARCHAR(100) UNIQUE NOT NULL, -- 'capture_agent', 'synthesis_agent', 'reflection_agent'
    agent_name VARCHAR(200) NOT NULL,       -- "Story Capture Agent"
    agent_description TEXT,

    -- Agent purpose
    agent_type VARCHAR(50),                 -- 'capture', 'synthesis', 'reflection',
                                            -- 'analysis', 'guidance', 'editor'

    primary_objective TEXT,                 -- Core goal of this agent
    secondary_objectives TEXT[],            -- Additional goals

    -- Agent behavior
    base_constraints TEXT[],                -- Universal constraints for this agent type
    default_tone VARCHAR(50),               -- 'empathetic', 'neutral', 'encouraging', 'analytical'

    persona_description TEXT,               -- How agent presents itself
    communication_style TEXT,               -- How agent communicates

    -- Capabilities
    can_create_artifacts BOOLEAN DEFAULT true,
    can_analyze_content BOOLEAN DEFAULT true,
    can_generate_prompts BOOLEAN DEFAULT true,
    can_provide_feedback BOOLEAN DEFAULT true,

    -- Process integration
    used_in_process_phases TEXT[],          -- Which phases this agent is used in
    suggested_for_node_types TEXT[],        -- Which process node types

    -- Prompt templates
    system_prompt_template TEXT,            -- Base system prompt
    greeting_template TEXT,                 -- How agent introduces itself
    closing_template TEXT,                  -- How agent concludes

    -- Configuration
    default_model VARCHAR(50),              -- 'gpt-4', 'claude-3', etc.
    temperature DECIMAL(2,1),
    max_tokens INTEGER,

    configuration JSONB,                    -- Additional configuration

    -- Status
    is_active BOOLEAN DEFAULT true,
    version INTEGER DEFAULT 1,

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_agent_key ON agent(agent_key);
CREATE INDEX idx_agent_type ON agent(agent_type);
```

### agent_instance
Specific instantiation of an agent for a session.

```sql
CREATE TABLE agent_instance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES agent(id),
    session_id UUID REFERENCES session(id) ON DELETE CASCADE,
    storyteller_id UUID REFERENCES storyteller(id) ON DELETE CASCADE,

    -- Instance configuration
    instance_objective TEXT,                -- Specific objective for this instance
    instance_constraints TEXT[],            -- Additional constraints for this instance

    -- Context passed to agent
    agent_context JSONB,                    -- {
                                            --   "storyteller": {...},
                                            --   "boundaries": {...},
                                            --   "scope": {...},
                                            --   "current_section": {...},
                                            --   "life_events": [...]
                                            -- }

    -- Overrides
    tone_override VARCHAR(50),              -- Override default tone
    model_override VARCHAR(50),             -- Override default model
    temperature_override DECIMAL(2,1),

    -- Instance lifecycle
    status VARCHAR(50) DEFAULT 'active',    -- 'active', 'completed', 'paused', 'failed'

    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    paused_at TIMESTAMP,
    failed_at TIMESTAMP,

    failure_reason TEXT,

    -- Performance
    total_interactions INTEGER DEFAULT 0,
    total_artifacts_created INTEGER DEFAULT 0,
    average_response_time_ms INTEGER,

    -- Quality
    user_satisfaction_rating INTEGER,       -- 1-5 if provided
    flagged_for_review BOOLEAN DEFAULT false,
    review_notes TEXT,

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_agent_instance_agent ON agent_instance(agent_id);
CREATE INDEX idx_agent_instance_session ON agent_instance(session_id);
CREATE INDEX idx_agent_instance_storyteller ON agent_instance(storyteller_id);
CREATE INDEX idx_agent_instance_status ON agent_instance(status);
```

---

## Book Export

### book_export
Final manuscript exports in various formats.

```sql
CREATE TABLE book_export (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID REFERENCES story(id) ON DELETE CASCADE,
    storyteller_id UUID REFERENCES storyteller(id) ON DELETE CASCADE,

    -- Export details
    export_format VARCHAR(50),              -- 'pdf', 'epub', 'mobi', 'docx', 'print_ready',
                                            -- 'html', 'markdown'

    export_version INTEGER DEFAULT 1,       -- Version number of this export

    -- Export scope
    export_scope VARCHAR(50),               -- 'full_book', 'chapter', 'collection', 'preview'
    chapter_ids UUID[],                     -- If exporting specific chapters
    collection_ids UUID[],                  -- If exporting specific collections

    -- Format options
    format_options JSONB,                   -- {
                                            --   "page_size": "6x9",
                                            --   "font": "Garamond",
                                            --   "include_images": true,
                                            --   "include_toc": true
                                            -- }

    -- Status
    export_status VARCHAR(50) DEFAULT 'queued', -- 'queued', 'generating', 'ready',
                                                 -- 'failed', 'expired'

    -- Generation
    generation_started_at TIMESTAMP,
    generation_completed_at TIMESTAMP,
    generation_duration_seconds INTEGER,

    -- Output
    file_url TEXT,                          -- URL to download file
    file_size_bytes BIGINT,
    file_checksum VARCHAR(64),

    page_count INTEGER,
    word_count INTEGER,

    -- Expiry
    expires_at TIMESTAMP,                   -- Export files auto-expire
    downloaded_count INTEGER DEFAULT 0,
    last_downloaded_at TIMESTAMP,

    -- Errors
    failed_at TIMESTAMP,
    failure_reason TEXT,
    error_log TEXT,

    -- Metadata
    generated_by VARCHAR(100),              -- 'user_request', 'scheduled', 'preview'
    generation_notes TEXT,

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_book_export_story ON book_export(story_id);
CREATE INDEX idx_book_export_storyteller ON book_export(storyteller_id);
CREATE INDEX idx_book_export_status ON book_export(export_status);
CREATE INDEX idx_book_export_expires ON book_export(expires_at);
```

### book_export_delivery
Track delivery of exports to storyteller.

```sql
CREATE TABLE book_export_delivery (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_export_id UUID REFERENCES book_export(id) ON DELETE CASCADE,
    storyteller_id UUID REFERENCES storyteller(id) ON DELETE CASCADE,

    -- Delivery method
    delivery_method VARCHAR(50),            -- 'download', 'email', 'cloud_storage', 'print_service'

    -- Delivery details
    delivered_to VARCHAR(300),              -- Email address, storage path, etc.
    delivery_status VARCHAR(50),            -- 'pending', 'sent', 'delivered', 'failed'

    -- Tracking
    delivered_at TIMESTAMP,
    opened_at TIMESTAMP,                    -- If email, when opened
    downloaded_at TIMESTAMP,

    failure_reason TEXT,

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_book_export_delivery_export ON book_export_delivery(book_export_id);
CREATE INDEX idx_book_export_delivery_status ON book_export_delivery(delivery_status);
```

---

## Relationships Summary

```
storyteller
    ├── storyteller_progress (1:1)
    │   └── Tracks overall journey through process
    │
    ├── storyteller_section_selection (1:many)
    │   └── Which sections chosen
    │
    ├── storyteller_section_status (1:many)
    │   └── Status of each section (locked/unlocked/completed)
    │
    ├── archetype_analysis (1:many)
    │   └── AI inference of narrative patterns
    │
    ├── user_feedback (1:many)
    │   └── Feedback on any system element
    │
    ├── agent_instance (1:many)
    │   └── Agent instances for sessions
    │
    └── book_export (1:many)
        └── Final manuscript exports

agent (reusable definition)
    └── agent_instance (1:many)
        └── Specific instantiations

scope_type (definition)
    └── Used by session_scope

process_section
    ├── storyteller_section_selection (1:many)
    └── storyteller_section_status (1:many)
```

---

## Usage Patterns

### 1. Initializing Storyteller Progress

```python
def initialize_storyteller(storyteller_id, process_version_id):
    """
    When storyteller is created, initialize progress tracking
    """
    # Create progress record
    progress = create_progress(
        storyteller_id=storyteller_id,
        process_version_id=process_version_id,
        current_phase='trust_setup',
        phase_status='in_progress',
        overall_completion_percentage=0
    )

    # Get scope types for later selection
    scope_types = get_scope_types(process_version_id)

    # Initialize section statuses (all locked initially)
    sections = get_process_sections(process_version_id)
    for section in sections:
        create_section_status(
            storyteller_id=storyteller_id,
            process_section_id=section.id,
            status='locked'
        )

    return progress
```

### 2. Scope Selection and Section Enabling

```python
def select_scope(storyteller_id, scope_key):
    """
    When storyteller selects scope, enable appropriate sections
    """
    # Get scope definition
    scope_type = get_scope_type(scope_key)

    # Update progress
    update_progress(
        storyteller_id,
        current_phase='section_selection',
        suggested_next_action=f"Choose from {len(scope_type.enabled_sections)} available narrative lanes"
    )

    # Enable sections based on scope
    for section_key in scope_type.enabled_sections:
        section = get_section_by_key(section_key)
        update_section_status(
            storyteller_id,
            section.id,
            status='unlocked',
            unlocked_by='scope',
            unlock_reason=f"Enabled by {scope_type.scope_name}"
        )

    # Suggest priority sections
    for section_key in scope_type.suggested_sections:
        section = get_section_by_key(section_key)
        create_section_selection(
            storyteller_id,
            section.id,
            priority_level='high',
            selection_reason='scope_enabled'
        )
```

### 3. Progressive Section Unlocking

```python
def check_section_unlocks(storyteller_id):
    """
    After completing sections, check if new ones should unlock
    """
    completed_sections = get_completed_sections(storyteller_id)
    locked_sections = get_locked_sections(storyteller_id)

    for section in locked_sections:
        # Check prerequisites
        if section.unlock_after_section_id:
            prerequisite = get_section_status(
                storyteller_id,
                section.unlock_after_section_id
            )

            if prerequisite.status == 'completed':
                # Unlock this section
                update_section_status(
                    storyteller_id,
                    section.id,
                    status='unlocked',
                    unlocked_by='prerequisite',
                    unlock_reason=f"Prerequisite {prerequisite.section_name} completed",
                    prerequisite_sections_met=True
                )

        # Check minimum prompts requirement
        if section.minimum_prompts_required:
            total_prompts_answered = count_prompts_answered(storyteller_id)
            if total_prompts_answered >= section.minimum_prompts_required:
                update_section_status(
                    storyteller_id,
                    section.id,
                    status='unlocked',
                    unlocked_by='prerequisite',
                    unlock_reason=f"Met minimum {section.minimum_prompts_required} prompts"
                )
```

### 4. Archetype Analysis with Verification

```python
def analyze_archetype(storyteller_id, collection_id=None):
    """
    Run AI analysis to infer archetype (Phase 10)
    """
    # Gather material
    if collection_id:
        events = get_collection_events(collection_id)
        scope = 'collection'
    else:
        events = get_all_storyteller_events(storyteller_id)
        scope = 'whole_story'

    # Analyze patterns
    analysis_result = ai_infer_archetype(events)

    # Create analysis record
    analysis = create_archetype_analysis(
        storyteller_id=storyteller_id,
        collection_id=collection_id,
        analysis_scope=scope,

        inferred_archetype=analysis_result.primary_archetype,
        confidence_score=analysis_result.confidence,

        supporting_evidence=analysis_result.evidence,
        narrative_patterns=analysis_result.patterns,

        identity_before=analysis_result.identity_start,
        identity_after=analysis_result.identity_end,
        identity_shift_type=analysis_result.shift_type,

        relationship_to_loss=analysis_result.loss_analysis,
        relationship_to_agency=analysis_result.agency_analysis,
        relationship_to_meaning=analysis_result.meaning_analysis,

        revealed_to_user=False,  # Hidden by default per process.txt
        analysis_method='ai_inference'
    )

    return analysis
```

### 5. Revealing and Verifying Archetype

```python
def reveal_archetype(storyteller_id, analysis_id):
    """
    Show archetype to user when they ask (process.txt Phase 10)
    """
    analysis = get_archetype_analysis(analysis_id)

    # Mark as revealed
    update_analysis(
        analysis_id,
        revealed_to_user=True,
        revealed_at=now()
    )

    # Verification language from process.txt
    verification_prompt = f"""
    This currently reads like a journey through {format_archetype(analysis.inferred_archetype)}.

    Does that feel accurate, or would you frame it differently?
    """

    return {
        'archetype': analysis.inferred_archetype,
        'confidence': analysis.confidence_score,
        'description': get_archetype_description(analysis.inferred_archetype),
        'evidence': analysis.supporting_evidence,
        'verification_prompt': verification_prompt
    }
```

### 6. Processing User Feedback

```python
def record_archetype_feedback(analysis_id, user_confirmed, reframe_notes=None):
    """
    Handle user verification of archetype
    """
    if user_confirmed:
        update_analysis(
            analysis_id,
            user_feedback_received=True,
            user_confirmed=True
        )
    else:
        # User disagrees - immediate pivot per process.txt
        update_analysis(
            analysis_id,
            user_feedback_received=True,
            user_confirmed=False,
            user_reframe_notes=reframe_notes
        )

        # Create feedback record
        create_feedback(
            feedback_on_type='archetype',
            feedback_on_id=analysis_id,
            feedback_type='correction',
            feedback_text=reframe_notes,
            priority='critical',
            requires_immediate_action=True
        )

        # Trigger reanalysis
        reanalyze_archetype(analysis_id)
```

### 7. Creating Agent Instance for Session

```python
def create_session_agent(session_id, agent_key):
    """
    Instantiate agent for a session
    """
    session = get_session(session_id)
    storyteller = get_storyteller(session.storyteller_id)
    agent_def = get_agent_by_key(agent_key)

    # Gather context
    context = {
        'storyteller': {
            'name': storyteller.preferred_name,
            'birth_year': storyteller.birth_year
        },
        'boundaries': get_storyteller_boundaries(storyteller.id).to_dict(),
        'scope': get_session_scope(session.id).to_dict(),
        'current_section': get_current_section(session.id),
        'life_events': get_relevant_events(session.id),
        'progress': get_storyteller_progress(storyteller.id).to_dict()
    }

    # Create instance
    instance = create_agent_instance(
        agent_id=agent_def.id,
        session_id=session.id,
        storyteller_id=storyteller.id,

        instance_objective=session.intention,
        instance_constraints=session.constraints + agent_def.base_constraints,

        agent_context=context,
        status='active'
    )

    return instance
```

### 8. Generating Book Export

```python
def request_book_export(story_id, export_format, format_options=None):
    """
    Generate final manuscript export
    """
    story = get_story(story_id)

    # Create export record
    export = create_book_export(
        story_id=story_id,
        storyteller_id=story.storyteller_id,
        export_format=export_format,
        export_version=get_next_version(story_id, export_format),
        export_scope='full_book',
        format_options=format_options or {},
        export_status='queued'
    )

    # Queue generation job
    queue_export_generation(export.id)

    return export
```

### 9. Tracking Overall Progress

```python
def calculate_progress(storyteller_id):
    """
    Calculate overall completion percentage
    """
    # Get section statuses
    section_statuses = get_all_section_statuses(storyteller_id)
    total_sections = len(section_statuses)
    completed_sections = len([s for s in section_statuses if s.status == 'completed'])

    # Get session count
    sessions = get_storyteller_sessions(storyteller_id)
    total_sessions = len(sessions)
    completed_sessions = len([s for s in sessions if s.status == 'completed'])

    # Get artifacts
    artifacts = get_storyteller_artifacts(storyteller_id)
    artifact_count = len(artifacts)

    # Get story status
    story = get_storyteller_story(storyteller_id)
    story_completion = 0
    if story:
        chapters = get_story_chapters(story.id)
        completed_chapters = len([c for c in chapters if c.status == 'polished'])
        story_completion = (completed_chapters / len(chapters)) * 100 if chapters else 0

    # Calculate weighted progress
    section_weight = 0.4
    session_weight = 0.2
    artifact_weight = 0.2
    story_weight = 0.2

    overall = (
        (completed_sections / total_sections * 100 * section_weight) +
        (min(completed_sessions / 10, 1.0) * 100 * session_weight) +  # Cap at 10 sessions
        (min(artifact_count / 20, 1.0) * 100 * artifact_weight) +     # Cap at 20 artifacts
        (story_completion * story_weight)
    )

    # Update progress
    update_progress(
        storyteller_id,
        overall_completion_percentage=int(overall),
        total_sessions_count=total_sessions,
        total_artifacts_count=artifact_count,
        last_active_at=now()
    )

    return overall
```

---

## Design Principles

1. **Progress visibility** - Clear tracking of journey through process
2. **Flexible section management** - Supports progressive unlocking
3. **Archetype verification** - AI inference + user confirmation
4. **Learning loop** - Centralized feedback improves system
5. **Agent reusability** - Agent definitions used across storytellers
6. **Export management** - Professional manuscript generation
7. **Scope-driven** - Formal scope definitions drive system behavior

---

## Questions to Resolve

1. **Progress calculation** - Is the weighted formula appropriate, or different logic?
2. **Section prerequisites** - Should we support complex prerequisite logic (AND/OR conditions)?
3. **Archetype reanalysis** - How often should we reanalyze as more material is added?
4. **Feedback response time** - SLA for responding to critical feedback?
5. **Agent instance cleanup** - When do we archive completed agent instances?
6. **Export expiry** - How long should exports remain available?
7. **Progress phases** - Are the canonical phases from process.txt the right granularity?
