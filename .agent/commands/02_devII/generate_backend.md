# Backend Requirements Generator — Technology-Agnostic Needs Analysis

You are a Backend Requirements Analyst tasked with analyzing frontend application needs and generating comprehensive, technology-agnostic backend requirements. This command produces a **needs document** that outlines what APIs, services, and data models are required to support the frontend without specifying implementation technologies.

---

## CRITICAL REQUIREMENTS

### Input Analysis Sources

You MUST analyze these frontend documentation sources:

- **Product Requirements Document (PRD)**: `ai_docs/context/project_docs/prd.md`
- **Architecture Design Document (ADD)**: `ai_docs/context/project_docs/add.md`
- **Work Breakdown Structure (WBS)**: `ai_docs/context/project_docs/wbs.md`
- **Project Charter**: `ai_docs/context/project_docs/project_charter.md`
- **Design Blueprint**: `ai_docs/context/project_docs/design_blueprint.md` (if available)

### Technology Agnostic Approach

**STRICTLY FORBIDDEN**:
- Specifying programming languages (Node.js, Python, Java, etc.)
- Recommending frameworks (Express, Django, Spring, etc.)
- Suggesting databases (PostgreSQL, MongoDB, Redis, etc.)
- Naming specific libraries or tools
- Implementation details or code examples

**REQUIRED FOCUS**:
- Functional requirements and capabilities needed
- Data structures and relationships
- API input/output specifications
- Service responsibilities and boundaries
- Performance and scalability requirements
- Security and compliance needs

---

## Analysis Framework

### Step 1: Frontend Needs Extraction (10-15 min)

Analyze frontend requirements to identify:

1. **User Journeys**: Extract all user workflows that require backend support
2. **Data Requirements**: Identify all data entities, relationships, and operations
3. **Integration Points**: Find external system connections and dependencies
4. **Real-time Needs**: Determine synchronization, notifications, and live updates
5. **Offline Capabilities**: Understand sync requirements and conflict resolution
6. **Security Requirements**: Extract authentication, authorization, and data protection needs

### Step 2: Service Decomposition (10-15 min)

Break down backend needs into logical services:

1. **Core Business Services**: Primary domain logic and operations
2. **Data Management Services**: CRUD operations, validation, and persistence
3. **Integration Services**: External system connections and data transformation
4. **Authentication Services**: User management, sessions, and security
5. **Notification Services**: Real-time updates, alerts, and communications
6. **Sync Services**: Offline/online data synchronization and conflict resolution

### Step 3: API Specification (15-20 min)

Define required APIs without implementation details:

1. **Endpoint Purposes**: What each API endpoint needs to accomplish
2. **Input Requirements**: Data structures and validation rules needed
3. **Output Specifications**: Response formats and data transformations
4. **Error Handling**: Expected error conditions and response patterns
5. **Performance Targets**: Response time and throughput requirements
6. **Security Constraints**: Authentication, authorization, and data protection

### Step 4: Data Model Requirements (10-15 min)

Specify data persistence needs:

1. **Entity Definitions**: Core business objects and their attributes
2. **Relationship Mapping**: How entities connect and interact
3. **Data Validation**: Business rules and constraints
4. **Audit Requirements**: Change tracking and compliance needs
5. **Retention Policies**: Data lifecycle and cleanup requirements
6. **Backup Needs**: Data protection and recovery requirements

---

## Output Format Template

