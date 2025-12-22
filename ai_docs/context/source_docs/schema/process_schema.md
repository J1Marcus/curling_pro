# Process Management Schema

## Design Philosophy
- Process is data-driven and versionable
- Nodes define phases with specific behaviors
- Conditional logic determines what users see
- Sessions track progress through versioned processes

---

## Core Tables

### process_version
Versions of the entire process flow. Allows testing new flows without breaking active sessions.

```sql
CREATE TABLE process_version (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_name VARCHAR(100) NOT NULL,  -- e.g., "v1.0", "experimental-2024-12"
    description TEXT,
    is_active BOOLEAN DEFAULT false,     -- Only one active version at a time
    created_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);
```

### process_commitment
The non-negotiable design principles. Rarely change.

```sql
CREATE TABLE process_commitment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    process_version_id UUID REFERENCES process_version(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL,
    title VARCHAR(200) NOT NULL,         -- e.g., "Context before meaning"
    description TEXT NOT NULL,           -- Full explanation
    created_at TIMESTAMP DEFAULT NOW()
);
```

### process_node_type
Enum-like table defining node behavior patterns.

```sql
CREATE TABLE process_node_type (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type_name VARCHAR(50) UNIQUE NOT NULL,  -- 'informational', 'fork', 'data_collection', 'iterative', 'synthesis'
    description TEXT,
    requires_user_input BOOLEAN DEFAULT true,
    can_skip BOOLEAN DEFAULT false,
    is_repeatable BOOLEAN DEFAULT false
);
```

### process_node
Individual phases in the flow. The core building blocks.

```sql
CREATE TABLE process_node (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    process_version_id UUID REFERENCES process_version(id) ON DELETE CASCADE,
    node_type_id UUID REFERENCES process_node_type(id),
    node_key VARCHAR(100) NOT NULL,      -- e.g., "trust_setup", "scope_selection" (code-friendly)
    node_name VARCHAR(200) NOT NULL,     -- e.g., "Phase 1: Introduction & Trust Setup"
    order_index INTEGER NOT NULL,        -- Position in flow

    -- Core content
    purpose TEXT NOT NULL,               -- Why this phase exists
    outcome TEXT,                        -- What should be achieved
    user_facing_text TEXT,               -- What the user is told

    -- Behavior flags
    is_optional BOOLEAN DEFAULT false,
    requires_completion BOOLEAN DEFAULT true,

    -- Agent configuration
    agent_objective TEXT,                -- What the agent should accomplish
    agent_constraints TEXT,              -- Guardrails for the agent

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_process_node_version ON process_node(process_version_id, order_index);
```

### process_flow_edge
Defines the flow between nodes. Supports branching and conditional paths.

