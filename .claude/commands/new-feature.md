# /new-feature — Plan and implement a new feature

Before writing any code, follow this process:

## 1. Understand Context
- Read `/CLAUDE.md` for business context and architecture overview
- Read `src/CLAUDE.md` for frontend patterns
- Read `backend/CLAUDE.md` for API patterns and DynamoDB schema
- Read the relevant `.claude/skills/` files if they exist for this domain

## 2. Plan the Feature
Break down what needs to happen across all layers:

**Backend (if needed):**
- New API endpoint(s)? → Add route handling in `backend/lambda-api/index.mjs`
- New DynamoDB access pattern? → Follow single-table design (PK/SK patterns in backend/CLAUDE.md)
- New env vars or secrets? → Document what needs to be added
- Auth required? → Add ownership verification

**Frontend:**
- New page component? → Create in appropriate `src/features/` subdirectory
- New route? → Add to `src/App.tsx`
- New sidebar link? → Add to `src/layouts/DashboardShell.tsx`
- API calls? → Use `api.get()` / `api.post()` from ApiService
- State? → React Query for server data, Zustand only if auth-related

## 3. Implement
- Follow existing code patterns — look at similar features for reference
- Include loading states (LoadingSkeleton), error states (error banner + retry), and empty states (helpful CTA)
- Use CSS custom properties for styling — NOT Tailwind
- Add TypeScript types to `src/types/index.ts`
- Strip DDB keys from backend responses using `stripDdbKeys()`

## 4. Test
- Verify the page renders with no data (empty state)
- Verify the page handles API errors gracefully
- Check that auth is enforced on mutations
- If backend changes, deploy using `/deploy-backend`

## 5. Commit and Push
```bash
git add -A && git commit -m "feat: description of new feature"
git push origin main
```

Feature request: $ARGUMENTS
