# PLAYWRIGHT WORKFLOW VALIDATION Tasks Generator

**PURPOSE**: Generate tasks for implementing Playwright end-to-end testing to validate `ai_docs/workflows` user journeys

**CRITICAL**: You are creating a TASK LIST for PLAYWRIGHT VALIDATION implementation, not implementing code. Write tasks that others will execute.

---

## PLAYWRIGHT VALIDATION SCOPE

PLAYWRIGHT VALIDATION focuses on:
- **End-to-End Testing** of complete user workflows from `ai_docs/workflows`
- **User Journey Validation** across all workflow personas (Admin, Teacher, Parent, System)
- **Cross-Browser Testing** ensuring workflows work in Chrome, Firefox, Safari
- **Mobile Responsiveness** testing workflows on mobile devices
- **Accessibility Testing** validating WCAG compliance in workflows
- **Performance Testing** measuring workflow completion times
- **Error Scenario Testing** validating error handling and edge cases

PLAYWRIGHT VALIDATION does NOT include:
- Unit testing (covered by existing test suites)
- API testing in isolation (workflows test full stack)
- Load testing or stress testing
- Security penetration testing

---

## INPUT SOURCES

### Required Analysis
**MUST READ** these documents in order:
1. **Design Blueprint**: `ai_docs/context/project_docs/design_blueprint.md` ⚠️ **CRITICAL**
   - Maps workflow actions to specific UI components and pages
   - Provides component specifications and interaction patterns
   - Defines page architecture and navigation structure
   - Contains test selector guidance and accessibility requirements

2. **Workflow Documents**: All `.md` files in `ai_docs/workflows/`
   - Extract user journey flows and automation legends
   - Identify critical path scenarios for testing
   - Map workflow dependencies and integration points
   - Cross-reference with design blueprint UI mappings

### Project Structure Analysis
**MUST ANALYZE** existing project structure:
- Identify frontend framework and routing patterns
- Locate existing test infrastructure and patterns
- Review component structure for test selectors
- Understand authentication and user role systems
- Map design blueprint components to actual implementation

---

## OUTPUT FORMAT

Follow this exact structure:

```markdown
# [Project Name] - PLAYWRIGHT WORKFLOW VALIDATION

`Implement comprehensive end-to-end testing for all user workflows using Playwright`

## Playwright Setup and Configuration
1. [Playwright installation and configuration tasks]

## Test Infrastructure Setup
2. [Base test utilities and helper setup]
3. [Test data management and fixtures]

## Workflow Test Implementation
4. [Individual workflow test suites]
5. [Cross-workflow integration tests]

## Accessibility and Performance Testing
6. [WCAG compliance validation]
7. [Performance benchmarking tests]

## Cross-Browser and Mobile Testing
8. [Multi-browser test execution]
9. [Mobile responsiveness validation]

## CI/CD Integration
10. [Automated test execution setup]
11. [Test reporting and monitoring]
```

---

## TASK WRITING RULES

### ✅ DO:
- Reference specific workflow documents from `ai_docs/workflows/`
- Include test file paths following project conventions
- Specify test data requirements and fixtures
- Focus on complete user journey validation
- Include accessibility and performance testing
- Add cross-browser and mobile testing tasks
- Include CI/CD integration tasks

### ❌ DON'T:
- Write actual test code in tasks
- Include unit testing tasks
- Add load testing or security testing
- Include backend-only API testing
- Write implementation details

---

## PLAYWRIGHT TASK CATEGORIES

### 1. Playwright Setup and Configuration
```
1. Install and configure Playwright for the project
   - Add Playwright dependencies to package.json
   - Configure playwright.config.ts with browsers and settings
   - Set up test directories following project structure
   - Configure base URL and environment variables
```

### 2. Test Infrastructure Setup
```
2. Create base test utilities in `tests/utils/`
   - Implement authentication helpers for different user roles
   - Create page object models for common UI components
   - Set up test data factories and fixtures
   - Implement custom assertions and matchers
```

### 3. Workflow Test Implementation
```
3. Implement [Workflow Name] end-to-end tests in `tests/workflows/[workflow-name].spec.ts`
   - Test complete user journey from workflow document
   - Validate all automation legend scenarios (🚀 Automated, 👤 Human-in-the-Loop, ⚡ Semi-Automated)
   - Include error handling and edge case scenarios
   - Test workflow integration points and dependencies
```

### 4. Cross-Browser and Mobile Testing
```
4. Configure cross-browser test execution
   - Set up Chrome, Firefox, and Safari test runs
   - Configure mobile device emulation tests
   - Implement responsive design validation
   - Test touch interactions and mobile-specific features
```

### 5. Accessibility and Performance Testing
```
5. Implement accessibility testing with axe-playwright
   - Validate WCAG 2.1 AA compliance for all workflows
   - Test keyboard navigation and screen reader compatibility
   - Validate color contrast and focus management
   - Test with assistive technology simulation
```

### 6. CI/CD Integration
```
6. Set up automated test execution
   - Configure GitHub Actions/CI pipeline for Playwright tests
   - Set up test result reporting and artifact collection
   - Configure test failure notifications and alerts
   - Implement test result dashboard and monitoring
```

---

## WORKFLOW ANALYSIS TEMPLATE

For each workflow in `ai_docs/workflows/`, analyze:

### User Journey Mapping
- **Primary Actor**: Who is the main user (Admin, Teacher, Parent, System)
- **Entry Point**: How does the user start the workflow
- **Critical Path**: Essential steps that must work for business success
- **Decision Points**: Where user choices affect the flow
- **Exit Conditions**: How the workflow completes successfully or fails

