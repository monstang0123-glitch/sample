# Security Specification: JP Sneakers

## Data Invariants
1. A Product can only be created or modified by an Admin.
2. A User can only read and modify their own profile (except for `isAdmin` field).
3. A User can only manage items in their own Cart.
4. An Order can only be created by an authenticated user for themselves.
5. Once an Order is placed, its items and total cannot be changed by the user.
6. Only Admins can update Order status (e.g., to 'shipped').

## The Dirty Dozen (Vulnerability Payloads)

1. **Self-Promotion**: User tries to set `isAdmin: true` on their profile.
2. **Shadow Product**: Attacker tries to create a Product without Admin rights.
3. **Price Manipulation**: User tries to update a Product's price.
4. **Cart Hijack**: User A tries to add items to User B's cart.
5. **Order Forgery**: User tries to create an Order for another User ID.
6. **Status Escalation**: User tries to update their Order status to 'delivered' without payment.
7. **Orphaned Cart**: Attacker tries to add a CartItem with a non-existent `productId`.
8. **ID Poisoning**: Attacker uses a 1KB string as a `productId`.
9. **Timestamp Spoofing**: User tries to set a backdated `createdAt` on an Order.
10. **Ghost Fields**: User adds `internalNote: "VIP"` to their profile.
11. **Negative Stock**: Attacker tries to set Product stock to `-100`.
12. **Blanket Query**: Authenticated user tries to `list` all Orders in the system.

## Test Strategy
The `firestore.rules` must reject all the above payloads with `PERMISSION_DENIED`.
- `allow list` on `orders` collection MUST filter by `userId == request.auth.uid`.
- `allow write` on `products` MUST require `isAdmin()`.
- `isValidProduct` MUST check for type, size, and mandatory fields.
