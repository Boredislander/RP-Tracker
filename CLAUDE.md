# CLAUDE.md — RP-Tracker

This file provides guidance for AI assistants (Claude Code and others) working in this repository. Read it fully before making changes.

---

## Project Overview

**RP-Tracker** is a tracking application. This repository is currently in its initial state — no source files exist yet. This document establishes conventions and workflows that must be followed as the project is built out.

---

## Repository Status

- **Current state:** Empty repository (no source files committed yet)
- **Primary branch:** `main` (or `master`)
- **Feature branches:** Use the `claude/<description>-<id>` naming pattern for AI-driven changes

---

## Development Workflow

### Branching

- All feature work goes on dedicated branches, never directly on `main`
- Branch naming: `feature/<short-description>`, `fix/<short-description>`, `claude/<description>-<id>`
- Open a pull request for all changes; do not push directly to `main`

### Commits

- Write clear, imperative commit messages: `Add user authentication`, `Fix tracker date parsing`
- One logical change per commit — avoid bundling unrelated changes
- Reference issue numbers where applicable: `Fix #42: correct date offset`

### Pull Requests

- Include a summary of what changed and why
- All CI checks must pass before merging
- At least one review approval required (when team size permits)

---

## Code Conventions

> These conventions will expand as the technology stack is finalized. Update this section when a stack is chosen.

### General

- Prefer explicit over clever — readable code beats terse code
- Delete dead code rather than commenting it out
- Keep functions small and focused on a single responsibility
- Avoid over-engineering: build only what is needed now

### Naming

- Files and directories: `kebab-case` (e.g., `tracker-list.tsx`, `api-client.ts`)
- Variables and functions: `camelCase`
- Types, interfaces, and classes: `PascalCase`
- Constants: `SCREAMING_SNAKE_CASE`

### Comments

- Add comments only where the logic is non-obvious
- Do not add docstrings, type annotations, or comments to code you did not change
- Never leave `TODO` comments in committed code — open an issue instead

---

## Testing

- Write tests for all new functionality before marking a task complete
- Run the full test suite before pushing:
  ```
  npm test        # or: yarn test / pytest / go test ./...
  ```
- Tests live alongside source files or in a dedicated `__tests__` / `tests` directory (decide and record here once the stack is chosen)

---

## Environment & Configuration

- Never commit secrets, API keys, or credentials
- Use a `.env` file for local secrets (it must be listed in `.gitignore`)
- Provide a `.env.example` with all required variable names and placeholder values
- Read environment variables from a single, centralized config module — not ad hoc throughout the codebase

---

## Security

- Validate all external input at system boundaries (user input, API responses, file uploads)
- Do not introduce SQL injection, XSS, command injection, or other OWASP Top 10 vulnerabilities
- Use parameterized queries for all database access
- Keep dependencies up to date; audit regularly with `npm audit` or equivalent

---

## AI Assistant Guidelines

When Claude Code or another AI assistant works in this repository:

1. **Read before editing** — always read a file fully before modifying it
2. **Minimal changes** — only change what is directly required by the task; do not refactor surrounding code
3. **No unnecessary files** — do not create files unless the task explicitly requires them
4. **No backwards-compatibility shims** — delete unused code rather than wrapping it
5. **Ask when uncertain** — if requirements are ambiguous, ask before implementing
6. **Update this file** — when new stack decisions, conventions, or workflows are established, update the relevant section of this `CLAUDE.md`

---

## Stack Decisions Log

Record finalized technology choices here as they are made.

| Concern | Decision | Date |
|---------|----------|------|
| _(none yet)_ | | |

---

## Useful Commands

> Populate this section once the project structure is established.

```bash
# Install dependencies
# npm install

# Start development server
# npm run dev

# Run tests
# npm test

# Lint and format
# npm run lint
```

---

*Last updated: 2026-03-10 — initial scaffold (empty repository)*
