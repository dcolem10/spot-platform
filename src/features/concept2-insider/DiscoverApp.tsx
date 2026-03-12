import { useState, useMemo, useCallback, useEffect, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Restaurant, MembershipTier } from '../../types';
import { api } from '../../services/ApiService';
import { useAuth } from '../../hooks/useAuth';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';
import { isDemoMode, DEMO_RESTAURANTS } from '../../data/demoData';

// ─── Constants ────────────────────────────────────────────────────────────────

const CUISINE_OPTIONS = [
  'Italian', 'Japanese', 'Mexican', 'Thai', 'American',
  'Chinese', 'Indian', 'French', 'Mediterranean', 'Korean',
] as const;

const NEIGHBORHOOD_OPTIONS = [
  'Downtown', 'Midtown', 'East Side', 'West Side',
  'Uptown', 'Waterfront', 'Arts District', 'Old Town',
] as const;

const VIBE_OPTIONS = [
  'Date Night', 'Casual', 'Group Friendly', 'Late Night',
  'Brunch', 'Outdoor',
] as const;

const PRICE_LABELS: Record<number, string> = {
  1: '$',
  2: '$$',
  3: '$$$',
  4: '$$$$',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StarRating({ rating }: { rating: number }) {
  const stars = [];
  const rounded = Math.round(rating * 2) / 2;

  for (let i = 1; i <= 5; i++) {
    if (i <= rounded) {
      stars.push(
        <span key={i} style={{ color: 'var(--color-accent)' }} aria-hidden="true">
          &#9733;
        </span>
      );
    } else if (i - 0.5 === rounded) {
      stars.push(
        <span key={i} style={{ color: 'var(--color-accent)', opacity: 0.5 }} aria-hidden="true">
          &#9733;
        </span>
      );
    } else {
      stars.push(
        <span key={i} style={{ color: 'var(--color-textMuted)' }} aria-hidden="true">
          &#9733;
        </span>
      );
    }
  }

  return (
    <span
      role="img"
      aria-label={`${rating.toFixed(1)} out of 5 stars`}
      style={{ display: 'inline-flex', gap: '1px', fontSize: 'var(--font-sm)' }}
    >
      {stars}
      <span style={{ marginLeft: 'var(--space-1)', color: 'var(--color-textSecondary)', fontSize: 'var(--font-xs)' }}>
        {rating.toFixed(1)}
      </span>
    </span>
  );
}

interface FilterChipsProps {
  label: string;
  options: readonly string[];
  selected: string[];
  onToggle: (value: string) => void;
}

function FilterChips({ label, options, selected, onToggle }: FilterChipsProps) {
  return (
    <div style={{ marginBottom: 'var(--space-3)' }}>
      <span
        style={{
          fontSize: 'var(--font-xs)',
          fontWeight: 600,
          color: 'var(--color-textMuted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginRight: 'var(--space-3)',
        }}
      >
        {label}
      </span>
      <div
        style={{
          display: 'inline-flex',
          flexWrap: 'wrap',
          gap: 'var(--space-2)',
          marginTop: 'var(--space-1)',
        }}
      >
        {options.map((opt) => {
          const isActive = selected.includes(opt);
          return (
            <button
              key={opt}
              onClick={() => onToggle(opt)}
              className={isActive ? 'badge badge--accent' : 'badge'}
              style={{
                cursor: 'pointer',
                border: isActive ? 'none' : '1px solid var(--color-border)',
                background: isActive ? undefined : 'var(--color-bgElevated)',
                color: isActive ? undefined : 'var(--color-textSecondary)',
                transition: 'all var(--transition-fast)',
              }}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PhotoPlaceholder({ name }: { name: string }) {
  const gradients = [
    'linear-gradient(135deg, #f97316 0%, #ec4899 100%)',
    'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
    'linear-gradient(135deg, #22c55e 0%, #06b6d4 100%)',
    'linear-gradient(135deg, #eab308 0%, #f97316 100%)',
    'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
  ];
  const idx = name.charCodeAt(0) % gradients.length;

  return (
    <div
      style={{
        width: '100%',
        height: '180px',
        borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
        background: gradients[idx],
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 'var(--font-3xl)',
        fontWeight: 700,
        color: 'rgba(255,255,255,0.7)',
        letterSpacing: '0.05em',
      }}
      aria-hidden="true"
    >
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

interface RestaurantCardProps {
  restaurant: Restaurant;
  onSave: (id: string) => void;
}

const RestaurantCard = memo(function RestaurantCard({ restaurant, onSave }: RestaurantCardProps) {
  const primaryPhoto = restaurant.photos?.[0];

  return (
    <article
      className="card"
      style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
    >
      {/* Photo */}
      {primaryPhoto ? (
        <img
          src={primaryPhoto}
          alt={restaurant.name}
          style={{
            width: '100%',
            height: '180px',
            objectFit: 'cover',
            borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
          }}
        />
      ) : (
        <PhotoPlaceholder name={restaurant.name} />
      )}

      {/* Content */}
      <div style={{ padding: 'var(--space-4)', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
          <h3 style={{ fontSize: 'var(--font-lg)', fontWeight: 600, color: 'var(--color-textPrimary)' }}>
            {restaurant.name}
          </h3>
          <span
            style={{
              fontSize: 'var(--font-sm)',
              color: 'var(--color-textMuted)',
              fontWeight: 500,
              flexShrink: 0,
              marginLeft: 'var(--space-2)',
            }}
          >
            {PRICE_LABELS[restaurant.priceLevel]}
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-2)',
          }}
        >
          {restaurant.cuisine.slice(0, 2).map((c) => (
            <span key={c} className="badge badge--accent" style={{ fontSize: '0.65rem' }}>
              {c}
            </span>
          ))}
          <span
            style={{
              fontSize: 'var(--font-xs)',
              color: 'var(--color-textMuted)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
            }}
          >
            {restaurant.neighborhood}
          </span>
        </div>

        {restaurant.spotRating != null && (
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <StarRating rating={restaurant.spotRating} />
          </div>
        )}

        {/* Actions */}
        <div
          style={{
            display: 'flex',
            gap: 'var(--space-2)',
            marginTop: 'auto',
            paddingTop: 'var(--space-3)',
            borderTop: '1px solid var(--color-border)',
          }}
        >
          <button
            className="btn btn-ghost"
            style={{ flex: 1, fontSize: 'var(--font-xs)' }}
            onClick={() => onSave(restaurant.restaurantId)}
            aria-label={`Save ${restaurant.name}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
            Save
          </button>
          {restaurant.coords && (
            <a
              className="btn btn-ghost"
              style={{ flex: 1, fontSize: 'var(--font-xs)', textDecoration: 'none' }}
              href={`https://www.google.com/maps/dir/?api=1&destination=${restaurant.coords.lat},${restaurant.coords.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Directions to ${restaurant.name}`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="3 11 22 2 13 21 11 13 3 11" />
              </svg>
              Directions
            </a>
          )}
          {restaurant.reservationUrl && (
            <a
              className="btn btn-primary"
              style={{ flex: 1, fontSize: 'var(--font-xs)', textDecoration: 'none' }}
              href={restaurant.reservationUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Reserve at ${restaurant.name}`}
            >
              Reserve
            </a>
          )}
        </div>
      </div>
    </article>
  );
});

export function InsiderCTA() {
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, var(--color-accentMuted) 0%, var(--color-infoMuted) 100%)',
        border: '1px solid var(--color-accent)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-6) var(--space-8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 'var(--space-4)',
        marginBottom: 'var(--space-8)',
      }}
    >
      <div>
        <h3
          style={{
            fontSize: 'var(--font-xl)',
            fontWeight: 700,
            color: 'var(--color-textPrimary)',
            marginBottom: 'var(--space-1)',
          }}
        >
          Join Insider for exclusive deals
        </h3>
        <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-textSecondary)' }}>
          Get access to members-only discounts, early reservations, and AI-powered recommendations.
        </p>
      </div>
      <a className="btn btn-primary" href="/app/deals" style={{ textDecoration: 'none' }}>
        Become an Insider
      </a>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function DiscoverApp() {
  const { isAuthenticated } = useAuth();

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [membershipTier, setMembershipTier] = useState<MembershipTier>('free');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([]);
  const [selectedNeighborhoods, setSelectedNeighborhoods] = useState<string[]>([]);
  const [selectedVibes, setSelectedVibes] = useState<string[]>([]);

  const toggleFilter = useCallback(
    (setter: React.Dispatch<React.SetStateAction<string[]>>) =>
      (value: string) => {
        setter((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
      },
    []
  );

  // Fetch restaurants once on mount; filters are applied client-side in useMemo
  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setIsLoading(true);
      setError(null);

      if (isDemoMode()) {
        setRestaurants(DEMO_RESTAURANTS);
        setIsLoading(false);
        return;
      }

      const result = await api.get<{ items: Restaurant[]; nextPage?: string }>('/api/restaurants', { public: true });

      if (cancelled) return;

      // Backend returns paginated { items, nextPage } format
      const items = result.data?.items ?? [];
      if (result.status === 'success' && items.length > 0) {
        setRestaurants(items);
      } else if (result.error) {
        setError(result.error);
      }
      setIsLoading(false);
    }

    fetchData();
    return () => { cancelled = true; };
  }, []);

  // Fetch membership tier
  useEffect(() => {
    if (!isAuthenticated) {
      setMembershipTier('free');
      return;
    }

    let cancelled = false;

    async function fetchMembership() {
      const result = await api.get<{ tier: MembershipTier }>('/api/insider/membership');
      if (!cancelled && result.status === 'success' && result.data) {
        setMembershipTier(result.data.tier);
      }
    }

    fetchMembership();
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  // Client-side filter
  const filteredRestaurants = useMemo(() => {
    let list = restaurants;

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.cuisine.some((c) => c.toLowerCase().includes(q)) ||
          r.neighborhood.toLowerCase().includes(q) ||
          r.vibes.some((v) => v.toLowerCase().includes(q))
      );
    }

    // Cuisine filter
    if (selectedCuisines.length > 0) {
      list = list.filter((r) => r.cuisine.some((c) => selectedCuisines.includes(c)));
    }

    // Neighborhood filter
    if (selectedNeighborhoods.length > 0) {
      list = list.filter((r) => selectedNeighborhoods.includes(r.neighborhood));
    }

    // Vibe filter
    if (selectedVibes.length > 0) {
      list = list.filter((r) => r.vibes.some((v) => selectedVibes.includes(v)));
    }

    return list;
  }, [restaurants, searchQuery, selectedCuisines, selectedNeighborhoods, selectedVibes]);

  const navigate = useNavigate();

  const handleSave = useCallback(async (restaurantId: string) => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }
    await api.post('/api/insider/saved', { restaurantId });
  }, [isAuthenticated, navigate]);

  const clearAllFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedCuisines([]);
    setSelectedNeighborhoods([]);
    setSelectedVibes([]);
  }, []);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedCuisines.length > 0 ||
    selectedNeighborhoods.length > 0 ||
    selectedVibes.length > 0;

  return (
    <div className="page-container">
      {/* Hero */}
      <section
        style={{
          textAlign: 'center',
          paddingTop: 'var(--space-10)',
          paddingBottom: 'var(--space-8)',
        }}
      >
        <h1
          style={{
            fontSize: 'var(--font-4xl)',
            fontWeight: 700,
            color: 'var(--color-textPrimary)',
            marginBottom: 'var(--space-3)',
          }}
        >
          Discover Your Next Spot
        </h1>
        <p
          style={{
            fontSize: 'var(--font-lg)',
            color: 'var(--color-textSecondary)',
            maxWidth: '500px',
            margin: '0 auto var(--space-6)',
          }}
        >
          Curated restaurant picks from the people who actually eat there.
        </p>

        {/* Search bar */}
        <div
          style={{
            maxWidth: '600px',
            margin: '0 auto',
            position: 'relative',
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-textMuted)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              position: 'absolute',
              left: 'var(--space-4)',
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
            }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="What are you in the mood for?"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: 'var(--space-4) var(--space-4) var(--space-4) var(--space-10)',
              background: 'var(--color-bgSecondary)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-full)',
              color: 'var(--color-textPrimary)',
              fontSize: 'var(--font-base)',
              outline: 'none',
              transition: 'border-color var(--transition-fast)',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-accent)'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; }}
            aria-label="Search restaurants"
          />
        </div>
      </section>

      {/* Filter chips */}
      <section style={{ marginBottom: 'var(--space-6)' }}>
        <FilterChips
          label="Cuisine"
          options={CUISINE_OPTIONS}
          selected={selectedCuisines}
          onToggle={toggleFilter(setSelectedCuisines)}
        />
        <FilterChips
          label="Neighborhood"
          options={NEIGHBORHOOD_OPTIONS}
          selected={selectedNeighborhoods}
          onToggle={toggleFilter(setSelectedNeighborhoods)}
        />
        <FilterChips
          label="Vibe"
          options={VIBE_OPTIONS}
          selected={selectedVibes}
          onToggle={toggleFilter(setSelectedVibes)}
        />
        {hasActiveFilters && (
          <button
            className="btn btn-ghost"
            style={{ marginTop: 'var(--space-2)', fontSize: 'var(--font-xs)' }}
            onClick={clearAllFilters}
          >
            Clear all filters
          </button>
        )}
      </section>

      {/* Insider CTA for non-members */}
      {membershipTier === 'free' && <InsiderCTA />}

      {/* Restaurant grid */}
      <section>
        {isLoading ? (
          <div className="card-grid">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <LoadingSkeleton height="180px" borderRadius="var(--radius-lg) var(--radius-lg) 0 0" />
                <div style={{ padding: 'var(--space-4)' }}>
                  <LoadingSkeleton height="20px" width="70%" />
                  <div style={{ marginTop: 'var(--space-2)' }}>
                    <LoadingSkeleton height="14px" width="40%" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="empty-state">
            <h3>Something went wrong</h3>
            <p style={{ color: 'var(--color-error)' }}>{error}</p>
          </div>
        ) : filteredRestaurants.length === 0 ? (
          <div className="empty-state">
            <h3>No restaurants found</h3>
            <p>Try adjusting your search or filters to discover more spots.</p>
            {hasActiveFilters && (
              <button
                className="btn btn-secondary"
                style={{ marginTop: 'var(--space-4)' }}
                onClick={clearAllFilters}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--space-4)',
              }}
            >
              <span style={{ fontSize: 'var(--font-sm)', color: 'var(--color-textMuted)' }}>
                {filteredRestaurants.length} restaurant{filteredRestaurants.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="card-grid stagger-children">
              {filteredRestaurants.map((restaurant) => (
                <RestaurantCard
                  key={restaurant.restaurantId}
                  restaurant={restaurant}
                  onSave={handleSave}
                />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export default DiscoverApp;
