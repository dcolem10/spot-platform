import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../services/ApiService';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';
import { isDemoMode, DEMO_RESTAURANTS } from '../../data/demoData';
import type { Restaurant, RestaurantFilters } from '../../types';

const CUISINE_OPTIONS = [
  'Italian', 'Japanese', 'Mexican', 'Chinese', 'Thai', 'Indian',
  'French', 'Korean', 'Mediterranean', 'American', 'Vietnamese', 'Peruvian',
];

const PRICE_LABELS: Record<number, string> = { 1: '$', 2: '$$', 3: '$$$', 4: '$$$$' };

const GRADIENT_PALETTES = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
];

function getGradient(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return GRADIENT_PALETTES[Math.abs(hash) % GRADIENT_PALETTES.length];
}

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.5;
  const stars: string[] = [];
  for (let i = 0; i < full; i++) stars.push('\u2605');
  if (hasHalf) stars.push('\u00BD');
  return (
    <span style={{ color: 'var(--color-warning)', fontSize: 'var(--font-sm)', letterSpacing: '1px' }}>
      {stars.join('')}
      <span style={{ color: 'var(--color-textMuted)', marginLeft: 'var(--space-1)', fontSize: 'var(--font-xs)' }}>
        {rating.toFixed(1)}
      </span>
    </span>
  );
}

