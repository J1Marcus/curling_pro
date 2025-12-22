# Flow Architecture: Mermaid Diagrams

Visual representations of the Everbound flow architecture defined in [flow_architecture.md](flow_architecture.md).

---

## 1. Canonical Process Flow

```mermaid
graph LR
    A[Trust Building] --> B[Scope Selection]
    B --> C[Context/Grounding]
    C --> D[Story Capture]
    D --> E[Synthesis]
    E --> F[Verification]
    F --> G[Book Formation]

    style A fill:#e1f5e1
    style B fill:#e1f5e1
    style C fill:#e1f5e1
    style D fill:#fff3cd
    style E fill:#fff3cd
    style F fill:#fff3cd
    style G fill:#f8d7da
```

---

## 2. System Architecture Overview

```mermaid
graph TB
    subgraph "Primary Flows (Orchestrators)"
        AF[Analyst Flow<br/>Decision Maker]
        SF[Session Flow<br/>Executor]
        EF[Editor Flow<br/>Quality Gate]
    end

    subgraph "Requirements Tables"
        RT[requirement<br/>Story Capture Gaps]
        ERT[edit_requirement<br/>Composition Quality]
    end

    subgraph "Subflows (Specialized)"
        TB[Trust Building]
        CG[Contextual Grounding]
        LD[Lane Development]
        AA[Archetype Assessment]
        SY[Synthesis]
        CO[Composition]
    end

    subgraph "Data Layer"
        ST[storyteller]
        LE[life_event]
        SS[session]
        CL[collection]
        SR[story]
    end

    AF -->|lodges| RT
    RT -->|drives| SF
    SF -->|addresses| RT
    SF -->|updates| ST
    SF -->|creates| LE
    SF -->|creates| SS

    AF -->|triggers| TB
    AF -->|triggers| CG
    AF -->|triggers| LD
    AF -->|triggers| AA
    AF -->|triggers| SY

    SF -->|executes| TB
    SF -->|executes| CG
    SF -->|executes| LD

    AF -->|initiates| EF
    EF -->|lodges| ERT
    ERT -->|drives| CO
    CO -->|addresses| ERT
    CO -->|creates| SR

    SY -->|creates| CL
    CO -->|uses| CL

    style AF fill:#4a90e2,color:#fff
    style SF fill:#7b68ee,color:#fff
    style EF fill:#e74c3c,color:#fff
    style RT fill:#f39c12
    style ERT fill:#e67e22
```

---

## 3. Pattern 1: Analyst → Session → Analyst Loop

```mermaid
sequenceDiagram
    participant A as Analyst Flow
    participant RT as Requirements Table
    participant SF as Session Flow
    participant ST as Storyteller State

    Note over A: 1. Assess State
    A->>A: Evaluate phase, material, gaps

    Note over A,RT: 2. Lodge Requirements
    A->>RT: Create requirement records<br/>(critical, important, optional)

    Note over A,SF: 3. Determine Next Action
    A->>SF: Trigger subflow<br/>(e.g., lane_development)

    Note over SF: 4. Execute Session
    SF->>SF: Pre-call prep
    SF->>SF: VAPI call execution
    SF->>SF: Post-call processing

    Note over SF,ST: 5. Update State
    SF->>ST: Update progress
    SF->>ST: Create life events
    SF->>ST: Create artifacts

    Note over SF,RT: 6. Mark Addressed
    SF->>RT: Update requirements<br/>pending → addressed

    Note over SF,A: 7. Trigger Re-Assessment
    SF->>A: Reassess storyteller

    Note over A: 8. Validate Resolution
    A->>RT: Check if resolved<br/>addressed → resolved

    A->>A: Loop or transition to next phase
```

---

## 4. Pattern 2: Editor → Composition → Editor Loop

