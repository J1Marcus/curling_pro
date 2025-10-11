# Integration Task Generator — Phase 2 Integration Planning

You are tasked with conducting a comprehensive code review of components not fully integrated and generating detailed integration tasks. This command focuses on identifying integration gaps, planning data connections, and creating tasks for Phase 2 integration work.

---

## CRITICAL REQUIREMENTS

### Integration Assessment Scope

**Option 1: Specific Component/Folder Analysis**
- Accept specific folder or file paths to analyze
- Focus integration review on specified components
- Generate targeted integration tasks

**Option 2: Full Project Integration Review**
If no specific paths provided, analyze ALL project components:
- **Source Code**: All files in `src/` directory
- **Components**: All React components and their integration status
- **Stores**: All Zustand stores and their data connections
- **Pages**: All page components and their data dependencies
- **Utils**: All utility functions and their integration points

### Integration Documentation Sources

Reference these documents for integration context:
- **Architecture Document**: `ai_docs/context/project_docs/add.md`
- **Design Blueprint**: `ai_docs/context/project_docs/design_blueprint.md`
- **WBS Document**: `ai_docs/context/project_docs/wbs.md`
- **Phase 1 Tasks**: Any existing phase 1 task files

---

## Integration Analysis Framework

### 1. Component Integration Status Assessment

For each component, evaluate:
- **Mock Data Usage**: Components still using mock data
- **State Integration**: Components not connected to appropriate stores
- **API Integration**: Components missing real data connections
- **Error Handling**: Components with basic/missing error handling
- **Loading States**: Components with incomplete loading state management

### 2. Data Flow Analysis

Analyze data flow patterns:
- **Store Connections**: Which stores need real data integration
- **API Endpoints**: Missing or incomplete API connections
- **Data Persistence**: Components not properly persisting data
- **Sync Requirements**: Components needing offline/online sync
- **Cross-Component Communication**: Missing component interactions

### 3. Integration Dependencies

Identify integration dependencies:
- **External APIs**: Required external service connections
- **Database Integration**: Data persistence requirements
- **Authentication**: Components needing auth integration
- **Notification Systems**: Components missing notification integration
- **File/Media Handling**: Components needing file upload/management

---

## Integration Task Generation Strategy

### Phase 2 Integration Focus

**Phase 2 Integration includes:**
- Replace mock data with real data connections
- Implement comprehensive error handling
- Add advanced loading states and progress indicators
- Connect to external APIs and services
- Implement proper data persistence
- Add offline/online sync capabilities
- Enhance user feedback and notifications

### Integration Task Structure

Each integration task MUST include:

```
**[Component/Feature Name] Integration**: [Specific Integration Action]
- **File Location**: `src/[exact-path]`
- **Integration Type**: [Mock-to-Real Data | API Connection | Store Integration | Error Handling | etc.]
- **Current State**: [Description of current implementation]
- **Integration Requirements**:
  - [ ] [Specific integration requirement]
  - [ ] [Data connection requirement]
  - [ ] [Error handling requirement]
  - [ ] [Performance requirement]
- **Dependencies**: [External services, APIs, or components required]
- **Testing Requirements**: [Integration tests needed]
- **Risk Assessment**: [Potential integration risks and mitigations]
```

---

## Integration-Specific Task Templates

### Mock Data to Real Data Integration

```
**[Component Name] Data Integration**: Replace mock data with real data connections
- **File Location**: `src/[component-path]`
- **Integration Type**: Mock-to-Real Data
- **Current State**: Using mock data from [mock-source]
- **Integration Requirements**:
  - [ ] Connect to [specific API/service]
  - [ ] Implement data validation and sanitization
  - [ ] Add error handling for data fetch failures
  - [ ] Implement loading states during data fetch
  - [ ] Add data caching strategy
- **Dependencies**: [API endpoints, authentication, network handling]
- **Testing Requirements**: Integration tests with real data scenarios
- **Risk Assessment**: Network failures, data format changes, performance impact
```

### Store Integration Tasks

```
**[Store Name] Integration**: Connect store to real data sources
- **File Location**: `src/stores/[storeName].js`
- **Integration Type**: Store Integration
- **Current State**: Store using mock data or local state only
- **Integration Requirements**:
  - [ ] Connect to external API endpoints
  - [ ] Implement data synchronization
  - [ ] Add error handling for API failures
  - [ ] Implement optimistic updates
  - [ ] Add offline data persistence
- **Dependencies**: [API services, authentication, sync mechanisms]
- **Testing Requirements**: Store integration tests with API mocking
- **Risk Assessment**: API reliability, data consistency, sync conflicts
```

### Error Handling Enhancement

