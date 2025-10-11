# Testing & Validation Task Generator — Phase 3 Testing Planning

You are tasked with conducting a comprehensive testing analysis and generating detailed testing and validation tasks. This command focuses on identifying testing gaps, planning comprehensive test coverage, and creating tasks for Phase 3 testing and validation work.

---

## CRITICAL REQUIREMENTS

### Testing Assessment Scope

**Option 1: Specific Component/Feature Testing**
- Accept specific component or feature paths to analyze
- Focus testing review on specified functionality
- Generate targeted testing tasks

**Option 2: Full Project Testing Review**
If no specific paths provided, analyze ALL project testing needs:
- **Unit Testing**: Component and function-level testing
- **Integration Testing**: Component interaction testing
- **End-to-End Testing**: Complete workflow testing
- **Journey Testing**: User experience validation
- **Performance Testing**: Load and performance validation
- **Security Testing**: Security vulnerability testing

### Testing Documentation Sources

Reference these documents for testing context:
- **WBS Document**: `ai_docs/context/project_docs/wbs.md`
- **PRD Document**: `ai_docs/context/project_docs/prd.md`
- **Architecture Document**: `ai_docs/context/project_docs/add.md`
- **Existing Test Files**: Current test implementations
- **Phase 1 & 2 Tasks**: Previous phase task files

---

## Testing Analysis Framework

### 1. Current Testing Coverage Assessment

For each component/feature, evaluate:
- **Unit Test Coverage**: Percentage of code covered by unit tests
- **Integration Test Coverage**: Component interaction testing status
- **E2E Test Coverage**: End-to-end workflow testing status
- **Journey Test Coverage**: User experience testing status
- **Edge Case Coverage**: Error conditions and edge cases tested
- **Performance Test Coverage**: Performance validation status

### 2. Testing Gap Analysis

Identify testing gaps:
- **Missing Unit Tests**: Functions/components without unit tests
- **Missing Integration Tests**: Component interactions not tested
- **Missing E2E Tests**: Workflows without end-to-end validation
- **Missing Journey Tests**: User experiences not validated
- **Missing Error Testing**: Error conditions not tested
- **Missing Performance Tests**: Performance scenarios not validated

### 3. Test Quality Assessment

Evaluate existing test quality:
- **Test Reliability**: Flaky or unreliable tests
- **Test Maintainability**: Hard-to-maintain test code
- **Test Performance**: Slow-running test suites
- **Test Data Management**: Test data setup and cleanup
- **Test Environment**: Testing environment configuration
- **Test Automation**: CI/CD integration status

---

## Testing Task Generation Strategy

### Phase 3 Testing Focus

**Phase 3 Testing includes:**
- Comprehensive unit test coverage (>80%)
- Complete integration testing
- End-to-end workflow validation
- User journey testing
- Performance and load testing
- Security testing
- Accessibility testing
- Cross-browser/device testing

### Testing Task Structure

Each testing task MUST include:

```
**[Component/Feature Name] Testing**: [Specific Testing Action]
- **File Location**: `tests/[test-type]/[test-file]`
- **Testing Type**: [Unit | Integration | E2E | Journey | Performance | Security]
- **Coverage Target**: [Specific coverage goals]
- **Testing Requirements**:
  - [ ] [Specific test scenario]
  - [ ] [Edge case testing requirement]
  - [ ] [Performance requirement]
  - [ ] [Accessibility requirement]
- **Test Data**: [Required test data and mocking strategy]
- **Dependencies**: [Testing tools, fixtures, or services required]
- **Success Criteria**: [Measurable testing success criteria]
- **Risk Assessment**: [Testing risks and mitigation strategies]
```

---

## Testing-Specific Task Templates

### Unit Testing Tasks

