# Universal Templates

This folder is the **single source of truth** for all project-agnostic templates. Every template here works with any project, framework, or team — no hardcoded references.

## How This Works

```
docs/_templates/          ← Universal (edit here)
       ↓ copy + customize
docs/templates/           ← Project-specific (Meet.io)
       ↓ use with AI
Output files (task-breakdowns, feature breakdowns, etc.)
```

1. **Edit** a template here in `_templates/`
2. **Copy** it to `docs/templates/` with project-specific references added
3. **Use** the project copy with an AI agent to generate output

## Available Templates

| Template                                  | What It Does                                                                                                                         | Output                           |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| `mvp-roadmap-template.md`                 | Defines MVP scope, extracts features from PRD/TRD/SRS, organizes into Core/Secondary/Future tiers                                    | `mvp-roadmap.md`                 |
| `feature-breakdown-template.md`           | Breaks features into detailed descriptions with effort estimates, acceptance criteria, testing strategy, user stories                | `feature-breakdown-docs.md`      |
| `feature-breakdown-hierarchy-template.md` | Breaks features into Tasks → Subtasks hierarchy with MVP/Later classification                                                        | `feature-breakdown-hierarchy.md` |
| `task-breakdown-template.md`              | Generates granular, implementation-ready task breakdowns. Backend-first ordering, quality checks, AI agent rules, schema/mockup refs | `task-breakdown.md`              |

## Template Anatomy

Every template includes:

| Section                    | Purpose                                                              |
| -------------------------- | -------------------------------------------------------------------- |
| **Input Variables**        | Placeholders you fill in (feature name, priority, etc.)              |
| **Reference Documents**    | (Optional) Point AI to your project docs (PRD, TRD, schema, mockups) |
| **AI Agent Rules**         | Strict constraints so output is always consistent                    |
| **Output Format**          | Exact markdown structure the AI must match                           |
| **Quality Checklist**      | Self-validation rules the AI runs before outputting                  |
| **Anti/Positive Patterns** | Examples of what to avoid and what to do                             |

## Template Flow

```
PRD/TRD/SRS
    ↓
mvp-roadmap-template.md → mvp-roadmap.md (what are we building?)
    ↓
feature-breakdown-template.md → feature-breakdown-docs.md (detailed feature descriptions)
    ↓
feature-breakdown-hierarchy-template.md → feature-breakdown-hierarchy.md (tasks → subtasks)
    ↓
task-breakdown-template.md → task-breakdown.md (implementation-ready tasks)
    ↓
Code (AI agent or developer implements tasks)
```

## Updating a Template

When you update a template here:

- Tell the AI: _"Update all copies of this template"_
- It will propagate changes to every project-specific copy
- Project-specific additions (like `## Reference Documents`) are preserved

## Conventions

- `{placeholder}` = fill this in with your value
- `RULE X:` = numbered constraint the AI must follow
- ❌ = anti-pattern (don't do this)
- ✅ = positive pattern (do this instead)
- 📐 Schema = reference to database schema section
- 📐 Mockup = reference to mockup image file
