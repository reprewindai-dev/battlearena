---
name: multi-package-dependency-upgrade
description: Workflow command scaffold for multi-package-dependency-upgrade in battlearena.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /multi-package-dependency-upgrade

Use this workflow when working on **multi-package-dependency-upgrade** in `battlearena`.

## Goal

Automates updating dependencies across multiple package.json and package-lock.json files in a monorepo structure, ensuring all services and subprojects use the latest compatible versions.

## Common Files

- `*/package.json`
- `*/package-lock.json`
- `*/*/package.json`
- `*/*/package-lock.json`
- `*/*/*/package.json`
- `*/*/*/package-lock.json`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Identify outdated dependencies in each package.json across all project directories.
- Update the version numbers in package.json and package-lock.json for each affected package.
- Commit all updated package.json and package-lock.json files in a single commit.

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.