export default function RestaurantDirectory() {
  const [filters, setFilters] = useState<RestaurantFilters>({
    search: '',
    cuisine: [],
    neighborhood: [],
    priceLevel: [],
    isPartner: undefined,
  });

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['restaurants'],
    queryFn: async () => {
      if (isDemoMode) return DEMO_RESTAURANTS;
      const res = await api.get<Restaurant[]>('/api/restaurants');
      if (res.error) throw new Error(res.error);
      return res.data ?? [];
    },
  });

  const restaurants = data?.length ? data : (isDemoMode ? DEMO_RESTAURANTS : []);

  // Derive unique neighborhoods from data
  const neighborhoods = useMemo(() => {
    const set = new Set<string>();
    restaurants.forEach((r) => set.add(r.neighborhood));
    return Array.from(set).sort();
  }, [restaurants]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters((prev) => ({ ...prev, search: e.target.value }));
  }, []);

  const toggleCuisine = useCallback((cuisine: string) => {
    setFilters((prev) => {
      const current = prev.cuisine ?? [];
      return {
        ...prev,
        cuisine: current.includes(cuisine)
          ? current.filter((c) => c !== cuisine)
          : [...current, cuisine],
      };
    });
  }, []);

  const toggleNeighborhood = useCallback((hood: string) => {
    setFilters((prev) => {
      const current = prev.neighborhood ?? [];
      return {
        ...prev,
        neighborhood: current.includes(hood)
          ? current.filter((n) => n !== hood)
          : [...current, hood],
      };
    });
  }, []);

  const togglePrice = useCallback((level: number) => {
    setFilters((prev) => {
      const current = prev.priceLevel ?? [];
      return {
        ...prev,
        priceLevel: current.includes(level)
          ? current.filter((p) => p !== level)
          : [...current, level],
      };
    });
  }, []);

  const togglePartnersOnly = useCallback(() => {
    setFilters((prev) => ({
      ...prev,
      isPartner: prev.isPartner ? undefined : true,
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ search: '', cuisine: [], neighborhood: [], priceLevel: [], isPartner: undefined });
  }, []);

  const filtered = useMemo(() => {
    return restaurants.filter((r) => {
      const search = (filters.search ?? '').toLowerCase();
      if (search && !r.name.toLowerCase().includes(search) && !r.neighborhood.toLowerCase().includes(search) && !r.cuisine.some((c) => c.toLowerCase().includes(search))) {
        return false;
      }
      if (filters.cuisine?.length && !filters.cuisine.some((c) => r.cuisine.includes(c))) {
        return false;
      }
      if (filters.neighborhood?.length && !filters.neighborhood.includes(r.neighborhood)) {
        return false;
      }
      if (filters.priceLevel?.length && !filters.priceLevel.includes(r.priceLevel)) {
        return false;
      }
      if (filters.isPartner && !r.isPartner) {
        return false;
      }
      return true;
    });
  }, [restaurants, filters]);

  const hasActiveFilters = Boolean(
    filters.search || filters.cuisine?.length || filters.neighborhood?.length || filters.priceLevel?.length || filters.isPartner
  );

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="page-header">
          <div className="skeleton" style={{ width: '280px', height: '36px', marginBottom: 'var(--space-3)' }} />
          <div className="skeleton" style={{ width: '200px', height: '20px' }} />
        </div>
        <div className="skeleton" style={{ width: '100%', height: '48px', marginBottom: 'var(--space-6)' }} />
        <div className="card-grid">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <LoadingSkeleton height="160px" borderRadius="0" />
              <div style={{ padding: 'var(--space-4)' }}>
                <LoadingSkeleton width="70%" height="20px" />
                <div style={{ marginTop: 'var(--space-2)' }}>
                  <LoadingSkeleton width="50%" height="14px" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <h3>Failed to load restaurants</h3>
          <p>{error instanceof Error ? error.message : 'An unexpected error occurred.'}</p>
          <button className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }} onClick={() => refetch()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Restaurant Directory</h1>
        <p className="page-subtitle">
          Discover, filter, and connect with restaurants in your area
        </p>
      </div>

      {/* Search and Filters */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        {/* Search bar */}
        <div style={{ position: 'relative', marginBottom: 'var(--space-4)' }}>
          <input
            type="text"
            value={filters.search ?? ''}
            onChange={handleSearchChange}
            placeholder="Search by name, cuisine, or neighborhood..."
            style={{
              width: '100%',
              padding: 'var(--space-3) var(--space-5)',
              paddingLeft: 'var(--space-10)',
              background: 'var(--color-bgSecondary)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-textPrimary)',
              fontSize: 'var(--font-base)',
              outline: 'none',
              transition: 'border-color var(--transition-fast)',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--color-border)')}
          />
          <span style={{
            position: 'absolute',
            left: 'var(--space-4)',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--color-textMuted)',
            fontSize: 'var(--font-lg)',
            pointerEvents: 'none',
          }}>
            &#x1F50D;
          </span>
        </div>

        {/* Filter rows */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', alignItems: 'center' }}>
          {/* Cuisine chips */}
          {CUISINE_OPTIONS.map((cuisine) => {
            const active = filters.cuisine?.includes(cuisine);
            return (
              <button
                key={cuisine}
                className={`badge ${active ? 'badge--accent' : ''}`}
                style={{
                  cursor: 'pointer',
                  background: active ? undefined : 'var(--color-bgElevated)',
                  color: active ? undefined : 'var(--color-textSecondary)',
                  border: 'none',
                  transition: 'all var(--transition-fast)',
                }}
                onClick={() => toggleCuisine(cuisine)}
              >
                {cuisine}
              </button>
            );
          })}

          {/* Separator */}
          <span style={{ width: '1px', height: '20px', background: 'var(--color-border)', margin: '0 var(--space-1)' }} />

          {/* Price level */}
          {[1, 2, 3, 4].map((level) => {
            const active = filters.priceLevel?.includes(level);
            return (
              <button
                key={level}
                className={`badge ${active ? 'badge--accent' : ''}`}
                style={{
                  cursor: 'pointer',
                  background: active ? undefined : 'var(--color-bgElevated)',
                  color: active ? undefined : 'var(--color-textSecondary)',
                  border: 'none',
                }}
                onClick={() => togglePrice(level)}
              >
                {PRICE_LABELS[level]}
              </button>
            );
          })}

          <span style={{ width: '1px', height: '20px', background: 'var(--color-border)', margin: '0 var(--space-1)' }} />

          {/* Partners toggle */}
          <button
            className={`badge ${filters.isPartner ? 'badge--success' : ''}`}
            style={{
              cursor: 'pointer',
              background: filters.isPartner ? undefined : 'var(--color-bgElevated)',
              color: filters.isPartner ? undefined : 'var(--color-textSecondary)',
              border: 'none',
            }}
            onClick={togglePartnersOnly}
          >
            Partners Only
          </button>
        </div>

        {/* Neighborhood filter (if data has neighborhoods) */}
        {neighborhoods.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginTop: 'var(--space-3)', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)', fontWeight: 600, textTransform: 'uppercase', marginRight: 'var(--space-1)' }}>
              Neighborhoods:
            </span>
            {neighborhoods.map((hood) => {
              const active = filters.neighborhood?.includes(hood);
              return (
                <button
                  key={hood}
                  className={`badge ${active ? 'badge--info' : ''}`}
                  style={{
                    cursor: 'pointer',
                    background: active ? undefined : 'var(--color-bgElevated)',
                    color: active ? undefined : 'var(--color-textSecondary)',
                    border: 'none',
                  }}
                  onClick={() => toggleNeighborhood(hood)}
                >
                  {hood}
                </button>
              );
            })}
          </div>
        )}

        {/* Active filter summary */}
        {hasActiveFilters && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
            <span style={{ fontSize: 'var(--font-sm)', color: 'var(--color-textSecondary)' }}>
              {filtered.length} {filtered.length === 1 ? 'restaurant' : 'restaurants'} found
            </span>
            <button className="btn btn-ghost" style={{ fontSize: 'var(--font-xs)' }} onClick={clearFilters}>
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <h3>No restaurants found</h3>
          <p>Try adjusting your filters or search terms.</p>
          {hasActiveFilters && (
            <button className="btn btn-secondary" style={{ marginTop: 'var(--space-4)' }} onClick={clearFilters}>
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="card-grid stagger-children">
          {filtered.map((restaurant) => (
            <RestaurantCard key={restaurant.restaurantId} restaurant={restaurant} />
          ))}
        </div>
      )}
    </div>
  );
}

