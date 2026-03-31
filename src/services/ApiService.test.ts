import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('ApiService', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('makes GET request with auth header', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ items: [] }),
    });

    const { api } = await import('./ApiService');
    const result = await api.get('/api/campaigns');

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/campaigns');
    expect(init.method).toBe('GET');
    expect(init.headers['Authorization']).toContain('Bearer');
    expect(result.status).toBe('success');
    expect(result.data).toEqual({ items: [] });
  });

  it('returns error status on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Not found' }),
    });
    // Second call for 401 retry — 404 doesn't retry
    const { api } = await import('./ApiService');
    const result = await api.get('/api/campaigns/nonexistent');

    expect(result.status).toBe('error');
  });

  it('makes POST request with JSON body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ campaignId: 'new-campaign-123' }),
    });

    const { api } = await import('./ApiService');
    const result = await api.post('/api/campaigns', {
      body: { name: 'Test Campaign', restaurantId: 'rest-456' },
    });

    expect(result.status).toBe('success');
    const [, init] = mockFetch.mock.calls[0];
    expect(JSON.parse(init.body)).toMatchObject({ name: 'Test Campaign' });
  });

  it('returns timeout status when request aborts', async () => {
    mockFetch.mockImplementationOnce((_url, { signal }) => {
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      });
    });

    // Reduce timeout for the test by overriding via vi.useFakeTimers
    vi.useFakeTimers();
    const { api } = await import('./ApiService');
    const resultPromise = api.get('/api/slow-endpoint');
    vi.advanceTimersByTime(9000); // past 8s timeout
    const result = await resultPromise;

    expect(result.status).toBe('timeout');
    vi.useRealTimers();
  });
});
