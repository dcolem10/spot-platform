import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoadingSkeleton } from './components/LoadingSkeleton';
import { useAuth } from './hooks/useAuth';
import { FeatureGate } from './components/FeatureGate';
import { useAuthInit } from './hooks/useAuthInit';

// Layouts
const DashboardShell = lazy(() => import('./layouts/DashboardShell'));

// Landing
const LandingPage = lazy(() => import('./features/landing/LandingPage'));

// Partnerships & Restaurants
const RestaurantDirectory = lazy(() => import('./features/concept1-platform/RestaurantDirectory'));
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

function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';

  if (isLoading) return <AppFallback />;
  if (!isAuthenticated && !isDemoMode) return <Navigate to="/" replace />;

  return <>{children}</>;
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

              {/* Dashboard routes */}
              <Route path="/app" element={<RequireAuth><DashboardShell /></RequireAuth>}>
                {/* Dashboard */}
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<CreatorDashboard />} />

                {/* Partnerships & Restaurants */}
                <Route path="restaurants" element={<FeatureGate flag="restaurantPortal"><RestaurantDirectory /></FeatureGate>} />
                <Route path="restaurants/:id" element={<FeatureGate flag="restaurantPortal"><RestaurantDirectory /></FeatureGate>} />
                <Route path="campaigns" element={<FeatureGate flag="restaurantPortal"><CampaignManager /></FeatureGate>} />
                <Route path="offers" element={<FeatureGate flag="restaurantPortal"><OfferManager /></FeatureGate>} />
                <Route path="reports" element={<FeatureGate flag="restaurantPortal"><ROIReporter /></FeatureGate>} />
                <Route path="reports/:campaignId" element={<FeatureGate flag="restaurantPortal"><CampaignReport /></FeatureGate>} />
                <Route path="crm" element={<FeatureGate flag="restaurantPortal"><PartnershipCRM /></FeatureGate>} />

                {/* Partner Portal */}
                <Route path="partner" element={<FeatureGate flag="restaurantPortal"><PartnerPortal /></FeatureGate>} />
                <Route path="partner/campaigns" element={<FeatureGate flag="restaurantPortal"><CampaignManager /></FeatureGate>} />
                <Route path="partner/offers" element={<FeatureGate flag="restaurantPortal"><OfferManager /></FeatureGate>} />

                {/* Content */}
                <Route path="archive" element={<ContentArchive />} />
                <Route path="calendar" element={<EditorialCalendar />} />

                {/* Audience & Discovery */}
                <Route path="discover" element={<DiscoverApp />} />
                <Route path="saved" element={<FeatureGate flag="membership"><SavedList /></FeatureGate>} />
                <Route path="deals" element={<FeatureGate flag="membership"><DealsHub /></FeatureGate>} />
              </Route>

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
