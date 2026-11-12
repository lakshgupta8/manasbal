---
"@manasbal/ui": minor
---

Adds the `Rating` component (five stars from the star and half-star icons for any value from 0 to 5 in halves, the value in words for assistive tech, an optional review count as text; any other value throws a `RangeError`) and the `Price` component (rupees with Indian grouping from whole paise, large and small; anything but a safe, non-negative whole number of paise throws a `TypeError`; screen readers hear "1,29,999 rupees"), plus `formatPaise`. `SampleBadge` gains `kind="item"` ("Sample", for product pictures and data) and a `label` prop for the page's language; its text moves to the small type step (14/20) and its colours to theme tokens.
