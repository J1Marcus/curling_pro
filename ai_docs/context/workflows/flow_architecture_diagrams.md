# Flow Architecture: Mermaid Diagrams

Visual representations of the Everbound flow architecture defined in [flow_architecture.md](../source_docs/flow_architecture.md).

**UPDATED**: These diagrams reflect the new execution pattern where:
1. **Analyst ALWAYS runs ALL subflows** (no selective execution)
2. **Analyst runs after EVERY requirement submission** (real-time)
3. **Subflows self-gate** based on entry criteria
4. **Requirement submissions include transcript** payload

For detailed execution pattern with code examples, see [analyst_subflow_execution_pattern.md](../project_docs/analyst_subflow_execution_pattern.md).

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

## 3. Core Execution Pattern: Analyst Runs ALL Subflows

```mermaid
flowchart TB
    START[Trigger Event:<br/>- storyteller_created<br/>- requirement_submission<br/>- session_completion<br/>- periodic check] --> ANALYST[Analyst Flow<br/>Triggered]

    ANALYST --> RUN[Run ALL Subflows<br/>in Sequence]

    RUN --> SF1[Trust Building]
    SF1 --> GATE1{Entry<br/>Criteria?}
    GATE1 -->|phase IN<br/>[NULL, trust_building]| EXEC1[✓ Execute:<br/>Assess & Create<br/>Requirements]
    GATE1 -->|Other| SKIP1[✗ Return Early]
    EXEC1 --> SF2
    SKIP1 --> SF2

    SF2[Contextual Grounding]
    SF2 --> GATE2{Entry<br/>Criteria?}
    GATE2 -->|phase =<br/>history_building| EXEC2[✓ Execute]
    GATE2 -->|Other| SKIP2[✗ Return Early]
    EXEC2 --> SF3
    SKIP2 --> SF3

    SF3[Section Selection]
    SF3 --> GATE3{Entry<br/>Criteria?}
    GATE3 -->|history_building<br/>AND grounding_complete| EXEC3[✓ Execute]
    GATE3 -->|Other| SKIP3[✗ Return Early]
    EXEC3 --> SF4
    SKIP3 --> SF4

    SF4[Lane Development]
    SF4 --> GATE4{Entry<br/>Criteria?}
    GATE4 -->|story_capture<br/>AND sections_selected| EXEC4[✓ Execute]
    GATE4 -->|Other| SKIP4[✗ Return Early]
    EXEC4 --> SF5
    SKIP4 --> SF5

    SF5[Archetype Assessment]
    SF5 --> GATE5{Entry<br/>Criteria?}
    GATE5 -->|story_capture<br/>AND session_count >= 4<br/>AND count % 3 = 0| EXEC5[✓ Execute]
    GATE5 -->|Other| SKIP5[✗ Return Early]
    EXEC5 --> SF6
    SKIP5 --> SF6

    SF6[Synthesis]
    SF6 --> GATE6{Entry<br/>Criteria?}
    GATE6 -->|story_capture<br/>AND sufficient_material| EXEC6[✓ Execute]
    GATE6 -->|Other| SKIP6[✗ Return Early]
    EXEC6 --> SF7
    SKIP6 --> SF7

    SF7[Composition]
    SF7 --> GATE7{Entry<br/>Criteria?}
    GATE7 -->|All sufficiency<br/>gates passed| EXEC7[✓ Execute]
    GATE7 -->|Other| SKIP7[✗ Return Early]
    EXEC7 --> SF8
    SKIP7 --> SF8

    SF8[Editor]
    SF8 --> GATE8{Entry<br/>Criteria?}
    GATE8 -->|story_exists<br/>AND chapters_created| EXEC8[✓ Execute]
    GATE8 -->|Other| SKIP8[✗ Return Early]
    EXEC8 --> COMPLETE
    SKIP8 --> COMPLETE

    COMPLETE[All Subflows<br/>Complete] --> DETERMINE[Determine<br/>Next Action]

    DETERMINE --> ACTION{State<br/>After All<br/>Subflows?}
    ACTION -->|Pending<br/>Requirements| SESSION[Schedule/Continue<br/>Session]
    ACTION -->|No Requirements<br/>+ Complete| EXPORT[Story Ready]
    ACTION -->|No Requirements<br/>+ Incomplete| REVIEW[Review Needed]

    SESSION --> VAPI[VAPI Session]
    VAPI --> SUBMIT[submit_requirement_result]
    SUBMIT --> RETRIGGER[Trigger Analyst<br/>IMMEDIATELY]
    RETRIGGER -.->|Loop| ANALYST

    style ANALYST fill:#3498db,color:#fff
    style RUN fill:#4a90e2,color:#fff
    style EXEC1 fill:#27ae60,color:#fff
    style EXEC2 fill:#27ae60,color:#fff
    style EXEC3 fill:#27ae60,color:#fff
    style EXEC4 fill:#27ae60,color:#fff
    style EXEC5 fill:#27ae60,color:#fff
    style EXEC6 fill:#27ae60,color:#fff
    style EXEC7 fill:#27ae60,color:#fff
    style EXEC8 fill:#27ae60,color:#fff
    style SKIP1 fill:#95a5a6
    style SKIP2 fill:#95a5a6
    style SKIP3 fill:#95a5a6
    style SKIP4 fill:#95a5a6
    style SKIP5 fill:#95a5a6
    style SKIP6 fill:#95a5a6
    style SKIP7 fill:#95a5a6
    style SKIP8 fill:#95a5a6
    style SUBMIT fill:#e74c3c,color:#fff
    style RETRIGGER fill:#e67e22,color:#fff
```

