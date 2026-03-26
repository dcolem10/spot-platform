# Frontend — Claude Context Guide

## Stack

- React 18.3.1 + TypeScript (strict mode)
- Vite 6 (dev server, build tool)
- React Router DOM 6 (routing)
- Zustand 5 (auth state)
- TanStack React Query 5 (server state, caching)
- AWS Amplify 6 (Cognito auth)
- Chart.js 4 + react-chartjs-2 (analytics charts)
- CSS custom properties (no Tailwind — custom design system)

## Directory Layout

```
src/
├── App.tsx                    # Route definitions + auth guards
├── main.tsx                   # Amplify bootstrap + React mount
├── types/index.ts             # ALL TypeScript interfaces (450+ lines)
├── services/ApiService.ts     # HTTP client — ALWAYS use this for API calls
├── store/authStore.ts         # Zustand: userId, role, groups, isDemoMode
├── hooks/
│   ├── useAuth.ts             # Derived: isCreator, isPartner, isAdmin
│   └── useAuthInit.ts         # Bootstraps auth on app load
├── lib/
│   ├── amplifyConfig.ts       # Cognito config from env vars
│   ├── featureFlags.ts        # Feature flag resolver
│   └── queryClient.ts         # React Query defaults
├── layouts/
│   └── DashboardShell.tsx     # Sidebar + header layout wrapper
├── components/                # Shared: ErrorBoundary, LoadingSkeleton, FeatureGate, etc.
├── features/
│   ├── concept1-platform/     # Creator-Restaurant partnership features
│   ├── concept2-insider/      # Consumer discovery & membership
│   ├── concept3-spotops/      # Creator tools (dashboard, calendar, archive, insights)
│   ├── landing/               # Public landing page
│   ├── auth/                  # Login/signup (Cognito)
│   ├── onboarding/            # Creator + Partner onboarding flows
│   ├── raffles/               # Raffle creation & entry
│   └── legal/                 # Privacy policy, terms
└── styles/
    ├── global.css             # Design system variables + base styles
    └── print.css              # Print stylesheet
```

## API Client

ALWAYS use `ApiService.ts` for backend calls. Never use raw `fetch()`.

```typescript
import { api } from '@/services/ApiService';

// Returns: { data, error, status, statusCode }
const result = await api.get('/restaurants');
const result = await api.post('/campaigns', { body: campaignData });
const result = await api.put(`/campaigns/${id}`, { body: updates });
const result = await api.delete(`/campaigns/${id}`);
```

Features:
- Auto-attaches Cognito JWT from Amplify session
- 8-second timeout
- Auto-retries once on 401 (token refresh)
- Returns structured response with status: 'success' | 'error' | 'timeout' | 'offline'

## Auth & State

### Zustand Store (authStore.ts)
```typescript
{
  userId: string | null,
  email: string | null,
  displayName: string | null,
  role: 'creator' | 'partner' | 'audience' | null,
  groups: string[],
  isDemoMode: boolean,
  onboardingComplete: boolean,
}
```

### useAuth Hook
Provides derived booleans: `isCreator`, `isPartner`, `isAdmin`, `isAuthenticated`

### Route Protection
`App.tsx` wraps `/app/*` routes with auth check — redirects to `/auth` if not authenticated.

## Styling Rules

The app uses CSS custom properties, NOT Tailwind. Follow these conventions:

### CSS Variables (defined in theme.css)
```css
--color-bgPrimary, --color-bgSecondary, --color-bgElevated
--color-textPrimary, --color-textSecondary, --color-textMuted
--color-accent, --color-accentHover
--color-border, --radius-md
--shadow-sm, --shadow-md, --shadow-lg
```

### Component Styling Pattern
- Each component has its own CSS file or uses inline styles with CSS variables
- Use `.page-container` wrapper for consistent page spacing
- Stat cards use the generic `.card` class with inline styling
- Dark theme throughout — respect dark backgrounds

### Typography
- Display headings use a serif/display font
- Body text uses system sans-serif
- Keep font sizes consistent: use existing CSS variables

## Component Patterns

### Page Components
Every page should follow this structure:
```tsx
export default function MyPage() {
  const { userId } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ['my-data'],
    queryFn: () => api.get('/my-endpoint'),
  });

  if (isLoading) return <LoadingSkeleton />;
  if (error) return <div className="error-banner">Failed to load</div>;

  return (
    <div className="page-container">
      <h1 className="page-title">Page Title</h1>
      {/* content */}
    </div>
  );
}
```

### Empty States
Always show a helpful empty state with a CTA, not just blank space:
```tsx
{items.length === 0 && (
  <div className="empty-state">
    <h3>No items yet</h3>
    <p>Get started by creating your first item</p>
    <button onClick={handleCreate}>Create Item</button>
  </div>
)}
```

### Error Handling
Use ErrorBoundary for component-level errors. Show retry buttons on API failures.

### Feature Gates
Wrap experimental features with FeatureGate:
```tsx
<FeatureGate flag="VITE_ENABLE_MULTI_CREATOR">
  <CollaborationPanel />
</FeatureGate>
```

## Routing

All app routes are nested under `/app`:

| Route | Component | Feature Area |
|-------|-----------|-------------|
| /app/dashboard | CreatorDashboard | SpotOps |
| /app/restaurants | RestaurantDirectory | Platform |
| /app/restaurants/:id | RestaurantDetail | Platform |
| /app/campaigns | CampaignManager | Platform |
| /app/crm | PartnershipCRM | SpotOps |
| /app/proposals | ProposalInbox | Platform |
| /app/offers | OfferManager | Platform |
| /app/raffles | RaffleManager | Raffles |
| /app/content-reviews | ContentReviewManager | Platform |
| /app/calendar | EditorialCalendar | SpotOps |
| /app/archive | ContentArchive | SpotOps |
| /app/insights | AIInsights | SpotOps |
| /app/reports | ROIReporter | SpotOps |
| /app/discover | DiscoverApp | Insider |
| /app/deals | DealsHub | Insider |
| /app/partner | PartnerPortal | Platform |

## Build & Deploy

```bash
npm run dev        # Local dev server (localhost:5173)
npm run build      # TypeScript check + Vite production build
npm run lint       # ESLint
```

Frontend deploys automatically when code is pushed to `main` branch (Amplify CI/CD).

## Common Mistakes to Avoid

1. Don't use `fetch()` directly — use `api.get()` / `api.post()` from ApiService
2. Don't hardcode API URLs — use `VITE_API_BASE_URL` env var
3. Don't forget the `page-container` wrapper on new pages
4. Don't create new state management — use Zustand for auth, React Query for server data
5. Don't add Tailwind classes — the project uses CSS custom properties
6. Don't skip loading/error/empty states — every page needs all three
7. Don't import from relative paths when `@/` alias is available
