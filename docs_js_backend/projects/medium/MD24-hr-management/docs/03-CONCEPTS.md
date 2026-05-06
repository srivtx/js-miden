# Core Concepts

## Role-Based Access Control (RBAC)

### RBAC Models

1. **Flat RBAC**: Users assigned to roles, roles have permissions
2. **Hierarchical RBAC**: Roles can inherit from other roles
3. **Constrained RBAC**: Separation of duties, cardinality constraints
4. **Symmetric RBAC**: Role-role review (auditing)

### Field-Level Security

Row-level security (RLS) controls which records you see. Field-level security controls which columns.

```sql
-- Row-level
SELECT * FROM employees WHERE department = 'Engineering'

-- Field-level  
SELECT id, name, position FROM employees  -- No salary!
```

## GDPR and Sensitive Data

Under GDPR Article 9, salary data may be considered sensitive personal data:
- Requires explicit consent or legitimate interest basis
- Must implement data minimization
- Subject to right of access and portability

## Organization Design

### Span of Control
Number of direct reports per manager. Typical range: 5-15.

### Management Layers
- Flat org: 2-3 layers (startups)
- Traditional: 5-7 layers (enterprises)
- Delayering trend: Removing middle management

## Performance Review Methods

| Method | Description | Pros | Cons |
|--------|-------------|------|------|
| 360 Feedback | Input from peers, manager, self | Holistic view | Time-consuming |
| MBO | Management by Objectives | Goal-oriented | Can miss behaviors |
| Forced Ranking | Compare employees to each other | Identifies top performers | Demoralizing |
| Continuous | Ongoing feedback | Timely | Requires manager time |

## Leave Policies

### Accrual Methods
- **Lump sum**: All days given at start of year
- **Per pay period**: Accrue X hours per paycheck
- **Unlimited**: No tracking (trendy but problematic)

### Carryover Rules
- Use it or lose it
- Limited carryover (e.g., 5 days max)
- Unlimited carryover (payout on termination)
