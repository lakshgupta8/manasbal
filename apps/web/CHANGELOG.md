# @manasbal/web

## 0.1.4

### Patch Changes

- 3a02150: Builds the theme from the design tokens: `@manasbal/ui/theme.css` holds every token as a CSS variable, a meaning layer (text, surface, border, brand) for light and dark, and a Tailwind theme. The storefront and the demo banner take their colours from it.
- Updated dependencies [693a9c3]
- Updated dependencies [e93f956]
- Updated dependencies [9e11a89]
- Updated dependencies [3a02150]
- Updated dependencies [9f6c0dc]
- Updated dependencies [fc99e14]
- Updated dependencies [307a2ba]
  - @manasbal/ui@0.0.3
  - @manasbal/sdk@0.2.1

## 0.1.3

### Patch Changes

- 5bc3b06: Add the `Notice` component to `@manasbal/ui`, and use it for the "Categories are unavailable right now" message on the home page.
- Updated dependencies [7b330ec]
- Updated dependencies [5bc3b06]
- Updated dependencies [90c1077]
  - @manasbal/ui@0.0.2
  - @manasbal/sdk@0.2.0

## 0.1.2

### Patch Changes

- @manasbal/sdk@0.1.2

## 0.1.1

### Patch Changes

- @manasbal/sdk@0.1.1

## 0.1.0

### Minor Changes

- 474a844: Home page lists the main categories from the API

### Patch Changes

- 82c9389: Upgrade Next.js to 16.4.1, which fixes two remote code execution flaws (image optimization of SVG files, and `use cache` functions) and a denial of service through Server Actions.
- Updated dependencies [f85c13d]
  - @manasbal/sdk@0.1.0
