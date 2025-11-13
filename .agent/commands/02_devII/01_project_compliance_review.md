# Command: Project Compliance Review

PROJECT_URL=<url>

Purpose
- Guide an LLM to review a project URL for anti-patterns and compliance violations against PRD, libraries, and architectural standards.
- Generate compliance tasks and backend requirements documents.

Required Inputs
- PROJECT_URL: URL to review (e.g., `/dashboard`, `/patients/123`, `/encounters/new`)
- PRD_PATH: [ai_docs/context/core_docs/frontend_prd.md](ai_docs/context/core_docs/frontend_prd.md:1)
- PACKAGE_JSON: [package.json](package.json:1)
- OPENAPI_URL: https://api.sureguard.us/openapi.json
- ROUTER_CONFIG: [src/router/index.tsx](src/router/index.tsx:1)

Anti-Pattern Detection Checklist

1) Custom implementations when existing libraries should be utilized
- State management: Must use TanStack Query v5 (no persistence) + Zustand (no persistence)
- Forms: Must use React Hook Form + Zod validation
- UI: Must use Material-UI components and theme system
- Routing: Must use React Router with role-based guards
- HTTP: Must use centralized [ApiClient](src/services/api/client.ts:1)
- Prohibit:
  - Custom state management solutions
  - Custom form validation libraries
  - Custom HTTP clients or fetch wrappers
  - Custom UI component libraries when MUI exists
  - Direct localStorage/sessionStorage for server state

2) Custom implementations violating frontend_prd.md requirements
- Zero PHI storage in client-side caches or storage (Ref: [frontend_prd.md](ai_docs/context/core_docs/frontend_prd.md:236))
- Service worker cache limited to app shell assets only (Ref: [frontend_prd.md](ai_docs/context/core_docs/frontend_prd.md:236))
- TanStack Query with staleTime: 0, gcTime: 0, no persistence (Ref: [frontend_prd.md](ai_docs/context/core_docs/frontend_prd.md:293))
- Zustand without persistence plugins (Ref: [frontend_prd.md](ai_docs/context/core_docs/frontend_prd.md:294))
- Material-UI with custom healthcare theme (Ref: [frontend_prd.md](ai_docs/context/core_docs/frontend_prd.md:298))
- Comprehensive audit logging (Ref: [frontend_prd.md](ai_docs/context/core_docs/frontend_prd.md:247))

3) Mock data validation against backend endpoints
- Fetch OPENAPI_URL and validate mock data schemas match API specifications
- Verify all mock endpoints exist in OpenAPI spec
- Check request/response schemas for consistency
- Validate error response formats include correlationId
- Ensure authentication uses Bearer tokens
- Produce endpoint mapping table:
  - Mock Endpoint, Real Endpoint, Method, Schema Match (Y/N), Notes

4) Dangerous fallbacks that mask failing code
- **CRITICAL**: No automatic fallbacks without explicit user permission
- Prohibited patterns:
  - Switching from backend auth to mock auth on failure
  - Using alternative APIs when primary fails
  - Implementing backup data sources
  - Creating workarounds for broken functionality
  - Silent error swallowing with fallback behavior
- Required patterns:
  - Fail-fast with clear error messages
  - User-prompted error recovery
  - Explicit fallback requests only

5) Dangerous workarounds that mask failing code
- Try-catch blocks that hide errors without proper logging
- Default values that mask missing data
- Conditional rendering that hides broken components
- Network retry logic without exponential backoff limits
- Error boundaries that don't report errors to monitoring
- Mock data that doesn't match real API schemas

URL Analysis Procedure
1. Parse PROJECT_URL and identify associated components/pages
2. Trace component tree from URL to identify all related files:
   - Page components
   - Child components
   - Hooks and services
   - API calls and mock handlers
   - State management stores
3. Load and analyze each identified file for anti-patterns
4. Cross-reference with PRD requirements and OpenAPI spec
5. Generate compliance violations report

