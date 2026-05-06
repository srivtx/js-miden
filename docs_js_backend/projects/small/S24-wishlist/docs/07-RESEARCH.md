# 07-RESEARCH.md

## Academic & Industry Sources

### Multi-Tenant Data Isolation

1. **OWASP. (2023).** "Insecure Direct Object Reference (IDOR) Prevention Cheat Sheet."
   - Documents the exact vulnerability shown in this project: accessing resources by manipulating identifiers without authorization checks.
   - https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html

2. **Salesforce Architecture. (2020).** "Multi-Tenant Architecture."
   - Describes how Salesforce isolates tenant data at the database, application, and network layers.
   - https://architect.salesforce.com/fundamentals/multi-tenant-architecture

### Database Constraints & Deduplication

3. **C. J. Date. (2015).** *SQL and Relational Theory: How to Write Accurate SQL Code* (3rd ed.). O'Reilly Media.
   - Chapter 8: "Constraints and Predicates" — explains why composite unique constraints are the correct way to enforce business rules.

4. **PostgreSQL Documentation. (2024).** "Unique Constraints."
   - Documents composite unique constraints and partial indexes for multi-tenant deduplication.
   - https://www.postgresql.org/docs/current/ddl-constraints.html

### GDPR & Privacy Compliance

5. **European Union. (2016).** "General Data Protection Regulation (GDPR), Article 32."
   - Mandates "appropriate technical and organisational measures" to protect personal data. Exposing one user's data to another violates this.
   - https://gdpr-info.eu/art-32-gdpr/

6. **ICO (UK). (2024).** "Guidance on Data Security."
   - Recommends row-level security and tenant isolation for SaaS applications handling personal data.
   - https://ico.org.uk/for-organisations/guide-to-data-protection/

### E-Commerce Wishlist Patterns

7. **Amazon Web Services. (2023).** "AWS Retail Reference Architecture."
   - Documents wishlist microservice with user isolation, deduplication, and event-driven price tracking.
   - https://aws.amazon.com/retail/

8. **Shopify Engineering. (2021).** "How We Built the Shopify Wishlist."
   - Describes composite unique constraints, row-level security, and caching strategies for e-commerce wishlists.
   - https://shopify.engineering/

### Row-Level Security

9. **PostgreSQL Documentation. (2024).** "Row Security Policies."
   - Documents RLS as a defense-in-depth mechanism for multi-tenant isolation.
   - https://www.postgresql.org/docs/current/ddl-rowsecurity.html

10. **Microsoft Azure. (2024).** "Multi-tenant SaaS patterns with Azure SQL Database."
    - Compares tenant isolation strategies: shared database, database per tenant, and sharding.
    - https://learn.microsoft.com/en-us/azure/azure-sql/database/saas-tenancy-app-design-patterns