```mermaid
sequenceDiagram
    participant A as Analyst Flow
    participant CO as Composition Subflow
    participant EF as Editor Flow
    participant ERT as Edit Requirements Table
    participant CH as Chapter

    Note over A: Sufficiency Gates Passed
    A->>CO: Initiate composition

    Note over CO: Assemble Manuscript
    CO->>CH: Create chapters<br/>from collections
    CO->>CH: Compose prose
    CO->>CH: Develop characters
    CO->>CH: Weave themes

    Note over CO,EF: Trigger Review
    CO->>EF: Review chapter

    Note over EF: Assess Quality
    EF->>EF: Narrative coherence (0-10)
    EF->>EF: Pacing (scene:summary)
    EF->>EF: Character consistency
    EF->>EF: Sensory details
    EF->>EF: Thematic integration

    alt Quality Issues Found
        Note over EF,ERT: Lodge Requirements
        EF->>ERT: Create edit_requirement<br/>(blocking/important/polish)

        alt Blocking Issues
            EF->>CH: status = needs_revision
            EF->>CO: Address requirements
            CO->>CH: Revise prose
            CO->>ERT: Mark resolved
            CO->>EF: Re-review
            Note over EF: Iterative refinement
        else Important/Polish Issues
            EF->>CH: status = needs_polish
            EF->>CO: Address when convenient
        end
    else Quality Acceptable
        EF->>CH: status = approved
        Note over EF: Continue to next chapter
    end

    alt All Chapters Approved
        EF->>A: story.status = ready_for_export
    else More Work Needed
        EF->>CO: Continue revision cycle
    end
```

---

## 5. Pattern 3: Multi-Archetype Refinement (Progressive Narrowing)

```mermaid
flowchart TD
    S1[Session 4+ Completed] --> AF[Analyst Flow]
    AF -->|session_count % 3 == 0| AA[Archetype Assessment<br/>Subflow]

    AA --> AGT[Multi-Archetype<br/>Agentic Assessment]
    AGT --> CAND[Track Multiple<br/>Candidates with<br/>Confidence Scores]

    CAND --> STATUS{Refinement<br/>Status?}

    STATUS -->|3+ candidates>0.60| EXP[EXPLORING<br/>Multiple viable archetypes]
    STATUS -->|2 candidates>0.60| NAR[NARROWING<br/>Strong contenders]
    STATUS -->|1 candidate>=0.85| RES[RESOLVED<br/>Dominant archetype clear]

    EXP --> SAVE1["Save to archetype_analysis<br/>refinement_status='exploring'<br/>candidate_archetypes=....<br/>revealed_to_user=FALSE"]
    NAR --> SAVE2["Save to archetype_analysis<br/>refinement_status='narrowing'<br/>candidate_archetypes=....<br/>revealed_to_user=FALSE"]
    RES --> SAVE3["Save to archetype_analysis<br/>refinement_status='resolved'<br/>dominant_archetype=X<br/>dominant_confidence>=0.85<br/>revealed_to_user=FALSE"]

    SAVE1 --> SIG1[Signal Analyst:<br/>Lodge DISCRIMINATING<br/>requirements]
    SAVE2 --> SIG2[Signal Analyst:<br/>Lodge VALIDATING<br/>requirements]
    SAVE3 --> SIG3[Signal Analyst:<br/>Lodge STRENGTHENING<br/>requirements]

    SIG1 --> LODGE[Requirements Table<br/>Updated with<br/>archetype_refinement_purpose]
    SIG2 --> LODGE
    SIG3 --> LODGE

    LODGE --> HIDDEN[Continue Normal Flow<br/>Archetype Hidden<br/>Strategic Requirements Active]

    HIDDEN --> NEXT[Next Assessment<br/>in 3 Sessions]
    NEXT -.-> AA

    HIDDEN -.->|User asks: story shape?| REVEAL[Reveal Archetype]

    REVEAL --> REVTYPE{Refinement<br/>Status?}

    REVTYPE -->|exploring/narrowing| MULTI[Present Multiple<br/>Candidates Honestly]
    REVTYPE -->|resolved| SINGLE[Present Dominant<br/>Archetype Confidently]

    MULTI --> VERIFY{User<br/>Response?}
    SINGLE --> VERIFY

    VERIFY -->|Confirms| CONF[user_confirmed=true<br/>Proceed with archetype]
    VERIFY -->|Disagrees| PIVOT[Immediate Pivot<br/>Create user_feedback<br/>Re-run assessment]

    PIVOT --> AA

    style AA fill:#9b59b6,color:#fff
    style EXP fill:#e67e22
    style NAR fill:#f39c12
    style RES fill:#27ae60,color:#fff
    style LODGE fill:#3498db,color:#fff
    style HIDDEN fill:#95a5a6,color:#fff
    style REVEAL fill:#e74c3c,color:#fff
```

