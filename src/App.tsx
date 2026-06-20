import { lazy, Suspense, useState, useEffect, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoadingSkeleton } from './components/LoadingSkeleton';
import { useAuth } from './hooks/useAuth';
import { useAuthStore } from './store/authStore';
import { FeatureGate } from './components/FeatureGate';
import { useAuthInit } from './hooks/useAuthInit';
import { api } from './services/ApiService';
import { homeFor } from './lib/roleRoutes';
import type { UserRole } from './types';
import './styles/print.css';

// Layouts
const DashboardShell = lazy(() => import('./layouts/DashboardShell'));

// Landing
const LandingPage = lazy(() => import('./features/landing/LandingPage'));

// Auth
const AuthPage = lazy(() => import('./features/auth/AuthPage'));

// Legal
const PrivacyPolicy = lazy(() => import('./features/legal/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./features/legal/TermsOfService'));

// Onboarding
const CreatorOnboarding = lazy(() => import('./features/onboarding/CreatorOnboarding'));
const PartnerOnboarding = lazy(() => import('./features/onboarding/PartnerOnboarding'));

// Partnerships & Restaurants
const RestaurantDirectory = lazy(() => import('./features/concept1-platform/RestaurantDirectory'));
const RestaurantDetail = lazy(() => import('./features/concept1-platform/RestaurantDetail'));
const CampaignManager = lazy(() => import('./features/concept1-platform/CampaignManager'));
const PartnerPortal = lazy(() => import('./features/concept1-platform/PartnerPortal'));
const PartnerBilling = lazy(() => import('./features/concept1-platform/PartnerBilling'));
const OfferManager = lazy(() => import('./features/concept1-platform/OfferManager'));
const CampaignReport = lazy(() => import('./features/concept1-platform/CampaignReport'));

// Audience & Discovery
const DiscoverApp = lazy(() => import('./features/concept2-insider/DiscoverApp'));
const SavedList = lazy(() => import('./features/concept2-insider/SavedList'));
const DealsHub = lazy(() => import('./features/concept2-insider/DealsHub'));

// Creator Tools
const CreatorDashboard = lazy(() => import('./features/concept3-spotops/CreatorDashboard'));
const PartnershipCRM = lazy(() => import('./features/concept3-spotops/PartnershipCRM'));
const ContentArchive = lazy(() => import('./features/concept3-spotops/ContentArchive'));
const EditorialCalendar = lazy(() => import('./features/concept3-spotops/EditorialCalendar'));
const ROIReporter = lazy(() => import('./features/concept3-spotops/ROIReporter'));
const SharedReport = lazy(() => import('./features/concept3-spotops/SharedReport'));
const AIInsights = lazy(() => import('./features/concept3-spotops/AIInsights'));
const Earnings = lazy(() => import('./features/concept3-spotops/Earnings'));
const AmbassadorDashboard = lazy(() => import('./features/concept3-spotops/AmbassadorDashboard'));

// Multi-Creator Collaboration
const CollaborationPanel = lazy(() => import('./features/concept1-platform/CollaborationPanel'));

// Proposal Inbox (Handshake Model)
const ProposalInbox = lazy(() => import('./components/ProposalInbox'));

// Raffles
const RaffleManager = lazy(() => import('./features/raffles/RaffleManager'));
const RaffleEntryPage = lazy(() => import('./features/raffles/RaffleEntryPage'));

// Content Reviews
const ContentReviewManager = lazy(() => import('./features/concept1-platform/ContentReviewManager'));

// Social Connections
const SocialConnectionsPanel = lazy(() => import('./features/concept1-platform/SocialConnectionsPanel'));
const SocialOAuthCallback = lazy(() => import('./features/concept1-platform/SocialOAuthCallback'));

function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const storeIsDemoMode = useAuthStore((s) => s.isDemoMode);

  if (isLoading) return <AppFallback />;
  if (!isAuthenticated && !storeIsDemoMode) return <Navigate to="/auth" replace />;

  return <>{children}</>;
}

