# Project Development Rules

## Change Logging

Every code change in this repository **must** be logged in `PROJECT_LOG.md`. This includes:
- New features implemented
- Bug fixes resolved
- Tests added or modified
- Configuration changes
- Documentation updates

### Log Entry Format

Each entry follows this structure:

```markdown
---
name: <short-kebab-case-slug>
description: <one-line summary of the change>
metadata:
  type: user | feedback | project | reference
---

<the change; for project type, follow with **Why:** and **How to apply:** lines.>

[[related-memory]]  <!-- Link to related memories if applicable -->
```

### How to Log a Change

1. **Create or update** `PROJECT_LOG.md` with a new entry
2. **Add a frontmatter** block with:
   - `name`: A short kebab-case slug describing the change
   - `description`: One-line summary
   - `metadata.type`: `user`, `feedback`, `project`, or `reference`
3. **Describe the change** in the body, including:
   - **Why**: The reason for the change (for project type)
   - **How to apply**: Instructions if relevant
4. **Link related memories** using `[[name]]` syntax

### Memory Linking

Link related memories with `[[name]]`, where `name` is the other memory's `name:` slug from `MEMORY.md`. This creates a network of related changes.

### Memory Index

`MEMORY.md` is the index loaded into context each session — one line per memory, no frontmatter. Update `MEMORY.md` by adding a one-line pointer (`- [Title](file.md) — hook`) after writing any new memory file.

### Log File Location

- `PROJECT_LOG.md` — the changelog for all project changes
- `MEMORY.md` — the session context index (auto-updated)
- Individual memories in `memory/` directory (one fact per file)