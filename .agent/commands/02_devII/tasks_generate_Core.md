# CORE Implementation Tasks Generator

**PURPOSE**: Generate tasks for implementing UI/components with dummy data

**CRITICAL**: You are creating a TASK LIST for CORE implementation, not implementing code. Write tasks that others will execute.

---

## CORE IMPLEMENTATION SCOPE

CORE focuses on:
- **UI/Component Implementation** with dummy data
- **Design Blueprint** implementation from `ai_docs/context/project_docs/design_blueprint.md`
- **Core Business Logic** from `ai_docs/context/project_docs/wbs.md`
- **Tech Stack Setup** (library installs, configuration)
- **Build Validation** (does it build + ESLint only)

CORE does NOT include:
- Real data integration
- Complex testing beyond build/ESLint
- Production optimizations
- Advanced error handling

---

## INPUT SOURCES

### Option 1: Custom Input (Priority)
If user provides any of these, use them as the primary source:
- **Custom Prompt**: Detailed feature description or requirements
- **Custom File**: Specific file path to analyze and create tasks around
- **Custom Folder**: Specific folder path to analyze and create tasks around

### Option 2: Project Documentation (Fallback)
If no custom input provided, **MUST READ** these documents:
- **Design Blueprint**: `ai_docs/context/project_docs/design_blueprint.md` ⚠️ **CRITICAL**
- **WBS**: `ai_docs/context/project_docs/wbs.md` ⚠️ **CRITICAL**
- **Architecture**: `ai_docs/context/project_docs/add.md`
- **PRD**: `ai_docs/context/project_docs/prd.md`

---

## OUTPUT FORMAT

Follow this exact structure:

```markdown
# [Feature Name] - CORE Implementation

`Implement UI/components with dummy data based on design blueprint and WBS`

## Tech Stack Setup
1. [Library installations and configuration tasks]

## Component Implementation
2. [UI component creation tasks with dummy data]
3. [Component integration tasks]

## Business Logic Implementation
4. [Core business logic from WBS with dummy data]
5. [State management tasks]

## Build Validation
6. Verify build passes (`npm run build`)
7. Verify ESLint passes (`npm run lint`)
```

---

## TASK WRITING RULES

### ✅ DO:
- Reference design blueprint specifications
- Include specific file paths (`src/components/[name]/[Component].jsx`)
- Specify dummy data requirements
- Focus on UI/component implementation
- Include tech stack setup tasks
- Add build/ESLint validation tasks

### ❌ DON'T:
- Include real data integration
- Add complex testing beyond build/ESLint
- Write implementation code
- Include production optimizations
- Add advanced error handling

---

## CORE TASK CATEGORIES

### 1. Tech Stack Setup
```
1. Install required dependencies for [feature]
   - Add [specific libraries] to package.json
   - Configure [specific tools/settings]
```

### 2. Component Implementation
```
2. Create [ComponentName] in `src/components/[category]/[ComponentName].jsx`
   - Implement UI based on design blueprint section [X]
   - Use dummy data from `src/data/[mockDataFile].js`
   - Follow existing component patterns
```

### 3. Business Logic Implementation
```
3. Implement [business logic] from WBS
   - Create store in `src/stores/[storeName].js`
   - Add core actions/state from WBS requirements
   - Use dummy data for all operations
```

### 4. Build Validation
```
4. Validate implementation
   - Run `npm run build` - must pass
   - Run `npm run lint` - must pass
   - Manual smoke test in browser
```

---

## EXAMPLE OUTPUT

```markdown
# Job Selection Workflow - CORE Implementation

`Implement job selection UI/components with dummy data based on design blueprint and WBS`

## Tech Stack Setup
1. Install job selection dependencies
   - Add react-map-gl for map component
   - Add date-fns for date handling
   - Configure map API keys in .env.example

## Component Implementation
2. Create JobSelectionModal in `src/components/jobs/JobSelectionModal.jsx`
   - Implement modal UI from design blueprint section 3.2
   - Use dummy job data from `src/data/jobSelectionMockData.js`
   - Add responsive breakpoints per existing patterns

3. Create InteractiveJobMap in `src/components/jobs/InteractiveJobMap.jsx`
   - Implement map view from design blueprint section 3.3
   - Show dummy job locations with markers
   - Add job selection click handlers

## Business Logic Implementation
4. Implement job selection store from WBS
   - Create jobSelectionStore in `src/stores/jobSelectionStore.js`
   - Add selectJob, filterJobs, sortJobs actions from WBS
   - Use dummy data for all job operations

5. Add job selection workflow logic
   - Implement multi-step selection from WBS section 2.1
   - Add local storage persistence for selections
   - Handle selection state transitions

## Build Validation
6. Verify build passes (`npm run build`)
7. Verify ESLint passes (`npm run lint`)
8. Manual test job selection flow in browser
```

---

## SAVE LOCATION

- **With Custom Input**: `ai_docs/tasks/[feature-name]/core_tasks.md`
- **Without Custom Input**: `ai_docs/tasks/core_tasks.md`

---

## USAGE EXAMPLES

### With Custom Prompt
```
"Create a job assignment workflow with drag-and-drop functionality"
→ Generate CORE tasks for implementing this specific feature
```

### With Custom File
```
"src/components/jobs/JobCard.jsx"
→ Generate CORE tasks for enhancing/refactoring this component
```

### With Custom Folder
```
"src/components/jobs/"
→ Generate CORE tasks for the entire jobs component folder
```

### Without Custom Input
```
→ Generate CORE tasks based on design_blueprint.md and wbs.md
```

---

**REMEMBER**: CORE = UI/Components + Dummy Data + Build Validation. Focus on implementing the design blueprint and WBS requirements with dummy data only.