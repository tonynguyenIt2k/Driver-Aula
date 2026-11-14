# Open AULA Firestore Security Specification

## 1. Data Invariants
1. A user document `/users/{userId}` can only be read, created, updated, or deleted by the authenticated owner (`request.auth.uid == userId`), with `email_verified == true` for all writes. Listing `/users` is forbidden.
2. PII (`email`) is strictly isolated in `/users/{userId}/private/info` and requires the parent `/users/{userId}` document to exist.
3. Device profiles (`/users/{userId}/profiles/{profileKey}`) and saved macros (`/users/{userId}/macros/{macroId}`) require the parent `/users/{userId}` document to exist (`exists(...)`), enforce `ownerId == request.auth.uid`, forbid `ownerId` / `deviceId` / `profileSlot` / `macroId` / `createdAt` mutation, and enforce `updatedAt == request.time`.
4. All arrays (`actions`) are bounded (`<= 128` elements) and validated (`actions[0] is map`). All strings have strict `.size()` limits, and all IDs match `^[a-zA-Z0-9_\-]+$`.
5. All `list` queries on subcollections explicitly check `resource.data.ownerId == request.auth.uid`.

## 2. The "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. Unauthenticated read/write to `/users/uid1/profiles/aula-s75-pro_p1`.
2. Authenticated `uid2` reading or listing `/users/uid1/profiles`.
3. Authenticated `uid1` with `email_verified: false` creating `/users/uid1`.
4. Shadow field injection: `create` `/users/uid1` with `{ uid: "uid1", displayName: "A", isAdmin: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }`.
5. PII leakage attempt: `uid2` reading `/users/uid1/private/info`.
6. Identity spoofing: `uid1` creating `/users/uid1/macros/m1` with `ownerId: "uid2"`.
7. Orphan subcollection write: creating `/users/uid1/profiles/p1` before `/users/uid1` exists.
8. Oversized ID injection: document ID > 128 chars or containing invalid characters (`../evil`).
9. Client timestamp tampering: creating `/users/uid1/macros/m1` with `createdAt: Timestamp(2020-01-01)` instead of `request.time`.
10. Immutable field mutation: updating `ownerId` or `createdAt` on `/users/uid1/profiles/aula-s75-pro_p1`.
11. Unbounded/oversized array or string: `actions` list with > 128 entries or `name` > 100 chars.
12. Ghost field on update: updating `/users/uid1/macros/m1` with `affectedKeys` including `role` or `deviceId`.