```
**[Component Name] Unit Testing**: Comprehensive unit test coverage
- **File Location**: `tests/unit/[component-name].test.js`
- **Testing Type**: Unit Testing
- **Coverage Target**: >80% code coverage
- **Testing Requirements**:
  - [ ] Test all public methods and functions
  - [ ] Test component rendering with various props
  - [ ] Test state changes and side effects
  - [ ] Test error conditions and edge cases
  - [ ] Test component lifecycle methods
- **Test Data**: Mock data for props and API responses
- **Dependencies**: [Testing framework, mocking libraries]
- **Success Criteria**: All tests pass, coverage target met
- **Risk Assessment**: Test brittleness, mock data maintenance
```

### Integration Testing Tasks

```
**[Feature Name] Integration Testing**: Component interaction validation
- **File Location**: `tests/integration/[feature-name].test.js`
- **Testing Type**: Integration Testing
- **Coverage Target**: All component interactions tested
- **Testing Requirements**:
  - [ ] Test component communication patterns
  - [ ] Test store integration and state management
  - [ ] Test API integration with mocked services
  - [ ] Test error propagation between components
  - [ ] Test data flow through component hierarchy
- **Test Data**: Integrated test scenarios with realistic data
- **Dependencies**: [Integration testing tools, API mocking]
- **Success Criteria**: All integration scenarios pass
- **Risk Assessment**: Complex setup, external dependencies
```

### End-to-End Testing Tasks

```
**[Workflow Name] E2E Testing**: Complete workflow validation
- **File Location**: `tests/e2e/[workflow-name].spec.js`
- **Testing Type**: End-to-End Testing
- **Coverage Target**: All critical user workflows
- **Testing Requirements**:
  - [ ] Test complete user workflows from start to finish
  - [ ] Test cross-page navigation and state persistence
  - [ ] Test form submissions and data persistence
  - [ ] Test error handling in complete workflows
  - [ ] Test offline/online scenarios
- **Test Data**: End-to-end test scenarios with full data sets
- **Dependencies**: [E2E testing framework, test environment]
- **Success Criteria**: All workflows complete successfully
- **Risk Assessment**: Environment dependencies, test flakiness
```

### Journey Testing Tasks

```
**[User Journey] Journey Testing**: User experience validation
- **File Location**: `tests/e2e/journeys/[journey-name].spec.js`
- **Testing Type**: Journey Testing
- **Coverage Target**: All critical user journeys
- **Testing Requirements**:
  - [ ] Test complete user experience flows
  - [ ] Test UI responsiveness and interactions
  - [ ] Test accessibility compliance
  - [ ] Test cross-device compatibility
  - [ ] Test performance under realistic conditions
- **Test Data**: Realistic user scenarios and data
- **Dependencies**: [Journey testing tools, device emulation]
- **Success Criteria**: All user journeys complete without issues
- **Risk Assessment**: UI changes breaking tests, device compatibility
```

### Performance Testing Tasks

```
**[Feature Name] Performance Testing**: Performance validation
- **File Location**: `tests/performance/[feature-name].test.js`
- **Testing Type**: Performance Testing
- **Coverage Target**: All performance-critical features
- **Testing Requirements**:
  - [ ] Test load times and rendering performance
  - [ ] Test memory usage and resource consumption
  - [ ] Test concurrent user scenarios
  - [ ] Test large data set handling
  - [ ] Test network condition variations
- **Test Data**: Large data sets and stress test scenarios
- **Dependencies**: [Performance testing tools, monitoring]
- **Success Criteria**: Performance targets met consistently
- **Risk Assessment**: Environment variability, resource constraints
```

### Security Testing Tasks

```
**[Feature Name] Security Testing**: Security vulnerability validation
- **File Location**: `tests/security/[feature-name].test.js`
- **Testing Type**: Security Testing
- **Coverage Target**: All security-sensitive features
- **Testing Requirements**:
  - [ ] Test input validation and sanitization
  - [ ] Test authentication and authorization
  - [ ] Test data protection and encryption
  - [ ] Test XSS and injection vulnerabilities
  - [ ] Test session management and security
- **Test Data**: Security test vectors and attack scenarios
- **Dependencies**: [Security testing tools, vulnerability scanners]
- **Success Criteria**: No security vulnerabilities found
- **Risk Assessment**: False positives, evolving threat landscape
```

