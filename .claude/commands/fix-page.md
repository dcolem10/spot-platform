# /fix-page — Fix a broken or misbehaving page

Before making any changes, follow this checklist:

1. **Read the relevant CLAUDE.md files** — start with `/CLAUDE.md`, then `src/CLAUDE.md` for frontend issues or `backend/CLAUDE.md` for API issues.

2. **Identify the page component** — find the component file in `src/features/` that matches the page the user described. Read it fully.

3. **Trace the data flow:**
   - What API endpoint does the page call? (look for `api.get()` / `api.post()` calls)
   - What does the backend handler return for that endpoint? (check `backend/lambda-api/index.mjs`)
   - Is the response format what the frontend expects?

4. **Check common failure points:**
   - CORS: Is the API returning the correct `Access-Control-Allow-Origin` header?
   - Auth: Is the endpoint expecting auth but the page isn't sending a token?
   - Route mismatch: Does the frontend URL match the backend route in template.yaml?
   - Data shape: Is the frontend destructuring a response field that doesn't exist?
   - Empty state: Is the page handling `null`/`undefined`/empty arrays correctly?

5. **Fix the issue** — make the minimal change needed. Don't refactor unrelated code.

6. **Test** — verify the fix works by checking the component logic. If it's a backend fix, note that `sam deploy` is blocked — use direct Lambda update commands from `backend/CLAUDE.md`.

7. **Commit and push** — use a conventional commit message like `fix: resolve data loading on campaigns page`.

User's issue: $ARGUMENTS
