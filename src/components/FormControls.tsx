import { useState, useRef, useEffect, useCallback } from 'react';

/* ─── StyledSelect ──────────────────────────────────────────────────────────
 * Custom dropdown that replaces native <select> with a polished overlay.
 * Accepts the same value/onChange/options pattern but renders a branded menu.
 * ──────────────────────────────────────────────────────────────────────────── */

export interface SelectOption {
  value: string;
  label: string;
  subtitle?: string;
  icon?: string;
  disabled?: boolean;
}

interface StyledSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  /** Full-width by default */
  style?: React.CSSProperties;
}

export function StyledSelect({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  disabled = false,
  size = 'md',
  style,
}: StyledSelectProps) {
  const [open, setOpen] = useState(false);
  const [focusIdx, setFocusIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

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

  // Scroll focused item into view
  useEffect(() => {
    if (!open || focusIdx < 0 || !listRef.current) return;
    const items = listRef.current.children;
    if (items[focusIdx]) {
      (items[focusIdx] as HTMLElement).scrollIntoView({ block: 'nearest' });
    }
  }, [focusIdx, open]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;
      if (!open) {
        if (['Enter', ' ', 'ArrowDown'].includes(e.key)) {
          e.preventDefault();
          setOpen(true);
          const idx = options.findIndex((o) => o.value === value);
          setFocusIdx(idx >= 0 ? idx : 0);
        }
        return;
      }
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          setOpen(false);
          break;
        case 'ArrowDown':
          e.preventDefault();
          setFocusIdx((i) => {
            let next = i + 1;
            while (next < options.length && options[next]?.disabled) next++;
            return next < options.length ? next : i;
          });
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusIdx((i) => {
            let next = i - 1;
            while (next >= 0 && options[next]?.disabled) next--;
            return next >= 0 ? next : i;
          });
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (focusIdx >= 0 && focusIdx < options.length && !options[focusIdx]?.disabled) {
            onChange(options[focusIdx].value);
            setOpen(false);
          }
          break;
      }
    },
    [open, focusIdx, options, value, onChange, disabled]
  );

  const isSm = size === 'sm';
  const pad = isSm ? 'var(--space-2) var(--space-3)' : 'var(--space-3) var(--space-4)';
  const fontSize = isSm ? 'var(--font-xs)' : 'var(--font-sm)';

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%', ...style }}
      onKeyDown={handleKeyDown}
    >
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        role="combobox"
        aria-expanded={open}
        onClick={() => {
          if (!disabled) {
            setOpen(!open);
            if (!open) {
              const idx = options.findIndex((o) => o.value === value);
              setFocusIdx(idx >= 0 ? idx : 0);
            }
          }
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
          color: selected ? 'var(--color-textPrimary)' : 'var(--color-textMuted)',
          fontSize,
          fontFamily: 'inherit',
          cursor: disabled ? 'not-allowed' : 'pointer',
          outline: 'none',
          transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
          boxShadow: open ? '0 0 0 3px var(--color-accentMuted)' : 'none',
          opacity: disabled ? 0.6 : 1,
          boxSizing: 'border-box',
          textAlign: 'left',
          gap: 'var(--space-2)',
        }}
      >
        <span
          style={{
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}
        >
          {selected?.icon && <span style={{ flexShrink: 0 }}>{selected.icon}</span>}
          {selected ? selected.label : placeholder}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          style={{
            flexShrink: 0,
            transition: 'transform 0.15s ease',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          <path
            d="M3 4.5L6 7.5L9 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Dropdown menu */}
      {open && (
        <div
          ref={listRef}
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            maxHeight: '240px',
            overflowY: 'auto',
            background: 'var(--color-bgSecondary)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 1050,
            padding: 'var(--space-1)',
          }}
        >
          {options.map((opt, i) => {
            const isActive = opt.value === value;
            const isFocused = i === focusIdx;
            return (
              <div
                key={opt.value}
                role="option"
                aria-selected={isActive}
                onMouseEnter={() => setFocusIdx(i)}
                onClick={() => {
                  if (!opt.disabled) {
                    onChange(opt.value);
                    setOpen(false);
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  padding: isSm ? 'var(--space-2) var(--space-3)' : 'var(--space-2) var(--space-4)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize,
                  cursor: opt.disabled ? 'not-allowed' : 'pointer',
                  color: opt.disabled
                    ? 'var(--color-textMuted)'
                    : isActive
                      ? 'var(--color-accent)'
                      : 'var(--color-textPrimary)',
                  fontWeight: isActive ? 600 : 400,
                  background: isFocused
                    ? 'var(--color-bgElevated)'
                    : 'transparent',
                  opacity: opt.disabled ? 0.5 : 1,
                  transition: 'background 0.1s ease',
                }}
              >
                {opt.icon && <span style={{ flexShrink: 0 }}>{opt.icon}</span>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {opt.label}
                  </div>
                  {opt.subtitle && (
                    <div
                      style={{
                        fontSize: 'var(--font-xs)',
                        color: 'var(--color-textMuted)',
                        marginTop: '1px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {opt.subtitle}
                    </div>
                  )}
                </div>
                {isActive && (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                    <path
                      d="M3 7L6 10L11 4"
                      stroke="var(--color-accent)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
            );
          })}
          {options.length === 0 && (
            <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--color-textMuted)', fontSize }}>
              No options available
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── StyledDatePicker ──────────────────────────────────────────────────────
 * A wrapper around <input type="date"> with consistent styling and a
 * visual calendar icon. Falls back gracefully in all browsers.
 * ──────────────────────────────────────────────────────────────────────────── */

interface StyledDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  style?: React.CSSProperties;
}

export function StyledDatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  min,
  max,
  disabled = false,
  size = 'md',
  style,
}: StyledDatePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
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

  return (
    <div style={{ position: 'relative', width: '100%', ...style }}>
      {/* Visual display */}
      <button
        type="button"
        disabled={disabled}
        aria-label={placeholder}
        onClick={() => inputRef.current?.showPicker?.()}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: pad,
          background: disabled ? 'var(--color-bgPrimary)' : 'var(--color-bgElevated)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          color: value ? 'var(--color-textPrimary)' : 'var(--color-textMuted)',
          fontSize,
          fontFamily: 'inherit',
          cursor: disabled ? 'not-allowed' : 'pointer',
          outline: 'none',
          transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
          opacity: disabled ? 0.6 : 1,
          boxSizing: 'border-box',
          textAlign: 'left',
        }}
        onFocus={() => inputRef.current?.showPicker?.()}
      >
        <span>{displayValue || placeholder}</span>
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
      {/* Hidden native date input — positioned behind the button for form semantics */}
      <input
        ref={inputRef}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min}
        max={max}
        disabled={disabled}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          opacity: 0,
          cursor: 'pointer',
          boxSizing: 'border-box',
        }}
        tabIndex={-1}
      />
      {/* Clear button when a value is set */}
      {value && !disabled && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onChange('');
          }}
          style={{
            position: 'absolute',
            right: isSm ? '28px' : '36px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            color: 'var(--color-textMuted)',
            cursor: 'pointer',
            fontSize: '14px',
            lineHeight: 1,
            padding: '2px',
          }}
          title="Clear date"
        >
          &times;
        </button>
      )}
    </div>
  );
}
