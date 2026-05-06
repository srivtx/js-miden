import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { clearCache, quitRedis, setCachedWeatherRaw } from '../src/services/cache.js';
import { setNextRequestShouldFail } from '../src/services/weatherApi.js';

describe('GET /weather/:city', () => {
  beforeAll(async () => {
    await clearCache();
  });

  afterAll(async () => {
    await quitRedis();
  });

  it('fetches from API on cache miss', async () => {
    const res = await request(app).get('/weather/London');
    expect(res.status).toBe(200);
    expect(res.body.source).toBe('api');
    expect(res.body.city).toBe('London');
    expect(res.body).toHaveProperty('temperature');
  });

  it('returns cached data on subsequent request', async () => {
    // First request primes cache
    await request(app).get('/weather/Paris');
    // Second request should hit cache
    const res = await request(app).get('/weather/Paris');
    expect(res.status).toBe(200);
    expect(res.body.source).toBe('cache');
  });

  it('returns stale cache when external API fails', async () => {
    const city = 'ErrorCity';
    // Inject stale cache manually (older than 10 min)
    await setCachedWeatherRaw(city, {
      city,
      temperature: 20,
      condition: 'Sunny',
      humidity: 50,
      windSpeed: 10,
      fetchedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(), // 20 min old
    });

    // Force next API call to fail
    setNextRequestShouldFail(true);

    const res = await request(app).get(`/weather/${city}`);
    expect(res.status).toBe(200);
    expect(res.body.source).toBe('stale_cache');
    expect(res.body.temperature).toBe(20);
  });

  it('returns 503 when API fails and no cache exists', async () => {
    const city = 'NoCacheCity';
    setNextRequestShouldFail(true);

    const res = await request(app).get(`/weather/${city}`);
    expect(res.status).toBe(503);
    expect(res.body.error).toContain('unavailable');
  });

  // This test documents the BUG: cache stampede
  it('BUG: cache stampede — concurrent requests trigger multiple API calls', async () => {
    await clearCache();
    const city = 'StampedeCity';

    // Prime cache with stale data so all requests see stale cache and revalidate
    await setCachedWeatherRaw(city, {
      city,
      temperature: 15,
      condition: 'Cloudy',
      humidity: 60,
      windSpeed: 12,
      fetchedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(), // 20 min old
    });

    // Send 10 concurrent requests
    const requests = Array.from({ length: 10 }, () =>
      request(app).get(`/weather/${city}`)
    );

    const responses = await Promise.all(requests);

    const apiSources = responses.filter((r) => r.body.source === 'api').length;
    const cacheSources = responses.filter((r) => r.body.source === 'cache').length;
    const staleSources = responses.filter((r) => r.body.source === 'stale_cache').length;

    console.log(`API: ${apiSources}, Cache: ${cacheSources}, Stale: ${staleSources}`);

    // Without a mutex, multiple requests will hit the API
    expect(apiSources).toBeGreaterThan(1);
  });
});
