#!/bin/bash

#############################################################################
# Auto-Claude Task Creator
# Creates a new task with proper structure for Auto-Claude
#
# Usage:
#   ./create_auto_claude_task.sh TASK_ID TASK_NAME [OPTIONS]
#
# Examples:
#   ./create_auto_claude_task.sh 008 user-authentication
#   ./create_auto_claude_task.sh 009 api-rate-limiting --complexity complex --priority high
#
# Options:
#   --description "DESC"    Task description
#   --complexity LEVEL      trivial|simple|standard|complex (default: standard)
#   --priority LEVEL        low|medium|high|critical (default: medium)
#   --story-points NUM      Story point estimate (default: 5)
#   --category TYPE         feature|bug|refactor|docs|test (default: feature)
#   --wbs REF              WBS reference (e.g., "2.1.3")
#   --related-docs "DOC1,DOC2"  Comma-separated related docs
#############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
COMPLEXITY="standard"
PRIORITY="medium"
STORY_POINTS=5
CATEGORY="feature"
IMPACT="medium"
DESCRIPTION=""
WBS_REF=""
RELATED_DOCS=""

# Parse arguments
if [ $# -lt 2 ]; then
    echo -e "${RED}Error: Task ID and name are required${NC}"
    echo "Usage: $0 TASK_ID TASK_NAME [OPTIONS]"
    echo ""
    echo "Examples:"
    echo "  $0 008 user-authentication"
    echo "  $0 009 api-rate-limiting --complexity complex --priority high"
    exit 1
fi

TASK_ID=$1
TASK_NAME=$2
shift 2

# Parse optional arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --description)
            DESCRIPTION="$2"
            shift 2
            ;;
        --complexity)
            COMPLEXITY="$2"
            shift 2
            ;;
        --priority)
            PRIORITY="$2"
            shift 2
            ;;
        --story-points)
            STORY_POINTS="$2"
            shift 2
            ;;
        --category)
            CATEGORY="$2"
            shift 2
            ;;
        --wbs)
            WBS_REF="$2"
            shift 2
            ;;
        --related-docs)
            RELATED_DOCS="$2"
            shift 2
            ;;
        --impact)
            IMPACT="$2"
            shift 2
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Validate complexity
if [[ ! "$COMPLEXITY" =~ ^(trivial|simple|standard|complex)$ ]]; then
    echo -e "${RED}Error: Invalid complexity. Must be: trivial, simple, standard, or complex${NC}"
    exit 1
fi

# Validate priority
if [[ ! "$PRIORITY" =~ ^(low|medium|high|critical)$ ]]; then
    echo -e "${RED}Error: Invalid priority. Must be: low, medium, high, or critical${NC}"
    exit 1
fi

# Validate category
if [[ ! "$CATEGORY" =~ ^(feature|bug|refactor|docs|test)$ ]]; then
    echo -e "${RED}Error: Invalid category. Must be: feature, bug, refactor, docs, or test${NC}"
    exit 1
fi

# Set default description if not provided
if [ -z "$DESCRIPTION" ]; then
    DESCRIPTION="Implement ${TASK_NAME//-/ }"
fi

# Determine model configuration based on complexity
case $COMPLEXITY in
    trivial)
        SPEC_MODEL="sonnet"
        PLANNING_MODEL="haiku"
        CODING_MODEL="haiku"
        QA_MODEL="haiku"
        SPEC_THINKING="low"
        PLANNING_THINKING="low"
        CODING_THINKING="low"
        QA_THINKING="low"
        DEFAULT_MODEL="haiku"
        DEFAULT_THINKING="low"
        ;;
    simple)
        SPEC_MODEL="sonnet"
        PLANNING_MODEL="sonnet"
        CODING_MODEL="sonnet"
        QA_MODEL="haiku"
        SPEC_THINKING="medium"
        PLANNING_THINKING="low"
        CODING_THINKING="low"
        QA_THINKING="low"
        DEFAULT_MODEL="sonnet"
        DEFAULT_THINKING="low"
        ;;
    standard)
        SPEC_MODEL="opus"
        PLANNING_MODEL="sonnet"
        CODING_MODEL="sonnet"
        QA_MODEL="sonnet"
        SPEC_THINKING="high"
        PLANNING_THINKING="medium"
        CODING_THINKING="medium"
        QA_THINKING="low"
        DEFAULT_MODEL="sonnet"
        DEFAULT_THINKING="medium"
        ;;
    complex)
        SPEC_MODEL="opus"
        PLANNING_MODEL="opus"
        CODING_MODEL="opus"
        QA_MODEL="sonnet"
        SPEC_THINKING="ultrathink"
        PLANNING_THINKING="ultrathink"
        CODING_THINKING="high"
        QA_THINKING="medium"
        DEFAULT_MODEL="opus"
        DEFAULT_THINKING="ultrathink"
        ;;
esac

# Create task directory
TASK_DIR=".auto-claude/specs/${TASK_ID}-${TASK_NAME}"
echo -e "${BLUE}Creating task directory: ${TASK_DIR}${NC}"
mkdir -p "$TASK_DIR"

