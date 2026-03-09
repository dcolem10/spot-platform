---
name: react-frontend
description: "React and frontend development best practices for the Spot Platform SaaS application. Use this skill whenever the user asks about building React components, styling, CSS, state management, routing, performance optimization, or frontend architecture. Also trigger when creating new pages, features, or UI elements, when fixing frontend bugs, or when the user mentions React, Vite, Zustand, TanStack Query, React Router, or CSS custom properties. Trigger for any work involving the src/ directory of a React project."
---

# React Frontend Development Skill

You are a senior frontend engineer building a React SaaS application. The user is early-career and self-taught, so write clean, well-commented code and explain architectural decisions.

## Stack

- **Framework**: React 18 + TypeScript
- **Build**: Vite
- **Routing**: React Router v6 (lazy-loaded routes)
- **State**: Zustand (global auth/app state)
- **Data Fetching**: TanStack Query (server state)
- **Styling**: CSS Custom Properties (design tokens) + component-scoped CSS
- **Font**: Outfit (display headings) + Inter (body text)

## Project Structure

```
src/
  features/          # Feature-based organization
    auth/            # AuthPage, AuthPage.css
    landing/         # LandingPage, LandingPage.css
    onboarding/      # CreatorOnboarding
    concept1-platform/  # Dashboard, RestaurantDirectory, etc.
    legal/           # PrivacyPolicy, TermsOfService
  store/             # Zustand stores (authStore.ts)
  services/          # API service layer
  data/              # Demo data and constants
  styles/            # theme.css (design tokens), global.css
  layouts/           # Sidebar, AppLayout
  App.tsx            # Router config, guards, lazy imports
```

## Design System: Dopamine Design (2026)

This app uses a dark-first design system. All colors come from CSS custom properties defined in `src/styles/theme.css`.

**Key tokens to use** (never hardcode colors):
- Backgrounds: `--color-bgPrimary`, `--color-bgSecondary`, `--color-bgElevated`, `--color-bgSurface`
- Text: `--color-textPrimary` (#f4f4f8), `--color-textSecondary` (#9ca3b8), `--color-textMuted` (#5e6480)
- Accent: `--color-accent` (#f97316 orange), `--color-accentHover`, `--color-accentMuted`
- Borders: `--color-border` (rgba white 6%), `--color-borderHover`
- Semantic: `--color-success`, `--color-error`, `--color-warning`, `--color-info` (+ Muted variants)
- Gradients: `--gradient-accent`, `--gradient-warm`, `--gradient-hero`
- Shadows: `--shadow-sm` through `--shadow-xl`, `--shadow-glow`

**Typography**: Use `--font-display` (Outfit) for headings and hero text. Use `--font-family` (Inter) for body and UI text. Available sizes: `--font-xs` through `--font-6xl`.

**Glassmorphism pattern** (used for elevated cards):
```css
background: rgba(17, 17, 25, 0.85);
backdrop-filter: blur(20px);
border: 1px solid rgba(255, 255, 255, 0.08);
border-radius: var(--radius-lg);
```

## Component Patterns

**New feature page template**:
```typescript
// 1. Lazy-load in App.tsx
const MyFeature = lazy(() => import('./features/my-feature/MyFeature'));

// 2. Add route inside the authenticated layout
<Route path="my-feature" element={
  <FeatureGate flag="myFeatureFlag">
    <Suspense fallback={<LoadingSpinner />}>
      <MyFeature />
    </Suspense>
  </FeatureGate>
} />
```

**Demo mode branching**: The app supports a demo mode where API calls return mock data. Always check for demo mode in data-fetching logic:
```typescript
const isDemoMode = useAuthStore((s) => s.isDemoMode);

const { data } = useQuery({
  queryKey: ['my-data'],
  queryFn: () => isDemoMode ? DEMO_DATA : api.get('/api/my-data'),
});
```

**State management rules**:
- Zustand for auth state, user profile, feature flags, and app-wide UI state
- TanStack Query for all server data (campaigns, restaurants, offers, etc.)
- Local `useState` for form state and ephemeral UI state
- Never duplicate server state in Zustand

## Styling Rules

1. **Always use CSS variables** — never hardcode colors like `#f97316` or `white` in components
2. **Dark theme is default** — `--color-textPrimary` is light (#f4f4f8), backgrounds are dark
3. **Component-scoped CSS** — create a `.css` file alongside the component, import it
4. **Responsive by default** — use `max-width` containers, flexbox/grid, and media queries at 480px, 768px, 1024px breakpoints
5. **Animations** — use `--transition-fast` (150ms), `--transition-base` (200ms), `--transition-slow` (300ms). Respect `prefers-reduced-motion`
6. **Interactive elements** — always add `cursor: pointer`, hover states, and focus-visible outlines

## Performance Checklist

- [ ] Route-level code splitting with `React.lazy()` and `Suspense`
- [ ] Images lazy-loaded with `loading="lazy"`
- [ ] Heavy computations memoized with `useMemo`
- [ ] Event handlers stable with `useCallback` when passed as props
- [ ] TanStack Query with appropriate `staleTime` and `cacheTime`
- [ ] No state updates in render path (causes infinite loops)
- [ ] Bundle size checked — vendor chunk should stay under 200KB gzipped

## Accessibility Baseline

- All interactive elements keyboard-navigable
- Form inputs have associated `<label>` elements with `htmlFor`
- Color contrast: 4.5:1 minimum for normal text
- `aria-label` on icon-only buttons
- Focus rings visible on all interactive elements
- `prefers-reduced-motion` respected in all animations

## Common Patterns

**Error boundary**: Wrap feature routes in error boundaries to prevent full-app crashes.

**Loading states**: Use skeleton screens (not spinners) for content areas. Use spinners only for action confirmations (form submissions, etc.).

**Empty states**: Every list/grid should have a meaningful empty state with a call-to-action, not just "No data."

**Optimistic updates**: For mutations (creating/editing campaigns, toggling offers), update the UI immediately and roll back on error.

## Workflow: Auto-Commit

This is a production app in active development. **Always commit after completing a change** — do not wait for the user to ask. The user handles `git push` from their side, and Amplify triggers a new build automatically.

**Commit workflow**:
1. Make the code changes
2. Run `npx tsc --noEmit` to verify no type errors
3. Run `npx vite build` if the change is significant (new deps, structural changes)
4. `git add` only the relevant files (never `git add -A`)
5. Commit with a descriptive message using HEREDOC format
6. Tell the user the commit hash so they can push

**Never**: push to remote, amend previous commits, or commit `.env` files.
