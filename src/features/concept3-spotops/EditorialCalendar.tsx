import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { EditorialSlot } from '../../types';
import { api } from '../../services/ApiService';
import { StyledSelect } from '../../components/FormControls';
import { isDemoMode, DEMO_EDITORIAL_SLOTS, DEMO_CAMPAIGNS } from '../../data/demoData';

/* ─── Types ────────────────────────────────────────────────────────────────── */

type ViewMode = 'week' | 'month';

interface SlotFormData {
  restaurantName: string;
  type: EditorialSlot['type'];
  notes: string;
  campaignId?: string;
}

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

const SLOT_TYPE_COLOR: Record<EditorialSlot['type'], string> = {
  sponsored: 'var(--color-accent)',
  organic: 'var(--color-success)',
  reshoot: 'var(--color-info)',
};

const SLOT_TYPE_BG: Record<EditorialSlot['type'], string> = {
  sponsored: 'var(--color-accentMuted)',
  organic: 'var(--color-successMuted)',
  reshoot: 'var(--color-infoMuted)',
};

const STATUS_BADGE_CLASS: Record<EditorialSlot['status'], string> = {
  planned: 'badge--info',
  shot: 'badge--warning',
  editing: 'badge--accent',
  published: 'badge--success',
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatDateShort(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/* ─── Styles ───────────────────────────────────────────────────────────────── */

const styles = {
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
    gap: 'var(--space-4)',
    marginBottom: 'var(--space-6)',
  } as React.CSSProperties,
  statCard: {
    background: 'var(--color-bgSecondary)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--space-4) var(--space-5)',
    textAlign: 'center' as const,
  } as React.CSSProperties,
  statValue: {
    fontSize: 'var(--font-2xl)',
    fontWeight: 700,
    color: 'var(--color-textPrimary)',
    lineHeight: 1.2,
  } as React.CSSProperties,
  statLabel: {
    fontSize: 'var(--font-xs)',
    color: 'var(--color-textMuted)',
    marginTop: 'var(--space-1)',
  } as React.CSSProperties,
  guidance: {
    background: 'var(--color-accentMuted)',
    border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--space-5)',
    marginBottom: 'var(--space-6)',
    display: 'flex',
    gap: 'var(--space-4)',
    alignItems: 'flex-start',
  } as React.CSSProperties,
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 'var(--space-6)',
    flexWrap: 'wrap' as const,
    gap: 'var(--space-3)',
  } as React.CSSProperties,
  navRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
  } as React.CSSProperties,
  navBtn: {
    padding: 'var(--space-2) var(--space-3)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--color-bgElevated)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-textPrimary)',
    fontSize: 'var(--font-sm)',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
    fontFamily: 'inherit',
  } as React.CSSProperties,
  currentLabel: {
    fontSize: 'var(--font-lg)',
    fontWeight: 600,
    color: 'var(--color-textPrimary)',
    minWidth: '200px',
    textAlign: 'center' as const,
  } as React.CSSProperties,
  viewToggle: {
    display: 'flex',
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
    border: '1px solid var(--color-border)',
  } as React.CSSProperties,
  viewBtn: (active: boolean) =>
    ({
      padding: 'var(--space-2) var(--space-4)',
      fontSize: 'var(--font-sm)',
      fontWeight: 600,
      cursor: 'pointer',
      border: 'none',
      background: active ? 'var(--color-accent)' : 'var(--color-bgElevated)',
      color: active ? '#fff' : 'var(--color-textSecondary)',
      transition: 'all var(--transition-fast)',
      fontFamily: 'inherit',
    }) as React.CSSProperties,
  weekGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '1px',
    background: 'var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    border: '1px solid var(--color-border)',
  } as React.CSSProperties,
  dayHeader: {
    padding: 'var(--space-3) var(--space-2)',
    textAlign: 'center' as const,
    fontSize: 'var(--font-xs)',
    fontWeight: 600,
    color: 'var(--color-textMuted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    background: 'var(--color-bgElevated)',
  } as React.CSSProperties,
  dayCol: (isToday: boolean) =>
    ({
      background: 'var(--color-bgSecondary)',
      minHeight: '180px',
      padding: 'var(--space-3)',
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 'var(--space-2)',
      position: 'relative' as const,
      borderTop: isToday ? '3px solid var(--color-accent)' : 'none',
    }) as React.CSSProperties,
  dayLabel: (isToday: boolean) =>
    ({
      fontSize: 'var(--font-sm)',
      fontWeight: isToday ? 700 : 500,
      color: isToday ? 'var(--color-accent)' : 'var(--color-textSecondary)',
      marginBottom: 'var(--space-1)',
    }) as React.CSSProperties,
  slotCard: (type: EditorialSlot['type']) =>
    ({
      padding: 'var(--space-2) var(--space-3)',
      borderRadius: 'var(--radius-sm)',
      background: SLOT_TYPE_BG[type],
      borderLeft: `3px solid ${SLOT_TYPE_COLOR[type]}`,
      fontSize: 'var(--font-xs)',
      cursor: 'grab',
      transition: 'box-shadow var(--transition-fast)',
    }) as React.CSSProperties,
  slotName: {
    fontWeight: 600,
    color: 'var(--color-textPrimary)',
    marginBottom: '2px',
    lineHeight: 1.3,
  } as React.CSSProperties,
  slotMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    marginTop: '2px',
  } as React.CSSProperties,
  campaignLink: {
    fontSize: '9px',
    fontWeight: 600,
    color: 'var(--color-accent)',
    marginTop: '2px',
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
  } as React.CSSProperties,
  addBtn: {
    padding: 'var(--space-1) var(--space-2)',
    borderRadius: 'var(--radius-sm)',
    border: '1px dashed var(--color-border)',
    background: 'none',
    color: 'var(--color-textMuted)',
    fontSize: 'var(--font-xs)',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
    width: '100%',
    textAlign: 'center' as const,
    marginTop: 'auto',
    fontFamily: 'inherit',
  } as React.CSSProperties,
  legend: {
    display: 'flex',
    gap: 'var(--space-5)',
    marginTop: 'var(--space-5)',
    justifyContent: 'center',
  } as React.CSSProperties,
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    fontSize: 'var(--font-xs)',
    color: 'var(--color-textSecondary)',
  } as React.CSSProperties,
  legendDot: (color: string) =>
    ({
      width: '10px',
      height: '10px',
      borderRadius: '2px',
      background: color,
      flexShrink: 0,
    }) as React.CSSProperties,
  // Modal styles
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  } as React.CSSProperties,
  modal: {
    background: 'var(--color-bgSecondary)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-xl)',
    padding: 'var(--space-8)',
    width: '100%',
    maxWidth: '440px',
    boxShadow: 'var(--shadow-xl)',
  } as React.CSSProperties,
  formGroup: {
    marginBottom: 'var(--space-4)',
  } as React.CSSProperties,
  formLabel: {
    display: 'block',
    fontSize: 'var(--font-sm)',
    fontWeight: 600,
    color: 'var(--color-textPrimary)',
    marginBottom: 'var(--space-2)',
  } as React.CSSProperties,
  formInput: {
    width: '100%',
    padding: 'var(--space-3) var(--space-4)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-bgElevated)',
    color: 'var(--color-textPrimary)',
    fontSize: 'var(--font-sm)',
    outline: 'none',
    fontFamily: 'inherit',
  } as React.CSSProperties,
  formActions: {
    display: 'flex',
    gap: 'var(--space-3)',
    justifyContent: 'flex-end',
    marginTop: 'var(--space-6)',
  } as React.CSSProperties,
  errorBanner: {
    padding: 'var(--space-4)',
    background: 'var(--color-errorMuted)',
    color: 'var(--color-error)',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--font-sm)',
    marginBottom: 'var(--space-6)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  } as React.CSSProperties,
  monthDayCol: (isToday: boolean, isCurrentMonth: boolean) =>
    ({
      background: isCurrentMonth ? 'var(--color-bgSecondary)' : 'var(--color-bgPrimary)',
      minHeight: '110px',
      padding: 'var(--space-2)',
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '2px',
      position: 'relative' as const,
      opacity: isCurrentMonth ? 1 : 0.4,
      borderTop: isToday ? '3px solid var(--color-accent)' : 'none',
    }) as React.CSSProperties,
} as const;

