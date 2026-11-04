# @manasbal/sdk

## 0.2.1

### Patch Changes

- e93f956: Users can list where they are signed in (GET /me/sessions) and end any session (DELETE /me/sessions/:id).
- fc99e14: Signed-in users can switch on two-step sign-in with an authenticator app (POST /auth/2fa/setup, POST /auth/2fa/enable) and get 10 recovery codes once; the secret is stored encrypted.
- 307a2ba: Sign-in asks for the authenticator-app code (or a recovery code) when two-step sign-in is on; each code works once, and two-step can be switched off with a code.
- Updated dependencies [94d943c]
- Updated dependencies [9259e7c]
- Updated dependencies [312620d]
- Updated dependencies [e93f956]
- Updated dependencies [fc99e14]
- Updated dependencies [307a2ba]
  - @manasbal/types@0.5.0

## 0.2.0

### Minor Changes

- 90c1077: The client takes an accessToken option (sent as a bearer token); demoUser is gone.

### Patch Changes

- Updated dependencies [eba2739]
- Updated dependencies [b5c7e2b]
- Updated dependencies [1dc77f0]
- Updated dependencies [7775290]
- Updated dependencies [668aa20]
  - @manasbal/types@0.4.0

## 0.1.2

### Patch Changes

- Updated dependencies [217df11]
  - @manasbal/types@0.3.0

## 0.1.1

### Patch Changes

- Updated dependencies [529247b]
- Updated dependencies [523f076]
- Updated dependencies [f0d897e]
  - @manasbal/types@0.2.0

## 0.1.0

### Minor Changes

- f85c13d: Client covers addresses, cart, orders, product detail, sellers, reviews and the admin audit log, and takes a demoUser option

### Patch Changes

- Updated dependencies [e33cb81]
- Updated dependencies [0f1834b]
  - @manasbal/types@0.1.0
