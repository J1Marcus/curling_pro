# Analyst Flow Implementation - Auto-Claude Task Definitions

This document provides detailed auto-claude task definitions for each subflow in the Analyst Flow Implementation (Section 2.1 from WBS).

---

## Task 002: Onboarding Subflow (2.1.1)

### requirements.json
```json
{
  "task_description": "Implement the onboarding subflow for new storytellers including welcome node with storyteller creation, demographics capture validation, consent and privacy acknowledgment, and collection scaffolding logic. This is the entry point for new users into the Everbound memoir platform.",
  "workflow_type": "feature"
}
```

### complexity_assessment.json
```json
{
  "complexity": "standard",
  "workflow_type": "feature",
  "confidence": 0.80,
  "reasoning": "Standard workflow implementation using GenAI Launchpad framework. Requires creating workflow nodes, API endpoints, and form validation. Patterns exist from existing workflow implementations. Main complexity is integrating with existing Storyteller model and ensuring proper state transitions.",

  "analysis": {
    "scope": {
      "estimated_files": 8,
      "estimated_services": 1,
      "is_cross_cutting": false,
      "notes": "Workflow definition, 3-4 workflow nodes (WelcomeNode, DemographicsCaptureNode, ConsentNode, CollectionScaffoldingNode), API endpoints for storyteller creation, validation logic, integration with database models"
    },
    "integrations": {
      "external_services": [],
      "new_dependencies": [],
      "research_needed": false,
      "notes": "Uses existing GenAI Launchpad workflow engine, existing Storyteller/Collection models from database layer"
    },
    "infrastructure": {
      "docker_changes": false,
      "database_changes": false,
      "config_changes": false,
      "notes": "Database schema already exists (Storyteller, Collection models). No infrastructure changes needed."
    },
    "knowledge": {
      "patterns_exist": true,
      "research_required": false,
      "unfamiliar_tech": [],
      "notes": "GenAI Launchpad workflow patterns should be established in Phase 1 (Sprints 1-2). Can reference existing workflow node implementations."
    },
    "risk": {
      "level": "low",
      "concerns": [
        "Form validation for demographics must be robust",
        "Consent flow must be legally compliant",
        "Collection scaffolding must create correct life period structure",
        "State transitions must be atomic (all-or-nothing)"
      ],
      "notes": "Low risk as this is a greenfield implementation with no legacy to consider. Clear requirements from WBS."
    }
  },

  "recommended_phases": [
    "discovery",
    "requirements",
    "context",
    "spec_writing",
    "planning",
    "validation"
  ],

  "flags": {
    "needs_research": false,
    "needs_self_critique": false,
    "needs_infrastructure_setup": false
  },

  "validation_recommendations": {
    "risk_level": "low",
    "skip_validation": false,
    "minimal_mode": false,
    "test_types_required": ["unit", "integration"],
    "security_scan_required": false,
    "staging_deployment_required": true,
    "reasoning": "User-facing onboarding flow requires thorough testing. Unit tests for validation logic, integration tests for workflow execution, staging deployment to verify user experience."
  }
}
```