---

## Testing Strategy Framework

### 1. Test Pyramid Implementation

**Unit Tests (70%)**:
- Fast, isolated, comprehensive coverage
- Mock external dependencies
- Focus on business logic validation

**Integration Tests (20%)**:
- Component interaction validation
- API integration testing
- Store and state management testing

**E2E Tests (10%)**:
- Critical user workflow validation
- Cross-browser compatibility
- Performance validation

### 2. Testing Environment Strategy

**Local Development**:
- Fast unit and integration test execution
- Mock external services
- Immediate feedback loop

**CI/CD Pipeline**:
- Automated test execution on commits
- Parallel test execution
- Test result reporting and notifications

**Staging Environment**:
- Full E2E and journey testing
- Performance testing
- Security testing

### 3. Test Data Management

**Mock Data Strategy**:
- Consistent mock data across test types
- Realistic data scenarios
- Edge case data coverage

**Test Data Isolation**:
- Independent test data for each test
- Proper setup and teardown
- No test interdependencies

---

## Output Structure

### Testing Task Organization

```markdown
# Testing & Validation Tasks — Phase 3 Implementation

`Comprehensive testing planning based on coverage analysis`

## Testing Assessment Summary
[Overview of current testing status and gaps]

## Testing Coverage Goals
[Target coverage percentages and quality metrics]

## Phase 3: Testing & Validation

### Unit Testing Tasks
[Comprehensive unit test implementation tasks]

### Integration Testing Tasks
[Component interaction testing tasks]

### End-to-End Testing Tasks
[Complete workflow validation tasks]

### Journey Testing Tasks
[User experience validation tasks]

### Performance Testing Tasks
[Performance validation tasks]

### Security Testing Tasks
[Security validation tasks]

## Testing Infrastructure
[Testing tools, frameworks, and environment setup]

## Test Automation Strategy
[CI/CD integration and automation approach]

## Testing Success Criteria
[Measurable criteria for testing completion]

## Testing Risks & Mitigations
[Testing risks and mitigation strategies]
```

---

## Usage Instructions

### With Specific Component/Feature

1. **Analyze Specified Components**: Focus testing review on provided paths
2. **Assess Current Testing**: Evaluate existing test coverage
3. **Generate Targeted Tests**: Create specific testing tasks
4. **Output Location**: Save to `ai_docs/tasks/[component-name]/testing_tasks.md`

### Full Project Testing Review

1. **Scan All Components**: Review entire project for testing gaps
2. **Analyze Test Coverage**: Assess current testing status
3. **Prioritize Testing Tasks**: Order by risk and business impact
4. **Output Location**: Save to `ai_docs/tasks/testing_tasks.md`

---

## Testing Quality Assurance

### Testing Task Validation Checklist

- [ ] Testing gaps are accurately identified
- [ ] Coverage targets are realistic and measurable
- [ ] Test scenarios cover edge cases and error conditions
- [ ] Testing dependencies are clearly documented
- [ ] Success criteria are specific and measurable
- [ ] Risk assessments include mitigation strategies

### Testing Risk Prevention

1. **Test Reliability**: Ensure tests are stable and not flaky
2. **Test Maintainability**: Write maintainable and readable tests
3. **Test Performance**: Optimize test execution time
4. **Test Environment**: Ensure consistent testing environments
5. **Test Data**: Manage test data effectively and securely

---

## Testing Success Metrics

- [ ] Unit test coverage >80%
- [ ] Integration test coverage for all component interactions
- [ ] E2E test coverage for all critical workflows
- [ ] Journey test coverage for all user experiences
- [ ] Performance tests meet defined benchmarks
- [ ] Security tests pass vulnerability assessments
- [ ] All tests run reliably in CI/CD pipeline

---

**Critical**: Testing tasks must provide comprehensive coverage while being maintainable, reliable, and integrated into the development workflow to ensure high-quality software delivery.