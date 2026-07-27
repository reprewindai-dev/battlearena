```markdown
# battlearena Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill covers the core development patterns and workflows used in the `battlearena` repository, a TypeScript monorepo built with Next.js. It documents coding conventions, commit practices, dependency upgrade automation, and testing patterns to help contributors maintain consistency and efficiency.

## Coding Conventions

### File Naming
- Use **kebab-case** for all file and directory names.
  - Example:  
    ```
    battle-engine.ts
    player-profile.test.ts
    ```

### Imports
- Use **relative imports** for referencing modules within the project.
  - Example:
    ```typescript
    import { getPlayerStats } from '../utils/player-utils';
    ```

### Exports
- Use **named exports** for all modules.
  - Example:
    ```typescript
    // In battle-engine.ts
    export function startBattle() { ... }
    export function endBattle() { ... }
    ```

### Commit Messages
- Follow **Conventional Commits** style.
- Common prefix: `chore`
- Example:
  ```
  chore: update battle logic to support new player stats
  ```

## Workflows

### Multi-Package Dependency Upgrade
**Trigger:** When you need to update dependencies across all packages and services in the monorepo (e.g., after a Dependabot alert or to keep all subprojects up-to-date).

**Command:** `/upgrade-all-dependencies`

**Step-by-Step Instructions:**
1. **Identify outdated dependencies**  
   Check each `package.json` in all directories (including nested ones) for outdated packages.
2. **Update dependencies**  
   Update the version numbers for outdated dependencies in both `package.json` and `package-lock.json` files for every affected package.
3. **Commit changes**  
   Commit all updated `package.json` and `package-lock.json` files together in a single commit.  
   Example commit message:
   ```
   chore: upgrade dependencies across all packages
   ```

**Files Involved:**
- `*/package.json`
- `*/package-lock.json`
- `*/*/package.json`
- `*/*/package-lock.json`
- `*/*/*/package.json`
- `*/*/*/package-lock.json`

**Frequency:** 2-4 times per month

**Example Command:**
```
/upgrade-all-dependencies
```

## Testing Patterns

- **Test File Naming:**  
  Test files use the pattern `*.test.*` (e.g., `battle-engine.test.ts`).
- **Framework:**  
  The specific testing framework is not detected, but tests are colocated with source files or in parallel directories.
- **Example Test File:**
  ```typescript
  // battle-engine.test.ts
  import { startBattle } from './battle-engine';

  describe('startBattle', () => {
    it('should initialize battle state', () => {
      // test implementation
    });
  });
  ```

## Commands

| Command                  | Purpose                                                        |
|--------------------------|----------------------------------------------------------------|
| /upgrade-all-dependencies| Upgrade dependencies across all packages in the monorepo       |
```