### Implementation Plan Structure
```json
{
  "feature": "Onboarding Subflow Implementation",
  "workflow_type": "feature",
  "workflow_rationale": "Implements the first user-facing flow in the Analyst Flow, establishing the foundation for storyteller journeys",
  "phases": [
    {
      "id": "phase-1-workflow-definition",
      "name": "Workflow Schema Definition",
      "type": "setup",
      "description": "Define the onboarding workflow schema using GenAI Launchpad framework",
      "depends_on": [],
      "parallel_safe": false,
      "subtasks": [
        {
          "id": "subtask-1-1",
          "description": "Create onboarding_workflow.py with WorkflowSchema definition",
          "service": "main",
          "files_to_create": ["app/workflows/onboarding_workflow.py"],
          "patterns_from": ["GenAI Launchpad workflow examples"],
          "verification": {
            "type": "command",
            "command": "python -c \"from workflows.onboarding_workflow import OnboardingWorkflow; print('OK')\"",
            "expected": "OK"
          }
        }
      ]
    },
    {
      "id": "phase-2-workflow-nodes",
      "name": "Workflow Node Implementation",
      "type": "implementation",
      "description": "Implement the 4 core nodes for onboarding flow",
      "depends_on": ["phase-1-workflow-definition"],
      "parallel_safe": true,
      "subtasks": [
        {
          "id": "subtask-2-1",
          "description": "Create WelcomeNode - greet user and initialize storyteller record",
          "files_to_create": ["app/workflows/nodes/onboarding/welcome_node.py"],
          "verification": {
            "type": "unit_test",
            "command": "pytest tests/workflows/nodes/test_welcome_node.py",
            "expected": "All tests pass"
          }
        },
        {
          "id": "subtask-2-2",
          "description": "Create DemographicsCaptureNode - collect and validate demographics",
          "files_to_create": ["app/workflows/nodes/onboarding/demographics_capture_node.py"],
          "verification": {
            "type": "unit_test",
            "command": "pytest tests/workflows/nodes/test_demographics_capture_node.py",
            "expected": "All tests pass"
          }
        },
        {
          "id": "subtask-2-3",
          "description": "Create ConsentNode - handle consent and privacy acknowledgment",
          "files_to_create": ["app/workflows/nodes/onboarding/consent_node.py"],
          "verification": {
            "type": "unit_test",
            "command": "pytest tests/workflows/nodes/test_consent_node.py",
            "expected": "All tests pass"
          }
        },
        {
          "id": "subtask-2-4",
          "description": "Create CollectionScaffoldingNode - scaffold life period collections",
          "files_to_create": ["app/workflows/nodes/onboarding/collection_scaffolding_node.py"],
          "verification": {
            "type": "unit_test",
            "command": "pytest tests/workflows/nodes/test_collection_scaffolding_node.py",
            "expected": "All tests pass"
          }
        }
      ]
    },
    {
      "id": "phase-3-api-endpoints",
      "name": "API Endpoints",
      "type": "implementation",
      "description": "Create FastAPI endpoints to trigger and monitor onboarding workflow",
      "depends_on": ["phase-2-workflow-nodes"],
      "parallel_safe": false,
      "subtasks": [
        {
          "id": "subtask-3-1",
          "description": "Create POST /api/v1/onboarding endpoint to initiate workflow",
          "files_to_create": ["app/api/v1/onboarding.py"],
          "verification": {
            "type": "integration_test",
            "command": "pytest tests/api/test_onboarding_endpoints.py::test_post_onboarding",
            "expected": "201 Created with workflow_id"
          }
        },
        {
          "id": "subtask-3-2",
          "description": "Create GET /api/v1/onboarding/{workflow_id} endpoint to check status",
          "files_to_modify": ["app/api/v1/onboarding.py"],
          "verification": {
            "type": "integration_test",
            "command": "pytest tests/api/test_onboarding_endpoints.py::test_get_onboarding_status",
            "expected": "200 OK with workflow status"
          }
        }
      ]
    },
    {
      "id": "phase-4-validation",
      "name": "Validation & Error Handling",
      "type": "implementation",
      "description": "Add comprehensive validation and error handling",
      "depends_on": ["phase-3-api-endpoints"],
      "parallel_safe": false,
      "subtasks": [
        {
          "id": "subtask-4-1",
          "description": "Implement Pydantic schemas for demographics validation",
          "files_to_create": ["app/schemas/onboarding.py"],
          "verification": {
            "type": "unit_test",
            "command": "pytest tests/schemas/test_onboarding_schemas.py",
            "expected": "All validation tests pass"
          }
        },
        {
          "id": "subtask-4-2",
          "description": "Add error recovery logic for workflow failures",
          "files_to_modify": ["app/workflows/onboarding_workflow.py"],
          "verification": {
            "type": "integration_test",
            "command": "pytest tests/workflows/test_onboarding_error_handling.py",
            "expected": "Workflow recovers from transient failures"
          }
        }
      ]
    },
    {
      "id": "phase-5-integration",
      "name": "End-to-End Integration",
      "type": "integration",
      "description": "Integrate all components and run E2E tests",
      "depends_on": ["phase-4-validation"],
      "parallel_safe": false,
      "subtasks": [
        {
          "id": "subtask-5-1",
          "description": "Run full onboarding workflow E2E test",
          "verification": {
            "type": "e2e_test",
            "command": "pytest tests/e2e/test_onboarding_flow.py",
            "expected": "Complete workflow creates storyteller + collections in <30s"
          }
        }
      ]
    }
  ],
  "summary": {
    "total_phases": 5,
    "total_subtasks": 9,
    "services_involved": ["main"],
    "estimated_story_points": 8
  }
}
```

---

## Task 003: Phase Assessment Subflow (2.1.2)

### requirements.json
```json
{
  "task_description": "Implement the phase assessment subflow for the Analyst Flow. This includes gap analysis node implementation, coverage assessment logic, priority recommendation engine, and requirements generation for story capture. The assessment determines what storyteller should work on next based on their current material.",
  "workflow_type": "feature"
}
```

