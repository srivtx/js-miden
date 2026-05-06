# Research & References

## Academic Papers

1. **"Concurrency Control in Distributed Database Systems"** - Bernstein & Goodman (1981)
   - Foundational text on transaction isolation and locking

2. **"A Critique of ANSI SQL Isolation Levels"** - Berenson et al. (1995)
   - Defines anomalies that occur at different isolation levels

## Industry Articles

1. **"How Booking.com Handles Peak Traffic"** - Booking.com Engineering Blog
   - Real-world strategies for hotel booking systems
   - https://blog.booking.com/

2. **"Designing a Hotel Reservation System"** - System Design Primer
   - https://github.com/donnemartin/system-design-primer

3. **"Race Conditions in Web Applications"** - OWASP
   - https://owasp.org/www-community/vulnerabilities/Race_Condition

## Database Documentation

1. **PostgreSQL Advisory Locks**
   - https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS

2. **PostgreSQL Exclusion Constraints**
   - https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-EXCLUSION

3. **Prisma Transactions**
   - https://www.prisma.io/docs/orm/prisma-client/queries/transactions

## Related Systems

- **Expedia's architecture**: Microservices with event sourcing for inventory
- **Airbnb's reservation system**: Optimistic locking with overbooking reconciliation
- **Amazon DynamoDB**: Conditional writes as alternative to locking

## Tools

- **k6**: Load testing for race condition reproduction
- **Artillery**: Concurrent request simulation
- **TypeORM**: Alternative ORM with built-in locking
