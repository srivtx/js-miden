# 07-RESEARCH.md

## Citations and References

### Foundational Data Engineering

1. **Kimball, R., & Ross, M. (2013). "The Data Warehouse Toolkit: The Definitive Guide to Dimensional Modeling"**
   - 3rd Edition, Wiley
   - Foundational text on star schemas, fact tables, and dimensional modeling for analytics.

2. **Kleppmann, M. (2017). "Designing Data-Intensive Applications"**
   - O'Reilly Media
   - Chapter 11 covers stream processing; Chapter 3 covers storage and retrieval. Essential for understanding ETL tradeoffs.

### ETL Patterns

3. **Gates, A. F., et al. (2009). "Building a High-Level Dataflow System on Top of Map-Reduce: The Pig Experience"**
   - Proceedings of the VLDB Endowment, 2(2), 1414-1425
   - Early academic work on high-level data pipeline abstractions.

4. **Apache Airflow Documentation**
   - Apache Software Foundation
   - https://airflow.apache.org/docs/apache-airflow/stable/
   - Industry-standard orchestration platform.

### Data Quality

5. **Schelter, S., et al. (2018). "Automating Large-Scale Data Quality Verification"**
   - Proceedings of the VLDB Endowment, 11(12), 1781-1794
   - Describes Deequ (AWS), a library for automated data quality checks at scale.

6. **Great Expectations Documentation**
   - https://docs.greatexpectations.io/
   - Open-source data validation and documentation framework.

### Idempotency and Exactly-Once Semantics

7. **Apache Kafka Documentation: "Exactly-Once Semantics"**
   - https://kafka.apache.org/documentation/
   - Describes transactional idempotency in distributed stream processing.

8. **Idempotency Keys — Stripe Engineering Blog**
   - https://stripe.com/blog/idempotency
   - How Stripe ensures API idempotency, applicable to pipeline design.

### Cloud-Native Data Engineering

9. **AWS Glue Documentation**
   - Amazon Web Services
   - https://docs.aws.amazon.com/glue/
   - Serverless ETL service with schema discovery and job bookmarks.

10. **dbt (Data Build Tool) Documentation**
    - https://docs.getdbt.com/
    - Transformation layer for data warehouses using SQL and Jinja.

### Industry Case Studies

11. **Netflix Tech Blog: "Benchmarking Apache Flink at Netflix"**
    - https://netflixtechblog.com/
    - Real-world streaming pipeline performance and reliability.

12. **Uber Engineering: "Michelangelo — Machine Learning Platform"**
    - https://www.uber.com/blog/michelangelo-machine-learning-platform/
    - Feature pipelines and data freshness requirements for ML.