---

## 6. Session Flow: Complete Lifecycle

```mermaid
graph TB
    START[Session Triggered] --> PREP[Phase 1: Pre-Call<br/>Preparation]

    PREP --> P1[Load Storyteller State]
    P1 --> P2[Determine Session Goal]
    P2 --> P3[Load Requirements]
    P3 --> P4[Pre-load Story Context]
    P4 --> P5[Generate Prompts]
    P5 --> P6[Create VAPI Agent]
    P6 --> EXEC[Phase 2: Call<br/>Execution]

    EXEC --> E1[VAPI Initiates Call]
    E1 --> E2[Agent Conducts Interview]
    E2 --> E3[Real-time Transcript<br/>Streaming]
    E3 --> E4[Call End]
    E4 --> E5[end_call_report<br/>Received]
    E5 --> QUAL[Phase 3: Quality<br/>Validation]

    QUAL --> Q1{Quality<br/>Issues?}
    Q1 -->|Yes| FAIL[Notify User<br/>Offer Reschedule]
    Q1 -->|No| PROC[Phase 4: Post-Call<br/>Processing]

    PROC --> PR1[Persist Transcript]
    PR1 --> PR2[Extract Story Points]
    PR2 --> PR3[Create/Update<br/>Life Events]
    PR3 --> PR4[Create Session<br/>Artifacts]
    PR4 --> PR5[Update Section<br/>Progress]
    PR5 --> VERIFY[Phase 5: User<br/>Verification]

    VERIFY --> V1[Generate Session<br/>Summary]
    V1 --> V2[Send to User]
    V2 --> V3{User<br/>Response?}
    V3 -->|Approved| TRIG[Phase 6: Trigger<br/>Next Steps]
    V3 -->|Changes| UPDATE[Update Story<br/>Points]
    V3 -->|Redo| REDO[Schedule New<br/>Session]

    UPDATE --> TRIG

    TRIG --> T1[Update Storyteller<br/>Progress]
    T1 --> T2[Mark Requirements<br/>Addressed]
    T2 --> T3[Trigger Analyst<br/>Flow]
    T3 --> T4[Offer Next Session<br/>Scheduling]
    T4 --> END[Session Complete]

    FAIL --> END
    REDO --> END

    style PREP fill:#3498db,color:#fff
    style EXEC fill:#9b59b6,color:#fff
    style QUAL fill:#e67e22,color:#fff
    style PROC fill:#27ae60,color:#fff
    style VERIFY fill:#f39c12,color:#fff
    style TRIG fill:#e74c3c,color:#fff
```

---

## 7. Analyst Flow: Decision Logic

```mermaid
flowchart TD
    START[Analyst Flow<br/>Triggered] --> LOAD[Load Storyteller<br/>State]

    LOAD --> PHASE{Current<br/>Phase?}

    PHASE -->|null| NEW[New Storyteller]
    NEW --> TR[Lodge: complete_trust_setup<br/>Next: trust_building]

    PHASE -->|trust_building| TB{Trust Setup<br/>Complete?}
    TB -->|Yes| HB[Transition:<br/>history_building<br/>Next: contextual_grounding]
    TB -->|No| TBC[Continue:<br/>trust_building]

    PHASE -->|history_building| HIS{Timeline &<br/>Sections?}
    HIS -->|Complete| CAP[Transition:<br/>story_capture<br/>Next: lane_development]
    HIS -->|Timeline Missing| CG[Next:<br/>contextual_grounding]
    HIS -->|Sections Missing| SS[Next:<br/>section_selection]

    PHASE -->|story_capture| SC[Evaluate Each<br/>Section]
    SC --> GAPS[Analyze<br/>Material Gaps]
    GAPS --> LODGE[Lodge<br/>Requirements]
    LODGE --> NEXT[Select Next<br/>Lane]

    NEXT --> CHECK{Additional<br/>Triggers?}
    CHECK -->|session % 3 == 0| ARC[Trigger:<br/>archetype_assessment]

    ARC --> ARCSTAT{Archetype<br/>Refinement<br/>Status?}
    ARCSTAT -->|exploring| DISC[Lodge DISCRIMINATING<br/>requirements<br/>between top 2 candidates]
    ARCSTAT -->|narrowing| VAL[Lodge VALIDATING<br/>requirements<br/>for active candidates]
    ARCSTAT -->|resolved| STR[Lodge STRENGTHENING<br/>requirements<br/>for dominant archetype]

    DISC --> LANE
    VAL --> LANE
    STR --> LANE

    CHECK -->|section sufficient| SYN[Trigger:<br/>synthesis]
    CHECK -->|Otherwise| LANE[Next:<br/>lane_development]

    PHASE -->|composition| COMP[Hand off to<br/>Editor Flow]

    TR --> OUTPUT[Output:<br/>Next Subflow]
    HB --> OUTPUT
    TBC --> OUTPUT
    CAP --> OUTPUT
    CG --> OUTPUT
    SS --> OUTPUT
    LANE --> OUTPUT
    ARC --> OUTPUT
    SYN --> OUTPUT
    COMP --> OUTPUT

    style START fill:#3498db,color:#fff
    style GAPS fill:#e67e22
    style LODGE fill:#f39c12
    style OUTPUT fill:#27ae60,color:#fff
```

