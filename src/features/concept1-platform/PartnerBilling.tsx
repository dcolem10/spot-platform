import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CommissionBill, Restaurant } from '../../types';
import { api } from '../../services/ApiService';
import { isDemoMode } from '../../data/demoData';
import { EmptyState } from '../../components/EmptyState';

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
const DEMO_RESTAURANTS = [
  { restaurantId: 'demo-rest-1', name: 'Tail Up Goat' },
  { restaurantId: 'demo-rest-2', name: 'Maydan' },
] as Pick<Restaurant, 'restaurantId' | 'name'>[];

const DEMO_BILLS: Record<string, CommissionBill> = {
  'demo-rest-1': {
    restaurantId: 'demo-rest-1',
    periods: [
      { period: '2026-06', grossAttributed: 4180.0, feeCharged: 501.6, monthlyCap: 500, capReached: true, status: 'accruing' },
      { period: '2026-05', grossAttributed: 3210.5, feeCharged: 385.26, monthlyCap: 500, capReached: false, status: 'billed' },
      { period: '2026-04', grossAttributed: 2740.0, feeCharged: 328.8, monthlyCap: 500, capReached: false, status: 'paid' },
    ],
  },
  'demo-rest-2': {
    restaurantId: 'demo-rest-2',
    periods: [
      { period: '2026-06', grossAttributed: 1980.0, feeCharged: 237.6, monthlyCap: 500, capReached: false, status: 'accruing' },
      { period: '2026-05', grossAttributed: 1520.0, feeCharged: 182.4, monthlyCap: 500, capReached: false, status: 'paid' },
    ],
  },
};

export default function PartnerBilling() {
  const demo = isDemoMode();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const restaurantsQuery = useQuery<Pick<Restaurant, 'restaurantId' | 'name'>[]>({
    queryKey: ['my-restaurants'],
    queryFn: async () => {
      if (demo) return DEMO_RESTAURANTS;
      const res = await api.get<Restaurant[]>('/api/my/restaurants');
      if (res.error) throw new Error(res.error);
      return res.data ?? [];
    },
  });

  const restaurants = restaurantsQuery.data ?? [];
  const activeId = selectedId ?? restaurants[0]?.restaurantId ?? null;

  const billQuery = useQuery<CommissionBill>({
    queryKey: ['restaurant-commissions', activeId],
    enabled: !!activeId,
    queryFn: async () => {
      if (demo) return DEMO_BILLS[activeId!] ?? { restaurantId: activeId!, periods: [] };
      const res = await api.get<CommissionBill>(`/api/restaurants/${activeId}/commissions`);
      if (res.error) throw new Error(res.error);
      return res.data ?? { restaurantId: activeId!, periods: [] };
    },
  });

  const periods = billQuery.data?.periods ?? [];
  const totals = useMemo(() => {
    return periods.reduce(
      (acc, p) => {
        acc.attributed += p.grossAttributed;
        acc.fee += p.feeCharged;
        acc.owed += p.status === 'paid' ? 0 : p.feeCharged;
        return acc;
      },
      { attributed: 0, fee: 0, owed: 0 }
    );
  }, [periods]);

  // ─── Loading ────────────────────────────────────────────────────────────────
  if (restaurantsQuery.isLoading) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1 className="page-title">Commission Bill</h1>
        </div>
        <div className="skeleton" style={{ height: 320, borderRadius: 'var(--radius-lg)' }} />
      </div>
    );
  }

  // ─── No restaurants ───────────────────────────────────────────────────────────
  if (!restaurantsQuery.isError && restaurants.length === 0) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1 className="page-title">Commission Bill</h1>
        </div>
        <EmptyState
          icon={'🧾'}
          title="No restaurant yet"
          description="Once your restaurant is set up and creators start driving POS-attributed visits, your commission bill will appear here — you only ever pay on proven sales."
          ctaLabel="Go to Dashboard"
          ctaTo="/app/partner"
        />
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Commission Bill</h1>
        <p className="page-subtitle">
          What you owe Spot — a small fee on sales we provably attributed to creator partnerships. Never upfront.
        </p>
      </div>

      {/* Restaurant selector (only when managing more than one) */}
      {restaurants.length > 1 && (
        <div style={{ marginBottom: 'var(--space-5)', maxWidth: 320 }}>
          <label style={{ display: 'block', fontSize: 'var(--font-sm)', color: 'var(--color-textMuted)', marginBottom: 4 }}>
            Restaurant
          </label>
          <select
            value={activeId ?? ''}
            onChange={(e) => setSelectedId(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-bgElevated)',
              color: 'var(--color-textPrimary)',
            }}
          >
            {restaurants.map((r) => (
              <option key={r.restaurantId} value={r.restaurantId}>{r.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 'var(--font-sm)', color: 'var(--color-textMuted)' }}>Attributed sales</span>
          <span style={{ fontSize: 'var(--font-2xl)', fontWeight: 700 }}>{usd(totals.attributed)}</span>
          <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)' }}>Last {periods.length} months</span>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 'var(--font-sm)', color: 'var(--color-textMuted)' }}>Total fees</span>
          <span style={{ fontSize: 'var(--font-2xl)', fontWeight: 700 }}>{usd(totals.fee)}</span>
          <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)' }}>12% of attributed sales (capped)</span>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 'var(--font-sm)', color: 'var(--color-textMuted)' }}>Outstanding</span>
          <span style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: 'var(--color-accent)' }}>{usd(totals.owed)}</span>
          <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)' }}>Not yet settled</span>
        </div>
      </div>

      {billQuery.isError ? (
        <div className="card" role="alert" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Couldn&rsquo;t load this restaurant&rsquo;s bill right now.</span>
          <button className="btn btn-ghost" onClick={() => billQuery.refetch()}>Retry</button>
        </div>
      ) : periods.length === 0 ? (
        <EmptyState
          icon={'📊'}
          title="No commission yet"
          description="When creators drive real, POS-attributed visits to this restaurant, the monthly fee shows up here. You only ever pay on proven sales."
          ctaLabel="View Partner Dashboard"
          ctaTo="/app/partner"
        />
      ) : (
        <div className="card">
          <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, marginBottom: 'var(--space-3)' }}>Monthly breakdown</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-sm)' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--color-textMuted)' }}>
                  <th style={{ padding: '8px 12px' }}>Month</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Attributed sales</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Fee (12%)</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Cap</th>
                  <th style={{ padding: '8px 12px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {periods.map((p) => (
                  <tr key={p.period} style={{ borderTop: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '10px 12px' }}>{periodLabel(p.period)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--color-textMuted)' }}>{usd(p.grossAttributed)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>{usd(p.feeCharged)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--color-textMuted)' }}>
                      {p.capReached ? <span title="Monthly cap reached">{usd(p.monthlyCap)} · capped</span> : usd(p.monthlyCap)}
                    </td>
                    <td style={{ padding: '10px 12px', textTransform: 'capitalize' }}>{p.status.replace('_', ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ marginTop: 'var(--space-6)', fontSize: 'var(--font-sm)', color: 'var(--color-textMuted)', lineHeight: 1.6 }}>
        <strong>How billing works.</strong> Spot charges a <strong>12%</strong> fee only on sales we attribute to a
        creator partnership through your POS, with a monthly cap so a viral month never shocks you. Of that fee, the
        creator who drove the visit earns 60% and Spot keeps 40%. You never pay upfront — only on proven results.
      </div>
    </div>
  );
}
