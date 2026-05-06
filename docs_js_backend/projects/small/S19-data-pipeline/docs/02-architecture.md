# 02-architecture.md

## WHAT

The pipeline is triggered via HTTP and processes data in stages.

## WHY

Stage separation allows independent testing, retry, and monitoring of each phase.

## HOW

```
POST /pipeline → Orchestrator → Extract → Transform → Load → Status Update
```

- Extract: Source-agnostic data reader
- Transform: Business logic for cleaning
- Load: Batch inserts with error handling
- Orchestrator: Tracks pipeline state
