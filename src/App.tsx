import { lazy, Suspense, useState, useEffect, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CookieConsent } from './components/CookieConsent';
import { LoadingSkeleton } from './components/LoadingSkeleton';
import { useAuth } from './hooks/useAuth';
import { useAuthStore } from './store/authStore';
import { FeatureGate } from './components/FeatureGate';
import { TierGate } from './components/TierGate';
import { useAuthInit } from './hooks/useAuthInit';
import { api } from './services/ApiService';
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
const AIInsights = lazy(() => import('./features/concept3-spotops/AIInsights'));
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

/* Route to the correct onboarding based on user role/group */
function OnboardingRouter() {
  const { isPartner } = useAuth();
  if (isPartner) return <PartnerOnboarding />;
  return <CreatorOnboarding />;
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
          <CookieConsent />
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
                {/* Dashboard */}
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<CreatorDashboard />} />

                {/* Partnerships & Restaurants */}
                <Route path="restaurants" element={<FeatureGate flag="restaurantPortal"><RestaurantDirectory /></FeatureGate>} />
                <Route path="restaurants/:id" element={<FeatureGate flag="restaurantPortal"><RestaurantDetail /></FeatureGate>} />
                <Route path="campaigns" element={<FeatureGate flag="restaurantPortal"><CampaignManager /></FeatureGate>} />
                <Route path="offers" element={<FeatureGate flag="restaurantPortal"><OfferManager /></FeatureGate>} />
                {/* ROI Reporter — Pro+ */}
                <Route path="reports" element={<FeatureGate flag="restaurantPortal"><TierGate minTier="pro" featureName="ROI Reporter"><ROIReporter /></TierGate></FeatureGate>} />
                <Route path="reports/:campaignId" element={<FeatureGate flag="restaurantPortal"><CampaignReport /></FeatureGate>} />
                <Route path="crm" element={<FeatureGate flag="restaurantPortal"><PartnershipCRM /></FeatureGate>} />

                {/* Partner Portal */}
                <Route path="partner" element={<FeatureGate flag="restaurantPortal"><PartnerPortal /></FeatureGate>} />
                <Route path="partner/campaigns" element={<FeatureGate flag="restaurantPortal"><CampaignManager /></FeatureGate>} />
                <Route path="partner/offers" element={<FeatureGate flag="restaurantPortal"><OfferManager /></FeatureGate>} />
                <Route path="partner/proposals" element={<FeatureGate flag="restaurantPortal"><ProposalInbox role="restaurant" /></FeatureGate>} />

                {/* Proposal Inbox */}
                <Route path="proposals" element={<ProposalInbox role="creator" />} />

                {/* Raffles */}
                <Route path="raffles" element={<RaffleManager />} />

                {/* Content Reviews */}
                <Route path="content-reviews" element={<ContentReviewManager />} />

                {/* Social Connections */}
                <Route path="social" element={<SocialConnectionsPanel />} />

                {/* Multi-Creator Collaborations */}
                <Route path="collaborations" element={<FeatureGate flag="multiCreator"><CollaborationPanel /></FeatureGate>} />

                {/* AI — Pro+ */}
                <Route path="insights" element={<TierGate minTier="pro" featureName="AI Insights"><AIInsights /></TierGate>} />

                {/* Content */}
                <Route path="archive" element={<ContentArchive />} />
                {/* Calendar — Pro+ */}
                <Route path="calendar" element={<TierGate minTier="pro" featureName="Editorial Calendar"><EditorialCalendar /></TierGate>} />

                {/* Ambassador Program — Scale+ */}
                <Route path="ambassador" element={<FeatureGate flag="ambassador"><TierGate minTier="scale" featureName="Ambassador Program"><AmbassadorDashboard /></TierGate></FeatureGate>} />

                {/* Audience & Discovery */}
                <Route path="discover" element={<DiscoverApp />} />
                <Route path="saved" element={<FeatureGate flag="membership"><SavedList /></FeatureGate>} />
                <Route path="deals" element={<FeatureGate flag="membership"><DealsHub /></FeatureGate>} />
              </Route>

              {/* Public Raffle Entry Page */}
              <Route path="/raffle/:id" element={<RaffleEntryPage />} />

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
