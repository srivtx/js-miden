# 06-version-discovery.md

## WHAT

Version discovery helps clients find available API versions.

## WHY

Hardcoding version URLs is brittle. Discovery enables automatic upgrades.

## HOW

```
GET /versions
```

```json
{
  "versions": [
    { "version": "v1", "status": "deprecated", "sunset": "2024-12-31" },
    { "version": "v2", "status": "stable", "latest": true }
  ]
}
```

Or use Link headers:
```
Link: </v1/users>; rel="version-1", </v2/users>; rel="version-2"
```
