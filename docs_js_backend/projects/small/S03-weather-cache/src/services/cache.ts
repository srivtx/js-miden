import Redis from 'ioredis';
import { REDIS_URL, REDIS_TTL_SECONDS } from '../config.js';
import { WeatherData } from '../types.js';

const redis = new Redis(REDIS_URL);

export function getCacheKey(city: string): string {
  return `weather:${city.toLowerCase().trim()}`;
}

export async function getCachedWeather(city: string): Promise<WeatherData | null> {
  const key = getCacheKey(city);
  const data = await redis.get(key);
  if (!data) return null;
  try {
    return JSON.parse(data) as WeatherData;
  } catch {
    return null;
  }
}

export async function setCachedWeather(city: string, data: WeatherData): Promise<void> {
  const key = getCacheKey(city);
  await redis.setex(key, REDIS_TTL_SECONDS, JSON.stringify(data));
}

export async function setCachedWeatherRaw(city: string, data: WeatherData): Promise<void> {
  const key = getCacheKey(city);
  await redis.setex(key, REDIS_TTL_SECONDS, JSON.stringify(data));
}

export async function clearCache(): Promise<void> {
  await redis.flushall();
}

export async function quitRedis(): Promise<void> {
  await redis.quit();
}
