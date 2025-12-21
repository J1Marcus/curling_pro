# Session Schema

## Design Philosophy
- **Goal-oriented**: Each session has clear intention and success criteria
- **Discrete exchanges**: Sessions are bounded interactions, not continuous
- **Multi-event**: Sessions can span multiple life events (many-to-many)
- **Schedulable**: Sessions can be planned in advance
- **Summarizable**: Each session produces a summary of what was accomplished
- **Process-aware**: Sessions track position in the overall process flow

---

## Core Tables

### session
Discrete goal-oriented exchanges between storyteller and agent.

```sql
CREATE TABLE session (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Relationships
    storyteller_id UUID REFERENCES storyteller(id) ON DELETE CASCADE,
    process_version_id UUID REFERENCES process_version(id),
    current_process_node_id UUID REFERENCES process_node(id),

    -- Session definition
    session_name VARCHAR(200),           -- "Childhood memories capture", "Military service deep dive"
    intention TEXT NOT NULL,             -- What we're trying to accomplish

    -- Success & completion criteria
    success_indicators JSONB,            -- Array of success criteria
                                         -- e.g., ["Captured 3+ specific scenes", "Identified key people"]

    completion_indicators JSONB,         -- Array of completion criteria
                                         -- e.g., ["All major milestones covered", "Storyteller feels complete"]

    -- Constraints & guidance
    constraints TEXT[],                  -- Guardrails, boundaries, things to avoid
                                         -- e.g., ["Don't rush trauma topics", "Respect time limit"]

    procedure_notes TEXT,                -- Optional guidance on how to conduct session

    -- Scheduling
    scheduled_at TIMESTAMP,              -- When session is planned
    scheduled_duration_minutes INTEGER,  -- Expected length

    -- Actual timing
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    actual_duration_minutes INTEGER,

    -- Status
    status VARCHAR(50) DEFAULT 'scheduled', -- 'scheduled', 'in_progress', 'completed',
                                            -- 'cancelled', 'paused'

    -- Outcomes
    summary TEXT,                        -- Post-session summary of what was accomplished
    success_rating INTEGER,              -- 1-5 scale, how well did it go
    completion_percentage INTEGER,       -- 0-100, how complete is the goal

    -- Next steps
    needs_followup BOOLEAN DEFAULT false,
    followup_notes TEXT,
    next_session_suggestion TEXT,

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_session_storyteller ON session(storyteller_id, status);
CREATE INDEX idx_session_scheduled ON session(scheduled_at);
CREATE INDEX idx_session_status ON session(status);
```

---

## Session Relationships

### session_life_event
Many-to-many relationship between sessions and life events.

```sql
CREATE TABLE session_life_event (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES session(id) ON DELETE CASCADE,
    life_event_id UUID REFERENCES life_event(id) ON DELETE CASCADE,

    -- Relationship context
    is_primary_focus BOOLEAN DEFAULT false,  -- Main event for this session
    coverage_level VARCHAR(50),              -- 'introduction', 'exploration', 'deep_dive', 'completion'

    -- Progress tracking
    prompts_completed INTEGER DEFAULT 0,
    notes TEXT,                              -- Session-specific notes about this event

    created_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(session_id, life_event_id)
);

CREATE INDEX idx_session_life_event_session ON session_life_event(session_id);
CREATE INDEX idx_session_life_event_event ON session_life_event(life_event_id);
```

---

## Session Content

### session_interaction
Individual exchanges within a session (agent prompts and storyteller responses).