### Design Blueprint UI Mapping
- **Page Routes**: Map workflow steps to specific page URLs from design blueprint
- **UI Components**: Identify specific components used in each workflow step
- **User Interactions**: Map workflow actions to UI elements (buttons, forms, modals)
- **Navigation Flow**: Trace user navigation path through the application
- **State Changes**: Identify UI state changes that occur during workflow
- **Test Selectors**: Use component specifications to identify test selectors

### Test Scenario Identification
- **Happy Path**: Complete successful workflow execution
- **Error Scenarios**: What can go wrong and how system handles it
- **Edge Cases**: Boundary conditions and unusual but valid scenarios
- **Integration Points**: Where this workflow connects to others
- **Performance Expectations**: Time limits and responsiveness requirements
- **UI Validation**: Verify correct UI components render and function

### Technical Requirements
- **Authentication**: What user roles and permissions are needed
- **Data Setup**: What test data must exist before workflow starts
- **External Dependencies**: APIs, services, or systems the workflow relies on
- **Cleanup**: What data or state changes need cleanup after testing
- **Component Testing**: Validate specific UI components from design blueprint

---

## EXAMPLE OUTPUT

```markdown
# Music School Admin - PLAYWRIGHT WORKFLOW VALIDATION

`Implement comprehensive end-to-end testing for all user workflows using Playwright`

## Playwright Setup and Configuration
1. Install and configure Playwright for React/TypeScript project
   - Add @playwright/test and related dependencies
   - Configure playwright.config.ts with Chrome, Firefox, Safari
   - Set up test directories: tests/workflows/, tests/utils/, tests/fixtures/
   - Configure base URL for local development and CI environments

## Test Infrastructure Setup
2. Create authentication test utilities in `tests/utils/auth.ts`
   - Implement login helpers for Admin, Teacher, Parent roles
   - Create session management and role switching utilities
   - Set up test user fixtures with appropriate permissions

3. Create page object models in `tests/utils/pages/`
   - Implement common UI component abstractions
   - Create navigation helpers and form interaction utilities
   - Set up data table and calendar interaction helpers

## Workflow Test Implementation
4. Implement Enrollment Handoff workflow tests in `tests/workflows/enrollment-handoff.spec.ts`
   - Map workflow steps to design blueprint UI components:
     * Teacher confirmation → `/teacher/enrollments/pending` with EnrollmentCard component
     * Terms acceptance → `/parent/terms-acceptance/:token` with TermsAcceptance component
     * Payment processing → Admin dashboard PaymentProcessingDashboard component
   - Test complete parent enrollment journey from public site to payment
   - Validate 4-hour timeslot hold and automatic release functionality
   - Test teacher confirmation process and terms acceptance integration
   - Verify payment processing activation after terms acceptance

5. Implement Teaching Workflow tests in `tests/workflows/teaching-workflow.spec.ts`
   - Map workflow steps to design blueprint UI components:
     * Daily lesson interface → `/teacher/lessons/current` with CurrentLessonPanel
     * Attendance marking → AttendanceMarking component with makeup eligibility
     * Lesson notes → QuickNotes component with voice-to-text capability
   - Test daily teacher session from login to lesson completion
   - Validate attendance marking and makeup lesson policy enforcement
   - Test lesson notes recording and parent communication
   - Verify makeup lesson scheduling within designated makeup week

6. Implement Parent Portal workflow tests in `tests/workflows/parent-portal.spec.ts`
   - Map workflow steps to design blueprint UI components:
     * Parent dashboard → `/parent/dashboard` with StudentOverviewCard
     * Schedule management → `/parent/schedule` with LessonCalendar component
     * Payment management → `/parent/payments` with PaymentHistoryTable
   - Test parent account setup and portal orientation
   - Validate schedule viewing and change request functionality
   - Test payment history access and payment method updates
   - Verify student progress tracking and teacher communication

## Accessibility and Performance Testing
7. Implement accessibility validation with axe-playwright
   - Test WCAG 2.1 AA compliance across all workflow pages
   - Validate keyboard navigation and screen reader compatibility
   - Test color contrast and focus management
   - Verify form accessibility and error message clarity

8. Implement performance benchmarking tests
   - Measure dashboard load times (<2 seconds requirement)
   - Test report generation performance (<30 seconds requirement)
   - Validate mobile performance on 3G networks
   - Monitor memory usage during long workflow sessions

## Cross-Browser and Mobile Testing
9. Configure multi-browser test execution
   - Set up Chrome, Firefox, Safari test runs in CI
   - Configure mobile device emulation (iPhone, Android)
   - Test responsive design breakpoints and touch interactions
   - Validate PWA functionality and offline capabilities

## CI/CD Integration
10. Set up GitHub Actions workflow for automated testing
    - Configure test execution on pull requests and main branch
    - Set up test result reporting with screenshots and videos
    - Configure Slack/email notifications for test failures
    - Implement test result dashboard with historical trends
```

---

## SAVE LOCATION

- **Generated Tasks**: `ai_docs/tasks/playwright_validation_tasks.md`

---

## USAGE EXAMPLES

### Standard Usage
```
→ Analyze all workflows in ai_docs/workflows/ and generate comprehensive Playwright validation tasks
```

### With Custom Focus
```
"Focus on enrollment and payment workflows"
→ Generate Playwright tasks prioritizing enrollment_handoff_workflow.md and payment_processing_workflow.md
```

### With Specific Requirements
```
"Include accessibility testing and mobile-first validation"
→ Generate tasks with enhanced accessibility and mobile testing requirements
```

---

**REMEMBER**: PLAYWRIGHT VALIDATION = Complete User Journey Testing + Cross-Browser + Mobile + Accessibility + Performance. Focus on validating the real user experience described in workflow documents.