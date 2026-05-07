# Prompt Template: Feature Breakdown Document

## Role

You are a senior product analyst and technical architect breaking down a project's requirements into a comprehensive, feature-by-feature document.

## Input Variables

```
PROJECT_NAME: {e.g., "Meet.io"}
OUTPUT_PATH: {e.g., "docs/mvp/feature-breakdown-docs.md"}
TECH_STACK: {AI will extract from TECH_DOCS or ask user to confirm}
```

---

## Reference Documents (Optional)

```
PRD_REF: {docs/requirements/meetio-PRD.md}
TRD_REF: {docs/requirements/meetio-TRD.md}
SRS_REF: {docs/requirements/meetio-SRS.md}
MVP_ROADMAP_REF: {docs/mvp/mvp-roadmap.md}
DB_shema: {docs/requirements/meetio-database-schema.md}
API_spec: {docs/requirements/meetio-api-spec.md}
```

**Instructions for AI Agent:**

- Use reference documents as the source of truth for features and scope.
- Do NOT invent features that aren't supported by the reference docs.
- If docs conflict, prioritize PRD > SRS > TRD for feature scope.
- Extract features from ALL reference documents — do not miss any.

---

## AI Agent Rules (Read Carefully)

### RULE 1: Feature Extraction

- Extract EVERY feature mentioned across all reference documents
- Group related features under numbered feature categories (1, 2, 3...)
- Each feature gets a clear, descriptive title

### RULE 2: MVP vs Future Classification

- Mark each feature as `[MVP]` or `[Future]`
- MVP = absolutely required for the app to work
- Future = important but not required for initial launch
- Be strict: if the app works without it, it's Future

### RULE 3: Feature Detail Format

Each feature line MUST include:

- Feature name in bold or clear text
- Brief description of what it does
- Technical details (API endpoints, libraries, patterns) in parentheses
- Implementation status if known (e.g., "— implemented", "— not started")

### RULE 4: Category Organization

- Number features sequentially (1, 2, 3...)
- Each category represents a logical feature area (Auth, Dashboard, Meetings, etc.)
- Keep related features together
- Order categories by implementation priority (Core MVP first)

### RULE 5: Summary Table

At the end, include a summary table with:

- Category name
- MVP feature count
- Future feature count
- Total feature count
- Grand totals row

### RULE 6: Feature Dependencies

- After each feature, note dependencies using `→` notation
- Example: `Depends on: Feature 3 (Instant Meetings)`
- If no dependencies, omit the line

### RULE 7: Risk/Complexity Flags

- Mark high-risk or complex features with `⚠️`
- Briefly explain the risk (external API, performance, security, etc.)
- Example: `⚠️ High Risk: Deepgram integration (external API, network reliability)`

### RULE 8: Cross-Feature Relationships

- At the end of the document, add a "Shared Infrastructure" section
- Note components, APIs, or services used by multiple features
- Example: `Shared: Features 3, 4, 5 all use LiveKit room/token infrastructure`

### RULE 9: Effort Estimation

- Each feature gets an effort estimate: S (<4h), M (4-8h), L (1-2 days), XL (3+ days)
- Base estimate on complexity, not just scope
- Consider: API complexity, UI states, external integrations, testing needs

### RULE 10: Acceptance Criteria

- Each feature includes 2-4 acceptance criteria
- Format: "Given X, When Y, Then Z"
- Criteria must be testable and unambiguous
- Example: "Given user submits valid form, When POST /api/meetings/instant, Then meeting created with roomId"

### RULE 11: Testing Strategy

- Note required test types per feature: Unit, Integration, E2E, Manual
- Example: "Tests: Unit (service layer), Integration (API endpoint), E2E (user flow)"
- If feature is UI-only, note: "Tests: Component unit, E2E flow"

### RULE 12: Data Model Impact

- Flag features that create/modify database models
- Options: "DB Impact: New model", "DB Impact: Modify existing model", "DB Impact: None"
- Specify which model if applicable

### RULE 13: Feature Flags

- Mark features that should be deployed behind feature flags
- Example: "Flag: enable-ai-recap (rollout to 10% → 50% → 100%)"
- If no flag needed, omit the line

### RULE 14: User Story Mapping

- Each feature connects to at least one user persona
- Format: "As a {persona}, I want {action} so that {benefit}"
- Personas: Guest, Authenticated User, Host, Admin

---

## Output Format (Match Exactly)