### complexity_assessment.json
```json
{
  "complexity": "complex",
  "workflow_type": "feature",
  "confidence": 0.70,
  "reasoning": "This is a complex AI-driven assessment workflow requiring LLM integration for gap analysis, sophisticated logic for evaluating storyteller material completeness, and strategic requirement generation. Requires deep integration with Requirements Table and understanding of canonical process phases.",

  "analysis": {
    "scope": {
      "estimated_files": 12,
      "estimated_services": 1,
      "is_cross_cutting": true,
      "notes": "Core Analyst Flow logic. Touches storyteller_progress, requirement table, life_event analysis, collection evaluation. Requires LLM service integration for intelligent assessment."
    },
    "integrations": {
      "external_services": ["Google Gemini (via LLM service)"],
      "new_dependencies": [],
      "research_needed": true,
      "notes": "Requires understanding prompt engineering for gap analysis. Must integrate with existing LLM service. Needs research on effective assessment prompts."
    },
    "infrastructure": {
      "docker_changes": false,
      "database_changes": false,
      "config_changes": false,
      "notes": "Uses existing database tables (storyteller_progress, requirement). No infrastructure changes."
    },
    "knowledge": {
      "patterns_exist": false,
      "research_required": true,
      "unfamiliar_tech": [],
      "notes": "Gap analysis and coverage assessment are novel features. Requires designing algorithms for determining material sufficiency, identifying gaps, and prioritizing next steps."
    },
    "risk": {
      "level": "high",
      "concerns": [
        "LLM output reliability for gap analysis",
        "Determining 'sufficiency' is subjective - needs clear heuristics",
        "Requirement generation must be actionable and clear",
        "Performance: assessment must complete in <60s per WBS",
        "Must handle edge cases: new storytellers vs. active storytellers"
      ],
      "notes": "High complexity due to AI/LLM integration and novel assessment logic. This is core business logic of the Analyst Flow."
    }
  },

  "recommended_phases": [
    "discovery",
    "requirements",
    "context",
    "spec_writing",
    "planning",
    "validation",
    "research"
  ],

  "flags": {
    "needs_research": true,
    "needs_self_critique": true,
    "needs_infrastructure_setup": false
  },

  "validation_recommendations": {
    "risk_level": "high",
    "skip_validation": false,
    "minimal_mode": false,
    "test_types_required": ["unit", "integration", "e2e"],
    "security_scan_required": false,
    "staging_deployment_required": true,
    "reasoning": "Core business logic requiring extensive testing. LLM integration needs mocking for tests. E2E tests critical to ensure assessment quality. Performance testing required (<60s SLA)."
  }
}
```

### Implementation Plan Structure
```json
{
  "feature": "Phase Assessment Subflow Implementation",
  "workflow_type": "feature",
  "workflow_rationale": "Core Analyst Flow intelligence - assesses storyteller state and determines next actions",
  "phases": [
    {
      "id": "phase-1-assessment-engine",
      "name": "Assessment Engine Core",
      "type": "implementation",
      "description": "Build the core assessment engine that evaluates storyteller material",
      "depends_on": [],
      "parallel_safe": false,
      "subtasks": [
        {
          "id": "subtask-1-1",
          "description": "Create PhaseAssessmentEngine class with material evaluation logic",
          "files_to_create": ["app/services/assessment/phase_assessment_engine.py"],
          "patterns_from": ["LLM service patterns"]
        },
        {
          "id": "subtask-1-2",
          "description": "Implement phase determination logic (trust/scope/context/capture/composition)",
          "files_to_modify": ["app/services/assessment/phase_assessment_engine.py"]
        }
      ]
    },
    {
      "id": "phase-2-gap-analysis",
      "name": "Gap Analysis Implementation",
      "type": "implementation",
      "description": "Implement LLM-powered gap analysis to identify missing material",
      "depends_on": ["phase-1-assessment-engine"],
      "parallel_safe": false,
      "subtasks": [
        {
          "id": "subtask-2-1",
          "description": "Create GapAnalysisNode using LLM service to identify content gaps",
          "files_to_create": ["app/workflows/nodes/analyst/gap_analysis_node.py"]
        },
        {
          "id": "subtask-2-2",
          "description": "Design and implement gap analysis prompts for Gemini",
          "files_to_create": ["app/prompts/analyst/gap_analysis_prompts.py"]
        },
        {
          "id": "subtask-2-3",
          "description": "Create Pydantic schemas for gap analysis responses",
          "files_to_create": ["app/schemas/analyst/gap_analysis.py"]
        }
      ]
    },
    {
      "id": "phase-3-coverage-assessment",
      "name": "Coverage Assessment Logic",
      "type": "implementation",
      "description": "Assess coverage of life periods, themes, and sections",
      "depends_on": ["phase-1-assessment-engine"],
      "parallel_safe": true,
      "subtasks": [
        {
          "id": "subtask-3-1",
          "description": "Create CoverageAssessmentNode to evaluate collection completeness",
          "files_to_create": ["app/workflows/nodes/analyst/coverage_assessment_node.py"]
        },
        {
          "id": "subtask-3-2",
          "description": "Implement heuristics for determining section sufficiency",
          "files_to_create": ["app/services/assessment/sufficiency_heuristics.py"]
        }
      ]
    },
    {
      "id": "phase-4-priority-engine",
      "name": "Priority Recommendation Engine",
      "type": "implementation",
      "description": "Determine priority of identified gaps (critical/important/optional)",
      "depends_on": ["phase-2-gap-analysis", "phase-3-coverage-assessment"],
      "parallel_safe": false,
      "subtasks": [
        {
          "id": "subtask-4-1",
          "description": "Create PriorityRecommendationNode with priority scoring logic",
          "files_to_create": ["app/workflows/nodes/analyst/priority_recommendation_node.py"]
        },
        {
          "id": "subtask-4-2",
          "description": "Implement priority scoring algorithm based on gaps and coverage",
          "files_to_create": ["app/services/assessment/priority_scoring.py"]
        }
      ]
    },
    {
      "id": "phase-5-requirement-generation",
      "name": "Requirements Generation",
      "type": "implementation",
      "description": "Generate actionable requirements and lodge them in Requirements Table",
      "depends_on": ["phase-4-priority-engine"],
      "parallel_safe": false,
      "subtasks": [
        {
          "id": "subtask-5-1",
          "description": "Create RequirementGenerationNode to create requirement records",
          "files_to_create": ["app/workflows/nodes/analyst/requirement_generation_node.py"]
        },
        {
          "id": "subtask-5-2",
          "description": "Implement requirement templating system for different gap types",
          "files_to_create": ["app/services/assessment/requirement_templates.py"]
        },
        {
          "id": "subtask-5-3",
          "description": "Create repository methods for requirement CRUD operations",
          "files_to_create": ["app/repositories/requirement_repository.py"]
        }
      ]
    },
    {
      "id": "phase-6-workflow-integration",
      "name": "Workflow Integration",
      "type": "integration",
      "description": "Integrate all nodes into complete phase assessment workflow",
      "depends_on": ["phase-5-requirement-generation"],
      "parallel_safe": false,
      "subtasks": [
        {
          "id": "subtask-6-1",
          "description": "Create phase_assessment_workflow.py with all nodes orchestrated",
          "files_to_create": ["app/workflows/phase_assessment_workflow.py"]
        },
        {
          "id": "subtask-6-2",
          "description": "Add API endpoint POST /api/v1/analyst/assess to trigger workflow",
          "files_to_create": ["app/api/v1/analyst.py"]
        },
        {
          "id": "subtask-6-3",
          "description": "Run E2E test: assessment completes in <60s and lodges requirements",
          "verification": {
            "type": "e2e_test",
            "command": "pytest tests/e2e/test_phase_assessment_flow.py",
            "expected": "Assessment completes in <60s, requirements lodged"
          }
        }
      ]
    }
  ],
  "summary": {
    "total_phases": 6,
    "total_subtasks": 13,
    "services_involved": ["main"],
    "estimated_story_points": 13
  }
}
```

