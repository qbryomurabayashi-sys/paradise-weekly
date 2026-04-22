# Firestore Security Specification: Paradise Weekly Reports

## 1. Data Invariants
- A `User` document must exist for every authenticated user, containing their `role` (verified by Firestore lookup, NOT auth claims).
- Access to `reports` is role-based:
  - `店長` can read all reports, write their own.
  - `AM` can read all reports, write their own.
  - `BM` can read all reports, manage everything.
- `User` documents containing PII are strictly restricted to the owner or admins (BM).

## 2. The "Dirty Dozen" Payloads
1. Create user with `role: "BM"` (Spoofing) - Should be DENIED.
2. Update another user's `role` - Should be DENIED.
3. Read `users` collection without `email_verified` - Should be DENIED.
4. Write report with `authorRole` mismatching own role - Should be DENIED.
5. Delete another user's report (as Store Manager) - Should be DENIED.
6. Inject 2KB string as ID - Should be DENIED.
7. Update `createdAt` timestamp - Should be DENIED.
8. Create report without `authorId` - Should be DENIED.
9. Get PII of another user - Should be DENIED.
10. Update `status` to 'finished' but still modify fields - Should be DENIED.
11. Create report with ghost field `isVerified: true` - Should be DENIED.
12. Write comment on report without existing parent - Should be DENIED.
