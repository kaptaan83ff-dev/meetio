# Prompt Template: Granular Feature Task Breakdown

## Role

You are a senior technical lead breaking down a feature into implementation-ready tasks for an AI development agent.

## Input Variables

```
FEATURE_NAME: {e.g., "Instant Meetings"}
FEATURE_NUMBER: {e.g., "#3 from MVP Roadmap"}
ESTIMATED_TIME: {e.g., "10-14 hours total"}
PRIORITY: {e.g., "THIRD (after Authentication & Dashboard)"}
STATUS: {e.g., "[ ] Not started"}
TECH_STACK: {AI will extract from TECH_DOCS or ask user to confirm}
DATABASE_SCHEMA_REF: {path to database-schema.md, or omit if not applicable}
MOCKUP_DIR: {path to mockups folder, or omit if not applicable}
```

---

## Reference Documents (Optional)

> Use this section to point the AI agent to project-specific documentation.
> Remove or leave empty for projects without existing references.

```
FEATURE_HIERARCHY_REF: {docs/mvp/feature-breakdown-hierarchy.md}
TECH_DOCS: {docs/requirements/meetio-trd.md}
DATABASE_SCHEMA_REF: {docs/requirements/meetio-db-schema.md}
API_SPEC: {docs/requirements/meetio-api-spec.md}
MOCKUP_DIR: {docs/mockups}
EXISTING_CODE_REF: {src}
```

**Instructions for AI Agent:**

- Use reference documents as the source of truth for tasks and subtasks.
- Do NOT invent tasks that aren't supported by the reference docs.
- If reference docs conflict with this template's rules, follow the template's structure but use the reference docs' content.

---

## AI Agent Rules (Read Carefully)

### RULE 1: Granularity Level

- Each task = 15-45 minutes of implementation work
  - Every task has a minimum of 5 subtasks and a maximum as needed to complete that task as per the documentation
- Subtasks must be atomic (one action per subtask)
- NO vague descriptions like "implement feature" or "make it work"
- DO use specific names: fields, methods, endpoints, components, routes

### RULE 2: Backend-First Ordering

Tasks MUST follow this sequence:

1. Model/Schema → 2. DTOs → 3. Repository → 4. Service → 5. API Endpoints

- Never create an API endpoint before its service exists
- Never create a service before its repository exists
- Never create a repository before its model exists

### RULE 3: Frontend Ordering

Tasks MUST follow this sequence:

1. API Service Layer → 2. Page Components → 3. Reusable Components → 4. State Management → 5. Error Handling → 6. Edge Cases

- Never create a page before its API service functions exist
- Never create UI components before their parent page exists

### RULE 4: Subtask Content Requirements

Every subtask MUST include:

- Specific implementation detail (field name, method signature, API path)
- Error handling requirement (what happens on failure)
- UI state coverage (loading, empty, error, success) where applicable
- Edge case or fallback behavior where applicable

### RULE 5: Status Conventions

- MVP tasks: `- Status: [ ] TODO` (use `[~]` for in-progress, `✅` for done)
- Future tasks: `- Status: TODO` (no checkbox)
- NEVER mix status formats

### RULE 6: Numbering System

- Sequential within feature: X.1, X.2, X.3... (no gaps, no duplicates)
- Backend tasks ALWAYS come before frontend tasks
- Future tasks continue the numbering sequence
- Example: 3.1-3.8 (Backend), 3.9-3.20 (Frontend), 3.21-3.24 (Future)

### RULE 7: Execution Order

- List tasks in EXACT implementation order
- Group by phase with brief description
- Reflect actual dependency chains (no circular dependencies)
- Format: `1. **Phase Name:** X.Y → X.Y (description)`

### RULE 8: Reference Links

- For backend model/repository tasks, add a schema reference line before Status:
  `- 📐 Schema: docs/requirements/meetio-db-schema.md#section`
- For frontend UI tasks with available mockups, add a mockup reference line before Status:
  `- 📐 Mockup: docs/mockups/filename.png`
- Only add references where relevant — do NOT force on every task
- Backend-only tasks (services, config, utilities) do NOT need mockup refs
- Frontend-only tasks (state management, API helpers) do NOT need schema refs

### RULE 9: Quality Checklist (AI Self-Validation)

Before outputting, run these checks:

#### Structure Validation

- [ ] Task numbering is sequential (X.1, X.2, X.3... no gaps, no duplicates)
- [ ] All backend tasks appear BEFORE all frontend tasks
- [ ] Future tasks continue numbering after MVP tasks
- [ ] Summary counts: MVP + Future = Total (math must be correct)

#### Content Validation

