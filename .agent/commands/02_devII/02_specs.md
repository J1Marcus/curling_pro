# Engineering Specification Generator

**IMPORTANT: This command generates ONLY a specification document. Do NOT implement any code changes.**

## Instructions

You are tasked with creating a comprehensive engineering specification document based on the provided input. If input is a url, your task is to implment the backend integration for the components utilized by that url.

Follow these steps:

1. **ONLY CREATE A SPECIFICATION DOCUMENT** - Do not implement any code
2. **IDENTIFY BLOCKERS** - If any blockers exist, ensure these are well documented and address prior to implmenting feature
2. **CREATE FILE LOCATION** - Always create file in `ai_docs/specs/<###><descriptive_name_of_feature>.md`
3. **USE THE TEMPLATE BELOW** - Follow the exact structure provided

## Specification Template

Use this exact template structure for all specifications:

---

# Engineering Specification

## Context

### Desired Outcome

*In 2-3 sentences, what should be different after this work is complete?*

### Current State

*Describe what exists today:*

- Relevant files and their current functionality.
- Existing interfaces or APIs being used.
- Current behavior that needs to change.
- Specification compliance analysis against your product and architecture documents (PRD/ADD or equivalents):
  - Sources (configurable per project; provide concrete paths when available):
    - PRD (Product Requirements): e.g., [`ai_docs/context/core_docs/frontend_prd.md`](ai_docs/context/core_docs/prd.md)
    - ADD (Architecture Design): e.g., [`ai_docs/context/core_docs/frontend_add.md`](ai_docs/context/core_docs/add.md)
    - DESIGN BLUEPRINT (UI Design): e.g., [`ai_docs/context/core_docs/overview/design_blueprint.md`](ai_docs/context/core_docs/overview/design_blueprint.md)
  - Methodology (project-agnostic):
    - Extract requirement IDs/titles from the PRD (functional and non-functional).
    - For each requirement, capture:
      - Expected behavior (from PRD)
      - Observed behavior (current system)
      - Evidence links to code/tests
      - Status: compliant | partial | non-compliant
      - Violation notes and impact
      - Remediation action, owner, priority
    - Validate architecture/contract items from the ADD:
      - Interfaces/contracts, state management, security/privacy, PWA/offline, API integration, error semantics.
  - Compliance crosswalk (fill one block per requirement/decision):
    - Requirement: <ID/Title> (Ref: [`path/to/prd.md`](path/to/prd.md:123))
    - Expected: <concise expectation from PRD/ADD>
    - Observed: <what the current feature does>
    - Evidence: [`path/to/file.ts`](path/to/file.ts:42), [`exampleFunction()`](path/to/module.ts:87)
    - Status: compliant | partial | non-compliant
    - Violation notes: <why it deviates, scope of impact>
    - Remediation: <specific change>, owner, priority, target date
