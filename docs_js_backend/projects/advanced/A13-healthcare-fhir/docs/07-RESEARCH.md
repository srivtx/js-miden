# A13 Healthcare FHIR API: Research & Citations

## FHIR Specifications

1. **HL7 FHIR R4 Specification**
   - https://www.hl7.org/fhir/R4/
   - The official specification for FHIR Release 4. Defines all resources, data types, and REST API behavior.

2. **HL7 FHIR Security and Privacy Module**
   - https://www.hl7.org/fhir/R4/secpriv-module.html
   - Official guidance on security labels, consent, and audit logging.

3. **SMART on FHIR Authorization Guide**
   - http://hl7.org/fhir/smart-app-launch/
   - Defines how apps launch within EHRs and obtain OAuth2 tokens with FHIR-specific scopes.

## Regulatory Documents

4. **HIPAA Security Rule (45 CFR Part 160 and Subparts A and C of Part 164)**
   - https://www.hhs.gov/hipaa/for-professionals/security/index.html
   - Mandates access controls, audit controls, integrity controls, and transmission security.

5. **HITECH Act (2009)**
   - https://www.hhs.gov/hipaa/for-professionals/special-topics/hitech-act-enforcement-interim-final-rule/index.html
   - Strengthened HIPAA enforcement and introduced breach notification requirements.

6. **21st Century Cures Act (2016)**
   - https://www.healthit.gov/curesrule/
   - Mandates patient access to electronic health information via APIs (FHIR).

7. **CMS Patient Access API Rule (CMS-9115-F)**
   - https://www.cms.gov/newsroom/press-releases/trump-administration-delivers-historic-price-transparency-and-patient-data-requirements
   - Requires Medicare Advantage, Medicaid, and CHIP plans to provide FHIR APIs.

## Academic Papers

8. **Mandel, J. C., et al. (2016).** "SMART on FHIR: a standards-based, interoperable apps platform for electronic health records." *Journal of the American Medical Informatics Association*, 23(5), 899-908.
   - Describes the SMART on FHIR architecture and its adoption by major EHR vendors.

9. **Bender, D., & Sartipi, K. (2013).** "HL7 FHIR: An Agile and RESTful approach to healthcare information exchange." *Proceedings of the IEEE 26th International Symposium on Computer-Based Medical Systems*.
   - Early paper on FHIR's design principles compared to HL7 v2 and CDA.

## Breach Case Studies

10. **UCLA Health Settlement Agreement (2015)**
    - https://www.hhs.gov/about/news/2015/07/21/ucla-agrees-to-settle-potential-hipaa-violations.html
    - OCR official announcement of $865,000 settlement.

11. **Anthem Breach Settlement (2020)**
    - https://www.hhs.gov/about/news/2020/10/15/ocr-announces-settlement-anthem-inc-resulting-largest-us-health-data-breach-us-history.html
    - $16M OCR fine for 78.8M record breach.

12. **Premera Blue Cross Settlement (2020)**
    - https://www.hhs.gov/about/news/2020/09/25/ocr-announces-settlement-premera-blue-cross-resulting-2015-cyberattack-affecting-over-104-million-individuals.html
    - $6.85M fine for 11M record breach.

## Encryption Standards

13. **NIST SP 800-38D: Recommendation for Block Cipher Modes of Operation: Galois/Counter Mode (GCM)**
    - https://csrc.nist.gov/publications/detail/sp/800-38d/final
    - Official specification for AES-GCM.

14. **NIST SP 800-111: Guide to Storage Encryption Technologies for End User Devices**
    - https://csrc.nist.gov/publications/detail/sp/800-111/final
    - Guidance on encrypting data at rest.

## Books

15. **Benson, T., & Grieve, G. (2016).** *Principles of Health Interoperability: SNOMED CT, HL7 and FHIR*. Springer.
    - Comprehensive guide to healthcare interoperability standards.

16. **Ferranti, J. M., et al. (2017).** "The DevOps Adoption Playbook: A Guide to Adopting DevOps in Healthcare."
    - While not FHIR-specific, covers deployment practices for healthcare systems.

## Related to Our Bugs

17. **OCR Guidance on Access Control (2011)**
    - https://www.hhs.gov/hipaa/for-professionals/security/guidance/access-control/index.html
    - Specifically addresses the need for audit controls and access management.

18. **FDA Guidance on Cybersecurity in Medical Devices (2023)**
    - https://www.fda.gov/regulatory-information/search-fda-guidance-documents/cybersecurity-medical-devices-quality-system-considerations-and-content-premarket-submissions
    - Expands security requirements to connected medical devices, which often use FHIR.