```sql
CREATE TABLE session_interaction (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES session(id) ON DELETE CASCADE,
    life_event_id UUID REFERENCES life_event(id) ON DELETE SET NULL,

    -- Interaction sequence
    interaction_sequence INTEGER NOT NULL,   -- Order within session

    -- Content
    interaction_type VARCHAR(50),            -- 'prompt', 'response', 'clarification', 'reflection'

    -- Agent side
    agent_prompt TEXT,                       -- What the agent asked/said
    prompt_category VARCHAR(100),            -- 'scene', 'people', 'tension', 'change', 'meaning'

    -- Storyteller side
    storyteller_response TEXT,               -- What the storyteller said/wrote
    response_method VARCHAR(50),             -- 'text', 'voice', 'skip'

    -- Analysis
    sentiment VARCHAR(50),                   -- 'positive', 'neutral', 'difficult', 'emotional'
    key_themes TEXT[],                       -- Extracted themes
    mentions_people TEXT[],                  -- People mentioned in this interaction
    mentions_places TEXT[],                  -- Places mentioned

    -- Metadata
    duration_seconds INTEGER,                -- How long this interaction took
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_session_interaction_session ON session_interaction(session_id, interaction_sequence);
CREATE INDEX idx_session_interaction_event ON session_interaction(life_event_id);
```

### session_artifact
Outputs and artifacts created during the session.

```sql
CREATE TABLE session_artifact (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES session(id) ON DELETE CASCADE,
    life_event_id UUID REFERENCES life_event(id) ON DELETE SET NULL,

    -- Artifact details
    artifact_type VARCHAR(50),               -- 'scene_capture', 'timeline_entry', 'relationship_mapping',
                                             -- 'draft_paragraph', 'photo_annotation'

    artifact_name VARCHAR(200),
    content TEXT,                            -- The actual artifact content
    structured_data JSONB,                   -- If artifact has structured components

    -- Status
    is_provisional BOOLEAN DEFAULT true,     -- Not yet confirmed by storyteller
    is_approved BOOLEAN DEFAULT false,
    approved_at TIMESTAMP,

    -- Usage
    included_in_synthesis BOOLEAN DEFAULT false,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_session_artifact_session ON session_artifact(session_id);
CREATE INDEX idx_session_artifact_type ON session_artifact(artifact_type);
```

---

## Session Planning & Scheduling

### session_template
Reusable session templates for common goals.

