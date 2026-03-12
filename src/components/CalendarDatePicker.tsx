import { useState, useRef, useEffect, useCallback, memo } from 'react';

/* ─── CalendarDatePicker ─────────────────────────────────────────────────────
 * A fully custom date picker with an inline month-grid calendar dropdown.
 * No native <input type="date"> — pure React with keyboard navigation.
 * ──────────────────────────────────────────────────────────────────────────── */

interface CalendarDatePickerProps {
  value: string;             // ISO date string "YYYY-MM-DD" or ""
  onChange: (value: string) => void;
  placeholder?: string;
  min?: string;              // ISO date string
  max?: string;              // ISO date string
  disabled?: boolean;
  size?: 'sm' | 'md';
  style?: React.CSSProperties;
}

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function parseDate(iso: string): { year: number; month: number; day: number } | null {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  return { year: y, month: m - 1, day: d };
}

function isSameDay(a: string, b: string): boolean {
  return a === b;
}

function isBeforeDate(date: string, min: string): boolean {
  return date < min;
}

function isAfterDate(date: string, max: string): boolean {
  return date > max;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

export const CalendarDatePicker = memo(function CalendarDatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  min,
  max,
  disabled = false,
  size = 'md',
  style,
}: CalendarDatePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calendar view state — start at the selected date or today
  const parsed = parseDate(value);
  const today = new Date();
  const [viewYear, setViewYear] = useState(parsed?.year ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.month ?? today.getMonth());

  // Sync calendar view when value changes externally
  useEffect(() => {
    const p = parseDate(value);
    if (p) {
      setViewYear(p.year);
      setViewMonth(p.month);
    }
  }, [value]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const isSm = size === 'sm';
  const pad = isSm ? 'var(--space-2) var(--space-3)' : 'var(--space-3) var(--space-4)';
  const fontSize = isSm ? 'var(--font-xs)' : 'var(--font-sm)';

  const displayValue = value
    ? new Date(value + 'T12:00:00').toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  const goToPrevMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }, []);

  const goToNextMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }, []);

  const handleSelect = useCallback(
    (dateStr: string) => {
      onChange(dateStr);
      setOpen(false);
    },
    [onChange],
  );

  // Build the calendar grid
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfWeek(viewYear, viewMonth);
  const prevMonthDays = getDaysInMonth(
    viewMonth === 0 ? viewYear - 1 : viewYear,
    viewMonth === 0 ? 11 : viewMonth - 1,
  );

  const cells: { day: number; dateStr: string; isCurrentMonth: boolean; isDisabled: boolean }[] = [];

  // Previous month trailing days
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const m = viewMonth === 0 ? 11 : viewMonth - 1;
    const y = viewMonth === 0 ? viewYear - 1 : viewYear;
    const dateStr = toDateStr(y, m, d);
    cells.push({
      day: d,
      dateStr,
      isCurrentMonth: false,
      isDisabled: (min ? isBeforeDate(dateStr, min) : false) || (max ? isAfterDate(dateStr, max) : false),
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = toDateStr(viewYear, viewMonth, d);
    cells.push({
      day: d,
      dateStr,
      isCurrentMonth: true,
      isDisabled: (min ? isBeforeDate(dateStr, min) : false) || (max ? isAfterDate(dateStr, max) : false),
    });
  }

  // Next month leading days to fill to 42 cells (6 rows)
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    const m = viewMonth === 11 ? 0 : viewMonth + 1;
    const y = viewMonth === 11 ? viewYear + 1 : viewYear;
    const dateStr = toDateStr(y, m, d);
    cells.push({
      day: d,
      dateStr,
      isCurrentMonth: false,
      isDisabled: (min ? isBeforeDate(dateStr, min) : false) || (max ? isAfterDate(dateStr, max) : false),
    });
  }

  // Keyboard handling for the trigger
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;
      if (['Enter', ' ', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    },
    [disabled],
  );

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', ...style }}>
      {/* Trigger button */}
      <button
        type="button"
        disabled={disabled}
        aria-label={placeholder}
        aria-expanded={open}
        aria-haspopup="dialog"
        onKeyDown={handleKeyDown}
        onClick={() => {
          if (!disabled) setOpen(!open);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: pad,
          background: disabled ? 'var(--color-bgPrimary)' : 'var(--color-bgElevated)',
          border: open ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          color: value ? 'var(--color-textPrimary)' : 'var(--color-textMuted)',
          fontSize,
          fontFamily: 'inherit',
          cursor: disabled ? 'not-allowed' : 'pointer',
          outline: 'none',
          transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
          boxShadow: open ? '0 0 0 3px var(--color-accentMuted)' : 'none',
          opacity: disabled ? 0.6 : 1,
          boxSizing: 'border-box',
          textAlign: 'left',
        }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayValue || placeholder}
        </span>

        {/* Clear button (inline) */}
        {value && !disabled && (
          <span
            role="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
            }}
            style={{
              marginRight: 'var(--space-2)',
              color: 'var(--color-textMuted)',
              cursor: 'pointer',
              fontSize: '14px',
              lineHeight: 1,
            }}
            title="Clear date"
          >
            &times;
          </span>
        )}

        {/* Calendar icon */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          style={{ flexShrink: 0, color: 'var(--color-textMuted)' }}
        >
          <rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.2" />
          <path d="M2 6.5H14" stroke="currentColor" strokeWidth="1.2" />
          <path d="M5.5 1.5V4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M10.5 1.5V4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="8" cy="10" r="1" fill="currentColor" />
        </svg>
      </button>

      {/* Calendar dropdown */}
      {open && (
        <div
          role="dialog"
          aria-label="Date picker calendar"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            zIndex: 1060,
            width: '280px',
            background: 'var(--color-bgSecondary)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)',
            padding: 'var(--space-3)',
            animation: 'fadeIn 0.15s ease',
          }}
        >
          {/* Month / Year header with nav arrows */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 'var(--space-3)',
            }}
          >
            <button
              type="button"
              onClick={goToPrevMonth}
              aria-label="Previous month"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 'var(--space-1)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-textSecondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bgElevated)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M9 3L5 7L9 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <span
              style={{
                fontWeight: 600,
                fontSize: 'var(--font-sm)',
                color: 'var(--color-textPrimary)',
                userSelect: 'none',
              }}
            >
              {MONTHS[viewMonth]} {viewYear}
            </span>

            <button
              type="button"
              onClick={goToNextMonth}
              aria-label="Next month"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 'var(--space-1)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-textSecondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bgElevated)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M5 3L9 7L5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          {/* Day-of-week headers */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '0px',
              marginBottom: 'var(--space-1)',
            }}
          >
            {DAYS.map((d) => (
              <div
                key={d}
                style={{
                  textAlign: 'center',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--color-textMuted)',
                  padding: 'var(--space-1) 0',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  userSelect: 'none',
                }}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div
            role="grid"
            aria-label={`${MONTHS[viewMonth]} ${viewYear}`}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '2px',
            }}
          >
            {cells.map((cell, i) => {
              const isSelected = isSameDay(cell.dateStr, value);
              const isToday = isSameDay(cell.dateStr, todayStr);
              return (
                <button
                  key={i}
                  type="button"
                  disabled={cell.isDisabled}
                  onClick={() => {
                    if (!cell.isDisabled) handleSelect(cell.dateStr);
                  }}
                  aria-label={new Date(cell.dateStr + 'T12:00:00').toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                  aria-selected={isSelected}
                  style={{
                    width: '34px',
                    height: '34px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 'var(--radius-full)',
                    border: isToday && !isSelected ? '1px solid var(--color-accent)' : '1px solid transparent',
                    background: isSelected
                      ? 'var(--color-accent)'
                      : 'transparent',
                    color: isSelected
                      ? '#fff'
                      : cell.isDisabled
                        ? 'var(--color-textMuted)'
                        : !cell.isCurrentMonth
                          ? 'var(--color-textMuted)'
                          : 'var(--color-textPrimary)',
                    fontSize: '13px',
                    fontWeight: isSelected || isToday ? 600 : 400,
                    cursor: cell.isDisabled ? 'not-allowed' : 'pointer',
                    opacity: cell.isDisabled ? 0.35 : !cell.isCurrentMonth ? 0.4 : 1,
                    transition: 'background 0.1s ease, color 0.1s ease',
                    outline: 'none',
                    fontFamily: 'inherit',
                    padding: 0,
                    margin: '0 auto',
                  }}
                  onMouseEnter={(e) => {
                    if (!cell.isDisabled && !isSelected) {
                      e.currentTarget.style.background = 'var(--color-bgElevated)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          {/* Today shortcut */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              marginTop: 'var(--space-3)',
              paddingTop: 'var(--space-2)',
              borderTop: '1px solid var(--color-border)',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setViewYear(today.getFullYear());
                setViewMonth(today.getMonth());
                handleSelect(todayStr);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-accent)',
                fontSize: 'var(--font-xs)',
                fontWeight: 600,
                cursor: 'pointer',
                padding: 'var(--space-1) var(--space-3)',
                borderRadius: 'var(--radius-full)',
                transition: 'background 0.15s ease',
                fontFamily: 'inherit',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-accentMuted)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

export default CalendarDatePicker;