---

## Task 004: Session Planning Subflow (2.1.3)

### requirements.json
```json
{
  "task_description": "Implement the session planning subflow that automatically plans conversation sessions for storytellers. Includes session template creation with target collection, opening question generation based on requirements, session context preparation with relevant prior stories, and handoff to Session Flow for execution.",
  "workflow_type": "feature"
}
```

### complexity_assessment.json
```json
{
  "complexity": "standard",
  "workflow_type": "feature",
  "confidence": 0.75,
  "reasoning": "Standard workflow with LLM integration for question generation. Moderate complexity due to context preparation (semantic search on prior stories) and session template design. Clear inputs/outputs defined in WBS.",

  "analysis": {
    "scope": {
      "estimated_files": 10,
      "estimated_services": 1,
      "is_cross_cutting": true,
      "notes": "Bridges Analyst Flow and Session Flow. Requires integration with Requirements Table, session templates, and LLM service for question generation."
    },
    "integrations": {
      "external_services": ["Google Gemini (via LLM service)"],
      "new_dependencies": [],
      "research_needed": false,
      "notes": "Uses existing LLM service. May need semantic search capabilities (vector embeddings) for context preparation - research if not already implemented."
    },
    "infrastructure": {
      "docker_changes": false,
      "database_changes": false,
      "config_changes": false,
      "notes": "Uses existing session, requirement, life_event tables."
    },
    "knowledge": {
      "patterns_exist": true,
      "research_required": false,
      "unfamiliar_tech": [],
      "notes": "Similar to phase assessment - uses LLM for generation. Session template patterns likely exist."
    },
    "risk": {
      "level": "medium",
      "concerns": [
        "Question generation quality - must be relevant and trauma-informed",
        "Context preparation: semantic search may need vector embeddings",
        "Handoff to Session Flow must be atomic and clear",
        "Performance: planning must complete in <45s per WBS"
      ],
      "notes": "Medium risk due to LLM quality concerns and potential semantic search complexity."
    }
  },

  "recommended_phases": [
    "discovery",
    "requirements",
    "context",
    "spec_writing",
    "planning",
    "validation"
  ],

  "flags": {
    "needs_research": false,
    "needs_self_critique": false,
    "needs_infrastructure_setup": false
  },

  "validation_recommendations": {
    "risk_level": "medium",
    "skip_validation": false,
    "minimal_mode": false,
    "test_types_required": ["unit", "integration"],
    "security_scan_required": false,
    "staging_deployment_required": true,
    "reasoning": "Session planning quality affects storyteller experience. Integration tests needed to verify handoff to Session Flow. Performance testing required (<45s SLA)."
  }
}
```