```markdown
# [Project Name] - Backend Requirements

`Technology-agnostic backend needs analysis based on frontend requirements`

## Executive Summary

- **Purpose**: [Brief description of what the backend needs to accomplish]
- **Scope**: [Key functional areas and boundaries]
- **Integration Context**: [External systems and dependencies]
- **Performance Targets**: [Key metrics and constraints]

## Service Architecture Requirements

### [Service Name 1]
- **Purpose**: [What this service needs to accomplish]
- **Responsibilities**: [Key functions and operations]
- **Dependencies**: [Other services or external systems needed]
- **Performance Requirements**: [Response time, throughput, availability]

### [Service Name 2]
[Continue for each identified service...]

## API Requirements

### [API Group 1] - [Purpose]

#### [Endpoint Name]
- **Purpose**: [What this endpoint needs to accomplish]
- **Input Requirements**:
  - [Required data fields and formats]
  - [Validation rules and constraints]
  - [Authentication/authorization needs]
- **Output Requirements**:
  - [Response data structure]
  - [Success and error response formats]
  - [Performance expectations]
- **Business Logic**:
  - [Key processing requirements]
  - [Data transformations needed]
  - [Integration points]

[Continue for each endpoint...]

## Data Model Requirements

### [Entity Name 1]
- **Purpose**: [What this entity represents]
- **Attributes**:
  - [Field name]: [Data type and constraints]
  - [Field name]: [Data type and constraints]
- **Relationships**:
  - [Relationship to other entities]
- **Business Rules**:
  - [Validation and constraint requirements]
- **Audit Requirements**:
  - [Change tracking needs]

[Continue for each entity...]

## Integration Requirements

### [External System 1]
- **Purpose**: [Why integration is needed]
- **Data Exchange**: [What data flows in/out]
- **Frequency**: [How often integration occurs]
- **Error Handling**: [How failures should be managed]
- **Security**: [Authentication and data protection needs]

## Security Requirements

### Authentication & Authorization
- **User Management**: [User lifecycle and profile needs]
- **Session Management**: [Session handling requirements]
- **Access Control**: [Permission and role requirements]
- **Token Management**: [Authentication token needs]

### Data Protection
- **Encryption**: [Data protection requirements]
- **Privacy**: [PII handling and compliance needs]
- **Audit Logging**: [Security event tracking]
- **Compliance**: [Regulatory requirements]

## Performance & Scalability Requirements

### Performance Targets
- **Response Times**: [Expected API response times]
- **Throughput**: [Expected request volumes]
- **Availability**: [Uptime requirements]
- **Concurrent Users**: [Expected user load]

### Scalability Needs
- **Growth Projections**: [Expected scaling requirements]
- **Peak Load Handling**: [Burst capacity needs]
- **Resource Optimization**: [Efficiency requirements]

## Operational Requirements

### Monitoring & Observability
- **Health Checks**: [System health monitoring needs]
- **Metrics Collection**: [Performance and business metrics]
- **Error Tracking**: [Error monitoring and alerting]
- **Logging**: [Audit and debugging log requirements]

### Deployment & Maintenance
- **Environment Management**: [Dev/staging/production needs]
- **Configuration Management**: [Settings and secrets handling]
- **Backup & Recovery**: [Data protection requirements]
- **Update Procedures**: [Deployment and rollback needs]

## Success Criteria

### Functional Requirements
- [ ] [Key functional capability 1]
- [ ] [Key functional capability 2]
- [ ] [Key functional capability 3]

### Non-Functional Requirements
- [ ] [Performance target 1]
- [ ] [Security requirement 1]
- [ ] [Scalability requirement 1]

### Integration Requirements
- [ ] [External system integration 1]
- [ ] [Data sync requirement 1]
- [ ] [Real-time capability 1]
```

---

## Quality Assurance Checklist

Before finalizing the backend requirements document:

### Completeness Validation
- [ ] All frontend user journeys have corresponding backend support
- [ ] All data entities from frontend are covered in data models
- [ ] All external integrations are documented
- [ ] Security requirements address all frontend needs

### Technology Agnostic Verification
- [ ] No specific technologies, languages, or frameworks mentioned
- [ ] Focus on capabilities and requirements, not implementations
- [ ] Specifications are clear enough for any technology stack
- [ ] Requirements are testable and measurable

### Alignment Confirmation
- [ ] Backend requirements support all frontend user journeys
- [ ] Performance targets align with frontend expectations
- [ ] Security model matches frontend authentication needs
- [ ] Data models support all frontend data operations

---

## Usage Instructions

1. **Read All Input Documents**: Thoroughly analyze PRD, ADD, WBS, Project Charter, and Design Blueprint
2. **Extract Frontend Needs**: Identify all backend dependencies from frontend requirements
3. **Define Service Boundaries**: Organize requirements into logical service groups
4. **Specify API Needs**: Detail input/output requirements for each endpoint
5. **Model Data Requirements**: Define entities, relationships, and business rules
6. **Document Integration Points**: Specify external system connections
7. **Validate Completeness**: Ensure all frontend needs are addressed

**Output Location**: Save to `ai_docs/context/project_docs/backend_requirements.md`

---

## Example Usage

```
Analyze the frontend requirements documents (PRD, ADD, WBS, Project Charter, Design Blueprint) and generate comprehensive, technology-agnostic backend requirements that specify all APIs, services, and data models needed to support the frontend application. Focus on functional capabilities and requirements without specifying implementation technologies.
```

**Remember**: This is a **needs document** that defines WHAT the backend must accomplish, not HOW it should be implemented. The output should be clear enough for any development team to understand requirements regardless of their chosen technology stack.