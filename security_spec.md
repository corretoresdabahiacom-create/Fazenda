# Security Specification - Fazenda Inteligente

## Data Invariants
1. A user can only access their own data data (animals, pastures, etc.) stored under their userId.
2. Every document in subcollections must have a valid ID.
3. Timestamps should ideally be server-managed but we are using ISO strings for now in the code, so we validate string format.
4. Quantities and values must be non-negative.

## The "Dirty Dozen" Payloads

1. **Identity Spoofing**: Attempt to write an animal to another user's collection.
2. **Identity Spoofing**: Attempt to read another user's farm settings.
3. **Identity Spoofing**: Attempt to list another user's expenses.
4. **ID Poisoning**: Create an animal with a 2KB document ID.
5. **Schema Breach**: Create an animal with a `ghostField` that doesn't exist in the schema.
6. **Type Mismatch**: Submit a string for `quantity` in an animal document.
7. **Type Mismatch**: Submit a boolean for `totalValue` in a payment document.
8. **Resource Exhaustion**: Submit a 1MB string in `observation`.
9. **Relational Sync Breach**: Update an animal lot to a non-existent `currentPastureId`.
10. **State Shortcutting**: Create a task that is already marked as `completed` without going through the creation process (though this is simple, the rules should validate the whole object).
11. **PII Leak**: Attempt to read the entire `users` collection without specifying a userId.
12. **Malicious Write**: Attempt to delete another user's pasture.

## Test Strategy
We will use Firestore Security Rules to block all unauthorized access and validate data shapes.
We will ensure `allow list` checks `request.auth.uid`.
We will use validation helpers for each entity.
