# v1 — Simple JS (Naive Weather API)

## The Scenario

It's 2am. Your junior built a weather API. "It calls OpenWeatherMap and returns the result," they say. "Straightforward."

## The PAIN: No Cache

```javascript
// server.js
const express = require('express');
const app = express();

app.get('/weather/:city', async (req, res) => {
  const city = req.params.city;
  
  const response = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${API_KEY}`
  );
  const data = await response.json();
  
  res.json(data);
});

app.listen(3000);
```

### What breaks in production:

1. **API quota destroyed**: 100 users click your weather widget. You make 100 identical API calls for "London" in 10 seconds. Your OpenWeatherMap free tier is exhausted by noon.

2. **Latency is terrible**: Every request waits 200-800ms for the upstream API. Your users think your app is slow. It's not — you're just proxying slowness.

3. **No fallback**: OpenWeatherMap is down? Your users see a 500 error. You could have shown them *slightly stale* data, but you threw it away.

4. **No validation**: `GET /weather/; DROP TABLE users;` — your URL is concatenated. Hope that external API handles it, because you didn't.

5. **No types**: `data.main.temp` might be undefined if the API changes its schema. Your app crashes in production on a Friday night.

### The moment of realization:

> Junior: "Why did we hit our API rate limit in 20 minutes?"
> 
> You: "Because weather doesn't change every millisecond, but our requests do."

## Why we start here

This is the naive integration pattern: proxy every request straight through. It works. It's simple. And it will cost you money, users, and API quotas. Caching isn't premature optimization — for external APIs, it's the only responsible architecture.

## The fix (next version)

We need to describe what "weather data" looks like before we can cache it intelligently. Time for types.