# Get current timestamp
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

# Create requirements.json
echo -e "${BLUE}Creating requirements.json${NC}"
cat > "$TASK_DIR/requirements.json" << EOF
{
  "task_description": "${DESCRIPTION}",
  "workflow_type": "${CATEGORY}"
}
EOF

# Build related docs array
RELATED_DOCS_JSON="[]"
if [ -n "$RELATED_DOCS" ]; then
    # Convert comma-separated list to JSON array
    IFS=',' read -ra DOCS_ARRAY <<< "$RELATED_DOCS"
    RELATED_DOCS_JSON="["
    for i in "${!DOCS_ARRAY[@]}"; do
        if [ $i -gt 0 ]; then
            RELATED_DOCS_JSON+=","
        fi
        RELATED_DOCS_JSON+="\"${DOCS_ARRAY[$i]}\""
    done
    RELATED_DOCS_JSON+="]"
fi

# Add WBS reference if provided
WBS_LINE=""
if [ -n "$WBS_REF" ]; then
    WBS_LINE=",
  \"wbsReference\": \"${WBS_REF}\""
fi

# Create task_metadata.json
echo -e "${BLUE}Creating task_metadata.json${NC}"
cat > "$TASK_DIR/task_metadata.json" << EOF
{
  "sourceType": "manual",
  "category": "${CATEGORY}",
  "priority": "${PRIORITY}",
  "complexity": "${COMPLEXITY}",
  "impact": "${IMPACT}",
  "model": "${DEFAULT_MODEL}",
  "thinkingLevel": "${DEFAULT_THINKING}",
  "isAutoProfile": true,
  "phaseModels": {
    "spec": "${SPEC_MODEL}",
    "planning": "${PLANNING_MODEL}",
    "coding": "${CODING_MODEL}",
    "qa": "${QA_MODEL}"
  },
  "phaseThinking": {
    "spec": "${SPEC_THINKING}",
    "planning": "${PLANNING_THINKING}",
    "coding": "${CODING_THINKING}",
    "qa": "${QA_THINKING}"
  },
  "estimatedStoryPoints": ${STORY_POINTS}${WBS_LINE},
  "relatedDocs": ${RELATED_DOCS_JSON}
}
EOF

# Create implementation_plan.json
echo -e "${BLUE}Creating implementation_plan.json${NC}"
cat > "$TASK_DIR/implementation_plan.json" << EOF
{
  "feature": "${TASK_NAME//-/ }",
  "description": "${DESCRIPTION}",
  "created_at": "${TIMESTAMP}",
  "updated_at": "${TIMESTAMP}",
  "status": "pending",
  "workflow_type": "${CATEGORY}",
  "workflow_rationale": "To be defined during spec phase",
  "phases": [],
  "summary": {
    "total_phases": 0,
    "total_subtasks": 0,
    "services_involved": ["main"],
    "estimated_story_points": ${STORY_POINTS}
  }
}
EOF

# Validate JSON
echo -e "${BLUE}Validating JSON files...${NC}"
for file in "$TASK_DIR"/*.json; do
    if python3 -m json.tool "$file" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ $(basename "$file") is valid${NC}"
    else
        echo -e "${RED}✗ $(basename "$file") is invalid${NC}"
        exit 1
    fi
done

# Print summary
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Task created successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}Task Details:${NC}"
echo -e "  ID:          ${TASK_ID}"
echo -e "  Name:        ${TASK_NAME}"
echo -e "  Description: ${DESCRIPTION}"
echo -e "  Category:    ${CATEGORY}"
echo -e "  Priority:    ${PRIORITY}"
echo -e "  Complexity:  ${COMPLEXITY}"
echo -e "  Impact:      ${IMPACT}"
echo -e "  Story Points: ${STORY_POINTS}"
if [ -n "$WBS_REF" ]; then
    echo -e "  WBS Ref:     ${WBS_REF}"
fi
echo ""
echo -e "${YELLOW}Model Configuration:${NC}"
echo -e "  Default:     ${DEFAULT_MODEL} (${DEFAULT_THINKING})"
echo -e "  Spec:        ${SPEC_MODEL} (${SPEC_THINKING})"
echo -e "  Planning:    ${PLANNING_MODEL} (${PLANNING_THINKING})"
echo -e "  Coding:      ${CODING_MODEL} (${CODING_THINKING})"
echo -e "  QA:          ${QA_MODEL} (${QA_THINKING})"
echo ""
echo -e "${YELLOW}Location:${NC}"
echo -e "  ${TASK_DIR}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo -e "  1. Review and edit files in ${TASK_DIR}/"
echo -e "  2. Add phases and subtasks to implementation_plan.json"
echo -e "  3. Add related documentation to task_metadata.json"
echo -e "  4. (Optional) Create spec.md for detailed specification"
echo -e "  5. Task should now appear in Auto-Claude kanban"
echo ""
echo -e "${BLUE}To run this task:${NC}"
echo -e "  auto-claude run --spec ${TASK_ID}-${TASK_NAME}"
echo ""