```sql
CREATE TABLE process_flow_edge (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    process_version_id UUID REFERENCES process_version(id) ON DELETE CASCADE,
    from_node_id UUID REFERENCES process_node(id) ON DELETE CASCADE,
    to_node_id UUID REFERENCES process_node(id) ON DELETE CASCADE,

    -- Conditional logic (optional)
    condition_type VARCHAR(50),          -- 'scope_match', 'profile_flag', 'always', 'section_selected'
    condition_value JSONB,               -- Flexible condition data

    order_index INTEGER,                 -- For multiple edges from same node
    edge_label VARCHAR(100),             -- e.g., "whole_life_path", "single_event_path"

    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Prompt Management

### process_prompt
Individual prompts within nodes. The questions asked to users.

```sql
CREATE TABLE process_prompt (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    process_node_id UUID REFERENCES process_node(id) ON DELETE CASCADE,

    prompt_key VARCHAR(100) NOT NULL,    -- e.g., "scene", "people", "tension"
    prompt_text TEXT NOT NULL,           -- The actual question
    prompt_type VARCHAR(50),             -- 'scene', 'people', 'tension', 'change', 'meaning'

    order_index INTEGER NOT NULL,
    is_required BOOLEAN DEFAULT false,
    is_sensitive BOOLEAN DEFAULT false,  -- Triggers tier check
    sensitivity_tier INTEGER,            -- 1=safe, 2=optional, 3=private

    -- Response handling
    response_format VARCHAR(50),         -- 'text', 'voice', 'checkbox', 'multi_select'
    max_length INTEGER,
    example_response TEXT,

    -- Conditional display
    condition_type VARCHAR(50),          -- 'profile_boundary', 'scope_match', 'section_active'
    condition_value JSONB,

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_process_prompt_node ON process_prompt(process_node_id, order_index);
```

### prompt_pack_template
Reusable prompt sequences (like the Scene-People-Tension-Change-Meaning pattern).

```sql
CREATE TABLE prompt_pack_template (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_name VARCHAR(100) NOT NULL,  -- e.g., "standard_scene_pack"
    description TEXT,
    is_global BOOLEAN DEFAULT true,       -- Can be used across multiple nodes
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE prompt_pack_prompt (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_pack_id UUID REFERENCES prompt_pack_template(id) ON DELETE CASCADE,
    prompt_key VARCHAR(100) NOT NULL,
    prompt_text TEXT NOT NULL,
    prompt_type VARCHAR(50),
    order_index INTEGER NOT NULL,
    is_required BOOLEAN DEFAULT false
);
```

---

## Section Management (Narrative Lanes)

### process_section
The narrative lanes users can work on (Origins, Childhood, Work & Purpose, etc.).

```sql
CREATE TABLE process_section (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    process_version_id UUID REFERENCES process_version(id) ON DELETE CASCADE,

    section_key VARCHAR(100) NOT NULL,   -- e.g., "origins", "childhood", "love_partnership"
    section_name VARCHAR(200) NOT NULL,  -- e.g., "Love & Partnership"
    description TEXT,

    order_index INTEGER,
    is_core BOOLEAN DEFAULT true,        -- Core vs conditional sections

    -- Conditional activation
    requires_scope VARCHAR(50),          -- 'whole_life', 'major_chapter', 'single_event', null=any
    requires_profile_flags JSONB,        -- e.g., {"has_children": true}

    -- Unlocking logic
    unlock_after_section_id UUID REFERENCES process_section(id),
    minimum_prompts_required INTEGER DEFAULT 0,  -- Progressive unlocking

    created_at TIMESTAMP DEFAULT NOW()
);
```

### section_prompt
Links prompts to sections. A section can have multiple prompt packs.

```sql
CREATE TABLE section_prompt (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID REFERENCES process_section(id) ON DELETE CASCADE,
    process_prompt_id UUID REFERENCES process_prompt(id) ON DELETE CASCADE,
    order_index INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Session Management

### session
A user's journey through the process.

```sql
CREATE TABLE session (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    process_version_id UUID REFERENCES process_version(id),

    -- Current state
    current_node_id UUID REFERENCES process_node(id),
    status VARCHAR(50) DEFAULT 'active',  -- 'active', 'paused', 'completed', 'abandoned'

    -- Timing
    started_at TIMESTAMP DEFAULT NOW(),
    last_activity_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,

    -- Metadata
    metadata JSONB                        -- Flexible storage for session-specific data
);

CREATE INDEX idx_session_user ON session(user_id, status);
```

### session_scope
What the user chose to focus on (captures Phase 2 choice).

```sql
CREATE TABLE session_scope (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES session(id) ON DELETE CASCADE UNIQUE,

    scope_type VARCHAR(50) NOT NULL,     -- 'whole_life', 'major_chapter', 'single_event', 'unsure'
    scope_description TEXT,              -- If they chose major_chapter or single_event, what is it?

    -- Time bounds (if applicable)
    time_period_start DATE,
    time_period_end DATE,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### session_profile
User's context and boundaries (captures Phase 3 data).

```sql
CREATE TABLE session_profile (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES session(id) ON DELETE CASCADE UNIQUE,

    -- Life structure flags
    has_relationships BOOLEAN,
    has_children BOOLEAN,
    has_multiple_careers BOOLEAN,
    has_lived_multiple_places BOOLEAN,
    has_military_service BOOLEAN,
    faith_important BOOLEAN,

    -- Comfort boundaries
    comfortable_discussing_romance BOOLEAN DEFAULT true,
    comfortable_discussing_trauma BOOLEAN DEFAULT true,
    prefers_some_private BOOLEAN DEFAULT false,

    -- Additional context
    additional_flags JSONB,              -- Extensible for new profile fields

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### session_progress
Tracks movement through nodes and completion status.

```sql
CREATE TABLE session_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES session(id) ON DELETE CASCADE,
    process_node_id UUID REFERENCES process_node(id),

    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'skipped'

    started_at TIMESTAMP,
    completed_at TIMESTAMP,

    -- Progress within node
    prompts_completed INTEGER DEFAULT 0,
    prompts_total INTEGER,

    -- Node-specific data
    node_data JSONB,                     -- Responses, decisions, artifacts

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_session_progress ON session_progress(session_id, process_node_id);
```

### session_section_status
Tracks which sections are unlocked/active/completed for a session.

```sql
CREATE TABLE session_section_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES session(id) ON DELETE CASCADE,
    section_id UUID REFERENCES process_section(id),

    status VARCHAR(50) DEFAULT 'locked',  -- 'locked', 'unlocked', 'in_progress', 'completed'
    is_selected BOOLEAN DEFAULT false,    -- User chose to work on this

    prompts_answered INTEGER DEFAULT 0,

    unlocked_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_session_section ON session_section_status(session_id, section_id);
```

---

## Synthesis & Outputs

### session_synthesis
Provisional drafts and checkpoints (Phase 9).

```sql
CREATE TABLE session_synthesis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES session(id) ON DELETE CASCADE,
    section_id UUID REFERENCES process_section(id),

    synthesis_type VARCHAR(50),          -- 'draft', 'chapter', 'checkpoint'
    title VARCHAR(200),
    content TEXT NOT NULL,

    is_provisional BOOLEAN DEFAULT true,
    version INTEGER DEFAULT 1,

    -- User feedback
    user_approved BOOLEAN,
    user_feedback TEXT,

    generated_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### session_archetype
Inferred narrative patterns (Phase 10).

```sql
CREATE TABLE session_archetype (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES session(id) ON DELETE CASCADE,

    archetype_type VARCHAR(100),         -- e.g., "loss_to_connection", "transformation", "endurance"
    confidence_score DECIMAL(3,2),       -- 0.00 to 1.00

    -- Analysis
    themes JSONB,                        -- Detected themes
    narrative_shape TEXT,

    -- User interaction
    revealed_to_user BOOLEAN DEFAULT false,
    user_confirmed BOOLEAN,
    user_reframed TEXT,

    inferred_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## Relationships Summary

```
process_version
    ├── process_commitment (1:many)
    ├── process_node (1:many)
    ├── process_flow_edge (1:many)
    └── process_section (1:many)

process_node
    ├── process_node_type (many:1)
    ├── process_prompt (1:many)
    ├── process_flow_edge (as from/to)
    └── session_progress (1:many)

session
    ├── process_version (many:1)
    ├── current_node (many:1 to process_node)
    ├── session_scope (1:1)
    ├── session_profile (1:1)
    ├── session_progress (1:many)
    ├── session_section_status (1:many)
    ├── session_synthesis (1:many)
    └── session_archetype (1:many)
```

---

## Usage Patterns

### 1. Session Initialization
```python
# Create session
session = create_session(user_id, active_process_version_id)

# User at first node
first_node = get_first_node(process_version_id)
session.current_node_id = first_node.id

# Create progress tracking
create_session_progress(session.id, first_node.id, status='in_progress')
```

### 2. Node Transition
```python
# Complete current node
complete_node_progress(session.id, current_node.id)

# Get next node based on edges and conditions
next_node = get_next_node(
    session.id,
    current_node.id,
    session_scope=session.scope_type,
    session_profile=session.profile
)

# Update session
session.current_node_id = next_node.id
```

### 3. Conditional Section Unlocking
```python
# After completing contextual grounding
sections = get_available_sections(
    process_version_id,
    scope_type=session.scope.scope_type,
    profile_flags=session.profile.to_dict()
)

# Unlock eligible sections
for section in sections:
    if meets_unlock_criteria(session, section):
        unlock_section(session.id, section.id)
```

### 4. Dynamic Agent Creation
```python
# Get current node details
node = get_current_node(session.id)

# Create agent with node-specific objective
agent = create_agent(
    objective=node.agent_objective,
    constraints=node.agent_constraints,
    prompts=get_node_prompts(node.id, session),
    context={
        'session': session,
        'profile': session.profile,
        'scope': session.scope
    }
)
```

---

## Migration Strategy

1. **Phase 1**: Create tables, seed initial process_version
2. **Phase 2**: Populate nodes from process.txt
3. **Phase 3**: Define node types and edges
4. **Phase 4**: Create sections and prompts
5. **Phase 5**: Test session flows end-to-end
6. **Phase 6**: Add archetype inference logic

---

## Next Steps

1. Validate this schema against your specific use cases
2. Decide on SQLAlchemy/Django ORM models
3. Create seed data for initial process version
4. Build API layer for session management
5. Define agent initialization logic
