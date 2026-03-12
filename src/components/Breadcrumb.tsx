import { Link, useLocation } from 'react-router-dom';

interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

/**
 * Simple breadcrumb navigation for nested pages.
 * Usage: <Breadcrumb items={[{ label: 'Restaurants', to: '/app/restaurants' }, { label: restaurant.name }]} />
 */
export function Breadcrumb({ items }: BreadcrumbProps) {
  const location = useLocation();

  return (
    <nav
      aria-label="Breadcrumb"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        fontSize: 'var(--font-sm)',
        color: 'var(--color-textMuted)',
        marginBottom: 'var(--space-4)',
        flexWrap: 'wrap',
      }}
    >
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        const isActive = item.to === location.pathname;

        return (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            {i > 0 && (
              <span style={{ color: 'var(--color-textMuted)', opacity: 0.5 }}>/</span>
            )}
            {item.to && !isLast ? (
              <Link
                to={item.to}
                style={{
                  color: isActive ? 'var(--color-accent)' : 'var(--color-textMuted)',
                  textDecoration: 'none',
                  transition: 'color 0.15s ease',
                }}
                onMouseOver={(e) => { (e.target as HTMLElement).style.color = 'var(--color-accent)'; }}
                onMouseOut={(e) => {
                  if (!isActive) (e.target as HTMLElement).style.color = 'var(--color-textMuted)';
                }}
              >
                {item.label}
              </Link>
            ) : (
              <span style={{ color: isLast ? 'var(--color-textPrimary)' : 'var(--color-textMuted)', fontWeight: isLast ? 500 : 400 }}>
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
