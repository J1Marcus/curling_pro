# System Operations Schema

## Design Philosophy
- **Progress tracking**: Monitor storyteller journey through process phases
- **Section management**: Track which narrative lanes are selected and unlocked
- **Requirements tracking**: Gap identification and resolution workflow (story capture + composition)
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
Multi-archetype tracking with progressive refinement from exploration to resolution. Supports Analyst Flow in lodging discriminating requirements to clarify which narrative pattern is most apt.

**Refinement Philosophy**: Start with multiple candidate archetypes (exploring), narrow to strong contenders (narrowing), resolve to single dominant archetype (resolved). Analyst uses this to guide story capture strategically.

```sql
CREATE TABLE archetype_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storyteller_id UUID REFERENCES storyteller(id) ON DELETE CASCADE,

    -- Analysis scope
    analysis_scope VARCHAR(50),             -- 'whole_story', 'collection', 'story_book'
    collection_id UUID REFERENCES collection(id) ON DELETE CASCADE,
    story_id UUID REFERENCES story(id) ON DELETE CASCADE,

    -- Analysis version (periodic reassessment)
    analysis_number INTEGER NOT NULL,       -- 1st, 2nd, 3rd analysis...
    analyzed_at TIMESTAMP DEFAULT NOW(),

    -- Multi-archetype tracking with confidence scores
    candidate_archetypes JSONB NOT NULL,    -- Array of archetypes with evidence
                                            -- [
                                            --   {
                                            --     "archetype": "relationship_to_loss",
                                            --     "confidence": 0.78,
                                            --     "status": "active",
                                            --     "evidence": ["evt-123", "evt-456"],
                                            --     "indicators": ["grief themes", "absence focus"],
                                            --     "evidence_gained_since_last": "grandmother death scene"
                                            --   },
                                            --   {
                                            --     "archetype": "relationship_to_agency",
                                            --     "confidence": 0.62,
                                            --     "status": "active",
                                            --     "evidence": ["evt-789"],
                                            --     "indicators": ["constraint", "forced choices"]
                                            --   },
                                            --   {
                                            --     "archetype": "identity_shift",
                                            --     "confidence": 0.35,
                                            --     "status": "ruled_out",
                                            --     "ruled_out_reason": "no clear transformation arc"
                                            --   }
                                            -- ]

    -- Refinement status
    refinement_status VARCHAR(20) NOT NULL, -- 'exploring', 'narrowing', 'resolved'
                                            -- exploring: 3+ viable candidates, unclear pattern
                                            -- narrowing: 2 strong contenders emerging
                                            -- resolved: single archetype dominant (confidence >0.85)

    -- Dominant archetype (NULL until resolved)
    dominant_archetype VARCHAR(100),        -- 'relationship_to_loss', 'relationship_to_agency',
                                            -- 'relationship_to_meaning', 'identity_shift'
    dominant_confidence DECIMAL(3,2),       -- Must be >= 0.85 for composition gate

    -- Refinement tracking
    refinement_progress TEXT,               -- Description of how understanding evolved
    discriminating_requirements_lodged INTEGER DEFAULT 0,  -- Count of requirements to clarify archetype

    -- Supporting analysis
    narrative_patterns TEXT[],              -- Detected patterns across all candidates
    thematic_indicators TEXT[],             -- Themes supporting archetypes

    emotional_arc_description TEXT,         -- Overall emotional journey
    character_development_notes TEXT,       -- Protagonist changes

    -- Identity dimensions (analyzed for all candidate archetypes)
    identity_before TEXT,                   -- Who storyteller was at beginning
    identity_after TEXT,                    -- Who storyteller is at end
    identity_shift_type VARCHAR(100),       -- 'radical', 'gradual', 'cyclical', 'static'

    -- Relationship dimensions (confidence for each)
    relationship_to_loss_strength DECIMAL(3,2),     -- 0.00-1.00
    relationship_to_loss_notes TEXT,

    relationship_to_agency_strength DECIMAL(3,2),   -- 0.00-1.00
    relationship_to_agency_notes TEXT,

    relationship_to_meaning_strength DECIMAL(3,2),  -- 0.00-1.00
    relationship_to_meaning_notes TEXT,

    -- User interaction (hidden observer)
    revealed_to_user BOOLEAN DEFAULT false, -- Hidden by default
    revealed_at TIMESTAMP,

    user_feedback_received BOOLEAN DEFAULT false,
    user_confirmed BOOLEAN,                 -- User agreed with archetype
    user_reframed_as VARCHAR(100),          -- User's preferred framing
    user_reframe_notes TEXT,

    -- System tracking
    analysis_method VARCHAR(100) DEFAULT 'ai_inference',  -- 'ai_inference', 'user_specified', 'hybrid'
    analysis_notes TEXT,
    previous_analysis_id UUID REFERENCES archetype_analysis(id),  -- Link to previous analysis

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_archetype_analysis_storyteller ON archetype_analysis(storyteller_id);
CREATE INDEX idx_archetype_analysis_collection ON archetype_analysis(collection_id);
CREATE INDEX idx_archetype_analysis_story ON archetype_analysis(story_id);
CREATE INDEX idx_archetype_analysis_revealed ON archetype_analysis(revealed_to_user);
CREATE INDEX idx_archetype_analysis_refinement ON archetype_analysis(storyteller_id, refinement_status);
CREATE INDEX idx_archetype_analysis_number ON archetype_analysis(storyteller_id, analysis_number);
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

## Requirements Tracking

### requirement
Story capture requirements lodged by Analyst Flow and addressed by Session Flow.

**Purpose**: Track gaps in material (missing scenes, character insights, thematic exploration, timeline clarification) that need to be addressed during future sessions.

**Flow Integration**:
- **Analyst Flow** identifies gaps → lodges requirements
- **Session Flow** fetches requirements for current section → addresses them during interview
- **Analyst Flow** reviews if requirements are resolved

```sql
CREATE TABLE requirement (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storyteller_id UUID REFERENCES storyteller(id) ON DELETE CASCADE,

    -- What kind of requirement
    requirement_type VARCHAR(50) NOT NULL,  -- 'scene_detail', 'character_insight',
                                            -- 'thematic_exploration', 'timeline_clarification',
                                            -- 'sensory_detail', 'emotional_context',
                                            -- 'relationship_dynamic', 'turning_point'

    -- Priority
    priority VARCHAR(20) NOT NULL,          -- 'critical', 'important', 'optional'

    -- Scope
    section_id UUID REFERENCES process_section(id),  -- Which narrative lane (can be null if whole-story)
    life_event_id UUID REFERENCES life_event(id),    -- Specific event (optional)
    collection_id UUID REFERENCES collection(id),    -- Related collection (optional)

    -- Archetype alignment and refinement
    archetype_lane VARCHAR(50),             -- Which archetype dimension this serves
                                            -- 'identity_shift', 'relationship_to_loss',
                                            -- 'relationship_to_agency', 'relationship_to_meaning'

    archetype_refinement_purpose VARCHAR(20),  -- 'validate', 'discriminate', 'strengthen', NULL
                                            -- validate: confirms an archetype is present
                                            -- discriminate: helps choose between competing archetypes
                                            -- strengthen: deepens already-identified archetype
                                            -- NULL: standard material gap, not archetype-focused

    discriminates_between JSONB,            -- Array of archetypes this requirement helps choose between
                                            -- e.g., ["relationship_to_loss", "relationship_to_agency"]
                                            -- Only populated when archetype_refinement_purpose = 'discriminate'

    expected_archetype_outcomes JSONB,      -- What answering this reveals about competing archetypes
                                            -- e.g., {
                                            --   "if_loss_dominant": "will show lingering grief, inability to move forward",
                                            --   "if_agency_dominant": "will show frustration at constraint, focus on what was prevented"
                                            -- }

    -- Requirement details
    requirement_description TEXT NOT NULL,
    specific_gap TEXT,                      -- What specifically is missing
    why_important TEXT,                     -- Why this requirement matters for the story

    -- Suggested approach
    suggested_prompts JSONB,                -- Array of suggested follow-up prompts
                                            -- e.g., ["What did your grandmother's house smell like?",
                                            --       "What sounds do you remember?"]

    suggested_session_focus TEXT,           -- Suggested focus for next session

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- 'pending', 'in_progress',
                                                     -- 'addressed', 'resolved',
                                                     -- 'deferred', 'obsolete'

    -- Lifecycle tracking
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by VARCHAR(50) NOT NULL DEFAULT 'analyst_flow',

    addressed_at TIMESTAMP,                 -- When Session Flow started addressing this
    addressed_in_session_id UUID REFERENCES session(id),

    resolved_at TIMESTAMP,                  -- When Analyst Flow confirmed resolved
    resolved_by VARCHAR(50),                -- 'analyst_flow', 'manual_review'
    resolution_notes TEXT,

    deferred_at TIMESTAMP,
    deferred_reason TEXT,                   -- Why this requirement was deferred

    obsolete_at TIMESTAMP,
    obsolete_reason TEXT,                   -- Why this requirement is no longer relevant

    -- User involvement
    user_notified BOOLEAN DEFAULT false,    -- Was user told about this requirement
    user_priority_override VARCHAR(20),     -- User can change priority

    -- Metadata
    metadata JSONB,                         -- Additional context
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_requirement_storyteller_status ON requirement(storyteller_id, status);
CREATE INDEX idx_requirement_section_priority ON requirement(section_id, priority);
CREATE INDEX idx_requirement_priority_status ON requirement(priority, status);
CREATE INDEX idx_requirement_session ON requirement(addressed_in_session_id);
CREATE INDEX idx_requirement_life_event ON requirement(life_event_id);
CREATE INDEX idx_requirement_type ON requirement(requirement_type, status);
```

**Example Requirements**:

```json
// Critical scene detail requirement
{
    "requirement_id": "req-001",
    "storyteller_id": "user-123",
    "requirement_type": "sensory_detail",
    "priority": "critical",
    "section_id": "childhood",
    "life_event_id": "evt-grandmother-house",
    "archetype_lane": "relationship_to_loss",
    "requirement_description": "Need more sensory detail about grandmother's house - currently only visual descriptions",
    "specific_gap": "Missing auditory, olfactory, and tactile sensory details that would make this scene more immersive",
    "why_important": "Grandmother's house is a pivotal setting for loss archetype - needs to be fully immersive for reader",
    "suggested_prompts": [
        "What did your grandmother's house smell like?",
        "What sounds do you remember from being there?",
        "Was there a texture or feeling you associate with that place?"
    ],
    "suggested_session_focus": "Deepen grandmother's house scene with multi-sensory details",
    "status": "pending"
}

// Important character insight requirement
{
    "requirement_id": "req-002",
    "storyteller_id": "user-123",
    "requirement_type": "character_insight",
    "priority": "important",
    "section_id": "early_adulthood",
    "archetype_lane": "relationship_to_agency",
    "requirement_description": "Father's motivations unclear - need to understand why he made that decision",
    "specific_gap": "We know WHAT father did, but not WHY. His internal motivation is missing.",
    "why_important": "Father is key antagonist in agency archetype - his motivations drive protagonist's loss of agency",
    "suggested_prompts": [
        "Looking back, what do you think was driving your father's decision?",
        "Had he ever explained why he felt that way?",
        "What do you think he was afraid of?"
    ],
    "status": "pending"
}

// Optional thematic exploration
{
    "requirement_id": "req-003",
    "storyteller_id": "user-123",
    "requirement_type": "thematic_exploration",
    "priority": "optional",
    "collection_id": "col-military-service",
    "archetype_lane": "relationship_to_meaning",
    "archetype_refinement_purpose": "validate",
    "requirement_description": "Could explore how military service shaped values - mentioned briefly but not developed",
    "why_important": "Adds depth to meaning-making archetype if storyteller wants to explore",
    "suggested_prompts": [
        "How did military service change what you value?",
        "What lessons from that time still guide you today?"
    ],
    "status": "pending"
}

// CRITICAL: Discriminating requirement (archetype refinement)
{
    "requirement_id": "req-004",
    "storyteller_id": "user-123",
    "requirement_type": "emotional_context",
    "priority": "critical",
    "section_id": "early_adulthood",
    "life_event_id": "evt-father-departure",
    "archetype_lane": "discriminating",
    "archetype_refinement_purpose": "discriminate",
    "discriminates_between": ["relationship_to_loss", "relationship_to_agency"],
    "requirement_description": "Need to understand father's departure - is this primarily about grief/loss OR constrained agency?",
    "specific_gap": "Multiple archetypes viable - loss (0.78 confidence) vs agency (0.68 confidence). Need material that discriminates.",
    "why_important": "Critical for archetype resolution before composition. Must clarify whether story is fundamentally about loss or agency.",
    "suggested_prompts": [
        "When you think about your father leaving, what do you feel most - the absence of him, or what you couldn't do because he left?",
        "Looking back, did his leaving feel like something was taken from you, or like your choices were taken from you?",
        "What changed most after he left - who was around you, or what you could do?"
    ],
    "expected_archetype_outcomes": {
        "if_loss_dominant": "Focus on emptiness, missing him, grief, what was lost permanently",
        "if_agency_dominant": "Focus on constraints, forced changes, lost autonomy, lack of choice in what happened next"
    },
    "status": "pending"
}
```

---

### edit_requirement
Composition quality requirements lodged by Editor Flow and addressed by Composition Subflow.

**Purpose**: Track issues in composed chapters (flow, pacing, clarity, consistency, sensory detail, theme) that need revision before approval.

**Flow Integration**:
- **Editor Flow** reviews chapter → lodges edit requirements
- **Composition Subflow** addresses requirements → creates revised chapter
- **Editor Flow** reviews again → resolves or lodges new requirements
- Iterative refinement until all blocking/important requirements resolved

```sql
CREATE TABLE edit_requirement (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID REFERENCES story(id) ON DELETE CASCADE,
    storyteller_id UUID REFERENCES storyteller(id) ON DELETE CASCADE,

    -- Scope of edit
    chapter_id UUID REFERENCES story_chapter(id),           -- Specific chapter (null if whole-story issue)
    section_id UUID REFERENCES chapter_section(id),         -- Specific section within chapter (optional)
    character_id UUID REFERENCES story_character(id),       -- Character consistency issue (optional)
    theme_id UUID REFERENCES story_theme(id),               -- Theme issue (optional)

    -- Issue classification
    issue_type VARCHAR(50) NOT NULL,        -- 'flow', 'pacing', 'clarity', 'consistency',
                                            -- 'sensory_detail', 'theme', 'character_voice',
                                            -- 'timeline', 'tone', 'scene_structure',
                                            -- 'showing_vs_telling', 'repetition'

    -- Severity
    severity VARCHAR(20) NOT NULL,          -- 'blocking', 'important', 'polish'
                                            -- blocking: prevents approval
                                            -- important: should be fixed but not blocking
                                            -- polish: nice to have improvements

    -- Issue details
    specific_concern TEXT NOT NULL,         -- What specifically is the problem
    why_problematic TEXT,                   -- Why this is an issue (impact on reader)
    suggested_approach TEXT,                -- How to address this

    example_text TEXT,                      -- Excerpt showing the issue
    line_numbers VARCHAR(50),               -- Where in the chapter (e.g., "45-52")

    -- Craft standards
    craft_standard_violated VARCHAR(100),   -- e.g., "scene_to_summary_ratio", "sensory_immersion"
    target_metric VARCHAR(100),             -- e.g., "70% scene", "all 5 senses present"
    current_metric VARCHAR(100),            -- e.g., "40% scene", "only visual and auditory"

    -- Priority
    priority_order INTEGER,                 -- Order in which to address (1 = first)

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- 'pending', 'in_review', 'resolved',
                                                     -- 'wont_fix', 'obsolete'

    -- Lifecycle tracking
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by VARCHAR(50) NOT NULL DEFAULT 'editor_flow',

    in_review_at TIMESTAMP,                 -- When Composition Subflow started addressing
    in_review_by VARCHAR(50),               -- Which flow/agent is working on it

    resolved_at TIMESTAMP,
    resolved_by VARCHAR(50),
    resolution_notes TEXT,                  -- How it was fixed

    wont_fix_at TIMESTAMP,
    wont_fix_reason TEXT,                   -- Why we're not fixing this

    obsolete_at TIMESTAMP,
    obsolete_reason TEXT,                   -- Why this is no longer relevant

    -- User involvement
    user_notified BOOLEAN DEFAULT false,    -- Was storyteller told about this issue
    user_priority_override VARCHAR(20),     -- User can override priority
    user_agrees_with_edit BOOLEAN,          -- User's perspective on the edit

    -- Revision tracking
    original_draft_version INTEGER,         -- Which draft version had this issue
    resolved_in_draft_version INTEGER,      -- Which draft version resolved it

    -- Metadata
    metadata JSONB,
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_edit_requirement_story_severity ON edit_requirement(story_id, severity, status);
CREATE INDEX idx_edit_requirement_chapter ON edit_requirement(chapter_id, status);
CREATE INDEX idx_edit_requirement_status ON edit_requirement(status, severity);
CREATE INDEX idx_edit_requirement_issue_type ON edit_requirement(issue_type, severity);
CREATE INDEX idx_edit_requirement_priority ON edit_requirement(story_id, priority_order);
```

**Example Edit Requirements**:

```json
// Blocking: Poor pacing (too much summary)
{
    "edit_id": "edit-001",
    "story_id": "story-456",
    "chapter_id": "chapter-03",
    "issue_type": "pacing",
    "severity": "blocking",
    "specific_concern": "Chapter 3 is 80% summary, needs more scene work. The confrontation with father is told, not shown.",
    "why_problematic": "Reader can't experience the confrontation - it's too distant and abstract. Loses emotional impact.",
    "suggested_approach": "Expand the confrontation into a full scene with dialogue, setting, and sensory details. Cut some of the summary about 'those years' to make room.",
    "example_text": "Over the next few years, we argued constantly. He never understood my choices...",
    "line_numbers": "45-78",
    "craft_standard_violated": "scene_to_summary_ratio",
    "target_metric": "70% scene",
    "current_metric": "20% scene",
    "priority_order": 1,
    "status": "pending"
}

// Important: Character inconsistency
{
    "edit_id": "edit-002",
    "story_id": "story-456",
    "chapter_id": "chapter-07",
    "character_id": "char-mother",
    "issue_type": "character_voice",
    "severity": "important",
    "specific_concern": "Mother's dialogue in Chapter 7 doesn't match her established voice from Chapters 2-4. She's suddenly formal and distant.",
    "why_problematic": "Breaks character consistency, confuses reader about mother's personality",
    "suggested_approach": "Review mother's dialogue in earlier chapters and adjust Chapter 7 dialogue to match her warmth and directness",
    "example_text": "'I suppose that would be acceptable,' she said coolly.",
    "line_numbers": "112",
    "craft_standard_violated": "character_consistency",
    "priority_order": 2,
    "status": "pending"
}

// Important: Missing sensory detail
{
    "edit_id": "edit-003",
    "story_id": "story-456",
    "chapter_id": "chapter-05",
    "section_id": "section-05-02",
    "issue_type": "sensory_detail",
    "severity": "important",
    "specific_concern": "Hospital scene has only visual details - missing sound, smell, tactile that would make it immersive",
    "why_problematic": "Hospital is a pivotal scene for loss archetype - needs full sensory immersion to create emotional impact",
    "suggested_approach": "Add: sounds (monitors beeping, footsteps, whispers), smells (antiseptic, coffee), tactile (cold chair, rough tissue)",
    "craft_standard_violated": "sensory_immersion",
    "target_metric": "all 5 senses present",
    "current_metric": "only visual present",
    "priority_order": 3,
    "status": "pending"
}

// Polish: Theme could be stronger
{
    "edit_id": "edit-004",
    "story_id": "story-456",
    "chapter_id": "chapter-09",
    "theme_id": "theme-resilience",
    "issue_type": "theme",
    "severity": "polish",
    "specific_concern": "Resilience theme present but could be more prominent - opportunity to weave in the 'oak tree' motif mentioned in Chapter 3",
    "why_problematic": "Missed opportunity to strengthen thematic coherence",
    "suggested_approach": "Reference the oak tree motif when describing protagonist's strength in this chapter",
    "priority_order": 10,
    "status": "pending"
}
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
    ├── requirement (1:many)
    │   └── Story capture requirements (gaps to address)
    │
    ├── edit_requirement (1:many)
    │   └── Composition quality requirements
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
    ├── storyteller_section_status (1:many)
    └── requirement (1:many)
        └── Requirements for specific sections

life_event
    └── requirement (1:many)
        └── Requirements related to specific events

collection
    └── requirement (1:many)
        └── Requirements for collection enhancement

session
    └── requirement (1:many)
        └── Requirements addressed in session

story
    └── edit_requirement (1:many)
        └── Quality issues to address

story_chapter
    └── edit_requirement (1:many)
        └── Chapter-specific issues

story_character
    └── edit_requirement (1:many)
        └── Character consistency issues

story_theme
    └── edit_requirement (1:many)
        └── Theme strengthening opportunities
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

### 9. Analyst Flow Lodges Requirements

```python
def analyst_flow_assess_gaps(storyteller_id, section_id):
    """
    Analyst Flow identifies gaps and lodges requirements
    """
    # Get section material
    section_events = get_section_events(storyteller_id, section_id)
    section_artifacts = get_section_artifacts(storyteller_id, section_id)

    # Analyze for gaps (simplified - real implementation uses AI)
    gaps = []

    # Check sensory details
    for event in section_events:
        scenes = get_event_scenes(event.id)
        for scene in scenes:
            senses_present = analyze_sensory_details(scene)
            if len(senses_present) < 3:  # Less than 3 senses
                gaps.append({
                    'type': 'sensory_detail',
                    'priority': 'critical',
                    'life_event_id': event.id,
                    'description': f"Scene '{scene.name}' needs more sensory details",
                    'specific_gap': f"Only {', '.join(senses_present)} present",
                    'suggested_prompts': generate_sensory_prompts(scene, senses_present)
                })

    # Check character development
    characters = get_section_characters(section_id)
    for character in characters:
        if not character.has_motivation:
            gaps.append({
                'type': 'character_insight',
                'priority': 'important',
                'description': f"{character.name}'s motivations are unclear",
                'specific_gap': "We know WHAT they did, but not WHY",
                'suggested_prompts': [
                    f"What do you think was driving {character.name}?",
                    f"Had {character.name} ever explained why?"
                ]
            })

    # Lodge requirements
    for gap in gaps:
        create_requirement(
            storyteller_id=storyteller_id,
            requirement_type=gap['type'],
            priority=gap['priority'],
            section_id=section_id,
            life_event_id=gap.get('life_event_id'),
            requirement_description=gap['description'],
            specific_gap=gap['specific_gap'],
            suggested_prompts=gap['suggested_prompts'],
            status='pending',
            created_by='analyst_flow'
        )

    return gaps
```

### 10. Session Flow Addresses Requirements

```python
def session_flow_prepare_prompts(session_id):
    """
    Session Flow fetches requirements and generates prompts
    """
    session = get_session(session_id)
    section = get_session_section(session_id)

    # Get pending requirements for this section
    requirements = get_requirements(
        storyteller_id=session.storyteller_id,
        section_id=section.id,
        status='pending',
        order_by='priority DESC'  # Critical first
    )

    # Generate prompts from requirements
    prompts = []
    for req in requirements[:3]:  # Top 3 requirements
        if req.suggested_prompts:
            prompts.extend(req.suggested_prompts)

        # Mark as in-progress
        update_requirement(
            req.id,
            status='in_progress',
            addressed_at=now(),
            addressed_in_session_id=session_id
        )

    return prompts
```

### 11. Session Flow Marks Requirements Addressed

```python
def post_call_mark_requirements_addressed(session_id):
    """
    After session, mark requirements as addressed
    """
    # Get requirements that were in-progress for this session
    requirements = get_requirements(
        addressed_in_session_id=session_id,
        status='in_progress'
    )

    # Get session artifacts
    artifacts = get_session_artifacts(session_id)

    for req in requirements:
        # Check if requirement was addressed
        addressed = False

        if req.requirement_type == 'sensory_detail':
            # Check if new sensory details were captured
            for artifact in artifacts:
                if artifact.life_event_id == req.life_event_id:
                    senses = analyze_sensory_details(artifact.content)
                    if len(senses) >= 3:
                        addressed = True
                        break

        elif req.requirement_type == 'character_insight':
            # Check if character motivation was explored
            for artifact in artifacts:
                if 'motivation' in artifact.tags or 'why' in artifact.content.lower():
                    addressed = True
                    break

        # Update status
        if addressed:
            update_requirement(
                req.id,
                status='addressed',
                addressed_at=now()
            )
        else:
            # Return to pending
            update_requirement(
                req.id,
                status='pending',
                addressed_at=None,
                addressed_in_session_id=None
            )
```

### 12. Analyst Flow Resolves Requirements

```python
def analyst_flow_validate_requirements_resolved(storyteller_id):
    """
    Analyst Flow checks if addressed requirements are actually resolved
    """
    # Get addressed requirements
    requirements = get_requirements(
        storyteller_id=storyteller_id,
        status='addressed'
    )

    for req in requirements:
        # Re-analyze to confirm resolution
        if req.requirement_type == 'sensory_detail':
            event = get_life_event(req.life_event_id)
            scenes = get_event_scenes(event.id)

            for scene in scenes:
                senses_present = analyze_sensory_details(scene)
                if len(senses_present) >= 4:  # Higher bar for resolution
                    update_requirement(
                        req.id,
                        status='resolved',
                        resolved_at=now(),
                        resolved_by='analyst_flow',
                        resolution_notes=f"Scene now has {len(senses_present)} senses: {', '.join(senses_present)}"
                    )
                    break

        elif req.requirement_type == 'character_insight':
            # Check if character now has clear motivation
            character_details = get_character_details_from_events(req.life_event_id)
            if character_details.has_motivation:
                update_requirement(
                    req.id,
                    status='resolved',
                    resolved_at=now(),
                    resolved_by='analyst_flow',
                    resolution_notes="Character motivation now clear"
                )
```

### 13. Editor Flow Lodges Edit Requirements

```python
def editor_flow_review_chapter(chapter_id):
    """
    Editor Flow reviews chapter and lodges edit requirements
    """
    chapter = get_chapter(chapter_id)

    # Assess chapter quality
    assessment = assess_chapter_quality(chapter)

    # Lodge edit requirements for issues
    if assessment['scene_to_summary_ratio'] < 0.70:  # Less than 70% scene
        create_edit_requirement(
            story_id=chapter.story_id,
            storyteller_id=chapter.storyteller_id,
            chapter_id=chapter.id,
            issue_type='pacing',
            severity='blocking',
            specific_concern=f"Chapter is only {assessment['scene_to_summary_ratio']*100}% scene, needs more scene work",
            why_problematic="Reader can't experience the moments - too much summary",
            suggested_approach="Expand key moments into full scenes with dialogue and sensory details",
            craft_standard_violated='scene_to_summary_ratio',
            target_metric='70% scene',
            current_metric=f"{assessment['scene_to_summary_ratio']*100}% scene",
            priority_order=1,
            status='pending'
        )

    # Check character consistency
    characters = get_chapter_characters(chapter.id)
    for character in characters:
        voice_consistency = check_character_voice(character, chapter)
        if voice_consistency < 0.8:  # Inconsistent
            create_edit_requirement(
                story_id=chapter.story_id,
                chapter_id=chapter.id,
                character_id=character.id,
                issue_type='character_voice',
                severity='important',
                specific_concern=f"{character.name}'s voice in this chapter doesn't match earlier chapters",
                why_problematic="Breaks character consistency, confuses reader",
                suggested_approach=f"Review {character.name}'s dialogue in earlier chapters and adjust",
                craft_standard_violated='character_consistency',
                priority_order=2,
                status='pending'
            )

    # Check sensory immersion
    for section in get_chapter_sections(chapter.id):
        if section.section_type == 'scene':
            scene = get_story_scene(section.id)
            senses = count_sensory_details(scene)
            if senses < 3:
                create_edit_requirement(
                    story_id=chapter.story_id,
                    chapter_id=chapter.id,
                    section_id=section.id,
                    issue_type='sensory_detail',
                    severity='important',
                    specific_concern=f"Scene '{section.title}' only has {senses} senses present",
                    why_problematic="Scene lacks immersion, reader can't fully experience it",
                    suggested_approach="Add missing sensory details",
                    craft_standard_violated='sensory_immersion',
                    target_metric='all 5 senses present',
                    current_metric=f"{senses} senses present",
                    priority_order=3,
                    status='pending'
                )

    # Determine chapter status
    blocking_issues = count_edit_requirements(chapter.id, severity='blocking')
    if blocking_issues > 0:
        update_chapter(chapter.id, status='needs_revision')
    else:
        update_chapter(chapter.id, status='approved')
```

### 14. Composition Flow Addresses Edit Requirements

```python
def composition_flow_revise_chapter(chapter_id):
    """
    Composition Subflow addresses edit requirements
    """
    chapter = get_chapter(chapter_id)

    # Get pending edit requirements (ordered by priority)
    edit_reqs = get_edit_requirements(
        chapter_id=chapter_id,
        status='pending',
        order_by='priority_order ASC'
    )

    # Address each requirement
    for req in edit_reqs:
        # Mark as in-review
        update_edit_requirement(
            req.id,
            status='in_review',
            in_review_at=now(),
            in_review_by='composition_subflow'
        )

        # Apply fix based on issue type
        if req.issue_type == 'pacing':
            # Expand summary into scenes
            expand_summary_to_scenes(chapter, req)

        elif req.issue_type == 'sensory_detail':
            # Add missing sensory details
            enhance_sensory_details(req.section_id, req)

        elif req.issue_type == 'character_voice':
            # Fix character dialogue
            adjust_character_dialogue(chapter, req.character_id, req)

        # Mark as resolved
        update_edit_requirement(
            req.id,
            status='resolved',
            resolved_at=now(),
            resolved_by='composition_subflow',
            resolved_in_draft_version=chapter.current_draft_version + 1
        )

    # Create new draft version
    create_story_draft(
        story_id=chapter.story_id,
        draft_version=chapter.current_draft_version + 1,
        draft_type='revision',
        content_snapshot=serialize_chapter(chapter)
    )

    # Trigger Editor Flow for re-review
    trigger_editor_flow_review(chapter.id)
```

### 15. Tracking Overall Progress

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

### 16. Multi-Archetype Refinement (Analyst Flow Strategy)

```python
def archetype_assessment_with_refinement(storyteller_id):
    """
    Periodic archetype re-analysis with multi-archetype tracking and refinement
    Runs every 3 sessions during story capture phase
    """
    previous = get_latest_archetype_analysis(storyteller_id)
    all_material = get_all_storyteller_material(storyteller_id)

    # Analyze material for multiple archetype patterns
    candidates = analyze_multiple_archetypes(all_material)
    # Returns: [
    #   {"archetype": "relationship_to_loss", "confidence": 0.78, "evidence": [...]},
    #   {"archetype": "relationship_to_agency", "confidence": 0.62, "evidence": [...]},
    #   {"archetype": "identity_shift", "confidence": 0.35, "evidence": [...]}
    # ]

    # Determine refinement status
    active_candidates = [c for c in candidates if c['confidence'] > 0.60]
    top_confidence = max([c['confidence'] for c in candidates])

    if len(active_candidates) >= 3:
        refinement_status = 'exploring'  # Still unclear
    elif len(active_candidates) == 2:
        refinement_status = 'narrowing'  # Between two strong contenders
    elif len(active_candidates) == 1 and top_confidence >= 0.85:
        refinement_status = 'resolved'   # Clear winner
        dominant = next(c for c in candidates if c['confidence'] >= 0.85)
    else:
        refinement_status = 'narrowing'  # Getting closer

    # Create new archetype analysis record
    analysis = create_archetype_analysis(
        storyteller_id=storyteller_id,
        analysis_number=previous.analysis_number + 1 if previous else 1,
        candidate_archetypes=candidates,
        dominant_archetype=dominant['archetype'] if refinement_status == 'resolved' else None,
        dominant_confidence=dominant['confidence'] if refinement_status == 'resolved' else None,
        refinement_status=refinement_status,
        previous_analysis_id=previous.id if previous else None,
        revealed_to_user=False  # Still hidden observer
    )

    return {
        'analysis_id': analysis.id,
        'status': refinement_status,
        'candidates': candidates
    }


def analyst_flow_archetype_aware_requirements(storyteller_id):
    """
    Analyst lodges requirements that help refine which archetype is most apt
    Called after archetype assessment to guide next sessions strategically
    """
    archetype_analysis = get_latest_archetype_analysis(storyteller_id)

    if archetype_analysis.refinement_status == 'exploring':
        # Multiple archetypes possible - lodge discriminating requirements

        candidates = archetype_analysis.candidate_archetypes
        top_two = get_top_candidates(candidates, limit=2)
        # Example: loss (0.72) vs agency (0.68)

        # Find pivotal event that could discriminate
        pivotal_events = identify_pivotal_events(storyteller_id, top_two)

        for event in pivotal_events:
            create_requirement(
                storyteller_id=storyteller_id,
                requirement_type='emotional_context',
                priority='critical',
                life_event_id=event.id,
                archetype_lane='discriminating',
                archetype_refinement_purpose='discriminate',
                discriminates_between=[top_two[0]['archetype'], top_two[1]['archetype']],
                requirement_description=generate_discriminating_description(event, top_two),
                suggested_prompts=generate_discriminating_prompts(event, top_two),
                expected_archetype_outcomes=generate_expected_outcomes(event, top_two),
                status='pending',
                created_by='analyst_flow'
            )

        # Update analysis to track discriminating requirements
        update_archetype_analysis(
            archetype_analysis.id,
            discriminating_requirements_lodged=len(pivotal_events)
        )

    elif archetype_analysis.refinement_status == 'narrowing':
        # Strong evidence for 1-2 archetypes - validate with targeted requirements

        for candidate in archetype_analysis.candidate_archetypes:
            if candidate['status'] == 'active' and candidate['confidence'] > 0.70:
                # Lodge validating requirements
                create_requirement(
                    storyteller_id=storyteller_id,
                    requirement_type='thematic_exploration',
                    priority='important',
                    archetype_lane=candidate['archetype'],
                    archetype_refinement_purpose='validate',
                    requirement_description=f"Validate {candidate['archetype']} - need more evidence",
                    suggested_prompts=generate_validation_prompts(candidate),
                    status='pending',
                    created_by='analyst_flow'
                )

    elif archetype_analysis.refinement_status == 'resolved':
        # Single archetype confirmed - strengthen with depth requirements

        dominant = archetype_analysis.dominant_archetype
        create_requirement(
            storyteller_id=storyteller_id,
            requirement_type='thematic_exploration',
            priority='important',
            archetype_lane=dominant,
            archetype_refinement_purpose='strengthen',
            requirement_description=f"Deepen {dominant} archetype with more nuanced material",
            suggested_prompts=generate_strengthening_prompts(dominant),
            status='pending',
            created_by='analyst_flow'
        )


def check_composition_readiness_archetype_gate(storyteller_id):
    """
    BLOCKING GATE: Cannot proceed to composition without resolved archetype
    This is a sufficiency gate that must pass before Editor Flow can begin
    """
    archetype_analysis = get_latest_archetype_analysis(storyteller_id)

    # GATE 1: Must have resolved archetype
    if archetype_analysis.refinement_status != 'resolved':
        return {
            'ready': False,
            'gate': 'archetype_resolution',
            'blocking_issue': 'archetype_not_resolved',
            'message': 'Multiple archetypes still viable - need more material to clarify story pattern',
            'candidates': archetype_analysis.candidate_archetypes,
            'action': 'Lodge discriminating requirements to help refine archetype'
        }

    # GATE 2: Must have high confidence (>= 0.85)
    if archetype_analysis.dominant_confidence < 0.85:
        return {
            'ready': False,
            'gate': 'archetype_confidence',
            'blocking_issue': 'archetype_confidence_low',
            'message': f"Dominant archetype confidence only {archetype_analysis.dominant_confidence} - need 0.85+",
            'dominant': archetype_analysis.dominant_archetype,
            'confidence': archetype_analysis.dominant_confidence,
            'action': 'Lodge validating requirements to strengthen confidence'
        }

    # GATE 3: If revealed, must be user-confirmed
    if archetype_analysis.revealed_to_user and not archetype_analysis.user_confirmed:
        return {
            'ready': False,
            'gate': 'user_confirmation',
            'blocking_issue': 'archetype_not_confirmed',
            'message': 'User has not confirmed identified archetype',
            'dominant': archetype_analysis.dominant_archetype,
            'action': 'Await user confirmation or pivot based on feedback'
        }

    # ALL GATES PASSED: Ready for composition
    return {
        'ready': True,
        'dominant_archetype': archetype_analysis.dominant_archetype,
        'confidence': archetype_analysis.dominant_confidence,
        'message': 'Archetype resolved and confirmed - ready for composition'
    }
```

---

## Design Principles

1. **Progress visibility** - Clear tracking of journey through process
2. **Flexible section management** - Supports progressive unlocking
3. **Requirements-driven execution** - Gaps identified → requirements lodged → sessions address → flows validate
4. **Archetype refinement** - Multi-archetype tracking with progressive refinement (exploring → narrowing → resolved)
5. **Strategic requirements** - Analyst lodges discriminating requirements to clarify archetype pattern
6. **Archetype gate** - Resolved archetype (confidence >= 0.85) required before composition
7. **Quality gates** - Edit requirements prevent progression until resolved
8. **Learning loop** - Centralized feedback improves system
9. **Agent reusability** - Agent definitions used across storytellers
10. **Export management** - Professional manuscript generation
11. **Scope-driven** - Formal scope definitions drive system behavior
12. **Flow orchestration** - Analyst → Session → Analyst loop, Editor → Composition → Editor loop

---

## Questions to Resolve

1. **Progress calculation** - Is the weighted formula appropriate, or different logic?
2. **Section prerequisites** - Should we support complex prerequisite logic (AND/OR conditions)?
3. **Archetype reanalysis** - How often should we reanalyze as more material is added?
4. **Feedback response time** - SLA for responding to critical feedback?
5. **Agent instance cleanup** - When do we archive completed agent instances?
6. **Export expiry** - How long should exports remain available?
7. **Progress phases** - Are the canonical phases from process.txt the right granularity?
8. **Requirements prioritization** - How to balance critical vs. important vs. optional requirements across sections?
9. **Requirements lifecycle** - When should requirements be marked obsolete vs. deferred?
10. **Edit requirement thresholds** - What exact metrics define blocking vs. important severity?
11. **User notification** - Should users be notified about requirements, or are they internal guidance only?
12. **Requirements dashboard** - Should storytellers see their requirements on a dashboard for transparency?
13. **Batch requirement resolution** - Should Analyst Flow batch-assess after multiple sessions or after each session?
14. **Edit iteration limits** - How many Editor → Composition cycles before escalating to manual review?