---

## 8. Subflows: Trust Building Sequence

```mermaid
sequenceDiagram
    participant AF as Analyst Flow
    participant SF as Session Flow
    participant TB as Trust Building<br/>Subflow
    participant ST as Storyteller State

    Note over AF: Storyteller in<br/>trust_building phase
    AF->>SF: Execute trust_building
    SF->>TB: Initialize

    Note over TB: Step 1: Introduction
    TB->>TB: Set expectations<br/>"Build outline first"<br/>"You can skip anything"
    TB->>ST: trust_setup_complete = true

    Note over TB: Step 2: Scope Selection
    TB->>TB: Present options:<br/>☐ Whole life<br/>☐ Major chapter<br/>☐ Single event<br/>☐ Not sure
    TB->>ST: scope_type = [selected]
    TB->>ST: Enable sections based<br/>on scope

    Note over TB: Step 3: Gentle Profile
    TB->>TB: Gather (checkboxes only):<br/>- Life structure<br/>- Comfort boundaries
    TB->>ST: storyteller_boundary<br/>populated
    TB->>ST: storyteller_preference<br/>populated
    TB->>ST: Additional sections<br/>unlocked

    Note over TB,AF: Complete
    TB->>SF: Success
    SF->>AF: Trigger reassessment

    Note over AF: Transition to<br/>history_building
```

---

## 9. Subflows: Lane Development (The Engine)

```mermaid
flowchart TD
    START[Lane Development<br/>Triggered] --> INPUT[Input:<br/>Section Name<br/>Requirements]

    INPUT --> PROMPT[Apply Prompt Pack<br/>Template]

    PROMPT --> P1[Scene:<br/>Take me to a<br/>specific moment...]
    P1 --> P2[People:<br/>Who was there?]
    P2 --> P3[Tension:<br/>What was uncertain?]
    P3 --> P4[Change:<br/>Did anything shift?]
    P4 --> P5[Meaning:<br/>Looking back...]

    P5 --> BOUND{Check<br/>Boundaries}

    BOUND -->|Sensitive Topic| CHECK{User<br/>Comfortable?}
    CHECK -->|No| SKIP[Skip or<br/>Gentle Version]
    CHECK -->|Yes| ASK[Ask Prompt]
    BOUND -->|Safe Topic| ASK

    ASK --> RESP[Capture<br/>Response]
    RESP --> EXTRACT[Extract Material]

    EXTRACT --> EX1[Identify:<br/>scene vs summary]
    EX1 --> EX2[Extract:<br/>sensory details]
    EX2 --> EX3[Extract:<br/>emotions]
    EX3 --> EX4[Extract:<br/>people, places, time]
    EX4 --> EX5[Extract:<br/>tension, change]
    EX5 --> EX6[Extract:<br/>reflection, meaning]

    EX6 --> ART[Create<br/>session_artifact]
    ART --> EVENT[Update<br/>life_event]

    EVENT --> PROG[Track Progress]
    PROG --> PCT{Completion<br/>>= 80%?}

    PCT -->|Yes| DONE[Mark Section<br/>Completed]
    PCT -->|No| MORE{More<br/>Prompts?}

    MORE -->|Yes| P1
    MORE -->|No| DONE

    DONE --> UNLOCK[Check Dependent<br/>Sections]
    UNLOCK --> REQ[Mark Requirements<br/>Addressed]
    REQ --> TRIG[Trigger Analyst<br/>Flow]

    SKIP --> MORE

    style PROMPT fill:#3498db,color:#fff
    style EXTRACT fill:#9b59b6,color:#fff
    style ART fill:#27ae60,color:#fff
    style DONE fill:#e74c3c,color:#fff
```

