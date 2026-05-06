# Research Notes

## Real Estate Search Patterns

### Full-Text Search Solutions

**PostgreSQL Full-Text Search**
- Built-in, no extra infrastructure
- Good for moderate data volumes
- Supports ranking and highlighting

**Elasticsearch**
- Best for large-scale search
- Supports complex aggregations
- Requires additional infrastructure

**Algolia**
- Managed search service
- Excellent performance
- Cost scales with usage

### Geospatial Solutions

**PostGIS**
- PostgreSQL extension
- Industry standard for geospatial
- Supports complex queries

**Geohash**
- Simple encoding of latitude/longitude
- Easy to implement
- Good for proximity queries

**S2 Geometry**
- Google's spherical geometry library
- Hierarchical cell system
- Used by Google Maps

### Industry Examples

| Platform | Search Tech | Scale |
|----------|------------|-------|
| Zillow | Elasticsearch | 100M+ listings |
| Redfin | PostgreSQL + PostGIS | 50M+ listings |
| Realtor.com | Solr | 100M+ listings |

## References

- [PostGIS Documentation](https://postgis.net/documentation/)
- [PostgreSQL Full-Text Search](https://www.postgresql.org/docs/current/textsearch.html)
- [Elasticsearch Real Estate Search](https://www.elastic.co/blog/how-to-build-real-estate-search-with-elasticsearch)