### Implementation Plan Structure
```json
{
  "feature": "Session Planning Subflow Implementation",
  "workflow_type": "feature",
  "workflow_rationale": "Prepares goal-oriented sessions by generating relevant questions and context for storytellers",
  "phases": [
    {
      "id": "phase-1-template-system",
      "name": "Session Template System",
      "type": "implementation",
      "description": "Create session template system with collection targeting",
      "depends_on": [],
      "parallel_safe": false,
      "subtasks": [
        {
          "id": "subtask-1-1",
          "description": "Create SessionTemplate model and repository methods",
          "files_to_create": ["app/repositories/session_template_repository.py"]
        },
        {
          "id": "subtask-1-2",
          "description": "Implement template selection logic based on collection and section",
          "files_to_create": ["app/services/session_planning/template_selector.py"]
        }
      ]
    },
    {
      "id": "phase-2-question-generation",
      "name": "Opening Question Generation",
      "type": "implementation",
      "description": "LLM-powered question generation from requirements",
      "depends_on": ["phase-1-template-system"],
      "parallel_safe": false,
      "subtasks": [
        {
          "id": "subtask-2-1",
          "description": "Create QuestionGenerationNode using LLM service",
          "files_to_create": ["app/workflows/nodes/analyst/question_generation_node.py"]
        },
        {
          "id": "subtask-2-2",
          "description": "Design trauma-informed question generation prompts",
          "files_to_create": ["app/prompts/analyst/question_generation_prompts.py"]
        },
        {
          "id": "subtask-2-3",
          "description": "Create Pydantic schemas for question generation responses",
          "files_to_create": ["app/schemas/analyst/question_generation.py"]
        }
      ]
    },
    {
      "id": "phase-3-context-preparation",
      "name": "Session Context Preparation",
      "type": "implementation",
      "description": "Prepare session context with relevant prior stories and life events",
      "depends_on": ["phase-1-template-system"],
      "parallel_safe": true,
      "subtasks": [
        {
          "id": "subtask-3-1",
          "description": "Create ContextPreparationNode to gather relevant prior material",
          "files_to_create": ["app/workflows/nodes/analyst/context_preparation_node.py"]
        },
        {
          "id": "subtask-3-2",
          "description": "Implement semantic search on prior stories (or simple keyword search if no embeddings)",
          "files_to_create": ["app/services/session_planning/context_retrieval.py"]
        },
        {
          "id": "subtask-3-3",
          "description": "Create context summary formatter for session handoff",
          "files_to_create": ["app/services/session_planning/context_formatter.py"]
        }
      ]
    },
    {
      "id": "phase-4-workflow-integration",
      "name": "Workflow Integration & Handoff",
      "type": "integration",
      "description": "Integrate all components and implement handoff to Session Flow",
      "depends_on": ["phase-2-question-generation", "phase-3-context-preparation"],
      "parallel_safe": false,
      "subtasks": [
        {
          "id": "subtask-4-1",
          "description": "Create session_planning_workflow.py orchestrating all nodes",
          "files_to_create": ["app/workflows/session_planning_workflow.py"]
        },
        {
          "id": "subtask-4-2",
          "description": "Implement handoff logic to Session Flow with session context",
          "files_to_create": ["app/services/session_planning/session_handoff.py"]
        },
        {
          "id": "subtask-4-3",
          "description": "Add API endpoint POST /api/v1/analyst/plan-session",
          "files_to_modify": ["app/api/v1/analyst.py"]
        },
        {
          "id": "subtask-4-4",
          "description": "Run E2E test: session planning completes in <45s and creates session",
          "verification": {
            "type": "e2e_test",
            "command": "pytest tests/e2e/test_session_planning_flow.py",
            "expected": "Planning completes in <45s, session created with context"
          }
        }
      ]
    }
  ],
  "summary": {
    "total_phases": 4,
    "total_subtasks": 11,
    "services_involved": ["main"],
    "estimated_story_points": 8
  }
}
```

---

## Task 005: Post-Session Analysis Subflow (2.1.4)

### requirements.json
```json
{
  "task_description": "Implement the post-session analysis subflow that processes session transcripts after VAPI calls. Includes session transcript processing, life event extraction with dates/locations/people, story candidate identification, multi-archetype assessment, and requirements table updates with new context.",
  "workflow_type": "feature"
}
```

### complexity_assessment.json
```json
{
  "complexity": "complex",
  "workflow_type": "feature",
  "confidence": 0.65,
  "reasoning": "Highly complex AI-driven workflow requiring sophisticated NLP/LLM processing of transcripts. Must extract structured data (life events, dates, locations, participants) from unstructured conversation text. Multi-archetype assessment is novel and complex. Critical for quality of storyteller experience.",

  "analysis": {
    "scope": {
      "estimated_files": 15,
      "estimated_services": 1,
      "is_cross_cutting": true,
      "notes": "Processes session transcripts to extract life events, story candidates, and archetype signals. Touches session, life_event, archetype_analysis, requirement tables. Complex LLM orchestration."
    },
    "integrations": {
      "external_services": ["Google Gemini (via LLM service)"],
      "new_dependencies": [],
      "research_needed": true,
      "notes": "Requires research on effective extraction prompts, archetype assessment methodology, and handling of multi-archetype refinement (exploring → narrowing → resolved)."
    },
    "infrastructure": {
      "docker_changes": false,
      "database_changes": false,
      "config_changes": false,
      "notes": "Uses existing tables. May need to validate archetype_analysis table structure for multi-archetype tracking."
    },
    "knowledge": {
      "patterns_exist": false,
      "research_required": true,
      "unfamiliar_tech": [],
      "notes": "Multi-archetype assessment is a novel feature requiring careful design. NLP extraction from transcripts may need specialized prompting techniques."
    },
    "risk": {
      "level": "high",
      "concerns": [
        "LLM extraction accuracy: dates, locations, people must be correct",
        "Transcript quality varies (speaker diarization, audio quality)",
        "Multi-archetype assessment complexity (3-tier refinement)",
        "Performance: must complete in <90s for 30-min session per WBS",
        "Privacy: trauma-sensitive material must be handled carefully"
      ],
      "notes": "Highest complexity task in Analyst Flow. Core business logic with quality implications."
    }
  },

  "recommended_phases": [
    "discovery",
    "requirements",
    "context",
    "spec_writing",
    "planning",
    "validation",
    "research"
  ],

  "flags": {
    "needs_research": true,
    "needs_self_critique": true,
    "needs_infrastructure_setup": false
  },

  "validation_recommendations": {
    "risk_level": "high",
    "skip_validation": false,
    "minimal_mode": false,
    "test_types_required": ["unit", "integration", "e2e"],
    "security_scan_required": true,
    "staging_deployment_required": true,
    "reasoning": "Critical business logic handling sensitive data. Requires extensive testing with mock transcripts. Security scan for PII handling. Performance testing crucial (<90s SLA). E2E tests with realistic transcripts essential."
  }
}
```