function RestaurantCard({ restaurant }: { restaurant: Restaurant }) {
  const photoUrl = restaurant.photos?.[0];
  const [imgError, setImgError] = useState(false);

  return (
    <Link
      to={`/app/restaurants/${restaurant.restaurantId}`}
      style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
    >
      <div className="card" style={{ padding: 0, overflow: 'hidden', cursor: 'pointer' }}>
        {/* Photo / Gradient placeholder */}
        <div
          style={{
            width: '100%',
            height: '180px',
            background: (!photoUrl || imgError) ? getGradient(restaurant.restaurantId) : undefined,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {photoUrl && !imgError && (
            <img
              src={photoUrl}
              alt={restaurant.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={() => setImgError(true)}
            />
          )}

          {/* Partner badge overlay */}
          {restaurant.isPartner && (
            <span
              className="badge badge--accent"
              style={{
                position: 'absolute',
                top: 'var(--space-3)',
                right: 'var(--space-3)',
              }}
            >
              Partner
            </span>
          )}

          {/* Price level overlay */}
          <span
            style={{
              position: 'absolute',
              bottom: 'var(--space-3)',
              right: 'var(--space-3)',
              background: 'rgba(0,0,0,0.6)',
              color: '#fff',
              padding: 'var(--space-1) var(--space-2)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--font-xs)',
              fontWeight: 600,
            }}
          >
            {PRICE_LABELS[restaurant.priceLevel]}
          </span>
        </div>

        {/* Card body */}
        <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
          {/* Name + rating row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
            <h3 style={{ fontSize: 'var(--font-lg)', fontWeight: 600, color: 'var(--color-textPrimary)', lineHeight: 1.3 }}>
              {restaurant.name}
            </h3>
            {restaurant.spotRating != null && <StarRating rating={restaurant.spotRating} />}
          </div>

          {/* Neighborhood */}
          <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-textSecondary)', marginBottom: 'var(--space-3)' }}>
            {restaurant.neighborhood}
          </p>

          {/* Cuisine tags */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)' }}>
            {restaurant.cuisine.slice(0, 3).map((c) => (
              <span
                key={c}
                className="badge"
                style={{
                  background: 'var(--color-bgElevated)',
                  color: 'var(--color-textSecondary)',
                  fontSize: '10px',
                }}
              >
                {c}
              </span>
            ))}
            {restaurant.cuisine.length > 3 && (
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)', alignSelf: 'center' }}>
                +{restaurant.cuisine.length - 3}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
