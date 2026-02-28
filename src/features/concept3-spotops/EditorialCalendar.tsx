import { useState, useEffect, useCallback, useMemo } from 'react';
import type { EditorialSlot } from '../../types';
import { api } from '../../services/ApiService';
import { isDemoMode, DEMO_EDITORIAL_SLOTS } from '../../data/demoData';

/* ─── Types ────────────────────────────────────────────────────────────────── */

type ViewMode = 'week' | 'month';

interface SlotFormData {
  restaurantName: string;
  type: EditorialSlot['type'];
  notes: string;
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
  const [slots, setSlots] = useState<EditorialSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());

  // Add slot form
  const [addingForDate, setAddingForDate] = useState<string | null>(null);
  const [formData, setFormData] = useState<SlotFormData>({
    restaurantName: '',
    type: 'organic',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const fetchSlots = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (isDemoMode) {
      setSlots(DEMO_EDITORIAL_SLOTS);
      setLoading(false);
      return;
    }

    const res = await api.get<EditorialSlot[]>('/api/spotops/calendar');
    if (res.error) {
      setError(res.error);
    }
    if (res.data && res.data.length > 0) {
      setSlots(res.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

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
    // Always show 6 weeks = 42 days for consistent grid
    return Array.from({ length: 42 }, (_, i) => addDays(calStart, i));
  }, [currentDate]);

  const slotsForDate = useCallback(
    (date: Date): EditorialSlot[] => {
      const dateStr = formatDateISO(date);
      return slots.filter((s) => s.date === dateStr);
    },
    [slots]
  );

  /* ─── Add Slot ─────────────────────────────────────────────────────────── */

  const handleAddSlot = async () => {
    if (!addingForDate || !formData.restaurantName.trim()) return;
    setSaving(true);

    const newSlot: Partial<EditorialSlot> = {
      date: addingForDate,
      restaurantName: formData.restaurantName.trim(),
      type: formData.type,
      status: 'planned',
      notes: formData.notes.trim() || undefined,
    };

    const res = await api.post<EditorialSlot>('/api/spotops/calendar', newSlot);
    if (res.data) {
      setSlots((prev) => [...prev, res.data!]);
    } else if (res.error) {
      // Optimistic: add locally anyway for MVP
      setSlots((prev) => [
        ...prev,
        {
          slotId: `local-${Date.now()}`,
          date: addingForDate,
          restaurantName: formData.restaurantName.trim(),
          type: formData.type,
          status: 'planned',
          notes: formData.notes.trim() || undefined,
        },
      ]);
    }

    setSaving(false);
    setAddingForDate(null);
    setFormData({ restaurantName: '', type: 'organic', notes: '' });
  };

  /* ─── Period Label ─────────────────────────────────────────────────────── */

  const periodLabel =
    viewMode === 'week'
      ? `${formatDateShort(weekDays[0])} - ${formatDateShort(weekDays[6])}`
      : formatMonthYear(currentDate);

  /* ─── Loading ──────────────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-header">
          <div className="skeleton" style={{ width: '220px', height: '32px', marginBottom: 'var(--space-3)' }} />
          <div className="skeleton" style={{ width: '200px', height: '18px' }} />
        </div>
        <div className="skeleton" style={{ height: '400px', borderRadius: 'var(--radius-lg)' }} />
      </div>
    );
  }

  /* ─── Slot Card Renderer ───────────────────────────────────────────────── */

  const renderSlot = (slot: EditorialSlot) => (
    <div
      key={slot.slotId}
      style={styles.slotCard(slot.type)}
      title={slot.notes || slot.restaurantName || 'Slot'}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
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
    </div>
  );

  /* ─── Render ───────────────────────────────────────────────────────────── */

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Editorial Calendar</h1>
        <p className="page-subtitle">Plan and track your content schedule</p>
      </div>

      {/* Error */}
      {error && (
        <div style={styles.errorBanner}>
          <span>{error}</span>
          <button className="btn btn-ghost" onClick={fetchSlots}>
            Retry
          </button>
        </div>
      )}

      {/* Controls */}
      <div style={styles.header}>
        <div style={styles.navRow}>
          <button style={styles.navBtn} onClick={() => navigate(-1)}>
            \u2190
          </button>
          <button style={styles.navBtn} onClick={goToday}>
            Today
          </button>
          <button style={styles.navBtn} onClick={() => navigate(1)}>
            \u2192
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
                <div key={day.toISOString()} style={styles.dayCol(isToday)}>
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
                <div key={day.toISOString()} style={styles.monthDayCol(isToday, isCurrentMonth)}>
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
              <label style={styles.formLabel}>Content Type</label>
              <select
                style={{ ...styles.formInput, cursor: 'pointer' }}
                value={formData.type}
                onChange={(e) => setFormData((f) => ({ ...f, type: e.target.value as EditorialSlot['type'] }))}
              >
                <option value="sponsored">Sponsored</option>
                <option value="organic">Organic</option>
                <option value="reshoot">Reshoot</option>
              </select>
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
                disabled={!formData.restaurantName.trim() || saving}
              >
                {saving ? 'Saving...' : 'Add Slot'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
