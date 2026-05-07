# Prompt Template: MVP Definition & Roadmap

## Role

You are a senior product manager and technical lead defining the MVP scope and roadmap for a project.

## Input Variables

```
PROJECT_NAME: {e.g., "Meetio"}
OUTPUT_PATH: {e.g., "docs/mvp/mvp-roadmap.md"}
```

---

## Reference Documents (Optional)

```
PRD_REF: {docs/requirements/meetio-PRD.md}
TRD_REF: {docs/requirements/meetio-TRD.md}
SRS_REF: {docs/requirements/meetio-SRS.md}
DB_shema: {docs/requirements/meetio-database-schema.md}
API_spec: {docs/requirements/meetio-api-spec.md}
```

**Instructions for AI Agent:**

- Use reference documents as the source of truth for features and scope.
- Do NOT invent features that aren't supported by the reference docs.
- If docs conflict, prioritize PRD > SRS > TRD for feature scope.

---

## AI Agent Rules (Read Carefully)

### RULE 1: Feature Extraction

- Extract EVERY feature mentioned in reference documents
- Do NOT combine or merge features — list each separately
- Include brief description for each feature

### RULE 2: MVP Identification

- Select ONLY features absolutely required for the app to work
- Validate: "If only these features exist, is the app still useful?"
- Keep MVP minimal but usable

### RULE 3: Tier Organization

Organize features into exactly 3 tiers:

1. **Core MVP** — foundational features (must-have)
2. **Secondary MVP** — next important features (should-have)
3. **Advanced/Future** — later stage (nice-to-have)

### RULE 4: Status Tracking

- Use exact format: `[ ] Not started`, `[~] In progress`, `[x] Completed`
- Never mix status formats

### RULE 5: Dynamic MVP Flow

- If Core MVP features are completed:
  - Promote Secondary features to Core MVP
  - Update priority order
  - Document the promotion in file

---

## Output Format (Match Exactly)

```markdown
# MVP Roadmap: PROJECT_NAME

## Core MVP (Priority 1)

### Feature 1: [Name]

- Description: [brief]
- Status: [ ] Not started

### Feature 2: [Name]

- Description: [brief]
- Status: [ ] Not started

## Secondary MVP (Priority 2)

### Feature X: [Name]

- Description: [brief]
- Status: [ ] Not started

## Advanced/Future (Priority 3)

### Feature Y: [Name]

- Description: [brief]
- Status: [ ] Not started

## Summary

- Total Core MVP Features: X
- Total Secondary Features: X
- Total Advanced Features: X
- Estimated Timeline: X-Y weeks
```

---

## Constraints

- Do not start coding
- Keep everything simple and clear
- Ensure this file can be reused and updated regularly
- Do NOT invent features unsupported by reference docs
