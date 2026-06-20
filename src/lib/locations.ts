/* ─── Location hierarchy ─────────────────────────────────────────────────────
 * Single source of truth for the markets Spot operates in: State → City →
 * Neighborhood. Adding a new market is a data edit here, not a code change.
 *
 * `cityLabel` (e.g. "Arlington, VA") is the canonical key used across the app
 * (restaurant `city` field, `?city=` filters, demo data keys), so the derived
 * `CITY_OPTIONS` / `NEIGHBORHOODS_BY_CITY` exports below are drop-in compatible
 * with the previous inline lists in onboarding and the restaurant directory.
 * ──────────────────────────────────────────────────────────────────────────── */

export interface CityEntry {
  /** Bare city name, e.g. "Arlington" */
  name: string;
  /** Canonical label used everywhere, e.g. "Arlington, VA" */
  label: string;
  neighborhoods: string[];
}

export interface StateEntry {
  /** USPS / postal code, e.g. "VA" */
  code: string;
  /** Full state name, e.g. "Virginia" */
  name: string;
  cities: CityEntry[];
}

export const LOCATIONS: StateEntry[] = [
  {
    code: 'DC',
    name: 'District of Columbia',
    cities: [
      {
        name: 'Washington',
        label: 'Washington, DC',
        neighborhoods: [
          'Shaw', 'Adams Morgan', 'Capitol Hill', 'Georgetown', 'Dupont Circle',
          'H Street', '14th Street', 'U Street', 'Navy Yard', 'Columbia Heights',
          'Petworth', 'Brookland',
        ],
      },
    ],
  },
  {
    code: 'VA',
    name: 'Virginia',
    cities: [
      {
        name: 'Arlington',
        label: 'Arlington, VA',
        neighborhoods: [
          'Clarendon', 'Ballston', 'Rosslyn', 'Crystal City', 'Pentagon City',
          'Shirlington', 'Columbia Pike', 'Courthouse',
        ],
      },
      {
        name: 'Alexandria',
        label: 'Alexandria, VA',
        neighborhoods: [
          'Old Town', 'Del Ray', 'Carlyle', 'Eisenhower', 'Potomac Yard',
          'Seminary Hill', 'Rosemont',
        ],
      },
    ],
  },
  {
    code: 'MD',
    name: 'Maryland',
    cities: [
      {
        name: 'Baltimore',
        label: 'Baltimore, MD',
        neighborhoods: [
          'Fells Point', 'Federal Hill', 'Inner Harbor', 'Canton', 'Mount Vernon',
          'Hampden', 'Station North', 'Locust Point',
        ],
      },
    ],
  },
  {
    code: 'NY',
    name: 'New York',
    cities: [
      {
        name: 'New York',
        label: 'New York, NY',
        neighborhoods: [
          'Manhattan', 'Brooklyn', 'Queens', 'Williamsburg', 'SoHo',
          'East Village', 'West Village', 'Harlem', 'Chelsea', 'Lower East Side',
        ],
      },
    ],
  },
  {
    code: 'GA',
    name: 'Georgia',
    cities: [
      {
        name: 'Atlanta',
        label: 'Atlanta, GA',
        neighborhoods: [
          'Midtown', 'Buckhead', 'Old Fourth Ward', 'Inman Park', 'Decatur',
          'West Midtown', 'Poncey-Highland', 'Virginia-Highland',
        ],
      },
    ],
  },
  {
    code: 'IL',
    name: 'Illinois',
    cities: [
      {
        name: 'Chicago',
        label: 'Chicago, IL',
        neighborhoods: [
          'River North', 'Wicker Park', 'Logan Square', 'West Loop', 'Lincoln Park',
          'Pilsen', 'Chinatown', 'Andersonville',
        ],
      },
    ],
  },
  {
    code: 'CA',
    name: 'California',
    cities: [
      {
        name: 'Los Angeles',
        label: 'Los Angeles, CA',
        neighborhoods: [
          'Silver Lake', 'West Hollywood', 'Santa Monica', 'Downtown', 'Koreatown',
          'Echo Park', 'Venice', 'Highland Park',
        ],
      },
    ],
  },
  {
    code: 'FL',
    name: 'Florida',
    cities: [
      {
        name: 'Miami',
        label: 'Miami, FL',
        neighborhoods: [
          'Wynwood', 'Brickell', 'Little Havana', 'Coconut Grove', 'Design District',
          'South Beach', 'Coral Gables',
        ],
      },
    ],
  },
];

// ─── Derived helpers ──────────────────────────────────────────────────────────

/** State options for a cascading <select>, alphabetical by name. */
export function getStateOptions(): { value: string; label: string }[] {
  return [...LOCATIONS]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((s) => ({ value: s.code, label: s.name }));
}

/** City labels for a given state code, alphabetical. */
export function getCitiesForState(stateCode: string): { value: string; label: string }[] {
  const state = LOCATIONS.find((s) => s.code === stateCode);
  if (!state) return [];
  return [...state.cities]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => ({ value: c.label, label: c.label }));
}

/** Neighborhoods for a city label (e.g. "Arlington, VA"). */
export function getNeighborhoods(cityLabel: string): string[] {
  for (const state of LOCATIONS) {
    const city = state.cities.find((c) => c.label === cityLabel);
    if (city) return city.neighborhoods;
  }
  return [];
}

/** State code for a city label, e.g. "Arlington, VA" → "VA". */
export function getStateForCity(cityLabel: string): string | undefined {
  for (const state of LOCATIONS) {
    if (state.cities.some((c) => c.label === cityLabel)) return state.code;
  }
  return undefined;
}

// ─── Back-compat exports (drop-in for the old inline lists) ───────────────────

/** Flat list of all city labels, ordered by the LOCATIONS hierarchy. */
export const CITY_OPTIONS: string[] = LOCATIONS.flatMap((s) => s.cities.map((c) => c.label));

/** Map of city label → neighborhoods, mirrors the previous onboarding constant. */
export const NEIGHBORHOODS_BY_CITY: Record<string, string[]> = Object.fromEntries(
  LOCATIONS.flatMap((s) => s.cities.map((c) => [c.label, c.neighborhoods] as const)),
);
