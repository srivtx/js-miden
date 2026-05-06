import { Router, Request, Response } from 'express';
import { getCachedWeather, setCachedWeather } from '../services/cache.js';
import { fetchWeatherFromApi } from '../services/weatherApi.js';
import { WeatherData } from '../types.js';
import { STALE_THRESHOLD_MS } from '../config.js';

const router = Router();

router.get('/weather/:city', async (req: Request, res: Response) => {
  const city = req.params.city;

  try {
    const cached = await getCachedWeather(city);
    const now = Date.now();

    if (cached) {
      const ageMs = now - new Date(cached.fetchedAt).getTime();
      if (ageMs < STALE_THRESHOLD_MS) {
        res.json({ source: 'cache', ...cached });
        return;
      }
      // Cache is stale (> 10 min) — fall through to revalidate
    }

    // BUG: No distributed lock / mutex here.
    // If many concurrent requests arrive when cache is stale,
    // they will all call the external API simultaneously (cache stampede).
    const data: WeatherData = await fetchWeatherFromApi(city);

    await setCachedWeather(city, data);

    res.json({ source: 'api', ...data });
  } catch (err) {
    console.error('Weather fetch error:', err);

    // Serve stale cache if available (stale-while-revalidate fallback)
    const stale = await getCachedWeather(city);
    if (stale) {
      res.json({
        source: 'stale_cache',
        ...stale,
        warning: 'Data may be outdated due to weather service interruption',
      });
      return;
    }

    res.status(503).json({
      error: 'Weather service unavailable. Please try again later.',
    });
  }
});

export default router;
