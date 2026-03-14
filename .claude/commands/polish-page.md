# /polish-page — Improve the UI/UX of an existing page

Before making changes:

1. **Read `src/CLAUDE.md`** for styling rules and component patterns.

2. **Read the target component** — find it in `src/features/` and understand its current state.

3. **Check recent polished pages for reference** — look at git history for recent UI improvements:
```bash
git log --oneline -20 | grep -i "polish\|enhance\|improve\|UI"
```
Read those commits to match the established visual style.

4. **Apply these polish patterns consistently:**

### Layout
- Wrap in `page-container` for consistent spacing
- Use display/serif font for page titles
- Add stat cards at the top if the page has metrics

### Empty States
- Replace blank/generic empty states with:
  - Descriptive heading ("No campaigns yet")
  - Helpful subtext ("Start a campaign to track your restaurant partnerships")
  - Primary action button (CTA to create the first item)
  - Optional illustration or icon

### Loading States
- Use LoadingSkeleton component, not spinner
- Match skeleton shape to the content it replaces

### Error States
- Show error banner at top with retry button
- Don't block the entire page — show whatever can render

### Animations (subtle)
- Fade-in on page load
- Hover effects on interactive cards
- Smooth transitions on tab/filter changes

### Cards & Lists
- Consistent card styling with shadow, border-radius, hover effect
- Status badges with color coding
- Proper spacing between items

5. **Commit:** `style: polish [PageName] — stat cards, empty states, display font`

Page to polish: $ARGUMENTS
