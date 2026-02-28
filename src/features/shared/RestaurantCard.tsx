import { Link } from 'react-router-dom';
import type { Restaurant } from '../../types';

interface Props {
  restaurant: Restaurant;
  onSave?: (id: string) => void;
  showPartnerBadge?: boolean;
}

const priceLabels = ['', '$', '$$', '$$$', '$$$$'];

const gradients = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
];

export default function RestaurantCard({ restaurant, onSave, showPartnerBadge = true }: Props) {
  const gradient = gradients[restaurant.name.length % gradients.length];

  return (
    <Link
      to={`/app/restaurants/${restaurant.restaurantId}`}
      className="card"
      style={{ padding: 0, overflow: 'hidden', textDecoration: 'none', color: 'inherit' }}
    >
      <div
        style={{
          height: 160,
          background: restaurant.photos[0]
            ? `url(${restaurant.photos[0]}) center/cover`
            : gradient,
          position: 'relative',
        }}
      >
        {showPartnerBadge && restaurant.isPartner && (
          <span
            className="badge badge--accent"
            style={{ position: 'absolute', top: 'var(--space-3)', right: 'var(--space-3)' }}
          >
            Partner
          </span>
        )}
        {restaurant.spotRating && (
          <span
            style={{
              position: 'absolute',
              bottom: 'var(--space-3)',
              left: 'var(--space-3)',
              background: 'rgba(0,0,0,0.7)',
              color: '#fff',
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--font-sm)',
              fontWeight: 600,
            }}
          >
            {restaurant.spotRating.toFixed(1)} / 5
          </span>
        )}
      </div>

      <div style={{ padding: 'var(--space-4)' }}>
        <h3
          style={{
            fontSize: 'var(--font-base)',
            fontWeight: 600,
            marginBottom: 'var(--space-1)',
            color: 'var(--color-textPrimary)',
          }}
        >
          {restaurant.name}
        </h3>

        <div
          style={{
            fontSize: 'var(--font-sm)',
            color: 'var(--color-textSecondary)',
            marginBottom: 'var(--space-2)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}
        >
          <span>{restaurant.neighborhood}</span>
          <span style={{ color: 'var(--color-textMuted)' }}>·</span>
          <span style={{ color: 'var(--color-accent)' }}>
            {priceLabels[restaurant.priceLevel]}
          </span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' }}>
          {restaurant.cuisine.slice(0, 3).map((c) => (
            <span
              key={c}
              style={{
                fontSize: 'var(--font-xs)',
                background: 'var(--color-bgElevated)',
                color: 'var(--color-textSecondary)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
              }}
            >
              {c}
            </span>
          ))}
        </div>

        {onSave && (
          <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 'var(--space-2)' }}>
            <button
              className="btn btn-ghost"
              style={{ fontSize: 'var(--font-xs)', padding: '4px 8px' }}
              onClick={(e) => {
                e.preventDefault();
                onSave(restaurant.restaurantId);
              }}
            >
              Save
            </button>
          </div>
        )}
      </div>
    </Link>
  );
}