```sql
CREATE TABLE session_template (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    process_version_id UUID REFERENCES process_version(id) ON DELETE CASCADE,

    -- Template definition
    template_name VARCHAR(200) NOT NULL,     -- "Childhood exploration", "Trauma gentle approach"
    template_description TEXT,

    -- Suggested for
    suggested_for_event_types TEXT[],        -- Which life event types this works well for
    suggested_for_process_nodes UUID[],      -- Which process nodes this aligns with

    -- Template content (defaults for new sessions)
    default_intention TEXT,
    default_success_indicators JSONB,
    default_completion_indicators JSONB,
    default_constraints TEXT[],
    default_procedure_notes TEXT,
    default_duration_minutes INTEGER,

    -- Metadata
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### session_note
Additional notes and observations during/after session.

```sql
CREATE TABLE session_note (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES session(id) ON DELETE CASCADE,

    -- Note details
    note_type VARCHAR(50),                   -- 'observation', 'concern', 'insight', 'technical'
    note_content TEXT NOT NULL,

    -- Context
    noted_at_interaction_sequence INTEGER,   -- Which interaction prompted this note

    -- Flagging
    is_important BOOLEAN DEFAULT false,
    requires_followup BOOLEAN DEFAULT false,

    -- Attribution
    noted_by VARCHAR(100),                   -- 'agent', 'system', 'user'

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_session_note_session ON session_note(session_id);
```

---

## Relationships Summary

```
session (discrete goal-oriented exchange)
    ├── storyteller (many:1)
    ├── process_version (many:1)
    ├── current_process_node (many:1)
    │
    ├── session_life_event (many:many join) → life_event
    │   └── Tracks which events are covered in this session
    │
    ├── session_interaction (1:many)
    │   └── Individual prompts and responses
    │
    ├── session_artifact (1:many)
    │   └── Outputs created during session
    │
    └── session_note (1:many)
        └── Observations and insights
```

---

## Usage Patterns

### 1. Creating a Scheduled Session

```python
# Create session for childhood exploration
session = create_session(
    storyteller_id=storyteller.id,
    process_version_id=active_process.id,
    current_process_node_id=capture_node.id,

    session_name="Childhood in Boston exploration",
    intention="Capture 3-5 specific childhood scenes with rich sensory details",

    success_indicators=[
        "Storyteller recalls specific moments, not generalizations",
        "At least 3 scenes captured with who/where/when details",
        "Key family members identified with descriptions"
    ],

    completion_indicators=[
        "Storyteller says they've covered the main memories",
        "We have enough material for a draft section",
        "No major gaps in the childhood period"
    ],

    constraints=[
        "Keep session to 30 minutes max",
        "Don't push on sensitive family topics without consent",
        "Allow storyteller to skip any question"
    ],

    procedure_notes="""
    1. Start with scene-setting (where did you live, what did it look like)
    2. Use photo if available to trigger memories
    3. Progress from general to specific
    4. End with reflection question
    """,

    scheduled_at=datetime(2024, 1, 15, 10, 0),
    scheduled_duration_minutes=30,
    status='scheduled'
)

# Link to relevant life events
link_session_to_event(session.id, childhood_event.id, is_primary_focus=True)
link_session_to_event(session.id, family_relationships_event.id)
```

### 2. Conducting a Session

```python
# Start session
start_session(session.id)
session.status = 'in_progress'
session.started_at = now()

# Interaction loop
for prompt_template in get_session_prompts(session.id):
    # Create interaction
    interaction = create_interaction(
        session_id=session.id,
        life_event_id=current_event.id,
        interaction_sequence=next_sequence(),
        interaction_type='prompt',
        agent_prompt=generate_prompt(prompt_template, storyteller_context)
    )

    # Get storyteller response
    response = await get_storyteller_response(interaction.id)

    # Update interaction with response
    update_interaction(
        interaction.id,
        storyteller_response=response.text,
        response_method=response.method,
        sentiment=analyze_sentiment(response.text),
        key_themes=extract_themes(response.text),
        duration_seconds=response.duration
    )

    # Create artifacts if applicable
    if is_scene_capture(response):
        create_artifact(
            session_id=session.id,
            life_event_id=current_event.id,
            artifact_type='scene_capture',
            content=response.text,
            is_provisional=True
        )

    # Check completion criteria
    if check_completion_indicators(session.id):
        break

# End session
end_session(session.id)
session.status = 'completed'
session.ended_at = now()
session.actual_duration_minutes = calculate_duration()
```

### 3. Post-Session Summary

```python
def generate_session_summary(session_id):
    session = get_session(session_id)
    interactions = get_session_interactions(session_id)
    artifacts = get_session_artifacts(session_id)
    life_events = get_session_life_events(session_id)

    summary = f"""
    Session: {session.session_name}
    Duration: {session.actual_duration_minutes} minutes

    Goal: {session.intention}

    What was covered:
    - {len(life_events)} life events explored
    - {len(interactions)} interactions
    - {len(artifacts)} artifacts created

    Key accomplishments:
    {analyze_against_success_indicators(session, artifacts)}

    Themes that emerged:
    {extract_session_themes(interactions)}

    Next steps:
    {generate_followup_recommendations(session, life_events)}
    """

    update_session(session_id, summary=summary)
    return summary
```

### 4. Multi-Session Life Event Coverage

```python
def plan_sessions_for_event(life_event_id):
    """
    A complex life event might need multiple sessions
    """
    event = get_life_event(life_event_id)

    # Session 1: Introduction and timeline
    session_1 = create_session(
        intention=f"Establish timeline and key facts for {event.event_name}",
        success_indicators=["Basic timespan identified", "Major milestones noted"],
        scheduled_duration_minutes=20
    )
    link_session_to_event(session_1.id, life_event_id, coverage_level='introduction')

    # Session 2: Deep dive on specific aspects
    session_2 = create_session(
        intention=f"Capture rich scenes and emotional experiences from {event.event_name}",
        success_indicators=["3+ detailed scenes", "Key people described"],
        scheduled_duration_minutes=45
    )
    link_session_to_event(session_2.id, life_event_id, coverage_level='deep_dive')

    # Session 3: Reflection and meaning
    session_3 = create_session(
        intention=f"Explore what {event.event_name} meant and how it changed you",
        success_indicators=["Identified personal growth", "Connected to broader story"],
        scheduled_duration_minutes=30
    )
    link_session_to_event(session_3.id, life_event_id, coverage_level='completion')

    return [session_1, session_2, session_3]
```

### 5. Checking Session Progress

```python
def get_session_progress(session_id):
    session = get_session(session_id)

    # Check success indicators
    success_checks = []
    for indicator in session.success_indicators:
        is_met = evaluate_indicator(session_id, indicator)
        success_checks.append({
            'indicator': indicator,
            'met': is_met
        })

    # Check completion indicators
    completion_checks = []
    for indicator in session.completion_indicators:
        is_met = evaluate_indicator(session_id, indicator)
        completion_checks.append({
            'indicator': indicator,
            'met': is_met
        })

    return {
        'session_id': session_id,
        'status': session.status,
        'duration_so_far': calculate_duration(session),
        'interactions_count': count_interactions(session_id),
        'artifacts_count': count_artifacts(session_id),
        'success_indicators': success_checks,
        'completion_indicators': completion_checks,
        'can_complete': all(c['met'] for c in completion_checks)
    }
```

---

## Integration with Process Schema

Sessions operate within the context of the process flow:

```python
def initialize_session_from_process_node(storyteller_id, process_node_id):
    """
    When a storyteller reaches a process node, create a session for it
    """
    node = get_process_node(process_node_id)
    storyteller = get_storyteller(storyteller_id)

    session = create_session(
        storyteller_id=storyteller_id,
        process_version_id=node.process_version_id,
        current_process_node_id=process_node_id,

        session_name=f"{node.node_name} session",
        intention=node.agent_objective,  # Use node's objective as intention
        constraints=parse_constraints(node.agent_constraints),
        procedure_notes=node.user_facing_text,

        # Generate success/completion indicators from node
        success_indicators=generate_indicators_from_node(node),
        completion_indicators=generate_completion_from_node(node)
    )

    # Link to relevant life events based on scope
    relevant_events = get_relevant_life_events(storyteller_id, node)
    for event in relevant_events:
        link_session_to_event(session.id, event.id)

    return session
```

---

## Design Principles

1. **Goal-oriented** - Every session has clear intention and success criteria
2. **Measurable** - Success and completion indicators are explicit
3. **Bounded** - Sessions have defined start/end, not infinite conversations
4. **Multi-event** - Sessions can span multiple life events (childhood might touch family, education, friendships)
5. **Schedulable** - Can be planned in advance, supporting async workflows
6. **Summarizable** - Every session produces a summary artifact
7. **Progress-tracking** - Can measure how well session is going in real-time
8. **Template-driven** - Common session types can be templated and reused
9. **Process-aware** - Sessions know where they fit in the overall process
10. **Artifact-generating** - Sessions create tangible outputs (scenes, timelines, drafts)

---

## Questions to Resolve

1. **Session agent lifecycle** - Does each session spawn a new agent instance, or reuse?
2. **Session state persistence** - If paused, how do we resume with full context?
3. **Real-time vs async** - Do sessions require synchronous interaction, or can they be async?
4. **Session chaining** - Should sessions explicitly link to next/previous sessions?
5. **Automated scheduling** - Should system suggest next session based on completion?
6. **Session metrics** - What KPIs do we track across all sessions for a storyteller?