- [ ] Every task has a minimum of 5 subtasks and a maximum as needed to complete that task as per the documentation
- [ ] No subtask contains vague words ("implement", "make", "fix") without specifics
- [ ] Every API task specifies: HTTP method, path, request body, response format
- [ ] Every model/repository task references the correct schema section
- [ ] Every UI task references the correct mockup file (if available)
- [ ] Error handling is specified for every task
- [ ] Edge-case/fallback behavior is mentioned where applicable

#### Naming Validation

- [ ] Task names use "Backend -" or "Frontend -" prefix
- [ ] Subtask names follow "Verb + Object + Detail" pattern (e.g., "Implement argon2 hashing for password field")
- [ ] No duplicate task names within the same feature
- [ ] No vague or generic subtask names

#### Completeness Validation

- [ ] All tasks from the reference feature breakdown are included
- [ ] No tasks are missing or skipped
- [ ] No tasks are duplicated
- [ ] All tasks are marked with correct status format ([ ] TODO for MVP, TODO for future)

#### Format Validation

- [ ] Every task ends with exactly one Status: line
- [ ] Summary table follows exact markdown format
- [ ] Execution-order list uses X.Y → X.Y arrow syntax
- [ ] No checkbox syntax in schema/mockup reference lines
- [ ] No mixed status formats (e.g., [ ] TODO and TODO in same feature)

#### Reference Validation

- [ ] Schema references point to correct file and section
- [ ] Mockup references point to correct file
- [ ] References are only added where relevant (not forced on every task)
- [ ] Backend-only tasks do NOT have mockup references
- [ ] Frontend-only tasks do NOT have schema references

#### Dependency Validation

- [ ] Backend tasks are ordered Model → DTOs → Repository → Service → APIs
- [ ] Frontend tasks are ordered API Service → Pages → Components → Error Handling
- [ ] No circular dependencies in execution order
- [ ] Each task's subtasks reflect actual implementation dependencies

#### Quality Validation

- [ ] Subtasks are atomic (15-45 minutes each)
- [ ] Every task has a minimum of 5 subtasks and a maximum as needed to complete that task as per the documentation
- [ ] No vague descriptions like "implement feature"
- [ ] Specific field names, method signatures, API paths used
- [ ] Error handling requirements specified for every task
- [ ] UI state coverage mentioned where applicable
- [ ] Edge-case/fallback behavior mentioned where applicable
- [ ] Annotations, patterns, conventions mentioned where relevant

#### Completeness Validation

- [ ] All tasks from the reference feature breakdown are included
- [ ] No tasks are missing or skipped
- [ ] No tasks are duplicated
- [ ] All tasks are marked with correct status format ([ ] TODO for MVP, TODO for future)

#### Format Validation

- [ ] Every task ends with exactly one Status: line
- [ ] Summary table follows exact markdown format
- [ ] Execution-order list uses X.Y → X.Y arrow syntax
- [ ] No checkbox syntax in schema/mockup reference lines
- [ ] No mixed status formats (e.g., [ ] TODO and TODO in same feature)

#### Reference Validation

- [ ] Schema references point to correct file and section
- [ ] Mockup references point to correct file
- [ ] References are only added where relevant (not forced on every task)
- [ ] Backend-only tasks do NOT have mockup references
- [ ] Frontend-only tasks do NOT have schema references

#### Dependency Validation

- [ ] Backend tasks are ordered Model → DTOs → Repository → Service → APIs
- [ ] Frontend tasks are ordered API Service → Pages → Components → Error Handling
- [ ] No circular dependencies in execution order
- [ ] Each task's subtasks reflect actual implementation dependencies

#### Quality Validation

- [ ] Subtasks are atomic (15-45 minutes each)
- [ ] Every task has a minimum of 5 subtasks and a maximum as needed to complete that task as per the documentation
- [ ] No vague descriptions like "implement feature"
- [ ] Specific field names, method signatures, API paths used
- [ ] Error handling requirements specified for every task
- [ ] UI state coverage mentioned where applicable
- [ ] Edge-case/fallback behavior mentioned where applicable
- [ ] Annotations, patterns, conventions mentioned where relevant

---

## Output Format (Match Exactly)

```markdown
# Task Breakdown: FEATURE_NAME

**Feature:** FEATURE_NUMBER from MVP Roadmap
**Estimated Time:** ESTIMATED_TIME
**Priority:** PRIORITY
**Status:** STATUS

---

## Feature FEATURE_NUMBER: FEATURE_NAME

### Task X.Y: Backend - <Component/Service/API> [MVP]

- [ ] Specific subtask with implementation detail
- [ ] Include field names, method signatures, or API paths
- [ ] Specify error handling requirements
- [ ] Mention annotations, patterns, or conventions
- 📐 Schema: `docs/requirements/meetio-db-schema.md#section` (if model/repository task)
- Status: [ ] TODO

