import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoadingSkeleton } from './components/LoadingSkeleton';
import { useAuth } from './hooks/useAuth';

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
                <Route path="restaurants" element={<RestaurantDirectory />} />
                <Route path="restaurants/:id" element={<RestaurantDirectory />} />
                <Route path="campaigns" element={<CampaignManager />} />
                <Route path="offers" element={<OfferManager />} />
                <Route path="reports" element={<ROIReporter />} />
                <Route path="reports/:campaignId" element={<CampaignReport />} />
                <Route path="crm" element={<PartnershipCRM />} />

                {/* Partner Portal */}
                <Route path="partner" element={<PartnerPortal />} />
                <Route path="partner/campaigns" element={<CampaignManager />} />
                <Route path="partner/offers" element={<OfferManager />} />

                {/* Content */}
                <Route path="archive" element={<ContentArchive />} />
                <Route path="calendar" element={<EditorialCalendar />} />

                {/* Audience & Discovery */}
                <Route path="discover" element={<DiscoverApp />} />
                <Route path="saved" element={<SavedList />} />
                <Route path="deals" element={<DealsHub />} />
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
