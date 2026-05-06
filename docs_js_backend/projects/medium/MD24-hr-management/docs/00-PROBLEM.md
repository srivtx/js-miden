# Problem Statement

## HR Management System Salary Exposure

Build an HR management system with employee profiles, organizational chart, leave management, performance reviews, payroll integration, and recruitment pipeline.

## Core Requirements

1. **Employee Profiles**: Personal info, role, department, position, salary
2. **Org Chart**: Hierarchical reporting structure visualization
3. **Leave Management**: Submit, approve/deny vacation/sick leave
4. **Performance Reviews**: 360-degree feedback with ratings and goals
5. **Payroll Integration**: Stub for calculating gross/net pay
6. **Recruitment Pipeline**: Track applicants through interview rounds

## The Bug

**Manager Can See All Employee Salaries**: The `GET /api/employees` endpoint returns the full employee object including the `salary` field to any authenticated user. There is no role-based filtering that removes sensitive fields based on the requesting user's permissions.

## Expected Behavior

- **Admin/HR**: Can see all employee salaries
- **Manager**: Can see salaries of direct reports only
- **Employee**: Can see own salary only, not others'

## Actual Behavior

All authenticated users receive the full employee record including salary for every employee in the system.

## Impact

- Privacy violation (salary is sensitive PII)
- Employee morale issues (pay inequality visibility)
- Legal/compliance issues (GDPR, CCPA)
- Competitive intelligence leakage if employee leaves