---

## 10. Requirements Workflow: Story Capture

```mermaid
sequenceDiagram
    participant AF as Analyst Flow
    participant RT as requirement<br/>Table
    participant SF as Session Flow
    participant VAPI as VAPI Agent
    participant ST as Storyteller

    Note over AF: Gap Analysis
    AF->>AF: Analyze section<br/>material
    AF->>AF: Identify gaps:<br/>- Sensory detail<br/>- Character insight<br/>- Timeline clarity

    Note over AF,RT: Lodge Requirements
    AF->>RT: CREATE requirement<br/>type: sensory_detail<br/>priority: critical<br/>status: pending

    Note over SF: Session Prep
    SF->>RT: QUERY requirements<br/>WHERE section=current<br/>ORDER BY priority
    RT-->>SF: Top 3 critical<br/>requirements

    SF->>RT: UPDATE status<br/>pending → in_progress

    SF->>VAPI: Configure agent with<br/>suggested_prompts

    Note over VAPI,ST: Interview
    VAPI->>ST: "What did grandmother's<br/>house smell like?"
    ST-->>VAPI: Response with<br/>sensory details

    Note over SF: Post-Call
    SF->>SF: Extract story points<br/>with sensory details

    SF->>RT: UPDATE status<br/>in_progress → addressed

    Note over AF: Validation
    AF->>RT: QUERY requirements<br/>WHERE status=addressed
    RT-->>AF: Requirements list

    AF->>AF: Validate:<br/>Are senses present?
    AF->>RT: UPDATE status<br/>addressed → resolved

    Note over RT: Requirement Lifecycle<br/>pending → in_progress →<br/>addressed → resolved
```

---

## 11. Requirements Workflow: Composition Quality

```mermaid
sequenceDiagram
    participant AF as Analyst Flow
    participant CO as Composition<br/>Subflow
    participant EF as Editor Flow
    participant ERT as edit_requirement<br/>Table
    participant CH as Chapter

    Note over AF: Sufficiency Gates<br/>Passed
    AF->>CO: Initiate composition

    Note over CO: Assemble Chapter
    CO->>CH: Create from<br/>collections
    CO->>CH: Compose prose

    CO->>EF: Review chapter

    Note over EF: Quality Assessment
    EF->>CH: Assess:<br/>- Coherence<br/>- Pacing<br/>- Character voice<br/>- Sensory details<br/>- Themes

    alt Scene:Summary Ratio < 70%
        Note over EF,ERT: Lodge Blocking Issue
        EF->>ERT: CREATE edit_requirement<br/>issue_type: pacing<br/>severity: blocking<br/>status: pending

        EF->>CH: status = needs_revision
        EF->>CO: Address requirements

        Note over CO: Revision
        CO->>ERT: QUERY requirements<br/>WHERE chapter_id<br/>ORDER BY priority

        ERT-->>CO: Blocking issues

        CO->>ERT: UPDATE status<br/>pending → in_review

        CO->>CH: Expand summary<br/>into scenes

        CO->>ERT: UPDATE status<br/>in_review → resolved<br/>resolved_in_draft: v2

        CO->>CH: draft_version++
        CO->>EF: Re-review

    else Quality Acceptable
        EF->>CH: status = approved
    end

    Note over ERT: Edit Lifecycle<br/>pending → in_review →<br/>resolved
```

---

## 12. Data Flow: Complete Journey