### Implementation Plan Structure
```json
{
  "feature": "Post-Session Analysis Subflow Implementation",
  "workflow_type": "feature",
  "workflow_rationale": "Extracts valuable structured data from session transcripts and assesses storyteller archetype patterns",
  "phases": [
    {
      "id": "phase-1-transcript-processing",
      "name": "Transcript Processing Foundation",
      "type": "implementation",
      "description": "Build transcript processing pipeline for cleaning and segmenting",
      "depends_on": [],
      "parallel_safe": false,
      "subtasks": [
        {
          "id": "subtask-1-1",
          "description": "Create TranscriptProcessor service for cleaning and segmentation",
          "files_to_create": ["app/services/analysis/transcript_processor.py"]
        },
        {
          "id": "subtask-1-2",
          "description": "Implement speaker diarization parsing and turn segmentation",
          "files_to_modify": ["app/services/analysis/transcript_processor.py"]
        }
      ]
    },
    {
      "id": "phase-2-life-event-extraction",
      "name": "Life Event Extraction",
      "type": "implementation",
      "description": "LLM-powered extraction of life events with temporal and spatial data",
      "depends_on": ["phase-1-transcript-processing"],
      "parallel_safe": false,
      "subtasks": [
        {
          "id": "subtask-2-1",
          "description": "Create LifeEventExtractionNode using LLM for event identification",
          "files_to_create": ["app/workflows/nodes/analyst/life_event_extraction_node.py"]
        },
        {
          "id": "subtask-2-2",
          "description": "Design extraction prompts for dates, locations, participants",
          "files_to_create": ["app/prompts/analyst/life_event_extraction_prompts.py"]
        },
        {
          "id": "subtask-2-3",
          "description": "Create Pydantic schemas for life event extraction responses",
          "files_to_create": ["app/schemas/analyst/life_event_extraction.py"]
        },
        {
          "id": "subtask-2-4",
          "description": "Implement life event persistence with child tables (timespan, location, participant)",
          "files_to_create": ["app/services/analysis/life_event_persister.py"]
        }
      ]
    },
    {
      "id": "phase-3-story-candidate-identification",
      "name": "Story Candidate Identification",
      "type": "implementation",
      "description": "Identify promising story candidates from transcript",
      "depends_on": ["phase-2-life-event-extraction"],
      "parallel_safe": true,
      "subtasks": [
        {
          "id": "subtask-3-1",
          "description": "Create StoryCandidateNode to identify story-worthy moments",
          "files_to_create": ["app/workflows/nodes/analyst/story_candidate_node.py"]
        },
        {
          "id": "subtask-3-2",
          "description": "Design story candidate identification prompts (narrative arc, emotional resonance)",
          "files_to_create": ["app/prompts/analyst/story_candidate_prompts.py"]
        }
      ]
    },
    {
      "id": "phase-4-archetype-assessment",
      "name": "Multi-Archetype Assessment",
      "type": "implementation",
      "description": "Implement multi-archetype assessment with 3-tier refinement (exploring/narrowing/resolved)",
      "depends_on": ["phase-2-life-event-extraction"],
      "parallel_safe": true,
      "subtasks": [
        {
          "id": "subtask-4-1",
          "description": "Create ArchetypeAssessmentNode with multi-candidate tracking",
          "files_to_create": ["app/workflows/nodes/analyst/archetype_assessment_node.py"]
        },
        {
          "id": "subtask-4-2",
          "description": "Implement archetype refinement logic (exploring → narrowing → resolved)",
          "files_to_create": ["app/services/analysis/archetype_refinement.py"]
        },
        {
          "id": "subtask-4-3",
          "description": "Design archetype assessment prompts for candidate identification",
          "files_to_create": ["app/prompts/analyst/archetype_assessment_prompts.py"]
        },
        {
          "id": "subtask-4-4",
          "description": "Create archetype_analysis repository with multi-candidate queries",
          "files_to_create": ["app/repositories/archetype_analysis_repository.py"]
        }
      ]
    },
    {
      "id": "phase-5-requirement-updates",
      "name": "Requirements Table Updates",
      "type": "implementation",
      "description": "Update requirements based on new context from session",
      "depends_on": ["phase-2-life-event-extraction", "phase-4-archetype-assessment"],
      "parallel_safe": false,
      "subtasks": [
        {
          "id": "subtask-5-1",
          "description": "Create RequirementUpdateNode to mark addressed and create new requirements",
          "files_to_create": ["app/workflows/nodes/analyst/requirement_update_node.py"]
        },
        {
          "id": "subtask-5-2",
          "description": "Implement archetype-aware requirement generation (discriminating/validating/strengthening)",
          "files_to_create": ["app/services/analysis/archetype_aware_requirements.py"]
        }
      ]
    },
    {
      "id": "phase-6-workflow-integration",
      "name": "Workflow Integration",
      "type": "integration",
      "description": "Integrate all analysis components into complete workflow",
      "depends_on": ["phase-3-story-candidate-identification", "phase-5-requirement-updates"],
      "parallel_safe": false,
      "subtasks": [
        {
          "id": "subtask-6-1",
          "description": "Create post_session_analysis_workflow.py orchestrating all nodes",
          "files_to_create": ["app/workflows/post_session_analysis_workflow.py"]
        },
        {
          "id": "subtask-6-2",
          "description": "Add API endpoint POST /api/v1/analyst/analyze-session",
          "files_to_modify": ["app/api/v1/analyst.py"]
        },
        {
          "id": "subtask-6-3",
          "description": "Implement webhook handler for VAPI transcript completion",
          "files_to_create": ["app/api/webhooks/vapi_webhooks.py"]
        },
        {
          "id": "subtask-6-4",
          "description": "Run E2E test: analysis completes in <90s for 30-min transcript",
          "verification": {
            "type": "e2e_test",
            "command": "pytest tests/e2e/test_post_session_analysis_flow.py",
            "expected": "Analysis completes in <90s, life events + archetypes extracted"
          }
        }
      ]
    }
  ],
  "summary": {
    "total_phases": 6,
    "total_subtasks": 17,
    "services_involved": ["main"],
    "estimated_story_points": 13
  }
}
```