/* ─── Component ────────────────────────────────────────────────────────────── */

export default function EditorialCalendar() {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());

  // Add slot form
  const [addingForDate, setAddingForDate] = useState<string | null>(null);
  const [formData, setFormData] = useState<SlotFormData>({
    restaurantName: '',
    type: 'organic',
    notes: '',
  });

  // Drag state
  const [draggedSlot, setDraggedSlot] = useState<EditorialSlot | null>(null);

  // Data fetching
  const { data: slots = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['editorialSlots'],
    queryFn: async () => {
      if (isDemoMode()) return DEMO_EDITORIAL_SLOTS;
      const res = await api.get<EditorialSlot[]>('/api/spotops/calendar');
      if (res.error) throw new Error(res.error);
      return res.data ?? [];
    },
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ['calendarCampaigns'],
    queryFn: async () => {
      if (isDemoMode()) return DEMO_CAMPAIGNS.map(c => ({ campaignId: c.campaignId, restaurantName: c.restaurantName, status: c.status }));
      const res = await api.get<Array<{ campaignId: string; restaurantName: string; status?: string }>>('/api/campaigns');
      return res.data ?? [];
    },
  });

  const campaignMap = useMemo(() => {
    const map = new Map<string, string>();
    campaigns.forEach(c => map.set(c.campaignId, c.restaurantName));
    return map;
  }, [campaigns]);

  // Add slot mutation
  const addSlotMutation = useMutation({
    mutationFn: async (newSlot: Partial<EditorialSlot>) => {
      if (isDemoMode()) {
        return {
          slotId: `local-${Date.now()}`,
          date: newSlot.date!,
          restaurantName: newSlot.restaurantName!,
          type: newSlot.type!,
          status: 'planned' as const,
          notes: newSlot.notes,
          campaignId: newSlot.campaignId,
        };
      }
      const res = await api.post<EditorialSlot>('/api/spotops/calendar', newSlot);
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    onSuccess: (data) => {
      queryClient.setQueryData<EditorialSlot[]>(['editorialSlots'], (old) => [...(old ?? []), data]);
      setAddingForDate(null);
      setFormData({ restaurantName: '', type: 'organic', notes: '' });
    },
  });

  /* ─── Date Navigation ──────────────────────────────────────────────────── */

  const navigate = (dir: -1 | 1) => {
    setCurrentDate((d) => {
      const n = new Date(d);
      if (viewMode === 'week') {
        n.setDate(n.getDate() + dir * 7);
      } else {
        n.setMonth(n.getMonth() + dir);
      }
      return n;
    });
  };

  const goToday = () => setCurrentDate(new Date());

  /* ─── Week / Month days ────────────────────────────────────────────────── */

  const today = new Date();

  const weekDays = useMemo(() => {
    const start = getWeekStart(currentDate);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [currentDate]);

  const monthDays = useMemo(() => {
    const monthStart = getMonthStart(currentDate);
    const calStart = getWeekStart(monthStart);
    return Array.from({ length: 42 }, (_, i) => addDays(calStart, i));
  }, [currentDate]);

  const slotsForDate = useCallback(
    (date: Date): EditorialSlot[] => {
      const dateStr = formatDateISO(date);
      return slots.filter((s) => s.date === dateStr);
    },
    [slots]
  );

  /* ─── Drag & Drop ──────────────────────────────────────────────────────── */

  const handleDrop = (day: Date) => {
    if (!draggedSlot) return;
    const newDate = formatDateISO(day);
    if (draggedSlot.date === newDate) {
      setDraggedSlot(null);
      return;
    }
    // Optimistic update
    queryClient.setQueryData<EditorialSlot[]>(['editorialSlots'], (old) =>
      (old ?? []).map(s => s.slotId === draggedSlot.slotId ? { ...s, date: newDate } : s)
    );
    // Persist
    if (!isDemoMode()) {
      api.put(`/api/spotops/calendar/${draggedSlot.slotId}`, { date: newDate });
    }
    setDraggedSlot(null);
  };

  /* ─── Summary Stats ──────────────────────────────────────────────────── */

  const stats = useMemo(() => {
    const todayStr = formatDateISO(today);
    const thisWeekStart = getWeekStart(today);
    const thisWeekEnd = addDays(thisWeekStart, 7);

    const upcoming = slots.filter(s => s.date >= todayStr && s.status !== 'published').length;
    const published = slots.filter(s => s.status === 'published').length;
    const thisWeek = slots.filter(s => {
      const d = new Date(s.date + 'T12:00:00');
      return d >= thisWeekStart && d < thisWeekEnd;
    }).length;
    const sponsored = slots.filter(s => s.type === 'sponsored').length;
    const organic = slots.filter(s => s.type === 'organic').length;
    const linkedToCampaign = slots.filter(s => s.campaignId).length;

    return { upcoming, published, thisWeek, sponsored, organic, linkedToCampaign };
  }, [slots]);

  /* ─── Add Slot ─────────────────────────────────────────────────────────── */

  const handleAddSlot = async () => {
    if (!addingForDate || !formData.restaurantName.trim()) return;
    addSlotMutation.mutate({
      date: addingForDate,
      restaurantName: formData.restaurantName.trim(),
      type: formData.type,
      status: 'planned',
      notes: formData.notes.trim() || undefined,
      campaignId: formData.campaignId || undefined,
    });
  };

  /* ─── Period Label ─────────────────────────────────────────────────────── */

  const periodLabel =
    viewMode === 'week'
      ? `${formatDateShort(weekDays[0])} – ${formatDateShort(weekDays[6])}`
      : formatMonthYear(currentDate);

  /* ─── Loading ──────────────────────────────────────────────────────────── */

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="page-header">
          <div className="skeleton" style={{ width: '220px', height: '32px', marginBottom: 'var(--space-3)' }} />
          <div className="skeleton" style={{ width: '200px', height: '18px' }} />
        </div>
        <div style={styles.statsRow}>
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="skeleton" style={{ height: '80px', borderRadius: 'var(--radius-lg)' }} />
          ))}
        </div>
        <div className="skeleton" style={{ height: '400px', borderRadius: 'var(--radius-lg)' }} />
      </div>
    );
  }

  /* ─── Slot Card Renderer ───────────────────────────────────────────────── */

  const renderSlot = (slot: EditorialSlot) => {
    const linkedCampaign = slot.campaignId ? campaignMap.get(slot.campaignId) : null;
    return (
      <div
        key={slot.slotId}
        draggable
        style={{
          ...styles.slotCard(slot.type),
          opacity: draggedSlot?.slotId === slot.slotId ? 0.4 : 1,
        }}
        title={slot.notes || slot.restaurantName || 'Slot'}
        onDragStart={(e) => {
          setDraggedSlot(slot);
          e.dataTransfer!.effectAllowed = 'move';
        }}
        onDragEnd={() => setDraggedSlot(null)}
        onMouseEnter={(e) => {
          if (draggedSlot?.slotId !== slot.slotId) {
            e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        <div style={styles.slotName}>{slot.restaurantName ?? 'TBD'}</div>
        <div style={styles.slotMeta}>
          <span
            style={{
              fontSize: '10px',
              fontWeight: 600,
              textTransform: 'uppercase',
              color: SLOT_TYPE_COLOR[slot.type],
            }}
          >
            {slot.type}
          </span>
          <span className={`badge ${STATUS_BADGE_CLASS[slot.status]}`} style={{ fontSize: '10px', padding: '1px 6px' }}>
            {slot.status}
          </span>
        </div>
        {linkedCampaign && (
          <div style={styles.campaignLink}>
            <span>🔗</span> {linkedCampaign}
          </div>
        )}
      </div>
    );
  };

  /* ─── Render ───────────────────────────────────────────────────────────── */

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Editorial Calendar</h1>
        <p className="page-subtitle">Plan and track your content schedule across campaigns</p>
      </div>

      {/* Error */}
      {isError && (
        <div style={styles.errorBanner}>
          <span>{(error as Error)?.message || 'Failed to load calendar'}</span>
          <button className="btn btn-ghost" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      )}

      {/* Summary Stats */}
      {slots.length > 0 && (
        <div style={styles.statsRow}>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{stats.thisWeek}</div>
            <div style={styles.statLabel}>This Week</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{stats.upcoming}</div>
            <div style={styles.statLabel}>Upcoming</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{stats.published}</div>
            <div style={styles.statLabel}>Published</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{stats.sponsored}</div>
            <div style={styles.statLabel}>Sponsored</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{stats.linkedToCampaign}</div>
            <div style={styles.statLabel}>Campaign-Linked</div>
          </div>
        </div>
      )}

      {/* Guidance Callout */}
      {slots.length > 0 && slots.length < 5 && (
        <div style={styles.guidance}>
          <span style={{ fontSize: 'var(--font-xl)' }}>📅</span>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--color-textPrimary)', marginBottom: 'var(--space-1)', fontSize: 'var(--font-sm)' }}>
              Plan your content cadence
            </div>
            <div style={{ fontSize: 'var(--font-sm)', color: 'var(--color-textSecondary)', lineHeight: 1.5 }}>
              Drag slots between days to reschedule. Link slots to active campaigns so you can track which content ties to which partnership.
              Consistency matters — creators who post 3+ times/week see 2x higher engagement.
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div style={styles.header}>
        <div style={styles.navRow}>
          <button style={styles.navBtn} onClick={() => navigate(-1)} aria-label="Previous period">
            ←
          </button>
          <button style={styles.navBtn} onClick={goToday}>
            Today
          </button>
          <button style={styles.navBtn} onClick={() => navigate(1)} aria-label="Next period">
            →
          </button>
          <span style={styles.currentLabel}>{periodLabel}</span>
        </div>

        <div style={styles.viewToggle}>
          <button style={styles.viewBtn(viewMode === 'week')} onClick={() => setViewMode('week')}>
            Week
          </button>
          <button style={styles.viewBtn(viewMode === 'month')} onClick={() => setViewMode('month')}>
            Month
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div style={styles.weekGrid}>
        {/* Day headers */}
        {DAY_NAMES.map((name) => (
          <div key={name} style={styles.dayHeader}>
            {name}
          </div>
        ))}

        {/* Day columns */}
        {viewMode === 'week'
          ? weekDays.map((day) => {
              const isToday = isSameDay(day, today);
              const daySlots = slotsForDate(day);
              return (
                <div
                  key={day.toISOString()}
                  style={styles.dayCol(isToday)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.style.background = 'color-mix(in srgb, var(--color-accent) 10%, var(--color-bgSecondary))';
                  }}
                  onDragLeave={(e) => {
                    e.currentTarget.style.background = '';
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.style.background = '';
                    handleDrop(day);
                  }}
                >
                  <div style={styles.dayLabel(isToday)}>{formatDateShort(day)}</div>
                  {daySlots.map(renderSlot)}
                  <button
                    style={styles.addBtn}
                    onClick={() => setAddingForDate(formatDateISO(day))}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-accent)';
                      e.currentTarget.style.color = 'var(--color-accent)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-border)';
                      e.currentTarget.style.color = 'var(--color-textMuted)';
                    }}
                  >
                    + Add Slot
                  </button>
                </div>
              );
            })
          : monthDays.map((day) => {
              const isToday = isSameDay(day, today);
              const isCurrentMonth = day.getMonth() === currentDate.getMonth();
              const daySlots = slotsForDate(day);
              return (
                <div
                  key={day.toISOString()}
                  style={styles.monthDayCol(isToday, isCurrentMonth)}
                  onDragOver={(e) => {
                    if (isCurrentMonth) {
                      e.preventDefault();
                      e.currentTarget.style.background = 'color-mix(in srgb, var(--color-accent) 10%, var(--color-bgSecondary))';
                    }
                  }}
                  onDragLeave={(e) => {
                    e.currentTarget.style.background = '';
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.style.background = '';
                    if (isCurrentMonth) handleDrop(day);
                  }}
                >
                  <div style={styles.dayLabel(isToday)}>{day.getDate()}</div>
                  {daySlots.slice(0, 2).map(renderSlot)}
                  {daySlots.length > 2 && (
                    <div style={{ fontSize: '10px', color: 'var(--color-textMuted)', textAlign: 'center' }}>
                      +{daySlots.length - 2} more
                    </div>
                  )}
                  {isCurrentMonth && (
                    <button
                      style={{ ...styles.addBtn, fontSize: '10px', padding: '1px' }}
                      onClick={() => setAddingForDate(formatDateISO(day))}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--color-accent)';
                        e.currentTarget.style.color = 'var(--color-accent)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--color-border)';
                        e.currentTarget.style.color = 'var(--color-textMuted)';
                      }}
                    >
                      +
                    </button>
                  )}
                </div>
              );
            })}
      </div>

      {/* Legend */}
      <div style={styles.legend}>
        {(['sponsored', 'organic', 'reshoot'] as const).map((type) => (
          <div key={type} style={styles.legendItem}>
            <div style={styles.legendDot(SLOT_TYPE_COLOR[type])} />
            <span style={{ textTransform: 'capitalize' }}>{type}</span>
          </div>
        ))}
      </div>

      {/* Add Slot Modal */}
      {addingForDate && (
        <div
          style={styles.overlay}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setAddingForDate(null);
              setFormData({ restaurantName: '', type: 'organic', notes: '' });
            }
          }}
        >
          <div style={styles.modal}>
            <h2 style={{ fontSize: 'var(--font-xl)', fontWeight: 700, marginBottom: 'var(--space-5)' }}>
              Add Content Slot
            </h2>
            <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-textSecondary)', marginBottom: 'var(--space-6)' }}>
              {new Date(addingForDate + 'T12:00:00').toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </p>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Restaurant</label>
              <input
                type="text"
                style={styles.formInput}
                placeholder="Restaurant name..."
                value={formData.restaurantName}
                onChange={(e) => setFormData((f) => ({ ...f, restaurantName: e.target.value }))}
                autoFocus
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Link to Campaign (optional)</label>
              <StyledSelect
                value={formData.campaignId || ''}
                onChange={(v) => {
                  const cId = v;
                  setFormData(f => ({
                    ...f,
                    campaignId: cId || undefined,
                    restaurantName: cId ? (campaigns.find(c => c.campaignId === cId)?.restaurantName || f.restaurantName) : f.restaurantName,
                  }));
                }}
                placeholder="No campaign"
                options={[
                  { value: '', label: 'No campaign' },
                  ...campaigns.map(c => ({
                    value: c.campaignId,
                    label: c.restaurantName + (c.status ? ` (${c.status})` : ''),
                    icon: '🔗',
                  })),
                ]}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Content Type</label>
              <StyledSelect
                value={formData.type}
                onChange={(v) => setFormData((f) => ({ ...f, type: v as EditorialSlot['type'] }))}
                options={[
                  { value: 'sponsored', label: 'Sponsored', icon: '💰' },
                  { value: 'organic', label: 'Organic', icon: '🌿' },
                  { value: 'reshoot', label: 'Reshoot', icon: '🔄' },
                ]}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Notes</label>
              <textarea
                style={{ ...styles.formInput, minHeight: '80px', resize: 'vertical' }}
                placeholder="Any notes for this shoot..."
                value={formData.notes}
                onChange={(e) => setFormData((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>

            <div style={styles.formActions}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setAddingForDate(null);
                  setFormData({ restaurantName: '', type: 'organic', notes: '' });
                }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleAddSlot}
                disabled={!formData.restaurantName.trim() || addSlotMutation.isPending}
              >
                {addSlotMutation.isPending ? 'Saving...' : 'Add Slot'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
