# 08-data-quality.md

## WHAT

Data quality checks ensure the loaded data meets expectations.

## WHY

Bad data in the warehouse leads to bad decisions. Validate before and after loading.

## HOW

Pre-load validation:
- Schema validation
- Required fields
- Format checks (email, dates)
- Range checks (age > 0)

Post-load validation:
- Row count matches source
- Null percentages
- Distribution checks
- Referential integrity