---

## Task 006: Composition Trigger Subflow (2.1.5)

### requirements.json
```json
{
  "task_description": "Implement the composition trigger subflow that evaluates when a story is ready for composition. Includes composition readiness evaluation, edit requirements generation for Editor Flow, story selection for composition, and handoff to Editor Flow.",
  "workflow_type": "feature"
}
```

### complexity_assessment.json
```json
{
  "complexity": "standard",
  "workflow_type": "feature",
  "confidence": 0.80,
  "reasoning": "Standard workflow with business logic for evaluating story readiness. Moderate complexity due to sufficiency evaluation heuristics and handoff to Editor Flow. Clear acceptance criteria in WBS (<30s completion time).",

  "analysis": {
    "scope": {
      "estimated_files": 8,
      "estimated_services": 1,
      "is_cross_cutting": true,
      "notes": "Bridges Analyst Flow and Editor Flow. Evaluates story readiness and triggers composition. Touches requirement, edit_requirement, story, life_event tables."
    },
    "integrations": {
      "external_services": [],
      "new_dependencies": [],
      "research_needed": false,
      "notes": "Primarily business logic. May use LLM for evaluating 'sufficient detail' but could also use heuristics (word count, event count, etc.)."
    },
    "infrastructure": {
      "docker_changes": false,
      "database_changes": false,
      "config_changes": false,
      "notes": "Uses existing tables."
    },
    "knowledge": {
      "patterns_exist": true,
      "research_required": false,
      "unfamiliar_tech": [],
      "notes": "Similar patterns to phase assessment and session planning. Handoff to Editor Flow is new but straightforward."
    },
    "risk": {
      "level": "low",
      "concerns": [
        "Defining 'sufficient detail' heuristics may be subjective",
        "Edit requirements must be actionable for Editor Flow",
        "Handoff to Editor Flow must trigger composition correctly",
        "Performance: evaluation must complete in <30s per WBS"
      ],
      "notes": "Low risk - primarily orchestration logic. Clear inputs/outputs."
    }
  },

  "recommended_phases": [
    "discovery",
    "requirements",
    "context",
    "spec_writing",
    "planning",
    "validation"
  ],

  "flags": {
    "needs_research": false,
    "needs_self_critique": false,
    "needs_infrastructure_setup": false
  },

  "validation_recommendations": {
    "risk_level": "low",
    "skip_validation": false,
    "minimal_mode": false,
    "test_types_required": ["unit", "integration"],
    "security_scan_required": false,
    "staging_deployment_required": true,
    "reasoning": "Business logic requiring unit tests for heuristics. Integration tests for handoff to Editor Flow. Performance testing required (<30s SLA)."
  }
}
```

