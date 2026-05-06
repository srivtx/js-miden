# 04-deprecation.md

## WHAT

Deprecation signals that a version or field will be removed.

## WHY

Clients need time to migrate. Deprecation provides a timeline.

## HOW

Use standard HTTP headers:

```
Deprecation: true
Sunset: Sat, 31 Dec 2024 23:59:59 GMT
Link: </v2/users>; rel="successor-version"
```

In responses:
```json
{
  "data": { ... },
  "meta": {
    "deprecation": {
      "message": "v1 is deprecated, migrate to v2",
      "sunset": "2024-12-31T23:59:59Z"
    }
  }
}
```