**Key Principles:**
1. **Analyst ALWAYS runs ALL subflows** - No selective execution
2. **Each subflow self-gates** - Checks entry criteria and returns early if not met
3. **Analyst runs after EVERY requirement submission** - Real-time response
4. **Deterministic & predictable** - Same sequence every time, state determines behavior

---

## 4. Real-Time Requirement Submission Flow

```mermaid
sequenceDiagram
    participant A as Analyst Flow
    participant SW as All Subflows
    participant RT as Requirements Table
    participant VAPI as VAPI Agent
    participant ST as Storyteller State

    Note over A: Analyst Triggered
    A->>SW: Run ALL Subflows

    Note over SW: Trust Building
    SW->>SW: Check gate: phase?
    alt Phase gate met
        SW->>SW: Assess requirements
        SW->>RT: Create requirements
    else Phase gate not met
        SW->>SW: Return early
    end

    Note over SW: Contextual Grounding
    SW->>SW: Check gate: phase?
    Note over SW: Section Selection...
    Note over SW: Lane Development...
    Note over SW: (All subflows run)

    Note over A,RT: After all subflows
    A->>A: Determine next action
    A->>RT: Pending requirements exist?

    Note over VAPI: VAPI Session Begins
    VAPI->>VAPI: Address requirement #1

    Note over VAPI: submit_requirement_result()
    VAPI->>RT: Mark addressed + transcript
    VAPI->>ST: Apply side effects

    Note over VAPI,A: IMMEDIATE TRIGGER
    VAPI->>A: Trigger Analyst Flow

    Note over A: Analyst Runs Again
    A->>SW: Run ALL Subflows
    SW->>SW: Reassess state
    SW->>RT: Create/resolve requirements

    Note over VAPI: Session Continues
    VAPI->>VAPI: Address requirement #2
    VAPI->>A: submit_requirement_result()<br/>→ Trigger Analyst

    Note over A: Iterative Loop
    A->>SW: Run ALL Subflows<br/>(after each submission)
```

---

## 5. Pattern 2: Editor → Composition → Editor Loop

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