### Implementation Plan Structure
```json
{
  "feature": "Composition Trigger Subflow Implementation",
  "workflow_type": "feature",
  "workflow_rationale": "Determines when stories are ready for composition and hands off to Editor Flow",
  "phases": [
    {
      "id": "phase-1-readiness-evaluation",
      "name": "Composition Readiness Evaluation",
      "type": "implementation",
      "description": "Implement logic to evaluate if a story has sufficient detail for composition",
      "depends_on": [],
      "parallel_safe": false,
      "subtasks": [
        {
          "id": "subtask-1-1",
          "description": "Create CompositionReadinessEvaluator with sufficiency heuristics",
          "files_to_create": ["app/services/composition/readiness_evaluator.py"]
        },
        {
          "id": "subtask-1-2",
          "description": "Implement heuristics: event count, detail richness, temporal coverage",
          "files_to_modify": ["app/services/composition/readiness_evaluator.py"]
        },
        {
          "id": "subtask-1-3",
          "description": "Create ReadinessEvaluationNode workflow node",
          "files_to_create": ["app/workflows/nodes/analyst/readiness_evaluation_node.py"]
        }
      ]
    },
    {
      "id": "phase-2-edit-requirement-generation",
      "name": "Edit Requirements Generation",
      "type": "implementation",
      "description": "Generate edit requirements for Editor Flow based on story gaps",
      "depends_on": ["phase-1-readiness-evaluation"],
      "parallel_safe": false,
      "subtasks": [
        {
          "id": "subtask-2-1",
          "description": "Create EditRequirementGenerationNode to create edit_requirement records",
          "files_to_create": ["app/workflows/nodes/analyst/edit_requirement_generation_node.py"]
        },
        {
          "id": "subtask-2-2",
          "description": "Implement edit requirement templates for composition guidance",
          "files_to_create": ["app/services/composition/edit_requirement_templates.py"]
        },
        {
          "id": "subtask-2-3",
          "description": "Create edit_requirement repository methods",
          "files_to_create": ["app/repositories/edit_requirement_repository.py"]
        }
      ]
    },
    {
      "id": "phase-3-story-selection",
      "name": "Story Selection for Composition",
      "type": "implementation",
      "description": "Select which source life events to include in composition",
      "depends_on": ["phase-1-readiness-evaluation"],
      "parallel_safe": true,
      "subtasks": [
        {
          "id": "subtask-3-1",
          "description": "Create StorySelectionNode to select life events for composition",
          "files_to_create": ["app/workflows/nodes/analyst/story_selection_node.py"]
        },
        {
          "id": "subtask-3-2",
          "description": "Implement selection logic based on coherence and completeness",
          "files_to_create": ["app/services/composition/story_selector.py"]
        }
      ]
    },
    {
      "id": "phase-4-editor-handoff",
      "name": "Editor Flow Handoff",
      "type": "integration",
      "description": "Hand off to Editor Flow with composition context",
      "depends_on": ["phase-2-edit-requirement-generation", "phase-3-story-selection"],
      "parallel_safe": false,
      "subtasks": [
        {
          "id": "subtask-4-1",
          "description": "Create composition_trigger_workflow.py orchestrating all nodes",
          "files_to_create": ["app/workflows/composition_trigger_workflow.py"]
        },
        {
          "id": "subtask-4-2",
          "description": "Implement handoff logic to Editor Flow with context",
          "files_to_create": ["app/services/composition/editor_handoff.py"]
        },
        {
          "id": "subtask-4-3",
          "description": "Add API endpoint POST /api/v1/analyst/trigger-composition",
          "files_to_modify": ["app/api/v1/analyst.py"]
        },
        {
          "id": "subtask-4-4",
          "description": "Update story status to 'composing' in database",
          "files_to_modify": ["app/services/composition/editor_handoff.py"]
        },
        {
          "id": "subtask-4-5",
          "description": "Run E2E test: composition trigger completes in <30s",
          "verification": {
            "type": "e2e_test",
            "command": "pytest tests/e2e/test_composition_trigger_flow.py",
            "expected": "Trigger completes in <30s, Editor Flow initiated"
          }
        }
      ]
    }
  ],
  "summary": {
    "total_phases": 4,
    "total_subtasks": 12,
    "services_involved": ["main"],
    "estimated_story_points": 5
  }
}
```

---

## Summary

These 5 tasks cover the complete Analyst Flow Implementation (2.1 from WBS):

| Task | Subflow | Story Points | Complexity | Key Focus |
|------|---------|--------------|------------|-----------|
| 002 | Onboarding | 8 | Standard | User onboarding, form validation |
| 003 | Phase Assessment | 13 | Complex | Gap analysis, LLM integration |
| 004 | Session Planning | 8 | Standard | Question generation, context prep |
| 005 | Post-Session Analysis | 13 | Complex | NLP extraction, archetype assessment |
| 006 | Composition Trigger | 5 | Standard | Readiness evaluation, Editor handoff |
| **Total** | **5 subflows** | **47** | **Mixed** | **Complete Analyst Flow** |

Each task includes:
- ✅ requirements.json (task description + workflow type)
- ✅ complexity_assessment.json (detailed risk/complexity analysis)
- ✅ Implementation plan structure (phases + subtasks)
- ✅ Verification strategies
- ✅ Acceptance criteria

These can be fed into auto-claude as separate task specifications for execution.
