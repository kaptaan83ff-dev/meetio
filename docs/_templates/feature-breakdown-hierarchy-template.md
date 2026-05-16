# Prompt Template: Feature Breakdown Hierarchy

## Role

You are a senior technical architect breaking down features from a Feature Breakdown Document into granular, implementation-ready tasks and subtasks.

## Input Variables

```
PROJECT_NAME: {e.g., "Meet.io"}
FEATURE_BREAKDOWN_REF: {path to feature-breakdown-docs.md}
OUTPUT_PATH: {e.g., "docs/mvp/feature-breakdown-hierarchy.md"}
```

---

## Reference Documents (Optional)

```
FEATURE_BREAKDOWN_REF: {docs/mvp/feature-breakdown-hierarchy.md}
PRD_REF: {docs/requirements/meetio-prd.md}
TRD_REF: {docs/requirements/meetio-trd.md}
feature-breakdown-docs: {docs/mvp/meetio-feature-breakdown-docs.md}
DB_schema: {docs/requirements/meetio-db-schema.md}
API_spec: {docs/requirements/meetio-api-spec.md}
```

**Instructions for AI Agent:**

- Use `feature-breakdown-docs.md` as the primary source for features.
- Use `PRD.txt` and `TRD.txt` for additional technical context if needed.
- Do NOT invent tasks that aren't supported by the reference docs.
- Each feature from the breakdown doc becomes a numbered section.
- Each feature is broken into Tasks, each Task into Subtasks.

---

## AI Agent Rules (Read Carefully)

### RULE 1: Task Extraction

- Break each feature into distinct Tasks (logical units of work)
- Each Task represents a complete piece of functionality
- Tasks should be medium-grained (not too broad, not too narrow)
- Example: "Guest UUID generation" is a Task, not "Create UUID"

### RULE 2: Subtask Granularity

- Every task has a minimum of 5 subtasks and a maximum as needed to complete that task as per the documentation
- Subtasks must be atomic (one action per subtask)
- Subtasks should be specific enough to implement directly
- Include technical details: API paths, library names, UI states

### RULE 3: MVP vs Later Classification

- Mark each Task as `[MVP]` or `[Later]`
- MVP = required for initial launch
- Later = important but not required for launch
- Be strict: if the feature works without it, it's Later

### RULE 4: Feature Numbering

- Number features sequentially (1, 2, 3...)
- Match the feature order from the Feature Breakdown Document
- Include feature name in heading: `## Feature X: Name [MVP/Later]`

### RULE 5: Task Format

Each Task MUST follow this exact structure:

```
### Task: Task Name [MVP/Later]
- Subtask: Specific action with technical detail
- Subtask: Another specific action
- ...
```

### RULE 6: Mixed Backend/Frontend

- Subtasks within a Task can include both backend and frontend work
- Do NOT separate backend/frontend into different tasks unless they're truly independent
- Group related backend+frontend work under one Task

### RULE 7: Feature Status Notes

- If a feature has known implementation status, add a status line:
  `**Status:** Not started / In progress / Partially complete`
- Include brief context if relevant (e.g., "LiveKit tokens currently dev fallback")

---

## Output Format (Match Exactly)

```markdown
# Feature Breakdown Hierarchy

**Source:** feature-breakdown-docs.md
**Date:** {current date}

---

## Feature 1: Feature Name [MVP]

### Task: Task Name [MVP]

- Subtask: Specific action with technical detail
- Subtask: Another specific action
- Subtask: Include API paths, library names, UI states

### Task: Another Task [Later]

- Subtask: ...
- Subtask: ...

## Feature 2: Feature Name [MVP]

### Task: ...

(repeat for ALL features)
```

---

## Quality Checklist (AI Self-Validation)

Before outputting, run these checks:

### Completeness Validation

- [ ] Every feature from feature-breakdown-docs.md is included
- [ ] No features skipped or merged
- [ ] All tasks from reference docs captured
- [ ] Every task has a minimum of 5 subtasks and a maximum as needed to complete that task as per the documentation

### Format Validation

- [ ] Features numbered sequentially with no gaps
- [ ] Each task marked `[MVP]` or `[Later]`
- [ ] Subtasks start with `- Subtask:` prefix
- [ ] Task headings use `### Task: Name [MVP/Later]` format
- [ ] Feature headings use `## Feature X: Name [MVP/Later]` format

### Content Validation

- [ ] Subtasks are atomic (one action each)
- [ ] Subtasks include technical details (APIs, libraries, UI states)
- [ ] MVP vs Later classification is consistent and justified
- [ ] No vague subtasks like "implement feature" or "make it work"

---

## Anti-Patterns (DO NOT Do These)

❌ "Implement authentication" (too broad — break into specific tasks)
❌ "Add API endpoint" (which endpoint? what does it do?)
❌ Merge "Login + Registration + OAuth" into one Task (these are 3 distinct tasks)
❌ Skip technical details (always include API paths, library names, UI states)
❌ Create subtasks with more than 8 items (split into multiple tasks)
❌ Use inconsistent task/subtask format
❌ Invent tasks not supported by the feature breakdown document

## Positive Patterns (DO These)

✅ "Guest UUID generation removed – no persistence or X-Guest-Id header"
✅ "Login with JWT (POST /api/auth/login, HS256 token, 1-hour expiry, Argon2 verification)"
✅ "Microphone toggle (mute/unmute button, LiveKit track publish/unpublish, icon state change)"
✅ "Screen sharing (getDisplayMedia API, LiveKit screen track, publish to room, stop button)"

---

## Constraints

- Do not start coding
- Keep task and subtask descriptions clear and actionable
- Include technical context (APIs, libraries, patterns) where relevant
- Ensure every feature from the breakdown doc is captured
- Do NOT merge or combine distinct tasks
- Number features sequentially with no gaps