```markdown
# Feature Breakdown for PROJECT_NAME

**Source:** PRD, TRD, MVP Roadmap
**Date:** {current date}
**Tech Stack:** TECH_STACK

---

## 1. Feature Category Name

- [MVP] Feature description (technical details in parentheses)
  - Status: [ ] Not started | [~] In progress | [x] Complete | [!] Blocked
  - Depends on: Feature X (Name)
  - ⚠️ Risk: Brief explanation
  - Effort: S/M/L/XL
  - Acceptance:
    - Given X, When Y, Then Z
    - Given A, When B, Then C
  - Tests: Unit, Integration, E2E, Manual (specify which)
  - DB Impact: New model / Modify existing / None
  - Flag: feature-flag-name (if applicable)
  - User Story: As a {persona}, I want {action} so that {benefit}

- [Future] Future feature description (details)
  - Status: [ ] Not started
  - Effort: S/M/L/XL
  - User Story: As a {persona}, I want {action} so that {benefit}

## 2. Feature Category Name

- [MVP] ...
- [Future] ...

(repeat for ALL feature categories)

---

## Shared Infrastructure

- Shared: Features X, Y, Z all use {component/service/API}
- Shared: Features A, B share {database model, utility, etc.}

---

## Summary

| Category   | MVP Features | Future Features | Total     |
| ---------- | ------------ | --------------- | --------- |
| Category 1 | X            | Y               | X+Y       |
| Category 2 | X            | Y               | X+Y       |
| **Total**  | **Sum**      | **Sum**         | **Total** |

**MVP Progress:** X/Y features complete (Z%)

---

## Related Documentation

- Implementation prompts: {path to prompts folder}
- Task breakdown: {path to task breakdown folder}
  **Overall Progress:** X/Total features complete (Z%)
```

---

## Quality Checklist (AI Self-Validation)

Before outputting, run these checks:

### Completeness Validation

- [ ] Every feature from ALL reference documents is captured
- [ ] No distinct features merged or combined
- [ ] MVP vs Future classification is consistent and justified
- [ ] Summary counts mathematically correct (MVP + Future = Total per category)
- [ ] Grand totals row matches sum of all categories

### Format Validation

- [ ] Features numbered sequentially with no gaps
- [ ] Each feature includes technical details in parentheses
- [ ] Status format matches exactly: `[ ] Not started | [~] In progress | [x] Complete | [!] Blocked`
- [ ] Dependencies use `→` or `Depends on:` notation
- [ ] Risk flags use `⚠️` prefix with brief explanation
- [ ] Effort estimate present for every feature (S/M/L/XL)
- [ ] Acceptance criteria present for MVP features (2-4 per feature)
- [ ] Testing strategy noted for each feature
- [ ] DB Impact specified for each feature
- [ ] User Story present for each feature

### Dependency Validation

- [ ] All feature dependencies are documented
- [ ] No circular dependencies between features
- [ ] Shared infrastructure section lists all cross-feature relationships

---

## Anti-Patterns (DO NOT Do These)

❌ "Authentication system" (too vague — what specifically?)
❌ "Add email feature" (which email? invite, verification, reminder?)
❌ Merge "Login + Registration + OAuth" into one feature (these are 3 distinct features)
❌ Skip technical details (always include API paths, libraries, patterns)
❌ Invent features not mentioned in reference docs
❌ Use inconsistent status formats across features
❌ Forget to note dependencies between features
❌ Skip acceptance criteria for MVP features
❌ Omit effort estimates
❌ Forget user story mapping

## Positive Patterns (DO These)

<!-- Guest persistence removed in new approach; guests are ephemeral -->

✅ "Login with JWT (POST /api/auth/login, HS256 token, 1-hour expiry, Argon2 password verification)"
✅ "Screen sharing (navigator.mediaDevices.getDisplayMedia, LiveKit screen track, publish to room)"
✅ "⚠️ High Risk: Deepgram streaming (external WebSocket API, network latency, fallback required)"
✅ "Depends on: Feature 3 (Instant Meetings) — requires roomId and LiveKit token infrastructure"
✅ "Effort: M (4-8h) — moderate complexity, straightforward API + UI states"
✅ "Acceptance: Given valid form, When POST /api/auth/register, Then user created + JWT returned"
✅ "Tests: Unit (PasswordEncoder, JwtUtil), Integration (/api/auth/\* endpoints), E2E (register → login flow)"
✅ "User Story: As a guest, I want to join a meeting without signing up so I can collaborate immediately"

---

## Constraints

- Do not start coding
- Keep feature descriptions clear and actionable
- Include technical context (APIs, libraries, patterns) where relevant
- Ensure every feature from reference docs is captured
- Do NOT merge or combine distinct features
- Number features sequentially with no gaps
