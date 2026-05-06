# Old vs New: Real Estate Tech (2015 vs 2025)

## Architecture Patterns

| Aspect | 2015 Approach | 2025 Approach |
|--------|---------------|---------------|
| **API Framework** | Express 4 with callbacks | Express 5 + async/await + ESM |
| **Database** | MySQL / MongoDB | PostgreSQL + Prisma (type-safe) |
| **Search** | SQL LIKE queries | Elasticsearch / OpenSearch |
| **Geospatial** | Application filtering | PostGIS with GIST index |
| **Images** | Direct S3 URLs | CDN with responsive images (WebP) |
| **Mortgage Calc** | Client-side JS | Server-side with rate lock APIs |
| **Virtual Tours** | Photo galleries | 3D Matterport / VR walkthroughs |

## Code Comparison

### Text Search (2015 vs 2025)

**2015 (Full table scan):**
```javascript
// Express 4, no indexing
app.get('/search', function(req, res) {
  db.query(
    "SELECT * FROM listings WHERE address ILIKE ?",
    ['%' + req.query.q + '%'],
    function(err, rows) {
      if (err) return res.status(500).send(err);
      res.json(rows);
    }
  );
});
// Query time: 8-15 seconds with 1M listings
```

**2025 (Indexed search):**
```typescript
// Express 5, trigram index
app.get('/search', async (req, res) => {
  // Uses GIN trigram index
  const listings = await prisma.listing.findMany({
    where: {
      OR: [
        { address: { contains: req.query.q, mode: 'insensitive' } },
        { city: { contains: req.query.q, mode: 'insensitive' } },
      ],
    },
    take: 50,
  });
  res.json(listings);
});
// Query time: ~50ms with trigram index
```

### Geospatial Search (2015 vs 2025)

**2015 (Fetch all):**
```javascript
// Application-level filtering
app.get('/search/nearby', function(req, res) {
  db.query('SELECT * FROM listings WHERE status = ?', ['ACTIVE'], function(err, rows) {
    const nearby = rows.filter(row => {
      const dist = haversine(req.query.lat, req.query.lng, row.lat, row.lng);
      return dist <= req.query.radius;
    });
    res.json(nearby);
  });
});
// OOM with 2M listings
```

**2025 (PostGIS):**
```typescript
// Database-level geospatial query
app.get('/search/nearby', async (req, res) => {
  const listings = await prisma.$queryRaw`
    SELECT * FROM listings
    WHERE ST_DWithin(
      location::geometry,
      ST_SetSRID(ST_MakePoint(${req.query.lng}, ${req.query.lat}), 4326),
      ${req.query.radius} * 1609.34
    )
    AND status = 'ACTIVE'
    ORDER BY ST_Distance(location, ST_SetSRID(ST_MakePoint(${req.query.lng}, ${req.query.lat}), 4326))
    LIMIT 50
  `;
  res.json(listings);
});
// Uses GIST spatial index
```

### Mortgage Calculator (2015 vs 2025)

**2015 (Simple interest):**
```javascript
function calculatePayment(price, down, rate, years) {
  const principal = price - down;
  const interest = principal * (rate / 100) * years;
  return (principal + interest) / (years * 12);
}
// WRONG: This is simple interest, not amortization!
```

**2025 (Amortization with rate lock):**
```typescript
function calculateMortgage(price: number, down: number, rate: number, years: number) {
  const principal = price - down;
  const monthlyRate = rate / 100 / 12;
  const numPayments = years * 12;
  
  const monthlyPayment = 
    (principal * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
    (Math.pow(1 + monthlyRate, numPayments) - 1);
  
  return {
    monthlyPayment: Math.round(monthlyPayment * 100) / 100,
    totalInterest: Math.round((monthlyPayment * numPayments - principal) * 100) / 100,
    rateLockExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  };
}
```

## Technology Evolution

| Component | 2015 Stack | 2025 Stack |
|-----------|-----------|------------|
| Language | JavaScript (ES5) | TypeScript (strict, ESM) |
| ORM | Sequelize / Mongoose | Prisma |
| Testing | Mocha + Chai | Vitest + Supertest |
| Search | SQL LIKE | Elasticsearch / OpenSearch |
| Geospatial | None / custom | PostGIS |
| Images | JPEG direct | WebP + responsive + CDN |
| Containerization | Docker (basic) | Docker Compose + K8s |

## Industry Milestones

- **2015**: Zillow reaches 100M+ monthly visits; scales search to Elasticsearch
- **2016**: Redfin introduces 3D walkthroughs with Matterport
- **2017**: Compass launches with AI-powered agent tools
- **2018**: Zillow's Zestimate accuracy improves to 4.5% median error
- **2019**: iBuying (Zillow Offers, Opendoor) becomes mainstream
- **2020**: Virtual tours become standard due to COVID-19
- **2021**: Blockchain-based property records piloted
- **2023**: AI-powered property valuation becomes standard
- **2025**: AR/VR home staging and remote closings