## 6. Pattern 3: Multi-Archetype Refinement (Progressive Narrowing)

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

## 7. Session Flow: Complete Lifecycle

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

## 8. Analyst Flow: All Subflows Execution Pattern

```mermaid
flowchart TD
    START[Analyst Flow<br/>Triggered] --> LOAD[Load Storyteller<br/>State]

    LOAD --> RUN[Run ALL Subflows<br/>Sequentially]

    RUN --> SF1[1. Trust Building<br/>Workflow]
    SF1 --> G1{Phase gate?}
    G1 -->|NULL or trust_building| EX1[Execute:<br/>Assess requirements<br/>Create/resolve<br/>Transition if complete]
    G1 -->|Other phase| SKIP1[Return early:<br/>gate not met]
    EX1 --> SF2
    SKIP1 --> SF2

    SF2[2. Contextual Grounding<br/>Workflow]
    SF2 --> G2{Phase gate?}
    G2 -->|history_building| EX2[Execute:<br/>Assess timeline anchors<br/>Create requirements]
    G2 -->|Other phase| SKIP2[Return early:<br/>gate not met]
    EX2 --> SF3
    SKIP2 --> SF3

    SF3[3. Section Selection<br/>Workflow]
    SF3 --> G3{Phase gate?}
    G3 -->|history_building AND<br/>contextual_grounding_complete| EX3[Execute:<br/>Create section<br/>selection requirement]
    G3 -->|Gates not met| SKIP3[Return early]
    EX3 --> SF4
    SKIP3 --> SF4

    SF4[4. Lane Development<br/>Workflow]
    SF4 --> G4{Phase gate?}
    G4 -->|story_capture AND<br/>sections_selected| EX4[Execute:<br/>Analyze gaps<br/>Lodge requirements]
    G4 -->|Gates not met| SKIP4[Return early]
    EX4 --> SF5
    SKIP4 --> SF5

    SF5[5. Archetype Assessment<br/>Workflow]
    SF5 --> G5{Phase gate?}
    G5 -->|story_capture AND<br/>session_count >= 4 AND<br/>session_count % 3 == 0| EX5[Execute:<br/>Multi-archetype analysis<br/>Lodge refinement requirements]
    G5 -->|Gates not met| SKIP5[Return early]
    EX5 --> SF6
    SKIP5 --> SF6

    SF6[6. Synthesis<br/>Workflow]
    SF6 --> G6{Material gate?}
    G6 -->|story_capture AND<br/>section has sufficient material| EX6[Execute:<br/>Create provisional draft<br/>Assemble collection]
    G6 -->|Gates not met| SKIP6[Return early]
    EX6 --> SF7
    SKIP6 --> SF7

    SF7[7. Composition<br/>Workflow]
    SF7 --> G7{Sufficiency gates?}
    G7 -->|All gates passed:<br/>archetype resolved<br/>material threshold<br/>character dev<br/>thematic coherence| EX7[Execute:<br/>Create chapters<br/>Compose prose]
    G7 -->|Gates not met| SKIP7[Return early]
    EX7 --> SF8
    SKIP7 --> SF8

    SF8[8. Editor<br/>Workflow]
    SF8 --> G8{Story exists?}
    G8 -->|story_exists AND<br/>chapters_created| EX8[Execute:<br/>Quality assessment<br/>Lodge edit requirements]
    G8 -->|Gates not met| SKIP8[Return early]
    EX8 --> DETERMINE
    SKIP8 --> DETERMINE

    DETERMINE[Determine Next Action<br/>Based on State]
    DETERMINE --> ACTION{State?}
    ACTION -->|Pending requirements| SCHED[Schedule/Continue<br/>Session]
    ACTION -->|No pending + complete| EXPORT[Story Complete]
    ACTION -->|No pending + not complete| REVIEW[Review Needed]

    SCHED --> OUTPUT[Output:<br/>Next Action]
    EXPORT --> OUTPUT
    REVIEW --> OUTPUT

    style START fill:#3498db,color:#fff
    style RUN fill:#4a90e2,color:#fff
    style EX1 fill:#27ae60,color:#fff
    style EX2 fill:#27ae60,color:#fff
    style EX3 fill:#27ae60,color:#fff
    style EX4 fill:#27ae60,color:#fff
    style EX5 fill:#27ae60,color:#fff
    style EX6 fill:#27ae60,color:#fff
    style EX7 fill:#27ae60,color:#fff
    style EX8 fill:#27ae60,color:#fff
    style SKIP1 fill:#95a5a6
    style SKIP2 fill:#95a5a6
    style SKIP3 fill:#95a5a6
    style SKIP4 fill:#95a5a6
    style SKIP5 fill:#95a5a6
    style SKIP6 fill:#95a5a6
    style SKIP7 fill:#95a5a6
    style SKIP8 fill:#95a5a6
    style OUTPUT fill:#e74c3c,color:#fff
```