```
**[Component/Feature Name] Error Handling**: Implement comprehensive error handling
- **File Location**: `src/[component-path]`
- **Integration Type**: Error Handling Enhancement
- **Current State**: Basic or missing error handling
- **Integration Requirements**:
  - [ ] Add specific error types and handling
  - [ ] Implement user-friendly error messages
  - [ ] Add error recovery mechanisms
  - [ ] Implement error logging and reporting
  - [ ] Add fallback UI states
- **Dependencies**: [Error reporting service, logging system, notification system]
- **Testing Requirements**: Error scenario testing
- **Risk Assessment**: User experience degradation, error cascading
```

### API Integration Tasks

```
**[Feature Name] API Integration**: Connect to external API services
- **File Location**: `src/[component-path]`
- **Integration Type**: API Connection
- **Current State**: No external API connection
- **Integration Requirements**:
  - [ ] Implement API client configuration
  - [ ] Add authentication handling
  - [ ] Implement request/response handling
  - [ ] Add retry logic and timeout handling
  - [ ] Implement rate limiting compliance
- **Dependencies**: [API credentials, network layer, authentication system]
- **Testing Requirements**: API integration tests with mocking
- **Risk Assessment**: API availability, rate limits, authentication failures
```

---

## Integration Review Process

### 1. Code Analysis Phase

**Automated Analysis**:
- Scan for mock data usage patterns
- Identify components with TODO/FIXME comments
- Find components missing error boundaries
- Locate hardcoded values that need configuration

**Manual Review**:
- Assess component architecture compliance
- Review state management patterns
- Evaluate error handling completeness
- Check integration with existing systems

### 2. Integration Gap Identification

**Data Integration Gaps**:
- Components still using mock data
- Missing API connections
- Incomplete data validation
- Missing data persistence

**System Integration Gaps**:
- Missing authentication integration
- Incomplete notification systems
- Missing offline/sync capabilities
- Inadequate error handling

### 3. Priority Assessment

**High Priority Integration**:
- Core user workflows missing real data
- Security-critical integrations
- Performance-impacting mock data usage
- User-facing error handling gaps

**Medium Priority Integration**:
- Nice-to-have data connections
- Enhanced error messaging
- Performance optimizations
- Advanced loading states

**Low Priority Integration**:
- Non-critical API connections
- Advanced caching strategies
- Optional notification enhancements
- Cosmetic improvements

---

## Output Structure

### Integration Task Organization

```markdown
# Integration Tasks — Phase 2 Implementation

`Comprehensive integration planning based on code review analysis`

## Integration Assessment Summary
[Overview of integration gaps found]

## Integration Priority Matrix
[High/Medium/Low priority integration tasks]

## Phase 2: Integration & Data Connections

### Critical Data Integrations
[High-priority data connection tasks]

### API Integration Tasks
[External service connection tasks]

### Error Handling Enhancements
[Comprehensive error handling tasks]

### Performance & Caching
[Performance optimization integration tasks]

### Sync & Offline Capabilities
[Offline/online sync integration tasks]

## Integration Dependencies
[External dependencies and prerequisites]

## Integration Testing Strategy
[Testing approach for integration tasks]

## Integration Risks & Mitigations
[Potential risks and mitigation strategies]

## Integration Success Criteria
[Measurable criteria for integration completion]
```

---

## Usage Instructions

### With Specific Component/Folder

1. **Analyze Specified Components**: Focus review on provided paths
2. **Assess Integration Status**: Evaluate current integration state
3. **Generate Targeted Tasks**: Create specific integration tasks
4. **Output Location**: Save to `ai_docs/tasks/[component-name]/integration_tasks.md`

### Full Project Integration Review

1. **Scan All Components**: Review entire src/ directory
2. **Identify Integration Gaps**: Find all components needing integration
3. **Prioritize Integration Tasks**: Order by business impact and complexity
4. **Output Location**: Save to `ai_docs/tasks/integration_tasks.md`

---

## Integration Quality Assurance

### Integration Task Validation Checklist

- [ ] Integration gaps are accurately identified
- [ ] Tasks include specific technical requirements
- [ ] Dependencies are clearly documented
- [ ] Risk assessments are realistic and actionable
- [ ] Testing requirements are comprehensive
- [ ] Priority levels are business-aligned

### Integration Risk Prevention

1. **Dependency Management**: Ensure all external dependencies are available
2. **Backward Compatibility**: Maintain existing functionality during integration
3. **Performance Impact**: Assess and mitigate performance implications
4. **Error Handling**: Implement robust error handling for all integrations
5. **Testing Coverage**: Ensure comprehensive integration testing

---

**Critical**: Integration tasks must be implementation-ready with clear technical specifications, realistic timelines, and comprehensive risk assessments to ensure successful Phase 2 completion.