import { WeatherData } from '../types.js';
import { MOCK_API_DELAY_MS } from '../config.js';

let shouldFailNext = false;

export function setNextRequestShouldFail(value: boolean): void {
  shouldFailNext = value;
}

export async function fetchWeatherFromApi(city: string): Promise<WeatherData> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, MOCK_API_DELAY_MS));

  if (shouldFailNext) {
    shouldFailNext = false;
    throw new Error('External weather API is unavailable');
  }

  return {
    city,
    temperature: Math.round(10 + Math.random() * 20), // 10-30°C
    condition: ['Sunny', 'Cloudy', 'Rainy', 'Partly Cloudy'][Math.floor(Math.random() * 4)],
    humidity: Math.round(40 + Math.random() * 50),
    windSpeed: Math.round(5 + Math.random() * 20),
    fetchedAt: new Date().toISOString(),
  };
}
