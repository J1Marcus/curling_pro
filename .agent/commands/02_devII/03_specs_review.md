# Command: Spec Conformance Review

SPEC_PATH=<file>

Purpose
- Guide an LLM to review a spec document for conformance to PRD, libraries, and OpenAPI.

Required Inputs
- SPEC_PATH: path to the spec markdown, e.g., [ai_docs/specs/07_admin_integration.md](ai_docs/specs/07_admin_integration.md:1)
- PRD_PATH: [ai_docs/context/core_docs/frontend_prd.md](ai_docs/context/core_docs/frontend_prd.md:1)
- PACKAGE_JSON: [package.json](package.json:1)
- OPENAPI_URL: https://api.sureguard.us/openapi.json

Review Checklist
1) PRD alignment
- Verify state mgmt stack: TanStack Query v5 (no persistence), Zustand (no persistence), React Hook Form + Zod, React Router, MUI. Source: [frontend_prd.md](ai_docs/context/core_docs/frontend_prd.md:285)
- Required sections exist in SPEC:
  - "State & Query Management Compliance"
  - "Custom Hook Policy"
  - "Interfaces & Contracts" mapping to [ApiClient](src/services/api/client.ts:1)
  - "Error Handling" with correlationId
  - "Testing Requirements"
- Enforce “no custom implementations” for state/query/forms. Replace bespoke custom hooks with direct library usage.

2) Libraries and patterns
- Confirm dependencies in [package.json](package.json:57) include @tanstack/react-query, zustand, react-hook-form, zod, @mui/material, react-router-dom.
- Prohibit:
  - Redux, SWR, Apollo, or any other server-state libs
  - React Query persistence (persistQueryClient)
  - localStorage/sessionStorage/IndexedDB for server state
  - Bespoke stateful custom hooks beyond thin pass-through wrappers
- Require:
  - QueryClient defaults with staleTime: 0, gcTime: 0, refetchOnWindowFocus: true, safe retry policy
  - Direct useQuery/useMutation usage; hierarchical query keys
  - Minimal Zustand store for UI-only state; no persistence plugin
  - RHF useForm with Zod schema

3) OpenAPI conformance
- Fetch OPENAPI_URL and validate that every endpoint referenced in SPEC exists, with method and path correct.
- Validate filters/params used by SPEC against endpoint definitions.
- Validate request/response schemas for create/update/status flows.
- Validate error shape includes correlationId; auth uses Bearer; 401/403 documented.
- Produce a mapping table:
  - Endpoint, Method, Path, Exists(Y/N), Filters, Request schema, Response schema, Notes.

Standard Snippets to Require in SPEC (non-persistent patterns)
- Query client defaults (example):
[TypeScript.queryClient()](src/services/api/client.ts:1)
```ts
// QueryClient defaults — enforce in app bootstrap or documented here
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: 0,
      refetchOnWindowFocus: true,
      retry: (count, err) => count < 3 && !isAuthError(err)
    },
    mutations: {
      retry: (count, err) => count < 3 && !isAuthError(err)
    }
  }
});
```
- UI store (Zustand) pattern:
[TypeScript.useAccountsUiStore()](src/hooks/admin/useAccounts.ts:1)
```ts
type SortOrder = 'asc' | 'desc';
interface Filters { search: string; status?: string; type?: string; sortBy?: string; sortOrder?: SortOrder; }
interface AccountsUiState {
  filters: Filters; page: number; limit: number;
  isCreateOpen: boolean; isEditOpen: boolean;
}
```
- Form pattern (RHF + Zod):
[TypeScript.useAccountForm()](src/hooks/admin/useAccounts.ts:1)
```ts
const schema = z.object({ name: z.string().min(2) /* … */ });
type FormValues = z.infer<typeof schema>;
const form = useForm<FormValues>({ resolver: zodResolver(schema) });
```

Audit and Error Handling Requirements
- All network calls go through [ApiClient](src/services/api/client.ts:1) with X-Correlation-ID.
- No automatic fallbacks or alternate APIs.
- Friendly error messages include correlationId.

Procedure
1. Load [SPEC_PATH](ai_docs/specs/02_admin_accounts_backend_integration.md:1), [PRD_PATH](ai_docs/context/core_docs/frontend_prd.md:1), [PACKAGE_JSON](package.json:1), and download OPENAPI_URL.
2. Run the Review Checklist; annotate SPEC with line refs where non-compliant.
3. Write a concise Remediation Plan listing exact text insertions/edits needed.
4. Produce an approval verdict: Pass/Fail.

Success Criteria
- SPEC explicitly documents compliant state/query/form patterns.
- SPEC references only valid OpenAPI endpoints/filters/schemas.
- SPEC forbids bespoke custom hooks and persistence for server state.

# OUTPUT
## STEP 1 BLOCKERS
- Identify and document **actual blockers** that prevent spec completion or review - these are missing prerequisites required to write or validate the spec itself, not missing implementations that the spec is meant to define. Examples of blockers include:
  - Missing or inaccessible OpenAPI documentation needed for endpoint validation
  - Missing PRD sections that define required architectural patterns
  - Missing package.json dependencies that conflict with spec requirements
  - Inaccessible reference files or documentation needed for spec conformance
- Create requirements document in `ai_docs/specs/` for **each** genuine blocker, outlining what prerequisite information or access is needed to complete the spec review.

## STEP 2 REVISE
- Update Specs document so it is in compliance where possible (including references)