File Pattern Analysis
- Pages: `src/pages/**/*.tsx` - Check for direct API calls, custom state management
- Components: `src/components/**/*.tsx` - Check for MUI compliance, proper props typing
- Hooks: `src/hooks/**/*.ts` - Check for custom implementations vs library usage
- Services: `src/services/**/*.ts` - Check for proper ApiClient usage, error handling
- Contexts: `src/contexts/**/*.tsx` - Check for proper TanStack Query/Zustand usage
- Mocks: `src/mocks/**/*.ts` - Check schema alignment with OpenAPI spec

Standard Compliance Patterns to Enforce

Query Management (TanStack Query):
```ts
// COMPLIANT - Direct library usage, no persistence
const { data, error, isLoading } = useQuery({
  queryKey: ['patients', patientId],
  queryFn: () => api.get(`/patients/${patientId}`),
  staleTime: 0,
  gcTime: 0
});
```

State Management (Zustand):
```ts
// COMPLIANT - UI-only state, no persistence
interface UiState {
  isModalOpen: boolean;
  selectedTab: string;
}
const useUiStore = create<UiState>()((set) => ({
  isModalOpen: false,
  selectedTab: 'overview',
  setModalOpen: (open) => set({ isModalOpen: open }),
  setSelectedTab: (tab) => set({ selectedTab: tab })
}));
```

Form Management (React Hook Form + Zod):
```ts
// COMPLIANT - Direct library usage with validation
const schema = z.object({
  name: z.string().min(1, 'Name required'),
  email: z.string().email('Invalid email')
});
const form = useForm<z.infer<typeof schema>>({
  resolver: zodResolver(schema)
});
```

API Integration:
```ts
// COMPLIANT - Centralized client with correlation ID
const response = await api.post('/encounters', encounterData);
// Correlation ID automatically added by ApiClient
```

Error Handling Requirements
- All network calls through [ApiClient](src/services/api/client.ts:1) with correlation IDs
- No automatic fallbacks or alternate APIs without user permission
- Error messages include correlationId for debugging
- Proper error boundaries with monitoring integration
- Failed requests must fail-fast with clear user feedback

Output Generation
1. Create `ai_docs/tasks/<URLSTUB>_fe_compliance_tasks.md` with:
   - Identified anti-patterns and violations
   - Specific remediation tasks with file references
   - Priority levels (Critical, High, Medium, Low)
   - Compliance checklist for each violation

2. Create `ai_docs/tasks/<URLSTUB>_be_requirements.md` with:
   - Missing backend endpoints identified from mock usage
   - Schema requirements based on frontend expectations
   - Authentication and authorization requirements
   - Error response format specifications
   - API versioning and deprecation needs

Document Template Structure

Frontend Compliance Tasks:
```markdown
# Frontend Compliance Tasks: <URL>

## Critical Violations
- [ ] **State Management**: Replace custom state with TanStack Query
  - File: `src/components/example.tsx:45`
  - Issue: Direct useState for server state
  - Fix: Use useQuery with proper cache settings

## Backend Requirements
- [ ] **Missing Endpoint**: POST /api/encounters
  - Expected by: `src/services/encounterService.ts:23`
  - Schema: EncounterCreateRequest
  - Auth: Bearer token required
```

Success Criteria
- All anti-patterns identified with specific file references
- Compliance tasks prioritized and actionable
- Backend requirements specify exact API needs
- No dangerous fallbacks or workarounds present
- Mock data aligns with OpenAPI specifications

Procedure
1. Parse PROJECT_URL and identify component tree
2. Analyze each file for the 5 anti-pattern categories
3. Cross-reference with PRD requirements and OpenAPI spec
4. Generate prioritized compliance tasks document
5. Generate backend requirements document
6. Validate all recommendations against established patterns

# EXECUTION STEPS

## STEP 1: URL ANALYSIS
- Parse PROJECT_URL and map to router configuration
- Identify all components, hooks, and services in the component tree
- Load and analyze each file for anti-patterns

## STEP 2: COMPLIANCE CHECKING
- Run through all 5 anti-pattern detection categories
- Cross-reference findings with PRD requirements
- Validate mock data against OpenAPI specifications

## STEP 3: DOCUMENT GENERATION
- Create frontend compliance tasks document with specific remediation steps
- Create backend requirements document with API specifications
- Include file references, priority levels, and success criteria