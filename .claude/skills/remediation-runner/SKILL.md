---
name: remediation-runner
description: "Drives sequential remediation of the Spot Platform master checklist. When triggered, reads the checklist, finds the FIRST unchecked item, completes it, marks it done, commits, and stops. Use when the user says 'continue remediation', 'next checklist item', 'work on the checklist', or 'continue working through the remediation checklist.' Always work on exactly ONE item per invocation."
---

# Remediation Runner — Sequential Checklist Executor

## Purpose

Work through the Spot Platform master remediation checklist one item at a time. Each session: read the list, do the next item, update the list, commit, stop.

## Workflow (follow exactly)

### Step 1: Read the checklist
Read `references/master-checklist.md` (relative to this skill) to find the current state.

### Step 2: Find the next open item
Scan for the first line matching `- [ ]`. That is your ONLY task for this session. Do not skip ahead. Do not batch multiple items.

### Step 3: Understand the item
Each checklist item includes:
- **Source** — which business document flagged this
- **Problem** — what's wrong
- **Scope** — what needs to change (backend, frontend, infrastructure, or decision)
- **Key files** — where to start
- **Acceptance** — how to know it's done
- **Dependencies** — items that must be done first (if any)

If the item has an unmet dependency (references another item that's still `[ ]`), note this and skip to the next unchecked item.

### Step 4: Consult relevant skills
Before writing code, read skills that apply:
- **Always read:** `.claude/skills/business-context/SKILL.md` (ensures alignment with business vision)
- **Always read:** `.claude/skills/sre/SKILL.md` (ensures no security/cost regressions)
- **If frontend work:** `.claude/skills/react-frontend/SKILL.md`
- **If backend work:** `.claude/skills/api-backend/SKILL.md`
- **If infrastructure:** `.claude/skills/aws-infra/SKILL.md`

### Step 5: Do the work
- Make the code changes needed
- Run `npm run build` (frontend) or `sam build` (backend) to verify no build errors
- Run tests if applicable
- If the item is a "decision required" item (like item #2 — pricing contradiction), do NOT guess. Note the decision needed and mark the item with `[?]` instead of `[x]`. Add a note in the Change Log.

### Step 6: Update the checklist
Edit `references/master-checklist.md`:
1. Change `- [ ]` to `- [x]` for the completed item
2. Add a row to the **Change Log** table at the bottom with: date, item number, "Done" or "Needs decision", and a brief note

### Step 7: Commit
Stage the changed files (code + checklist) and commit with message format:
```
fix(remediation-#{N}): {short description}

Checklist item #{N}: {item title}
Source: {document name}

Co-Authored-By: Claude <noreply@anthropic.com>
```

### Step 8: Report
Tell the user:
- What item was completed
- What changed
- What the NEXT item is (so they know what's coming)
- If any item was skipped due to dependency, explain why

## Rules

1. **ONE item per session.** Never work on two items in one session.
2. **Never skip items** unless they have an unmet dependency.
3. **Items marked `[?]` need founder input** before they can become `[x]`.
4. **Always commit after completing an item.** The checklist file is the source of truth.
5. **If stuck**, mark the item `[?]`, log why in the Change Log, and move on.
6. **Cost awareness**: Every change must stay within the $50/mo AWS budget. If a change could increase costs, note it.
7. **Security first**: Never expose secrets, never weaken CORS, never skip auth checks.
