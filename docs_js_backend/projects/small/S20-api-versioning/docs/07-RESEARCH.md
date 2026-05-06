# 07-RESEARCH.md

## Citations and References

### API Design Fundamentals

1. **Fielding, R. T. (2000). "Architectural Styles and the Design of Network-based Software Architectures"**
   - Doctoral dissertation, University of California, Irvine
   - Chapter 5 defines REST architectural constraints, including the importance of interface stability.

2. **Richardson, L., & Amundsen, M. (2013). "RESTful Web APIs"**
   - O'Reilly Media
   - Chapter 10 covers API versioning strategies: URL, header, and media type approaches.

### Versioning Standards

3. **RFC 8594: The Deprecation HTTP Header Field**
   - IETF, 2019
   - https://tools.ietf.org/html/rfc8594
   - Standard for signaling deprecated resources via HTTP headers.

4. **RFC 8288: Web Linking**
   - IETF, 2017
   - https://tools.ietf.org/html/rfc8288
   - Defines the `Link` header used for successor-version references.

5. **RFC 6838: Media Type Specifications and Registration Procedures**
   - IETF, 2013
   - Foundation for vendor media types like `application/vnd.api.v1+json`.

### Industry Practice

6. **Stripe API Versioning Documentation**
   - https://stripe.com/docs/api/versioning
   - Date-based versioning with backward-compatible changes and automatic migration tools.

7. **GitHub API Versioning**
   - https://docs.github.com/en/rest/overview/api-versions
   - Media type versioning (`Accept: application/vnd.github+json`) with deprecation headers.

8. **Twitter API Versioning History**
   - https://developer.twitter.com/en/docs/twitter-api
   - Case study in the consequences of breaking changes and the evolution toward stable versioning.

### GraphQL as Alternative

9. **Brito, G., & Valente, M. T. (2020). "REST vs GraphQL: A Controlled Experiment"**
   - Proceedings of the IEEE International Conference on Software Analysis, Evolution and Reengineering (SANER)
   - Empirical comparison showing GraphQL reduces over-fetching but increases complexity for simple APIs.

10. **GraphQL Spec: Deprecation**
    - https://spec.graphql.org/October2021/#sec-Deprecation
    - `@deprecated` directive as an alternative to full API versioning.

### API Governance

11. **Zalando RESTful API Guidelines**
    - https://opensource.zalando.com/restful-api-guidelines/
    - Comprehensive industry guidelines including versioning, deprecation, and compatibility rules.

12. **Microsoft REST API Guidelines**
    - https://github.com/microsoft/api-guidelines
    - Microsoft's standards for API versioning, including URL and header approaches.
