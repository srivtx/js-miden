# E03 Data Sync: Research & Citations

## Foundational CRDT Papers

1. **Shapiro, M., Preguiça, N., Baquero, C., & Zawirski, M. (2011).** "A comprehensive study of Convergent and Commutative Replicated Data Types." *Research Report RR-7506, INRIA*.
   - The paper that formalized CRDTs. Defines state-based and operation-based CRDTs with convergence proofs.
   - https://hal.inria.fr/inria-00555588/

2. **Shapiro, M., Preguiça, N., Baquero, C., & Zawirski, M. (2011).** "Conflict-free Replicated Data Types." *SSS 2011*.
   - Conference version of the above. More concise.

3. **Attiya, H., Burckhardt, S., Gotsman, A., Morrison, A., Yang, H., & Zawirski, M. (2016).** "Specification and Complexity of Collaborative Text Editing." *PODC 2016*.
   - Analyzes the computational complexity of text editing CRDTs.

## Industry Implementations

4. **Yjs: CRDT Framework for JavaScript**
   - https://docs.yjs.dev/
   - The most widely used CRDT library. Created by Marcin Warpechowski. Powers Figma, Relm, and many others.

5. **Automerge: A JSON-like data structure for building collaborative applications**
   - https://automerge.org/
   - Rust-based CRDT with excellent performance. Used by Ink & Switch research lab.

6. **Loro: Reimagine State Management**
   - https://loro.dev/
   - Next-generation CRDT with time-travel, undo/redo, and fractional indexing.

## Vector Clocks & Causality

7. **Mattern, F. (1988).** "Virtual Time and Global States of Distributed Systems." *Parallel and Distributed Algorithms*.
   - Introduces vector clocks for tracking causality in distributed systems.

8. **Fidge, C. J. (1991).** "Logical time in distributed computing systems." *Computer*, 24(8), 28-33.
   - Independent introduction of vector clocks.

## Operational Transformation (OT)

9. **Ellis, C. A., & Gibbs, S. J. (1989).** "Concurrency Control in Groupware Systems." *ACM SIGMOD Record*, 18(2), 399-407.
   - The foundational OT paper. Introduced the concept of transforming operations against each other.

10. **Sun, C., & Ellis, C. (1998).** "Operational Transformation in Real-Time Group Editors: Issues, Algorithms, and Achievements." *CSCW 1998*.
    - Comprehensive survey of OT algorithms and their challenges.

## Industry Case Studies

11. **Figma Engineering Blog: "How Figma's multiplayer technology works"**
    - https://www.figma.com/blog/how-figmas-multiplayer-technology-works/
    - Describes Figma's use of CRDTs for real-time design collaboration.

12. **Notion Engineering Blog: "Data Model Behind Notion's Flexibility"**
    - https://www.notion.so/blog/data-model-behind-notion
    - Describes Notion's block-based data model and sync architecture (uses OT, not CRDTs).

## Books

13. **Martin Kleppmann. (2017).** *Designing Data-Intensive Applications*. O'Reilly.
    - Chapter 5 (Replication) and Chapter 9 (Consistency and Consensus) cover CRDTs, vector clocks, and consistency models.

14. **Cachin, C., Guerraoui, R., & Rodrigues, L. (2011).** *Introduction to Reliable and Secure Distributed Programming*. Springer.
    - Textbook on distributed systems fundamentals, including causality and consensus.

## Related to Our Bugs

15. **Dropbox Engineering Blog: "The Scalable Sync Protocol"**
    - https://dropbox.tech/infrastructure/-the-scalable-sync-protocol
    - Describes how Dropbox handles sync at scale, including deletion propagation.

16. **Apple iCloud Documentation on Conflict Resolution**
    - https://developer.apple.com/documentation/coredata/mirroring_a_core_data_store_with_cloudkit/ckrecord/conflict_resolution_policies
    - Shows how Apple handles sync conflicts (server wins, client wins, or custom).

17. **Google Drive API: Manage Revisions**
    - https://developers.google.com/drive/api/guides/manage-revisions
    - Google's approach to versioning and conflict handling.