(repeat for ALL backend tasks in order: Model → DTOs → Repository → Service → APIs)

### Task X.Y: Frontend - <Component/Service/UI> [MVP]

- [ ] Specific subtask with component names, routes, or API calls
- [ ] Specify UI states (loading, error, empty, success)
- [ ] Include event handlers and state management details
- [ ] Mention accessibility and edge case handling
- 📐 Mockup: `docs/mockups/filename.png` (if UI component with available mockup)
- Status: [ ] TODO

(repeat for ALL frontend tasks in order: Service → Pages → Components → Error Handling)

---

## Future Tasks (Not MVP)

### Task X.Y: <Future Feature Name>

- [ ] Subtask for future implementation
- Status: TODO

(repeat for ALL future tasks)

---

## Summary

| Category     | Tasks       | Completed | Remaining   |
| ------------ | ----------- | --------- | ----------- |
| MVP Tasks    | <count>     | 0         | <count>     |
| Future Tasks | <count>     | 0         | <count>     |
| **Total**    | **<count>** | **0**     | **<count>** |

## Execution Order

1. **Backend Foundation:** X.Y → X.Y (Model → DTOs → Repository)
2. **Backend Services:** X.Y → X.Y (Service → Integration)
3. **Backend APIs:** X.Y → X.Y (Create → Read → Update → Delete)
4. **Frontend Service Layer:** X.Y (API client functions)
5. **Frontend Core UI:** X.Y → X.Y (Pages → Main Components)
6. **Frontend Features:** X.Y → X.Y (Secondary → Error Handling → Edge Cases)
7. **Future Enhancements:** X.Y → X.Y
```

---

## Quality Checklist (AI Self-Validation)

Before outputting, run these checks:

### Structure Validation

- [ ] Task numbering is sequential (X.1, X.2, X.3... no gaps, no duplicates)
- [ ] All backend tasks appear BEFORE all frontend tasks
- [ ] Future tasks continue numbering after MVP tasks
- [ ] Summary counts: MVP + Future = Total (math must be correct)

### Content Validation

- [ ] Every task has a minimum of 5 subtasks and a maximum as needed to complete that task as per the documentation
- [ ] No subtask contains vague words ("implement", "make", "fix") without specifics
- [ ] Every API task specifies: HTTP method, path, request body, response format
- [ ] Every UI task specifies: component name, at least 2 states (loading/error/empty/success)
- [ ] Error handling mentioned in EVERY task
- [ ] Edge cases/fallbacks mentioned where applicable

### Format Validation

- [ ] Every task ends with exactly one `Status:` line
- [ ] MVP tasks use `- Status: [ ] TODO`, Future tasks use `- Status: TODO`
- [ ] All subtasks use `- [ ]` checkbox syntax
- [ ] Summary table uses exact markdown table format with correct headers
- [ ] Execution order uses `X.Y → X.Y` arrow syntax with phase descriptions
- [ ] Backend model/repository tasks include schema references where applicable
- [ ] Frontend UI tasks include mockup references where applicable

### Dependency Validation

- [ ] No task references a component/service that appears later in the sequence
- [ ] Execution order reflects actual implementation dependency chain
- [ ] No circular dependencies between tasks

---

## Anti-Patterns (DO NOT Do These)

❌ "Implement the feature" (too vague)
❌ "Add error handling" (specify WHICH error, WHAT response)
❌ "Create UI" (specify component name, props, states)
❌ Mix backend and frontend tasks in same section
❌ Skip numbering or create gaps (3.1, 3.3, 3.5...)
❌ Put future tasks before MVP tasks
❌ Use different status formats for MVP vs future
❌ Add schema refs to non-model tasks (services, config, utilities)
❌ Add mockup refs to non-UI tasks (state management, API helpers)
❌ Force references on every task — only add where relevant

## Positive Patterns (DO These)

✅ "Add @Indexed(unique=true) annotation to roomId field"
✅ "Return 404 with {error: 'Meeting not found'} if query returns null"
✅ "Show LoadingSpinner while fetch in progress, empty state if array.length === 0"
✅ "Handle NotAllowedError with message 'Permission denied. Enable camera in browser settings.'"
✅ "Call LiveKitService.createRoom(roomId) inside @Transactional block"
✅ "📐 Schema: `docs/requirements/meetio-db-schema.md#2-meetings`" (on model task)
✅ "📐 Mockup: `docs/mockups/dashboard_colored.png`" (on UI component task)

