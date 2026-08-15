# Firestore Security Specification: Paradise Co-Working & Shift Workspace

## 1. Data Invariants

- **Zero-Trust Role Lookups**: User authorization tier must be strictly checked by joining the authenticated `request.auth.uid` user document in `/users/{uid}`, rather than trusting client claims.
- **Strict User Role Ownership**: Block users from writing or escalating their own `role` property. Role assignments can only be created as a default "店長" profile, or modified strictly by a Brand Manager (BM).
- **Draft Exclusion Invariant**: Draft reports (`status == 'draft'`) are isolated; they can only be read, modified, or deleted by their original author (`authorId == request.auth.uid`) or viewed by a BM.
- **Relational Integrity for Messages & Comments**: Comments on weekly reports and messages in projects can only be created if their parents actually exist in Firestore.
- **Temporal Strictness**: `createdAt` and `updatedAt` properties must match the Firestore server-provided time (`request.time`) on writes.
- **PII Integrity and Separation**: Sensitive profile information, key management entries, and metrics must be safeguarded. No unauthenticated or unauthorized transversal reading of private indices is permitted.

---

## 2. The "Dirty Dozen" Threat Vectors (Under Test)

1. **Self-Promotion Exploit**: Regular user attempts to change their own role to `"BM"` via update - **DENIED**.
2. **Report Hijacking**: Regular user attempts to edit or overwrite another user's Weekly Report - **DENIED**.
3. **Orphaned Subcollection Insertion**: Posting a comment under a report that does not exist - **DENIED**.
4. **Draft Privacy Leak**: User tries to read or query draft reports authored by someone else - **DENIED**.
5. **Junk ID Parameter Injection**: Attempting to inject a 5KB junk string containing malicious characters matching `/reports/{reportId}` - **DENIED**.
6. **Self-Approval of Leave Plans**: Regular user attempts to write another member's `leave_plans` directly - **DENIED**.
7. **Temporal Fraud (Mocking Time)**: Injecting a mock client side timestamp in `createdAt` to simulate backdated creation - **DENIED**.
8. **Store Metrics Poisoning**: Regular Store Manager attempts to overwrite the metrics profile or review scores of a competitor store - **DENIED**.
9. **Unauthenticated Read Scraping**: Attempting to query `storeMetrics` or `key_passes` without an active auth session - **DENIED**.
10. **Ghost Field Poisoning**: Inserting extra unauthorized fields (such as `isVerified: true` or `isAdmin: true`) into user records or documents - **DENIED**.
11. **Direct Key Log Modification**: User tries to edit another user's key control permissions/possession without authorization - **DENIED**.
12. **Cascade Privilege Override**: Changing a project group's configuration from standard to admin-only by a non-BM user - **DENIED**.
