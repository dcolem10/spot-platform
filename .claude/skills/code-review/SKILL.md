---
name: code-review
description: "Code review, quality assurance, bug hunting, and production readiness checks. Use this skill when the user asks to review code, check for bugs, audit code quality, run tests, prepare for production, or do a pre-deploy check. Also trigger when the user says 'review this', 'is this ready to ship', 'check my code', 'find bugs', 'what did I miss', 'audit', 'QA', or asks about testing strategies. Trigger proactively before any major deployment or merge to main."
---

# Code Review & QA Skill

You are a senior engineer performing code review. Be thorough but constructive — flag real issues, skip nitpicks, and always explain why something matters.

## Review Process

When asked to review code, follow this sequence:

### 1. Security Scan (Highest Priority)

Check for these blockers — any of these found should halt deployment:

- **Exposed secrets**: API keys, tokens, passwords in source code or env vars
- **SQL/NoSQL injection**: Unsanitized user input in database queries
- **XSS vectors**: User input rendered without escaping in HTML/JSX
- **Auth bypass**: Missing authentication checks on protected routes
- **CORS misconfiguration**: Wildcard origins (`*`) in production
- **Sensitive data in logs**: PII, tokens, or passwords written to console/CloudWatch
- **Hardcoded credentials**: Stripe keys, AWS credentials, database passwords in code
- **Missing input validation**: API endpoints accepting unvalidated data

### 2. Bug Detection

Look for common runtime errors:

- **Null/undefined access**: Missing optional chaining (`?.`) on potentially null values
- **Race conditions**: Concurrent state updates without guards
- **Memory leaks**: Event listeners or intervals not cleaned up in `useEffect` return
- **Infinite loops**: `useEffect` with missing or wrong dependency arrays
- **Type mismatches**: String/number comparisons, wrong function signatures
- **Unhandled promises**: `async` functions called without `await` or `.catch()`
- **Off-by-one errors**: Array indexing, pagination, date calculations
- **State update after unmount**: Setting state in async callbacks after component unmounts

### 3. Architecture Review

Assess code structure and patterns:

- **Single Responsibility**: Does each function/component do one thing?
- **DRY violations**: Copy-pasted logic that should be abstracted
- **Prop drilling**: Data passed through 3+ component levels (should use context/store)
- **Dead code**: Unused imports, unreachable branches, commented-out code
- **Naming clarity**: Variables/functions named for what they represent, not implementation
- **Error boundaries**: Feature areas wrapped in error boundaries to prevent cascading failures
- **Loading/error states**: Every async operation handles loading, success, and error states

### 4. Performance Review

Check for performance anti-patterns:

- **Unnecessary re-renders**: Components re-rendering when their props haven't changed
- **Missing memoization**: Expensive computations recalculated on every render
- **Bundle bloat**: Large dependencies imported for small features (check with `import cost`)
- **N+1 queries**: Multiple sequential API calls that could be batched
- **Missing code splitting**: Large feature modules not lazy-loaded
- **Unoptimized images**: Large images without lazy loading or size optimization
- **Synchronous blocking**: Heavy computation on the main thread

### 5. Accessibility Check

Verify these minimum standards:

- All form inputs have `<label>` elements with `htmlFor`
- Interactive elements have `cursor: pointer`
- Color contrast meets 4.5:1 for normal text, 3:1 for large text
- Focus states visible on all interactive elements
- `aria-label` on icon-only buttons
- `alt` text on all images
- Keyboard navigation works (Tab order matches visual order)

## Review Output Format

Structure your review as:

```
## Security Issues (if any)
[BLOCKER] Description of security issue
→ Fix: What to do about it

## Bugs Found
[HIGH] Description of bug
→ Impact: What breaks if this isn't fixed
→ Fix: Recommended fix

[MEDIUM] Description of potential issue
→ Fix: Recommended fix

## Improvements
[SUGGESTION] Description of improvement
→ Why: Why this matters
→ How: How to implement it

## Summary
X blockers, Y bugs, Z suggestions
Ready to ship: Yes/No
```

## Pre-Deploy Checklist

Run this before any production deployment:

```
[ ] TypeScript compiles with no errors (npx tsc --noEmit)
[ ] Vite builds successfully (npx vite build)
[ ] No console.log statements left in production code
[ ] No TODO/FIXME comments that block shipping
[ ] Environment variables documented and set in deployment target
[ ] Error handling covers all API endpoints
[ ] CORS locked to production domain
[ ] Security headers configured
[ ] No secrets in source code (grep for api_key, secret, password, token)
[ ] Demo mode works end-to-end
[ ] All routes load without white-screen errors
```

## Testing Strategy

For this project's stage (early MVP), focus testing effort here:

**Must test** (breaks user trust if wrong):
- Authentication flow (sign up, sign in, sign out)
- Payment flow (subscription creation, webhook handling)
- Data integrity (campaigns save correctly, offers track accurately)

**Should test** (causes friction if wrong):
- Form validation (error messages show, required fields enforced)
- Navigation (all routes load, guards redirect correctly)
- Demo mode (all features work without real backend)

**Nice to test** (polish):
- Empty states render correctly
- Loading states appear and disappear
- Responsive layout at mobile breakpoints

## Common Commands

```bash
# Type check
npx tsc --noEmit

# Build check
npx vite build

# Find potential secrets in code
grep -rn "api_key\|secret\|password\|token\|AKIA" src/ backend/ --include="*.ts" --include="*.tsx" --include="*.mjs" --include="*.js"

# Find TODO/FIXME
grep -rn "TODO\|FIXME\|HACK\|XXX" src/ --include="*.ts" --include="*.tsx"

# Check bundle sizes
npx vite build && ls -lhS dist/assets/*.js
```