function OnboardingGuard({ children }: { children: ReactNode }) {
  const [checking, setChecking] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const storeIsDemoMode = useAuthStore((s) => s.isDemoMode);
  const demoOnboarded = useAuthStore((s) => s.demoOnboarded);

  useEffect(() => {
    // Reset state at start of each evaluation to prevent stale redirects
    setNeedsOnboarding(false);
    setChecking(true);

    if (storeIsDemoMode) {
      if (!demoOnboarded) {
        setNeedsOnboarding(true);
      }
      setChecking(false);
      return;
    }

    api.get('/api/profile').then(res => {
      if (res.status === 'error' && res.statusCode === 404) {
        setNeedsOnboarding(true);
      }
      setChecking(false);
    });
  }, [storeIsDemoMode, demoOnboarded]);

  if (checking) return <AppFallback />;
  if (needsOnboarding) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

/**
 * Role-based route guard. Renders children only if the user's effective role
 * (which follows the admin/demo perspective lens) is allowed. Otherwise
 * redirects to that role's home route. Admins are never hard-blocked because
 * their effectiveRole tracks whatever perspective they've switched into.
 */
function RequireRole({ roles, children }: { roles: UserRole[]; children: ReactNode }) {
  const { effectiveRole } = useAuth();

  // Role not resolved yet (still loading) — don't redirect, avoid flicker/loops.
  if (!effectiveRole) return <>{children}</>;
  if (roles.includes(effectiveRole)) return <>{children}</>;
  return <Navigate to={homeFor(effectiveRole)} replace />;
}

/* Route to the correct onboarding based on user role/group */
function OnboardingRouter() {
  const { isPartner } = useAuth();
  if (isPartner) return <PartnerOnboarding />;
  return <CreatorOnboarding />;
}

/* Send /app to the right home for the current role/perspective. */
function AppIndexRedirect() {
  const { effectiveRole } = useAuth();
  return <Navigate to={homeFor(effectiveRole)} replace />;
}

function AppFallback() {
  return (
    <div style={{ padding: 40 }}>
      <LoadingSkeleton height="40px" width="300px" />
      <div style={{ marginTop: 20 }}>
        <LoadingSkeleton height="200px" count={2} />
      </div>
    </div>
  );
}

export default function App() {
  useAuthInit();

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Suspense fallback={<AppFallback />}>
            <Routes>
              {/* Public landing */}
              <Route path="/" element={<LandingPage />} />

              {/* Auth */}
              <Route path="/auth" element={<AuthPage />} />

              {/* Onboarding — renders PartnerOnboarding or CreatorOnboarding based on role */}
              <Route path="/onboarding" element={<RequireAuth><OnboardingRouter /></RequireAuth>} />

              {/* Dashboard routes */}
              <Route path="/app" element={<RequireAuth><OnboardingGuard><DashboardShell /></OnboardingGuard></RequireAuth>}>
                {/* Dashboard — index redirects to the role/perspective home */}
                <Route index element={<AppIndexRedirect />} />
                <Route path="dashboard" element={<RequireRole roles={['creator']}><CreatorDashboard /></RequireRole>} />

                {/* Restaurants — cross-role browse (creators adopt, audience discovers) */}
                <Route path="restaurants" element={<FeatureGate flag="restaurantPortal"><RestaurantDirectory /></FeatureGate>} />
                <Route path="restaurants/:id" element={<FeatureGate flag="restaurantPortal"><RestaurantDetail /></FeatureGate>} />

                {/* Creator-only tools */}
                <Route path="campaigns" element={<FeatureGate flag="restaurantPortal"><RequireRole roles={['creator']}><CampaignManager /></RequireRole></FeatureGate>} />
                <Route path="offers" element={<FeatureGate flag="restaurantPortal"><RequireRole roles={['creator']}><OfferManager /></RequireRole></FeatureGate>} />
                <Route path="reports" element={<FeatureGate flag="restaurantPortal"><RequireRole roles={['creator']}><ROIReporter /></RequireRole></FeatureGate>} />
                <Route path="reports/:campaignId" element={<FeatureGate flag="restaurantPortal"><RequireRole roles={['creator']}><CampaignReport /></RequireRole></FeatureGate>} />
                <Route path="crm" element={<FeatureGate flag="restaurantPortal"><RequireRole roles={['creator']}><PartnershipCRM /></RequireRole></FeatureGate>} />

                {/* Partner Portal — partner-only */}
                <Route path="partner" element={<FeatureGate flag="restaurantPortal"><RequireRole roles={['partner']}><PartnerPortal /></RequireRole></FeatureGate>} />
                <Route path="partner/campaigns" element={<FeatureGate flag="restaurantPortal"><RequireRole roles={['partner']}><CampaignManager /></RequireRole></FeatureGate>} />
                <Route path="partner/offers" element={<FeatureGate flag="restaurantPortal"><RequireRole roles={['partner']}><OfferManager /></RequireRole></FeatureGate>} />
                <Route path="partner/proposals" element={<FeatureGate flag="restaurantPortal"><RequireRole roles={['partner']}><ProposalInbox role="restaurant" /></RequireRole></FeatureGate>} />
                <Route path="partner/billing" element={<FeatureGate flag="restaurantPortal"><RequireRole roles={['partner']}><PartnerBilling /></RequireRole></FeatureGate>} />

                {/* Proposal Inbox — creator-only */}
                <Route path="proposals" element={<RequireRole roles={['creator']}><ProposalInbox role="creator" /></RequireRole>} />

                {/* Raffles — creator-only */}
                <Route path="raffles" element={<RequireRole roles={['creator']}><RaffleManager /></RequireRole>} />

                {/* Content Reviews — creator-only */}
                <Route path="content-reviews" element={<RequireRole roles={['creator']}><ContentReviewManager /></RequireRole>} />

                {/* Social Connections — creator-only */}
                <Route path="social" element={<RequireRole roles={['creator']}><SocialConnectionsPanel /></RequireRole>} />
                <Route path="social/callback/:platform" element={<RequireRole roles={['creator']}><SocialOAuthCallback /></RequireRole>} />

                {/* Multi-Creator Collaborations — creator-only */}
                <Route path="collaborations" element={<FeatureGate flag="multiCreator"><RequireRole roles={['creator']}><CollaborationPanel /></RequireRole></FeatureGate>} />

                {/* AI — creator-only */}
                <Route path="insights" element={<RequireRole roles={['creator']}><AIInsights /></RequireRole>} />

                {/* Earnings & Payouts — creator-only */}
                <Route path="earnings" element={<RequireRole roles={['creator']}><Earnings /></RequireRole>} />

                {/* Content — creator-only */}
                <Route path="archive" element={<RequireRole roles={['creator']}><ContentArchive /></RequireRole>} />
                <Route path="calendar" element={<RequireRole roles={['creator']}><EditorialCalendar /></RequireRole>} />

                {/* Ambassador Program — creator-only */}
                <Route path="ambassador" element={<FeatureGate flag="ambassador"><RequireRole roles={['creator']}><AmbassadorDashboard /></RequireRole></FeatureGate>} />

                {/* Audience & Discovery — cross-role */}
                <Route path="discover" element={<DiscoverApp />} />
                <Route path="saved" element={<FeatureGate flag="membership"><SavedList /></FeatureGate>} />
                <Route path="deals" element={<FeatureGate flag="membership"><DealsHub /></FeatureGate>} />
              </Route>

              {/* Public Raffle Entry Page */}
              <Route path="/raffle/:id" element={<RaffleEntryPage />} />

              {/* Public Shared Report — no auth required, for restaurant partners */}
              <Route path="/shared-report/:token" element={<SharedReport />} />

              {/* Legal */}
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<TermsOfService />} />

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
