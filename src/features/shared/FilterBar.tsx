import { useState } from 'react';

interface FilterOption {
  value: string;
  label: string;
}

interface FilterGroup {
  key: string;
  label: string;
  options: FilterOption[];
  multi?: boolean;
}

interface Props {
  groups: FilterGroup[];
  values: Record<string, string[]>;
  onChange: (key: string, values: string[]) => void;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
}

export default function FilterBar({
  groups,
  values,
  onChange,
  searchPlaceholder = 'Search...',
  searchValue = '',
  onSearchChange,
}: Props) {
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  return (
    <div style={{ marginBottom: 'var(--space-5)' }}>
      {onSearchChange && (
        <input
          type="text"
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{
            width: '100%',
            padding: 'var(--space-3) var(--space-4)',
            background: 'var(--color-bgSecondary)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-textPrimary)',
            fontSize: 'var(--font-base)',
            marginBottom: 'var(--space-3)',
            outline: 'none',
          }}
        />
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        {groups.map((group) => (
          <div key={group.key} style={{ position: 'relative' }}>
            <button
              className="btn btn-secondary"
              style={{ fontSize: 'var(--font-xs)', padding: '4px 12px' }}
              onClick={() => setExpandedGroup(expandedGroup === group.key ? null : group.key)}
            >
              {group.label}
              {values[group.key]?.length > 0 && (
                <span
                  style={{
                    background: 'var(--color-accent)',
                    color: '#fff',
                    borderRadius: 'var(--radius-full)',
                    width: 16,
                    height: 16,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    marginLeft: 4,
                  }}
                >
                  {values[group.key].length}
                </span>
              )}
            </button>

            {expandedGroup === group.key && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: 4,
                  background: 'var(--color-bgElevated)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-2)',
                  zIndex: 50,
                  minWidth: 160,
                  boxShadow: 'var(--shadow-lg)',
                }}
              >
                {group.options.map((opt) => {
                  const isSelected = values[group.key]?.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      onClick={() => {
                        const current = values[group.key] || [];
                        const next = isSelected
                          ? current.filter((v) => v !== opt.value)
                          : group.multi
                          ? [...current, opt.value]
                          : [opt.value];
                        onChange(group.key, next);
                        if (!group.multi) setExpandedGroup(null);
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '6px 10px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 'var(--font-sm)',
                        color: isSelected ? 'var(--color-accent)' : 'var(--color-textSecondary)',
                        background: isSelected ? 'var(--color-accentMuted)' : 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}

        {Object.values(values).some((v) => v.length > 0) && (
          <button
            className="btn btn-ghost"
            style={{ fontSize: 'var(--font-xs)', padding: '4px 8px' }}
            onClick={() => {
              groups.forEach((g) => onChange(g.key, []));
            }}
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}
