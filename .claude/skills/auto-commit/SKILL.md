---
name: auto-commit
description: "Always commit changes after completing work. This skill MUST trigger whenever Claude finishes any task that modifies files in the repository — code changes, config edits, new files, dependency updates, or any other file modifications. Trigger after every completed task, build, deploy, fix, refactor, or feature implementation. Also trigger when Claude is about to end a response and has uncommitted changes in the working tree. This is a workflow rule, not optional."
---

# Auto-Commit: Always Commit After Completing Work

## Why This Matters

The user (Darren) expects that every completed task results in a git commit. Uncommitted work is invisible work — if the session ends or context resets, uncommitted changes could be lost or require the user to manually sort out what happened. Committing after every task creates a clear trail of progress and makes it easy to review, revert, or continue later.

## The Rule

After completing any task that modifies files in the repository, **always commit before responding to the user**. This is not a suggestion — it's a core workflow expectation.

## What Counts as "Completing Work"

Any of these signal that it's time to commit:

- You've finished applying a set of code changes (backend, frontend, infra, config)
- You've finished a build + deploy cycle
- You've completed a bug fix, feature, refactor, or polish pass
- You've run through a todo list and all items are done
- You're about to tell the user "all done" or summarize what you did

## How to Commit

1. **Check for changes**: Run `git status -s` and `git diff --stat` to see what's modified
2. **Stage relevant files**: Use specific file paths (not `git add -A`) to avoid accidentally staging secrets or build artifacts
3. **Write a good commit message**: Follow the project's existing style — a short summary line, then a body listing what changed and why. End with the co-author line.
4. **Verify**: Run `git status` after committing to confirm it succeeded

## Commit Message Format

Follow the project's established convention:

```
<type>: <short summary>

<body listing key changes>

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

Types: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`

The body should be organized by area (Backend, Frontend, Infra) when changes span multiple areas.

## What NOT to Commit

- `.env` files, credentials, or secrets
- `node_modules/` or other dependency directories (should be in .gitignore)
- Build output (`dist/`) unless explicitly asked
- Files the user didn't ask you to change

## Edge Cases

- **Multiple tasks in one session**: Commit after each logical unit of work, not just at the very end. If the user asks for 3 things, commit after completing all 3 (or after each one if they're independent).
- **Failed builds**: Don't commit broken code. Fix the build first, then commit.
- **Partial work**: If you can't finish everything, commit what's working and note what's left in the commit message.
- **User says "don't commit"**: Respect it, but this is the rare exception.
