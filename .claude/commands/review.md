# /review — Review recent changes for bugs, security issues, and best practices

## Steps

1. **Check what changed:**
```bash
git diff HEAD~3 --stat
git log --oneline -5
```

2. **Read the changed files** and check for:

### Security
- [ ] No API keys, secrets, or credentials in code
- [ ] Auth checks on all mutation endpoints (getUserId + ownership verification)
- [ ] DDB keys stripped from responses (stripDdbKeys)
- [ ] Input validation on user-supplied data
- [ ] Rate limiting on public endpoints
- [ ] No SQL/NoSQL injection vectors (DynamoDB expressions use ExpressionAttributeValues)
- [ ] CORS headers present on all Lambda responses

### Frontend Quality
- [ ] Loading states (LoadingSkeleton or spinner)
- [ ] Error states (error banner with retry button)
- [ ] Empty states (helpful message + CTA)
- [ ] Using ApiService, not raw fetch()
- [ ] TypeScript types defined (no `any` types)
- [ ] CSS custom properties used (not Tailwind)
- [ ] Page wrapped in `page-container`

### Backend Quality
- [ ] Proper HTTP status codes (200, 201, 400, 401, 403, 404, 500)
- [ ] Consistent response format: `{ data }` or `{ error: "message" }`
- [ ] Error logging with context (not just `console.error(err)`)
- [ ] DynamoDB operations use proper key conditions
- [ ] No hardcoded values that should be env vars

### Cost Impact
- [ ] No unbounded DynamoDB scans (always use Query with key conditions)
- [ ] No unnecessary Anthropic API calls (AI Lambda is the biggest cost driver)
- [ ] Lambda timeouts are appropriate
- [ ] No polling or retry loops that could amplify costs

3. **Report findings** with specific file paths and line numbers.

$ARGUMENTS
