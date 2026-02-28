import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoadingSkeleton } from './components/LoadingSkeleton';

// Layouts
const DashboardShell = lazy(() => import('./layouts/DashboardShell'));

// Landing
const LandingPage = lazy(() => import('./features/landing/LandingPage'));

// Concept 1: Platform
const RestaurantDirectory = lazy(() => import('./features/concept1-platform/RestaurantDirectory'));
const CampaignManager = lazy(() => import('./features/concept1-platform/CampaignManager'));
const PartnerPortal = lazy(() => import('./features/concept1-platform/PartnerPortal'));
const OfferManager = lazy(() => import('./features/concept1-platform/OfferManager'));
const CampaignReport = lazy(() => import('./features/concept1-platform/CampaignReport'));

// Concept 2: Insider
const DiscoverApp = lazy(() => import('./features/concept2-insider/DiscoverApp'));
const SavedList = lazy(() => import('./features/concept2-insider/SavedList'));
const DealsHub = lazy(() => import('./features/concept2-insider/DealsHub'));

// Concept 3: SpotOps
const CreatorDashboard = lazy(() => import('./features/concept3-spotops/CreatorDashboard'));
const PartnershipCRM = lazy(() => import('./features/concept3-spotops/PartnershipCRM'));
const ContentArchive = lazy(() => import('./features/concept3-spotops/ContentArchive'));
const EditorialCalendar = lazy(() => import('./features/concept3-spotops/EditorialCalendar'));
const ROIReporter = lazy(() => import('./features/concept3-spotops/ROIReporter'));

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
              <Route path="/app" element={<DashboardShell />}>
                {/* Concept 3: SpotOps — Creator Dashboard (default) */}
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<CreatorDashboard />} />

                {/* Concept 1: Platform — Restaurant Discovery + Partnerships */}
                <Route path="restaurants" element={<RestaurantDirectory />} />
                <Route path="restaurants/:id" element={<RestaurantDirectory />} />
                <Route path="campaigns" element={<CampaignManager />} />
                <Route path="offers" element={<OfferManager />} />
                <Route path="reports" element={<ROIReporter />} />
                <Route path="reports/:campaignId" element={<CampaignReport />} />

                {/* Concept 1: Partner Portal */}
                <Route path="partner" element={<PartnerPortal />} />
                <Route path="partner/campaigns" element={<CampaignManager />} />
                <Route path="partner/offers" element={<OfferManager />} />

                {/* Concept 2: Insider — Audience Discovery */}
                <Route path="discover" element={<DiscoverApp />} />
                <Route path="saved" element={<SavedList />} />
                <Route path="deals" element={<DealsHub />} />

                {/* Concept 3: SpotOps — Creator Tools */}
                <Route path="crm" element={<PartnershipCRM />} />
                <Route path="archive" element={<ContentArchive />} />
                <Route path="calendar" element={<EditorialCalendar />} />
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
