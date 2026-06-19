import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';
import type { TooltipItem } from 'chart.js';
import type { CreatorEarnings, ConnectStatus, PayoutResult } from '../../types';
import { api } from '../../services/ApiService';
import { isDemoMode } from '../../data/demoData';
import { EmptyState } from '../../components/EmptyState';
import './Earnings.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const usd = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);

/** Pretty "2026-06" → "Jun 2026". */
function periodLabel(period: string): string {
  const [y, m] = period.split('-').map(Number);
  if (!y || !m) return period;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

// ─── Demo data — keeps the page rich when VITE_DEMO_MODE bypasses the API ──────
const DEMO_EARNINGS: CreatorEarnings = {
  periods: [
    { period: '2026-06', grossAttributed: 4180.0, earned: 300.96, paid: 0, pending: 300.96, status: 'accruing' },
    { period: '2026-05', grossAttributed: 5230.5, earned: 376.6, paid: 376.6, pending: 0, status: 'paid' },
    { period: '2026-04', grossAttributed: 3110.0, earned: 223.92, paid: 223.92, pending: 0, status: 'paid' },
  ],
  totals: { earned: 901.48, pending: 300.96 },
  payouts: { connected: true, onboardingStatus: 'complete', payoutsEnabled: true },
};

export default function Earnings() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const demo = isDemoMode();

  // Banner shown after returning from Stripe's hosted onboarding.
  const connectResult = searchParams.get('connect'); // 'done' | 'refresh' | null
  const [banner, setBanner] = useState<string | null>(null);

  const earningsQuery = useQuery<CreatorEarnings>({
    queryKey: ['creator-earnings'],
    queryFn: async () => {
      if (demo) return DEMO_EARNINGS;
      const res = await api.get<CreatorEarnings>('/api/earnings');
      if (res.error) throw new Error(res.error);
      return res.data ?? { periods: [], totals: { earned: 0, pending: 0 }, payouts: { connected: false, onboardingStatus: 'not_started', payoutsEnabled: false } };
    },
  });

  // Dedicated status query — refreshes payout readiness from Stripe (catches a
  // missed webhook), and is refetched when we return from onboarding.
  const connectQuery = useQuery<ConnectStatus>({
    queryKey: ['connect-status'],
    queryFn: async () => {
      if (demo) return { connected: true, onboardingStatus: 'complete', payoutsEnabled: true, detailsSubmitted: true };
      const res = await api.get<ConnectStatus>('/api/stripe/connect/status');
      if (res.error) throw new Error(res.error);
      return res.data ?? { connected: false, onboardingStatus: 'not_started', payoutsEnabled: false };
    },
  });

  // Handle the redirect back from Stripe once.
  useEffect(() => {
    if (!connectResult) return;
    setBanner(
      connectResult === 'done'
        ? 'Welcome back! We’re confirming your payout details with Stripe — this can take a moment.'
        : 'Your onboarding link expired. Pick up where you left off below.'
    );
    connectQuery.refetch();
    earningsQuery.refetch();
    // Clear the query param so a refresh doesn't re-trigger the banner.
    searchParams.delete('connect');
    setSearchParams(searchParams, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectResult]);

  const onboardMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ url: string }>('/api/stripe/connect/onboard');
      if (res.error || !res.data?.url) throw new Error(res.error || 'Could not start onboarding');
      return res.data.url;
    },
    onSuccess: (url) => {
      window.location.href = url; // hand off to Stripe's hosted flow
    },
  });

  const payoutMutation = useMutation<PayoutResult, Error, string>({
    mutationFn: async (period: string) => {
      const res = await api.post<PayoutResult>('/api/stripe/payouts/run', { period });
      if (res.error || !res.data) throw new Error(res.error || 'Payout failed');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator-earnings'] });
      queryClient.invalidateQueries({ queryKey: ['connect-status'] });
    },
  });

  const earnings = earningsQuery.data;
  // Prefer the live Connect status; fall back to the summary embedded in earnings.
  const payoutsEnabled = connectQuery.data?.payoutsEnabled ?? earnings?.payouts.payoutsEnabled ?? false;
  const onboardingStatus = connectQuery.data?.onboardingStatus ?? earnings?.payouts.onboardingStatus ?? 'not_started';

  const chart = useMemo(() => {
    const periods = earnings?.periods;
    if (!periods || periods.length === 0) return null;
    const ordered = [...periods].sort((a, b) => a.period.localeCompare(b.period));
    const root = getComputedStyle(document.documentElement);
    const accent = root.getPropertyValue('--color-accent').trim() || '#f97316';
    const success = root.getPropertyValue('--color-success').trim() || '#22c55e';
    return {
      data: {
        labels: ordered.map((p) => periodLabel(p.period)),
        datasets: [
          { label: 'Earned', data: ordered.map((p) => p.earned), backgroundColor: `${accent}cc`, borderRadius: 6 },
          { label: 'Paid out', data: ordered.map((p) => p.paid), backgroundColor: `${success}cc`, borderRadius: 6 },
        ],
      },
    };
  }, [earnings]);

  const chartOptions = useMemo(() => {
    const root = getComputedStyle(document.documentElement);
    const text = root.getPropertyValue('--color-textSecondary').trim() || '#9ca3b8';
    const grid = root.getPropertyValue('--color-border').trim() || 'rgba(255,255,255,0.06)';
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' as const, labels: { color: text, usePointStyle: true, padding: 16 } },
        tooltip: {
          backgroundColor: 'rgba(0,0,0,0.85)',
          padding: 12,
          callbacks: { label: (c: TooltipItem<'bar'>) => ` ${c.dataset.label}: ${usd(c.parsed.y ?? 0)}` },
        },
      },
      scales: {
        y: { grid: { color: grid }, ticks: { color: text, callback: (v: number | string) => usd(Number(v)) } },
        x: { grid: { display: false }, ticks: { color: text } },
      },
    };
  }, []);

  // ─── Loading ────────────────────────────────────────────────────────────────
  if (earningsQuery.isLoading) {
    return (
      <div className="page-container">
        <div className="page-header">
          <div className="skeleton" style={{ width: 200, height: 32, marginBottom: 'var(--space-3)' }} />
          <div className="skeleton" style={{ width: 280, height: 18 }} />
        </div>
        <div className="skeleton" style={{ height: 110, borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-6)' }} />
        <div className="skeleton" style={{ height: 360, borderRadius: 'var(--radius-lg)' }} />
      </div>
    );
  }

  // ─── Error ──────────────────────────────────────────────────────────────────
  if (earningsQuery.isError) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1 className="page-title">Earnings</h1>
        </div>
        <div className="earnings-banner info" role="alert">
          <span>Couldn&rsquo;t load your earnings right now.</span>
          <button className="btn btn-ghost" onClick={() => earningsQuery.refetch()}>Retry</button>
        </div>
      </div>
    );
  }

  const periods = earnings?.periods ?? [];
  const hasEarnings = periods.length > 0;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Earnings</h1>
        <p className="page-subtitle">Your share of every visit you drive — paid on proven, POS-attributed sales.</p>
      </div>

      {banner && (
        <div className={`earnings-banner ${connectResult === 'refresh' ? 'info' : 'success'}`} role="status">
          <span>{banner}</span>
        </div>
      )}

      {/* Payout status hero */}
      <PayoutHero
        status={onboardingStatus}
        payoutsEnabled={payoutsEnabled}
        connecting={onboardMutation.isPending}
        onConnect={() => onboardMutation.mutate()}
        error={onboardMutation.isError ? (onboardMutation.error as Error).message : null}
      />

      {/* Stat cards */}
      <div className="earnings-stats">
        <div className="card earnings-stat">
          <span className="earnings-stat-label">Total earned</span>
          <span className="earnings-stat-value">{usd(earnings?.totals.earned ?? 0)}</span>
          <span className="earnings-stat-hint">All time, across all partners</span>
        </div>
        <div className="card earnings-stat">
          <span className="earnings-stat-label">Available to cash out</span>
          <span className="earnings-stat-value accent">{usd(earnings?.totals.pending ?? 0)}</span>
          <span className="earnings-stat-hint">
            {payoutsEnabled ? 'Ready to transfer to your bank' : 'Connect a bank account to cash out'}
          </span>
        </div>
        <div className="card earnings-stat">
          <span className="earnings-stat-label">Paid out</span>
          <span className="earnings-stat-value">
            {usd((earnings?.totals.earned ?? 0) - (earnings?.totals.pending ?? 0))}
          </span>
          <span className="earnings-stat-hint">Transferred to date</span>
        </div>
      </div>

      {!hasEarnings ? (
        <EmptyState
          icon={'💸'}
          title="No earnings yet"
          description="When the offers and QR codes you share drive real, POS-attributed visits, your commission shows up here — ready to cash out. Get a deal live to start earning."
          ctaLabel="Manage Deals & QR"
          ctaTo="/app/offers"
          secondaryLabel="Discover Restaurants"
          secondaryTo="/app/restaurants"
        />
      ) : (
        <>
          {/* Earnings-by-month chart */}
          {chart && (
            <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
              <div className="earnings-section-title">Earnings by month</div>
              <div style={{ height: 320, width: '100%' }}>
                <Bar data={chart.data} options={chartOptions} />
              </div>
            </div>
          )}

          {/* Per-period breakdown */}
          <div className="card">
            <div className="earnings-section-title">Monthly breakdown</div>
            <div className="earnings-table-wrap">
              <table className="earnings-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th className="num">Attributed sales</th>
                    <th className="num">Earned</th>
                    <th className="num">Pending</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {periods.map((p) => {
                    const cashingOut = payoutMutation.isPending && payoutMutation.variables === p.period;
                    const canCashOut = payoutsEnabled && p.pending > 0;
                    return (
                      <tr key={p.period}>
                        <td>{periodLabel(p.period)}</td>
                        <td className="num muted">{usd(p.grossAttributed)}</td>
                        <td className="num">{usd(p.earned)}</td>
                        <td className="num">{usd(p.pending)}</td>
                        <td>
                          <span className={`status-pill ${p.status}`}>{p.status.replace('_', ' ')}</span>
                        </td>
                        <td className="num">
                          {p.pending > 0 && (
                            <button
                              className="btn btn-primary cashout-btn"
                              disabled={!canCashOut || cashingOut}
                              title={payoutsEnabled ? '' : 'Connect a bank account first'}
                              onClick={() => payoutMutation.mutate(p.period)}
                            >
                              {cashingOut ? 'Sending…' : `Cash out ${usd(p.pending)}`}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {payoutMutation.isError && (
              <p style={{ color: 'var(--color-error)', fontSize: 'var(--font-sm)', marginTop: 'var(--space-3)' }}>
                {(payoutMutation.error as Error).message}
              </p>
            )}
          </div>
        </>
      )}

      <div className="earnings-footnote">
        <strong>How payouts work.</strong> Restaurants pay a <strong>12%</strong> fee on sales we attribute to
        your content through their POS (with a monthly cap). You earn <strong>60%</strong> of that fee. Nothing is
        ever charged upfront — you earn only on visits you provably drove. Payouts are handled securely by Stripe.
      </div>
    </div>
  );
}

// ─── Payout status hero ────────────────────────────────────────────────────────
function PayoutHero({
  status,
  payoutsEnabled,
  connecting,
  onConnect,
  error,
}: {
  status: string;
  payoutsEnabled: boolean;
  connecting: boolean;
  onConnect: () => void;
  error: string | null;
}) {
  if (payoutsEnabled) {
    return (
      <div className="payout-hero">
        <div className="payout-hero-text">
          <span className="payout-pill active"><span className="dot" /> Payouts active</span>
          <span className="payout-hero-title">Your bank account is connected</span>
          <span className="payout-hero-sub">Cash out any pending balance below — funds arrive in your bank in 1–2 business days.</span>
        </div>
      </div>
    );
  }

  const inProgress = status === 'pending' || status === 'pending_review';
  return (
    <div className="payout-hero">
      <div className="payout-hero-text">
        <span className={`payout-pill ${inProgress ? 'pending' : 'none'}`}>
          <span className="dot" /> {inProgress ? 'Setup in progress' : 'Not set up'}
        </span>
        <span className="payout-hero-title">
          {inProgress ? 'Finish connecting your payouts' : 'Get paid for the visits you drive'}
        </span>
        <span className="payout-hero-sub">
          {inProgress
            ? 'You started onboarding but a few details are still needed before we can send money.'
            : 'Connect a bank account through Stripe to cash out your earnings. Takes about 2 minutes.'}
        </span>
        {error && <span style={{ color: 'var(--color-error)', fontSize: 'var(--font-sm)' }}>{error}</span>}
      </div>
      <button className="btn btn-primary" onClick={onConnect} disabled={connecting}>
        {connecting ? 'Opening Stripe…' : inProgress ? 'Continue setup' : 'Set up payouts'}
      </button>
    </div>
  );
}
