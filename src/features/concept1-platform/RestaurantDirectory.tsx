import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../services/ApiService';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';
import { isDemoMode, DEMO_RESTAURANTS_BY_CITY } from '../../data/demoData';
import { useAuthStore } from '../../store/authStore';
import type { Restaurant, RestaurantFilters, CreatorProfile } from '../../types';

const CITY_OPTIONS = [
  'Washington, DC',
  'Baltimore, MD',
  'Arlington, VA',
  'Alexandria, VA',
  'New York, NY',
  'Atlanta, GA',
  'Chicago, IL',
  'Los Angeles, CA',
  'Miami, FL',
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

/* ─── City Selector ───────────────────────────────────────────────────────── */

function CitySelector({
  selectedCity,
  userCity,
  onChange,
}: {
  selectedCity: string;
  userCity: string;
  onChange: (city: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Sort: user's city first, then alphabetical
  const sortedCities = useMemo(() => {
    const sorted = [...CITY_OPTIONS].sort((a, b) => {
      if (a === userCity) return -1;
      if (b === userCity) return 1;
      return a.localeCompare(b);
    });
    // If user's city isn't in the list, prepend it
    if (userCity && !CITY_OPTIONS.includes(userCity)) {
      sorted.unshift(userCity);
    }
    return sorted;
  }, [userCity]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          padding: 'var(--space-2) var(--space-4)',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          color: 'var(--color-textPrimary)',
          fontSize: 'var(--font-sm)',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all var(--transition-fast)',
          minWidth: '180px',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span style={{ fontSize: '16px' }}>
            {selectedCity === userCity ? '\u{1F3E0}' : '\u{1F4CD}'}
          </span>
          {selectedCity}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + var(--space-2))',
            right: 0,
            minWidth: '240px',
            background: 'var(--color-bgSecondary)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            zIndex: 50,
            overflow: 'hidden',
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          <div style={{ padding: 'var(--space-2) var(--space-3)', borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Select City
            </span>
          </div>
          {sortedCities.map((city) => {
            const count = DEMO_RESTAURANTS_BY_CITY[city]?.length ?? 0;
            const isSelected = city === selectedCity;
            const isHome = city === userCity;
            return (
              <button
                key={city}
                onClick={() => { onChange(city); setOpen(false); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: 'var(--space-3) var(--space-4)',
                  background: isSelected ? 'rgba(249, 115, 22, 0.1)' : 'transparent',
                  border: 'none',
                  borderLeft: isSelected ? '3px solid var(--color-accent)' : '3px solid transparent',
                  color: isSelected ? 'var(--color-accent)' : 'var(--color-textPrimary)',
                  fontSize: 'var(--font-sm)',
                  fontWeight: isSelected ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'var(--color-bgElevated)';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'transparent';
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  {city}
                  {isHome && (
                    <span style={{ fontSize: '10px', color: 'var(--color-accent)', background: 'rgba(249, 115, 22, 0.1)', padding: '1px 6px', borderRadius: 'var(--radius-sm)', fontWeight: 600 }}>
                      Home
                    </span>
                  )}
                </span>
                <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)' }}>
                  {count} spots
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Main Directory ──────────────────────────────────────────────────────── */

export default function RestaurantDirectory() {
  const demoProfile = useAuthStore((s) => s.demoProfile);

  // Default to user's onboarded city, or DC as fallback
  const userCity = demoProfile?.city || 'Washington, DC';
  const [selectedCity, setSelectedCity] = useState(userCity);
  const [filtersInitialized, setFiltersInitialized] = useState(false);
  const [filters, setFilters] = useState<RestaurantFilters>({
    search: '',
    cuisine: [],
    neighborhood: [],
    priceLevel: [],
    isPartner: undefined,
  });

  // Fetch creator profile to get home city (real mode)
  const { data: profile } = useQuery({
    queryKey: ['creatorProfile'],
    queryFn: async () => {
      if (isDemoMode()) {
        // Use the persisted demo profile city
        return { city: demoProfile?.city || 'Washington, DC' } as CreatorProfile;
      }
      const res = await api.get<CreatorProfile>('/api/profile');
      return res.data ?? null;
    },
  });

  // Set city from profile on first load
  useEffect(() => {
    if (profile?.city) setSelectedCity(profile.city);
  }, [profile?.city]);

  // Pre-select cuisine filters from onboarding prefs (demo mode, once)
  useEffect(() => {
    if (filtersInitialized || !demoProfile) return;
    setFilters((prev) => ({
      ...prev,
      cuisine: demoProfile.cuisinePreferences.length > 0 ? demoProfile.cuisinePreferences.slice(0, 3) : [],
    }));
    setFiltersInitialized(true);
  }, [demoProfile, filtersInitialized]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['restaurants', selectedCity],
    queryFn: async () => {
      if (isDemoMode()) {
        return DEMO_RESTAURANTS_BY_CITY[selectedCity] ?? [];
      }
      const params = selectedCity ? `?city=${encodeURIComponent(selectedCity)}` : '';
      const res = await api.get<Restaurant[]>(`/api/restaurants${params}`);
      if (res.error) throw new Error(res.error);
      return res.data ?? [];
    },
  });

  const restaurants = data ?? [];

  // Derive unique cuisines from CURRENT CITY'S data (dynamic, not hardcoded)
  const availableCuisines = useMemo(() => {
    const counts = new Map<string, number>();
    restaurants.forEach((r) => {
      r.cuisine.forEach((c) => counts.set(c, (counts.get(c) || 0) + 1));
    });
    // Sort by frequency (most common first), then alphabetical
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([cuisine]) => cuisine);
  }, [restaurants]);

  // Derive unique neighborhoods from data
  const neighborhoods = useMemo(() => {
    const set = new Set<string>();
    restaurants.forEach((r) => set.add(r.neighborhood));
    return Array.from(set).sort();
  }, [restaurants]);

  // When city changes, reset neighborhood filters AND clear cuisine filters that
  // don't exist in the new city
  const handleCityChange = useCallback((city: string) => {
    setSelectedCity(city);
    setFilters((prev) => ({
      ...prev,
      neighborhood: [],
      // Keep cuisine filters that exist in the new city — they'll self-clean
      // once data loads. We clear them proactively here for a clean slate.
    }));
  }, []);

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

  // Score each restaurant based on how well it matches the user's profile
  const scoredAndFiltered = useMemo(() => {
    const userCuisines = new Set(demoProfile?.cuisinePreferences ?? []);
    const userNeighborhoods = new Set(demoProfile?.neighborhoods ?? []);

    // 1. Filter
    const matches = restaurants.filter((r) => {
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

    // 2. Score by profile relevance
    const scored = matches.map((r) => {
      let score = 0;
      // Cuisine match: +2 for each matching cuisine
      r.cuisine.forEach((c) => { if (userCuisines.has(c)) score += 2; });
      // Neighborhood match: +3 (strong signal)
      if (userNeighborhoods.has(r.neighborhood)) score += 3;
      // Partner bonus: +1
      if (r.isPartner) score += 1;
      // Higher rating bonus
      if (r.spotRating && r.spotRating >= 4.7) score += 1;
      return { restaurant: r, score };
    });

    // 3. Sort: highest score first, then by rating
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (b.restaurant.spotRating ?? 0) - (a.restaurant.spotRating ?? 0);
    });

    return scored;
  }, [restaurants, filters, demoProfile]);

  const hasActiveFilters = Boolean(
    filters.search || filters.cuisine?.length || filters.neighborhood?.length || filters.priceLevel?.length || filters.isPartner
  );

  // Count how many are "recommended" (score > 0 from profile match)
  const recommendedCount = scoredAndFiltered.filter((s) => s.score > 0).length;

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
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <h1 className="page-title">Restaurant Directory</h1>
          <p className="page-subtitle">
            {recommendedCount > 0 && demoProfile
              ? `${recommendedCount} personalized picks based on your profile`
              : `Discover, filter, and connect with restaurants in ${selectedCity}`
            }
          </p>
        </div>
        <CitySelector
          selectedCity={selectedCity}
          userCity={userCity}
          onChange={handleCityChange}
        />
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

        {/* Filter rows — DYNAMIC cuisine chips based on current city */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', alignItems: 'center' }}>
          {/* Cuisine chips — derived from city data */}
          {availableCuisines.map((cuisine) => {
            const active = filters.cuisine?.includes(cuisine);
            const isUserPref = demoProfile?.cuisinePreferences?.includes(cuisine);
            return (
              <button
                key={cuisine}
                className={`badge ${active ? 'badge--accent' : ''}`}
                style={{
                  cursor: 'pointer',
                  background: active ? undefined : 'var(--color-bgElevated)',
                  color: active ? undefined : 'var(--color-textSecondary)',
                  border: isUserPref && !active ? '1px solid rgba(249, 115, 22, 0.3)' : 'none',
                  transition: 'all var(--transition-fast)',
                }}
                onClick={() => toggleCuisine(cuisine)}
                title={isUserPref ? 'Matches your profile' : undefined}
              >
                {cuisine}
                {isUserPref && !active && (
                  <span style={{ marginLeft: '4px', fontSize: '10px', opacity: 0.7 }}>{'\u2605'}</span>
                )}
              </button>
            );
          })}

          {availableCuisines.length > 0 && (
            <span style={{ width: '1px', height: '20px', background: 'var(--color-border)', margin: '0 var(--space-1)' }} />
          )}

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
              const isUserPref = demoProfile?.neighborhoods?.includes(hood);
              return (
                <button
                  key={hood}
                  className={`badge ${active ? 'badge--info' : ''}`}
                  style={{
                    cursor: 'pointer',
                    background: active ? undefined : 'var(--color-bgElevated)',
                    color: active ? undefined : 'var(--color-textSecondary)',
                    border: isUserPref && !active ? '1px solid rgba(139, 92, 246, 0.3)' : 'none',
                  }}
                  onClick={() => toggleNeighborhood(hood)}
                  title={isUserPref ? 'In your neighborhoods' : undefined}
                >
                  {hood}
                  {isUserPref && !active && (
                    <span style={{ marginLeft: '4px', fontSize: '10px', opacity: 0.7 }}>{'\u2605'}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Active filter summary */}
        {hasActiveFilters && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
            <span style={{ fontSize: 'var(--font-sm)', color: 'var(--color-textSecondary)' }}>
              {scoredAndFiltered.length} {scoredAndFiltered.length === 1 ? 'restaurant' : 'restaurants'} found
            </span>
            <button className="btn btn-ghost" style={{ fontSize: 'var(--font-xs)' }} onClick={clearFilters}>
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Results */}
      {scoredAndFiltered.length === 0 ? (
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
        <>
          {/* "Recommended for you" section header when profile matches exist */}
          {recommendedCount > 0 && !hasActiveFilters && demoProfile && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              marginBottom: 'var(--space-4)',
              paddingBottom: 'var(--space-3)',
              borderBottom: '1px solid var(--color-border)',
            }}>
              <span style={{ fontSize: '16px' }}>{'\u2728'}</span>
              <span style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--color-accent)' }}>
                Recommended for you
              </span>
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-textMuted)' }}>
                Based on your cuisine preferences and neighborhoods
              </span>
            </div>
          )}
          <div className="card-grid stagger-children">
            {scoredAndFiltered.map(({ restaurant, score }) => (
              <RestaurantCard
                key={restaurant.restaurantId}
                restaurant={restaurant}
                isRecommended={score > 0 && !!demoProfile}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function RestaurantCard({ restaurant, isRecommended }: { restaurant: Restaurant; isRecommended: boolean }) {
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

          {/* Recommended badge overlay */}
          {isRecommended && (
            <span
              style={{
                position: 'absolute',
                top: 'var(--space-3)',
                left: 'var(--space-3)',
                background: 'rgba(249, 115, 22, 0.9)',
                color: '#fff',
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.03em',
                backdropFilter: 'blur(4px)',
              }}
            >
              {'\u2605'} For You
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