```mermaid
flowchart LR
    subgraph "Phase 1-3: Onboarding"
        U[User Account] --> ST[storyteller]
        ST --> SB[storyteller_boundary]
        ST --> SP[storyteller_preference]
        ST --> SPRO[storyteller_progress]
        ST --> SCOPE[storyteller_scope]
        ST --> SSS[storyteller_section_status]
    end

    subgraph "Phase 4-6: Capture"
        SSS --> SESS[session]
        SESS --> SI[session_interaction]
        SESS --> SA[session_artifact]
        SA --> LE[life_event]
        LE --> LET[life_event_timespan]
        LE --> LEL[life_event_location]
        LE --> LEP[life_event_participant]
        LE --> LED[life_event_detail]
    end

    subgraph "Phase 7-9: Synthesis"
        LE --> COL[collection]
        SA --> COL
        COL --> CLE[collection_life_event]
        COL --> CS[collection_synthesis]
        COL --> AA[archetype_analysis]
    end

    subgraph "Phase 10-11: Composition"
        COL --> STY[story]
        STY --> SCH[story_chapter]
        SCH --> CHSEC[chapter_section]
        CHSEC --> SCENE[story_scene]
        STY --> SCHAR[story_character]
        SCHAR --> CHARA[character_appearance]
        SCHAR --> CHARR[character_relationship]
        STY --> THEM[story_theme]
        THEM --> CHT[chapter_theme]
    end

    subgraph "Phase 12: Export"
        STY --> SD[story_draft]
        STY --> BE[book_export]
        BE --> BED[book_export_delivery]
    end

    subgraph "Requirements Flow"
        SPRO -.-> REQ[requirement]
        REQ -.-> SESS
        STY -.-> EREQ[edit_requirement]
        EREQ -.-> SCH
    end

    style ST fill:#3498db,color:#fff
    style LE fill:#9b59b6,color:#fff
    style COL fill:#f39c12
    style STY fill:#e74c3c,color:#fff
    style REQ fill:#27ae60,color:#fff
    style EREQ fill:#16a085,color:#fff
```

---

## 13. Implementation Phases

```mermaid
flowchart TD
    subgraph "Phase 1: Core Flows (MVP)"
        P1A[Analyst Flow<br/>Basic Decision Logic]
        P1B[Session Flow<br/>Complete Lifecycle]
        P1C[Trust Building Subflow<br/>Onboarding]
        P1D[Contextual Grounding<br/>Timeline & Context]
        P1E[Section Selection<br/>Lane Choosing]
        P1F[Lane Development<br/>Basic Interview Flow]
    end

    subgraph "Phase 2: Advanced Flows"
        P2A[Analyst Flow<br/>Gap Analysis & Requirements]
        P2B[Lane Development<br/>Advanced Material Extraction]
        P2C[Archetype Assessment<br/>Hidden Observer]
        P2D[Synthesis Subflow<br/>Collection Assembly]
    end

    subgraph "Phase 3: Composition & Quality"
        P3A[Editor Flow<br/>Quality Assessment]
        P3B[Composition Subflow<br/>Prose Generation]
        P3C[Book Export<br/>Format Generation]
    end

    subgraph "Phase 4: Optimization"
        P4A[Session Recovery<br/>Quality Failures]
        P4B[Agent-Driven Scheduling<br/>Proactive Planning]
        P4C[Multi-User Interviews<br/>Collaborative Stories]
        P4D[Advanced Archetype<br/>Deep Pattern Analysis]
    end

    P1A --> P1C
    P1B --> P1C
    P1C --> P1D
    P1D --> P1E
    P1E --> P1F

    P1A --> P2A
    P1F --> P2B
    P2A --> P2C
    P2B --> P2D

    P2A --> P3A
    P2D --> P3B
    P3A --> P3B
    P3B --> P3C

    P3A --> P4A
    P3B --> P4B
    P2C --> P4D
    P1B --> P4C

    style P1A fill:#3498db,color:#fff
    style P1B fill:#3498db,color:#fff
    style P2A fill:#9b59b6,color:#fff
    style P2B fill:#9b59b6,color:#fff
    style P3A fill:#e74c3c,color:#fff
    style P3B fill:#e74c3c,color:#fff
    style P4A fill:#27ae60,color:#fff
    style P4B fill:#27ae60,color:#fff
```

