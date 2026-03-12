import { useState, memo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/ApiService';
import { isDemoMode } from '../../data/demoData';
import { CalendarDatePicker } from '../../components/CalendarDatePicker';
import type { Raffle, RaffleEntry, RaffleStatus } from '../../types';

/* ─── Demo Data ─────────────────────────────────────────────────────────────── */

function demoISO(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString();
}

const DEMO_RAFFLES: Raffle[] = [
  {
    raffleId: 'raffle-demo-1',
    creatorId: 'creator-demo',
    creatorName: 'Demo Creator',
    restaurantId: 'r1',
    restaurantName: 'Rasika',
    title: 'Win a 3-Course Dinner at Rasika',
    description: "Watch my feature on Rasika's legendary lamb dishes and enter for a chance to win!",
    prizeDescription: '3-course tasting menu + wine pairing for two ($200 value)',
    videoUrl: 'https://instagram.com/p/demo-rasika',
    startsAt: demoISO(-3),
    endsAt: demoISO(4),
    status: 'active',
    entryCount: 127,
    maxEntries: 10000,
    platformFee: 50,
    creatorRevenue: 18,
    winner: null,
    createdAt: demoISO(-3),
    updatedAt: demoISO(-1),
  },
  {
    raffleId: 'raffle-demo-2',
    creatorId: 'creator-demo',
    creatorName: 'Demo Creator',
    restaurantId: 'r12',
    restaurantName: 'Le Diplomate',
    title: 'Brunch for Two at Le Diplomate',
    description: 'Tag a friend who loves French brunch! Entry includes both of you.',
    prizeDescription: 'Brunch for two with bottomless mimosas ($150 value)',
    videoUrl: 'https://tiktok.com/@demo/video/1234',
    startsAt: demoISO(2),
    endsAt: demoISO(9),
    status: 'draft',
    entryCount: 0,
    maxEntries: 5000,
    platformFee: 50,
    creatorRevenue: 18,
    winner: null,
    createdAt: demoISO(-1),
    updatedAt: demoISO(-1),
  },
  {
    raffleId: 'raffle-demo-3',
    creatorId: 'creator-demo',
    creatorName: 'Demo Creator',
    restaurantId: 'r6',
    restaurantName: "Rose's Luxury",
    title: "Chef's Table Experience at Rose's Luxury",
    description: "Exclusive 7-course chef's table experience. One lucky winner!",
    prizeDescription: "7-course chef's table for two ($400 value)",
    videoUrl: 'https://instagram.com/p/demo-roses',
    startsAt: demoISO(-14),
    endsAt: demoISO(-2),
    status: 'drawn',
    entryCount: 843,
    maxEntries: 10000,
    platformFee: 75,
    creatorRevenue: 20,
    winner: { email: 'sarah.k@example.com', name: 'Sarah Kim', claimCode: 'SPOT-A3F2', drawnAt: demoISO(-2) },
    createdAt: demoISO(-14),
    updatedAt: demoISO(-2),
  },
];

const DEMO_ENTRIES: RaffleEntry[] = Array.from({ length: 20 }, (_, i) => ({
  entryId: `entry-demo-${i + 1}`,
  raffleId: 'raffle-demo-1',
  email: `user${i + 1}@example.com`,
  name: ['Alice Chen', 'Bob Martinez', 'Carol Johnson', 'David Park', 'Emma Wilson',
    'Frank Lee', 'Grace Taylor', 'Henry Brown', 'Ivy Garcia', 'Jack Davis',
    'Karen Miller', 'Leo Thompson', 'Mia Anderson', 'Noah White', 'Olivia Harris',
    'Peter Clark', 'Quinn Lewis', 'Rachel Young', 'Sam Walker', 'Tina King'][i],
  socialHandle: ['@foodie_dc', '@eats_dmv', '@dcbrunch', '@capitaleats', '@dmvfood',
    '@dcfoodie', '@biteofdc', '@tastingdc', '@eatlocal_dc', '@dcrestaurants',
    '@foodiedmv', '@dcfoodscene', '@eatdc', '@brunchdc', '@dceatery',
    '@foodlovers_dc', '@dcbites', '@tastymeets', '@dcflavors', '@eatarounddc'][i],
  createdAt: demoISO(-Math.random() * 3),
}));

/* ─── Helpers ───────────────────────────────────────────────────────────────── */

const STATUS_COLORS: Record<RaffleStatus, string> = {
  draft: '#6b7280',
  active: '#10b981',
  closed: '#f59e0b',
  drawn: '#6366f1',
  cancelled: '#ef4444',
};

function timeLeft(endsAt: string): string {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return 'Ended';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d ${hours}h left`;
  return `${hours}h left`;
}

/* ─── Sub-components ────────────────────────────────────────────────────────── */

const RaffleCard = memo(function RaffleCard({ raffle, onSelect }: { raffle: Raffle; onSelect: (r: Raffle) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(raffle)}
      style={{
        display: 'flex', gap: 'var(--space-4)', padding: 'var(--space-4)',
        background: 'var(--color-bgElevated)', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)', cursor: 'pointer', width: '100%',
        textAlign: 'left', fontFamily: 'inherit', transition: 'box-shadow var(--transition-fast)',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div style={{
        fontSize: '28px', width: '48px', height: '48px', display: 'flex',
        alignItems: 'center', justifyContent: 'center', background: 'var(--color-bgPrimary)',
        borderRadius: 'var(--radius-md)', flexShrink: 0,
      }}>
        🎰
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, color: 'var(--color-textPrimary)', fontSize: 'var(--font-sm)', marginBottom: '2px' }}>
          {raffle.title}
        </div>
        <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)', marginBottom: 'var(--space-2)' }}>
          {raffle.restaurantName} &middot; {raffle.prizeDescription.slice(0, 60)}
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', fontSize: 'var(--font-xs)' }}>
          <span style={{ color: 'var(--color-textSecondary)' }}>
            {raffle.entryCount.toLocaleString()} entries
          </span>
          {raffle.status === 'active' && (
            <span style={{ color: new Date(raffle.endsAt).getTime() - Date.now() < 86400000 ? '#ef4444' : 'var(--color-textMuted)' }}>
              {timeLeft(raffle.endsAt)}
            </span>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 'var(--space-1)' }}>
        <span style={{
          padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: 'var(--font-xs)',
          fontWeight: 600, background: `${STATUS_COLORS[raffle.status]}22`,
          color: STATUS_COLORS[raffle.status], textTransform: 'capitalize',
        }}>
          {raffle.status}
        </span>
        {raffle.winner && (
          <span style={{ fontSize: '11px', color: '#6366f1' }}>Winner: {raffle.winner.name}</span>
        )}
      </div>
    </button>
  );
});

/* ─── Create Form ───────────────────────────────────────────────────────────── */

function RaffleCreateForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    title: '', description: '', prizeDescription: '', videoUrl: '',
    restaurantId: '', restaurantName: '', endsAt: '',
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (isDemoMode()) return;
      return api.post('/api/raffles', {
        ...form,
        creatorName: 'Creator', // Will be from profile in production
      });
    },
    onSuccess: () => { onCreated(); onClose(); },
  });

  const update = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: 'var(--space-2) var(--space-3)',
    background: 'var(--color-bgElevated)', border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)', color: 'var(--color-textPrimary)',
    fontSize: 'var(--font-sm)', fontFamily: 'inherit', boxSizing: 'border-box',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000, display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--color-bgSecondary)', borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--color-border)', width: '100%', maxWidth: '520px',
        maxHeight: '85vh', overflowY: 'auto', boxShadow: 'var(--shadow-xl)',
        padding: 'var(--space-5)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ margin: 0, fontSize: 'var(--font-lg)', color: 'var(--color-textPrimary)' }}>
            Create Raffle
          </h2>
          <button type="button" onClick={onClose} style={{
            background: 'none', border: 'none', color: 'var(--color-textMuted)',
            fontSize: '20px', cursor: 'pointer',
          }}>x</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div>
            <label style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)', display: 'block', marginBottom: '4px' }}>Title *</label>
            <input type="text" value={form.title} onChange={e => update('title', e.target.value)}
              placeholder="Win a Free Dinner at..." style={inputStyle} maxLength={200} />
          </div>
          <div>
            <label style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)', display: 'block', marginBottom: '4px' }}>Restaurant Name *</label>
            <input type="text" value={form.restaurantName} onChange={e => update('restaurantName', e.target.value)}
              placeholder="Restaurant name" style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)', display: 'block', marginBottom: '4px' }}>Prize Description *</label>
            <input type="text" value={form.prizeDescription} onChange={e => update('prizeDescription', e.target.value)}
              placeholder="3-course dinner for two ($200 value)" style={inputStyle} maxLength={500} />
          </div>
          <div>
            <label style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)', display: 'block', marginBottom: '4px' }}>Description</label>
            <textarea value={form.description} onChange={e => update('description', e.target.value)}
              placeholder="Tell your audience about this raffle..." rows={3}
              style={{ ...inputStyle, resize: 'vertical' }} maxLength={500} />
          </div>
          <div>
            <label style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)', display: 'block', marginBottom: '4px' }}>Video URL</label>
            <input type="url" value={form.videoUrl} onChange={e => update('videoUrl', e.target.value)}
              placeholder="https://instagram.com/p/..." style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)', display: 'block', marginBottom: '4px' }}>Ends At *</label>
            <CalendarDatePicker
              value={form.endsAt}
              onChange={(v: string) => update('endsAt', v)}
              placeholder="Select end date"
              min={new Date().toISOString().split('T')[0]}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
          <button type="button" onClick={onClose} style={{
            padding: 'var(--space-2) var(--space-4)', background: 'transparent',
            border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
            color: 'var(--color-textSecondary)', fontSize: 'var(--font-sm)', cursor: 'pointer',
          }}>Cancel</button>
          <button type="button"
            disabled={!form.title || !form.prizeDescription || !form.endsAt || createMutation.isPending}
            onClick={() => createMutation.mutate()}
            style={{
              padding: 'var(--space-2) var(--space-4)', background: 'var(--color-accent)',
              border: 'none', borderRadius: 'var(--radius-md)', color: '#fff',
              fontSize: 'var(--font-sm)', fontWeight: 600, cursor: 'pointer',
              opacity: (!form.title || !form.prizeDescription || !form.endsAt) ? 0.5 : 1,
            }}>
            {createMutation.isPending ? 'Creating...' : 'Create Raffle'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Entries View ──────────────────────────────────────────────────────────── */

function EntriesPanel({ raffle, onClose }: { raffle: Raffle; onClose: () => void }) {
  const entriesQuery = useQuery({
    queryKey: ['raffle-entries', raffle.raffleId],
    queryFn: async () => {
      if (isDemoMode()) return DEMO_ENTRIES.filter(e => e.raffleId === raffle.raffleId);
      const res = await api.get<{ entries: RaffleEntry[] }>(`/api/raffles/${raffle.raffleId}/entries`);
      return res.data?.entries || [];
    },
    staleTime: 30_000,
  });

  const entries = entriesQuery.data || [];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000, display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--color-bgSecondary)', borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--color-border)', width: '100%', maxWidth: '600px',
        maxHeight: '85vh', overflowY: 'auto', boxShadow: 'var(--shadow-xl)',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--color-border)',
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 'var(--font-lg)', color: 'var(--color-textPrimary)' }}>
              Entries &mdash; {raffle.title}
            </h2>
            <div style={{ fontSize: 'var(--font-sm)', color: 'var(--color-textMuted)', marginTop: '2px' }}>
              {raffle.entryCount} total entries
            </div>
          </div>
          <button type="button" onClick={onClose} style={{
            background: 'none', border: 'none', color: 'var(--color-textMuted)',
            fontSize: '20px', cursor: 'pointer',
          }}>x</button>
        </div>

        <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
          {entriesQuery.isLoading ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-textMuted)' }}>Loading entries...</div>
          ) : entries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-textMuted)' }}>No entries yet</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
              {/* Header */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr 0.8fr',
                gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)',
                fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)', fontWeight: 600,
                borderBottom: '1px solid var(--color-border)',
              }}>
                <span>Name</span><span>Email</span><span>Social</span><span>Entered</span>
              </div>
              {entries.map(entry => (
                <div key={entry.entryId} style={{
                  display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr 0.8fr',
                  gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)',
                  fontSize: 'var(--font-xs)', color: 'var(--color-textPrimary)',
                  borderBottom: '1px solid var(--color-border)',
                }}>
                  <span style={{ fontWeight: 500 }}>{entry.name}</span>
                  <span style={{ color: 'var(--color-textSecondary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.email}</span>
                  <span style={{ color: 'var(--color-accent)' }}>{entry.socialHandle || '-'}</span>
                  <span style={{ color: 'var(--color-textMuted)' }}>
                    {new Date(entry.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ────────────────────────────────────────────────────────── */

export default function RaffleManager() {
  const [tab, setTab] = useState<'active' | 'draft' | 'completed'>('active');
  const [showCreate, setShowCreate] = useState(false);
  const [viewEntries, setViewEntries] = useState<Raffle | null>(null);
  const [drawingRaffle, setDrawingRaffle] = useState<Raffle | null>(null);
  const queryClient = useQueryClient();

  const rafflesQuery = useQuery({
    queryKey: ['raffles'],
    queryFn: async () => {
      if (isDemoMode()) return DEMO_RAFFLES;
      const res = await api.get<{ raffles: Raffle[] }>('/api/raffles');
      return res.data?.raffles || [];
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const activateMutation = useMutation({
    mutationFn: async (id: string) => {
      if (isDemoMode()) return;
      return api.put(`/api/raffles/${id}`, { status: 'active' });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['raffles'] }),
    onError: (err: Error) => console.error('Activate raffle failed:', err.message),
  });

  const drawMutation = useMutation({
    mutationFn: async (id: string) => {
      if (isDemoMode()) return { data: { winner: { name: 'Sarah Kim', email: 'sarah.k@example.com', claimCode: 'SPOT-X7Y2' }, totalEntries: 127 } };
      const res = await api.post<{ winner: { name: string; email: string; claimCode: string }; totalEntries: number }>(`/api/raffles/${id}/draw`);
      return res;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['raffles'] }),
    onError: (err: Error) => console.error('Draw winner failed:', err.message),
  });

  const raffles = rafflesQuery.data || [];
  const filtered = raffles.filter(r => {
    if (tab === 'active') return r.status === 'active';
    if (tab === 'draft') return r.status === 'draft';
    return r.status === 'drawn' || r.status === 'closed' || r.status === 'cancelled';
  });

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-5)' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 'var(--font-xl)', color: 'var(--color-textPrimary)' }}>Spot Raffles</h1>
          <p style={{ margin: 'var(--space-1) 0 0', fontSize: 'var(--font-sm)', color: 'var(--color-textMuted)' }}>
            Create giveaways that grow your audience and drive restaurant traffic.
          </p>
        </div>
        <button type="button" onClick={() => setShowCreate(true)} style={{
          padding: 'var(--space-2) var(--space-4)', background: 'var(--color-accent)',
          border: 'none', borderRadius: 'var(--radius-md)', color: '#fff',
          fontSize: 'var(--font-sm)', fontWeight: 600, cursor: 'pointer',
        }}>
          + New Raffle
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
        {[
          { label: 'Active Raffles', value: raffles.filter(r => r.status === 'active').length, color: '#10b981' },
          { label: 'Total Entries', value: raffles.reduce((sum, r) => sum + r.entryCount, 0), color: 'var(--color-accent)' },
          { label: 'Winners Drawn', value: raffles.filter(r => r.winner).length, color: '#6366f1' },
        ].map(stat => (
          <div key={stat.label} style={{
            padding: 'var(--space-4)', background: 'var(--color-bgElevated)',
            borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)',
          }}>
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)', marginBottom: 'var(--space-1)' }}>{stat.label}</div>
            <div style={{ fontSize: 'var(--font-xl)', fontWeight: 700, color: stat.color }}>{stat.value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 'var(--space-1)', marginBottom: 'var(--space-4)', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-1)' }} role="tablist">
        {(['active', 'draft', 'completed'] as const).map(t => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} style={{
            padding: 'var(--space-2) var(--space-4)',
            background: tab === t ? 'var(--color-accent)' : 'transparent',
            color: tab === t ? '#fff' : 'var(--color-textSecondary)',
            border: 'none', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-sm)',
            fontWeight: tab === t ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit',
            textTransform: 'capitalize',
          }}>
            {t}
          </button>
        ))}
      </div>

      {/* List */}
      {rafflesQuery.isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: '80px', background: 'var(--color-bgElevated)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-8) var(--space-4)', color: 'var(--color-textMuted)' }}>
          <div style={{ fontSize: '48px', marginBottom: 'var(--space-3)' }}>🎰</div>
          <div style={{ fontSize: 'var(--font-md)', fontWeight: 500, marginBottom: 'var(--space-1)' }}>
            {tab === 'active' ? 'No active raffles' : tab === 'draft' ? 'No drafts' : 'No completed raffles'}
          </div>
          <div style={{ fontSize: 'var(--font-sm)' }}>
            Create your first raffle to start growing your audience!
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }} role="tabpanel">
          {filtered.map(r => (
            <div key={r.raffleId} style={{ position: 'relative' }}>
              <RaffleCard raffle={r} onSelect={setViewEntries} />
              {/* Action buttons */}
              <div style={{
                position: 'absolute', right: 'var(--space-4)', bottom: 'var(--space-3)',
                display: 'flex', gap: 'var(--space-1)',
              }}>
                {r.status === 'draft' && (
                  <button type="button" onClick={e => { e.stopPropagation(); activateMutation.mutate(r.raffleId); }} style={{
                    padding: '2px 8px', background: '#10b981', border: 'none',
                    borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: '11px',
                    fontWeight: 600, cursor: 'pointer',
                  }}>Go Live</button>
                )}
                {r.status === 'active' && (
                  <>
                    <button type="button" onClick={e => { e.stopPropagation(); setViewEntries(r); }} style={{
                      padding: '2px 8px', background: 'var(--color-bgPrimary)', border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)', color: 'var(--color-textSecondary)', fontSize: '11px', cursor: 'pointer',
                    }}>Entries</button>
                    <button type="button" onClick={e => { e.stopPropagation(); setDrawingRaffle(r); }} style={{
                      padding: '2px 8px', background: '#6366f1', border: 'none',
                      borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: '11px',
                      fontWeight: 600, cursor: 'pointer',
                    }}>Draw Winner</button>
                  </>
                )}
                {r.status === 'active' && (
                  <button type="button" onClick={e => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(`${window.location.origin}/raffle/${r.raffleId}`);
                  }} style={{
                    padding: '2px 8px', background: 'var(--color-bgPrimary)', border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)', color: 'var(--color-textSecondary)', fontSize: '11px', cursor: 'pointer',
                  }}>Copy Link</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <RaffleCreateForm onClose={() => setShowCreate(false)} onCreated={() => queryClient.invalidateQueries({ queryKey: ['raffles'] })} />
      )}
      {viewEntries && (
        <EntriesPanel raffle={viewEntries} onClose={() => setViewEntries(null)} />
      )}
      {drawingRaffle && (
        <RaffleDrawModalInline
          raffle={drawingRaffle}
          onClose={() => setDrawingRaffle(null)}
          onDraw={drawMutation}
        />
      )}
    </div>
  );
}

/* ─── Inline Draw Modal (simple version — will be expanded in RaffleDrawModal) */

function RaffleDrawModalInline({ raffle, onClose, onDraw }: {
  raffle: Raffle;
  onClose: () => void;
  onDraw: ReturnType<typeof useMutation<unknown, Error, string>>;
}) {
  const [phase, setPhase] = useState<'confirm' | 'drawing' | 'winner'>('confirm');
  const [winner, setWinner] = useState<{ name: string; email: string; claimCode: string } | null>(null);

  const handleDraw = async () => {
    setPhase('drawing');
    const result = await onDraw.mutateAsync(raffle.raffleId);
    // Small delay for animation feel
    setTimeout(() => {
      const w = (result as { data?: { winner?: { name: string; email: string; claimCode: string } } })?.data?.winner;
      if (w) setWinner(w);
      setPhase('winner');
    }, 2000);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000, display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
    }}
      onClick={e => { if (e.target === e.currentTarget && phase !== 'drawing') onClose(); }}
    >
      <div style={{
        background: 'var(--color-bgSecondary)', borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--color-border)', width: '100%', maxWidth: '420px',
        boxShadow: 'var(--shadow-xl)', padding: 'var(--space-6)', textAlign: 'center',
      }}>
        {phase === 'confirm' && (
          <>
            <div style={{ fontSize: '48px', marginBottom: 'var(--space-3)' }}>🎰</div>
            <h2 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--font-lg)', color: 'var(--color-textPrimary)' }}>
              Draw Winner
            </h2>
            <p style={{ margin: '0 0 var(--space-4)', color: 'var(--color-textMuted)', fontSize: 'var(--font-sm)' }}>
              {raffle.entryCount} entries for "{raffle.title}". This action is permanent.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center' }}>
              <button type="button" onClick={onClose} style={{
                padding: 'var(--space-2) var(--space-4)', background: 'transparent',
                border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
                color: 'var(--color-textSecondary)', fontSize: 'var(--font-sm)', cursor: 'pointer',
              }}>Cancel</button>
              <button type="button" onClick={handleDraw} style={{
                padding: 'var(--space-2) var(--space-4)', background: '#6366f1',
                border: 'none', borderRadius: 'var(--radius-md)', color: '#fff',
                fontSize: 'var(--font-sm)', fontWeight: 600, cursor: 'pointer',
              }}>Draw Now</button>
            </div>
          </>
        )}
        {phase === 'drawing' && (
          <>
            <div style={{ fontSize: '64px', marginBottom: 'var(--space-3)', animation: 'spin 1s linear infinite' }}>🎰</div>
            <h2 style={{ margin: 0, fontSize: 'var(--font-lg)', color: 'var(--color-textPrimary)' }}>
              Selecting winner...
            </h2>
            <style>{`@keyframes spin { from { transform: rotateY(0deg); } to { transform: rotateY(360deg); } }`}</style>
          </>
        )}
        {phase === 'winner' && winner && (
          <>
            <div style={{ fontSize: '64px', marginBottom: 'var(--space-3)' }}>🎉</div>
            <h2 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--font-lg)', color: 'var(--color-textPrimary)' }}>
              Winner!
            </h2>
            <div style={{
              padding: 'var(--space-4)', background: '#6366f122', borderRadius: 'var(--radius-lg)',
              marginBottom: 'var(--space-3)',
            }}>
              <div style={{ fontSize: 'var(--font-md)', fontWeight: 700, color: '#6366f1', marginBottom: '4px' }}>
                {winner.name}
              </div>
              <div style={{ fontSize: 'var(--font-sm)', color: 'var(--color-textMuted)' }}>
                {winner.email}
              </div>
            </div>
            <div style={{
              padding: 'var(--space-3)', background: 'var(--color-bgElevated)',
              borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)',
              marginBottom: 'var(--space-4)',
            }}>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)', marginBottom: '4px' }}>Claim Code</div>
              <div style={{ fontSize: 'var(--font-lg)', fontWeight: 700, color: 'var(--color-textPrimary)', fontFamily: 'monospace' }}>
                {winner.claimCode}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center' }}>
              <button type="button" onClick={() => navigator.clipboard.writeText(winner.claimCode)} style={{
                padding: 'var(--space-2) var(--space-4)', background: 'var(--color-accent)',
                border: 'none', borderRadius: 'var(--radius-md)', color: '#fff',
                fontSize: 'var(--font-sm)', fontWeight: 600, cursor: 'pointer',
              }}>Copy Code</button>
              <button type="button" onClick={onClose} style={{
                padding: 'var(--space-2) var(--space-4)', background: 'transparent',
                border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
                color: 'var(--color-textSecondary)', fontSize: 'var(--font-sm)', cursor: 'pointer',
              }}>Done</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