---

## 9. Subflows: Trust Building Sequence

```mermaid
sequenceDiagram
    participant AF as Analyst Flow
    participant SW as All Subflows
    participant TB as Trust Building<br/>Subflow
    participant ST as Storyteller State

    Note over AF: Analyst Triggered
    AF->>SW: Run ALL Subflows
    SW->>TB: Trust Building checks gate

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

    Note over TB,ST: Complete
    TB->>ST: Update phase to<br/>history_building

    Note over SW: Other subflows run<br/>(all gate early)

    Note over AF: Determine next action
```

---

## 10. Subflows: Lane Development (The Engine)

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

## 11. Requirements Workflow: Story Capture (Real-Time)

```mermaid
sequenceDiagram
    participant AF as Analyst Flow
    participant SW as All Subflows
    participant RT as requirement<br/>Table
    participant VAPI as VAPI Agent
    participant ST as Storyteller

    Note over AF: Analyst Triggered
    AF->>SW: Run ALL Subflows

    Note over SW: Lane Development<br/>Subflow Executes
    SW->>SW: Analyze section<br/>material
    SW->>SW: Identify gaps:<br/>- Sensory detail<br/>- Character insight<br/>- Timeline clarity

    Note over SW,RT: Lodge Requirements
    SW->>RT: CREATE requirement<br/>type: sensory_detail<br/>priority: critical<br/>status: pending<br/>suggested_prompts: [...]

    Note over VAPI: VAPI Session
    VAPI->>RT: Fetch pending<br/>requirements
    RT-->>VAPI: Requirement list

    Note over VAPI,ST: Interview
    VAPI->>ST: "What did grandmother's<br/>house smell like?"
    ST-->>VAPI: "Pine needles, fresh bread,<br/>her lavender perfume..."

    Note over VAPI: submit_requirement_result()
    VAPI->>RT: UPDATE requirement<br/>status: addressed<br/>result: {sensory_details: [...]}
    VAPI->>RT: ADD transcript_segment<br/>{agent_utterance, user_utterance,<br/>timestamp, duration}

    Note over VAPI,ST: Apply Side Effects
    VAPI->>ST: Create life_event<br/>with sensory details
    VAPI->>ST: Update section progress

    Note over VAPI,AF: IMMEDIATE TRIGGER
    VAPI->>AF: Trigger Analyst Flow

    Note over AF: Analyst Runs Again
    AF->>SW: Run ALL Subflows
    SW->>SW: Reassess state
    SW->>RT: Validate requirement<br/>addressed → resolved

    Note over RT: Requirement Lifecycle<br/>pending → addressed → resolved<br/>(Real-time during session)
```

---

## 12. Requirements Workflow: Composition Quality

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

## 13. Data Flow: Complete Journey

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

## 14. Implementation Phases

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

## 15. Progressive Section Unlocking

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

## 16. State Transitions

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