---

## 14. Progressive Section Unlocking

```mermaid
flowchart TD
    START[Scope Selected] --> SCOPE{Scope<br/>Type?}

    SCOPE -->|whole_life| WL[Enable Core Sections:<br/>Origins, Childhood,<br/>Teen Years, etc.]
    SCOPE -->|major_chapter| MC[Enable Focused:<br/>Chapter-specific<br/>sections]
    SCOPE -->|single_event| SE[Enable Minimal:<br/>Event-specific<br/>only]

    WL --> PROF[Profile<br/>Completed]
    MC --> PROF
    SE --> PROF

    PROF --> COND{Conditional<br/>Sections}

    COND -->|has_relationships| REL[Unlock:<br/>Love & Partnership]
    COND -->|has_children| PAR[Unlock:<br/>Parenthood]
    COND -->|military_service| MIL[Unlock:<br/>Service & Sacrifice]
    COND -->|comfortable_loss| LOSS[Unlock:<br/>Caregiving/Loss]

    REL --> INIT[Initial Sections<br/>Unlocked]
    PAR --> INIT
    MIL --> INIT
    LOSS --> INIT
    COND -->|None| INIT

    INIT --> WORK[User Works on<br/>Section 1]
    WORK --> COMP{Section 1<br/>Complete?}

    COMP -->|Yes| DEP[Check Dependent<br/>Sections]
    COMP -->|No| WORK

    DEP --> DEP1{Section 2<br/>Prerequisites<br/>Met?}

    DEP1 -->|Yes| UNLOCK[Unlock<br/>Section 2]
    DEP1 -->|No| WAIT[Remain<br/>Locked]

    UNLOCK --> WORK2[User Works on<br/>Section 2]
    WORK2 --> CASCADE[Cascade<br/>Unlocking...]

    style SCOPE fill:#3498db,color:#fff
    style PROF fill:#9b59b6,color:#fff
    style COMP fill:#f39c12
    style UNLOCK fill:#27ae60,color:#fff
```

---

## 15. State Transitions

```mermaid
stateDiagram-v2
    [*] --> TrustBuilding: New Storyteller

    TrustBuilding --> HistoryBuilding: Trust Setup Complete<br/>Scope Selected<br/>Profile Complete

    HistoryBuilding --> StoryCapture: Timeline Scaffolded<br/>Sections Selected

    StoryCapture --> StoryCapture: Loop - Lane Development, Requirements, Sessions

    StoryCapture --> Synthesis: Section Has<br/>Sufficient Material

    Synthesis --> StoryCapture: Provisional Draft<br/>Approved

    StoryCapture --> Composition: Sufficiency Gates Passed - Archetype resolved, Min material, Character dev, Scene density, Thematic coherence

    Composition --> Editing: Chapters<br/>Assembled

    Editing --> Composition: Edit Requirements<br/>Lodged

    Editing --> Export: All Chapters<br/>Approved

    Export --> [*]: Book<br/>Delivered

    note right of StoryCapture
        Main Phase
        Most Time Spent
        Multiple Sessions
        Requirements-Driven
    end note

    note right of Composition
        Iterative Refinement
        Editor → Composition Loop
        Quality Gates
    end note
```

---

## Usage Notes

### Viewing Mermaid Diagrams

These diagrams can be viewed in:
- **GitHub**: Native Mermaid rendering
- **VS Code**: With Mermaid Preview extension
- **Mermaid Live Editor**: https://mermaid.live
- **Documentation sites**: GitBook, MkDocs, etc.

### Diagram Types Used

- **Flowchart** (`flowchart` / `graph`): For process flows and decision trees
- **Sequence Diagram** (`sequenceDiagram`): For interactions between flows
- **State Diagram** (`stateDiagram-v2`): For state transitions
- **Gantt Chart** (`gantt`): For implementation timeline

### Color Coding

- **Blue** (#3498db): Primary/orchestrator flows
- **Purple** (#9b59b6): Execution/processing
- **Orange** (#f39c12): Requirements/tracking
- **Red** (#e74c3c): Quality gates/critical points
- **Green** (#27ae60): Success/completion states
- **Gray** (#95a5a6): Hidden/background processes