- **API Analysis**: Validate against the project's authoritative API specification (OpenAPI/Swagger):
  - Spec source: URL or file path provided by the user (e.g., https://example.com/openapi.json or [`docs/openapi.yaml`](docs/openapi.yaml))
  - Available endpoints and HTTP methods
  - Input schemas (request body, query parameters, path parameters)
  - Output schemas (response structures, status codes)
  - Available modifiers (filters, sorting, pagination parameters)
  - Authentication requirements and security schemas
  - Error response formats and status codes

### Success Criteria

*List specific, testable requirements:*

- Feature X should do Y when Z happens.
- Performance should meet threshold N.
- All existing tests should still pass.

## Implementation Specification

### API Integration Requirements

*Define comprehensive API integration specifications based on OpenAPI schema analysis:*

#### Request Configuration
```typescript
// HTTP Request Configuration
interface ApiRequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  endpoint: string; // Full endpoint path with parameters
  headers: Record<string, string>; // Required and optional headers
  queryParams?: Record<string, any>; // Query string parameters
  pathParams?: Record<string, string>; // URL path parameters
  requestBody?: any; // Request payload schema
  timeout?: number; // Request timeout in milliseconds
  retryConfig?: RetryConfig; // Retry strategy configuration
}

// Authentication Configuration
interface AuthConfig {
  type: 'bearer' | 'apiKey' | 'basic' | 'oauth2';
  tokenLocation: 'header' | 'query' | 'cookie';
  tokenKey: string; // Header name or query parameter key
  refreshStrategy?: RefreshTokenStrategy;
}
```

#### Response Handling
```typescript
// API Response Structure
interface ApiResponse<T = any> {
  data: T; // Response payload matching OpenAPI schema
  status: number; // HTTP status code
  statusText: string; // HTTP status message
  headers: Record<string, string>; // Response headers
  metadata?: ResponseMetadata; // Pagination, rate limits, etc.
}

// Error Response Structure
interface ApiErrorResponse {
  error: {
    code: string; // Error code from API specification
    message: string; // Human-readable error message
    details?: any; // Additional error context
    field?: string; // Field-specific validation errors
  };
  status: number;
  timestamp: string;
  path: string;
}
```

#### Schema Validation
```typescript
// Request/Response Schema Validation
interface SchemaValidation {
  requestSchema: JSONSchema; // OpenAPI request schema
  responseSchema: JSONSchema; // OpenAPI response schema
  validationMode: 'strict' | 'lenient'; // Validation strictness
  transformers?: DataTransformer[]; // Data transformation functions
}
```

### Data Models & Types

*Define data structures based on OpenAPI schema definitions:*

```typescript
// Generated from OpenAPI specification
interface ApiDataModel {
  // Map OpenAPI schema properties to TypeScript interfaces
  id: string; // Required field from API schema
  name: string; // Required field with validation rules
  status: 'active' | 'inactive' | 'pending'; // Enum from API spec
  metadata?: Record<string, any>; // Optional fields
  createdAt: string; // ISO date string format
  updatedAt: string; // ISO date string format
}

// Request/Response DTOs
interface CreateRequestDto {
  // Fields required for POST requests
}

interface UpdateRequestDto {
  // Fields required for PUT/PATCH requests
}

interface ListResponseDto<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasNext: boolean;
  };
}
```

### Interfaces & Contracts

*Specify exact API service interfaces and their behavior:*

```typescript
/**
 * API Service Interface - defines contract for backend integration
 *
 * @template T - The data model type
 */
interface ApiService<T> {
  /**
   * Fetch single resource by ID
   * @param id - Resource identifier
   * @param options - Request configuration options
   * @returns Promise resolving to resource data
   * @throws ApiError when request fails or resource not found
   */
  getById(id: string, options?: RequestOptions): Promise<ApiResponse<T>>;

  /**
   * Fetch list of resources with filtering and pagination
   * @param filters - Query filters matching API specification
   * @param pagination - Pagination parameters
   * @returns Promise resolving to paginated list
   * @throws ApiError when request fails
   */
  getList(
    filters?: FilterParams,
    pagination?: PaginationParams
  ): Promise<ApiResponse<ListResponseDto<T>>>;

  /**
   * Create new resource
   * @param data - Resource data matching create schema
   * @param options - Request configuration options
   * @returns Promise resolving to created resource
   * @throws ValidationError when data is invalid
   * @throws ApiError when creation fails
   */
  create(data: CreateRequestDto, options?: RequestOptions): Promise<ApiResponse<T>>;

  /**
   * Update existing resource
   * @param id - Resource identifier
   * @param data - Updated resource data
   * @param options - Request configuration options
   * @returns Promise resolving to updated resource
   * @throws ValidationError when data is invalid
   * @throws ApiError when update fails or resource not found
   */
  update(
    id: string,
    data: UpdateRequestDto,
    options?: RequestOptions
  ): Promise<ApiResponse<T>>;

  /**
   * Delete resource by ID
   * @param id - Resource identifier
   * @param options - Request configuration options
   * @returns Promise resolving to deletion confirmation
   * @throws ApiError when deletion fails or resource not found
   */
  delete(id: string, options?: RequestOptions): Promise<ApiResponse<void>>;
}

/**
 * HTTP Client Interface - low-level HTTP operations
 */
interface HttpClient {
  request<T>(config: ApiRequestConfig): Promise<ApiResponse<T>>;
  get<T>(url: string, config?: Partial<ApiRequestConfig>): Promise<ApiResponse<T>>;
  post<T>(url: string, data?: any, config?: Partial<ApiRequestConfig>): Promise<ApiResponse<T>>;
  put<T>(url: string, data?: any, config?: Partial<ApiRequestConfig>): Promise<ApiResponse<T>>;
  patch<T>(url: string, data?: any, config?: Partial<ApiRequestConfig>): Promise<ApiResponse<T>>;
  delete<T>(url: string, config?: Partial<ApiRequestConfig>): Promise<ApiResponse<T>>;
}
```

### HTTP Configuration & Headers

*Specify required HTTP configuration based on API specification:*

```typescript
// Standard Headers Configuration
const API_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'User-Agent': 'SEWP-Frontend/1.0.0',
  'X-API-Version': 'v1', // API version from OpenAPI spec
} as const;

// Authentication Headers
const AUTH_HEADERS = {
  'Authorization': 'Bearer {token}', // JWT token format
  'X-API-Key': '{apiKey}', // API key if required
} as const;

// Request-Specific Headers
interface RequestHeaders {
  'X-Request-ID': string; // Unique request identifier for tracing
  'X-Client-Version': string; // Frontend version for compatibility
  'X-User-ID'?: string; // User context for audit trails
  'If-Match'?: string; // ETag for optimistic locking
  'If-None-Match'?: string; // ETag for conditional requests
}

// CORS and Security Headers
const SECURITY_HEADERS = {
  'X-Requested-With': 'XMLHttpRequest',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Pragma': 'no-cache',
} as const;
```

### Plan - High-Level Tasks
- [ ] *Blocker 1* ...
   - <requirements>
- [ ] *Blocker 2* ...
   - <requirements>

- [ ] *Task 1*: ...
- [ ] *Task 2*: ...
- [ ] *Task 3*: ...
- etc...

### Implementation Order - Step-by-Step Subtasks

*Step-by-step implementation plan:*

1. **Create/Update `path/to/file.ts`**:
   - Add function `doSomething()` that handles X.
   - Modify `existingFunction()` to call `doSomething()` when condition Y is met.

2. **Create `path/to/new_file.ts`**:
   - Implement class `NewHandler` with methods A, B, C.
   - Integration point: Called from `mainFlow()` in `app.ts`.

3. **Update configuration**:
   - Add `NEW_FEATURE_ENABLED` to settings.
   - Default value: `false` for gradual rollout.

4. etc...

### Key Algorithms & Logic

*For complex logic, provide pseudocode or detailed description:*

```txt
1. Receive input data
2. Validate against schema X
3. If condition A:
   - Transform using method B
   - Store in cache with TTL of 5 minutes
4. Else:
   - Query database for existing record
   - Merge with input data
5. Return processed result
```

### API Error Handling & Resilience

*Comprehensive error handling strategy for API integration:*

#### Error Classification
```typescript
// API Error Types
enum ApiErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',           // Connection issues
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',           // Request timeout
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR', // 401 Unauthorized
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',   // 403 Forbidden
  VALIDATION_ERROR = 'VALIDATION_ERROR',     // 400 Bad Request
  NOT_FOUND_ERROR = 'NOT_FOUND_ERROR',       // 404 Not Found
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',     // 429 Too Many Requests
  SERVER_ERROR = 'SERVER_ERROR',             // 5xx Server Errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'            // Unexpected errors
}

// Error Response Handler
interface ErrorHandler {
  canHandle(error: ApiError): boolean;
  handle(error: ApiError): Promise<ApiResponse | never>;
  shouldRetry(error: ApiError): boolean;
  getRetryDelay(attempt: number): number;
}
```

#### Retry Strategy
```typescript
// Retry Configuration
interface RetryConfig {
  maxAttempts: number;           // Maximum retry attempts (default: 3)
  baseDelay: number;             // Base delay in milliseconds (default: 1000)
  maxDelay: number;              // Maximum delay cap (default: 30000)
  backoffMultiplier: number;     // Exponential backoff multiplier (default: 2)
  retryableErrors: ApiErrorType[]; // Which errors should trigger retry
  jitter: boolean;               // Add random jitter to prevent thundering herd
}

// Default retry strategy
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  retryableErrors: [
    ApiErrorType.NETWORK_ERROR,
    ApiErrorType.TIMEOUT_ERROR,
    ApiErrorType.RATE_LIMIT_ERROR,
    ApiErrorType.SERVER_ERROR
  ],
  jitter: true
};
```

#### Circuit Breaker Pattern
```typescript
// Circuit Breaker for API resilience
interface CircuitBreakerConfig {
  failureThreshold: number;      // Failures before opening circuit
  recoveryTimeout: number;       // Time before attempting recovery
  monitoringWindow: number;      // Time window for failure counting
  halfOpenMaxCalls: number;      // Max calls in half-open state
}

enum CircuitState {
  CLOSED = 'CLOSED',             // Normal operation
  OPEN = 'OPEN',                 // Failing fast
  HALF_OPEN = 'HALF_OPEN'        // Testing recovery
}
```

#### Error Response Mapping
- **400 Bad Request**: Validate input data against OpenAPI schema, show field-specific errors
- **401 Unauthorized**: Clear auth tokens, redirect to login, refresh token if available
- **403 Forbidden**: Show permission denied message, log security event
- **404 Not Found**: Show user-friendly "resource not found" message
- **409 Conflict**: Handle optimistic locking conflicts, offer merge options
- **422 Unprocessable Entity**: Show validation errors with field mapping
- **429 Rate Limited**: Implement backoff strategy, show rate limit status
- **500+ Server Errors**: Show generic error message, log full error details
- **Network Errors**: Show offline indicator, enable retry mechanism

### Caching Strategy

*API response caching and invalidation strategy:*

#### Cache Configuration
```typescript
// Cache Strategy Configuration
interface CacheConfig {
  strategy: 'memory' | 'localStorage' | 'sessionStorage' | 'indexedDB';
  ttl: number;                   // Time to live in milliseconds
  maxSize: number;               // Maximum cache size
  keyGenerator: (request: ApiRequestConfig) => string;
  invalidationRules: InvalidationRule[];
  compressionEnabled: boolean;
}

// Cache Invalidation Rules
interface InvalidationRule {
  pattern: RegExp;               // URL pattern to match
  methods: string[];             // HTTP methods that trigger invalidation
  cascadePatterns?: RegExp[];    // Related cache entries to invalidate
}
```

#### Cache Implementation
```typescript
// Cache Entry Structure
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  etag?: string;                 // For conditional requests
  lastModified?: string;         // For conditional requests
  ttl: number;
  accessCount: number;
}

// Cache Operations
interface ApiCache {
  get<T>(key: string): Promise<CacheEntry<T> | null>;
  set<T>(key: string, data: T, options?: CacheOptions): Promise<void>;
  invalidate(pattern: string | RegExp): Promise<void>;
  clear(): Promise<void>;
  size(): Promise<number>;
}
```

#### Conditional Requests
- **ETag Support**: Use `If-None-Match` headers for cache validation
- **Last-Modified**: Use `If-Modified-Since` for timestamp-based caching
- **Cache-Control**: Respect server cache directives
- **Stale-While-Revalidate**: Serve stale data while fetching fresh data

### Request/Response Interceptors

*Middleware for request/response processing:*

```typescript
// Request Interceptor
interface RequestInterceptor {
  onRequest(config: ApiRequestConfig): Promise<ApiRequestConfig>;
  onRequestError(error: Error): Promise<never>;
}

// Response Interceptor
interface ResponseInterceptor {
  onResponse<T>(response: ApiResponse<T>): Promise<ApiResponse<T>>;
  onResponseError(error: ApiError): Promise<never>;
}

// Common Interceptors
const authInterceptor: RequestInterceptor = {
  onRequest: async (config) => {
    const token = await getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  }
};

const loggingInterceptor: ResponseInterceptor = {
  onResponse: async (response) => {
    console.log(`API Response: ${response.status} ${response.config.url}`);
    return response;
  }
};
```

### Performance Optimization

*API performance optimization strategies:*

#### Request Optimization
- **Request Batching**: Combine multiple requests into single batch operation
- **Request Deduplication**: Prevent duplicate concurrent requests
- **Payload Compression**: Use gzip/deflate for large request bodies
- **Connection Pooling**: Reuse HTTP connections for multiple requests
- **Request Prioritization**: Priority queue for critical vs. background requests

#### Response Optimization
- **Response Streaming**: Handle large responses with streaming
- **Partial Responses**: Request only needed fields using field selection
- **Pagination**: Implement efficient pagination with cursor-based navigation
- **Background Sync**: Sync data in background for offline-first experience

### Error Handling

*Specify how errors should be handled:*

- **Invalid input**: Validate against OpenAPI schema, throw `ValidationError` with field-specific messages
- **External service timeout**: Implement exponential backoff with jitter, maximum 3 retry attempts
- **Authentication failure**: Clear stored tokens, redirect to login, attempt token refresh if available
- **Rate limiting**: Respect `Retry-After` header, implement client-side rate limiting
- **Network errors**: Show offline indicator, queue requests for retry when connection restored
- **Server errors**: Log full error context, show user-friendly message, implement circuit breaker
- **Unexpected state**: Log error with request context, return cached data if available, fallback to default state

## Testing Requirements

### API Integration Test Cases

*Comprehensive testing strategy for API integration:*

```typescript
describe('API Integration Tests', () => {
  describe('Request Configuration', () => {
    test('should configure request headers correctly', () => {
      // Given: API request configuration
      // When: Making request with auth headers
      // Then: Headers should include Authorization, Content-Type, X-API-Version
    });

    test('should handle query parameters and path parameters', () => {
      // Given: Request with query and path params
      // When: Building request URL
      // Then: URL should be properly formatted with encoded parameters
    });

    test('should validate request payload against OpenAPI schema', () => {
      // Given: Request payload
      // When: Validating against schema
      // Then: Should reject invalid data with specific field errors
    });
  });

  describe('Response Handling', () => {
    test('should parse successful response correctly', () => {
      // Given: Valid API response
      // When: Processing response
      // Then: Should extract data, status, headers correctly
    });

    test('should handle different content types', () => {
      // Given: Response with various content types (JSON, XML, text)
      // When: Processing response
      // Then: Should parse content appropriately
    });

    test('should validate response against OpenAPI schema', () => {
      // Given: API response
      // When: Validating response structure
      // Then: Should match expected schema or log validation errors
    });
  });

  describe('Error Handling', () => {
    test('should handle 400 Bad Request with field validation', () => {
      // Given: 400 response with validation errors
      // When: Processing error response
      // Then: Should map errors to specific fields
    });

    test('should handle 401 Unauthorized with token refresh', () => {
      // Given: 401 response
      // When: Processing auth error
      // Then: Should attempt token refresh or redirect to login
    });

    test('should handle 429 Rate Limiting with backoff', () => {
      // Given: 429 response with Retry-After header
      // When: Processing rate limit error
      // Then: Should implement exponential backoff strategy
    });

    test('should handle network errors with retry logic', () => {
      // Given: Network connection failure
      // When: Request fails
      // Then: Should retry with exponential backoff up to max attempts
    });

    test('should handle server errors with circuit breaker', () => {
      // Given: Multiple 500 errors
      // When: Circuit breaker threshold reached
      // Then: Should open circuit and fail fast
    });
  });

  describe('Caching Strategy', () => {
    test('should cache GET responses with TTL', () => {
      // Given: Cacheable GET request
      // When: Making repeated requests
      // Then: Should serve from cache within TTL period
    });

    test('should invalidate cache on mutations', () => {
      // Given: Cached data
      // When: Making POST/PUT/DELETE request
      // Then: Should invalidate related cache entries
    });

    test('should handle conditional requests with ETags', () => {
      // Given: Cached response with ETag
      // When: Making conditional request
      // Then: Should use If-None-Match header and handle 304 responses
    });
  });

  describe('Performance', () => {
    test('should batch multiple requests efficiently', () => {
      // Given: Multiple API requests
      // When: Using request batching
      // Then: Should combine into single batch request
    });

    test('should deduplicate concurrent identical requests', () => {
      // Given: Multiple identical concurrent requests
      // When: Processing requests
      // Then: Should make only one actual API call
    });

    test('should handle large responses with streaming', () => {
      // Given: Large response payload
      // When: Processing response
      // Then: Should stream data without memory overflow
    });
  });
});
```

### Critical Test Cases

*Must-have tests for this implementation:*

```typescript
describe('Feature Tests', () => {
  test('should handle happy path correctly', () => {
    // Given: Valid input data and working API
    // When: Making API request
    // Then: Should return expected response structure
  });

  test('should handle authentication flow', () => {
    // Given: Valid credentials
    // When: Authenticating with API
    // Then: Should receive and store auth tokens
  });

  test('should handle data validation errors', () => {
    // Given: Invalid input data
    // When: Submitting to API
    // Then: Should show field-specific validation errors
  });

  test('should handle offline scenarios', () => {
    // Given: No network connection
    // When: Making API requests
    // Then: Should queue requests and show offline indicator
  });

  test('should handle concurrent requests safely', () => {
    // Given: Multiple simultaneous requests
    // When: Processing concurrently
    // Then: Should handle without race conditions or data corruption
  });
});
```

### Edge Cases to Consider

*Explicitly list edge cases that need handling:*

- **Empty/null response data**: Handle cases where API returns empty or null data
- **Malformed JSON responses**: Parse errors and invalid JSON structures
- **Concurrent access/race conditions**: Multiple users modifying same resource
- **Maximum payload size limits**: Large file uploads or data exports
- **Network failures or timeouts**: Connection drops, DNS failures, proxy issues
- **Token expiration during request**: Handle mid-request auth token expiry
- **API version mismatches**: Handle deprecated endpoints or version conflicts
- **Rate limiting edge cases**: Burst requests exceeding rate limits
- **Clock skew issues**: Time-based authentication or caching problems
- **Partial response scenarios**: Incomplete data due to server errors
- **Unicode and encoding issues**: Special characters in request/response data
- **Browser storage limits**: Cache size exceeding browser storage quotas

## Dependencies & Constraints

### External Dependencies

- Required packages: `package@version`.
- API dependencies and their expected behavior.
- Database or service requirements.

### Constraints & Assumptions

- Performance requirements (e.g., must handle 1000 requests/second).
- Memory limitations.
- Backwards compatibility requirements.
- Assumptions about input data or system state.

## Open Questions

*Items that need clarification before/during implementation:*

- [ ] How should we handle case X?
- [ ] What's the preferred error message for Y?
- [ ] Should this be configurable, and if so, what are sensible defaults?

---

## Command Execution Rules

1. **ALWAYS review the requirement files**
   - PRD path(s) (e.g., [`ai_docs/context/core_docs/prd.md`](ai_docs/context/core_docs/frontend_prd.md))
   - ADD/Architecture path(s) (e.g., [`ai_docs/context/core_docs/add.md`](ai_docs/context/core_docs/frontend_.md))
   - API spec source (OpenAPI URL or file path, e.g., [`ai_docs/context/core_docs/openapi.json`](ai_docs/context/core_docs/openapi.json))
      - grep on this as the file is VERY large
   - Any additional compliance sources (security, accessibility, legal)

2. **ASK Open Questions** 
   - seek clarification on all open questions !Important

3. **ONLY create the specification document**
   - Do NOT implement any code changes
   - Do NOT create service files, hooks, or components
   - Do NOT modify existing code files

4. **Use write_to_file tool to create the specification**
   - Fill in the template with actual analysis and requirements
   - Replace example content with project-specific details
   - Ensure all sections are completed with relevant information
